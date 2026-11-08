// Início do Orbis: progresso no topo, perfil, tarefas (à esquerda) e ferramentas com o estado de cada acesso
// (à direita). Ao abrir, a Puca confere os acessos e avisa o que falta (o pedido ao gestor ainda é simulado, #104).
// No canto, "Ligar para a Puca" abre a câmera dela, com voz e chat; cada fala passa por journey/route.ts.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual } from "../../lib/agent-visual";
import { esc, qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { mountPucaDots } from "../../lib/puca-dots";
import { company, profiles } from "../../data";
import { resolveProfile } from "../../journey/profile";
import { normalize } from "../../journey/conditions";
import { browserStore } from "../../journey/storage";
import { loadJourney } from "../../journey/validate";
import { routeUtterance, type Route } from "../../journey/route";
import { buildFaqs } from "../../journey/faq";
import { createTrail } from "../../journey/trail";
import { tarefaDaPessoa } from "../../journey/primeira-tarefa";
import demoJourney from "../../journey/data/kota.journey.json";
import { createAgentVoice, MIC_AVISO } from "../../voice/agent-voice";
import { TOOLS, TRAIL, tasksFor, type AccessStatus, type TaskState, type Tool } from "./data";

// ---- Quem é a pessoa: o que a call inicial salvou (ou o ?perfil=), completado pelo perfil da demo do mesmo vínculo ----
const { profile, source } = resolveProfile(location.search);
const base = profile.vinculo === "transicao" ? profiles.bruno : profiles.ana;
const nome = source === "entrevista" && profile.nome ? profile.nome : base.name;
const demo = { ...base, name: nome, initials: nome.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() };
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

// ---- Topo, progresso e perfil ----
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

// ---- Tarefas: a primeira tarefa é a do vínculo da pessoa (docs/contratos.md, Primeira tarefa) ----
const journey = loadJourney(demoJourney);
const tarefa = tarefaDaPessoa(journey, profile);
const tarefaNo = Object.values(journey.boards).flatMap((b) => b.nodes).find((n) => n.id === tarefa?.no);
const TASKS = tasksFor(tarefa, tarefaNo?.sublabel);
const STATE_LABEL: Record<TaskState, string> = { done: "Concluída", now: "Agora", next: "Depois" };
qs(document, "#tasks").innerHTML = TASKS.map(
  (t) => `
  <li class="task is-${t.state}">
    ${mark(t.state)}
    <div>
      <p class="task__title"><span class="sr-only">${STATE_LABEL[t.state]}: </span>${esc(t.title)}</p>
      <p class="task__detail">${esc(t.detail)}</p>
      ${t.action ? `<a class="task__action" href="${t.action.href}${esc(location.search)}">${esc(t.action.label)}</a>` : ""}
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
        <p class="tool__use">${esc(t.use)}${t.status === "pending" ? ` · quem libera: ${esc(gestor)}` : ""}</p>
      </div>
      <span class="access access--${t.status}">${mark(t.status)}${ACCESS_LABEL[t.status]}</span>
    </li>`,
    )
    .join("");
}
renderTools();

// A Puca confere os acessos ao abrir e avisa o que falta. Ela ainda não pede ao gestor de verdade (#104): não diz que pediu.
let lastNotice = "";
function checkAccess(): void {
  const missing = tools.filter((t) => t.status === "missing");
  if (!missing.length) return;
  for (const t of missing) t.status = "pending";
  const names = missing.map((t) => t.name).join(" e ");
  lastNotice = `Você ainda não tem acesso ao ${names}. Quem libera é ${gestor}; te aviso aqui quando chegar.`;
  qs(document, "#notice-text").innerHTML = `Você ainda não tem acesso ao <b>${esc(names)}</b>. Quem libera é ${esc(gestor)}; te aviso aqui quando chegar.`;
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
  // cada fala passa por journey/route.ts e fica no rastro (§12.2), como na sessão
  const faqs = buildFaqs(journey, profile);
  const trail = createTrail(browserStore());
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

  async function reply(question: string, from: "chat" | "voz"): Promise<void> {
    cam.setState("think");
    const route = routeUtterance(question, { journey, moment: null, step: null, waiting: null, board: null, faqs, tarefa, tarefaApresentada: false });
    const said = answer(question, route);
    trail.record({ from, utterance: question, route: route.kind, answer: said, sources: route.kind === "faq" ? [route.faq.label] : [], moment: null, step: null });
    await new Promise((r) => setTimeout(r, 500));
    await say(said);
  }

  // fala da pessoa pelo chat
  document.addEventListener("chatpanel:send", (e) => {
    const text = e.detail.text.trim();
    if (text) void reply(text, "chat");
  });

  document.addEventListener("callbar:start", async () => {
    inCall = true;
    cam.show(); // o chat começa fechado: abre pelo botão da barra
    window.setTimeout(() => cam.sync(), 300); // reposiciona o chat depois que a câmera termina de aparecer
    // o navegador só libera áudio e microfone depois de um clique: libera sem segurar a conversa
    await Promise.race([voice.unlock().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
    if (voice.stt && !listening) {
      listening = true;
      void voice.listen({
        onFinal: (text) => {
          if (!inCall || muted || !text.trim()) return;
          chat.addMessage({ from: "user", text });
          void reply(text, "voz");
        },
        onState: (s) => {
          if (s === "ouvindo") return;
          listening = false; // sem microfone (ou sem permissão): a conversa segue pelo chat
          chat.addMessage({ from: "agent", text: MIC_AVISO[s] });
        },
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
    voice.stopListening(); // call encerrada: o microfone desliga (e para de mandar áudio ao STT)
    listening = false;
    cam.setState("idle");
    cam.hide();
  });
  document.addEventListener("callbar:mute", (e) => {
    muted = !!e.detail.on;
    voice.setMuted(muted);
  });
  document.addEventListener("callbar:pause", (e) => {
    cam.setPaused(!!e.detail.on);
    // a voz para na mesma palavra e volta dali; o microfone fica mudo enquanto isso
    if (e.detail.on) voice.pause();
    else voice.resume();
  });

  /** Resposta da Puca no início, pelo caminho que a rota escolheu. O que é da sessão (FAQ do quadro, conhecimento,
   *  pulo, primeira tarefa) vem da jornada; o "ask" fica com o que esta tela sabe (acessos, tarefas, pessoas).
   *  Sem fonte, não inventa e não encaminha daqui: indica a sessão e a buddy. */
  function answer(question: string, route: Route): string {
    switch (route.kind) {
      case "faq":
        return route.faq.unconfirmed ? `${route.faq.text} Pergunta para ${buddy}, sua buddy, no Slack.` : route.faq.text;
      case "knowledge":
        return route.text;
      case "jump":
        return `Isso eu te mostro na sua primeira sessão, no momento “${route.moment.title}”. É só clicar em Começar a sessão.`;
      case "tarefa":
        return route.resposta.kind === "sem_fonte"
          ? `A tarefa não diz isso. Pergunta para ${buddy}, sua buddy, no Slack.`
          : route.resposta.kind === "ainda_nao"
            ? "Eu te apresento a sua primeira tarefa no fim da primeira sessão."
            : route.resposta.texto;
      default:
        return local(question);
    }
  }

  function local(question: string): string {
    const q = normalize(question);
    const tool = tools.find((t) => q.includes(normalize(t.name)) || q.includes(t.id));
    if (tool) {
      if (tool.status === "ok") return `Você já tem acesso ao ${tool.name}. Ele serve para: ${tool.use.toLowerCase()}.`;
      return `O acesso ao ${tool.name} ainda não chegou. Quem libera é ${gestor}; te aviso aqui quando chegar.`;
    }
    if (/acess/.test(q)) {
      const waiting = tools.filter((t) => t.status !== "ok").map((t) => t.name);
      return waiting.length
        ? `Faltam ${waiting.join(" e ")}; o resto está liberado. Te aviso aqui quando chegar.`
        : "Você já tem acesso a todas as ferramentas do time.";
    }
    if (/sessao|aula|quadro|comecar/.test(q)) {
      return "Sua primeira sessão mostra o caminho de uma transação, o que acontece quando falha e quem cuida de cada parte. É só clicar em Começar a sessão.";
    }
    if (/buddy|beatriz/.test(q)) return `Sua buddy é ${buddy}. Ela te acompanha nas primeiras semanas.`;
    if (/gestor|natalia|natália|chefe/.test(q)) return `Seu gestor é ${gestor}, do time ${time}.`;
    if (/^(oi|ola|bom dia|boa tarde|boa noite)\b|obrigad/.test(q)) return "Estou por aqui. Pode perguntar sobre seus acessos, suas tarefas ou o time.";
    return `Isso eu não tenho confirmado aqui no início. Na sua primeira sessão eu vejo com você; se não estiver lá, pergunta para ${buddy}, sua buddy, no Slack.`;
  }
}

void main();
