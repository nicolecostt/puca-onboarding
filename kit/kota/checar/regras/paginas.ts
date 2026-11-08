import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARVORE } from "../../notion/arvore";
import { chavesCitadas } from "../../notion/links";
import type { ContextoKota, Regra } from "../contexto";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const HANDLE = /(?<![\p{L}\p{N}_.%+-])@[\p{L}\p{N}_-]+/gu;
const LINK_FIXO_NOTION = /(?:[\w-]+\.)*notion\.(?:so|site)\b[^\s<>()[\]"'`]*/gi;
const LINK_GITHUB = /github\.com\/([\w-]+)\/([\w-]+(?:\.[\w-]+)*)(?:\/(?:blob|tree)\/([^/\s)#?"'<>\]]+)\/?([^\s)#?"'<>\]]*))?/gi;
// Comece aqui é o guia de uso do jurado, escrito na C5. Página que agrupa subpáginas mostra a lista delas no Notion,
// e nenhum grupo da N3 escreve texto para ela.
const agrupam = new Set(ARVORE.map((n) => n.pai));
const ESCRITAS_NA_N3 = ARVORE.filter((n) => n.tipo !== "database" && !agrupam.has(n.chave) && n.chave !== "comece-aqui");

type Conferir = (arquivo: string, md: string, ctx: ContextoKota) => string[];

// Três regras para o check:kota mostrar à parte o que falta escrever, o que está errado no texto e o que só se
// confere com --repo.
export function criarRegrasPaginas(pasta: string): Regra[] {
  const arquivos = () => (existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith(".md")).sort() : []);
  const porPagina = (conferir: Conferir) => (ctx: ContextoKota) =>
    arquivos().flatMap((f) => conferir(`paginas/${f}`, readFileSync(join(pasta, f), "utf8"), ctx));
  return [
    {
      nome: "paginas-escritas",
      precisaRepo: false,
      checar() {
        const escritas = arquivos();
        return ESCRITAS_NA_N3.filter((n) => !escritas.includes(`${n.chave}.md`))
          .map((n) => `chave ${n.chave}: falta paginas/${n.chave}.md`);
      },
    },
    // TODO(#115): conferir acharMarca (R2) na pasta, num PR curto, quando kit/kota/marca chegar no main.
    { nome: "paginas", precisaRepo: false, checar: porPagina(conferirTexto) },
    { nome: "paginas-repo", precisaRepo: true, checar: porPagina(conferirLinksRepo) },
  ];
}

export const regrasPaginas = criarRegrasPaginas(fileURLToPath(new URL("../../notion/paginas", import.meta.url)));

function conferirTexto(arquivo: string, md: string, ctx: ContextoKota): string[] {
  const chaves = new Set(ARVORE.map((n) => n.chave));
  const emails = new Set<string>([...ctx.mapa.pessoas.map((p) => p.email), ...ctx.mapa.aliases]);
  return [
    ...chavesCitadas(md).filter((c) => !chaves.has(c)).map((c) => `${arquivo}: notion:${c} não existe na árvore`),
    ...[...md.matchAll(LINK_FIXO_NOTION)]
      .map(([l]) => `${arquivo}: link fixo do Notion ${l} quebra quando a página é recriada; escreva notion:<chave>`),
    ...[...md.matchAll(EMAIL)].map(([e]) => e).filter((e) => !emails.has(e))
      .map((e) => `${arquivo}: e-mail ${e} não é de pessoa do mapa nem alias`),
    ...[...md.matchAll(HANDLE)].map(([h]) => `${arquivo}: ${h} é @handle; cite a pessoa pelo nome ou pelo e-mail do mapa`),
    ...linksDoDono(md, ctx.mapa.repo).flatMap(({ repo, publico, ref }) =>
      !publico ? [`${arquivo}: link para github.com/${repo}, que não é o repo público ${ctx.mapa.repo}`]
      : ref !== undefined && ref !== "main" ? [`${arquivo}: link para a branch ${ref}; aponte para a main, que o check:kota confere`]
      : []),
  ];
}

function conferirLinksRepo(arquivo: string, md: string, ctx: ContextoKota): string[] {
  return linksDoDono(md, ctx.mapa.repo).filter((l) => l.publico && l.ref === "main").map((l) => l.caminho)
    .filter((c) => !existeNoRepo(ctx.repo!, c))
    .map((c) => `${arquivo}: link para ${c}, que não existe no repo`);
}

interface LinkGithub { repo: string; publico: boolean; ref?: string; caminho: string }

// O GitHub não diferencia maiúsculas no dono e no nome do repo, só no caminho.
function linksDoDono(md: string, publico: string): LinkGithub[] {
  const [dono, nome] = publico.toLowerCase().split("/");
  return [...md.matchAll(LINK_GITHUB)]
    .filter(([, d]) => d.toLowerCase() === dono)
    .map(([, d, n, ref, caminho]) => ({ repo: `${d}/${n}`, publico: n.toLowerCase() === nome, ref, caminho: caminho ?? "" }));
}

// O GitHub diferencia maiúsculas no caminho; o disco padrão do macOS, não, e existsSync aceitaria src/Ledger.
function existeNoRepo(repo: string, caminho: string): boolean {
  const partes = caminho.split("/").filter(Boolean);
  return partes.every((parte, i) => {
    const pasta = join(repo, ...partes.slice(0, i));
    return statSync(pasta, { throwIfNoEntry: false })?.isDirectory() === true && readdirSync(pasta).includes(parte);
  });
}
