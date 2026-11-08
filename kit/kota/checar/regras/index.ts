import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraCodeowners } from "./codeowners";
import { regraMapa } from "./mapa";
import { regraMarca } from "./marca";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";
import { regraReadmeRaiz } from "./readme-raiz";
import { regraReadmes } from "./readmes";
import { regraRunbooks } from "./runbooks";
import { regraSegredos } from "./segredos";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs, regraNotionUrls, regraRunbooks, regraReadmes, ...regrasPaginas, regraMarca, regraSegredos, regraReadmeRaiz];
