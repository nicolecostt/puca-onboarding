import type { Regra } from "../contexto";
import { regraCodeowners } from "./codeowners";
import { regraMapa } from "./mapa";

export const regras: Regra[] = [regraMapa, regraCodeowners];
