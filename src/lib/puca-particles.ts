// Partículas coloridas do Puca no fundo da página: os pontos da esfera soltos, subindo devagar.
// Ficam atrás de tudo: somem ao passar por trás dos elementos que o seletor `occluders` aponta
// (textos, botões, a esfera…) e reaparecem do outro lado. Usadas na landing e nas telas do app.

export interface PucaParticlesOptions {
  /** Seletor dos elementos que ficam na frente das partículas. */
  occluders: string;
  /** Seletor dos que são redondos (a esfera): a partícula some só dentro do círculo. */
  round?: string;
  /** Máximo de partículas na tela (padrão 60). */
  max?: number;
}

export function mountPucaParticles(canvas: HTMLCanvasElement, opts: PucaParticlesOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = Math.round(Math.min(opts.max ?? 60, (innerWidth * innerHeight) / 24000));
  const dots = Array.from({ length: count }, () => ({
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

  // onde estão os elementos da frente; medido de tempos em tempos (o texto da tela muda)
  const PAD = 14;
  const blockers: { l: number; t: number; r: number; b: number; round: boolean }[] = [];
  let measuredAt = -1;
  const measure = (now: number) => {
    if (now - measuredAt < 250) return;
    measuredAt = now;
    blockers.length = 0;
    document.querySelectorAll<HTMLElement>(opts.occluders).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -PAD || r.top > innerHeight + PAD || r.width === 0) return;
      const round = !!opts.round && el.matches(opts.round);
      blockers.push({ l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD, round });
    });
  };
  const hidden = (x: number, y: number) =>
    blockers.some((k) => {
      if (x < k.l || x > k.r || y < k.t || y > k.b) return false;
      if (!k.round) return true;
      const cx = (k.l + k.r) / 2;
      const cy = (k.t + k.b) / 2;
      const rad = Math.min(k.r - k.l, k.b - k.t) / 2;
      return (x - cx) ** 2 + (y - cy) ** 2 < rad * rad;
    });
  addEventListener("scroll", () => (measuredAt = -1), { passive: true });
  addEventListener("resize", () => (measuredAt = -1));

  const draw = (dt: number) => {
    measure(performance.now());
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
    measuredAt = -1;
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
