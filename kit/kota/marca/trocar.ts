import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { arquivosDoRepo, lerTexto } from "../repo";
import { linhasDaOrigem } from "./origem";

export interface RelatorioMarca { alterados: string[]; renomeados: [string, string][] }

const AVISO = "Modificado pela Kota a partir do original (Apache-2.0).";

// A ordem importa: o pacote Java antes de bankofanthos, as formas com maiúscula antes da minúscula.
const SUBSTITUICOES: [string, string][] = [
  ["anthos.samples.bankofanthos", "br.com.kota"],
  ["CymbalBank", "Kota"],
  ["Bank of Anthos", "Kota"],
  ["BankOfAnthos", "Kota"],
  ["bank-of-anthos", "kota-bank"],
  ["bankofanthos", "kota"],
  ["CYMBAL", "KOTA"],
  ["Cymbal", "Kota"],
  ["cymbal", "kota"],
];

const RENOMEACOES: [RegExp, string][] = [
  [/(^|\/)java\/anthos\/samples\/bankofanthos\//, "$1java/br/com/kota/"],
  [/(^|\/)cymbal\.(svg|css)$/, "$1kota.$2"],
];

const COMENTARIOS: [chaves: string[], comentar: (texto: string) => string][] = [
  [[".py", ".sh", ".yaml", ".yml", ".toml", ".properties", ".cfg", "Dockerfile"], (t) => `# ${t}`],
  [[".java", ".js"], (t) => `// ${t}`],
  [[".css"], (t) => `/* ${t} */`],
  [[".html", ".xml", ".md", ".svg"], (t) => `<!-- ${t} -->`],
  [[".sql"], (t) => `-- ${t}`],
];

export function avisoDeModificacao(caminho: string): string | null {
  const nome = basename(caminho);
  const chave = nome === "Dockerfile" ? nome : extname(nome);
  const comentario = COMENTARIOS.find(([chaves]) => chaves.includes(chave));
  return comentario ? comentario[1](AVISO) : null;
}

export function trocarMarca(raiz: string): RelatorioMarca {
  const relatorio: RelatorioMarca = { alterados: [], renomeados: [] };
  for (const antigo of arquivosDoRepo(raiz)) {
    const caminho = RENOMEACOES.reduce((c, [de, para]) => c.replace(de, para), antigo);
    if (caminho !== antigo) {
      mover(raiz, antigo, caminho);
      relatorio.renomeados.push([antigo, caminho]);
    }
    const texto = lerTexto(raiz, caminho);
    if (texto === undefined) continue;
    const trocado = trocarTexto(caminho, texto);
    if (trocado === texto) continue;
    writeFileSync(join(raiz, caminho), trocado);
    relatorio.alterados.push(caminho);
  }
  return relatorio;
}

function mover(raiz: string, de: string, para: string) {
  if (existsSync(join(raiz, para))) throw new Error(`${para} já existe; ${de} não foi movido`);
  mkdirSync(dirname(join(raiz, para)), { recursive: true });
  renameSync(join(raiz, de), join(raiz, para));
  for (let pasta = dirname(de); pasta !== "." && readdirSync(join(raiz, pasta)).length === 0; pasta = dirname(pasta))
    rmdirSync(join(raiz, pasta));
}

function trocarTexto(caminho: string, texto: string): string {
  const linhas = texto.split("\n");
  const origem = linhasDaOrigem(caminho, linhas);
  const trocado = linhas
    .map((l, i) => (origem.has(i) ? l : SUBSTITUICOES.reduce((s, [de, para]) => s.replaceAll(de, para), l)))
    .join("\n");
  const aviso = avisoDeModificacao(caminho);
  if (trocado === texto || !aviso || texto.includes(AVISO)) return trocado;
  return comAviso(trocado, aviso);
}

function comAviso(texto: string, aviso: string): string {
  const linhas = texto.split("\n");
  // Shebang e prólogo XML só valem na primeira linha.
  const inicio = /^(#!|<\?xml)/.test(linhas[0]) ? 1 : 0;
  const fim = fimDaLicenca(linhas, inicio);
  linhas.splice(fim === undefined ? inicio : fim + 1, 0, aviso);
  return linhas.join("\n");
}

// A licença do topo é o primeiro comentário do arquivo, quando ele traz o fecho do cabeçalho Apache.
function fimDaLicenca(linhas: string[], inicio: number): number | undefined {
  let abre = inicio;
  while (abre < linhas.length && linhas[abre].trim() === "") abre++;
  const primeira = linhas[abre]?.trimStart() ?? "";
  if (!/^(\/\*|<!--|#|\/\/|--)/.test(primeira)) return undefined;
  const fecho = linhas.findIndex((l, i) => i >= abre && i <= abre + 20 && l.includes("limitations under the License"));
  if (fecho < 0) return undefined;
  const fim = primeira.startsWith("/*") ? "*/" : primeira.startsWith("<!--") ? "-->" : undefined;
  if (!fim) return fecho;
  const j = linhas.findIndex((l, i) => i >= fecho && l.includes(fim));
  return j < 0 ? undefined : j;
}
