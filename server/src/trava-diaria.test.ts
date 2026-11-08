import { describe, expect, it } from "vitest";
import { diaEmSaoPaulo, TravaDiaria } from "./trava-diaria";

describe("TravaDiaria", () => {
  it("conta até o limite e recusa o que passaria dele", () => {
    const t = new TravaDiaria(10);
    expect(t.usa(6)).toBe(true);
    expect(t.usa(5)).toBe(false);
    expect(t.usa(4)).toBe(true);
    expect(t.esgotada()).toBe(true);
    expect(t.usa()).toBe(false);
  });

  it("zera à meia-noite de São Paulo, não à de UTC", () => {
    let now = new Date("2026-11-09T02:30:00Z"); // 23:30 do dia 8 em São Paulo
    const t = new TravaDiaria(1, () => now);
    expect(t.usa()).toBe(true);
    now = new Date("2026-11-09T02:59:00Z");
    expect(t.usa()).toBe(false);
    now = new Date("2026-11-09T03:01:00Z"); // 00:01 do dia 9
    expect(t.usa()).toBe(true);
    expect(diaEmSaoPaulo(now)).toBe("2026-11-09");
  });

  it("devolve o que foi reservado e não usado", () => {
    const t = new TravaDiaria(10);
    expect(t.usa(10)).toBe(true);
    t.devolve(10);
    expect(t.usa(5)).toBe(true);
  });

  it("sem limite (Infinity) nunca recusa", () => {
    const t = new TravaDiaria(Infinity);
    expect(t.usa(1e9)).toBe(true);
    expect(t.esgotada()).toBe(false);
  });
});
