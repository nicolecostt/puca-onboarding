import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapa } from "../mapa";
import { verificarTarefa } from "../tarefas/publicar";
import { TAREFAS, type TarefaKota } from "../tarefas/tarefas";

const git = (raiz: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=Kota", "-c", "user.email=kit@kota.example", ...args], { cwd: raiz, encoding: "utf8" }).trim();

// testar.sh de mentira: falha só no teste esperado quando estado.txt diz "quebrado".
const TESTAR = `#!/bin/sh
if grep -q quebrado estado.txt; then
  echo "[ERROR]   ValidatorTest.recusa:12 expected"; echo "[ERROR] Tests run: 3, Failures: 1, Errors: 0, Skipped: 0"; exit 1
fi
echo "[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0"
`;

const t: TarefaKota = { ...TAREFAS[0], chave: "exemplo", servico: "ledgerwriter", testeQueFalha: "ValidatorTest.recusa" };
const thiago = mapa.pessoas.find((p) => p.id === t.autor)!;

function cenario(solucaoConserta = true) {
  const raiz = mkdtempSync(join(tmpdir(), "kota-tarefas-"));
  const repo = join(raiz, "kota-bank");
  const patches = join(raiz, "patches");
  mkdirSync(join(repo, "scripts"), { recursive: true });
  mkdirSync(join(patches, t.chave), { recursive: true });
  writeFileSync(join(repo, "scripts/testar.sh"), TESTAR);
  chmodSync(join(repo, "scripts/testar.sh"), 0o755);
  writeFileSync(join(repo, "estado.txt"), "ok\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "base");
  const commitar = (estado: string, nome: string) => {
    writeFileSync(join(repo, "estado.txt"), estado);
    git(repo, "commit", "-q", "-am", nome, `--author=${thiago.nome} <${thiago.email}>`);
    writeFileSync(join(patches, t.chave, `${nome}.patch`), git(repo, "format-patch", "--stdout", "-1", "HEAD") + "\n");
  };
  commitar("quebrado\n", "teste");
  commitar(solucaoConserta ? "ok de novo\n" : "quebrado ainda\n", "solucao");
  git(repo, "reset", "-q", "--hard", "HEAD~2");
  return { repo, patches };
}

describe("verificarTarefa", () => {
  it("aplica os patches sobre a main com o autor da tarefa e confere as três saídas", () => {
    const { repo, patches } = cenario();
    const v = verificarTarefa(repo, t, mapa, patches);
    expect(v.erros).toEqual([]);
    expect(git(repo, "log", "--format=%an <%ae>|%cn <%ce>", "-2", v.solucao)).toBe(
      [`${thiago.nome} <${thiago.email}>|${thiago.nome} <${thiago.email}>`, `${thiago.nome} <${thiago.email}>|${thiago.nome} <${thiago.email}>`].join("\n"),
    );
    expect(git(repo, "rev-parse", `${v.solucao}~1`)).toBe(v.tarefa);
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  it("rodar de novo dá os mesmos commits, para o push não precisar de --force", async () => {
    const { repo, patches } = cenario();
    const primeira = verificarTarefa(repo, t, mapa, patches);
    await new Promise((r) => setTimeout(r, 1100)); // o git grava a data em segundos
    const segunda = verificarTarefa(repo, t, mapa, patches);
    expect(segunda.tarefa).toBe(primeira.tarefa);
    expect(segunda.solucao).toBe(primeira.solucao);
  });

  it("acusa a solução que não conserta e volta para a main", () => {
    const { repo, patches } = cenario(false);
    const v = verificarTarefa(repo, t, mapa, patches);
    expect(v.erros).toHaveLength(1);
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
  });
});
