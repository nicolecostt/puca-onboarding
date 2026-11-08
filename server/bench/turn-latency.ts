// Benchmark de turno: quanto a pessoa espera até a Puca começar a responder, por caminho.
// Usa a mesma ordem de decisão da tela (src/journey/route.ts). Caminhos locais rodam no browser
// (aqui, medidos em processo); "ask" vai ao servidor por HTTP de verdade.
// Uso: npm run bench:turn -- [--tts] [--label x] [--url https://orbis-puca.fly.dev] [--token <jwt>]
//   --tts mede também o 1º byte de áudio (gasta cota do ElevenLabs nas frases do LLM).
//   --url mede um servidor já no ar (ex.: comparar regiões do Fly) em vez de subir um aqui; o token do Supabase
//   vem de --token ou de PUCA_TOKEN.
import { mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import "../src/env";
import { buildApp, loadDemoJourney, tryCreateTts } from "../src/app";
import { buildFaqs } from "../../src/journey/faq";
import { DEMO_PROFILES } from "../../src/journey/profile";
import { routeUtterance } from "../../src/journey/route";

const { values } = parseArgs({
  options: { tts: { type: "boolean", default: false }, label: { type: "string", default: "" }, url: { type: "string" }, token: { type: "string" } },
});
const journey = loadDemoJourney();
const profile = DEMO_PROFILES.novo;
const faqs = buildFaqs(journey, profile);
const app = values.url ? null : buildApp({ journey, tts: values.tts ? tryCreateTts() : null, verificaToken: null });
if (app) await app.listen({ port: 0, host: "127.0.0.1" });
const base = app ? `http://127.0.0.1:${(app.server.address() as AddressInfo).port}` : values.url!.replace(/\/+$/, "");
const token = values.token ?? process.env.PUCA_TOKEN;
const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

// Falas reais de quem está numa sessão, cada uma no ponto da jornada onde costuma aparecer.
const script: { moment: string; step: string; text: string }[] = [
  { moment: "empresa-e-cultura", step: "ec-pergunta", text: "O que é ser dono do problema?" },
  { moment: "empresa-e-cultura", step: "ec-pergunta", text: "pode seguir" },
  { moment: "seu-time", step: "st-pergunta", text: "Qual a diferença entre gestor e buddy?" },
  { moment: "seu-time", step: "st-pergunta", text: "beleza, ficou claro" },
  { moment: "pagamentos", step: "pg-pergunta", text: "E se a liquidação falhar?" },
  { moment: "pagamentos", step: "pg-pergunta", text: "Quem cuida do authorizer?" },
  { moment: "pagamentos", step: "pg-pergunta", text: "me explica o settlement-worker" },
  { moment: "pagamentos", step: "pg-pergunta", text: "quero ver a primeira tarefa" },
  { moment: "pagamentos", step: "pg-pergunta", text: "e se der ruim na hora de cobrar o cartão, o que rola?" },
  { moment: "pagamentos", step: "pg-pergunta", text: "Quanto ganha um engenheiro pleno aqui?" },
  { moment: "pagamentos", step: "pg-pergunta", text: "a gente usa kafka ou rabbit nessa fila?" },
  { moment: "falha", step: "fa-pergunta", text: "isso já aconteceu em produção alguma vez?" },
  { moment: "encerramento", step: "en-pergunta", text: "terminar por hoje" },
];

interface Row {
  text: string;
  route: string;
  /** Até a Puca começar a responder: decisão local, ou a ponte do /api/ask. */
  first_response_ms: number;
  first_audio_byte_ms: number | null;
  llm_first_sentence_ms: number | null;
  said: string;
}
const rows: Row[] = [];

for (const s of script) {
  const moment = journey.moments.find((m) => m.id === s.moment)!;
  const step = moment.steps.find((x) => x.id === s.step)!;
  const board = (() => {
    for (let i = journey.moments.indexOf(moment); i >= 0; i--) {
      const v = journey.moments[i].view;
      if (v) return v.mode === "board" ? v.board : null;
    }
    return null;
  })();
  const t0 = performance.now();
  const route = routeUtterance(s.text, { journey, moment, step, waiting: { kind: "reply", replies: step.suggested_replies ?? [] }, board, faqs });
  const localMs = performance.now() - t0;

  if (route.kind !== "ask") {
    const said = route.kind === "knowledge" ? route.text : route.kind === "faq" ? route.faq.text : route.kind === "reply" ? `(segue: ${route.reply})` : route.kind === "jump" ? `(pula: ${route.moment.title})` : route.kind;
    rows.push({ text: s.text, route: route.kind, first_response_ms: Math.round(localMs * 100) / 100, first_audio_byte_ms: null, llm_first_sentence_ms: null, said });
  } else {
    const a0 = performance.now();
    const res = await fetch(`${base}/api/ask`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ text: s.text, moment_id: s.moment, step_id: s.step, perfil: "novo" }) });
    if (!res.ok || !res.body) throw new Error(`/api/ask respondeu ${res.status}: ${await res.text()}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    let first: number | null = null;
    let firstAudio: Promise<number | null> = Promise.resolve(null);
    let llmFirst: number | null = null;
    const said: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const ev = JSON.parse(buf.slice(6, i));
        buf = buf.slice(i + 2);
        if (ev.type === "speak") {
          first ??= performance.now() - a0;
          said.push(`[${ev.source}] ${ev.text}`);
          if (ev.source === "llm") llmFirst ??= performance.now() - a0;
          if (ev.audio_url && said.length === 1) {
            firstAudio = fetch(base + ev.audio_url, { headers: auth }).then(async (r) => {
              const rd = r.body!.getReader();
              await rd.read();
              void rd.cancel();
              return performance.now() - a0;
            });
          }
        }
        if (ev.type === "go_to") said.push(`(go_to ${ev.target})`);
      }
    }
    const fa = await firstAudio;
    rows.push({ text: s.text, route: "ask", first_response_ms: Math.round(first ?? -1), first_audio_byte_ms: fa && Math.round(fa), llm_first_sentence_ms: llmFirst && Math.round(llmFirst), said: said.join(" ") });
  }
  const r = rows.at(-1)!;
  console.log(`${r.route.padEnd(9)} resposta=${String(r.first_response_ms).padStart(6)}ms áudio=${r.first_audio_byte_ms ?? "-"} llm1ªfrase=${r.llm_first_sentence_ms ?? "-"} | ${s.text} → ${r.said.replace(/\s+/g, " ").slice(0, 120)}`);
}

const p = (xs: number[], q: number) => (xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] * 100) / 100 : null);
const firsts = rows.map((r) => r.first_response_ms);
const asks = rows.filter((r) => r.route === "ask");
const summary = {
  turns: rows.length,
  local: rows.length - asks.length,
  ask: asks.length,
  first_response_p50: p(firsts, 0.5),
  first_response_p95: p(firsts, 0.95),
  first_audio_byte_p50: p(asks.map((r) => r.first_audio_byte_ms).filter((x): x is number => x != null), 0.5),
  llm_first_sentence_p50: p(asks.map((r) => r.llm_first_sentence_ms).filter((x): x is number => x != null), 0.5),
};
console.log("\nResumo:", JSON.stringify(summary, null, 2));
const dir = fileURLToPath(new URL("./results/", import.meta.url));
mkdirSync(dir, { recursive: true });
const file = `${dir}turn-${new Date().toISOString().replace(/[:.]/g, "-")}${values.label ? `-${values.label}` : ""}.json`;
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), url: values.url ?? "local", summary, rows }, null, 2));
console.log(`Salvo em ${file}`);
await app?.close();
process.exit(0);
