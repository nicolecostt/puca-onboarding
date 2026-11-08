// Landing da Iris. Aqui ficam as partes que se mexem:
// a esfera pequena no exemplo de quadro, a esfera grande com as habilidades trocando,
// os nós clicáveis do quadro e as partículas coloridas do fechamento.
import "../../styles/base.css";
import "./style.css";
import { loadAgentVisual, type AgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { qs } from "../../lib/dom";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Esferas da Puca ----
async function mountSpheres(): Promise<AgentVisual | null> {
  const factory = await loadAgentVisual();
  if (!factory) return null;
  factory(qs<HTMLElement>(document, "#puca-orb")).setState("talk");
  return factory(qs<HTMLElement>(document, "#puca-sphere"));
}

// ---- Habilidades: trocam sozinhas, uma por vez ----
const SKILL_MS = 3200;

function mountSkills(sphere: AgentVisual | null): void {
  const list = qs<HTMLElement>(document, "#skills");
  const pauseBtn = qs<HTMLButtonElement>(document, "#skills-pause");
  const items = [...list.querySelectorAll<HTMLButtonElement>(".skill")];
  list.style.setProperty("--skill-ms", `${SKILL_MS}ms`);

  let index = 0;
  let timer = 0;
  let paused = reduceMotion;
  let hovering = false;
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
    const running = !paused && !hovering && visible;
    // reinicia o fio do tempo da habilidade ativa
    list.classList.remove("is-running");
    void list.offsetWidth;
    list.classList.toggle("is-running", running);
    if (running) timer = window.setTimeout(() => show(index + 1), SKILL_MS);
  };

  items.forEach((b, n) => b.addEventListener("click", () => show(n)));
  list.addEventListener("pointerenter", () => {
    hovering = true;
    restart();
  });
  list.addEventListener("pointerleave", () => {
    hovering = false;
    restart();
  });

  const syncPause = () => {
    pauseBtn.textContent = paused ? "Continuar" : "Pausar";
    pauseBtn.setAttribute("aria-pressed", String(paused));
  };
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    syncPause();
    restart();
  });
  syncPause();

  // só corre quando a seção está na tela
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    restart();
  }).observe(list);

  show(0);
}

// ---- Nós do exemplo de quadro (dados da jornada da Tail, src/journey/data/tail.journey.json) ----
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
  const canvas = qs<HTMLElement>(document, ".board__canvas");
  const field = (name: string) => qs<HTMLElement>(canvas, `[data-card="${name}"]`);
  // marcar = true pinta o nó de preto (escolha da pessoa); no início o cartão só mostra o foco da Puca.
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

// ---- Partículas coloridas no fundo da página: os pontos da esfera soltos ----
function mountParticles(): void {
  const canvas = qs<HTMLCanvasElement>(document, "#particles");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const COUNT = Math.round(Math.min(140, (innerWidth * innerHeight) / 11000));
  const dots = Array.from({ length: COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.2 + Math.random() * 2.6,
    hue: Math.random() * 360,
    speed: 0.004 + Math.random() * 0.012,
    drift: (Math.random() - 0.5) * 0.004,
    alpha: 0.25 + Math.random() * 0.5,
  }));
  let w = 0;
  let h = 0;
  let running = false;
  let last = 0;

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.speed * dt;
      d.x += d.drift * dt;
      d.hue = (d.hue + 20 * dt) % 360;
      if (d.y < -0.05) {
        d.y = 1.05;
        d.x = Math.random();
      }
      ctx.fillStyle = `hsla(${d.hue}, 75%, 62%, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const frame = (t: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    draw(dt);
    requestAnimationFrame(frame);
  };

  new ResizeObserver(() => {
    resize();
    draw(0);
  }).observe(canvas);
  resize();
  draw(0);
  if (reduceMotion) return;
  // para quando a aba some, volta quando reaparece
  const start = () => {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else start();
  });
  start();
}

mountBoard();
mountParticles();
void mountSpheres().then(mountSkills);
