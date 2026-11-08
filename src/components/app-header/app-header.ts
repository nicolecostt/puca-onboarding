// Cabeçalho do app (Figma: topo das telas da sessão): marca do produto (Orbis), empresa, etapas da jornada e a pessoa.
// Orbis é o produto; Puca é a agente que fala com a pessoa.
//   mountAppHeader({ current: "lesson", profile })
import "../../styles/tokens.css";
import "./app-header.css";
import { screenHref } from "../../lib/navigation";
import { esc } from "../../lib/dom";
import { company, journey, teamLine, type JourneyStepId, type Profile } from "../../data";
import logoUrl from "../../assets/orbis-logo.png";

const CHECK = `<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export interface AppHeaderOptions {
  current: JourneyStepId;
  profile: Profile;
  parent?: HTMLElement;
}

export function mountAppHeader(opts: AppHeaderOptions): HTMLElement {
  const currentIndex = journey.findIndex((s) => s.id === opts.current);
  const steps = journey
    .map((step, i) => {
      const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
      // estado pela marca (DESIGN.md): visto cheio (feita), anel com ponto (atual), tracejado (próxima)
      const mark = state === "done" ? CHECK : "";
      const sep = i > 0 ? `<span class="app-header__sep" aria-hidden="true"></span>` : "";
      return `${sep}<li class="app-step app-step--${state}"${state === "current" ? ' aria-current="step"' : ""}>
        <span class="app-step__mark">${mark}</span><span class="app-step__label">${esc(step.label)}</span>
      </li>`;
    })
    .join("");

  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <a class="app-header__brand" href="${esc(screenHref("../inicio/"))}" aria-label="Orbis, início">
      <img class="app-header__logo" src="${logoUrl}" alt="" width="26" height="26">
      <span class="app-header__name">Orbis</span>
      <span class="app-header__company">${esc(company.name)}</span>
    </a>
    <ol class="app-header__steps" aria-label="Sua jornada">${steps}</ol>
    <div class="app-header__person">
      <span class="app-header__avatar" aria-hidden="true">${esc(opts.profile.initials)}</span>
      <span class="app-header__who">
        <span class="app-header__person-name">${esc(opts.profile.name)}</span>
        <span class="app-header__team">${esc(teamLine(opts.profile))}</span>
      </span>
    </div>`;
  (opts.parent ?? document.body).prepend(header);
  return header;
}
