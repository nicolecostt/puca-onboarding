// Guarda do navegador do Puca (docs/contratos.md, "Computer use"): ele só abre o mundo da Kota.

const REPO = "/JucaGF/kota-bank";
const NOTION = "lean-ptarmigan-dd2.notion.site";

/** O endereço é do mundo da Kota: o repositório kota-bank no GitHub ou o Notion público da Kota. */
export function permitido(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname === "github.com") return u.pathname === REPO || u.pathname.startsWith(`${REPO}/`);
  return u.hostname === NOTION;
}
