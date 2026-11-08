import { describe, expect, it } from "vitest";
import demo from "../data/kota.journey.json";
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

  it("item malformado no rastro é descartado e não quebra o update", () => {
    const store = memoryStore();
    const valida = { ...entry("válida"), id: "ok", at: "2026-11-08T05:00:00.000Z", session: "s" };
    store.setItem(TRAIL_KEY, JSON.stringify([null, { id: "sem-fontes" }, valida]));
    const trail = createTrail(store);
    expect(trail.list().map((e) => e.id)).toEqual(["ok"]);
    expect(() => trail.update("ok", { answer: "x" })).not.toThrow();
    expect(trail.list()[0].answer).toBe("x");
  });

  it("sessão malformada no navegador não impede de começar nem de baixar o json", () => {
    const store = memoryStore();
    store.setItem(SESSIONS_KEY, JSON.stringify([null, {}]));
    const trail = createTrail(store);
    expect(() => trail.startSession()).not.toThrow();
    expect(() => trail.exportJson()).not.toThrow();
    expect(trail.sessions()).toHaveLength(1);
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

  it("update grava o link do encaminhamento no Slack da Kota (#129)", () => {
    const trail = createTrail(memoryStore());
    const e = trail.record(entry("quem cuida do tail-common?"));
    trail.update(e.id, { forwarding_id: "f1", forwarding_link: "https://kota.slack.com/archives/D1/p12" });
    expect(trail.list()[0]).toMatchObject({ forwarding_id: "f1", forwarding_link: "https://kota.slack.com/archives/D1/p12" });
    expect(JSON.parse(trail.exportJson()).entries[0].forwarding_link).toBe("https://kota.slack.com/archives/D1/p12");
  });

  it("exportJson devolve o resumo das sessões e as falas", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.update(trail.record(entry("a")).id, { ms: 900 });
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
    a.record({ ...entry("quem cuida do balancereader?"), route: "faq" });
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

  it("ask que chegou ao servidor mas sem timing (a pessoa interrompeu) conta como não medido", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.update(trail.record(entry("interrompida")).id, { ms: 1100 });
    expect(summarizeSessions(trail.list(), trail.sessions())[0]).toMatchObject({ llm_calls: 1, llm_calls_unmeasured: 1, tokens_in: 0, tokens_out: 0 });
  });

  it("qualquer token estimado marca a sessão como estimada", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.update(trail.record(entry("a")).id, { llm_ms: 900, tokens_in: 10, tokens_out: 1, tokens_estimated: false });
    trail.update(trail.record(entry("b")).id, { llm_ms: 900, tokens_in: 10, tokens_out: 1, tokens_estimated: true });
    expect(summarizeSessions(trail.list(), trail.sessions())[0].tokens_estimated).toBe(true);
  });

  it("entradas antigas sem os campos novos não quebram o resumo", () => {
    const store = memoryStore();
    store.setItem(TRAIL_KEY, JSON.stringify([{ id: "1", at: "2026-11-07T22:00:00Z", session: "velha", from: "chat", utterance: "x", route: "ask", answer: "", sources: [], moment: null, step: null, ms: 900 }]));
    const trail = createTrail(store);
    expect(() => trail.exportJson()).not.toThrow();
    const [s] = summarizeSessions(trail.list(), trail.sessions());
    expect(s).toMatchObject({ session: "velha", started_at: "2026-11-07T22:00:00Z", utterances: 1, llm_calls_unmeasured: 1 });
  });

  it("pergunta sem servidor (nem ms nem timing) não conta como chamada ao agente", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.record(entry("servidor fora do ar"));
    expect(summarizeSessions(trail.list(), trail.sessions())[0]).toMatchObject({ utterances: 1, llm_calls: 0, llm_calls_unmeasured: 0 });
  });

  it("timing sem tokens (o provedor recusou) conta como chamada medida, sem tokens", () => {
    const trail = createTrail(memoryStore());
    trail.startSession();
    trail.update(trail.record(entry("sem chave")).id, { ms: 300, llm_ms: 250, tokens_estimated: false });
    expect(summarizeSessions(trail.list(), trail.sessions())[0]).toMatchObject({ llm_calls: 1, llm_calls_unmeasured: 0, tokens_in: 0, llm_ms: 250 });
  });

  it("recomeçar depois do fim reabre a sessão, com o mesmo início", () => {
    const c = clock();
    const trail = createTrail(memoryStore(), { now: c.now });
    trail.startSession();
    c.advance(60_000);
    trail.endSession();
    c.advance(10_000);
    trail.startSession();
    c.advance(600_000);
    trail.record(entry("depois de recomeçar"));
    const [s] = summarizeSessions(trail.list(), trail.sessions());
    expect(s.ended_at).toBeNull();
    expect(s.duration_ms).toBe(670_000);
  });

  it("sessões gravadas com lixo viram lista vazia", () => {
    const store = memoryStore();
    store.setItem(SESSIONS_KEY, "{lixo");
    expect(createTrail(store).sessions()).toEqual([]);
  });

  it("recomeçar a sessão não troca o início da sessão", () => {
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
    expect(sourcesFor(faq("balancereader", "what"), journey, pagamentos)).toEqual(["ADR 4 · Saldo e extrato com cache em memória, lidos do livro-razão", "README do balancereader"]);
  });

  it("por que existe: só o ADR, nunca as outras docs do nó", () => {
    expect(sourcesFor(faq("ledgerwriter", "why"), journey, pagamentos)).toEqual(["ADR-0001"]);
  });

  it("quem cuida: sem fonte, porque as docs do nó não dizem quem cuida", () => {
    expect(sourcesFor(faq("balancereader", "owner"), journey, pagamentos)).toEqual([]);
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
      { kind: "select", node: "balancereader" },
      { kind: "ask" },
    ];
    for (const r of routes) expect(sourcesFor(r, journey, pagamentos)).toEqual([]);
  });
});
