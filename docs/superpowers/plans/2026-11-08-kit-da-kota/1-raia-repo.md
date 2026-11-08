# Raia repo: o banco da Kota sobe e não tem a marca de origem

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** na oficina, o banco sobe com `docker compose up` construindo do código, os testes rodam só com Docker, não sobra marca de origem e o README da raiz explica tudo. Issues #111 (parte do código) e #112.

**Arquitetura:** primeiro o `compose` com o código cru (linha de base), depois a troca de marca por script, com o mesmo teste de fumaça provando que nada quebrou. O script de troca de marca e o detector de marca moram no `puca-onboarding` (`kit/kota/marca/`), porque não fazem parte da empresa fictícia. Os scripts de subir e testar moram no próprio Kota, porque são ferramentas do time de Plataforma.

**Stack:** Docker Compose, Maven (`./mvnw`, Java 17, Spring Boot 3.5), Python com `uv`, Postgres, bash, TypeScript com `tsx` e `vitest`.

**Spec:** `docs/kit-da-kota.md` §2, §3.1, §8. Índice: [`README.md`](README.md). Depende do alicerce: `MapaKota` e `mapa` (`kit/kota/tipos.ts`, `kit/kota/mapa.ts`), `Regra` e `ContextoKota` (`kit/kota/checar/contexto.ts`), oficina em `../kota-bank-oficina`.

## Restrições globais

- `docker compose up` constrói e sobe tudo num Mac com Apple Silicon e num Linux amd64, só com Docker instalado.
- Nunca usar as imagens publicadas `us-central1-docker.pkg.dev/bank-of-anthos-ci/...` (só amd64).
- Nenhuma chave commitada. O par de chaves do JWT é gerado no setup.
- `LICENSE` e cabeçalhos `Copyright ... Google LLC` ficam. Arquivo modificado recebe aviso de modificação (Apache-2.0 §4(b)). Se aparecer um `NOTICE` no upstream, ele fica.
- O site mostra "Kota" (`BANK_NAME=Kota`) e o logo da Kota.
- E-mails e dados de cliente sintéticos; e-mail só `@kota.example`.
- Commits no `puca-onboarding` no formato `tipo(escopo): mensagem`, sem coautoria. PRs da oficina: um por tarefa.

## Foco de revisão

1. **Porta 8080 ocupada na máquina do jurado.** Esperado: `KOTA_PORTA` muda a porta. Teste em R1 (Step 6).
2. **Subir de novo depois de parar.** Esperado: a chave do JWT não muda e o login continua funcionando. Teste em R1 (Step 6).
3. **Docker Desktop com a memória padrão.** Três JVMs, dois Postgres e quatro serviços Python. Esperado: cabe com folga. Medido em R1 (Step 7).
4. **Rodar a troca de marca duas vezes.** Esperado: nenhuma mudança na segunda vez, aviso de modificação sem duplicar. Teste em R2.
5. **Lock do Python desalinhado depois de renomear o projeto.** Esperado: `uv sync --frozen` do Dockerfile passa. Conferido em R2 (Step 7) pelo build.

---

### Task R1: compose a partir do código cru (roda junto com o alicerce)

**Files (na oficina):**
- Create: `docker-compose.yml`
- Create: `src/ledger/ledgerwriter/Dockerfile`, `src/ledger/balancereader/Dockerfile`, `src/ledger/transactionhistory/Dockerfile`
- Create: `scripts/verificar-local.sh`, `scripts/testar.sh`

**Interfaces:**
- Produces: `scripts/verificar-local.sh` (env `MARCA`, padrão `Kota`; env `KOTA_PORTA`, padrão `8080`). Sobe com `docker compose up -d --build`, espera até 180 s o `GET /login` responder 200, confere que a página contém `$MARCA`, faz `POST /login` com o usuário de demo e espera 302 para `/home` com cookie `token`, e confere `GET /home` 200. Sai com 0 só se tudo passar.
- Produces: `scripts/testar.sh [servico]`. Sem argumento, testa todos. Python (`userservice`, `contacts`): `docker run` com uma imagem que tenha `uv` e a mesma versão de Python do Dockerfile do serviço, rodando `uv run pytest` na pasta do serviço. Java (`ledgerwriter`, `balancereader`, `transactionhistory`): `docker run --rm -v "$PWD":/w -v kota-m2:/root/.m2 -w /w maven:3.9-eclipse-temurin-17 ./mvnw -B -pl src/ledger/<servico> -am test`.
- Produces: serviços do compose com os nomes `accounts-db`, `ledger-db`, `userservice`, `contacts`, `ledgerwriter`, `balancereader`, `transactionhistory`, `frontend`, `loadgenerator` (só no profile `carga`) e `jwt-chaves`.

- [ ] **Step 1: Escrever o teste de fumaça antes do compose**

`scripts/verificar-local.sh` como descrito acima.

- [ ] **Step 2: Rodar e ver falhar**

Run: `MARCA="Bank of Anthos" scripts/verificar-local.sh`
Expected: FAIL, não há `docker-compose.yml`.

- [ ] **Step 3: Dockerfile dos três serviços Java**

Dois estágios. Contexto de build é a raiz do repo (o `pom.xml` raiz agrega os módulos). Build: `maven:3.9-eclipse-temurin-17`, `./mvnw -B -q -pl src/ledger/<servico> -am package -DskipTests`. Execução: `eclipse-temurin:17-jre`, copia `src/ledger/<servico>/target/*.jar` para `/app/app.jar`, `CMD ["java","-jar","/app/app.jar"]`.

- [ ] **Step 4: `docker-compose.yml`**

Valores de ambiente copiados dos ConfigMaps de `kubernetes-manifests/` (`config.yaml`, `accounts-db.yaml`, `ledger-db.yaml`) e dos `env` de cada Deployment, não inventados. Diferenças fixadas aqui:

- `jwt-chaves`: `alpine:3.20` com `openssl`; se `/chaves/privatekey` não existe, roda `openssl genrsa -out /chaves/privatekey 4096` e `openssl rsa -in /chaves/privatekey -outform PEM -pubout -out /chaves/publickey`. Volume nomeado `chaves`, montado em `/tmp/.ssh` nos serviços (`PRIV_KEY_PATH=/tmp/.ssh/privatekey`, `PUB_KEY_PATH=/tmp/.ssh/publickey`). Os outros dependem dele com `condition: service_completed_successfully`.
- `ENABLE_TRACING=false` e `ENABLE_METRICS=false` em todos.
- Java: **não** copiar o `JVM_OPTS` do manifesto (`-XX:+UseCGroupMemoryLimitForHeap` não existe no Java 17 e a JVM não sobe). Usar `JAVA_TOOL_OPTIONS=-Xmx256m`.
- Bancos com `healthcheck` `pg_isready`; serviços que usam banco com `condition: service_healthy`.
- `frontend` com `ports: ["${KOTA_PORTA:-8080}:8080"]` e `BANK_NAME=Kota`. Nenhum outro serviço expõe porta.
- `loadgenerator` com `profiles: ["carga"]`.

- [ ] **Step 5: Rodar e ver passar**

Run: `MARCA="Bank of Anthos" scripts/verificar-local.sh && scripts/testar.sh`
Expected: as duas saem com 0. (`MARCA` ainda é a antiga porque o logo e os textos só mudam em R2; o título já pode vir de `BANK_NAME`.)

- [ ] **Step 6: Porta alternativa e segunda subida**

Run:
```bash
docker compose down && KOTA_PORTA=18080 MARCA="Bank of Anthos" scripts/verificar-local.sh
A=$(docker compose run --rm jwt-chaves cat /chaves/publickey | shasum)
docker compose down && MARCA="Bank of Anthos" scripts/verificar-local.sh
B=$(docker compose run --rm jwt-chaves cat /chaves/publickey | shasum); [ "$A" = "$B" ] && echo "mesma chave"
```
Expected: os dois testes passam e imprime `mesma chave`.

- [ ] **Step 7: Medir memória e tempo**

Run: `docker stats --no-stream --format '{{.Name}} {{.MemUsage}}'` e o tempo do primeiro `up` com cache limpo (`docker builder prune -f` antes).
Expected: anotar os dois números no PR. Se a soma passar de 3 GB, baixar `-Xmx` antes de seguir.

- [ ] **Step 8: Commit e PR na oficina**

```bash
git switch -c feat/compose
git add docker-compose.yml scripts src/ledger/*/Dockerfile
git commit -m "feat(plataforma): banco sobe com docker compose construído do código"
gh pr create --fill
```

Colar a saída dos Steps 5 a 7 no PR e na #112.

### Task R2: troca de marca por script

**Files (no `puca-onboarding`):**
- Create: `kit/kota/marca/trocar.ts`, `kit/kota/marca/achar.ts`, `kit/kota/marca/cli.ts`
- Create: `kit/kota/checar/regras/marca.ts` (registrar em `regras/index.ts`)
- Test: `kit/kota/marca/__tests__/trocar.test.ts`, `kit/kota/marca/__tests__/achar.test.ts`, fixture em `kit/kota/marca/__tests__/fixture/`
- Modify: `package.json` (script `"kota:marca": "tsx kit/kota/marca/cli.ts"`)

**Interfaces:**
- Produces: `trocarMarca(raiz: string): RelatorioMarca`, com `interface RelatorioMarca { alterados: string[]; renomeados: [string, string][] }`. Só renomeia e troca texto, então pode rodar de novo a qualquer hora sem apagar nada.
- Produces: `acharMarca(raiz: string): Ocorrencia[]`, com `interface Ocorrencia { arquivo: string; linha: number; texto: string }`.
- Produces: `avisoDeModificacao(caminho: string): string | null`.
- Produces: regra `marca` do `check:kota` (precisa repo): erro por ocorrência de `acharMarca`.
- CLI: `npm run kota:marca -- <raiz>` aplica a troca e imprime o relatório e as ocorrências restantes.

Valores fixados:

- **Remover (uma vez só, com `git rm` no Step 6, nunca dentro do script):** `iac/`, `extras/`, `src/components/`, `kubernetes-manifests/`, `docs/` menos `docs/adr/` e `docs/runbooks/` (são da Kota e podem chegar à oficina antes do Step 6), `.github/`, `Makefile`, `skaffold*.yaml`, e em qualquer pasta `k8s/`, `skaffold.yaml`, `cloudbuild.yaml`. Depois do merge do R2, `.github/` passa a ter arquivos da Kota (CI, `CODEOWNERS`).
- **Renomear pastas Java:** `.../java/anthos/samples/bankofanthos/` → `.../java/br/com/kota/` (main e test).
- **Substituir, nesta ordem, em arquivos de texto:** `anthos.samples.bankofanthos` → `br.com.kota`; `CymbalBank` → `Kota`; `Bank of Anthos` → `Kota`; `BankOfAnthos` → `Kota`; `bank-of-anthos` → `kota-bank`; `bankofanthos` → `kota`; `CYMBAL` → `KOTA`; `Cymbal` → `Kota`; `cymbal` → `kota`. Renomear `cymbal.svg` → `kota.svg` e `cymbal.css` → `kota.css`.
- **Nunca tocar:** `LICENSE`, linhas com `Copyright` e `Google LLC`, arquivos binários.
- **Aviso de modificação**, só em arquivo cujo conteúdo mudou, logo depois do bloco de licença do topo (ou no topo, depois do shebang, se não houver bloco). Texto: `Modificado pela Kota a partir do original (Apache-2.0).` Comentário por extensão: `#` para `.py .sh .yaml .yml .toml .properties .cfg` e `Dockerfile`; `//` para `.java .js`; `/* */` para `.css`; `<!-- -->` para `.html .xml .md .svg`; `--` para `.sql`; `null` (sem aviso) para `.json`, `.lock` e o resto.
- **`acharMarca`:** `/anthos|cymbal/i` em todo arquivo de texto; `/\bGoogle\b/` só em `.md`, `.html` e `src/frontend/templates/`. Ignora `LICENSE`, linhas de `Copyright ... Google LLC` e as linhas sob o título `## Origem do código` do `README.md` da raiz.

- [ ] **Step 1: Escrever os testes que falham, com uma fixture pequena**

A fixture imita o upstream: um `.java` em `anthos/samples/bankofanthos/` com cabeçalho de licença, um `.py`, um template `.html` com `CymbalBank`, um `pyproject.toml` com `bank-of-anthos-frontend`, um `LICENSE`, um `.png`, um `cymbal.svg` e um `docs/adr/0001-x.md` da Kota. Os testes copiam a fixture para um diretório temporário.

```ts
it("renomeia o pacote Java e move a pasta", ...)           // existe .../java/br/com/kota/X.java com "package br.com.kota"
it("troca a marca nos textos", ...)                         // template contém "Kota" e não "CymbalBank"
it("mantém LICENSE e a linha de copyright", ...)            // LICENSE byte a byte igual; "Copyright 2020 Google LLC" continua
it("põe o aviso uma vez, depois da licença, no comentário certo", ...)  // .java com "// Modificado pela Kota...", .py com "#"
it("não põe aviso em arquivo que não mudou", ...)
it("não apaga nada", ...)                                   // docs/adr/0001-x.md e todo arquivo da fixture continuam existindo
it("não toca binário", ...)                                 // .png igual
it("rodar duas vezes não muda nada", () => { trocarMarca(d); const r = trocarMarca(d); expect(r.alterados).toEqual([]); });
it("acharMarca acha o que sobrou e ignora as exceções", ...)  // fixture com "Anthos Service Mesh" num .md → 1 ocorrência
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run kit/kota/marca`
Expected: FAIL.

- [ ] **Step 3: Implementar `trocarMarca`, `avisoDeModificacao`, `acharMarca`, a regra `marca` e a CLI**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run kit/kota/marca && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit e PR no `puca-onboarding`**

```bash
git add kit/kota/marca kit/kota/checar/regras package.json
git commit -m "feat(kit): troca e detector da marca de origem no código da kota"
```

- [ ] **Step 6: Aplicar na oficina, numa branch**

Run:
```bash
git -C ../kota-bank-oficina switch -c feat/marca-kota
(cd ../kota-bank-oficina && git rm -rq iac extras src/components kubernetes-manifests $(git ls-files docs | grep -vE '^docs/(adr|runbooks)/') .github Makefile skaffold*.yaml \
  $(git ls-files '*/k8s/*' '*/skaffold.yaml' '*/cloudbuild.yaml'))
npm run kota:marca -- ../kota-bank-oficina
```
Expected: relatório com cerca de 200 arquivos alterados e a lista do que sobrou.

- [ ] **Step 7: Resolver o que sobrou e trocar o logo**

À mão, só o que `acharMarca` ainda lista. `src/frontend/static/img/kota.svg` vira o logo da Kota (wordmark simples em SVG) e `favicon.png` é trocado.

Run: `npm run check:kota -- --repo ../kota-bank-oficina` e, na oficina, `scripts/testar.sh && scripts/verificar-local.sh`
Expected: regra `marca` sem erro, testes verdes, fumaça verde com `MARCA=Kota` (o padrão).

- [ ] **Step 8: Commit e PR na oficina**

```bash
git -C ../kota-bank-oficina add -A
git -C ../kota-bank-oficina commit -m "refactor: código da kota sem a marca de origem"
```

Anexar ao PR um print da tela de login com "Kota".

### Task R3: dados de demo da Kota

**Files (na oficina):**
- Modify: `src/accounts/accounts-db/initdb/1-load-testdata.sh`
- Modify: `src/ledger/ledger-db/initdb/1_create_transactions.sh` (só se citar nomes)
- Modify: `docker-compose.yml` (usuário e senha de demo)

**Interfaces:**
- Produces: usuário de demo `cliente.demo`, senha `kota-demo`, usados pelo `verificar-local.sh` e pelo guia de uso (C5).

- [ ] **Step 1: Trocar o usuário do teste de fumaça para `cliente.demo` / `kota-demo` e ver falhar**

Run: `docker compose down -v && scripts/verificar-local.sh`
Expected: FAIL no `POST /login`.

- [ ] **Step 2: Trocar os dados**

`testuser`, `alice`, `bob` e `eve` viram `cliente.demo` e três clientes com nomes brasileiros sintéticos (sem coincidir com pessoas do mapa). Endereço, estado e CEP brasileiros fictícios. A senha de demo vem do compose. Ver como o script calcula o hash da senha e manter o mesmo mecanismo.

- [ ] **Step 3: Rodar e ver passar**

Run: `docker compose down -v && scripts/verificar-local.sh && scripts/testar.sh`
Expected: PASS.

- [ ] **Step 4: Commit e PR na oficina**

```bash
git commit -am "feat(contas): clientes de demo da kota"
```

### Task R4: CI da Kota

**Files (na oficina):**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: dois jobs em `push` e `pull_request`. `testes`, com matriz `servico: [userservice, contacts, ledgerwriter, balancereader, transactionhistory]` rodando `scripts/testar.sh ${{ matrix.servico }}`. `sobe-o-banco`, rodando `scripts/verificar-local.sh` no `ubuntu-latest` (é a prova do critério "Linux amd64" da #112). O C2 depende do `testes` para manter a `main` verde.

- [ ] **Step 1: Escrever o workflow e abrir PR**
- [ ] **Step 2: Conferir no PR**

Run: `gh pr checks --watch -R JucaGF/kota-bank-oficina`
Expected: os 6 checks verdes. Colar o link da execução na #112.

- [ ] **Step 3: Merge**

### Task R5: README da raiz

**Files:**
- Create (no `puca-onboarding`): `kit/kota/gerar/readme-raiz.ts`, teste `kit/kota/__tests__/readme-raiz.test.ts`, regra `kit/kota/checar/regras/readme-raiz.ts`
- Modify (no `puca-onboarding`): `package.json` (script `"kota:readme-raiz": "tsx kit/kota/gerar/readme-raiz.ts"`, recebe a raiz do repo)
- Modify (na oficina): `README.md`

**Interfaces:**
- Produces: `tabelaSistemas(m: MapaKota): string`, tabela Markdown `| Serviço | Linguagem | O que faz | Time |` com uma linha por sistema, na ordem do mapa, e o nome do time vindo de `TimeKota.nome`. A CLI troca o trecho entre `<!-- kota:sistemas:inicio -->` e `<!-- kota:sistemas:fim -->`. A regra `readme-raiz` (precisa repo) acusa trecho diferente do gerado.

- [ ] **Step 1: Testes de `tabelaSistemas`, da troca entre marcadores e da regra; ver falhar**

```ts
it("uma linha por sistema com o nome do time", ...)
it("troca só o que está entre os marcadores", ...)   // texto antes e depois intacto
it("regra acusa tabela desatualizada", ...)
```

Run: `npx vitest run kit/kota/__tests__/readme-raiz.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar e ver passar**

Run: `npx vitest run kit/kota/__tests__/readme-raiz.test.ts`
Expected: PASS.

- [ ] **Step 3: Escrever o README da raiz da oficina**

Seções nesta ordem: o que é a Kota; serviços (marcadores); como subir (`docker compose up --build`, `http://localhost:8080`, `cliente.demo` / `kota-demo`, `KOTA_PORTA`); como testar (`scripts/testar.sh`); decisões (`docs/adr/`); runbooks (`docs/runbooks/`); `## Origem do código` (baseado no Bank of Anthos v0.6.11, Apache-2.0, `LICENSE` mantido, arquivos modificados com aviso).

- [ ] **Step 4: Conferir**

Run: `npm run kota:readme-raiz -- ../kota-bank-oficina && npm run check:kota -- --repo ../kota-bank-oficina`
Expected: regras `marca` e `readme-raiz` sem erro.

- [ ] **Step 5: Commits e PRs nos dois repos**

```bash
git commit -m "feat(kit): tabela de serviços do readme da kota gerada do mapa"   # puca-onboarding
git -C ../kota-bank-oficina commit -am "docs: readme da kota com serviços, como subir e testar"
```

- [ ] **Step 6: Máquina limpa**

Outra pessoa do time, num Mac com Apple Silicon, segue só o README da oficina. Anotar na #112 quanto tempo levou e onde travou. Fecha o último critério da #112 (e ajuda a #39).
