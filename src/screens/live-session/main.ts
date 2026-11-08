// Tela de auxílio: barra de call, chat e câmera da Puca por cima de outra ferramenta.
// A tela inteira imita o Slack (tema claro) com os dados da Tail; o conteúdo está no index.html.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { mountAgentCursor } from "../../components/agent-cursor/agent-cursor";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { mountPucaDots } from "../../lib/puca-dots";
import { createOutbox, FORWARDING_KEY, forwardingMessage } from "../../journey/forwarding";
import { createPedidos, pedidoMessage, PEDIDOS_KEY, type PedidoDeAprovacao } from "../../journey/primeira-tarefa";
import { browserStore } from "../../journey/storage";
import { uid } from "../../journey/uid";
import { drenar } from "./fila";
import { clearComposer, findDm, openDm, postApprovalRequest, postMessage, typeInComposer } from "./slack-dm";

const BUDDY_ACK = "Vi aqui, te respondo já.";
const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit" }).replace(":", "h");
const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Resposta do gestor na DM com a Puca. Sem nome (profile.nome vira "você"), fala da pessoa. */
function aprovadaMsg(pessoa: string): string {
  const nome = pessoa.trim();
  return nome && nome.toLowerCase() !== "você" ? `Aprovada. Pode passar para ${nome}.` : "Aprovada. Pode passar para a pessoa.";
}

async function main(): Promise<void> {
  const chat = mountChatPanel();
  const cam = mountAgentCam({ name: "Puca", visual: await loadAgentVisual() });
  mountCallBar({ chat, attachTo: cam }); // barra presa embaixo da câmera; sem status por cima do Slack
  const cursor = mountAgentCursor();
  mountPucaDots(document.querySelector<HTMLElement>("#cu-dots")!); // as bolinhas da Puca no aviso do topo

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

  // O que a sessão deixou para o Slack: encaminhamentos à buddy (#28) e pedidos de aprovação da primeira tarefa
  // ao gestor (#15). A Puca abre a DM, digita e envia, um de cada vez. "enviando" antes da animação: outra aba do
  // Slack, ou um recarregar, não manda de novo.
  const outbox = createOutbox(browserStore());
  const pedidos = createPedidos(browserStore());
  const tab = uid();
  let sending = false;

  /** O cursor abre a DM, digita o texto e clica em enviar; a mensagem fica no feed como da Puca. */
  async function escreverNaDm(name: string, text: string): Promise<void> {
    const dm = findDm(name);
    if (dm) {
      await cursor.moveTo(dm);
      await cursor.click();
    }
    openDm(name);
    await typeInComposer(text, cursor);
    const send = document.querySelector(".sk-composer__send");
    if (send) {
      await cursor.moveTo(send);
      await cursor.click();
    }
    clearComposer(name);
  }

  // Botões "Aprovar tarefa" desta aba: outra aba pode aprovar, e o botão daqui fica desabilitado.
  const botoes = new Map<string, HTMLButtonElement>();
  const desabilitar = (b: HTMLButtonElement) => {
    b.disabled = true;
    b.textContent = "Aprovada";
  };
  /** Mensagem do pedido com o botão. O clique é o gestor decidindo (§12.2): a Puca nunca aprova sozinha. */
  function mostrarPedido(p: PedidoDeAprovacao): void {
    const button = postApprovalRequest({
      text: pedidoMessage(p),
      time: now(),
      link: `../primeira-tarefa/?id=${encodeURIComponent(p.id)}`,
      onApprove: () => {
        const aprovou = pedidos.aprovar(p.id, p.gestor);
        desabilitar(button);
        if (aprovou) postMessage({ author: p.gestor, avatar: initials(p.gestor), tone: "pink", text: aprovadaMsg(p.pessoa), time: now() });
      },
    });
    botoes.set(p.id, button);
  }

  /** Pedidos que ainda esperam aprovação e não estão na tela (recarregou, ou um encaminhamento abriu outra DM): voltam com o botão. */
  function restaurar(): void {
    for (const p of pedidos.list()) {
      if (p.status !== "aguardando" || botoes.get(p.id)?.isConnected) continue;
      openDm(p.gestor);
      mostrarPedido(p);
    }
  }

  async function drain(): Promise<void> {
    if (sending) return;
    sending = true;
    try {
      await drenar({
        outbox,
        pedidos,
        tab,
        esperar: sleep,
        restaurar,
        async encaminhar(f) {
          const text = forwardingMessage(f);
          await escreverNaDm(f.to.name, text);
          postMessage({ author: "Puca", avatar: "P", tone: "puca", text, time: now() });
          outbox.setStatus(f.id, "enviado");
          // a buddy confirma antes da próxima dúvida sair: a conversa fica na ordem
          await sleep(3000);
          postMessage({ author: f.to.name, avatar: initials(f.to.name), tone: "blue", text: BUDDY_ACK, time: now() });
          outbox.setStatus(f.id, "confirmado");
        },
        async pedir(p) {
          await escreverNaDm(p.gestor, pedidoMessage(p));
          mostrarPedido(p);
          pedidos.setStatus(p.id, "aguardando");
        },
      });
    } finally {
      sending = false;
      scheduleRetry();
    }
  }
  // Envio preso por outra aba (fechou ou recarregou no meio): tenta de novo quando ele passar a contar como preso.
  let retry: ReturnType<typeof setTimeout> | undefined;
  function scheduleRetry(): void {
    clearTimeout(retry);
    const waits = [outbox.nextRetryIn(tab), pedidos.nextRetryIn(tab)].filter((w): w is number => w !== null);
    if (waits.length) retry = setTimeout(() => void drain(), Math.min(...waits) + 1000);
  }
  addEventListener("storage", (e) => {
    if (e.key === FORWARDING_KEY) void drain();
    if (e.key === PEDIDOS_KEY) {
      for (const p of pedidos.list()) {
        const b = botoes.get(p.id);
        if (b && p.status === "aprovada") desabilitar(b);
      }
      void drain();
    }
  });
  await drain();
  // Recarregou com pedido já enviado e ainda sem resposta: a DM do gestor volta com o botão, sem animação.
  restaurar();

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
