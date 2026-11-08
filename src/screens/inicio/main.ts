// Início do Orbis: progresso no topo, perfil, tarefas (à esquerda) e ferramentas com o estado de cada acesso
// (à direita). Ao abrir, Puca confere os acessos e avisa o que falta (o pedido ao gestor ainda é simulado, #104).
// No canto, "Ligar para Puca" abre a câmera dele, com voz e chat; cada fala passa por journey/route.ts.
import "../../styles/base.css";
import "./style.css";
import { montarConversas } from "./conversas";
import { preserveProfileLinks, screenHref } from "../../lib/navigation";
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
import { lerEmailDoSlack, salvarEmailDoSlack } from "../../journey/slack-real";
import { browserStore } from "../../journey/storage";
import { loadJourney } from "../../journey/validate";
import { routeUtterance, type Route } from "../../journey/route";
import { buildFaqs } from "../../journey/faq";
import { createTrail } from "../../journey/trail";
import { createPedidos, PEDIDOS_KEY, tarefaDaPessoa } from "../../journey/primeira-tarefa";
import demoJourney from "../../journey/data/kota.journey.json";
import { createAgentVoice, MIC_AVISO } from "../../voice/agent-voice";
import { sessionCompleted } from "../../journey/session-progress";
import { TOOLS, tasksFor, type AccessStatus, type TaskState, type Tool } from "./data";

// ---- Quem é a pessoa: o que a call inicial salvou (ou o ?perfil=), completado pelo perfil da demo do mesmo vínculo ----
const { profile, source } = resolveProfile(location.search);

// Sem perfil nenhum, a pessoa vai para as boas-vindas e a call inicial. Vindo da call inicial, o Início abre antes da sessão e leva a ela.
const sessaoFeita = sessionCompleted(profile);
if (source === "demo") {
  location.replace(screenHref("../boas-vindas/"));
} else {
  renderHome();
}

function renderHome(): void {
  preserveProfileLinks();
  qs(document, "main").removeAttribute("hidden");
  montarConversas(qs(document, "#conversas"), profile);
  if (!sessaoFeita) {
    const link = document.querySelector<HTMLAnchorElement>('.orbis-link[href^="../lesson/"]');
    if (link) link.textContent = "Começar sessão";
  }
  const base = profile.vinculo === "transicao" ? profiles.bruno : profiles.ana;
  const gestor = profile.gestor || company.people[base.managerId]?.name || "";
  const buddy = company.people[base.buddyId]?.name ?? "sua buddy";
  const time = profile.time || base.toTeam;
  const cargo = profile.cargo || base.role;
  const vindoDe = profile.vinculo === "transicao" ? base.fromTeam : undefined;

  const CHECK = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const mark = (state: TaskState | AccessStatus) => {
    const kind = state === "done" || state === "ok" ? "done" : state;
    return `<span class="mark mark--${kind}" aria-hidden="true">${kind === "done" ? CHECK : ""}</span>`;
  };

  // ---- Topo, progresso e perfil ----
  qs(document, "#name").textContent = `Oi, ${profile.nome}.`;
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
  const pedidos = createPedidos(browserStore());
  const STATE_LABEL: Record<TaskState, string> = { done: "Concluída", now: "Agora", next: "Depois" };

  function renderProgress(): void {
    const pedido = tarefa ? pedidos.list().filter(
      (p) => p?.tarefa?.no === tarefa.no && p.pessoa === profile.nome && p.gestor === gestor,
    ).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null : null;
    const tasks = tasksFor(tarefa, tarefaNo?.sublabel, pedido, sessaoFeita);
    const next = tasks.find((task) => task.state === "now" && task.action);
    const nextStep = qs(document, "#next-step");
    nextStep.hidden = !next?.action;
    nextStep.innerHTML = next?.action ? `
      <div>
        <p class="eyebrow">Próximo passo</p>
        <h2>${esc(next.title)}</h2>
        <p class="next-step__detail">${esc(next.detail)}</p>
      </div>
      <a class="task__action" href="${esc(screenHref(next.action.href))}">${esc(next.action.label)}<span aria-hidden="true">→</span></a>
    ` : "";

    const otherTasks = tasks.filter((task) => task !== next);
    const tasksTitle = qs(document, "#tasks-title");
    tasksTitle.textContent = next ? "Outras tarefas" : "Suas tarefas";
    tasksTitle.hidden = otherTasks.length === 0;
    const tasksList = qs(document, "#tasks");
    tasksList.hidden = otherTasks.length === 0;
    tasksList.innerHTML = otherTasks.map(
      (t) => `
      <li class="task is-${t.state}">
        ${mark(t.state)}
        <div>
          <p class="task__title"><span class="sr-only">${STATE_LABEL[t.state]}: </span>${esc(t.title)}</p>
          <p class="task__detail">${esc(t.detail)}</p>
          ${t.action ? `<a class="task__action" href="${esc(screenHref(t.action.href))}">${esc(t.action.label)}</a>` : ""}
        </div>
      </li>`,
    ).join("");
  }

  renderProgress();
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    const current = resolveProfile(location.search);
    if (current.source !== source || JSON.stringify(current.profile) !== JSON.stringify(profile)) location.reload();
    else renderProgress();
  });
  addEventListener("storage", (e) => {
    if (e.key === PEDIDOS_KEY) renderProgress();
  });

  // ---- Ferramentas e acessos ----
  const tools: Tool[] = TOOLS.map((t) => ({ ...t }));
  const ACCESS_LABEL: Record<AccessStatus, string> = { ok: "Com acesso", pending: "Aguardando", missing: "Sem acesso" };
  function renderTools(): void {
    qs(document, "#tools").innerHTML = tools
      .map(
        (t) => `
      <li class="tool">
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

  // E-mail do jurado no Slack da Kota: o encaminhamento sai por mensagem direta a ele (#129, src/journey/slack-real.ts)
  const slackForm = qs<HTMLFormElement>(document, "#slack-email");
  const slackInput = qs<HTMLInputElement>(document, "#slack-email-input");
  const slackStatus = qs(document, "#slack-email-status");
  slackInput.value = lerEmailDoSlack(browserStore()) ?? "";
  slackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    salvarEmailDoSlack(browserStore(), slackInput.value);
    const salvo = lerEmailDoSlack(browserStore());
    slackStatus.textContent = salvo
      ? "Pronto: as dúvidas que eu não souber vão por mensagem direta no Slack da Kota."
      : slackInput.value.trim()
        ? "Esse e-mail não parece válido. Sem ele, as dúvidas ficam só aqui no Orbis."
        : "Sem e-mail: as dúvidas que eu não souber ficam só aqui no Orbis.";
  });

  // Puca confere os acessos ao abrir e avisa o que falta. Ele ainda não pede ao gestor de verdade (#104): não diz que pediu.
  let lastNotice = "";
  function checkAccess(): void {
    const missing = tools.filter((t) => t.status === "missing");
    if (!missing.length) return;
    for (const t of missing) t.status = "pending";
    const names = missing.map((t) => t.name).join(" e ");
    lastNotice = `Ainda falta: ${names}. Quem libera é ${gestor}; te aviso aqui quando chegar.`;
    qs(document, "#notice-text").innerHTML = `Ainda falta: <b>${esc(names)}</b>. Quem libera é ${esc(gestor)}; te aviso aqui quando chegar.`;
    qs(document, "#notice").hidden = false;
    renderTools();
  }

  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
    occluders: ".topbar__row > *, .profile, .tasks, .tools, .agent-cam, .call-dock, .chat-panel",
    max: 36,
  });

  // ---- Puca: câmera no canto, barra presa embaixo dela e chat ----
  async function main(): Promise<void> {
    checkAccess();
    mountPucaDots(qs(document, "#notice-orb"));
    const factory = await loadAgentVisual();

    const chat = mountChatPanel({ title: "Puca", messages: [] });
    const cam = mountAgentCam({ name: "Puca", visual: factory });
    const bar = mountCallBar({ chat, attachTo: cam, parent: qs<HTMLElement>(document, "#puca-call") });
    // começa desligada: no canto fica só "Ligar para Puca"
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

    /** Resposta de Puca no início, pelo caminho que a rota escolheu. O que é da sessão (FAQ do quadro, conhecimento,
     *  pulo, primeira tarefa) vem da jornada; o "ask" fica com o que esta tela sabe (acessos, tarefas, pessoas).
     *  Sem fonte, não inventa e não encaminha daqui: indica a sessão e a buddy. */
    function answer(question: string, route: Route): string {
      switch (route.kind) {
        case "faq":
          return route.faq.unconfirmed ? `${route.faq.text} Pergunta para ${buddy}, sua buddy, no Slack.` : route.faq.text;
        case "knowledge":
          return route.text;
        case "jump":
          return `Você pode rever isso em “${route.moment.title}”. É só clicar em ${sessaoFeita ? "Rever sessão" : "Começar sessão"}.`;
        case "tarefa":
          return route.resposta.kind === "sem_fonte"
            ? `A tarefa não diz isso. Pergunta para ${buddy}, sua buddy, no Slack.`
            : route.resposta.kind === "ainda_nao"
              ? "Os detalhes da sua primeira tarefa aparecem aqui quando ela for enviada para aprovação."
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
        return `Ainda falta: ${tool.name}. Quem libera é ${gestor}; te aviso aqui quando chegar.`;
      }
      if (/acess/.test(q)) {
        const waiting = tools.filter((t) => t.status !== "ok").map((t) => t.name);
        return waiting.length
          ? `Faltam ${waiting.join(" e ")}; o resto está liberado. Te aviso aqui quando chegar.`
          : "Você já tem acesso a todas as ferramentas do time.";
      }
      if (/sessao|aula|quadro|comecar/.test(q)) {
        return sessaoFeita
          ? "Em Rever sessão, você pode voltar ao caminho de uma transação e aos momentos do quadro."
          : "Em Começar sessão, eu te mostro no quadro o caminho de uma transação e o seu time.";
      }
      if (/buddy|beatriz/.test(q)) return `Sua buddy é ${buddy}. Ela te acompanha nas primeiras semanas.`;
      if (/gestor|natalia|natália|chefe/.test(q)) return `Seu gestor é ${gestor}, do time ${time}.`;
      if (/^(oi|ola|bom dia|boa tarde|boa noite)\b|obrigad/.test(q)) return "Estou por aqui. Pode perguntar sobre seus acessos, suas tarefas ou o time.";
      return `Isso eu não tenho confirmado aqui no início. Você pode ${sessaoFeita ? "rever o quadro" : "começar a sessão"} ou perguntar para ${buddy}, sua buddy, no Slack.`;
    }
  }

  void main();
}
