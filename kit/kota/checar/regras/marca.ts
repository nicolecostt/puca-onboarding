import { acharMarca } from "../../marca/achar";
import type { Regra } from "../contexto";

export const regraMarca: Regra = {
  nome: "marca",
  precisaRepo: true,
  checar: (ctx) => acharMarca(ctx.repo!).map((o) => `${o.arquivo}:${o.linha}: ${o.texto}`),
};
