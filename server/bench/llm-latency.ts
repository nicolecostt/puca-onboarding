// Benchmark de latência do LLM (Featherless) em cenários reais da jornada Orla.
// Uso: npm run bench:llm -- [--n 3] [--models Qwen/Qwen3-32B,Qwen/Qwen3-14B] [--configs min-nothink,min-default,full-nothink]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import "../src/env";
import { buildMessages, buildTools, visibleNodes, type TurnContext } from "../src/agent/prompt";
import { SentenceSplitter } from "../src/agent/sentences";
import { streamChat, LlmError } from "../src/llm";
import { loadJourney } from "../../src/journey/validate";
import { DEMO_PROFILES } from "../../src/journey/profile";

const { values } = parseArgs({
  options: {
    n: { type: "string", default: "3" },
    models: { type: "string", default: "Qwen/Qwen3-32B,Qwen/Qwen3.5-27B,Qwen/Qwen3-14B" },
    configs: { type: "string", default: "min-nothink,min-default,full-nothink" },
    label: { type: "string", default: "" },
  },
});

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));
const base: Omit<TurnContext, "momentId" | "stepId"> = { journey, profile: DEMO_PROFILES.novo };

interface Scenario {
  id: string;
  ctx: TurnContext;
  text: string;
  /** Tool que o cenário espera (ou null = qualquer resposta falada serve). */
  expectTool: string | null;
}

const scenarios: Scenario[] = [
  { id: "segue-passo", ctx: { ...base, momentId: "pagamentos", stepId: "pg-pergunta" }, text: "Antes de seguir, o que exatamente o payments-api faz?", expectTool: null },
  { id: "transicao-ambigua", ctx: { ...base, momentId: "pagamentos", stepId: "pg-pergunta" }, text: "e se der ruim na hora de cobrar o cartão, o que rola?", expectTool: "go_to" },
  { id: "fora-do-roteiro", ctx: { ...base, momentId: "pagamentos", stepId: "pg-pergunta" }, text: "Quanto ganha um engenheiro pleno aqui na Orla?", expectTool: "escalate_to_buddy" },
];

const configs: Record<string, { mode: "min" | "full"; thinking: boolean | undefined }> = {
  "min-nothink": { mode: "min", thinking: false },
  "min-default": { mode: "min", thinking: undefined },
  "full-nothink": { mode: "full", thinking: false },
};

interface Sample {
  model: string;
  config: string;
  scenario: string;
  ttftMs: number | null;
  firstSentenceMs: number | null;
  totalMs: number;
  reasoningChars: number;
  text: string;
  tools: { name: string; valid: boolean }[];
  expectedToolHit: boolean | null;
  error: string | null;
}

function validTool(name: string, args: any, sc: Scenario): boolean {
  const ids = new Set(visibleNodes(sc.ctx).map((n) => n.id));
  const toolNames = new Set(buildTools(sc.ctx).map((t) => t.function.name));
  if (!toolNames.has(name) || args == null) return false;
  if (name === "highlight") return Array.isArray(args.targets) && args.targets.length > 0 && args.targets.every((t: string) => ids.has(t));
  if (name === "open_card") return ids.has(args.target);
  if (name === "go_to") return typeof args.target === "string" && args.target.includes(":");
  if (name === "escalate_to_buddy") return typeof args.summary === "string";
  return false;
}

async function runOne(model: string, config: string, sc: Scenario): Promise<Sample> {
  const c = configs[config];
  const t0 = performance.now();
  const s: Sample = { model, config, scenario: sc.id, ttftMs: null, firstSentenceMs: null, totalMs: 0, reasoningChars: 0, text: "", tools: [], expectedToolHit: null, error: null };
  const splitter = new SentenceSplitter();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30_000);
  try {
    for await (const ev of streamChat({ model, messages: buildMessages(sc.ctx, sc.text, c.mode), tools: buildTools(sc.ctx), thinking: c.thinking, maxTokens: 250, signal: ac.signal })) {
      const ms = performance.now() - t0;
      if (ev.type === "reasoning") s.reasoningChars += ev.text.length;
      if (ev.type === "text") {
        s.ttftMs ??= ms;
        s.text += ev.text;
        if (splitter.push(ev.text).length) s.firstSentenceMs ??= ms;
      }
      if (ev.type === "tool_call") {
        s.ttftMs ??= ms;
        s.tools.push({ name: ev.name, valid: validTool(ev.name, ev.args, sc) });
      }
    }
    if (s.firstSentenceMs == null && splitter.flush()) s.firstSentenceMs = performance.now() - t0;
  } catch (e) {
    s.error = e instanceof LlmError ? e.code : (e as Error).name === "AbortError" ? "timeout" : String(e).slice(0, 120);
  } finally {
    clearTimeout(timer);
  }
  s.totalMs = performance.now() - t0;
  if (sc.expectTool) s.expectedToolHit = s.tools.some((t) => t.name === sc.expectTool && t.valid);
  return s;
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  return Math.round(a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]);
};

const n = Number(values.n);
const samples: Sample[] = [];
for (const model of values.models!.split(",")) {
  for (const config of values.configs!.split(",")) {
    for (const sc of scenarios) {
      for (let i = 0; i < n; i++) {
        const s = await runOne(model, config, sc);
        samples.push(s);
        const tools = s.tools.map((t) => `${t.name}${t.valid ? "" : "✗"}`).join(",");
        console.log(`${model.padEnd(18)} ${config.padEnd(13)} ${sc.id.padEnd(18)} ttft=${s.ttftMs?.toFixed(0) ?? "-"} 1ªfrase=${s.firstSentenceMs?.toFixed(0) ?? "-"} total=${s.totalMs.toFixed(0)} think=${s.reasoningChars} tools=[${tools}] ${s.error ?? ""} | ${s.text.replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
  }
}

console.log("\nResumo (ms) — p50 / p95");
console.log("modelo             config        ttft          1ª frase      erros  tool esperada");
const groups = new Map<string, Sample[]>();
for (const s of samples) groups.set(`${s.model}|${s.config}`, [...(groups.get(`${s.model}|${s.config}`) ?? []), s]);
const summary = [...groups].map(([key, ss]) => {
  const [model, config] = key.split("|");
  const ok = ss.filter((s) => !s.error);
  const ttft = ok.map((s) => s.ttftMs).filter((x): x is number => x != null);
  const fs = ok.map((s) => s.firstSentenceMs).filter((x): x is number => x != null);
  const exp = ss.filter((s) => s.expectedToolHit != null);
  const row = {
    model,
    config,
    ttft_p50: pct(ttft, 50),
    ttft_p95: pct(ttft, 95),
    first_sentence_p50: pct(fs, 50),
    first_sentence_p95: pct(fs, 95),
    errors: ss.length - ok.length,
    expected_tool: `${exp.filter((s) => s.expectedToolHit).length}/${exp.length}`,
    runs: ss.length,
  };
  console.log(`${model.padEnd(18)} ${config.padEnd(13)} ${`${row.ttft_p50}/${row.ttft_p95}`.padEnd(13)} ${`${row.first_sentence_p50}/${row.first_sentence_p95}`.padEnd(13)} ${String(row.errors).padEnd(6)} ${row.expected_tool}`);
  return row;
});

const dir = fileURLToPath(new URL("./results/", import.meta.url));
mkdirSync(dir, { recursive: true });
const file = `${dir}llm-${new Date().toISOString().replace(/[:.]/g, "-")}${values.label ? `-${values.label}` : ""}.json`;
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), n, summary, samples }, null, 2));
console.log(`\nSalvo em ${file}`);
