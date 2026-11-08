// Id único que funciona fora de contexto seguro: crypto.randomUUID só existe em https e localhost,
// e o Orbis também roda por http://<ip-da-rede> (outro computador ou celular na mesma rede).
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) return [...c.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
