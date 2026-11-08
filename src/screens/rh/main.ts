// Painel do RH (PRODUCT.md §5): indicadores agregados das integrações, de novos e de transição, as etapas obrigatórias
// e as pendências administrativas. Descreve o processo de integração, nunca o desempenho da pessoa.
// Os números somam os dados de exemplo (./data.ts) com o que este navegador já registrou: sessões e dúvidas por
// momento (rastro, só totais: nunca o texto da fala), encaminhamentos abertos e pedidos de primeira tarefa.
import "../../styles/base.css";
import "./style.css";
import { esc, qs } from "../../lib/dom";
import { company } from "../../data";
import { mountPucaDots } from "../../lib/puca-dots";
import { loadJourney } from "../../journey/validate";
import demoJourney from "../../journey/data/tail.journey.json";
import { SESSIONS_KEY, TRAIL_KEY } from "../../journey/trail";
import { FORWARDING_KEY } from "../../journey/forwarding";
import { PEDIDOS_KEY } from "../../journey/primeira-tarefa";
import type { Vinculo } from "../../journey/types";
import {
  DUVIDAS_POR_MOMENTO,
  ETAPAS,
  FEEDBACK,
  INTEGRACOES,
  NOVENTA_DIAS,
  OBRIGATORIAS,
  RH_PESSOA,
  type Integracao,
  type Pendencia,
} from "./data";

const journey = loadJourney(demoJourney);
const initials = (nome: string) => nome.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
const pct = (n: number) => `${Math.round(n * 100)}%`;
const VINCULO: Record<Vinculo, string> = { novo: "Novo", transicao: "Transição" };

// ---- O que este navegador já registrou (só contagens) ----
/** Lista guardada no navegador, só com os itens que são objetos (um `null` ou um número na lista é ignorado). */
function readList(key: string): Record<string, unknown>[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
  } catch {
    return [];
  }
}
/** Falas que são dúvidas (não respostas de checagem, pulos nem toques no quadro). */
const ROTAS_DE_DUVIDA = new Set(["faq", "knowledge", "ask", "tarefa"]);
const ENCAMINHAMENTO_ABERTO = new Set(["pendente", "enviando", "enviado"]);
const live = {
  sessoes: readList(SESSIONS_KEY).filter((x) => typeof x.session === "string").length,
  duvidasPorMomento: readList(TRAIL_KEY).reduce<Record<string, number>>((acc, e) => {
    if (typeof e.moment === "string" && typeof e.route === "string" && ROTAS_DE_DUVIDA.has(e.route)) {
      acc[e.moment] = (acc[e.moment] ?? 0) + 1;
    }
    return acc;
  }, {}),
  encaminhamentosAbertos: readList(FORWARDING_KEY).filter((f) => typeof f.status === "string" && ENCAMINHAMENTO_ABERTO.has(f.status)).length,
  // cada sessão nova pede de novo: conta pessoas com pedido aguardando, não pedidos (o nome só serve para contar)
  pedidosAguardando: new Set(
    readList(PEDIDOS_KEY)
      .filter((p) => typeof p.status === "string" && p.status !== "aprovada" && typeof p.pessoa === "string")
      .map((p) => p.pessoa),
  ).size,
};
const temLive = live.sessoes + live.encaminhamentosAbertos + live.pedidosAguardando + Object.keys(live.duvidasPorMomento).length > 0;

// ---- Topo ----
qs(document, "#company").textContent = company.name;
qs(document, "#me-name").textContent = RH_PESSOA.nome;
qs(document, "#me-role").textContent = RH_PESSOA.papel;
qs(document, "#me-initials").textContent = initials(RH_PESSOA.nome);
qs(document, "#live-note").textContent = temLive
  ? "Os totais somam os dados de exemplo com as sessões, as dúvidas e os encaminhamentos feitos neste navegador."
  : "Dados de exemplo.";
mountPucaDots(qs(document, "#privacy-orb"));

// ---- Indicadores ----
type Filtro = Vinculo | "todos";
/** Menor grupo para mostrar uma média: abaixo disso, ela identifica a pessoa. */
const MIN_GRUPO = 3;

function obrigatoriasDe(p: Integracao) {
  return OBRIGATORIAS.filter((o) => o.so === null || o.so === p.vinculo);
}

function render(filtro: Filtro): void {
  const lista = INTEGRACOES.filter((p) => filtro === "todos" || p.vinculo === filtro);
  const comLive = filtro === "todos"; // o navegador não sabe o vínculo de quem usou: só entra no total geral

  // etapas obrigatórias
  const devidas = lista.reduce((n, p) => n + obrigatoriasDe(p).length, 0);
  const feitas = lista.reduce((n, p) => n + obrigatoriasDe(p).filter((o) => p.feitas.includes(o.id)).length, 0);
  // tempo até a primeira tarefa (só de quem já chegou lá)
  // com menos de MIN_GRUPO pessoas, a "média" seria o número de alguém da tabela: não mostra (§5, só agregado)
  const chegaram = lista.filter((p) => p.diasAtePrimeiraTarefa !== undefined);
  const media = chegaram.length >= MIN_GRUPO ? chegaram.reduce((n, p) => n + (p.diasAtePrimeiraTarefa ?? 0), 0) / chegaram.length : null;
  const novos = lista.filter((p) => p.vinculo === "novo").length;

  const kpis: { label: string; value: string; unit?: string; note: string }[] = [
    { label: "Em integração", value: String(lista.length), note: `${novos} novos · ${lista.length - novos} em transição` },
    { label: "Etapas obrigatórias concluídas", value: devidas ? pct(feitas / devidas) : "—", note: `${feitas} de ${devidas} etapas` },
    {
      label: "Até a primeira tarefa",
      value: media === null ? "—" : media.toFixed(0),
      unit: media === null ? undefined : "dias",
      note: media !== null
        ? `média de ${chegaram.length} pessoas que já chegaram lá`
        : `aparece com ${MIN_GRUPO} pessoas ou mais (${chegaram.length} até agora)`,
    },
    {
      label: "Turnover de 90 dias",
      value: pct(NOVENTA_DIAS.sairam / NOVENTA_DIAS.comecaram),
      note: `${NOVENTA_DIAS.sairam} de ${NOVENTA_DIAS.comecaram} que começaram · toda a empresa`,
    },
  ];
  qs(document, "#kpis").innerHTML = kpis
    .map(
      (k) => `
      <div class="kpi">
        <p class="kpi__label">${esc(k.label)}</p>
        <p class="kpi__value">${esc(k.value)}${k.unit ? `<span class="kpi__unit">${esc(k.unit)}</span>` : ""}</p>
        <p class="kpi__note">${esc(k.note)}</p>
      </div>`,
    )
    .join("");

  const sessoes = lista.reduce((n, p) => n + p.sessoes, 0) + (comLive ? live.sessoes : 0);
  const abertos = lista.reduce((n, p) => n + p.encaminhamentosAbertos, 0) + (comLive ? live.encaminhamentosAbertos : 0);
  const acessos = lista.reduce((n, p) => n + p.pendencias.filter((x) => x.label.startsWith("Acesso")).length, 0);
  const total = FEEDBACK.promotores + FEEDBACK.neutros + FEEDBACK.detratores;
  const enps = Math.round(((FEEDBACK.promotores - FEEDBACK.detratores) / total) * 100);
  const stats: [string, string][] = [
    ["Sessões com a Puca", String(sessoes)],
    ["Encaminhamentos abertos", String(abertos)],
    ["Acessos pendentes", String(acessos)],
    ["Feedback da integração", `${enps > 0 ? "+" : ""}${enps}`],
  ];
  qs(document, "#stats").innerHTML = stats
    .map(([l, v]) => `<div class="stat"><span class="stat__label">${esc(l)}</span><span class="stat__value">${esc(v)}</span></div>`)
    .join("");

  // ---- Pessoas ----
  qs(document, "#people-count").textContent = `${lista.length} ${lista.length === 1 ? "pessoa" : "pessoas"}`;
  qs(document, "#people").innerHTML = lista
    .map((p) => {
      // cada pessoa numa cor do espectro da Puca (a mesma de sempre, pela posição na lista completa)
      const hue = Math.round((INTEGRACOES.indexOf(p) / INTEGRACOES.length) * 360 + 200) % 360;
      const segs = ETAPAS.map((_, i) => `<i class="seg ${i < p.etapa ? "is-done" : i === p.etapa ? "is-now" : ""}"></i>`).join("");
      const pend = p.pendencias.length
        ? `<span class="mark mark--open" aria-hidden="true"></span>${p.pendencias.length} ${p.pendencias.length === 1 ? "pendência" : "pendências"}`
        : `<span class="mark mark--ok" aria-hidden="true">${CHECK}</span>Em dia`;
      return `
      <tr>
        <th scope="row">
          <span class="who">
            <span class="avatar avatar--row" style="--hue:${hue}" aria-hidden="true">${esc(initials(p.nome))}</span>
            <span class="who__text"><span class="who__name">${esc(p.nome)}</span><span class="who__sub">${esc(p.cargo)} · ${esc(p.time)}</span></span>
          </span>
        </th>
        <td>${VINCULO[p.vinculo]}</td>
        <td><span class="stage"><span class="segs" aria-hidden="true">${segs}</span>${esc(ETAPAS[p.etapa])}</span></td>
        <td class="num">${p.dia}</td>
        <td><span class="pendc${p.pendencias.length ? "" : " is-ok"}" title="${esc(p.pendencias.map((x) => x.label).join(", "))}">${pend}</span></td>
        <td>${esc(p.buddy)}</td>
      </tr>`;
    })
    .join("");

  // ---- Etapas obrigatórias: concluídas por quem precisa passar por elas ----
  qs(document, "#steps").innerHTML = OBRIGATORIAS.map((o) => {
    const devem = lista.filter((p) => o.so === null || o.so === p.vinculo);
    const ok = devem.filter((p) => p.feitas.includes(o.id)).length;
    const so = o.so === "novo" ? " · só para quem é novo" : "";
    return `
      <li class="step">
        <span class="step__label">${esc(o.label)}<span class="step__so">${so}</span></span>
        <span class="step__dots" aria-hidden="true">${devem.map((_, i) => `<i class="${i < ok ? "is-done" : ""}"></i>`).join("")}</span>
        <span class="step__n">${devem.length ? `${ok} de ${devem.length}` : "—"}</span>
      </li>`;
  }).join("");

  // ---- Pendências administrativas, agrupadas ----
  const grupos = new Map<string, { p: Pendencia; n: number }>();
  for (const x of lista.flatMap((p) => p.pendencias)) {
    const g = grupos.get(x.label);
    if (g) g.n++;
    else grupos.set(x.label, { p: x, n: 1 });
  }
  if (comLive && live.pedidosAguardando) {
    const label = "Aprovação da primeira tarefa";
    const g = grupos.get(label);
    if (g) g.n += live.pedidosAguardando;
    else grupos.set(label, { p: { label, quem: "Gestor" }, n: live.pedidosAguardando });
  }
  const pend = [...grupos.values()].sort((a, b) => b.n - a.n);
  qs(document, "#pend").innerHTML = pend.length
    ? pend
        .map(
          ({ p, n }) => `
        <li class="pend__item">
          <span class="pend__label">${esc(p.label)}</span>
          <span class="pend__who">${esc(p.quem)}</span>
          <span class="pend__n">${n} ${n === 1 ? "pessoa" : "pessoas"}</span>
        </li>`,
        )
        .join("")
    : `<li class="pend__empty">Nenhuma pendência.</li>`;

  // ---- Dúvidas por momento ----
  const titulo = new Map(journey.moments.map((m) => [m.id, m.title]));
  const contagem = new Map<string, number>();
  const vinculos: Vinculo[] = filtro === "todos" ? ["novo", "transicao"] : [filtro];
  for (const g of vinculos) for (const [id, n] of Object.entries(DUVIDAS_POR_MOMENTO[g])) contagem.set(id, (contagem.get(id) ?? 0) + n);
  if (comLive) for (const [id, n] of Object.entries(live.duvidasPorMomento)) contagem.set(id, (contagem.get(id) ?? 0) + n);
  const topicos = [...contagem.entries()]
    .filter(([id]) => titulo.has(id))
    .map(([id, n]) => ({ label: titulo.get(id) ?? id, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const max = Math.max(1, ...topicos.map((t) => t.n));
  qs(document, "#topics").innerHTML = topicos
    .map(
      (t) => `
      <li class="bar">
        <span class="bar__label">${esc(t.label)}</span>
        <span class="bar__track" aria-hidden="true"><i style="width:${(t.n / max) * 100}%"></i></span>
        <span class="bar__n">${t.n}</span>
      </li>`,
    )
    .join("");

  // ---- Feedback: promotores, neutros e detratores ----
  qs(document, "#fb-n").textContent = `${total} respostas`;
  const partes: [string, number, string][] = [
    ["Recomendam", FEEDBACK.promotores, "is-pro"],
    ["Neutros", FEEDBACK.neutros, "is-neu"],
    ["Não recomendam", FEEDBACK.detratores, "is-det"],
  ];
  qs(document, "#fb").innerHTML = `
    <div class="fb__bar" aria-hidden="true">${partes.map(([, n, c]) => `<i class="${c}" style="flex:${n}"></i>`).join("")}</div>
    <ul class="fb__legend">${partes
      .map(([l, n, c]) => `<li><span class="fb__key ${c}" aria-hidden="true"></span>${esc(l)}<b>${n}</b></li>`)
      .join("")}</ul>
    <p class="side__note">Pergunta no fim da integração: “de 0 a 10, quanto você recomendaria a integração daqui?”. O número do topo é o NPS dessas respostas.</p>`;
}

const CHECK = `<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---- Filtro por vínculo: a pílula preta desliza até a opção escolhida ----
const filter = qs(document, ".filter");
const tabs = [...document.querySelectorAll<HTMLButtonElement>(".filter__btn")];
function moveThumb(): void {
  const t = tabs.find((o) => o.getAttribute("aria-selected") === "true") ?? tabs[0];
  filter.style.setProperty("--thumb-x", `${t.offsetLeft}px`);
  filter.style.setProperty("--thumb-w", `${t.offsetWidth}px`);
}
for (const t of tabs) {
  t.addEventListener("click", () => {
    for (const o of tabs) o.setAttribute("aria-selected", String(o === t));
    moveThumb();
    render(t.dataset.vinculo as Filtro);
  });
}
// primeira posição sem animação; depois acompanha o tamanho da tela e a fonte carregando
filter.classList.add("is-instant");
moveThumb();
requestAnimationFrame(() => filter.classList.remove("is-instant"));
addEventListener("resize", moveThumb);
void document.fonts?.ready.then(moveThumb);
render("todos");
