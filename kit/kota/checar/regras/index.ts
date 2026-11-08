import type { Regra } from "../contexto";
import { regraCodeowners } from "./codeowners";
import { regraMapa } from "./mapa";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraNotionUrls, ...regrasPaginas];
