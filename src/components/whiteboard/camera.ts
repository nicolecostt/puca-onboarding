// Câmera do quadro: onde o quadro (em px do Figma) aparece na tela. Um ponto do quadro p vai para a tela em
// p · escala + (x, y). A tela infinita é só isso: a pessoa e a Puca mexem na câmera, nunca nos nós.

export interface Camera {
  x: number;
  y: number;
  escala: number;
}
export interface Ponto {
  x: number;
  y: number;
}
/** Retângulo em px do quadro. */
export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Tamanho da área visível, em px da tela. */
export interface Viewport {
  w: number;
  h: number;
}

export const ESCALA_MIN = 0.25;
export const ESCALA_MAX = 4;
/** Ao ajustar, o quadro não cresce além disso (um quadro com poucos nós não vira um zoom gigante). */
export const ESCALA_AJUSTE_MAX = 1.6;

const limitar = (s: number) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, s));

export function paraTela(cam: Camera, p: Ponto): Ponto {
  return { x: p.x * cam.escala + cam.x, y: p.y * cam.escala + cam.y };
}

export function paraQuadro(cam: Camera, p: Ponto): Ponto {
  return { x: (p.x - cam.x) / cam.escala, y: (p.y - cam.y) / cam.escala };
}

/** Enquadra a caixa no centro da tela. */
export function ajustar(c: Caixa, v: Viewport): Camera {
  const escala = Math.min(v.w / c.w, v.h / c.h, ESCALA_AJUSTE_MAX);
  return { escala, x: v.w / 2 - (c.x + c.w / 2) * escala, y: v.h / 2 - (c.y + c.h / 2) * escala };
}

/** Multiplica o zoom por `fator`, deixando parado o ponto do quadro que está sob `ponto` (px da tela). */
export function zoomNoPonto(cam: Camera, ponto: Ponto, fator: number): Camera {
  const escala = limitar(cam.escala * fator);
  const q = paraQuadro(cam, ponto);
  return { escala, x: ponto.x - q.x * escala, y: ponto.y - q.y * escala };
}

export function moverPor(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

/** Põe o centro da caixa no centro da tela, com o mesmo zoom. */
export function centrarEm(cam: Camera, c: Caixa, v: Viewport): Camera {
  return { escala: cam.escala, x: v.w / 2 - (c.x + c.w / 2) * cam.escala, y: v.h / 2 - (c.y + c.h / 2) * cam.escala };
}

/** A caixa inteira aparece na tela. */
export function visivel(cam: Camera, c: Caixa, v: Viewport): boolean {
  const a = paraTela(cam, c);
  const b = paraTela(cam, { x: c.x + c.w, y: c.y + c.h });
  return a.x >= 0 && a.y >= 0 && b.x <= v.w && b.y <= v.h;
}
