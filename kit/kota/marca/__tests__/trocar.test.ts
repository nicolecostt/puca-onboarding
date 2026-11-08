import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copiaGit } from "../../__tests__/repo-git";
import { avisoDeModificacao, trocarMarca } from "../trocar";

const FIXTURE = fileURLToPath(new URL("./fixture", import.meta.url));
const AVISO = "Modificado pela Kota a partir do original (Apache-2.0).";
const JAVA = "src/ledger/balancereader/src/main/java/br/com/kota/balancereader/BalanceReaderApplication.java";
const PNG = "src/frontend/static/img/favicon.png";
const RENOMEADOS: [string, string][] = [
  ["src/frontend/static/img/cymbal.svg", "src/frontend/static/img/kota.svg"],
  ["src/frontend/static/styles/cymbal.css", "src/frontend/static/styles/kota.css"],
  ["src/ledger/balancereader/src/main/java/anthos/samples/bankofanthos/balancereader/BalanceReaderApplication.java", JAVA],
];

const ler = (raiz: string, caminho: string) => readFileSync(join(raiz, caminho), "utf8");
const arquivos = (raiz: string) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((c) => !c.startsWith(".git") && statSync(join(raiz, c)).isFile())
    .sort();
const conteudos = (raiz: string) => new Map(arquivos(raiz).map((c) => [c, ler(raiz, c)]));

function trocada(): string {
  const raiz = copiaGit(FIXTURE);
  trocarMarca(raiz);
  return raiz;
}

it("renomeia o pacote Java e move a pasta", () => {
  const d = trocada();
  expect(ler(d, JAVA)).toContain("package br.com.kota.balancereader;");
  expect(existsSync(join(d, "src/ledger/balancereader/src/main/java/anthos"))).toBe(false);
});

it("troca a marca nos textos", () => {
  const d = trocada();
  const head = ler(d, "src/frontend/templates/shared/html_head.html");
  expect(head).toContain("<title>Kota</title>");
  expect(head).toContain('<link rel="stylesheet" href="static/styles/kota.css">');
  expect(head).not.toContain("CymbalBank");
  expect(ler(d, "src/frontend/frontend.py")).toContain('BANK_NAME = os.getenv("BANK_NAME", "Kota")');
  expect(ler(d, "src/frontend/pyproject.toml")).toContain('name = "kota-bank-frontend"');
  expect(ler(d, "src/frontend/static/styles/kota.css")).toContain(".kota-logo {");
  expect(ler(d, "src/ledger/transactionhistory/pom.xml")).toContain(
    "<mainClass>br.com.kota.transactionhistory.TransactionHistoryApplication</mainClass>",
  );
});

it("relatório traz os arquivos alterados e os renomeados", () => {
  const r = trocarMarca(copiaGit(FIXTURE));
  expect([...r.alterados].sort()).toEqual([
    "src/accounts/accounts-db/initdb/1-load-testdata.sh",
    "src/frontend/frontend.py",
    "src/frontend/pyproject.toml",
    "src/frontend/static/styles/kota.css",
    "src/frontend/templates/shared/html_head.html",
    "src/ledger/balancereader/pom.xml",
    JAVA,
    "src/ledger/ledger-db/initdb/0_init_tables.sql",
    "src/ledger/transactionhistory/pom.xml",
  ]);
  expect([...r.renomeados].sort()).toEqual(RENOMEADOS);
});

it("mantém LICENSE, a linha de copyright e a seção de origem do README", () => {
  const d = trocada();
  expect(readFileSync(join(d, "LICENSE"))).toEqual(readFileSync(join(FIXTURE, "LICENSE")));
  expect(ler(d, "src/frontend/frontend.py").split("\n")[0]).toBe("# Copyright 2021 Google LLC (Bank of Anthos)");
  expect(ler(d, "README.md")).toContain("Baseado no Bank of Anthos v0.6.11, da Google, sob a licença Apache-2.0.");
});

it("põe o aviso uma vez, depois da licença, no comentário certo", () => {
  const d = trocada();
  const casos: [arquivo: string, linhaAntes: string, aviso: string][] = [
    [JAVA, " */", `// ${AVISO}`],
    ["src/frontend/frontend.py", "# limitations under the License.", `# ${AVISO}`],
    ["src/frontend/pyproject.toml", "# limitations under the License.", `# ${AVISO}`],
    ["src/frontend/templates/shared/html_head.html", "-->", `<!-- ${AVISO} -->`],
    ["src/frontend/static/styles/kota.css", " */", `/* ${AVISO} */`],
    ["src/ledger/balancereader/pom.xml", "-->", `<!-- ${AVISO} -->`],
    ["src/ledger/ledger-db/initdb/0_init_tables.sql", " */", `-- ${AVISO}`],
    ["src/accounts/accounts-db/initdb/1-load-testdata.sh", "#!/bin/bash", `# ${AVISO}`],
  ];
  for (const [arquivo, antes, aviso] of casos) {
    const linhas = ler(d, arquivo).split("\n");
    expect(linhas.filter((l) => l.includes(AVISO)), arquivo).toEqual([aviso]);
    expect(linhas[linhas.indexOf(aviso) - 1], arquivo).toBe(antes);
  }
  expect(ler(d, "src/ledger/balancereader/pom.xml").split("\n")[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
});

it("reconhece o aviso que a R1 já pôs no pom.xml do transactionhistory e não duplica", () => {
  const linhas = ler(trocada(), "src/ledger/transactionhistory/pom.xml").split("\n");
  expect(linhas.filter((l) => l.includes(AVISO))).toEqual([`<!-- ${AVISO} -->`]);
});

it("não põe aviso em arquivo que não mudou", () => {
  const d = trocada();
  for (const [antes, depois] of [
    ["src/accounts/userservice/userservice.py", "src/accounts/userservice/userservice.py"],
    ["src/frontend/README.md", "src/frontend/README.md"],
    ["docs/adr/0001-x.md", "docs/adr/0001-x.md"],
    ["README.md", "README.md"],
    ["src/frontend/static/img/cymbal.svg", "src/frontend/static/img/kota.svg"],
  ])
    expect(ler(d, depois), depois).toBe(ler(FIXTURE, antes));
});

it("não apaga nada", () => {
  const novo = new Map(RENOMEADOS);
  expect(arquivos(trocada())).toEqual(arquivos(FIXTURE).map((c) => novo.get(c) ?? c).sort());
});

it("não toca binário", () => {
  expect(readFileSync(join(trocada(), PNG))).toEqual(readFileSync(join(FIXTURE, PNG)));
});

it("não toca o que o git ignora", () => {
  const d = copiaGit(FIXTURE);
  writeFileSync(join(d, ".gitignore"), "target/\n");
  mkdirSync(join(d, "src/ledger/balancereader/target"));
  writeFileSync(join(d, "src/ledger/balancereader/target/application.properties"), "nome=bankofanthos\n");
  trocarMarca(d);
  expect(ler(d, "src/ledger/balancereader/target/application.properties")).toBe("nome=bankofanthos\n");
});

it("não sobrescreve arquivo que já tem o nome novo", () => {
  const d = copiaGit(FIXTURE);
  writeFileSync(join(d, "src/frontend/static/img/kota.svg"), "logo da Kota");
  expect(() => trocarMarca(d)).toThrow();
  expect(ler(d, "src/frontend/static/img/kota.svg")).toBe("logo da Kota");
});

it("rodar duas vezes não muda nada", () => {
  const d = trocada();
  const depois = conteudos(d);
  expect(trocarMarca(d)).toEqual({ alterados: [], renomeados: [] });
  expect(conteudos(d)).toEqual(depois);
});

it.each([
  ["src/frontend/frontend.py", `# ${AVISO}`],
  ["src/frontend/Dockerfile", `# ${AVISO}`],
  ["scripts/testar.sh", `# ${AVISO}`],
  ["docker-compose.yaml", `# ${AVISO}`],
  ["ci.yml", `# ${AVISO}`],
  ["pyproject.toml", `# ${AVISO}`],
  ["application.properties", `# ${AVISO}`],
  ["setup.cfg", `# ${AVISO}`],
  ["X.java", `// ${AVISO}`],
  ["index.js", `// ${AVISO}`],
  ["kota.css", `/* ${AVISO} */`],
  ["index.html", `<!-- ${AVISO} -->`],
  ["pom.xml", `<!-- ${AVISO} -->`],
  ["README.md", `<!-- ${AVISO} -->`],
  ["kota.svg", `<!-- ${AVISO} -->`],
  ["0-schema.sql", `-- ${AVISO}`],
  ["package.json", null],
  ["uv.lock", null],
  ["requirements.txt", null],
  [".gitignore", null],
])("aviso de modificação de %s", (caminho, esperado) => expect(avisoDeModificacao(caminho)).toBe(esperado));

describe("CLI", () => {
  const rodar = (...args: string[]) =>
    spawnSync("node_modules/.bin/tsx", ["kit/kota/marca/cli.ts", ...args], {
      cwd: fileURLToPath(new URL("../../../..", import.meta.url)),
      encoding: "utf8",
    });

  it("aplica a troca e lista o que sobrou para resolver à mão", () => {
    const d = copiaGit(FIXTURE);
    const r = rodar(d);
    expect(r.status).toBe(0);
    expect(ler(d, JAVA)).toContain("package br.com.kota.balancereader;");
    expect(r.stdout).toContain("src/frontend/README.md:3: Usa o Anthos Service Mesh para o tráfego entre os serviços.");
  });

  it("sem raiz, falha e diz como usar", () => {
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/kota:marca -- <raiz do repo>/);
  });

  it("fora da raiz de um repo git, falha sem mexer em nada", () => {
    const d = mkdtempSync(join(tmpdir(), "kota-sem-git-"));
    writeFileSync(join(d, "x.md"), "Bank of Anthos\n");
    const r = rodar(d);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/não é a raiz de um repo git/);
    expect(ler(d, "x.md")).toBe("Bank of Anthos\n");
  });
});
