import { expect, test } from "vitest";
import { lembrar, type Historico } from "./historico";

test("frases seguidas de Puca viram um turno só, e a janela conta turnos", () => {
  const h: Historico = [];
  lembrar(h, "assistant", "Oi.");
  lembrar(h, "assistant", "Tudo bem?");
  lembrar(h, "user", "Tudo.");
  lembrar(h, "user", "E você?");
  expect(h).toEqual([
    { role: "assistant", content: "Oi. Tudo bem?" },
    { role: "user", content: "Tudo." },
    { role: "user", content: "E você?" },
  ]);
  lembrar(h, "assistant", "Bem.", 3);
  expect(h.map((m) => m.content)).toEqual(["Tudo.", "E você?", "Bem."]);
});
