// Boas-vindas: abre no fim da call inicial. Cumprimenta pelo perfil salvo na entrevista e dá duas saídas:
// acessar a plataforma (tela de início) ou refazer a call inicial.
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

mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: ".topbar__row > *, .home__title, .home__lead, .home__actions > *",
  max: 40,
});
