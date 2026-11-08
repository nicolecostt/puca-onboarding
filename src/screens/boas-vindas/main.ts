// Entrada do Orbis: a call inicial começa nas boas-vindas. Na primeira abertura, a pessoa escolhe com quem entra na
// Kota (PRODUCT.md §13.1): Ana, entrando na empresa, ou Bruno, mudando de time. A escolha vai para a call como
// ?perfil= (a call usa a admissão dessa pessoa e não pergunta de novo o vínculo); o perfil só fica salvo no fim da call.
import "../../styles/base.css";
import "./style.css";
import { activeProfile } from "../../data";
import { mountEscolhaPerfil } from "../../components/escolha-perfil/escolha-perfil";
import { ID_DO_VINCULO } from "../../journey/escolha";
import { sessionCompleted } from "../../journey/session-progress";
import { loadSavedProfile } from "../../journey/profile";
import { preserveProfileLinks } from "../../lib/navigation";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";

const savedProfile = loadSavedProfile();
if (savedProfile) {
  location.replace(sessionCompleted(savedProfile) ? "../inicio/" : "../lesson/");
} else if (new URLSearchParams(location.search).get("perfil")) {
  // perfil já escolhido no endereço (link de apresentação): cumprimenta e vai direto para a call
  preserveProfileLinks();
  const profile = activeProfile("ana");
  qs(document, "#title").textContent = `Oi, ${profile.nickname}.`;
  qs(document, "#who").textContent = profile.name;
  particulas(".topbar__row > *, .home__title, .home__lead, .home__actions > *");
} else {
  const home = qs(document, ".home");
  home.classList.add("home--escolha");
  home.replaceChildren();
  mountEscolhaPerfil(home, {
    aoEscolher: (vinculo) => location.assign(`../onboarding-call/?perfil=${ID_DO_VINCULO[vinculo]}`),
  });
  particulas(".topbar__row > *, .escolha__titulo, .escolha__texto, .escolha__cartao");
}

function particulas(occluders: string): void {
  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), { occluders, max: 40 });
}
