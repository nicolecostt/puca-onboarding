import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MapaKota } from "../../tipos";
import type { Regra } from "../contexto";

// A política explica a regra geral; o caso da pessoa vai ao gestor ou a People por esta linha (#125).
const LINHA = "Casos individuais: fale com seu gestor ou com People (people@kota.example).";
const COM_A_LINHA = ["bonus", "promocao", "revisao-salarial"];
// O ciclo de desempenho mede por estas páginas; se elas citam quem o jurado vive, Puca acaba avaliando a pessoa (§12.2).
const REGUA = ["quem-somos", "ciclo-de-desempenho", "trilha-de-carreira", "promocao", "bonus", "revisao-salarial"];

// Página que falta é acusada pela paginas-escritas.
export function criarRegraKotaPeople(pasta: string): Regra {
  const ler = (chave: string) => {
    const f = join(pasta, `${chave}.md`);
    return existsSync(f) ? readFileSync(f, "utf8") : undefined;
  };
  return {
    nome: "kota-people",
    precisaRepo: false,
    checar: (ctx) => [
      ...COM_A_LINHA.filter((c) => ler(c)?.split(/\r?\n/).includes(LINHA) === false)
        .map((c) => `paginas/${c}.md: falta a linha "${LINHA}"`),
      ...REGUA.flatMap((c) => perfisCitados(ler(c), ctx.mapa).map((nome) =>
        `paginas/${c}.md: cita ${nome}, de um perfil do jurado; a régua do ciclo de desempenho não fala de quem o jurado vive`)),
    ],
  };
}

function perfisCitados(md: string | undefined, m: MapaKota): string[] {
  if (md === undefined) return [];
  const palavras = new Set(md.split(/[^\p{L}\p{M}]+/u));
  return [m.perfis.novo.pessoa, m.perfis.transicao.pessoa]
    .flatMap((id) => m.pessoas.filter((p) => p.id === id))
    .filter((p) => palavras.has(p.nome.split(" ")[0]))
    .map((p) => p.nome);
}

export const regraKotaPeople = criarRegraKotaPeople(fileURLToPath(new URL("../../notion/paginas", import.meta.url)));
