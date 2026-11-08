import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraCodeowners } from "./codeowners";
import { regraMapa } from "./mapa";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";
import { regraReadmes } from "./readmes";
import { regraRunbooks } from "./runbooks";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs, regraNotionUrls, regraRunbooks, regraReadmes, ...regrasPaginas];
