// Mexe no Slack simulado da Tail como a Puca mexeria no de verdade (computer use, #21): abre a DM,
// digita no campo de mensagem e envia. Todo texto entra por textContent: a fala da pessoa nunca vira HTML.
import type { AgentCursor } from "../../components/agent-cursor/agent-cursor";

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Item da lista de mensagens diretas cujo nome (sem a inicial do avatar) começa pelo nome. */
export function findDm(name: string): HTMLElement | null {
  const label = (li: HTMLElement) =>
    [...li.childNodes].filter((n) => !(n instanceof HTMLElement && n.classList.contains("sk-av"))).map((n) => n.textContent ?? "").join("").trim();
  return [...document.querySelectorAll<HTMLElement>(".sk-dm")].find((li) => label(li).startsWith(name)) ?? null;
}

/** Abre a conversa direta: título, item marcado na lateral, feed com a introdução da DM e o campo de mensagem.
 *  Se a DM já está aberta, não mexe no feed (as mensagens anteriores continuam lá). */
export function openDm(name: string): void {
  const feed = $(".sk-feed");
  if (feed?.dataset.dm === name) return;
  for (const li of document.querySelectorAll(".sk-ch.is-current, .sk-dm.is-current")) li.classList.remove("is-current");
  findDm(name)?.classList.add("is-current");
  const title = $(".sk-chan__name");
  if (title) title.textContent = name;
  if (feed) {
    feed.dataset.dm = name;
    const intro = document.createElement("div");
    intro.className = "sk-intro";
    const h2 = document.createElement("h2");
    h2.textContent = name;
    const p = document.createElement("p");
    p.textContent = `Esta é a sua conversa com ${name}. A Puca escreve aqui quando precisa de ajuda com uma dúvida.`;
    intro.append(h2, p);
    feed.replaceChildren(intro);
  }
  const input = $(".sk-composer__input");
  if (input) {
    input.textContent = `Enviar mensagem para ${name}`;
    input.classList.remove("is-typing");
  }
}

/** Leva o cursor ao campo de mensagem e digita o texto, caractere a caractere. */
export async function typeInComposer(text: string, cursor: AgentCursor): Promise<void> {
  const input = $(".sk-composer__input");
  if (!input) return;
  await cursor.moveTo(input);
  await cursor.click();
  input.classList.add("is-typing");
  input.textContent = "";
  const step = Math.max(1, Math.ceil(text.length / 160)); // mensagem longa: digita em blocos, para não demorar demais
  for (let i = 0; i < text.length; i += step) {
    input.textContent = text.slice(0, i + step);
    await sleep(25);
  }
}

/** Mensagem nova no fim do feed, no formato das que já estão no Slack. Uma linha do texto = um parágrafo. */
export function postMessage(m: { author: string; avatar: string; tone: "blue" | "pink" | "puca"; text: string; time: string }): void {
  const feed = $(".sk-feed");
  if (!feed) return;
  const article = document.createElement("article");
  article.className = "sk-msg";
  const av = document.createElement("span");
  av.className = `sk-av sk-av--${m.tone} sk-av--lg`;
  av.textContent = m.avatar;
  const body = document.createElement("div");
  body.className = "sk-msg__body";
  const meta = document.createElement("p");
  meta.className = "sk-msg__meta";
  const who = document.createElement("strong");
  who.textContent = m.author;
  const when = document.createElement("span");
  when.textContent = m.time;
  meta.append(who, when);
  body.append(meta, ...m.text.split("\n").map((line) => Object.assign(document.createElement("p"), { textContent: line })));
  article.append(av, body);
  feed.append(article);
  feed.scrollTop = feed.scrollHeight;
}

/** Limpa o campo de mensagem depois de enviar. */
export function clearComposer(name: string): void {
  const input = $(".sk-composer__input");
  if (!input) return;
  input.textContent = `Enviar mensagem para ${name}`;
  input.classList.remove("is-typing");
}
