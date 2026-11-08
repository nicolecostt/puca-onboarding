// Notion da Kota inteiro, para a parte fixa do prompt do turno (decisão 0012; um dos caminhos da #25).
// ~85 KB: cabe no Claude e fica no cache de prompt; a busca entra se a qualidade ou a latência pedirem.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../../../kit/kota/notion/paginas/", import.meta.url);

/** As páginas como texto, cada uma com o nome do arquivo (é como Puca cita a fonte). Vazio sem o kit. */
export function notionDaKota(dir: URL = DIR): string {
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `<pagina id="${f.slice(0, -3)}">\n${readFileSync(new URL(f, dir), "utf8").trim()}\n</pagina>`)
    .join("\n\n");
}
