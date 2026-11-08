import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { buildFaqs } from "../faq";
import { DEMO_PROFILES } from "../profile";
import type { Route } from "../route";
import { memoryStore, type KeyValueStore } from "../storage";
import { createTrail, sourcesFor, TRAIL_KEY, type TrailEntry } from "../trail";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const faqs = buildFaqs(journey, DEMO_PROFILES.novo);
const pagamentos = journey.moments.find((m) => m.id === "pagamentos")!;
const entry = (utterance: string): Omit<TrailEntry, "id" | "at" | "session"> =>
  ({ from: "chat", utterance, route: "ask", answer: "", sources: [], moment: null, step: null });

describe("createTrail", () => {
  it("grava as falas em ordem, com id, hora e a mesma sessão", () => {
    const trail = createTrail(memoryStore());
    trail.record(entry("primeira"));
    trail.record(entry("segunda"));
    const list = trail.list();
    expect(list.map((e) => e.utterance)).toEqual(["primeira", "segunda"]);
    expect(list[0].id).toBeTruthy();
    expect(list[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(list[0].session).toBe(list[1].session);
  });

  it("guarda no máximo 500 entradas, tirando as mais antigas", () => {
    const trail = createTrail(memoryStore());
    for (let i = 0; i < 501; i++) trail.record(entry(`fala ${i}`));
    const list = trail.list();
    expect(list).toHaveLength(500);
    expect(list[0].utterance).toBe("fala 1");
  });

  it("rastro corrompido no navegador vira lista vazia e volta a gravar", () => {
    const store = memoryStore();
    store.setItem(TRAIL_KEY, "{lixo");
    const trail = createTrail(store);
    expect(trail.list()).toEqual([]);
    trail.record(entry("depois"));
    expect(trail.list()).toHaveLength(1);
  });

  it("navegador sem espaço (setItem lança) não quebra a sessão", () => {
    const full: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(() => createTrail(full).record(entry("x"))).not.toThrow();
  });

  it("update muda só a entrada pedida", () => {
    const trail = createTrail(memoryStore());
    const a = trail.record(entry("a"));
    trail.record(entry("b"));
    trail.update(a.id, { answer: "x", ms: 1200 });
    const [ea, eb] = trail.list();
    expect(ea).toMatchObject({ answer: "x", ms: 1200 });
    expect(eb.answer).toBe("");
  });

  it("exportJson devolve a lista em JSON", () => {
    const trail = createTrail(memoryStore());
    trail.record(entry("a"));
    expect(JSON.parse(trail.exportJson())).toHaveLength(1);
  });
});

describe("sourcesFor", () => {
  const faq = (node: string, intent: string): Route => ({ kind: "faq", faq: faqs.find((f) => f.node === node && f.intent === intent)! });

  it("o que é: títulos das docs do nó", () => {
    expect(sourcesFor(faq("authorizer", "what"), journey, pagamentos)).toEqual(["ADR-019 · Cálculo de MDR por plano", "fees/mdr.go"]);
  });

  it("por que existe: só o ADR, nunca as outras docs do nó", () => {
    expect(sourcesFor(faq("gateway", "why"), journey, pagamentos)).toEqual(["ADR-012"]);
  });

  it("quem cuida: sem fonte, porque as docs do nó não dizem quem cuida", () => {
    expect(sourcesFor(faq("authorizer", "owner"), journey, pagamentos)).toEqual([]);
  });

  it("responsável não confirmado: sem fonte", () => {
    const unconfirmed = faqs.find((f) => f.intent === "owner" && f.text.startsWith("Não tenho um responsável confirmado"))!;
    expect(unconfirmed).toBeTruthy();
    expect(sourcesFor({ kind: "faq", faq: unconfirmed }, journey, pagamentos)).toEqual([]);
  });

  it("conhecimento da sessão: aponta o momento", () => {
    expect(sourcesFor({ kind: "knowledge", text: "x" }, journey, pagamentos)).toEqual([`Conhecimento da sessão: ${pagamentos.title}`]);
  });

  it("pulo, resposta sugerida, toque e agente: sem fonte", () => {
    const routes: Route[] = [
      { kind: "jump", moment: pagamentos },
      { kind: "reply", reply: "Pode seguir" },
      { kind: "select", node: "authorizer" },
      { kind: "ask" },
    ];
    for (const r of routes) expect(sourcesFor(r, journey, pagamentos)).toEqual([]);
  });
});
