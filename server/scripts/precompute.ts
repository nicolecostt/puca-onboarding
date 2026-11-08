// Gera antes da sessão o áudio de tudo o que é previsível (falas da jornada × perfis de demo, FAQ dos nós,
// pontes). Fica no cache de TTS por hash do texto; em runtime o mesmo texto sai do disco em ~0 ms.
// Uso: npm run precompute [-- --only pontes|faq|roteiro] [--dry]
// Free tier do ElevenLabs = 10k caracteres/mês: rode --dry para ver o custo antes.
import { parseArgs } from "node:util";
import "../src/env";
import { allScriptedTexts, BRIDGES, FALLBACK_LINE } from "../src/agent/bridges";
import { buildFaqs } from "../../src/journey/faq";
import { loadDemoJourney, tryCreateTts } from "../src/app";
import { DEMO_PROFILES } from "../../src/journey/profile";

const { values } = parseArgs({ options: { only: { type: "string" }, dry: { type: "boolean", default: false } } });
const journey = loadDemoJourney();
const profiles = Object.values(DEMO_PROFILES);
const pontes = [...Object.values(BRIDGES).flat(), FALLBACK_LINE];
const faq = profiles.flatMap((p) => buildFaqs(journey, p).map((f) => f.text));
const all = profiles.flatMap((p) => allScriptedTexts(journey, p));
const pick = { pontes, faq, roteiro: all.filter((t) => !pontes.includes(t) && !faq.includes(t)) }[values.only as "pontes" | "faq" | "roteiro"] ?? all;
const texts = [...new Set(pick)];
console.log(`${texts.length} textos, ${texts.join("").length} caracteres.`);
if (values.dry) process.exit(0);
const tts = tryCreateTts();
if (!tts) {
  console.log(`${texts.length} textos previsíveis. Defina ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID em server/.env para gerar o áudio.`);
  process.exit(0);
}

let cached = 0;
let made = 0;
let failed = 0;
const CONCURRENCY = 3;
const queue = [...texts];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async (_, w) => {
    for (let text = queue.shift(); text; text = queue.shift()) {
      try {
        const r = await tts.start({ action_id: `pre-${w}-${made + cached + failed}`, text });
        if (r.cached) cached++;
        else made++;
      } catch (e) {
        failed++;
        console.error(`falhou: ${text.slice(0, 60)} — ${String(e).slice(0, 100)}`);
      }
    }
  }),
);
tts.cancelAll();
console.log(`${texts.length} textos: ${made} gerados, ${cached} já estavam no cache, ${failed} falharam.`);
