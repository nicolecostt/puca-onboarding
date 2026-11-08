import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraCodeowners } from "./codeowners";
import { regraMapa } from "./mapa";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs];
