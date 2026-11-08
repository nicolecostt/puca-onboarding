import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Regra } from "../contexto";

// A política explica a regra geral; o caso da pessoa vai ao gestor ou a People por esta linha (#125).
const LINHA = "Casos individuais: fale com seu gestor ou com People (people@kota.example).";
const COM_A_LINHA = ["bonus", "promocao", "revisao-salarial"];

// Página que falta é acusada pela paginas-escritas.
export function criarRegraKotaPeople(pasta: string): Regra {
  return {
    nome: "kota-people",
    precisaRepo: false,
    checar: () =>
      COM_A_LINHA.map((chave) => `${chave}.md`)
        .filter((f) => existsSync(join(pasta, f)) && !readFileSync(join(pasta, f), "utf8").split(/\r?\n/).includes(LINHA))
        .map((f) => `paginas/${f}: falta a linha "${LINHA}"`),
  };
}

export const regraKotaPeople = criarRegraKotaPeople(fileURLToPath(new URL("../../notion/paginas", import.meta.url)));
