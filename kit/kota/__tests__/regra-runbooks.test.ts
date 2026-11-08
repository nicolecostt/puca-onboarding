import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import type { ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraRunbooks } from "../checar/regras/runbooks";
import { mapa } from "../mapa";

const COMPOSE = `name: kota

x-servico: &servico
  PORT: "8080"

services:
  # Gera o par de chaves do JWT na primeira subida.
  jwt-chaves:
    image: alpine:3.20
    volumes:
      - chaves:/chaves
  accounts-db:
    build: src/accounts/accounts-db
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
  ledger-db:
    build: src/ledger/ledger-db
  userservice:
    build: src/accounts/userservice
    environment:
      <<: [*servico]
  contacts:
    build: src/accounts/contacts
  frontend:
    build: src/frontend
  loadgenerator:
    build: src/loadgenerator
    profiles: ["carga"]

volumes:
  chaves:
  ledger-db-dados:
`;

const SUBIR = `# Subir o banco do zero

## Quando usar

Quando o banco local ficou num estado estranho e você quer recomeçar com os dados de demo.

## Antes de começar

Isto apaga os volumes do \`docker-compose.yml\`, inclusive \`chaves:/chaves\`: as contas criadas à mão somem.

## Passos

\`\`\`bash
docker compose down -v
docker compose up -d --build  # constrói cada serviço do código
\`\`\`

## Como saber que deu certo

\`scripts/verificar-local.sh\` termina sem erro e o login com \`cliente.demo\` funciona.

## Quem chamar

Plataforma, em #plataforma-ajuda.
`;

const JWT = `# Trocar a chave do JWT

## Quando usar

Quando a chave privada do JWT pode ter vazado.

## Antes de começar

O \`jwt-chaves\` grava o par em \`/tmp/.ssh\` dos serviços. Quem estiver logado cai e entra de novo.

## Passos

\`\`\`bash
# O jwt-chaves só gera um par novo quando o volume está vazio.
docker compose run --rm --entrypoint sh jwt-chaves -c 'rm -f /chaves/privatekey /chaves/publickey'
docker compose up -d --force-recreate \\
  jwt-chaves userservice contacts frontend
\`\`\`

## Como saber que deu certo

O login volta a funcionar.

## Quem chamar

Contas, em #contas-ajuda.
`;

const LEDGER = `# ledger-db cheio

## Quando usar

Quando o \`ledger-db\` reclama de disco.

## Antes de começar

Pare o gerador de carga para o banco parar de crescer.

## Passos

\`\`\`bash
docker compose --profile carga stop loadgenerator
docker compose exec -T ledger-db psql -U admin -d postgresdb -c "select pg_size_pretty(pg_database_size('postgresdb'));"
docker compose logs --tail 50 ledger-db 2>&1 | tail
\`\`\`

## Como saber que deu certo

O tamanho do banco para de subir.

## Quem chamar

Livro-razão, em #livro-razao-ajuda; se o disco da máquina acabou, Plataforma, em #plataforma-ajuda.
`;

const RUNBOOKS: Record<string, string> = { "subir-do-zero.md": SUBIR, "trocar-chave-jwt.md": JWT, "ledger-db-cheio.md": LEDGER };

function repoKota(troca: Record<string, string> = {}): string {
  const repo = mkdtempSync(join(tmpdir(), "kota-runbooks-"));
  writeFileSync(join(repo, "docker-compose.yml"), COMPOSE);
  mkdirSync(join(repo, "scripts"));
  writeFileSync(join(repo, "scripts/verificar-local.sh"), "");
  mkdirSync(join(repo, "docs/runbooks"), { recursive: true });
  for (const [f, texto] of Object.entries({ ...RUNBOOKS, ...troca })) writeFileSync(join(repo, "docs/runbooks", f), texto);
  return repo;
}

const checar = (repo: string) => regraRunbooks.checar({ mapa, repo, notionUrls: {}, jornadas: [] } satisfies ContextoKota);

it("aceita runbooks com as seções, serviços do compose, caminhos do repo e canal de ajuda", () =>
  expect(checar(repoKota())).toEqual([]));

it("roda no check:kota só com --repo", () =>
  expect(checarKota({ mapa, notionUrls: {}, jornadas: [] }, regras).pulas).toContain("runbooks: sem --repo"));

describe("serviços do docker compose", () => {
  it("acusa serviço que não existe no compose", () => {
    const repo = repoKota({ "trocar-chave-jwt.md": JWT.replace("--entrypoint sh jwt-chaves", "--entrypoint sh jwt") });
    expect(checar(repo)).toEqual(['docs/runbooks/trocar-chave-jwt.md: serviço "jwt" não existe no docker-compose.yml']);
  });

  it("acusa serviço depois de opção com valor e na linha continuada", () => {
    const repo = repoKota({
      "trocar-chave-jwt.md": JWT.replace("  jwt-chaves userservice contacts frontend", "  jwt-chaves userservice contact frontend"),
      "ledger-db-cheio.md": LEDGER.replace("stop loadgenerator", "stop loadgen").replace("--tail 50 ledger-db", "--tail 50 ledgerdb"),
    });
    expect(checar(repo)).toEqual([
      'docs/runbooks/ledger-db-cheio.md: serviço "loadgen" não existe no docker-compose.yml',
      'docs/runbooks/ledger-db-cheio.md: serviço "ledgerdb" não existe no docker-compose.yml',
      'docs/runbooks/trocar-chave-jwt.md: serviço "contact" não existe no docker-compose.yml',
    ]);
  });

  it("não toma volume nem chave aninhada do compose por serviço", () => {
    const repo = repoKota({ "subir-do-zero.md": SUBIR.replace("docker compose up -d --build", "docker compose up -d chaves healthcheck") });
    expect(checar(repo)).toEqual([
      'docs/runbooks/subir-do-zero.md: serviço "chaves" não existe no docker-compose.yml',
      'docs/runbooks/subir-do-zero.md: serviço "healthcheck" não existe no docker-compose.yml',
    ]);
  });

  it("acusa serviço errado em comando entre crases no texto", () => {
    const repo = repoKota({ "ledger-db-cheio.md": LEDGER.replace("O tamanho do banco", "Rode `docker compose logs ledger` e o tamanho do banco") });
    expect(checar(repo)).toEqual(['docs/runbooks/ledger-db-cheio.md: serviço "ledger" não existe no docker-compose.yml']);
  });

  it("sem docker-compose.yml, diz isso uma vez em vez de acusar cada serviço", () => {
    const repo = repoKota();
    rmSync(join(repo, "docker-compose.yml"));
    expect(checar(repo)).toEqual(["docker-compose.yml não existe no repo; os comandos dos runbooks não rodam", "docs/runbooks/subir-do-zero.md: caminho docker-compose.yml não existe no repo"]);
  });
});

describe("caminhos entre crases", () => {
  it("acusa caminho que não existe no repo, inclusive com outra caixa", () => {
    const repo = repoKota({ "subir-do-zero.md": SUBIR.replace("`scripts/verificar-local.sh`", "`scripts/verificar.sh` ou `Scripts/verificar-local.sh`") });
    expect(checar(repo)).toEqual([
      "docs/runbooks/subir-do-zero.md: caminho scripts/verificar.sh não existe no repo",
      "docs/runbooks/subir-do-zero.md: caminho Scripts/verificar-local.sh não existe no repo",
    ]);
  });
});

describe("seções", () => {
  it("acusa seção faltando", () => {
    const repo = repoKota({ "subir-do-zero.md": SUBIR.replace("## Como saber que deu certo", "## Conferir") });
    expect(checar(repo)).toEqual(['docs/runbooks/subir-do-zero.md: falta a seção "## Como saber que deu certo"']);
  });

  it("acusa pasta com menos de 2 ou mais de 3 runbooks", () => {
    const repo = repoKota({ "reiniciar-o-site.md": SUBIR });
    expect(checar(repo)).toEqual(["docs/runbooks/ precisa de 2 ou 3 runbooks e tem 4"]);
    rmSync(join(repo, "docs/runbooks/reiniciar-o-site.md"));
    rmSync(join(repo, "docs/runbooks/subir-do-zero.md"));
    rmSync(join(repo, "docs/runbooks/ledger-db-cheio.md"));
    expect(checar(repo)).toEqual(["docs/runbooks/ precisa de 2 ou 3 runbooks e tem 1"]);
    rmSync(join(repo, "docs/runbooks"), { recursive: true });
    expect(checar(repo)).toEqual(["docs/runbooks/ precisa de 2 ou 3 runbooks e tem 0"]);
  });
});

describe("quem chamar", () => {
  it("acusa canal que não é de nenhum time", () => {
    const repo = repoKota({ "trocar-chave-jwt.md": JWT.replace("Contas, em #contas-ajuda.", "Contas, em #contas-ajuda ou #seguranca.") });
    expect(checar(repo)).toEqual(["docs/runbooks/trocar-chave-jwt.md: canal #seguranca não é de nenhum time"]);
  });

  it("acusa quem chamar sem canal de ajuda de time", () => {
    const repo = repoKota({ "trocar-chave-jwt.md": JWT.replace("Contas, em #contas-ajuda.", "Contas, em #contas.") });
    expect(checar(repo)).toEqual(['docs/runbooks/trocar-chave-jwt.md: "Quem chamar" não cita o canal de ajuda de nenhum time']);
  });

  it("acusa canal de ajuda sem o nome do time dele", () => {
    const repo = repoKota({ "trocar-chave-jwt.md": JWT.replace("Contas, em #contas-ajuda.", "Plataforma, em #contas-ajuda.") });
    expect(checar(repo)).toEqual(['docs/runbooks/trocar-chave-jwt.md: "Quem chamar" cita #contas-ajuda sem dizer o time (Contas)']);
  });
});
