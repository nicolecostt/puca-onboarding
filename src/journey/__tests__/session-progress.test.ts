import { expect, it } from "vitest";
import { screenHref } from "../../lib/navigation";
import { DEMO_PROFILES } from "../profile";
import { completeSession, sessionCompleted } from "../session-progress";
import { memoryStore } from "../storage";

it("preserva o perfil entre telas sem propagar parâmetros da sessão ou da tarefa", () => {
  expect(screenHref("../inicio/", "?perfil=ana&auto=1")).toBe("../inicio/?perfil=ana");
  expect(screenHref("../primeira-tarefa/?id=123", "?perfil=bruno&auto=1")).toBe("../primeira-tarefa/?id=123&perfil=bruno");
  expect(screenHref("../inicio/", "?id=123")).toBe("../inicio/");
});

it("guarda a conclusão para o perfil e a janela que fizeram a sessão", () => {
  const store = memoryStore();
  expect(sessionCompleted(DEMO_PROFILES.novo, store)).toBe(false);
  completeSession(DEMO_PROFILES.novo, store);
  expect(sessionCompleted(DEMO_PROFILES.novo, store)).toBe(true);
  expect(sessionCompleted(DEMO_PROFILES.transicao, store)).toBe(false);
  expect(sessionCompleted(DEMO_PROFILES.novo, memoryStore())).toBe(false);
});
