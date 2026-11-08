import { escopoDoPerfil } from "./profile";
import type { Profile } from "./types";
import { onboardingStore, readJson, writeJson, type KeyValueStore } from "./storage";

// Progresso da sessão no quadro, no mesmo escopo de armazenamento da call inicial.
function key(profile: Profile): string {
  return `puca:sessao-concluida:${escopoDoPerfil(profile)}`;
}

export function sessionCompleted(profile: Profile, store?: KeyValueStore): boolean {
  try {
    return readJson<unknown>(store ?? onboardingStore(), key(profile), false) === true;
  } catch {
    return false;
  }
}

export function completeSession(profile: Profile, store?: KeyValueStore): void {
  try {
    writeJson(store ?? onboardingStore(), key(profile), true);
  } catch {
    // A sessão termina mesmo com o armazenamento bloqueado.
  }
}
