// Palco do navegador da Puca na sessão: a área onde o app para Mac põe o navegador dela, no lugar do quadro.
// Só existe com window.orbis.navegador (contrato "Computer use", src/lib/orbis.ts); sem o app, a sessão segue igual.
import type { AcaoDaPuca, OrbisNavegador } from "../../lib/orbis";

export interface PalcoNavegador {
  /** Mostra o navegador e manda a ação para a fila do app; falha vira aviso no console, nunca erro. */
  executar(a: AcaoDaPuca): void;
  mostrarNavegador(): void;
  /** Esconde o navegador e volta ao quadro (se o quadro estava na vista). */
  mostrarQuadro(): void;
  /** A pessoa falou por cima: a fila para e os desenhos somem. */
  cancelar(): void;
}

/** Largura do painel do chat aberto, que fica por cima da direita da sessão. */
const LARGURA_DO_CHAT = 404;
const LARGURA_MINIMA = 320;

export function montarPalcoNavegador(
  host: HTMLElement,
  abas: HTMLElement,
  boardHost: HTMLElement,
  orbis: OrbisNavegador | undefined,
): PalcoNavegador | null {
  if (!orbis) return null;
  const nav = orbis;

  let aberto = false; // o navegador está na vista
  let quadroVisivel = false; // o quadro estava na vista antes de o navegador entrar
  let chatAberto = false;

  const [botaoQuadro, botaoNavegador] = abas.querySelectorAll<HTMLButtonElement>("button");

  function marcarAba(): void {
    botaoQuadro?.setAttribute("aria-pressed", String(!aberto));
    botaoNavegador?.setAttribute("aria-pressed", String(aberto));
  }

  /** Mede a área do host e passa ao app (px do conteúdo da janela). */
  function medir(): void {
    if (!aberto) return;
    const r = host.getBoundingClientRect();
    const width = chatAberto ? Math.max(LARGURA_MINIMA, r.width - LARGURA_DO_CHAT) : r.width;
    nav.mostrar({ x: Math.round(r.left), y: Math.round(r.top), width: Math.round(width), height: Math.round(r.height) });
  }

  new ResizeObserver(() => medir()).observe(host);
  window.addEventListener("resize", medir);
  document.addEventListener("chatpanel:change", (e) => {
    chatAberto = e.detail.open;
    medir();
  });

  function mostrarNavegador(): void {
    if (!aberto) quadroVisivel = !boardHost.hidden;
    aberto = true;
    boardHost.hidden = true;
    host.hidden = false;
    abas.hidden = false;
    marcarAba();
    medir();
  }

  function mostrarQuadro(): void {
    if (aberto) {
      nav.esconder();
      boardHost.hidden = !quadroVisivel;
    }
    aberto = false;
    host.hidden = true;
    marcarAba();
  }

  botaoQuadro?.addEventListener("click", () => mostrarQuadro());
  botaoNavegador?.addEventListener("click", () => mostrarNavegador());

  return {
    executar(a) {
      mostrarNavegador();
      void nav
        .executar([a])
        .then((r) => {
          if (r.falhas.length) console.warn("navegador da Puca: ações que não deram certo", r.falhas);
        })
        .catch((e) => console.warn("navegador da Puca: a fila falhou", e));
    },
    mostrarNavegador,
    mostrarQuadro,
    cancelar() {
      nav.cancelar();
    },
  };
}
