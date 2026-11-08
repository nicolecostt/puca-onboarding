// Landing do Orbis. Aqui ficam as partes que se mexem:
// a esfera pequena no exemplo de quadro, a esfera grande com as habilidades trocando,
// os nós clicáveis do quadro e as partículas coloridas do fechamento.
import "../../styles/base.css";
import "./style.css";
import { loadAgentVisual, type AgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { mountPucaDots } from "../../lib/puca-dots";
import demo from "../../journey/data/tail.journey.json";
import type { BoardNode, Journey } from "../../journey/types";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Puca: pontinhos na legenda do quadro, esfera grande na seção dela ----
async function mountSpheres(): Promise<AgentVisual | null> {
  mountPucaDots(qs<HTMLElement>(document, "#puca-orb"));
  const factory = await loadAgentVisual();
  if (!factory) return null;
  return factory(qs<HTMLElement>(document, "#puca-sphere"));
}

// ---- Habilidades: trocam sozinhas, uma por vez ----
const SKILL_MS = 3200;

function mountSkills(sphere: AgentVisual | null): void {
  const list = qs<HTMLElement>(document, "#skills");
  const items = [...list.querySelectorAll<HTMLButtonElement>(".skill")];
  list.style.setProperty("--skill-ms", `${SKILL_MS}ms`);

  let index = 0;
  let timer = 0;
  const paused = reduceMotion; // com movimento reduzido, a lista não troca sozinha
  let hovering = false;
  let pinned = false; // tocou numa habilidade: fica nela (no celular não há hover)
  let visible = false;

  const show = (i: number) => {
    index = (i + items.length) % items.length;
    items.forEach((b, n) => {
      const on = n === index;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-current", on ? "true" : "false");
    });
    sphere?.setState((items[index].dataset.state as AgentVisualState) ?? "talk");
    restart();
  };

  const restart = () => {
    clearTimeout(timer);
    const running = !paused && !pinned && !hovering && visible;
    // reinicia o fio do tempo da habilidade ativa
    list.classList.remove("is-running");
    void list.offsetWidth;
    list.classList.toggle("is-running", running);
    if (running) timer = window.setTimeout(() => show(index + 1), SKILL_MS);
  };

  items.forEach((b, n) =>
    b.addEventListener("click", () => {
      pinned = !(pinned && n === index);
      show(n);
    }),
  );
  list.addEventListener("pointerenter", () => {
    hovering = true;
    restart();
  });
  list.addEventListener("pointerleave", () => {
    hovering = false;
    restart();
  });

  // só corre quando a seção está na tela
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    restart();
  }).observe(list);

  show(0);
}

// ---- Nós do exemplo de quadro: dados lidos da jornada da Tail (o mesmo quadro da sessão) ----
interface NodeCard {
  title: string;
  role: string;
  owner: string;
  tag?: string;
}

const BOARD = (demo as unknown as Journey).boards.pagamentos;

/** Primeira frase do texto (o cartão da landing é curto). */
const firstSentence = (t: string) => (t.match(/^.*?[.!?](\s|$)/)?.[0] ?? t).trim();

function cardFor(id: string): NodeCard | null {
  const node: BoardNode | undefined = BOARD.nodes.find((n) => n.id === id);
  if (!node) return null;
  const info = node.info ?? {};
  const owner =
    info.owner && info.owner_confirmed !== false
      ? `Responsável: ${info.owner}${info.team ? ` · ${info.team}` : ""}`
      : info.team
        ? `Time: ${info.team}`
        : "Responsável não confirmado";
  // fonte: o ADR do nó, ou o primeiro documento que é um ADR; caixa preta mostra o que está pendente
  const adr = info.adr?.id ?? info.docs?.find((d) => d.title.startsWith("ADR"))?.title.split(" ·")[0];
  const pending = node.look === "blackbox" ? node.note?.split("·").pop()?.trim() : undefined;
  return {
    title: node.label,
    role: firstSentence(info.role ?? ""),
    owner,
    tag: pending ?? (adr ? `fonte: ${adr}` : undefined),
  };
}

function mountBoard(): void {
  const canvas = qs<HTMLElement>(document, ".board__canvas");
  const field = (name: string) => qs<HTMLElement>(canvas, `[data-card="${name}"]`);
  // marcar = true pinta o nó de preto (escolha da pessoa); no início o cartão só mostra o foco de Puca.
  const select = (id: string, marcar = true) => {
    const info = cardFor(id);
    if (!info) return;
    canvas.querySelectorAll<HTMLElement>(".node").forEach((n) => {
      const on = marcar && n.dataset.node === id;
      n.classList.toggle("is-selected", on);
      n.setAttribute("aria-pressed", String(on));
    });
    field("title").textContent = info.title;
    field("role").textContent = info.role;
    field("owner").textContent = info.owner;
    field("tag").textContent = info.tag ?? "";
    field("tag").hidden = !info.tag;
  };
  canvas.addEventListener("click", (e) => {
    const node = (e.target as Element).closest<HTMLElement>(".node");
    if (node?.dataset.node) select(node.dataset.node);
  });
  select("topic", false);
}

mountBoard();
mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
  occluders: "h1, h2, h3, p, dt, dd, .actions, .board, .skills, .puca__stage, .orb, .nav, .footer__row > *",
  round: ".puca__stage, .orb",
});
void mountSpheres().then(mountSkills);
