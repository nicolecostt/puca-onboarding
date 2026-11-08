import { arquivosDoRepo, lerTexto } from "../repo";
import { linhasDaOrigem } from "./origem";

export interface Ocorrencia { arquivo: string; linha: number; texto: string }

const MARCA = /anthos|cymbal/i;
const GOOGLE = /\bGoogle\b/;
const procuraGoogle = (caminho: string) => /\.(md|html)$/.test(caminho) || caminho.startsWith("src/frontend/templates/");

export function acharMarca(raiz: string): Ocorrencia[] {
  return arquivosDoRepo(raiz).flatMap((arquivo) => {
    const texto = lerTexto(raiz, arquivo);
    if (texto === undefined) return [];
    const linhas = texto.split("\n");
    const origem = linhasDaOrigem(arquivo, linhas);
    const marcas = procuraGoogle(arquivo) ? [MARCA, GOOGLE] : [MARCA];
    return linhas.flatMap((l, i) =>
      !origem.has(i) && marcas.some((m) => m.test(l)) ? [{ arquivo, linha: i + 1, texto: l.trim() }] : []);
  });
}
