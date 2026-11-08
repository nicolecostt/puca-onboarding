import { expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import type { ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraSegredos } from "../checar/regras/segredos";
import { mapa } from "../mapa";
import { repoGit } from "./repo-git";

const ctx = (repo?: string): ContextoKota => ({ mapa, repo, notionUrls: {}, jornadas: [] });

it("acusa chave privada, chave PEM em base64 e token do Slack, sem repetir o segredo", () => {
  const d = repoGit({
    ".env.example": "SLACK_TOKEN=xoxb-1234-5678-abcdef\n",
    "chave.pem": "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----\n",
    "extras/jwt/jwt-secret.yaml": "data:\n  jwtRS256.key: LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQo=\n",
    "src/app.py": "print('ok')\n",
  });
  expect(regraSegredos.checar(ctx(d))).toEqual([
    ".env.example:1: token de bot do Slack",
    "chave.pem:1: chave privada",
    "chave.pem:3: chave privada",
    "extras/jwt/jwt-secret.yaml:2: chave PEM em base64",
  ]);
});

it("ignora binário e o que o git ignora", () => {
  const d = repoGit({
    ".gitignore": "segredos/\n",
    "segredos/chave.pem": "-----BEGIN PRIVATE KEY-----\n",
    "logo.png": new Uint8Array([0x89, 0x50, 0x00, ...new TextEncoder().encode("PRIVATE KEY")]),
  });
  expect(regraSegredos.checar(ctx(d))).toEqual([]);
});

it("roda no check:kota só com --repo", () => expect(checarKota(ctx(), regras).pulas).toContain("segredos: sem --repo"));
