import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./data";

const PAGINAS = join(import.meta.dirname, "../../../kit/kota/notion/paginas");

/** Itens da seção "## Acessos" de uma página do Notion da Kota, sem os links e em minúsculas. */
function acessos(pagina: string): string[] {
  const texto = readFileSync(join(PAGINAS, `${pagina}.md`), "utf8");
  const secao = texto.split("## Acessos")[1].split("\n## ")[0];
  return secao
    .split("\n")
    .filter((l) => l.startsWith("- [ ] "))
    .map((l) => l.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").toLowerCase());
}

describe("acessos do início", () => {
  // a tela diz que o gestor libera o que falta; o kit só confirma isso para os acessos da lista do vínculo
  it.each(["onboarding-novo", "onboarding-transicao"])("o que falta é um acesso que o gestor aprova em %s", (pagina) => {
    const lista = acessos(pagina);
    const faltando = TOOLS.filter((t) => t.status !== "ok");
    expect(faltando.length).toBeGreaterThan(0);
    for (const t of faltando) expect(lista.some((l) => l.includes(t.name.toLowerCase())), t.name).toBe(true);
  });
});
