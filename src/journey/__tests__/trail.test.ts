import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { buildFaqs } from "../faq";
import { DEMO_PROFILES } from "../profile";
import type { Route } from "../route";
import { memoryStore, type KeyValueStore } from "../storage";
import { createTrail, SESSIONS_KEY, sourcesFor, summarizeSessions, TRAIL_KEY, type TrailEntry } from "../trail";
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

  it("navegador sem espaço (setItem lança) não quebra a aula", () => {
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

  it("exportJson devolve o resumo das sessões e as falas", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.record(entry("a"));
    const json = JSON.parse(trail.exportJson());
    expect(json.entries).toHaveLength(1);
    expect(json.sessions).toHaveLength(1);
    expect(json.sessions[0]).toMatchObject({ utterances: 1, llm_calls: 1 });
  });
});

describe("custo da sessão (#52)", () => {
  /** Relógio que a gente avança à mão. */
  function clock(start = Date.parse("2026-11-07T22:00:00Z")) {
    let t = start;
    return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
  }

  it("resumo soma tokens e tempo do llm só das falas da sessão", () => {
    const store = memoryStore();
    const a = createTrail(store, { session: "A" });
    const b = createTrail(store, { session: "B" });
    a.startSession();
    b.startSession();
    const p1 = a.record(entry("p1"));
    const p2 = a.record(entry("p2"));
    a.record({ ...entry("quem cuida do authorizer?"), route: "faq" });
    a.update(p1.id, { llm_ms: 1200, tokens_in: 800, tokens_out: 40, tokens_estimated: false });
    a.update(p2.id, { llm_ms: 1800, tokens_in: 900, tokens_out: 60, tokens_estimated: false });
    const pb = b.record(entry("outra sessão"));
    b.update(pb.id, { llm_ms: 999, tokens_in: 5000, tokens_out: 500, tokens_estimated: false });
    const [sa] = summarizeSessions(a.list(), a.sessions()).filter((s) => s.session === "A");
    expect(sa).toMatchObject({ utterances: 3, llm_calls: 2, llm_calls_unmeasured: 0, llm_ms: 3000, tokens_in: 1700, tokens_out: 100, tokens_estimated: false });
  });

  it("duração: do início ao fim; sem fim, até a última fala", () => {
    const c = clock();
    const trail = createTrail(memoryStore(), { now: c.now, session: "S" });
    trail.startSession();
    c.advance(60_000);
    trail.record(entry("fala"));
    expect(summarizeSessions(trail.list(), trail.sessions())[0]).toMatchObject({ ended_at: null, duration_ms: 60_000 });
    c.advance(30_000);
    trail.endSession();
    expect(summarizeSessions(trail.list(), trail.sessions())[0].duration_ms).toBe(90_000);
  });

  it("ask sem timing conta como não medido", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.record(entry("interrompida"));
    expect(summarizeSessions(trail.list(), trail.sessions())[0]).toMatchObject({ llm_calls: 1, llm_calls_unmeasured: 1, tokens_in: 0, tokens_out: 0 });
  });

  it("qualquer token estimado marca a sessão como estimada", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.update(trail.record(entry("a")).id, { tokens_in: 10, tokens_out: 1, tokens_estimated: false });
    trail.update(trail.record(entry("b")).id, { tokens_in: 10, tokens_out: 1, tokens_estimated: true });
    expect(summarizeSessions(trail.list(), trail.sessions())[0].tokens_estimated).toBe(true);
  });

  it("entradas antigas sem os campos novos não quebram o resumo", () => {
    const store = memoryStore();
    store.setItem(TRAIL_KEY, JSON.stringify([{ id: "1", at: "2026-11-07T22:00:00Z", session: "velha", from: "chat", utterance: "x", route: "ask", answer: "", sources: [], moment: null, step: null }]));
    const trail = createTrail(store);
    expect(() => trail.exportJson()).not.toThrow();
    const [s] = summarizeSessions(trail.list(), trail.sessions());
    expect(s).toMatchObject({ session: "velha", started_at: "2026-11-07T22:00:00Z", utterances: 1, llm_calls_unmeasured: 1 });
  });

  it("sessões gravadas com lixo viram lista vazia", () => {
    const store = memoryStore();
    store.setItem(SESSIONS_KEY, "{lixo");
    expect(createTrail(store).sessions()).toEqual([]);
  });

  it("recomeçar a aula não troca o início da sessão", () => {
    const c = clock();
    const trail = createTrail(memoryStore(), { now: c.now });
    trail.startSession();
    const first = trail.sessions()[0].started_at;
    c.advance(5_000);
    trail.startSession();
    expect(trail.sessions()).toHaveLength(1);
    expect(trail.sessions()[0].started_at).toBe(first);
  });

  it("limpar apaga as falas e as sessões", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.record(entry("a"));
    trail.clear();
    expect(trail.sessions()).toEqual([]);
    expect(JSON.parse(trail.exportJson())).toEqual({ sessions: [], entries: [] });
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

  it("conhecimento da aula: aponta o momento", () => {
    expect(sourcesFor({ kind: "knowledge", text: "x" }, journey, pagamentos)).toEqual([`Conhecimento da aula: ${pagamentos.title}`]);
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
