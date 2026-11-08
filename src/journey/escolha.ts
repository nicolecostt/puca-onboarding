// Escolha do perfil antes da call inicial (PRODUCT.md §13.1: o jurado escolhe com quem entra na Kota). Os dois perfis
// são fixos na demo: a escolha grava o perfil e a calibragem de exemplo da pessoa escolhida, e a call, se acontecer,
// grava por cima com as respostas dela.
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
