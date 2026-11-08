// Cabeçalho do app (Figma: topo das telas da aula): marca do produto (Orbis), empresa, etapas da jornada e a pessoa.
// Orbis é o produto; Puca é a agente que fala com a pessoa.
//   mountAppHeader({ current: "lesson", profile })
import "../../styles/tokens.css";
import "./app-header.css";
import { esc } from "../../lib/dom";
import { company, journey, teamLine, type JourneyStepId, type Profile } from "../../data";

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
      const mark = state === "done" ? "✓" : String(i + 1);
      const sep = i > 0 ? `<span class="app-header__sep" aria-hidden="true"></span>` : "";
      return `${sep}<li class="app-step app-step--${state}"${state === "current" ? ' aria-current="step"' : ""}>
        <span class="app-step__mark">${mark}</span><span class="app-step__label">${esc(step.label)}</span>
      </li>`;
    })
    .join("");

  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `
    <div class="app-header__brand">
      <span class="app-header__logo" aria-hidden="true">O</span>
      <span class="app-header__name">Orbis</span>
      <span class="app-header__company">${esc(company.name)}</span>
    </div>
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
