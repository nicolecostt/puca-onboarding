import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARVORE } from "../../notion/arvore";
import { chavesCitadas } from "../../notion/links";
import type { ContextoKota, Regra } from "../contexto";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const HANDLE = /(?<![\p{L}\p{N}_.%+-])@[\p{L}\p{N}_-]+/gu;
// Comece aqui é o guia de uso do jurado, escrito na C5.
const SEM_PAGINA_NESTA_RAIA = new Set(["comece-aqui"]);

export const criarRegraPaginas = (pasta: string): Regra => ({
  nome: "paginas",
  precisaRepo: false,
  checar(ctx) {
    const arquivos = existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith(".md")).sort() : [];
    const faltam = ARVORE
      .filter((n) => n.tipo !== "database" && !SEM_PAGINA_NESTA_RAIA.has(n.chave) && !arquivos.includes(`${n.chave}.md`))
      .map((n) => `chave ${n.chave}: falta paginas/${n.chave}.md`);
    return [...faltam, ...arquivos.flatMap((f) => conferir(`paginas/${f}`, readFileSync(join(pasta, f), "utf8"), ctx))];
  },
});

export const regraPaginas = criarRegraPaginas(fileURLToPath(new URL("../../notion/paginas", import.meta.url)));

function conferir(arquivo: string, md: string, ctx: ContextoKota): string[] {
  const chaves = new Set(ARVORE.map((n) => n.chave));
  const emails = new Set<string>([...ctx.mapa.pessoas.map((p) => p.email), ...ctx.mapa.aliases]);
  const links = new RegExp(`github\\.com/${ctx.mapa.repo}/(?:blob|tree)/main/([^\\s)#?"'>\\]]*)`, "g");
  return [
    ...chavesCitadas(md).filter((c) => !chaves.has(c)).map((c) => `${arquivo}: notion:${c} não existe na árvore`),
    ...[...md.matchAll(EMAIL)].map(([e]) => e).filter((e) => !emails.has(e))
      .map((e) => `${arquivo}: e-mail ${e} não é de pessoa do mapa nem alias`),
    ...[...md.matchAll(HANDLE)].map(([h]) => `${arquivo}: ${h} é @handle; cite a pessoa pelo nome ou pelo e-mail do mapa`),
    ...(ctx.repo
      ? [...md.matchAll(links)].map(([, c]) => c).filter((c) => !existeNoRepo(ctx.repo!, c))
        .map((c) => `${arquivo}: link para ${c}, que não existe no repo`)
      : []),
  ];
}

// O GitHub diferencia maiúsculas no caminho; o disco padrão do macOS, não, e existsSync aceitaria src/Ledger.
function existeNoRepo(repo: string, caminho: string): boolean {
  const partes = caminho.split("/").filter(Boolean);
  return partes.every((parte, i) => {
    const pasta = join(repo, ...partes.slice(0, i));
    return statSync(pasta, { throwIfNoEntry: false })?.isDirectory() === true && readdirSync(pasta).includes(parte);
  });
}
