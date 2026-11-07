// Tela de auxílio (sessão ao vivo): barra de call, chat e câmera da Puca por cima de outra ferramenta.
// A tela inteira imita o Slack (tema claro) com os dados da Tail; o conteúdo está no index.html.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";

async function main(): Promise<void> {
  const chat = mountChatPanel();
  mountCallBar({ chat }); // sem status por cima do Slack
  const cam = mountAgentCam({ name: "Puca", visual: await loadAgentVisual() });

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
}

void main();
