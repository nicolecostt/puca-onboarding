// Entrada do Orbis: a call inicial começa nas boas-vindas. Quem entra (Ana, entrando na Kota, ou Bruno, mudando de
// time; PRODUCT.md §13.1) Puca descobre na call. O link de apresentação (?perfil=ana|bruno) cumprimenta a pessoa e
// leva o vínculo já anotado para a call; o perfil só fica salvo no fim da call.
import "../../styles/base.css";
import "./style.css";
import { activeProfile } from "../../data";
import { loadSavedProfile } from "../../journey/profile";
import { preserveProfileLinks } from "../../lib/navigation";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";

if (loadSavedProfile()) {
  location.replace("../inicio/"); // depois da call, o Início vem primeiro e leva à sessão
} else {
  if (new URLSearchParams(location.search).get("perfil")) {
    preserveProfileLinks();
    const profile = activeProfile("ana");
    qs(document, "#title").textContent = `Oi, ${profile.nickname}.`;
    qs(document, "#who").textContent = profile.name;
  }
  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
    occluders: ".topbar__row > *, .home__title, .home__lead, .home__actions > *",
    max: 40,
  });
}
