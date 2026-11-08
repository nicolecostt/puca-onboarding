import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import { arquivosDoRepo } from "../repo";
import type { MapaKota, PessoaKota } from "../tipos";
import { arquivosSemPasso, type PassoHistoria, PLANO_HISTORIA, passoDoArquivo } from "./plano";

const git = (raiz: string, args: string[], env?: NodeJS.ProcessEnv, input?: string) =>
  execFileSync("git", args, { cwd: raiz, encoding: "utf8", env: env && { ...process.env, ...env }, input });

export function publicarHistoria(oficina: string, publico: string, plano: PassoHistoria[], m: MapaKota): { commits: string[] } {
  const arquivos = arquivosDoRepo(oficina);
  const pessoas = conferirAntes(arquivos, publico, plano, m);
  const doPasso = plano.map(() => [] as string[]);
  for (const a of arquivos) doPasso[passoDoArquivo(a, plano)].push(a);
  const naOficina = new Set(arquivos);

  const commits: string[] = [];
  plano.forEach((passo, i) => {
    for (const a of doPasso[i]) {
      mkdirSync(dirname(join(publico, a)), { recursive: true });
      copyFileSync(join(oficina, a), join(publico, a));
    }
    for (const a of rastreados(publico)) if (!naOficina.has(a)) rmSync(join(publico, a));
    // -f: um arquivo que a oficina rastreia mesmo casando com o .gitignore também vai para o público.
    if (doPasso[i].length) git(publico, ["add", "-f", "--pathspec-from-file=-", "--pathspec-file-nul"], undefined, doPasso[i].join("\0"));
    git(publico, ["add", "-u"]);
    if (spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: publico }).status === 0) return;
    const { nome, email } = pessoas[i];
    const quem = { GIT_AUTHOR_NAME: nome, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: nome, GIT_COMMITTER_EMAIL: email };
    git(publico, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", passo.mensagem], quem);
    commits.push(git(publico, ["rev-parse", "HEAD"]).trim());
  });

  const diferencas = diferencasDeArvore(oficina, publico, arquivos);
  if (diferencas.length) {
    throw new Error(`a árvore do público ficou diferente da oficina (commits locais, não faça push):\n${diferencas.join("\n")}`);
  }
  return { commits };
}

function conferirAntes(arquivos: string[], publico: string, plano: PassoHistoria[], m: MapaKota): PessoaKota[] {
  const sem = arquivosSemPasso(arquivos, plano);
  if (sem.length) throw new Error(`arquivos da oficina sem passo no plano; nada foi commitado:\n${sem.join("\n")}`);
  const pessoas = plano.map((p) => m.pessoas.find((x) => x.id === p.autor));
  const fora = plano.filter((_, i) => !pessoas[i]).map((p) => p.autor);
  if (fora.length) throw new Error(`autores fora do mapa: ${fora.join(", ")}; nada foi commitado`);
  if (git(publico, ["status", "--porcelain"])) throw new Error(`${publico} tem alterações não commitadas; nada foi commitado`);
  return pessoas as PessoaKota[];
}

function rastreados(raiz: string): string[] {
  return git(raiz, ["ls-files", "-z"]).split("\0").filter(Boolean);
}

function diferencasDeArvore(oficina: string, publico: string, arquivos: string[]): string[] {
  const noPublico = new Set(rastreados(publico));
  const executavel = (caminho: string) => (statSync(caminho).mode & 0o111) !== 0;
  return [
    ...[...noPublico].filter((a) => !arquivos.includes(a)).map((a) => `${a}: só no público`),
    ...arquivos.filter((a) => !noPublico.has(a)).map((a) => `${a}: só na oficina`),
    ...arquivos.filter((a) => noPublico.has(a)).flatMap((a) => {
      const [o, p] = [join(oficina, a), join(publico, a)];
      if (!readFileSync(o).equals(readFileSync(p))) return [`${a}: conteúdo diferente`];
      return executavel(o) === executavel(p) ? [] : [`${a}: permissão de execução diferente`];
    }),
    ...git(publico, ["status", "--porcelain"]).split("\n").filter(Boolean).map((l) => `${l}: não commitado`),
  ];
}

function main() {
  const [oficina, publico] = process.argv.slice(2);
  if (!oficina || !publico) {
    console.error("uso: npm run kota:publicar -- <oficina> <publico>");
    process.exit(1);
  }
  try {
    const { commits } = publicarHistoria(resolve(oficina), resolve(publico), PLANO_HISTORIA, mapa);
    for (const c of commits) console.log(git(publico, ["log", "-1", "--format=%h %an <%ae> %s", c]).trim());
    console.log(`\n${commits.length} commit(s) novo(s) em ${publico}. Push só por fast-forward e com o OK do Joaquim.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
