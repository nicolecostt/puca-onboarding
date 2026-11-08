// Landing da Iris: apresenta a Puca. Página estática; aqui só a esfera da Puca no exemplo de quadro
// e a entrada suave das seções.
import "../../styles/base.css";
import "./style.css";
import { loadAgentVisual } from "../../lib/agent-visual";
import { qs } from "../../lib/dom";

async function mountOrb(): Promise<void> {
  const factory = await loadAgentVisual();
  if (!factory) return;
  const visual = factory(qs<HTMLElement>(document, "#puca-orb"));
  visual.setState("talk");
}

function revealOnScroll(): void {
  const sections = document.querySelectorAll<HTMLElement>(".section, .cta");
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  sections.forEach((s) => {
    s.classList.add("reveal");
    io.observe(s);
  });
}

// Nós do exemplo de quadro, com os dados da jornada da Tail (src/journey/data/tail.journey.json).
interface NodeInfo {
  title: string;
  role: string;
  owner: string;
  tag?: string;
}

const NODES: Record<string, NodeInfo> = {
  gateway: {
    title: "pos-gateway",
    role: "Recebe as vendas das maquininhas e chama o authorizer.",
    owner: "Responsável: Diego Ramos · Autorização",
    tag: "provado · ADR-012",
  },
  authorizer: {
    title: "authorizer",
    role: "Decide se a venda é aprovada e calcula o MDR.",
    owner: "Responsável: Júlia Paiva · Autorização",
    tag: "provado · ADR-019",
  },
  topic: {
    title: "transactions.authorized",
    role: "Fila onde o gateway publica toda venda aprovada.",
    owner: "Time: Autorização",
  },
  settlement: {
    title: "settlement-worker",
    role: "Sem documentação confirmada.",
    owner: "Responsável: Rafael Lins · Liquidação",
    tag: "encaminhado à Carla Mendes",
  },
};

function mountBoard(): void {
  const canvas = qs<HTMLElement>(document, ".board-canvas");
  const field = (name: string) => qs<HTMLElement>(canvas, `[data-card="${name}"]`);
  // marcar = true pinta o nó de azul (escolha da pessoa); no início o cartão só mostra o foco da Puca.
  const select = (id: string, marcar = true) => {
    const info = NODES[id];
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
void mountOrb();
revealOnScroll();
