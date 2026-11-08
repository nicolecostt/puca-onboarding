// Painel "Sua jornada" (sessão no quadro, canto de cima à esquerda): barra de progresso, o objetivo da pessoa e
// os momentos numa linha do tempo, marcados pela calibragem (aprender, revisar, já conhece, pulado), com o atual
// (ou o próximo) em destaque. Não está no Figma;
// segue o visual dos cartões da sessão. Recolhe para não tampar o quadro.
//   const panel = mountJourneyPanel({ jornada });
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
  fora: "pulado",
};

type Progresso = "feito" | "agora" | "a-seguir";

const CHECK = `<svg width="8" height="8" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Um momento na linha do tempo. O motivo da calibragem só aparece no momento atual (e no próximo, antes de começar). */
function momentoHTML(m: MomentoDaPessoa, p: Progresso, proximo: boolean, terminou: boolean): string {
  const current = p === "agora" ? ' aria-current="step"' : "";
  const destaque = p === "agora" || proximo;
  const motivo = destaque && m.motivo && m.estado !== "fora" ? `<span class="jp-moment__why">${esc(m.motivo)}</span>` : "";
  // depois do fim da sessão, o próximo não é "a seguir": é o que ficou para rever (ou que não deu tempo de ver)
  const quando = p === "agora" ? "agora" : !proximo ? "" : !terminou ? "a seguir" : m.estado === "revisar" ? "para rever" : "ainda não visto";
  // selo só onde a calibragem disse algo (momentos sem tema, como a checagem, são parte da sessão para todos)
  const tag = m.temas.length || m.estado !== "aprender" ? `<span class="jp-tag jp-tag--${m.estado}">${ESTADO_LABEL[m.estado]}</span>` : "";
  return `
    <li class="jp-moment jp-moment--${p} jp-moment--${m.estado}${proximo ? " is-next" : ""}"${current}>
      <button class="jp-moment__btn" data-moment="${esc(m.id)}" title="${m.estado === "fora" && m.motivo ? esc(m.motivo) : `Ir para ${esc(m.titulo)}`}">
        <span class="jp-moment__mark" aria-hidden="true">${p === "feito" ? CHECK : ""}</span>
        <span class="jp-moment__text">
          ${quando ? `<span class="jp-moment__when">${quando}</span>` : ""}
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
    <div class="jp-bar" aria-hidden="true"></div>
    <div class="jp-body" id="jp-body">
      ${
        jornada.objetivos.length
          ? `<section class="jp-goal">
              <h3 class="jp-label">Seu objetivo</h3>
              ${jornada.objetivos.map((o) => `<p class="jp-goal__text">${esc(o)}</p>`).join("")}
            </section>`
          : ""
      }
      <section class="jp-section">
        <h3 class="jp-label">Momentos</h3>
        <ol class="jp-moments"></ol>
      </section>
    </div>`;
  (opts.parent ?? document.body).appendChild(panel);

  const head = qs<HTMLButtonElement>(panel, ".jp-head");
  const count = qs(panel, ".jp-head__count");
  const bar = qs(panel, ".jp-bar");
  const list = qs(panel, ".jp-moments");
  function setProgress(visitados: readonly string[], atual: string | null): void {
    progresso = { visitados: [...visitados], atual };
    const vistos = new Set(visitados);
    const estado = (id: string): Progresso => (id === atual ? "agora" : vistos.has(id) ? "feito" : "a-seguir");
    // o próximo momento da jornada da pessoa (pula o que ela já conhece), marcado na própria lista
    const proximo = atual ? null : (proximosPassos(jornada, visitados, atual)[0]?.id ?? null);
    const terminou = !atual && visitados.length > 0;
    list.innerHTML = jornada.momentos.map((m) => momentoHTML(m, estado(m.id), m.id === proximo, terminou)).join("");
    const contam = jornada.momentos.filter((m) => m.estado !== "fora");
    const feitos = contam.filter((m) => estado(m.id) === "feito").length;
    count.textContent = `${feitos} de ${contam.length}`;
    bar.innerHTML = contam.map((m) => `<i class="jp-bar__seg is-${estado(m.id)}"></i>`).join("");
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
