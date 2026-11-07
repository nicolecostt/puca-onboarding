// Tela de auxílio (sessão ao vivo): barra de call, chat e câmera da Puca por cima de outra ferramenta.
// A tela inteira imita o Slack (tema claro) com os dados da Tail; o conteúdo está no index.html.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { mountAgentCursor } from "../../components/agent-cursor/agent-cursor";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { createOutbox, FORWARDING_KEY, forwardingMessage } from "../../journey/forwarding";
import { browserStore } from "../../journey/storage";
import { uid } from "../../journey/uid";
import { clearComposer, findDm, openDm, postMessage, typeInComposer } from "./slack-dm";

const BUDDY_ACK = "Vi aqui, te respondo já.";
const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit" }).replace(":", "h");
const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

async function main(): Promise<void> {
  const chat = mountChatPanel();
  const cam = mountAgentCam({ name: "Puca", visual: await loadAgentVisual() });
  mountCallBar({ chat, attachTo: cam }); // barra presa embaixo da câmera; sem status por cima do Slack
  const cursor = mountAgentCursor();

  // Simula a Puca conversando: fala por um tempo, faz uma pausa, às vezes pensa
  const script: [AgentVisualState, number][] = [
    ["talk", 3200], ["idle", 1600], ["talk", 2400], ["think", 1800], ["talk", 3000], ["idle", 2200],
  ];
  let step = 0, paused = false, ended = false;
  (function next() {
    const [s, ms] = script[step++ % script.length];
    if (!paused && !ended) cam.setState(s);
    setTimeout(next, ms);
  })();
  document.addEventListener("callbar:pause", (e) => {
    paused = !!e.detail.on;
    cam.setPaused(paused);
    cursor.setPaused(paused || ended);
  });
  document.addEventListener("callbar:end", () => {
    ended = true;
    cam.setState("idle");
    cam.hide();
    cursor.setPaused(true);
    cursor.hide();
  });
  document.addEventListener("callbar:start", () => {
    ended = false;
    cam.show();
    cursor.show();
    cursor.setPaused(paused);
  });

  // Encaminhamentos que a aula deixou para a buddy (#28): a Puca abre a DM, digita e envia.
  // "enviando" antes da animação: outra aba do Slack, ou um recarregar, não manda de novo.
  const outbox = createOutbox(browserStore());
  const tab = uid();
  let sending = false;
  async function sendPending(): Promise<void> {
    if (sending) return;
    sending = true;
    try {
      for (let f = outbox.pending(tab)[0]; f; f = outbox.pending(tab)[0]) {
        outbox.claim(f.id, tab);
        // a outra aba pode ter pegado no mesmo instante: espera as duas escreverem e fica quem ganhou
        await new Promise((r) => setTimeout(r, 150));
        if (outbox.ownerOf(f.id) !== tab) continue;
        const dm = findDm(f.to.name);
        if (dm) {
          await cursor.moveTo(dm);
          await cursor.click();
        }
        openDm(f.to.name);
        const text = forwardingMessage(f);
        await typeInComposer(text, cursor);
        const send = document.querySelector(".sk-composer__send");
        if (send) {
          await cursor.moveTo(send);
          await cursor.click();
        }
        clearComposer(f.to.name);
        postMessage({ author: "Puca", avatar: "P", tone: "puca", text, time: now() });
        outbox.setStatus(f.id, "enviado");
        // a buddy confirma antes da próxima dúvida sair: a conversa fica na ordem
        await new Promise((r) => setTimeout(r, 3000));
        postMessage({ author: f.to.name, avatar: initials(f.to.name), tone: "blue", text: BUDDY_ACK, time: now() });
        outbox.setStatus(f.id, "confirmado");
      }
    } finally {
      sending = false;
    }
  }
  addEventListener("storage", (e) => {
    if (e.key === FORWARDING_KEY) void sendPending();
  });
  await sendPending();

  // Cursor da Puca mexendo no Slack (simulado): abre o canal, mostra o link do README,
  // passa pelo cartão e vai até a busca. Repete em laço; para enquanto a Puca envia um encaminhamento,
  // e não volta mais depois de abrir uma DM (o tour é do canal).
  const pick = (sel: string) => document.querySelector(sel);
  const tour: { sel: string; click?: boolean; stay: number }[] = [
    { sel: ".sk-ch.is-current", click: true, stay: 900 },
    { sel: ".sk-link", click: true, stay: 1200 },
    { sel: ".sk-unfurl strong", stay: 1600 },
    { sel: ".sk-intro__btns span", stay: 900 },
    { sel: ".sk-top__search", click: true, stay: 1400 },
  ];
  for (let i = 0; ; i = (i + 1) % tour.length) {
    if (sending || document.querySelector(".sk-dm.is-current")) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const stop = tour[i];
    const el = pick(stop.sel);
    if (el) {
      await cursor.moveTo(el);
      if (stop.click) await cursor.click();
    }
    await new Promise((r) => setTimeout(r, stop.stay));
  }
}

void main();
