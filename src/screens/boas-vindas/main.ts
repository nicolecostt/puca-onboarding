// Entrada do Orbis: a call inicial começa nas boas-vindas.
import "../../styles/base.css";
import "./style.css";
import { activeProfile } from "../../data";
import { sessionCompleted } from "../../journey/session-progress";
import { loadSavedProfile } from "../../journey/profile";
import { preserveProfileLinks } from "../../lib/navigation";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";

const savedProfile = loadSavedProfile();
if (savedProfile) {
  location.replace(sessionCompleted(savedProfile) ? "../inicio/" : "../lesson/");
} else {
  preserveProfileLinks();
  const profile = activeProfile("ana");
  qs(document, "#title").textContent = `Oi, ${profile.nickname}.`;
  qs(document, "#who").textContent = profile.name;
  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
    occluders: ".topbar__row > *, .home__title, .home__lead, .home__actions > *",
    max: 40,
  });
}
