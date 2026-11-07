// Tela de auxílio (sessão ao vivo): barra de call, chat e câmera da Puca por cima de outra ferramenta.
// O fundo imita o Slack da Tail, com a Puca destacando a mensagem que a pessoa precisa ler.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { company } from "../../data";
import { esc, qs } from "../../lib/dom";

const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2);

async function main(): Promise<void> {
  const chat = mountChatPanel();
  mountCallBar({ status: "Mostrando a mensagem fixada do Lucas…", chat });
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

  // ---- Slack de mentira: canais, mensagens e a Puca apontando para o que importa ----
  const channels = [
    { name: "geral" },
    { name: "engenharia", unread: 3 },
    { name: "time-terminais", current: true },
    { name: "incidentes" },
    { name: "deploys", unread: 12 },
  ];
  const dms = ["paula", "lucas", "marcos"].map((id) => company.people[id]);
  qs(document, "#side").innerHTML = `
    <p class="mock-side__title">Canais</p>
    ${channels
      .map((c) => `<a class="mock-side__item${c.current ? " is-current" : ""}${c.unread ? " is-unread" : ""}"># ${esc(c.name)}${c.unread ? `<span class="mock-side__badge">${c.unread}</span>` : ""}</a>`)
      .join("")}
    <p class="mock-side__title">Mensagens diretas</p>
    ${dms.map((p) => `<a class="mock-side__item"><span class="mock-avatar mock-avatar--sm">${esc(initials(p.name))}</span>${esc(p.name)}</a>`).join("")}`;

  const messages: { who: string; time: string; text: string; pinned?: boolean; target?: boolean }[] = [
    { who: "marcos", time: "9:02", text: "Bom dia, time! Hoje a Paula começa a acompanhar quem chegou essa semana. 👋" },
    {
      who: "lucas",
      time: "9:41",
      text: "Pra quem está chegando: o README do <b>terminal-config-api</b> explica o fluxo de configuração das maquininhas. Começa por ele.",
      pinned: true,
      target: true,
    },
    { who: "paula", time: "10:15", text: "Lembrete: a retro é quinta às 16h. Deixem os pontos no quadro até quarta." },
    { who: "lucas", time: "11:03", text: "Subi a versão nova do <b>firmware-cdn-publisher</b>. Se alguma maquininha não pegar a configuração, me chamem aqui." },
  ];
  qs(document, "#msgs").innerHTML = messages
    .map((m) => {
      const p = company.people[m.who];
      return `<li class="mock-msg${m.target ? " is-target" : ""}">
        <span class="mock-avatar">${esc(initials(p.name))}</span>
        <div>
          <p class="mock-msg__meta"><strong>${esc(p.name)}</strong><span>${m.time}</span>${m.pinned ? `<span class="mock-msg__pin">📌 Fixada</span>` : ""}</p>
          <p class="mock-msg__text">${m.text}</p>
        </div>
      </li>`;
    })
    .join("");
}

void main();
