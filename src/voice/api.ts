// Endereço do servidor de Puca (docs/contratos.md, "API do servidor"). No `npm run dev`, VITE_API_URL fica vazio e o
// caminho segue relativo (o Vite repassa /api). No app para Mac, o build põe o endereço do Fly.
const BASE = String(import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Junta a base ao caminho do servidor (`/api/...`). Endereço completo (`https://…`) passa direto. */
export function apiUrl(path: string, base: string = BASE): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}${path}`;
}
