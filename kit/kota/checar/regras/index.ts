import type { Regra } from "../contexto";
import { regraAdrs } from "./adrs";
import { regraCodeowners } from "./codeowners";
import { regraKotaPeople } from "./kota-people";
import { regraMapa } from "./mapa";
import { regraNotionUrls } from "./notion-urls";
import { regrasPaginas } from "./paginas";

export const regras: Regra[] = [regraMapa, regraCodeowners, regraAdrs, regraNotionUrls, ...regrasPaginas, regraKotaPeople];
