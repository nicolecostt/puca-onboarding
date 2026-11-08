// Landing do Orbis. Aqui ficam as partes que se mexem:
// a esfera pequena no exemplo de quadro, a esfera grande com as habilidades trocando,
// os nós clicáveis do quadro e as partículas coloridas do fechamento.
import "../../styles/base.css";
import "./style.css";
import { loadAgentVisual, type AgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { qs } from "../../lib/dom";
import demo from "../../journey/data/tail.journey.json";
import type { BoardNode, Journey } from "../../journey/types";

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
  // marcar = true pinta o nó de preto (escolha da pessoa); no início o cartão só mostra o foco da Puca.
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

// ---- Partículas coloridas no fundo da página: os pontos da esfera soltos ----
function mountParticles(): void {
  const canvas = qs<HTMLCanvasElement>(document, "#particles");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const COUNT = Math.round(Math.min(60, (innerWidth * innerHeight) / 24000));
  const dots = Array.from({ length: COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.2 + Math.random() * 2.6,
    hue: Math.random() * 360,
    speed: 0.004 + Math.random() * 0.012,
    drift: (Math.random() - 0.5) * 0.004,
    alpha: 0.25 + Math.random() * 0.5,
    vis: 1,
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

  // o que fica na frente das partículas: textos, botões, a esfera e o quadro.
  // A partícula some ao passar por trás deles e reaparece do outro lado.
  const OCCLUDERS =
    "h1, h2, h3, p, dt, dd, .actions, .board, .skills, .puca__stage, .orb, .nav, .footer__row > *";
  const PAD = 14;
  const blockers: { l: number; t: number; r: number; b: number; round: boolean }[] = [];
  const measure = () => {
    blockers.length = 0;
    document.querySelectorAll<HTMLElement>(OCCLUDERS).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -PAD || r.top > innerHeight + PAD || r.width === 0) return;
      const round = el.classList.contains("puca__stage") || el.classList.contains("orb");
      blockers.push({ l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD, round });
    });
  };
  const hidden = (x: number, y: number) =>
    blockers.some((k) => {
      if (x < k.l || x > k.r || y < k.t || y > k.b) return false;
      if (!k.round) return true;
      const cx = (k.l + k.r) / 2;
      const cy = (k.t + k.b) / 2;
      const rad = (k.r - k.l) / 2;
      return (x - cx) ** 2 + (y - cy) ** 2 < rad * rad;
    });
  let dirty = true;
  addEventListener("scroll", () => (dirty = true), { passive: true });
  addEventListener("resize", () => (dirty = true));

  const draw = (dt: number) => {
    if (dirty) {
      measure();
      dirty = false;
    }
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.speed * dt;
      d.x += d.drift * dt;
      d.hue = (d.hue + 20 * dt) % 360;
      if (d.y < -0.05) {
        d.y = 1.05;
        d.x = Math.random();
      }
      // apaga e acende suave ao entrar e sair de trás de um elemento
      d.vis = Math.max(0, Math.min(1, d.vis + (hidden(d.x * w, d.y * h) ? -8 : 8) * Math.max(dt, 0.016)));
      if (d.vis === 0) continue;
      ctx.fillStyle = `hsla(${d.hue}, 75%, 62%, ${d.alpha * d.vis})`;
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
