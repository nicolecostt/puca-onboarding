import { describe, expect, it } from "vitest";
import { ESCALA_MAX, ESCALA_MIN, ajustar, centrarEm, moverPor, paraTela, visivel, zoomNoPonto } from "../camera";

const tela = { w: 1000, h: 600 };

describe("câmera do quadro", () => {
  it("ajustar dá o mesmo enquadramento do fit() de antes", () => {
    // conteúdo 800×400 a partir de (100, 50): escala = min(1000/800, 600/400, 1.6) = 1.25
    const cam = ajustar({ x: 100, y: 50, w: 800, h: 400 }, tela);
    expect(cam.escala).toBeCloseTo(1.25);
    expect(cam.x).toBeCloseTo(1000 / 2 - (100 + 400) * 1.25);
    expect(cam.y).toBeCloseTo(600 / 2 - (50 + 200) * 1.25);
  });

  it("ajustar não passa de 1,6 num conteúdo pequeno", () => {
    expect(ajustar({ x: 0, y: 0, w: 100, h: 100 }, tela).escala).toBe(1.6);
  });

  it("zoomNoPonto mantém parado o ponto do quadro que está sob o cursor", () => {
    const cam = { x: 40, y: -20, escala: 1 };
    const cursor = { x: 300, y: 200 };
    const antes = { x: (cursor.x - cam.x) / cam.escala, y: (cursor.y - cam.y) / cam.escala };
    const depois = zoomNoPonto(cam, cursor, 2);
    expect(depois.escala).toBe(2);
    expect(paraTela(depois, antes).x).toBeCloseTo(cursor.x);
    expect(paraTela(depois, antes).y).toBeCloseTo(cursor.y);
  });

  it("zoomNoPonto respeita os limites de escala", () => {
    expect(zoomNoPonto({ x: 0, y: 0, escala: 3 }, { x: 0, y: 0 }, 10).escala).toBe(ESCALA_MAX);
    expect(zoomNoPonto({ x: 0, y: 0, escala: 0.3 }, { x: 0, y: 0 }, 0.1).escala).toBe(ESCALA_MIN);
  });

  it("moverPor desloca a câmera em px da tela", () => {
    expect(moverPor({ x: 10, y: 20, escala: 2 }, -5, 7)).toEqual({ x: 5, y: 27, escala: 2 });
  });

  it("centrarEm põe o centro da caixa no centro da tela, sem mudar o zoom", () => {
    const cam = centrarEm({ x: 0, y: 0, escala: 2 }, { x: 900, y: 700, w: 100, h: 50 }, tela);
    expect(cam.escala).toBe(2);
    const centro = paraTela(cam, { x: 950, y: 725 });
    expect(centro.x).toBeCloseTo(500);
    expect(centro.y).toBeCloseTo(300);
  });

  it("visivel diz se a caixa inteira está na tela", () => {
    const cam = { x: 0, y: 0, escala: 1 };
    expect(visivel(cam, { x: 100, y: 100, w: 200, h: 100 }, tela)).toBe(true);
    expect(visivel(cam, { x: 1200, y: 100, w: 200, h: 100 }, tela)).toBe(false);
    expect(visivel(cam, { x: 900, y: 100, w: 200, h: 100 }, tela)).toBe(false); // cortada na borda
    expect(visivel(moverPor(cam, -400, 0), { x: 1200, y: 100, w: 200, h: 100 }, tela)).toBe(true);
  });
});
