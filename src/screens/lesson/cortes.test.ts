import { describe, expect, it } from "vitest";
import type { SpeechCue } from "../../journey/types";
import { acoesQueAindaValem } from "./cortes";

const cues: SpeechCue[] = [
  { at: 5, action: { type: "highlight", targets: ["ledger"] } },
  { at: 10, action: { type: "navegador", acao: { tipo: "circular", alvo: { texto: "README.md" } } } },
  { at: 20, action: { type: "card", target: "ledger" } },
  { at: 30, action: { type: "navegador", acao: { tipo: "clicar", alvo: { texto: "README.md" } } } },
];

describe("acoesQueAindaValem", () => {
  it("depois do corte, só as ações do quadro que faltavam", () => {
    expect(acoesQueAindaValem(cues, 1)).toEqual([{ type: "card", target: "ledger" }]);
  });

  it("cortada antes de começar: o quadro chega ao estado final, o navegador não age", () => {
    expect(acoesQueAindaValem(cues, 0)).toEqual([
      { type: "highlight", targets: ["ledger"] },
      { type: "card", target: "ledger" },
    ]);
  });
});
