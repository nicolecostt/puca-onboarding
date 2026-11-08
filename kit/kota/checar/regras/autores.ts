import { execFileSync } from "node:child_process";
import type { Regra } from "../contexto";

// O commit raiz é o que o GitHub criou com o repo; o resto do histórico público é assinado por pessoas da Kota.
// A oficina recebe commits do time pelo GitHub, então a regra só vale fora dela.
export const regraAutores: Regra = {
  nome: "autores",
  precisaRepo: true,
  checar(ctx) {
    if (/kota-bank-oficina(\.git)?$/.test(origem(ctx.repo!))) return [];
    const doMapa = new Set<string>(ctx.mapa.pessoas.map((p) => p.email));
    const log = execFileSync("git", ["log", "--format=%h%x00%P%x00%ae%x00%ce"], { cwd: ctx.repo!, encoding: "utf8" });
    return log
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\0"))
      .filter(([, pais]) => pais)
      .flatMap(([h, , autor, committer]) =>
        [["autor", autor], ["committer", committer]].flatMap(([papel, email]) =>
          !email.endsWith("@kota.example") ? [`commit ${h}: ${papel} ${email} fora de @kota.example`]
          : !doMapa.has(email) ? [`commit ${h}: ${papel} ${email} não é de uma pessoa do mapa`]
          : []));
  },
};

function origem(repo: string): string {
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
