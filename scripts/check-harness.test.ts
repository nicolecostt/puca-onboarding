import { describe, expect, it } from "vitest";
import { checarHooks, checarSkills, frontmatter, skillsDaTabela } from "./check-harness";

const skill = (nome: string, desc = "Chame automaticamente quando X.", corpo = "") =>
  ({ nome, conteudo: `---\nname: ${nome}\ndescription: ${desc}\n---\n\n# ${nome}\n${corpo}` });
const claude = (...nomes: string[]) =>
  ["## Skills da equipe", "", "| Situação | Skill |", "|---|---|", ...nomes.map((n) => `| quando | \`${n}\` (usa algo) |`)].join("\n");

describe("frontmatter e tabela", () => {
  it("lê name e description, tirando aspas", () => {
    expect(frontmatter('---\nname: x\ndescription: "a: b"\n---\ncorpo')).toEqual({ name: "x", description: "a: b" });
    expect(frontmatter("sem frontmatter")).toBeNull();
  });
  it("pega a skill da última coluna da tabela", () => {
    expect(skillsDaTabela(claude("sincronizar", "revisar"))).toEqual(["sincronizar", "revisar"]);
  });
});

describe("checarSkills", () => {
  it("aceita skills no padrão e na tabela", () => {
    expect(checarSkills([skill("a"), skill("b", undefined, "use a skill `a`")], claude("a", "b"))).toEqual({ erros: [], avisos: [] });
  });
  it("acusa skill fora da tabela, linha da tabela sem skill e name diferente da pasta", () => {
    const r = checarSkills([skill("a"), { nome: "b", conteudo: "---\nname: bb\ndescription: Chame automaticamente.\n---\n" }], claude("a", "c"));
    expect(r.erros.join("\n")).toMatch(/b\/SKILL.md: name "bb" diferente da pasta/);
    expect(r.erros.join("\n")).toMatch(/b\/SKILL.md: skill fora da tabela/);
    expect(r.erros.join("\n")).toMatch(/cita `c`, que não existe/);
  });
  it("acusa referência a skill que não existe e avisa description fora do padrão", () => {
    const r = checarSkills([skill("a", "Faz X.", "depois chame a skill `handof`")], claude("a"));
    expect(r.erros.join("\n")).toMatch(/SKILL.md:\d+: cita a skill `handof`/);
    expect(r.avisos.join("\n")).toMatch(/não começa com "Chame automaticamente/);
  });
});

describe("checarHooks", () => {
  const settings = (cmd: string) => JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: cmd }] }] } });
  const cmd = '"$CLAUDE_PROJECT_DIR"/scripts/x.sh --agora';
  it("aceita script que existe e é executável no git", () => {
    expect(checarHooks(settings(cmd), () => true, () => "100755")).toEqual({ erros: [], avisos: [] });
  });
  it("acusa script que não existe ou não é executável, e avisa o que não está no git", () => {
    expect(checarHooks(settings(cmd), () => false, () => null).erros.join()).toMatch(/scripts\/x.sh, que não existe/);
    expect(checarHooks(settings(cmd), () => true, () => "100644").erros.join()).toMatch(/não é executável no git/);
    expect(checarHooks(settings(cmd), () => true, () => null).avisos.join()).toMatch(/ainda não está no git/);
  });
  it("acusa JSON inválido", () => {
    expect(checarHooks("{ hooks: ", () => true, () => null).erros.join()).toMatch(/JSON inválido/);
  });
});
