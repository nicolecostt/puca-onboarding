// Onde a Lousa guarda o que precisa sobreviver entre telas (rastro, encaminhamentos): o localStorage
// do navegador, atrás de uma interface simples para os testes rodarem em node. Nada aqui pode
// quebrar a sessão: aba anônima, cota cheia ou JSON corrompido viram "não guardou" / "lista vazia".

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** localStorage, ou memória se o navegador bloquear o acesso. */
export function browserStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    if (ls) return ls;
  } catch {
    // acesso bloqueado (alguns modos privados)
  }
  return memoryStore();
}

export function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // cota cheia ou bloqueado: a sessão segue sem guardar
  }
}
