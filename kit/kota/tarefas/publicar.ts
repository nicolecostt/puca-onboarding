import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import type { MapaKota, PessoaKota } from "../tipos";
import { conferirTarefa, corpoIssue, TAREFAS, type Saida, type TarefaKota } from "./tarefas";

const PASTA = dirname(fileURLToPath(import.meta.url));
const LABEL = "primeira-tarefa";

const executar = (cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) =>
  execFileSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function testar(publico: string, servico: string): Saida {
  const r = spawnSync("scripts/testar.sh", [servico], { cwd: publico, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, texto: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// Committer e data vêm do patch: rodar de novo gera os mesmos commits, e o push vira no-op em vez de exigir --force.
function aplicar(publico: string, patch: string, autor: PessoaKota): string {
  const env = { GIT_COMMITTER_NAME: autor.nome, GIT_COMMITTER_EMAIL: autor.email };
  executar("git", ["am", "-q", "--committer-date-is-author-date", patch], publico, env);
  return executar("git", ["rev-parse", "HEAD"], publico);
}

// Só no checkout local: main, main + teste.patch e + solucao.patch, cada um com scripts/testar.sh.
export function verificarTarefa(
  publico: string,
  t: TarefaKota,
  m: MapaKota,
  patches = PASTA,
): { tarefa: string; solucao: string; erros: string[] } {
  const autor = m.pessoas.find((p) => p.id === t.autor)!;
  try {
    executar("git", ["switch", "-q", "--detach", "main"], publico);
    const main = testar(publico, t.servico);
    const tarefa = aplicar(publico, join(patches, t.chave, "teste.patch"), autor);
    const saidaTarefa = testar(publico, t.servico);
    const solucao = aplicar(publico, join(patches, t.chave, "solucao.patch"), autor);
    const saidaSolucao = testar(publico, t.servico);
    return { tarefa, solucao, erros: conferirTarefa({ main, tarefa: saidaTarefa, solucao: saidaSolucao }, t) };
  } finally {
    spawnSync("git", ["am", "--abort"], { cwd: publico, stdio: "ignore" });
    executar("git", ["switch", "-q", "main"], publico);
  }
}

function issueDaTarefa(repo: string, t: TarefaKota): number {
  const abertas: { number: number; title: string }[] = JSON.parse(
    executar("gh", ["issue", "list", "-R", repo, "--label", LABEL, "--state", "all", "--limit", "100", "--json", "number,title"], "."),
  );
  const achada = abertas.find((i) => i.title === t.titulo);
  if (achada) return achada.number;
  const url = executar("gh", ["issue", "create", "-R", repo, "--title", t.titulo, "--label", LABEL, "--body", "Em preparação."], ".");
  return Number(url.split("/").pop());
}

// Nada vai ao GitHub antes de todas as tarefas passarem na conferência: uma issue sem branch confundiria o jurado.
export async function publicarTarefas(
  publico: string,
  tarefas: TarefaKota[],
  m: MapaKota,
  urls: Record<string, string>,
): Promise<{ chave: string; n: number }[]> {
  const verificadas = tarefas.map((t) => {
    const v = verificarTarefa(publico, t, m);
    console.log(`${t.chave}: ${v.erros.length ? v.erros.join("; ") : `ok, ${t.testeQueFalha} falha só na branch tarefa`}`);
    return { t, ...v };
  });
  const erros = verificadas.flatMap((v) => v.erros);
  if (erros.length) throw new Error(`nada publicado:\n${erros.join("\n")}`);

  executar("gh", ["label", "create", LABEL, "-R", m.repo, "--color", "0E8A16", "--description", "Primeira tarefa de quem chega ao time", "--force"], ".");
  return verificadas.map(({ t, tarefa, solucao }) => {
    const n = issueDaTarefa(m.repo, t);
    executar("git", ["push", "-q", "origin", `${tarefa}:refs/heads/tarefa/${n}`, `${solucao}:refs/heads/solucao/${n}`], publico);
    executar("gh", ["issue", "edit", String(n), "-R", m.repo, "--body", corpoIssue(t, n, m, urls)], ".");
    console.log(`#${n} ${t.titulo}`);
    return { chave: t.chave, n };
  });
}

async function main() {
  const publico = process.argv[2];
  if (!publico) {
    console.error("uso: npm run kota:tarefas -- <checkout do kota-bank>");
    process.exit(1);
  }
  const urls = JSON.parse(readFileSync(join(PASTA, "../notion/urls.json"), "utf8"));
  await publicarTarefas(resolve(publico), TAREFAS, mapa, urls);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
