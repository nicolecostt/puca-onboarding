import { describe, expect, it } from "vitest";
import { apiUrl } from "./api";

describe("apiUrl", () => {
  it("sem base, o caminho segue relativo (npm run dev)", () => {
    expect(apiUrl("/api/ask", "")).toBe("/api/ask");
  });
  it("com base, põe o servidor na frente (app para Mac)", () => {
    expect(apiUrl("/api/tts/abc", "https://orbis-puca.fly.dev")).toBe("https://orbis-puca.fly.dev/api/tts/abc");
  });
  it("base com barra no fim não dobra a barra", () => {
    expect(apiUrl("/api/health", "https://orbis-puca.fly.dev/")).toBe("https://orbis-puca.fly.dev/api/health");
  });
  it("endereço completo passa direto", () => {
    expect(apiUrl("https://cdn.exemplo.com/a.pcm", "https://orbis-puca.fly.dev")).toBe("https://cdn.exemplo.com/a.pcm");
  });
});
