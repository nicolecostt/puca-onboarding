import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraCodeowners } from "./codeowners";
import { regraKotaPeople } from "./kota-people";
import { regraMapa } from "./mapa";
import { regraMarca } from "./marca";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";
import { regraReadmeRaiz } from "./readme-raiz";
import { regraSegredos } from "./segredos";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs, regraNotionUrls, ...regrasPaginas, regraKotaPeople, regraMarca, regraSegredos, regraReadmeRaiz];
