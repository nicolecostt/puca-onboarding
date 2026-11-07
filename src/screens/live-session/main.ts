// Tela de auxílio (sessão ao vivo): barra de call, chat e câmera do agente por cima de uma tela qualquer.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import type { CallBarAction } from "../../lib/events";
import { qs } from "../../lib/dom";

async function main(): Promise<void> {
  const chat = mountChatPanel();
  mountCallBar({ status: "Clicking “Compare plans”…", chat });
  const cam = mountAgentCam({ name: "Iris", visual: await loadAgentVisual() });

  // Simula a Iris conversando: fala por um tempo, faz uma pausa, às vezes pensa
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
  });
  document.addEventListener("callbar:end", () => {
    ended = true;
    cam.setState("idle");
    cam.hide();
  });
  document.addEventListener("callbar:start", () => {
    ended = false;
    cam.show();
  });

  // mostra o último evento da barra na tela
  const log = qs(document, "#log");
  const actions: CallBarAction[] = ["pause", "control", "mute", "chat", "end", "start"];
  for (const a of actions) {
    document.addEventListener(`callbar:${a}`, (e) => {
      log.textContent = `callbar:${a}` + (e.detail.on !== undefined ? ` → ${e.detail.on}` : "");
    });
  }
}

void main();
