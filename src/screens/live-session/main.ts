// Tela de auxílio (sessão ao vivo): barra de call, chat e câmera da Puca por cima de outra ferramenta.
// A tela inteira imita o Slack (tema claro) com os dados da Tail; o conteúdo está no index.html.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { mountAgentCursor } from "../../components/agent-cursor/agent-cursor";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";

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

  // Cursor da Puca mexendo no Slack (simulado): abre o canal, mostra o link do README,
  // passa pelo cartão e vai até a busca. Repete em laço.
  const pick = (sel: string) => document.querySelector(sel);
  const tour: { sel: string; click?: boolean; stay: number }[] = [
    { sel: ".sk-ch.is-current", click: true, stay: 900 },
    { sel: ".sk-link", click: true, stay: 1200 },
    { sel: ".sk-unfurl strong", stay: 1600 },
    { sel: ".sk-intro__btns span", stay: 900 },
    { sel: ".sk-top__search", click: true, stay: 1400 },
  ];
  for (let i = 0; ; i = (i + 1) % tour.length) {
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
