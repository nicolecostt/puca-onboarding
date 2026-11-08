import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import { carregarContexto, type ContextoKota, type Regra } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraCodeowners } from "../checar/regras/codeowners";
import { regraMapa } from "../checar/regras/mapa";
import { gerarCodeowners } from "../gerar/codeowners";
import { mapa } from "../mapa";

const RAIZ = fileURLToPath(new URL("../../..", import.meta.url));
const pastaTemp = () => mkdtempSync(join(tmpdir(), "kota-checar-"));
const ctx: ContextoKota = { mapa, repo: "/repo", notionUrls: {}, jornadas: [] };
const regra = (nome: string, precisaRepo: boolean, erros: string[]): Regra => ({ nome, precisaRepo, checar: () => erros });

function gravarCodeowners(repo: string, conteudo: string) {
  mkdirSync(join(repo, ".github"), { recursive: true });
  writeFileSync(join(repo, ".github", "CODEOWNERS"), conteudo);
}

describe("checarKota", () => {
  it("junta os erros de todas as regras com o nome da regra", () =>
    expect(checarKota(ctx, [regra("mapa", false, ["time contas: sem buddy"]), regra("codeowners", true, ["a", "b"])]).erros)
      .toEqual(["[mapa] time contas: sem buddy", "[codeowners] a", "[codeowners] b"]));

  it("pula regra que precisa de repo quando não há repo e avisa", () =>
    expect(checarKota({ ...ctx, repo: undefined }, [regra("mapa", false, ["x"]), regra("codeowners", true, ["não devia rodar"])]))
      .toEqual({ erros: ["[mapa] x"], pulas: ["codeowners: sem --repo"] }));

  it("regra que lança vira erro dela e não cala as outras", () => {
    const quebra: Regra = { nome: "runbooks", precisaRepo: true, checar: () => { throw new Error("ENOENT: docker-compose.yml"); } };
    expect(checarKota(ctx, [regra("mapa", false, ["x"]), quebra, regra("adrs", true, ["y"])]).erros)
      .toEqual(["[mapa] x", "[runbooks] falhou: ENOENT: docker-compose.yml", "[adrs] y"]);
  });

  it("mapa com referência solta: o erro do mapa aparece mesmo com --repo", () => {
    const repo = pastaTemp();
    gravarCodeowners(repo, gerarCodeowners(mapa));
    const solto = { ...mapa, times: mapa.times.map((t) => (t.id === "livro-razao" ? { ...t, techLead: "thiago-n" } : t)) };
    const { erros } = checarKota({ ...ctx, mapa: solto, repo }, regras);
    expect(erros).toContain('[mapa] time livro-razao: tech lead "thiago-n" não existe');
    expect(erros).toContainEqual(expect.stringMatching(/^\[codeowners\] falhou: /));
  });
});

describe("regra mapa", () => {
  it("devolve os erros de validarMapa", () => {
    expect(regraMapa.checar(ctx)).toEqual([]);
    const semBuddy = { ...mapa, times: mapa.times.map((t) => ({ ...t, buddies: [] })) };
    expect(regraMapa.checar({ ...ctx, mapa: semBuddy })).toContain("time contas: sem buddy");
  });
});

describe("regra codeowners", () => {
  it("acusa arquivo ausente e arquivo diferente do gerado", () => {
    const repo = pastaTemp();
    expect(regraCodeowners.checar({ ...ctx, repo })).toEqual([expect.stringMatching(/\.github\/CODEOWNERS não existe/)]);
    gravarCodeowners(repo, gerarCodeowners(mapa).replace("@kota.example", "@outro.example"));
    expect(regraCodeowners.checar({ ...ctx, repo })).toEqual([expect.stringMatching(/\.github\/CODEOWNERS difere do gerado/)]);
  });

  it("acusa CODEOWNERS com outra caixa no caminho, como o GitHub, mesmo em disco que não diferencia", () => {
    for (const [pasta, arquivo] of [[".github", "codeowners"], [".GITHUB", "CODEOWNERS"]]) {
      const repo = pastaTemp();
      mkdirSync(join(repo, pasta));
      writeFileSync(join(repo, pasta, arquivo), gerarCodeowners(mapa));
      expect(regraCodeowners.checar({ ...ctx, repo })).toEqual([expect.stringMatching(/\.github\/CODEOWNERS não existe/)]);
    }
  });

  it("acusa CODEOWNERS que é pasta sem lançar", () => {
    const repo = pastaTemp();
    mkdirSync(join(repo, ".github", "CODEOWNERS"), { recursive: true });
    expect(regraCodeowners.checar({ ...ctx, repo })).toEqual([expect.stringMatching(/\.github\/CODEOWNERS não existe/)]);
  });

  it("aceita o CODEOWNERS igual ao gerado do mapa", () => {
    const repo = pastaTemp();
    gravarCodeowners(repo, gerarCodeowners(mapa));
    expect(regraCodeowners.checar({ ...ctx, repo })).toEqual([]);
  });
});

describe("carregarContexto", () => {
  const raizCom = (arquivos: Record<string, string>) => {
    const raiz = pastaTemp();
    for (const [caminho, conteudo] of Object.entries(arquivos)) {
      mkdirSync(join(raiz, caminho, ".."), { recursive: true });
      writeFileSync(join(raiz, caminho), conteudo);
    }
    return raiz;
  };

  it("sem urls.json, notionUrls é {}; jornadas são os *.journey.json", () => {
    const raiz = raizCom({ "src/journey/data/b.journey.json": "{}", "src/journey/data/a.journey.json": "{}", "src/journey/data/notas.json": "{}" });
    const c = carregarContexto(raiz);
    expect(c.notionUrls).toEqual({});
    expect(c.jornadas).toEqual([join(raiz, "src/journey/data/a.journey.json"), join(raiz, "src/journey/data/b.journey.json")]);
  });

  it("lê kit/kota/notion/urls.json quando existe", () => {
    const urls = { kota: "https://kota.notion.site/abc" };
    const raiz = raizCom({ "src/journey/data/a.journey.json": "{}", "kit/kota/notion/urls.json": JSON.stringify(urls) });
    expect(carregarContexto(raiz).notionUrls).toEqual(urls);
  });
});

describe("CLI", () => {
  const rodar = (...args: string[]) =>
    spawnSync("node_modules/.bin/tsx", ["kit/kota/checar/cli.ts", ...args], { cwd: RAIZ, encoding: "utf8" });

  it("sem --repo, avisa cada regra pulada", () =>
    expect(rodar().stdout).toContain("regra codeowners pulada: sem --repo"));

  it("com --repo, roda as regras do repo e sai com 1 quando alguma acusa", () => {
    const r = rodar("--repo", pastaTemp());
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/\[codeowners\] .*CODEOWNERS não existe/);
    expect(r.stdout).not.toContain("pulada");
  });

  it("--repo que não existe ou argumento desconhecido: sai com 1 e diz por quê", () => {
    expect(rodar("--repo", join(pastaTemp(), "nada"))).toMatchObject({ status: 1, stderr: expect.stringMatching(/não existe/) });
    expect(rodar("--rep", "x")).toMatchObject({ status: 1, stderr: expect.stringMatching(/uso: npm run check:kota -- \[--repo <caminho>\]/) });
  });
});
