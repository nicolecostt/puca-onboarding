import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_RESUME_TIMEOUT_MS, pcm16ToFloat32, resumeWithin } from "./pcm";

describe("pcm16ToFloat32", () => {
  it("converts little-endian signed 16-bit samples to floats in [-1, 1]", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80]); // 0, 32767, -32768
    const out = pcm16ToFloat32(bytes);
    expect(out.length).toBe(3);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(32767 / 32768, 6);
    expect(out[2]).toBe(-1);
  });

  it("ignores a trailing odd byte", () => {
    expect(pcm16ToFloat32(new Uint8Array([1, 0, 9])).length).toBe(1);
  });
});

describe("resumeWithin", () => {
  afterEach(() => vi.useRealTimers());

  it("desiste no limite quando o navegador segura o áudio", async () => {
    vi.useFakeTimers();
    const ctx = { state: "suspended", resume: () => new Promise<void>(() => {}) };
    const ok = resumeWithin(ctx, AUDIO_RESUME_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS);
    await expect(ok).resolves.toBe(false);
  });

  it("devolve true quando o contexto passa a rodar", async () => {
    const ctx = {
      state: "suspended",
      async resume() {
        this.state = "running";
      },
    };
    await expect(resumeWithin(ctx, AUDIO_RESUME_TIMEOUT_MS)).resolves.toBe(true);
  });

  it("resume que rejeita conta como bloqueado", async () => {
    const ctx = { state: "suspended", resume: () => Promise.reject(new Error("NotAllowedError")) };
    await expect(resumeWithin(ctx, AUDIO_RESUME_TIMEOUT_MS)).resolves.toBe(false);
  });

  it("o limite é de 1 s", () => {
    expect(AUDIO_RESUME_TIMEOUT_MS).toBe(1000);
  });
});
