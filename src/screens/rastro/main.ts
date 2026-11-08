// Tela só para a demo (#51): lista o rastro guardado neste navegador pela sessão e baixa em JSON.
// Não faz parte do produto; serve para mostrar à banca que dá para auditar o que Puca fez e por quê.
import "../../styles/base.css";
import "./style.css";
import { preserveProfileLinks } from "../../lib/navigation";
import { createOutbox, FORWARDING_KEY } from "../../journey/forwarding";
import { browserStore } from "../../journey/storage";
import { createTrail, TRAIL_KEY, type TrailEntry, type TrailRoute } from "../../journey/trail";
import { qs } from "../../lib/dom";

preserveProfileLinks();

const ROUTE_LABEL: Record<TrailRoute, string> = {
  jump: "Pulo de assunto",
  reply: "Resposta sugerida",
  select: "Toque no quadro",
  tarefa: "Primeira tarefa",
  knowledge: "Conhecimento da sessão",
  faq: "Cartão do nó",
  ask: "Agente (LLM)",
};

const trail = createTrail(browserStore());
const outbox = createOutbox(browserStore());
const rows = qs(document, "#rows");
const table = qs(document, "#table");
const empty = qs(document, "#empty");

function cell(text: string, cls?: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text; // texto da pessoa: nunca como HTML
  if (cls) td.className = cls;
  return td;
}

/** Para quem a fala foi encaminhada e em que pé está (pendente → enviado → confirmado). */
function forwardingText(e: TrailEntry, sent: Map<string, string>): string {
  if (!e.forwarding_id) return "";
  return sent.get(e.forwarding_id) ?? "encaminhada";
}

function row(e: TrailEntry, sent: Map<string, string>): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const time = new Date(e.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const route = ROUTE_LABEL[e.route] ?? e.route;
  tr.append(
    cell(time, "is-time"),
    cell(`${e.utterance}${e.from === "voz" ? " (voz)" : ""}`),
    cell(e.ms ? `${route} · ${(e.ms / 1000).toFixed(1)} s` : route, `is-route is-${e.route}`),
    cell(e.answer || "—"),
    cell(e.sources.length ? e.sources.join("; ") : "sem fonte", e.sources.length ? "" : "is-none"),
    cell(forwardingText(e, sent)),
  );
  return tr;
}

function render(): void {
  const list = trail.list();
  const sent = new Map(outbox.list().map((f) => [f.id, `→ ${f.to.name} (${f.status}${f.slack_link ? ", no Slack da Kota" : ""})`]));
  rows.replaceChildren(...list.map((e) => row(e, sent)).reverse()); // mais recente primeiro
  table.hidden = !list.length;
  empty.hidden = !!list.length;
}

qs(document, "#download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([trail.exportJson()], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "rastro-puca.json" });
  a.click();
  // Safari e Firefox cancelam o download se a URL some no mesmo tique do clique
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
qs(document, "#clear").addEventListener("click", () => {
  trail.clear();
  render();
});
// a sessão, aberta em outra aba, grava enquanto esta tela está aberta
addEventListener("storage", (e) => {
  if (e.key === TRAIL_KEY || e.key === FORWARDING_KEY) render();
});

render();
