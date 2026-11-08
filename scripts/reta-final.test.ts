import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/reta-final.sh");

function hook(agora: string): { codigo: number | null; saida: string } {
  const r = spawnSync("bash", [script], { input: "{}", encoding: "utf8", env: { ...process.env, RETA_FINAL_AGORA: agora } });
  return { codigo: r.status, saida: r.stdout };
}

describe("reta-final", () => {
  it("antes das 12:00, mostra o tempo que falta e a fase de implementar", () => {
    const r = hook("2026-11-08T09:30:00-03:00");
    expect(r.codigo).toBe(0);
    expect(r.saida).toMatch(/Faltam 2h30 para fechar a implementação \(12:00\) e 3h30 para a submissão/);
    expect(r.saida).toMatch(/Fase IMPLEMENTAR/);
  });

  it("entre 12:00 e 13:00, só testar e gravar", () => {
    const r = hook("2026-11-08T12:35:00-03:00");
    expect(r.saida).toMatch(/Faltam 25min para a submissão/);
    expect(r.saida).toMatch(/Fase TESTAR E GRAVAR/);
  });

  it("depois da submissão fica em silêncio", () => {
    expect(hook("2026-11-08T13:00:00-03:00")).toEqual({ codigo: 0, saida: "" });
    expect(hook("2026-11-09T10:00:00-03:00")).toEqual({ codigo: 0, saida: "" });
  });
});
