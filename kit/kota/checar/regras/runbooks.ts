import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapaKota } from "../../tipos";
import { existe, nomes } from "../caminhos";
import type { Regra } from "../contexto";

const PASTA = "docs/runbooks";
const SECOES = ["## Quando usar", "## Antes de começar", "## Passos", "## Como saber que deu certo", "## Quem chamar"];
// Opções do docker compose que levam o valor na palavra seguinte, por subcomando ("" são as globais). As outras não
// levam: -v é --volumes no down e --volume no run, -t é --timestamps no logs e --timeout no stop.
const COM_VALOR: Record<string, string[]> = {
  "": ["-f", "--file", "-p", "--project-name", "--profile", "--env-file", "--project-directory"],
  exec: ["-e", "--env", "-u", "--user", "-w", "--workdir", "--index"],
  run: ["-e", "--env", "-u", "--user", "-w", "--workdir", "--entrypoint", "--name", "-v", "--volume", "-p", "--publish", "-l", "--label"],
  logs: ["-n", "--tail", "--since", "--until", "--index"],
  up: ["-t", "--timeout", "--scale", "--pull", "--exit-code-from", "--wait-timeout"],
  down: ["-t", "--timeout", "--rmi"],
  stop: ["-t", "--timeout"],
  restart: ["-t", "--timeout"],
  ps: ["--format", "--filter", "--status"],
};
// Nestes, a primeira palavra depois das opções é o serviço e o resto é o comando que roda nele.
const UM_SERVICO = new Set(["exec", "run"]);
const CAMINHO = /^(?:\.\/)?[\w.-]+(?:\/[\w.-]+)*\/?$/;
const ARQUIVO = /\.(?:ya?ml|sh|md|sql|json|java|py|xml)$/;
const CANAL = /(?<![\w#(/])#[a-z0-9][a-z0-9_-]*/g;

export const regraRunbooks: Regra = {
  nome: "runbooks",
  precisaRepo: true,
  checar(ctx) {
    const repo = ctx.repo!;
    const arquivos = nomes(join(repo, PASTA)).filter((f) => f.endsWith(".md")).sort();
    const servicos = existe(repo, "docker-compose.yml") ? servicosDoCompose(readFileSync(join(repo, "docker-compose.yml"), "utf8")) : undefined;
    return [
      ...(arquivos.length < 2 || arquivos.length > 3 ? [`${PASTA}/ precisa de 2 ou 3 runbooks e tem ${arquivos.length}`] : []),
      ...(servicos ? [] : ["docker-compose.yml não existe no repo; os comandos dos runbooks não rodam"]),
      ...arquivos.flatMap((f) =>
        checarRunbook(readFileSync(join(repo, PASTA, f), "utf8"), repo, servicos, ctx.mapa).map((e) => `${PASTA}/${f}: ${e}`)),
    ];
  },
};

function checarRunbook(md: string, repo: string, servicos: Set<string> | undefined, m: MapaKota): string[] {
  const linhas = md.split(/\r?\n/);
  const blocos = [...md.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((b) => b[1]);
  const crases = [...md.replace(/^```[\s\S]*?^```/gm, "").matchAll(/`([^`\n]+)`/g)].map((c) => c[1]);
  const citados = [...new Set([...blocos, ...crases].flatMap(servicosCitados))];
  const caminhos = [...new Set(crases.filter((c) => CAMINHO.test(c) && (c.includes("/") || ARQUIVO.test(c))))];
  return [
    ...SECOES.filter((s) => !linhas.includes(s)).map((s) => `falta a seção "${s}"`),
    ...(servicos ? citados.filter((s) => !servicos.has(s)).map((s) => `serviço "${s}" não existe no docker-compose.yml`) : []),
    ...caminhos.filter((c) => !existe(repo, c.replace(/^\.\//, "").replace(/\/$/, ""))).map((c) => `caminho ${c} não existe no repo`),
    ...quemChamar(secao(linhas, "## Quem chamar"), m),
  ];
}

function quemChamar(texto: string | undefined, m: MapaKota): string[] {
  if (texto === undefined) return [];
  const canais = [...new Set(texto.match(CANAL))];
  const deTime = new Set<string>(m.times.flatMap((t) => [t.canal, t.canalAjuda]));
  const ajuda = m.times.filter((t) => canais.includes(t.canalAjuda));
  return [
    ...canais.filter((c) => !deTime.has(c)).map((c) => `canal ${c} não é de nenhum time`),
    ...(ajuda.length ? [] : ['"Quem chamar" não cita o canal de ajuda de nenhum time']),
    ...ajuda.filter((t) => !texto.includes(t.nome)).map((t) => `"Quem chamar" cita ${t.canalAjuda} sem dizer o time (${t.nome})`),
  ];
}

function secao(linhas: string[], titulo: string): string | undefined {
  const i = linhas.indexOf(titulo);
  if (i < 0) return undefined;
  const fim = linhas.findIndex((l, k) => k > i && l.startsWith("## "));
  return linhas.slice(i + 1, fim < 0 ? undefined : fim).join("\n");
}

function servicosCitados(codigo: string): string[] {
  const unido = codigo.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "")).join("\n").replace(/\\\n/g, " ");
  return [...unido.matchAll(/\bdocker compose\s+([^;&|)\n]*)/g)].flatMap(([, resto]) => servicosDoComando(resto.trim().split(/\s+/)));
}

function servicosDoComando(palavras: string[]): string[] {
  let sub = "";
  const args: string[] = [];
  for (let i = 0; i < palavras.length && !/^\d*[<>]/.test(palavras[i]); i++) {
    const p = palavras[i];
    if (p.startsWith("-")) {
      if (COM_VALOR[sub]?.includes(p)) i++;
    } else if (!sub) sub = p;
    else {
      args.push(p);
      if (UM_SERVICO.has(sub)) break;
    }
  }
  return args;
}

// Sem biblioteca de YAML: bastam as chaves com o recuo da primeira dentro de "services:".
function servicosDoCompose(yml: string): Set<string> {
  const linhas = yml.split(/\r?\n/);
  const servicos = new Set<string>();
  let recuo: string | undefined;
  for (const l of linhas.slice(linhas.findIndex((x) => /^services:\s*(#.*)?$/.test(x)) + 1 || linhas.length)) {
    if (/^[^\s#]/.test(l)) break;
    const chave = /^(\s+)([\w.-]+):/.exec(l);
    if (!chave) continue;
    recuo ??= chave[1];
    if (chave[1] === recuo) servicos.add(chave[2]);
  }
  return servicos;
}
