import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { checarKota } from "../../checar/checar";
import type { ContextoKota } from "../../checar/contexto";
import { regras } from "../../checar/regras";
import { regraMarca } from "../../checar/regras/marca";
import { mapa } from "../../mapa";
import { copiaGit, repoGit } from "../../__tests__/repo-git";
import { acharMarca } from "../achar";
import { trocarMarca } from "../trocar";

const FIXTURE = fileURLToPath(new URL("./fixture", import.meta.url));
const ctx = (repo?: string): ContextoKota => ({ mapa, repo, notionUrls: {}, jornadas: [] });

it("acharMarca acha o que sobrou e ignora as exceções", () => {
  const d = copiaGit(FIXTURE);
  trocarMarca(d);
  expect(acharMarca(d)).toEqual([
    { arquivo: "src/frontend/README.md", linha: 3, texto: "Usa o Anthos Service Mesh para o tráfego entre os serviços." },
  ]);
});

it("Google só conta em .md, .html e nos templates do frontend", () => {
  const d = repoGit({
    "a.py": "# manda para o Google Cloud\n",
    "b.md": "Roda no Google Cloud.\n",
    "c.html": "<p>Google</p>\n",
    "src/frontend/templates/d.txt": "Google\n",
    "e.md": "Fonte do googleapis.\n",
    "f.html": "<!-- Copyright 2020 Google LLC -->\n",
  });
  expect(acharMarca(d).map((o) => o.arquivo)).toEqual(["b.md", "c.html", "src/frontend/templates/d.txt"]);
});

it("a seção de origem só vale no README da raiz e vai até o próximo título # ou ##", () => {
  const origem = "## Origem do código\n\nBaseado no Bank of Anthos.\n\n### Licença\n\nCymbal\n\n## Depois\n\nCymbal Bank\n";
  const d = repoGit({ "README.md": `# Kota\n\n${origem}`, "src/frontend/README.md": origem });
  expect(acharMarca(d)).toEqual([
    { arquivo: "README.md", linha: 13, texto: "Cymbal Bank" },
    { arquivo: "src/frontend/README.md", linha: 3, texto: "Baseado no Bank of Anthos." },
    { arquivo: "src/frontend/README.md", linha: 7, texto: "Cymbal" },
    { arquivo: "src/frontend/README.md", linha: 11, texto: "Cymbal Bank" },
  ]);
});

it("regra marca dá um erro por ocorrência", () => {
  const d = repoGit({ "x.md": "Usa o Anthos Service Mesh.\n", "y.py": "ok = True\n" });
  expect(regraMarca.checar(ctx(d))).toEqual(["x.md:1: Usa o Anthos Service Mesh."]);
});

it("regra marca roda no check:kota só com --repo", () =>
  expect(checarKota(ctx(), regras).pulas).toContain("marca: sem --repo"));
