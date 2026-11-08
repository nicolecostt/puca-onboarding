// Início da plataforma: trilha de progresso, perfil, tarefas (à esquerda) e ferramentas com o estado
// de cada acesso (à direita). Ao abrir, a Puca confere os acessos: o que falta ela pede ao gestor no Slack
// (simulado nesta tela) e avisa a pessoa. No canto, "Ligar para a Puca" abre a câmera dela, com voz e chat.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual } from "../../lib/agent-visual";
import { esc, qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { mountPucaDots } from "../../lib/puca-dots";
import { activeProfile, company } from "../../data";
import { resolveProfile } from "../../journey/profile";
import { normalize } from "../../journey/conditions";
import { browserStore } from "../../journey/storage";
import { createOutbox } from "../../journey/forwarding";
import { createAgentVoice } from "../../voice/agent-voice";
import { TASKS, TOOLS, TRAIL, type AccessStatus, type TaskState, type Tool } from "./data";

// ---- Quem é a pessoa: o que a call inicial salvou, completado pelo perfil da demo ----
const demo = activeProfile();
const { profile } = resolveProfile(location.search);
const gestor = profile.gestor || company.people[demo.managerId]?.name || "";
const buddy = company.people[demo.buddyId]?.name ?? "sua buddy";
const time = profile.time || demo.toTeam;
const cargo = profile.cargo || demo.role;
const vindoDe = profile.vinculo === "transicao" ? demo.fromTeam : undefined;

const CHECK = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const mark = (state: TaskState | AccessStatus) => {
  const kind = state === "done" || state === "ok" ? "done" : state;
  return `<span class="mark mark--${kind}" aria-hidden="true">${kind === "done" ? CHECK : ""}</span>`;
};

// ---- Topo, trilha e perfil ----
qs(document, "#me-name").textContent = demo.name;
qs(document, "#me-initials").textContent = demo.initials;
qs(document, "#trail-label").textContent = `Processo de ${profile.nome}`;
qs(document, "#trail").innerHTML = TRAIL.map(
  (s) =>
    `<li class="trail__step is-${s.state}"${s.state === "now" ? ' aria-current="step"' : ""}><span class="trail__pill">${mark(s.state)}${esc(s.label)}</span></li>`,
).join("");

qs(document, "#initials").textContent = demo.initials;
qs(document, "#name").textContent = demo.name;
qs(document, "#role").textContent = `${cargo} · time ${time}`;
const meta: [string, string][] = [
  ["Gestor", gestor],
  ["Buddy", buddy],
  ...(vindoDe ? ([["Vindo de", vindoDe]] as [string, string][]) : []),
];
qs(document, "#meta").innerHTML = meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

// ---- Tarefas ----
const STATE_LABEL: Record<TaskState, string> = { done: "Concluída", now: "Agora", next: "Depois" };
qs(document, "#tasks").innerHTML = TASKS.map(
  (t) => `
  <li class="task is-${t.state}">
    ${mark(t.state)}
    <div>
      <p class="task__title"><span class="sr-only">${STATE_LABEL[t.state]}: </span>${esc(t.title)}</p>
      <p class="task__detail">${esc(t.detail)}</p>
      ${t.action ? `<a class="task__action" href="${t.action.href}">${esc(t.action.label)}</a>` : ""}
    </div>
  </li>`,
).join("");

// ---- Ferramentas e acessos ----
const tools: Tool[] = TOOLS.map((t) => ({ ...t }));
const ACCESS_LABEL: Record<AccessStatus, string> = { ok: "Com acesso", pending: "Aguardando", missing: "Sem acesso" };
function renderTools(changed?: string): void {
  qs(document, "#tools").innerHTML = tools
    .map(
      (t) => `
    <li class="tool${t.id === changed ? " is-changed" : ""}">
      <div>
        <p class="tool__name">${esc(t.name)}</p>
        <p class="tool__use">${esc(t.use)}${t.status === "pending" ? ` · pedido a ${esc(gestor)}` : ""}</p>
      </div>
      <span class="access access--${t.status}">${mark(t.status)}${ACCESS_LABEL[t.status]}</span>
    </li>`,
    )
    .join("");
}
renderTools();

// A Puca confere os acessos ao abrir: o que falta vira pedido ao gestor no Slack e um aviso aqui.
let lastNotice = "";
function checkAccess(): void {
  const missing = tools.filter((t) => t.status === "missing");
  if (!missing.length) return;
  for (const t of missing) t.status = "pending";
  const names = missing.map((t) => t.name).join(" e ");
  lastNotice = `Você ainda não tinha acesso ao ${names}. Pedi para ${gestor} no Slack e te aviso quando liberar.`;
  qs(document, "#notice-text").innerHTML = `Você ainda não tinha acesso ao <b>${esc(names)}</b>. Pedi para ${esc(gestor)} no Slack e te aviso quando liberar.`;
  qs(document, "#notice").hidden = false;
  renderTools(missing[0].id);
}

mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: ".topbar__row > *, .trail__row > *, .profile, .tasks, .tools, .agent-cam, .call-dock, .chat-panel",
  max: 36,
});

// ---- Puca: câmera no canto, barra presa embaixo dela e chat ----
async function main(): Promise<void> {
  const factory = await loadAgentVisual();
  window.setTimeout(() => {
    checkAccess();
    mountPucaDots(qs(document, "#notice-orb"));
  }, 1400);

  const chat = mountChatPanel({ title: "Puca", messages: [] });
  const cam = mountAgentCam({ name: "Puca", visual: factory });
  const bar = mountCallBar({ chat, attachTo: cam });
  // começa desligada: no canto fica só "Ligar para a Puca"
  cam.hide();
  bar.end();

  const voice = await createAgentVoice();
  const outbox = createOutbox(browserStore());
  let inCall = false;
  let muted = false;
  let listening = false;

  async function say(text: string): Promise<void> {
    chat.addMessage({ from: "agent", text });
    if (!inCall) return;
    cam.setState("talk");
    await voice.speak(text).catch(() => undefined);
    if (inCall) cam.setState("idle");
  }

  async function reply(question: string): Promise<void> {
    cam.setState("think");
    await new Promise((r) => setTimeout(r, 500));
    await say(answer(question));
  }

  // fala da pessoa pelo chat
  document.addEventListener("chatpanel:send", (e) => {
    const text = e.detail.text.trim();
    if (text) void reply(text);
  });

  document.addEventListener("callbar:start", async () => {
    inCall = true;
    cam.show(); // o chat começa fechado: abre pelo botão da barra
    window.setTimeout(() => cam.sync(), 300); // reposiciona o chat depois que a câmera termina de aparecer
    // o navegador só libera áudio e microfone depois de um clique: libera sem segurar a conversa
    await Promise.race([voice.unlock().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
    if (voice.stt && !listening) {
      listening = true;
      void voice.listen((text) => {
        if (!inCall || muted || !text.trim()) return;
        chat.addMessage({ from: "user", text });
        void reply(text);
      }).catch(() => {
        listening = false; // sem microfone (ou sem permissão): a conversa segue pelo chat
      });
    }
    await say(
      lastNotice
        ? `Oi, ${profile.nome}! ${lastNotice} Quer falar sobre suas tarefas ou tirar alguma dúvida?`
        : `Oi, ${profile.nome}! Quer falar sobre suas tarefas ou tirar alguma dúvida?`,
    );
  });
  document.addEventListener("callbar:end", () => {
    inCall = false;
    voice.stop();
    cam.setState("idle");
    cam.hide();
  });
  document.addEventListener("callbar:mute", (e) => {
    muted = !!e.detail.on;
    voice.setMuted(muted);
  });
  document.addEventListener("callbar:pause", (e) => {
    cam.setPaused(!!e.detail.on);
    if (e.detail.on) voice.stop();
  });

  /** Respostas da Puca no início: só o que esta tela sabe (acessos, tarefas, pessoas).
   *  Sem fonte confiável, não inventa: encaminha à buddy (PRODUCT.md §4.5). */
  function answer(question: string): string {
    const q = normalize(question);
    const tool = tools.find((t) => q.includes(normalize(t.name)) || q.includes(t.id));
    if (tool) {
      if (tool.status === "ok") return `Você já tem acesso ao ${tool.name}. Ele serve para: ${tool.use.toLowerCase()}.`;
      return `O acesso ao ${tool.name} está aguardando. Pedi para ${gestor} no Slack e te aviso quando liberar.`;
    }
    if (/acess/.test(q)) {
      const waiting = tools.filter((t) => t.status !== "ok").map((t) => t.name);
      return waiting.length
        ? `Faltam ${waiting.join(" e ")}. Já pedi para ${gestor} no Slack; o resto está liberado.`
        : "Você já tem acesso a todas as ferramentas do time.";
    }
    if (/tarefa|ticket|firmware/.test(q)) {
      const first = TASKS.find((t) => t.title.startsWith("Primeira tarefa"));
      return `${first?.title}. ${first?.detail} Ela fica liberada depois da sua primeira sessão.`;
    }
    if (/sessao|aula|quadro|comecar/.test(q)) {
      return "Sua primeira sessão mostra o caminho de uma transação, o que acontece quando falha e quem cuida de cada parte. É só clicar em Começar a sessão.";
    }
    if (/buddy|paula/.test(q)) return `Sua buddy é ${buddy}. Ela te acompanha nas primeiras semanas e é para quem eu levo as dúvidas que eu não consigo confirmar.`;
    if (/gestor|marcos|chefe/.test(q)) return `Seu gestor é ${gestor}, do time ${time}.`;
    if (/^(oi|ola|bom dia|boa tarde|boa noite)\b|obrigad/.test(q)) return "Estou por aqui. Pode perguntar sobre seus acessos, suas tarefas ou o time.";
    outbox.add({
      question,
      summary: question,
      reason: "No início da plataforma, a Puca não tem fonte confirmada sobre isso.",
      to: { name: buddy, role: "buddy" },
      pessoa: profile.nome,
      consulted: ["Acessos e tarefas do início"],
      moment: null,
    });
    return `Não encontrei uma fonte confirmada sobre isso. Levei sua dúvida para ${buddy}, sua buddy, no Slack, com o contexto.`;
  }
}

void main();
