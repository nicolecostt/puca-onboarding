// E-mail do jurado no Slack da Kota, pedido antes da primeira sessão (#209): com ele, a primeira dúvida que Puca
// encaminha já chega por mensagem direta no Slack de verdade (#129, src/journey/slack-real.ts). Opcional; o Início
// continua com o mesmo campo para trocar depois. Salva enquanto a pessoa digita: escolher o cartão sem apertar nada
// não perde o e-mail.
import { lerEmailDoSlack, salvarEmailDoSlack } from "../../journey/slack-real";
import { browserStore } from "../../journey/storage";

const SEM_EMAIL = "Sem e-mail, as dúvidas que Puca não souber ficam aqui no Orbis.";

export function montarEmailDoSlack(parent: HTMLElement): HTMLElement {
  const store = browserStore();
  const form = document.createElement("form");
  form.className = "slack-email";
  form.noValidate = true;
  form.innerHTML = `
    <label class="slack-email__label" for="slack-email-input">Seu e-mail no Slack da Kota <span>(opcional)</span></label>
    <p class="slack-email__hint">Se Puca não souber responder uma dúvida, manda para você por mensagem direta lá, dizendo a quem ela iria na Kota. O convite do Slack está no guia de uso.</p>
    <input class="slack-email__input" id="slack-email-input" type="email" autocomplete="email" placeholder="voce@exemplo.com" />
    <p class="slack-email__status" role="status" aria-live="polite"></p>`;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const status = form.querySelector<HTMLElement>(".slack-email__status")!;
  input.value = lerEmailDoSlack(store) ?? "";

  const salvar = (avisar: boolean) => {
    salvarEmailDoSlack(store, input.value);
    if (!avisar) return;
    status.textContent = lerEmailDoSlack(store)
      ? "Salvo. As dúvidas que Puca não souber vão para o seu Slack da Kota."
      : input.value.trim()
        ? "Esse e-mail não parece válido."
        : SEM_EMAIL;
  };
  input.addEventListener("input", () => salvar(false));
  input.addEventListener("change", () => salvar(true));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    salvar(true);
  });

  parent.appendChild(form);
  return form;
}
