// Página da primeira tarefa (#15) no Notion da Kota, simulado: a tarefa que Puca entregou na sessão e o estado da
// aprovação do gestor. Lê o pedido do localStorage (?id=, ou o mais recente) e muda sozinha quando o gestor aprova no Slack.
import "../../styles/base.css";
import "./style.css";
import { PEDIDOS_KEY } from "../../journey/primeira-tarefa";
import { browserStore, readJson } from "../../journey/storage";
import { qs } from "../../lib/dom";
import { pedidoDaPagina, statusDaPagina } from "./pagina";

const store = browserStore();
const id = new URLSearchParams(location.search).get("id");
const doc = qs(document, "#doc");
const empty = qs(document, "#empty");
const status = qs(document, "#status");

function set(sel: string, text: string): void {
  qs(document, sel).textContent = text; // texto vindo do localStorage: nunca como HTML
}

function render(): void {
  const p = pedidoDaPagina(readJson<unknown>(store, PEDIDOS_KEY, []), id);
  doc.hidden = !p;
  empty.hidden = !!p;
  if (!p) return;
  const t = p.tarefa;
  document.title = `${t.titulo} · Kota`;
  set("#titulo", t.titulo);
  set("#pessoa", p.pessoa.trim() && p.pessoa.trim().toLowerCase() !== "você" ? p.pessoa.trim() : "Pessoa em integração");
  set("#problema", t.problema);
  set("#porque", t.porque);
  set("#sistemas", t.sistemas);
  set("#onde-ler", t.onde_ler);
  set("#quem-ajuda", t.quem_ajuda);
  status.textContent = statusDaPagina(p);
  status.classList.toggle("is-ok", p.status === "aprovada");
}

addEventListener("storage", (e) => {
  if (e.key === PEDIDOS_KEY) render();
});
render();
