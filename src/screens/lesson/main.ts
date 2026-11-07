// Aula no quadro: a Puca explica "o caminho de uma transação" e o quadro vai se montando
// junto com a fala. A pessoa pode perguntar a qualquer momento pelo chat,
// e pausar pela barra de call.
// Por enquanto a fala é simulada (texto dos dados da aula, palavra por palavra).
import "../../styles/base.css";
import "./style.css";
import { mountAppHeader } from "../../components/app-header/app-header";
import { mountWhiteboard } from "../../components/whiteboard/whiteboard";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual } from "../../lib/agent-visual";
import { activeProfile, company, transactionPath, type LessonBeat } from "../../data";
import { esc, qs } from "../../lib/dom";

const lesson = transactionPath;
const profile = activeProfile();
const buddy = company.people[profile.buddyId];

// ---- Montagem da tela ----
mountAppHeader({ current: "lesson", profile });
const board = mountWhiteboard(qs(document, "#board"), lesson);
const chat = mountChatPanel({ title: "Transcrição da aula", messages: [] });
mountCallBar({ chat, draggable: false }); // sem status: a legenda já mostra o que está acontecendo
// a Puca aparece na "câmera" do canto, como numa videochamada
const cam = mountAgentCam({ name: "Puca", visual: await loadAgentVisual() });

const el = {
  caption: qs(document, "#caption"),
  timer: qs(document, "#timer"),
  liveDot: qs(document, "#live-dot"),
  sectionCount: qs(document, "#section-count"),
  voice: qs(document, "#voice"),
};

qs(document, "#lesson-name").textContent = lesson.title;

// ---- Estado da aula ----
const state = { paused: false, ended: false, seconds: 0, done: false, section: 0 };
const questions: string[] = []; // perguntas do chat, respondidas entre um trecho e outro

function renderSection(): void {
  el.sectionCount.textContent = state.done
    ? "aula completa"
    : `${state.section + 1} de ${lesson.sections.length} trechos`;
}

type Voice = "talk" | "listen" | "paused";
function setVoice(v: Voice): void {
  const shown: Voice = state.paused || state.ended ? "paused" : v;
  el.voice.dataset.state = shown;
  el.voice.setAttribute("aria-label", state.ended ? "Aula pausada" : state.paused ? "Puca pausada" : shown === "talk" ? "Puca falando" : "Puca ouvindo");
  el.liveDot.classList.toggle("is-off", state.paused || state.ended);
  // câmera acompanha: fala, quieta ouvindo, apagada pausada
  cam.setPaused(state.paused || state.ended);
  if (shown !== "paused") cam.setState(shown === "talk" ? "talk" : "idle");
}

/** Compara perguntas ignorando acento, maiúsculas e pontuação. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
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

// ---- Perguntas pelo chat (interrompem a aula entre um trecho e outro) ----
async function answer(question: string): Promise<void> {
  board.showOwners(false);
  const known = lesson.questions.find((q) => normalize(q.question) === normalize(question));
  el.caption.innerHTML = `<span class="caption__you">Você: ${esc(question)}</span>`;
  cam.setState("think"); // pensa (esquenta) antes de responder
  await wait(1200);
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
  await wait(1500);
  board.showOwners(false);
}

async function answerPending(): Promise<void> {
  while (questions.length) {
    const q = questions.shift();
    if (q) await answer(q);
  }
}

document.addEventListener("chatpanel:send", (e) => {
  questions.push(e.detail.text);
  if (state.done) void answerPending();
});

// ---- Barra de call ----
document.addEventListener("callbar:pause", (e) => {
  state.paused = !!e.detail.on;
  setVoice(state.paused ? "paused" : "listen");
});
document.addEventListener("callbar:end", () => {
  state.ended = true;
  setVoice("paused");
  cam.hide();
});
document.addEventListener("callbar:start", () => {
  state.ended = false;
  setVoice("listen");
  cam.show();
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
      await answerPending();
      await say(beat);
      await wait(1300);
    }
  }
  await answerPending();
  state.done = true;
  renderSection();
}

void run();
