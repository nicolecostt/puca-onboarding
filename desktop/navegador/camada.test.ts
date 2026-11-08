import { describe, expect, it } from "vitest";
import { CAMADA, escolherAlvo, normalizar } from "./camada";

describe("camada de Puca", () => {
  it("normaliza sem maiúscula, acento nem espaço sobrando", () => {
    expect(normalizar("  Livro-Razão\n ")).toBe("livro-razao");
    expect(normalizar("Meu   texto")).toBe("meu texto");
  });

  it("escolhe o clicável visível de texto mais curto", () => {
    const c = [
      { texto: "README.md (2)", visivel: true, clicavel: false },
      { texto: "README.md", visivel: true, clicavel: true },
    ];
    expect(escolherAlvo(c, "readme.md")).toBe(1);
  });

  it("nunca escolhe invisível e devolve -1 sem alvo", () => {
    expect(escolherAlvo([{ texto: "README.md", visivel: false, clicavel: true }], "README.md")).toBe(-1);
    expect(escolherAlvo([{ texto: "Issues", visivel: true, clicavel: true }], "README.md")).toBe(-1);
  });

  it("o script injetado usa as mesmas funções", () => {
    expect(CAMADA).toContain("function normalizar");
    expect(CAMADA).toContain("function escolherAlvo");
  });
});
