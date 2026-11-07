// Aula no quadro: a Puca explica "o caminho de uma transação" e o quadro vai se montando
// junto com a fala. A pessoa pode perguntar a qualquer momento (sugestões ou chat),
// pedir "mais fundo" / "mais simples" e pausar pela barra de call.
// Por enquanto a fala é simulada (texto dos dados da aula, palavra por palavra).
import "../../styles/base.css";
import "./style.css";
import { mountAppHeader } from "../../components/app-header/app-header";
import { mountWhiteboard } from "../../components/whiteboard/whiteboard";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { activeProfile, company, transactionPath, type LessonBeat } from "../../data";
import { esc, qs, targetEl } from "../../lib/dom";

const lesson = transactionPath;
const profile = activeProfile();
const buddy = company.people[profile.buddyId];

// ---- Montagem da tela ----
mountAppHeader({ current: "lesson", profile });
const board = mountWhiteboard(qs(document, "#board"), lesson);
const chat = mountChatPanel({ title: "Transcrição da aula", messages: [] });
mountCallBar({ chat }); // sem status: a legenda já mostra o que está acontecendo

const el = {
  caption: qs(document, "#caption"),
  timer: qs(document, "#timer"),
  liveDot: qs(document, "#live-dot"),
  sectionCount: qs(document, "#section-count"),
  voice: qs(document, "#voice"),
  voiceLabel: qs(document, "#voice-label"),
  askList: qs(document, "#ask-list"),
  textToggle: qs<HTMLButtonElement>(document, '[data-tweak="text"]'),
};

qs(document, "#lesson-name").textContent = lesson.title;
qs(document, "#calib-count").textContent = `${profile.calibration.length} respostas`;
qs(document, "#calib-list").innerHTML = profile.calibration
  .map(
    (c) => `<div class="calib__row"><dt>${esc(c.label)}</dt>
      <dd><span class="chip${c.tone === "neutral" ? "" : ` chip--${c.tone}`}">${esc(c.value)}</span></dd></div>`,
  )
  .join("");
el.askList.innerHTML = lesson.questions
  .map((q, i) => `<button class="pill" data-question="${i}">${esc(q.question)}</button>`)
  .join("");

// ---- Estado da aula ----
const state = { paused: false, ended: false, seconds: 0, done: false, section: 0 };
type Interrupt = { kind: "question"; index: number } | { kind: "custom"; question: string } | { kind: "deeper" | "simpler" };
const interrupts: Interrupt[] = [];

function renderSection(): void {
  el.sectionCount.textContent = state.done
    ? "aula completa"
    : `${state.section + 1} de ${lesson.sections.length} trechos`;
}

type Voice = "talk" | "listen" | "paused";
function setVoice(v: Voice): void {
  const shown: Voice = state.paused || state.ended ? "paused" : v;
  el.voice.dataset.state = shown;
  el.voiceLabel.textContent =
    state.ended ? "Aula pausada" : state.paused ? "Puca pausada" : shown === "talk" ? "Puca falando" : "Puca ouvindo";
  el.liveDot.classList.toggle("is-off", state.paused || state.ended);
}

// Espera que só corre com a aula ativa (pausar segura o tempo)
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    let left = ms;
    const t = setInterval(() => {
      if (state.paused || state.ended) return;
      left -= 50;
      if (left <= 0) {
        clearInterval(t);
        resolve();
      }
    }, 50);
  });
}

setInterval(() => {
  if (state.paused || state.ended || state.done) return;
  state.seconds++;
  el.timer.textContent = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(state.seconds % 60).padStart(2, "0")}`;
}, 1000);

/** Legenda até onde já foi falado, com o trecho de destaque marcado (se já chegou nele). */
function captionHTML(full: string, spokenLength: number, highlight?: string): string {
  const spoken = full.slice(0, spokenLength);
  const from = highlight ? full.indexOf(highlight) : -1;
  if (from < 0 || from >= spoken.length) return esc(spoken);
  const to = Math.min(spoken.length, from + (highlight?.length ?? 0));
  return `${esc(spoken.slice(0, from))}<mark>${esc(spoken.slice(from, to))}</mark>${esc(spoken.slice(to))}`;
}

/** O agente fala um trecho: legenda palavra por palavra, quadro acompanha. */
async function say(beat: LessonBeat, toChat = true): Promise<void> {
  setVoice("talk");
  if (beat.reveal) board.reveal(beat.reveal);
  if (beat.focus !== undefined) board.setFocus(beat.focus);
  const words = beat.say.split(" ");
  for (let i = 0; i < words.length; i++) {
    const spokenLength = words.slice(0, i + 1).join(" ").length;
    el.caption.innerHTML = captionHTML(beat.say, spokenLength, beat.highlight);
    await wait(150);
  }
  if (toChat) chat.addMessage({ from: "agent", text: beat.say });
  setVoice("listen");
}

// ---- Perguntas e ajustes (interrompem a aula entre um trecho e outro) ----
async function handleInterrupt(it: Interrupt): Promise<void> {
  board.showOwners(false);
  if (it.kind === "question" || it.kind === "custom") {
    const known =
      it.kind === "question"
        ? lesson.questions[it.index]
        : lesson.questions.find((q) => q.question.toLowerCase() === it.question.toLowerCase().replace(/\?*$/, "?"));
    const question = it.kind === "question" ? lesson.questions[it.index].question : it.question;
    el.caption.innerHTML = `<span class="caption__you">Você: ${esc(question)}</span>`;
    await wait(900);
    if (known) {
      if (/dono/.test(known.question)) board.showOwners(true);
      await say({ say: known.answer, focus: known.focus ?? null });
    } else {
      // sem fonte confiável: deixa claro e encaminha para uma pessoa (contexto 4.5)
      await say({
        say: `Boa pergunta. Não achei isso confirmado na documentação, então não quero chutar. Vou anotar e perguntar para ${buddy?.name ?? "sua buddy"}, que é sua buddy, e te aviso.`,
        highlight: "Não achei isso confirmado na documentação",
        focus: null,
      });
    }
  } else {
    const list = it.kind === "deeper" ? lesson.deeper : lesson.simpler;
    await say({ say: list[Math.min(state.section, list.length - 1)] });
  }
  await wait(1500);
  board.showOwners(false);
}

async function drainInterrupts(): Promise<void> {
  while (interrupts.length) {
    const it = interrupts.shift();
    if (it) await handleInterrupt(it);
  }
}

el.askList.addEventListener("click", (e) => {
  const btn = targetEl(e)?.closest<HTMLButtonElement>("[data-question]");
  if (!btn || btn.disabled) return;
  btn.disabled = true; // cada sugestão uma vez
  const index = Number(btn.dataset.question);
  chat.addMessage({ from: "user", text: lesson.questions[index].question });
  interrupts.push({ kind: "question", index });
  if (state.done) void drainInterrupts();
});

document.addEventListener("chatpanel:send", (e) => {
  interrupts.push({ kind: "custom", question: e.detail.text });
  if (state.done) void drainInterrupts();
});

document.querySelector(".tweaks")?.addEventListener("click", (e) => {
  const btn = targetEl(e)?.closest<HTMLButtonElement>("[data-tweak]");
  if (!btn) return;
  const tweak = btn.dataset.tweak;
  if (tweak === "text") {
    chat.toggle(); // "texto": abre a transcrição para ler e escrever
    return;
  }
  if (tweak === "deeper" || tweak === "simpler") {
    interrupts.push({ kind: tweak });
    if (state.done) void drainInterrupts();
  }
});
document.addEventListener("chatpanel:change", (e) => el.textToggle.setAttribute("aria-pressed", String(e.detail.open)));

// ---- Barra de call ----
document.addEventListener("callbar:pause", (e) => {
  state.paused = !!e.detail.on;
  setVoice(state.paused ? "paused" : "listen");
});
document.addEventListener("callbar:end", () => {
  state.ended = true;
  setVoice("paused");
});
document.addEventListener("callbar:start", () => {
  state.ended = false;
  setVoice("listen");
});

// ---- Aula ----
async function run(): Promise<void> {
  renderSection();
  setVoice("listen");
  await wait(800);
  for (let s = 0; s < lesson.sections.length; s++) {
    state.section = s;
    renderSection();
    for (const beat of lesson.sections[s].beats) {
      await drainInterrupts();
      await say(beat);
      await wait(1300);
    }
  }
  await drainInterrupts();
  state.done = true;
  renderSection();
}

void run();
