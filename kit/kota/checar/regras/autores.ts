import { execFileSync } from "node:child_process";
import type { Regra } from "../contexto";

// O commit raiz é o que o GitHub criou com o repo; o resto do histórico público é assinado por pessoas da Kota.
export const regraAutores: Regra = {
  nome: "autores",
  precisaRepo: true,
  checar(ctx) {
    const log = execFileSync("git", ["log", "--format=%h%x00%P%x00%ae%x00%ce"], { cwd: ctx.repo!, encoding: "utf8" });
    return log
      .split("\n")
      .filter(Boolean)
      .map((l) => l.split("\0"))
      .filter(([, pais]) => pais)
      .flatMap(([h, , autor, committer]) =>
        [["autor", autor], ["committer", committer]]
          .filter(([, email]) => !email.endsWith("@kota.example"))
          .map(([papel, email]) => `commit ${h}: ${papel} ${email} fora de @kota.example`));
  },
};
