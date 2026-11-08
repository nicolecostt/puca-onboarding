// Boas-vindas: abre no fim da call inicial. Cumprimenta pelo perfil salvo na call e dá duas saídas:
// ir para o início do Orbis ou refazer a call inicial (as duas levam o ?perfil= junto).
import "../../styles/base.css";
import "./style.css";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { resolveProfile } from "../../journey/profile";

const { profile } = resolveProfile(location.search);
qs(document, "#title").textContent = `Oi, ${profile.nome}.`;
qs(document, "#lead").textContent = profile.time
  ? `Sua primeira semana com o time ${profile.time} está pronta.`
  : "Sua primeira semana está pronta.";
qs(document, "#who").textContent = profile.nome;
for (const id of ["#go-inicio", "#go-call"]) {
  const a = qs<HTMLAnchorElement>(document, id);
  a.href = a.getAttribute("href") + location.search;
}

mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: ".topbar__row > *, .home__title, .home__lead, .home__actions > *",
  max: 40,
});
