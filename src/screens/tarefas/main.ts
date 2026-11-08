// Tarefas que o Puca passou na call inicial e nas sessões (assign_task, contrato "Tarefas do agente"). Lê o
// localStorage, marca como feita e muda sozinha quando a sessão, aberta em outra aba, grava uma tarefa nova.
import "../../styles/base.css";
import "./style.css";
import { preserveProfileLinks } from "../../lib/navigation";
import { PEDIDOS_KEY } from "../../journey/primeira-tarefa";
import { browserStore, readJson } from "../../journey/storage";
import { createTarefas, TAREFAS_KEY, type TarefaAtribuida } from "../../journey/tarefas";
import { qs } from "../../lib/dom";
import { pedidoDaPagina, statusDaPagina } from "../primeira-tarefa/pagina";
import { grupos, origemDaTarefa } from "./lista";

preserveProfileLinks();

const store = browserStore();
const tarefas = createTarefas(store);

// menu hambúrguer: abre por cima, fecha com Esc, clique fora ou num link
const menu = qs<HTMLButtonElement>(document, "#menu");
const side = qs(document, "#side");
const scrim = qs(document, "#scrim");
function abrir(aberto: boolean): void {
  side.hidden = !aberto;
  scrim.hidden = !aberto;
  menu.setAttribute("aria-expanded", String(aberto));
  menu.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
  if (aberto) side.querySelector<HTMLElement>("a")?.focus();
}
menu.addEventListener("click", () => abrir(side.hidden));
scrim.addEventListener("click", () => abrir(false));
side.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a")) abrir(false);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !side.hidden) {
    abrir(false);
    menu.focus();
  }
});

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text; // texto do agente: nunca como HTML
  return e;
}

function cartao(t: TarefaAtribuida): HTMLLIElement {
  const li = el("li", `tf-card${t.status === "feita" ? " is-done" : ""}`);
  const head = el("label", "tf-card__head");
  const check = el("input", "tf-card__check");
  check.type = "checkbox";
  check.checked = t.status === "feita";
  check.addEventListener("change", () => {
    tarefas.marcar(t.id, check.checked ? "feita" : "a-fazer");
    render();
  });
  head.append(check, el("span", "tf-card__titulo", t.titulo));
  li.append(head);
  if (t.porque) li.append(el("p", "tf-card__porque", t.porque));
  if (t.passos.length) {
    const ol = el("ol", "tf-card__passos");
    ol.append(...t.passos.map((p) => el("li", "", p)));
    li.append(ol);
  }
  const meta = el("p", "tf-card__meta", origemDaTarefa(t));
  if (t.onde) meta.append(" · Onde: ", el("span", "tf-card__onde", t.onde));
  li.append(meta);
  return li;
}

function secao(nome: string, lista: TarefaAtribuida[]): void {
  qs(document, `#sec-${nome}`).hidden = !lista.length;
  qs(document, `#n-${nome}`).textContent = String(lista.length);
  qs(document, `#${nome}`).replaceChildren(...lista.map(cartao));
}

function render(): void {
  const p = pedidoDaPagina(readJson<unknown>(store, PEDIDOS_KEY, []), null);
  const primeira = qs<HTMLAnchorElement>(document, "#primeira");
  primeira.hidden = !p;
  if (p) {
    qs(document, "#primeira-titulo").textContent = p.tarefa.titulo;
    qs(document, "#primeira-status").textContent = statusDaPagina(p);
  }
  const g = grupos(tarefas.list());
  secao("afazer", g.aFazer);
  secao("feitas", g.feitas);
  qs(document, "#empty").hidden = !!(p || g.aFazer.length || g.feitas.length);
}

addEventListener("storage", (e) => {
  if (e.key === TAREFAS_KEY || e.key === PEDIDOS_KEY) render();
});
render();
