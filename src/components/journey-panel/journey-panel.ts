// Painel "Sua jornada" (aula no quadro, canto de cima à esquerda): o objetivo da pessoa, os momentos da jornada
// marcados pela calibragem (aprender, revisar, já conhece, fora) e os próximos passos. Não está no Figma;
// segue o visual dos cartões da aula. Recolhe para não tampar o quadro.
//   const panel = mountJourneyPanel({ jornada, final: "primeira-tarefa" });
//   panel.setProgress(["boas-vindas"], "seu-time");
//   panel.setJornada(montarJornadaDaPessoa(journey, calibragemNova)); // depois de uma checagem
// Evento no document: journeypanel:pick { id } quando a pessoa clica num momento (a tela faz o pulo).
import "../../styles/tokens.css";
import "./journey-panel.css";
import { esc, qs, targetEl } from "../../lib/dom";
import { emit } from "../../lib/events";
import { proximosPassos } from "../../journey/jornada-da-pessoa";
import type { EstadoMomento, JornadaDaPessoa, MomentoDaPessoa } from "../../journey/types";

export interface JourneyPanelOptions {
  jornada: JornadaDaPessoa;
  /** Momento que sempre aparece nos próximos passos enquanto não foi visto (ex.: a primeira tarefa). */
  final?: string;
  /** Começa recolhido. Padrão: aberto. */
  collapsed?: boolean;
  parent?: HTMLElement;
}

export interface JourneyPanel {
  el: HTMLElement;
  /** Momentos já vistos e o atual (null antes de começar ou depois do fim). */
  setProgress(visitados: readonly string[], atual: string | null): void;
  /** Troca a jornada (a calibragem mudou numa checagem) e mantém o progresso. */
  setJornada(jornada: JornadaDaPessoa): void;
  toggle(force?: boolean): void;
}

const ESTADO_LABEL: Record<EstadoMomento, string> = {
  aprender: "aprender",
  revisar: "revisar",
  ja_conhece: "já conhece",
  fora: "fora",
};

/** Quantos próximos passos mostrar (o resto está na lista de momentos). */
const MAX_PROXIMOS = 3;

type Progresso = "feito" | "agora" | "a-seguir";

function momentoHTML(m: MomentoDaPessoa, p: Progresso): string {
  const mark = p === "feito" ? "✓" : "";
  const current = p === "agora" ? ' aria-current="step"' : "";
  const motivo = m.motivo ? `<span class="jp-moment__why">${esc(m.motivo)}</span>` : "";
  // selo só onde a calibragem disse algo (momentos sem tema, como a checagem, são parte da aula para todos)
  const tag = m.temas.length || m.estado !== "aprender" ? `<span class="jp-tag jp-tag--${m.estado}">${ESTADO_LABEL[m.estado]}</span>` : "";
  return `
    <li class="jp-moment jp-moment--${p} jp-moment--${m.estado}"${current}>
      <button class="jp-moment__btn" data-moment="${esc(m.id)}" title="Ir para ${esc(m.titulo)}">
        <span class="jp-moment__mark" aria-hidden="true">${mark}</span>
        <span class="jp-moment__text">
          <span class="jp-moment__title">${esc(m.titulo)}</span>
          ${motivo}
        </span>
        ${tag}
      </button>
    </li>`;
}

export function mountJourneyPanel(opts: JourneyPanelOptions): JourneyPanel {
  let jornada = opts.jornada;
  let progresso: { visitados: readonly string[]; atual: string | null } = { visitados: [], atual: null };
  const panel = document.createElement("aside");
  panel.className = "journey-panel";
  panel.setAttribute("aria-label", "Sua jornada");
  panel.innerHTML = `
    <button class="jp-head" aria-expanded="true" aria-controls="jp-body">
      <span class="jp-head__title">Sua jornada</span>
      <span class="jp-head__count"></span>
      <span class="jp-head__chev" aria-hidden="true"></span>
    </button>
    <div class="jp-body" id="jp-body">
      ${
        jornada.objetivos.length
          ? `<section class="jp-section">
              <h3 class="jp-label">Seu objetivo</h3>
              ${jornada.objetivos.map((o) => `<p class="jp-goal">${esc(o)}</p>`).join("")}
            </section>`
          : ""
      }
      <section class="jp-section">
        <h3 class="jp-label">Momentos</h3>
        <ol class="jp-moments"></ol>
      </section>
      <section class="jp-section jp-next">
        <h3 class="jp-label">Próximos passos</h3>
        <ol class="jp-next__list"></ol>
      </section>
    </div>`;
  (opts.parent ?? document.body).appendChild(panel);

  const head = qs<HTMLButtonElement>(panel, ".jp-head");
  const count = qs(panel, ".jp-head__count");
  const list = qs(panel, ".jp-moments");
  const next = qs(panel, ".jp-next__list");
  const nextSection = qs(panel, ".jp-next");
  function setProgress(visitados: readonly string[], atual: string | null): void {
    progresso = { visitados: [...visitados], atual };
    const total = jornada.momentos.filter((m) => m.estado !== "fora").length;
    const vistos = new Set(visitados);
    list.innerHTML = jornada.momentos
      .map((m) => momentoHTML(m, m.id === atual ? "agora" : vistos.has(m.id) ? "feito" : "a-seguir"))
      .join("");
    const feitos = jornada.momentos.filter((m) => m.estado !== "fora" && vistos.has(m.id) && m.id !== atual).length;
    count.textContent = `${feitos}/${total}`;

    const proximos = proximosPassos(jornada, visitados, atual);
    const mostrar = proximos.slice(0, MAX_PROXIMOS);
    const final = proximos.find((m) => m.id === opts.final);
    if (final && !mostrar.includes(final)) mostrar.push(final);
    nextSection.hidden = mostrar.length === 0;
    next.innerHTML = mostrar
      .map(
        (m, i) => `<li class="jp-next__item">
          <button class="jp-next__btn" data-moment="${esc(m.id)}">
            <span class="jp-next__when">${i === 0 ? "a seguir" : m.id === opts.final ? "depois" : "e então"}</span>
            ${esc(m.titulo)}
          </button>
        </li>`,
      )
      .join("");
  }

  function setJornada(j: JornadaDaPessoa): void {
    jornada = j;
    setProgress(progresso.visitados, progresso.atual);
  }

  function toggle(force?: boolean): void {
    const open = force ?? panel.classList.contains("is-collapsed");
    panel.classList.toggle("is-collapsed", !open);
    head.setAttribute("aria-expanded", String(open));
  }

  head.addEventListener("click", () => toggle());
  panel.addEventListener("click", (e) => {
    const btn = targetEl(e)?.closest<HTMLElement>("[data-moment]");
    if (btn?.dataset.moment) emit("journeypanel:pick", { id: btn.dataset.moment });
  });

  setProgress([], null);
  if (opts.collapsed) toggle(false);
  return { el: panel, setProgress, setJornada, toggle };
}
