// Escolha do perfil: a primeira tela do fluxo, antes da call inicial (PRODUCT.md §13.1). A pessoa escolhe com quem
// entra na Kota (Ana, entrando na empresa, ou Bruno, mudando de time); a escolha fica salva (localStorage) e a call
// abre com os dados dessa pessoa e sem perguntar de novo o vínculo.
import "../../styles/base.css";
import "./style.css";
import { mountEscolhaPerfil } from "../../components/escolha-perfil/escolha-perfil";
import { ID_DO_VINCULO, escolherPerfil } from "../../journey/escolha";
import { loadSavedProfile } from "../../journey/profile";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";

mountEscolhaPerfil(qs(document, "#escolha-host"), {
  marcado: loadSavedProfile()?.vinculo ?? null,
  aoEscolher(vinculo) {
    escolherPerfil(vinculo);
    location.assign(`../onboarding-call/?perfil=${ID_DO_VINCULO[vinculo]}`);
  },
});

mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: ".topbar__row > *, .escolha__titulo, .escolha__texto, .escolha__cartao",
  max: 40,
});
