import { validarMapa } from "../../validar";
import type { Regra } from "../contexto";

export const regraMapa: Regra = { nome: "mapa", precisaRepo: false, checar: (ctx) => validarMapa(ctx.mapa) };
