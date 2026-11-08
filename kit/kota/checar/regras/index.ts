import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraAutores } from "./autores";
import { regraCodeowners } from "./codeowners";
import { regraJornadaDaKota } from "./jornada";
import { regraKotaPeople } from "./kota-people";
import { regraMapa } from "./mapa";
import { regraMarca } from "./marca";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";
import { regraReadmeRaiz } from "./readme-raiz";
import { regraReadmes } from "./readmes";
import { regraRunbooks } from "./runbooks";
import { regraSegredos } from "./segredos";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs, regraNotionUrls, regraRunbooks, regraReadmes, ...regrasPaginas, regraKotaPeople, regraMarca, regraSegredos, regraReadmeRaiz, regraJornadaDaKota, regraAutores];
