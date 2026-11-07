// Visual da Puca: esfera de pontos com uma faixa em onda, sem rosto.
// Carregado por loadAgentVisual() (agent-visual.ts) em todas as telas. Cores em tokens.css (--puca-sphere-*).
//
// Mouse: a esfera inclina na direção do cursor e os pontos perto dele crescem e escurecem.
// Clique: solta uma ondulação que corre pela superfície.
import type { AgentVisual, AgentVisualFactory, AgentVisualState, RGB } from "./agent-visual";

// ---- Ajustes ----
const POINTS = 3800;

/** Lê uma cor #rrggbb dos tokens (o canvas precisa dos números). */
function tokenColor(name: string, fallback: RGB): RGB {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : fallback;
}

/** Como cada estado mexe na onda. */
const MOODS: Record<AgentVisualState, { speed: number; amp: number; width: number; spin: number; pulse: number }> = {
  idle: { speed: 0.5, amp: 0.3, width: 1, spin: 0.12, pulse: 0 },
  think: { speed: 1.4, amp: 0.38, width: 0.75, spin: 0.35, pulse: 0 },
  talk: { speed: 0.9, amp: 0.34, width: 1.15, spin: 0.16, pulse: 1 },
};

interface Ripple {
  x: number; // ponto na esfera (coordenadas da própria esfera)
  y: number;
  z: number;
  born: number;
}

const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mountPucaSphere: AgentVisualFactory = (container) => {
  const BASE = tokenColor("--puca-sphere-dot", { r: 128, g: 124, b: 122 }); // cinza dos pontos de fundo
  const ACCENT = tokenColor("--puca-sphere-accent", { r: 176, g: 74, b: 48 }); // terracota da faixa
  const ACCENT_WARM = tokenColor("--puca-sphere-warm", { r: 214, g: 58, b: 44 }); // pensando
  const CORE = tokenColor("--puca-sphere-core", { r: 30, g: 30, b: 30 }); // miolo escuro da faixa

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // pontos espalhados por igual na esfera (espiral de Fibonacci)
  const px = new Float32Array(POINTS);
  const py = new Float32Array(POINTS);
  const pz = new Float32Array(POINTS);
  const lat = new Float32Array(POINTS);
  const lon = new Float32Array(POINTS);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < POINTS; i++) {
    const y = 1 - (i / (POINTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    px[i] = Math.cos(a) * r;
    py[i] = y;
    pz[i] = Math.sin(a) * r;
    lat[i] = Math.asin(y);
    lon[i] = Math.atan2(pz[i], px[i]);
  }

  // buffers do quadro atual (para desenhar de trás para frente)
  const sx = new Float32Array(POINTS);
  const sy = new Float32Array(POINTS);
  const sz = new Float32Array(POINTS);
  const order = new Uint16Array(POINTS);
  for (let i = 0; i < POINTS; i++) order[i] = i;

  let w = 0;
  let h = 0;
  let dpr = 1;
  function resize(): void {
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---- estado ----
  let state: AgentVisualState = "idle";
  let warm = false;
  const mood = { ...MOODS.idle };
  let warmMix = 0;
  let yaw = 0;
  let tiltX = 0; // inclinação atual (segue o mouse com atraso)
  let tiltY = 0;
  let phase = 0;

  // mouse em coordenadas -1..1 relativas à esfera; null = fora
  let mouse: { x: number; y: number } | null = null;
  let hover = 0; // 0..1, sobe quando o mouse está em cima
  const ripples: Ripple[] = [];

  function toSphere(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    const R = Math.min(r.width, r.height) * 0.44;
    return { x: (e.clientX - r.left - r.width / 2) / R, y: (e.clientY - r.top - r.height / 2) / R };
  }
  // mouse vale na janela toda, para a esfera "olhar" para o cursor mesmo de longe
  window.addEventListener("pointermove", (e) => (mouse = toSphere(e)));
  document.addEventListener("pointerleave", () => (mouse = null));
  canvas.addEventListener("pointerdown", (e) => {
    const m = toSphere(e);
    const d2 = m.x * m.x + m.y * m.y;
    if (d2 > 1) return;
    // ponto da tela -> ponto na superfície, desfazendo a rotação atual
    const v = unrotate(m.x, m.y, Math.sqrt(1 - d2));
    ripples.push({ ...v, born: performance.now() / 1000 });
    if (ripples.length > 4) ripples.shift();
  });

  // rotação: yaw (em volta do eixo y), depois inclinação em x e y
  let cy = 1, syw = 0, cx = 1, sxw = 0, cz = 1, szw = 0;
  function rotate(x: number, y: number, z: number): [number, number, number] {
    // yaw
    let x1 = x * cy + z * syw;
    let z1 = -x * syw + z * cy;
    // pitch (eixo x)
    const y2 = y * cx - z1 * sxw;
    const z2 = y * sxw + z1 * cx;
    // roll leve (eixo y de novo, pelo mouse na horizontal)
    const x3 = x1 * cz + z2 * szw;
    const z3 = -x1 * szw + z2 * cz;
    return [x3, y2, z3];
  }
  function unrotate(x: number, y: number, z: number): { x: number; y: number; z: number } {
    const x1 = x * cz - z * szw;
    const z1 = x * szw + z * cz;
    const y2 = y * cx + z1 * sxw;
    const z2 = -y * sxw + z1 * cx;
    return { x: x1 * cy - z2 * syw, y: y2, z: x1 * syw + z2 * cy };
  }

  let last = performance.now() / 1000;
  function frame(): void {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last);
    last = now;

    // estado anda devagar até o alvo (troca suave)
    const target = MOODS[state];
    const k = 1 - Math.exp(-dt * 3);
    mood.speed = lerp(mood.speed, target.speed, k);
    mood.amp = lerp(mood.amp, target.amp, k);
    mood.width = lerp(mood.width, target.width, k);
    mood.spin = lerp(mood.spin, target.spin, k);
    mood.pulse = lerp(mood.pulse, target.pulse, k);
    warmMix = lerp(warmMix, warm || state === "think" ? 1 : 0, k);

    const near = mouse ? Math.max(0, 1 - (Math.hypot(mouse.x, mouse.y) - 1) / 1.5) : 0;
    hover = lerp(hover, Math.min(1, near), 1 - Math.exp(-dt * 6));

    phase += dt * mood.speed;
    yaw += dt * mood.spin * (1 + hover * 0.6);
    const mx = mouse ? Math.max(-2, Math.min(2, mouse.x)) : 0;
    const my = mouse ? Math.max(-2, Math.min(2, mouse.y)) : 0;
    const kt = 1 - Math.exp(-dt * 4);
    tiltX = lerp(tiltX, -0.18 - my * 0.22, kt);
    tiltY = lerp(tiltY, mx * 0.3, kt);
    cy = Math.cos(yaw); syw = Math.sin(yaw);
    cx = Math.cos(tiltX); sxw = Math.sin(tiltX);
    cz = Math.cos(tiltY); szw = Math.sin(tiltY);

    // fala: a onda "respira" em pulsos curtos
    const talk = mood.pulse * (0.5 + 0.5 * Math.sin(now * 9) * Math.sin(now * 3.1));
    const amp = mood.amp * (1 + talk * 0.35);
    const bandW = 0.1 * mood.width * (1 + talk * 0.4);
    const haloW = 0.27 * mood.width;

    // cursor projetado na superfície (se estiver em cima da esfera)
    let cur: { x: number; y: number; z: number } | null = null;
    if (mouse) {
      const d2 = mouse.x * mouse.x + mouse.y * mouse.y;
      if (d2 < 1.2) {
        const z = Math.sqrt(Math.max(0, 1 - d2));
        cur = { x: mouse.x, y: mouse.y, z };
      }
    }

    const accent = mix(ACCENT, ACCENT_WARM, warmMix);
    const R = Math.min(w, h) * 0.44;
    const cxS = w / 2;
    const cyS = h / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // posições na tela
    for (let i = 0; i < POINTS; i++) {
      const [x, y, z] = rotate(px[i], py[i], pz[i]);
      sx[i] = x;
      sy[i] = y;
      sz[i] = z;
    }
    order.sort((a, b) => sz[a] - sz[b]);

    for (let n = 0; n < POINTS; n++) {
      const i = order[n];
      const z = sz[i];
      const depth = (z + 1) / 2; // 0 atrás, 1 na frente

      // faixa principal: latitude que segue uma onda em volta da esfera
      const lo = lon[i];
      const center =
        amp * Math.sin(3 * lo + phase * 2.2) + amp * 0.45 * Math.sin(2 * lo - phase * 1.3 + 1.7) - 0.05;
      let d = lat[i] - center;

      // cursor puxa a faixa para perto dele
      let touch = 0;
      if (cur) {
        const dx = sx[i] - cur.x;
        const dy = sy[i] - cur.y;
        const dz = z - cur.z;
        touch = Math.exp(-(dx * dx + dy * dy + dz * dz) / 0.06) * hover;
        d *= 1 - touch * 0.6;
      }

      // ondulações do clique (anel que se espalha)
      let ring = 0;
      for (const r of ripples) {
        const age = now - r.born;
        if (age > 2.4) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, px[i] * r.x + py[i] * r.y + pz[i] * r.z)));
        const front = age * 1.6;
        ring += Math.exp(-((ang - front) ** 2) / 0.02) * (1 - age / 2.4);
      }

      const core = Math.exp(-(d * d) / (bandW * bandW));
      const halo = Math.exp(-(d * d) / (haloW * haloW));
      // segunda faixa, mais fraca, só em terracota
      const d2 = lat[i] - (center - 0.38 + 0.08 * Math.sin(lo * 2 - phase * 1.7));
      const halo2 = Math.exp(-(d2 * d2) / (0.09 * 0.09)) * 0.65;

      const heat = Math.min(1, Math.max(halo, halo2) + touch * 0.5 + ring * 0.6);
      const dark = Math.min(1, core * 0.95 + touch * 0.35 + ring * 0.5);

      let c = mix(BASE, accent, heat);
      c = mix(c, CORE, dark);

      const size = Math.max(0.45, (0.5 + depth * 0.85) * (1 + heat * 0.6 + dark * 1.3 + touch * 0.8 + ring * 0.6) * (R / 210));
      const alpha = (0.06 + Math.pow(depth, 1.3) * 0.94) * (0.6 + 0.4 * Math.max(heat, dark, 0.3));

      ctx.fillStyle = `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${alpha.toFixed(3)})`;
      const X = cxS + sx[i] * R;
      const Y = cyS + sy[i] * R;
      ctx.beginPath();
      ctx.arc(X, Y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let j = ripples.length - 1; j >= 0; j--) if (now - ripples[j].born > 2.4) ripples.splice(j, 1);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const api: AgentVisual = {
    setState(s) {
      state = s;
    },
    setWarm(on) {
      warm = on;
    },
    getColor() {
      const c = mix(ACCENT, ACCENT_WARM, warmMix);
      return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
    },
  };
  return api;
};
