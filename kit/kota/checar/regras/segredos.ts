import { arquivosDoRepo, lerTexto } from "../../repo";
import type { Regra } from "../contexto";

// O kota-bank é público. A mensagem diz só onde está e o que é, para o segredo não ir parar no log do CI.
const SEGREDOS: [RegExp, string][] = [
  [/PRIVATE KEY/, "chave privada"],
  [/LS0tLS1CRUdJTi/, "chave PEM em base64"],   // "-----BEGIN" em base64, que a busca por PRIVATE KEY não pega
  [/xoxb-/, "token de bot do Slack"],
];

export const regraSegredos: Regra = {
  nome: "segredos",
  precisaRepo: true,
  checar(ctx) {
    return arquivosDoRepo(ctx.repo!).flatMap((arquivo) =>
      (lerTexto(ctx.repo!, arquivo)?.split("\n") ?? []).flatMap((linha, i) =>
        SEGREDOS.filter(([padrao]) => padrao.test(linha)).map(([, oQue]) => `${arquivo}:${i + 1}: ${oQue}`)));
  },
};
