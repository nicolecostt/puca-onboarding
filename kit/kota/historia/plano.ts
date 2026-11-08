import { mapa } from "../mapa";
import { caminhoAdr } from "../tipos";

// autor = id de PessoaKota. caminhos = globs; uma pasta cobre tudo dentro dela e "!glob" tira arquivos do passo.
export interface PassoHistoria { autor: string; mensagem: string; caminhos: string[] }

const SEM_README = "!**/README.md";

const adrsPorTime = mapa.times
  .map((t) => ({ t, adrs: mapa.adrs.filter((a) => a.time === t.id) }))
  .filter(({ adrs }) => adrs.length)
  .map(({ t, adrs }): PassoHistoria => ({
    autor: t.techLead,
    mensagem: `docs(${t.id}): ${adrs.length > 1 ? "adrs" : "adr"} ${juntar(adrs.map((a) => String(a.n)))} do time ${t.nome}`,
    caminhos: adrs.map(caminhoAdr),
  }));

// Ordem do ADR 1: o monolito do livro-razão entra antes dos três serviços que saíram dele.
export const PLANO_HISTORIA: PassoHistoria[] = [
  { autor: "vinicius", mensagem: "chore(plataforma): base do repositório com o build em maven", caminhos: ["LICENSE", "NOTICE", "pom.xml", "mvnw", "mvnw.cmd", ".mvn", ".gitignore", ".dockerignore", ".pylintrc"] },
  { autor: "nadia", mensagem: "feat(plataforma): um banco postgres para contas e outro para o livro-razão", caminhos: ["src/accounts/accounts-db", "src/ledger/ledger-db", SEM_README] },
  { autor: "rodrigo", mensagem: "feat(contas): userservice com cadastro, login e jwt", caminhos: ["src/accounts/userservice", SEM_README] },
  { autor: "raissa", mensagem: "feat(contas): contatos para transferência no contacts", caminhos: ["src/accounts/contacts", "src/accounts/components", SEM_README] },
  { autor: "beatriz", mensagem: "feat(livro-razao): livro-razão em um monolito java", caminhos: ["src/ledgermonolith", SEM_README] },
  { autor: "gustavo", mensagem: "feat(livro-razao): ledgerwriter separado do monolito", caminhos: ["src/ledger/ledgerwriter", SEM_README] },
  { autor: "beatriz", mensagem: "feat(livro-razao): balancereader com saldo em cache", caminhos: ["src/ledger/balancereader", SEM_README] },
  { autor: "thiago", mensagem: "feat(livro-razao): transactionhistory com extrato em cache", caminhos: ["src/ledger/transactionhistory", "src/ledger/components", SEM_README] },
  { autor: "larissa", mensagem: "feat(canais): frontend com login, saldo e transferências", caminhos: ["src/frontend", SEM_README] },
  { autor: "igor", mensagem: "feat(canais): loadgenerator para simular clientes", caminhos: ["src/loadgenerator", SEM_README] },
  { autor: "vinicius", mensagem: "feat(plataforma): ambiente local com docker compose e scripts de teste", caminhos: ["docker-compose.yml", "scripts"] },
  { autor: "nadia", mensagem: "ci(plataforma): testes de todos os serviços em cada pr", caminhos: [".github/workflows"] },
  ...adrsPorTime,
  { autor: "vinicius", mensagem: "docs(plataforma): runbooks de operação", caminhos: ["docs/runbooks"] },
  { autor: "nadia", mensagem: "docs(plataforma): readme da kota e de cada serviço", caminhos: ["**/README.md"] },
  { autor: "eduardo", mensagem: "chore(plataforma): codeowners por time", caminhos: [".github/CODEOWNERS"] },
];

export function arquivosSemPasso(arquivos: string[], plano: PassoHistoria[]): string[] {
  return arquivos.filter((a) => passoDoArquivo(a, plano) < 0);
}

// Cada arquivo é do primeiro passo que o cobre.
export function passoDoArquivo(arquivo: string, plano: PassoHistoria[]): number {
  return plano.findIndex(({ caminhos }) =>
    caminhos.some((g) => !g.startsWith("!") && casa(g, arquivo)) &&
    !caminhos.some((g) => g.startsWith("!") && casa(g.slice(1), arquivo)));
}

function casa(glob: string, arquivo: string): boolean {
  const corpo = glob
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((p) => CURINGAS[p] ?? p.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
    .join("");
  return new RegExp(`^${corpo}(?:/.*)?$`).test(arquivo);
}

const CURINGAS: Record<string, string> = { "**/": "(?:.*/)?", "**": ".*", "*": "[^/]*", "?": "[^/]" };

function juntar(itens: string[]): string {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : itens[0];
}
