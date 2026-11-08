// Entrada do Orbis: o app sempre abre aqui (boas-vindas → call inicial → Início → sessão); perfil salvo de outra vez
// não pula a call. Quem entra (Ana, entrando na Kota, ou Bruno, mudando de time; PRODUCT.md §13.1) Puca descobre na
// call. O link de apresentação (?perfil=ana|bruno) cumprimenta a pessoa e leva o vínculo já anotado para a call.
// O e-mail do Slack da Kota (#209) fica aqui, antes da primeira sessão.
import "../../styles/base.css";
import "./style.css";
import { activeProfile } from "../../data";
import { preserveProfileLinks } from "../../lib/navigation";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { montarEmailDoSlack } from "./email-slack";

if (new URLSearchParams(location.search).get("perfil")) {
  preserveProfileLinks();
  const profile = activeProfile("ana");
  qs(document, "#title").textContent = `Oi, ${profile.nickname}.`;
  qs(document, "#who").textContent = profile.name;
}
montarEmailDoSlack(qs(document, ".home"));
mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: ".topbar__row > *, .home__title, .home__lead, .home__actions > *, .slack-email",
  max: 40,
});
