// Escolha do perfil (PRODUCT.md §13.1): dois cartões, quem está entrando na Kota e quem está mudando de time. Usada
// na tela src/screens/escolha/ (antes da call inicial) e por cima da sessão quando ninguém escolheu.
//   mountEscolhaPerfil(el, { aoEscolher: (vinculo) => … });
import "../../styles/tokens.css";
import "./escolha-perfil.css";
import { profiles, teamLine } from "../../data/profiles";
import type { Profile as DemoProfile } from "../../data/types";
import { esc } from "../../lib/dom";
import type { Vinculo } from "../../journey/types";

export interface EscolhaPerfilOptions {
  aoEscolher: (vinculo: Vinculo) => void;
  /** Escolha já feita (cartão marcado). */
  marcado?: Vinculo | null;
  titulo?: string;
  texto?: string;
}

const TAG: Record<Vinculo, string> = { novo: "Entrando na Kota", transicao: "Mudando de time" };

function cartao(p: DemoProfile, vinculo: Vinculo, marcado: boolean): string {
  const onde = vinculo === "transicao" ? `${p.role} · ${teamLine(p)}` : `${p.role} · time ${p.toTeam}`;
  return `
    <button type="button" class="escolha__cartao${marcado ? " is-marcado" : ""}" data-vinculo="${vinculo}" aria-pressed="${marcado}">
      <span class="escolha__avatar" aria-hidden="true">${esc(p.initials)}</span>
      <span class="escolha__tag">${TAG[vinculo]}</span>
      <span class="escolha__nome">${esc(p.name)}</span>
      <span class="escolha__onde">${esc(onde)}</span>
    </button>`;
}

export function mountEscolhaPerfil(parent: HTMLElement, opts: EscolhaPerfilOptions): { el: HTMLElement; destroy(): void } {
  const porVinculo: Record<Vinculo, DemoProfile> = {
    novo: Object.values(profiles).find((p) => p.kind !== "transfer")!,
    transicao: Object.values(profiles).find((p) => p.kind === "transfer")!,
  };
  const el = document.createElement("section");
  el.className = "escolha";
  el.setAttribute("aria-labelledby", "escolha-titulo");
  el.innerHTML = `
    <h1 class="escolha__titulo" id="escolha-titulo">${esc(opts.titulo ?? "Com quem você entra na Kota?")}</h1>
    <p class="escolha__texto">${esc(opts.texto ?? "Você vive a pessoa que está sendo integrada. A escolha muda a call inicial e a sessão.")}</p>
    <div class="escolha__cartoes">
      ${cartao(porVinculo.novo, "novo", opts.marcado === "novo")}
      ${cartao(porVinculo.transicao, "transicao", opts.marcado === "transicao")}
    </div>`;
  el.addEventListener("click", (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>("[data-vinculo]");
    if (btn) opts.aoEscolher(btn.dataset.vinculo as Vinculo);
  });
  parent.appendChild(el);
  return { el, destroy: () => el.remove() };
}
