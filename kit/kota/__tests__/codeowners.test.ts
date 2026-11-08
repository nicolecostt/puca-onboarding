import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gerarCodeowners } from "../gerar/codeowners";
import { mapa } from "../mapa";

const m = mapa;
const email = (id: string) => m.pessoas.find((p) => p.id === id)!.email;
const time = (id: string) => m.times.find((t) => t.id === id)!;
const linhas = () => gerarCodeowners(m).split("\n");
const padroes = () => linhas().filter((l) => l !== "" && !l.startsWith("#"));

it("primeira linha avisa que é gerado", () => expect(linhas()[0]).toMatch(/^# Gerado do mapa da Kota/));

it("padrão do repo é o time de plataforma", () => {
  const t = time("plataforma");
  expect(linhas()).toContain(`* ${email(t.techLead)} ${email(t.gestor)}`);
});

it("cada sistema vira /<pasta>/ com e-mails do tech lead e do gestor do time", () => {
  for (const s of m.sistemas) {
    const t = time(s.time);
    expect(linhas()).toContain(`/${s.pasta}/ ${email(t.techLead)} ${email(t.gestor)}`);
  }
});

it("nunca usa @handle", () => expect(gerarCodeowners(mapa)).not.toMatch(/(^|\s)@\w/m));

it("docs/adr/ fica com os tech leads de todos os times", () => {
  const adr = linhas().find((l) => l.startsWith("/docs/adr/ "));
  expect(adr?.split(" ").slice(1).sort()).toEqual(m.times.map((t) => email(t.techLead)).sort());
});

it("vale o último padrão que casa: * vem primeiro, docs/adr/ por último, um padrão por sistema no meio", () => {
  const p = padroes();
  expect(p.at(0)?.split(" ")[0]).toBe("*");
  expect(p.at(-1)?.split(" ")[0]).toBe("/docs/adr/");
  expect(p).toHaveLength(m.sistemas.length + 2);
});

describe("CLI", () => {
  const rodar = (...args: string[]) =>
    spawnSync("node_modules/.bin/tsx", ["kit/kota/gerar/codeowners.ts", ...args], { cwd: fileURLToPath(new URL("../../..", import.meta.url)), encoding: "utf8" });

  it("grava o gerado no caminho pedido, criando a pasta que faltar", () => {
    const saida = join(mkdtempSync(join(tmpdir(), "kota-codeowners-")), ".github", "CODEOWNERS");
    const r = rodar(saida);
    expect(r.status).toBe(0);
    expect(readFileSync(saida, "utf8")).toBe(gerarCodeowners(mapa));
  });

  it("sem caminho de saída, falha e diz como usar", () => {
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/kota:codeowners -- <arquivo de saída>/);
  });
});
