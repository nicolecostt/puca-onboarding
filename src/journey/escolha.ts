// Escolha do perfil (PRODUCT.md §13.1: o jurado escolhe com quem entra na Kota). Os dois perfis são fixos na demo.
// Nas boas-vindas, a escolha só vai para a call como ?perfil= (perfil salvo quer dizer call feita); por cima da sessão,
// aberta sem perfil, `escolherPerfil` grava o perfil e a calibragem de exemplo da pessoa escolhida.
import { DEMO_CALIBRAGENS, saveCalibragem } from "./calibragem";
import { DEMO_PROFILES, saveProfile } from "./profile";
import type { Profile, Vinculo } from "./types";

/** O perfil da demo de cada vínculo, como no ?perfil= (src/data/profiles.ts). */
export const ID_DO_VINCULO: Record<Vinculo, "ana" | "bruno"> = { novo: "ana", transicao: "bruno" };

export function escolherPerfil(vinculo: Vinculo): Profile {
  saveProfile(DEMO_PROFILES[vinculo]);
  saveCalibragem(DEMO_CALIBRAGENS[vinculo]);
  return DEMO_PROFILES[vinculo];
}
