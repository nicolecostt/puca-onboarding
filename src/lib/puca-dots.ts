// Pontinhos coloridos do Puca: versão pequena dele, no lugar da esfera em espaços pequenos (aviso, legenda).
// Muitas bolinhas pequenas com a cor da faixa se movem dentro de um círculo e interagem: são puxadas para o
// centro, se empurram quando chegam perto e, ao passar perto, uma puxa a cor da outra (as cores se misturam).
// Não gira. Só anima quando aparece na tela; com movimento reduzido, fica parada.

interface Dot {
  x: number; // posição em fração do raio, centro em 0
  y: number;
  hx: number; // lugar de origem no disco: a bolinha é puxada de volta para ele (o conjunto fica redondo)
  hy: number;
  vx: number;
  vy: number;
  hue: number;
  base: number; // tom de origem (pelo ângulo no disco): o arco-íris não se perde de tanto misturar
  size: number; // raio em fração do raio do círculo
}

export function mountPucaDots(container: HTMLElement, opts: { count?: number } = {}): void {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = opts.count ?? 28;
  // lugares de origem espalhados por igual num disco (espiral de Fibonacci)
  const golden = Math.PI * (3 - Math.sqrt(5));
  const dots: Dot[] = Array.from({ length: count }, (_, i) => {
    const d = Math.sqrt((i + 0.5) / count) * 0.7;
    const a = i * golden;
    const hx = Math.cos(a) * d;
    const hy = Math.sin(a) * d;
    const base = ((Math.atan2(hy, hx) / (Math.PI * 2)) * 360 + 360) % 360;
    return {
      x: hx + (Math.random() - 0.5) * 0.2,
      y: hy + (Math.random() - 0.5) * 0.2,
      hx,
      hy,
      vx: 0,
      vy: 0,
      hue: base,
      base,
      size: 0.06 + Math.random() * 0.04,
    };
  });

  let size = 0;
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    size = Math.min(container.clientWidth, container.clientHeight);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // passo da simulação: puxão para o centro, empurrão entre vizinhos, um pouco de ruído e atrito
  const step = (dt: number, t: number) => {
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      a.vx += (a.hx - a.x) * 2.2 * dt + Math.sin(t * 1.7 + i * 1.7) * 0.5 * dt;
      a.vy += (a.hy - a.y) * 2.2 * dt + Math.cos(t * 1.5 + i * 2.3) * 0.5 * dt;
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const near = (a.size + b.size) * 1.6;
        if (d2 < near * near && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((near - d) / near) * 1.4 * dt;
          a.vx -= (dx / d) * push;
          a.vy -= (dy / d) * push;
          b.vx += (dx / d) * push;
          b.vy += (dy / d) * push;
          // as cores se puxam (pelo caminho mais curto no círculo de tons)
          const diff = ((b.hue - a.hue + 540) % 360) - 180;
          a.hue = (a.hue + diff * 0.02 + 360) % 360;
          b.hue = (b.hue - diff * 0.02 + 360) % 360;
        }
      }
    }
    for (const a of dots) {
      a.vx *= 1 - 0.8 * dt;
      a.vy *= 1 - 0.8 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      // mantém dentro do círculo
      const r = Math.hypot(a.x, a.y);
      const max = 0.86 - a.size;
      if (r > max) {
        a.x *= max / r;
        a.y *= max / r;
        a.vx *= -0.4;
        a.vy *= -0.4;
      }
      // o arco-íris anda devagar e cada bolinha volta aos poucos ao seu tom
      a.base = (a.base + 12 * dt) % 360;
      const back = ((a.base - a.hue + 540) % 360) - 180;
      a.hue = (a.hue + back * 0.6 * dt + 360) % 360;
    }
  };

  const draw = () => {
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "multiply"; // onde se sobrepõem, as cores se misturam
    for (const d of dots) {
      const x = r + d.x * r;
      const y = r + d.y * r;
      const rad = d.size * r;
      ctx.fillStyle = `hsla(${d.hue}, 80%, 60%, 0.85)`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  new ResizeObserver(() => {
    resize();
    draw();
  }).observe(container);
  resize();
  // começa já misturado, não com as bolinhas recém-espalhadas
  for (let k = 0; k < 90; k++) step(1 / 30, k / 30);
  draw();
  if (reduceMotion) return;

  let running = false;
  let onScreen = true;
  let last = 0;
  const frame = (now: number) => {
    if (!onScreen || document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt, now / 1000);
    draw();
    requestAnimationFrame(frame);
  };
  const wake = () => {
    if (running || !onScreen || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wake();
  }).observe(container);
  document.addEventListener("visibilitychange", wake);
  wake();
}
