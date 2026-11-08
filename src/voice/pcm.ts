/** PCM signed 16-bit little-endian → Float32 in [-1, 1]. A trailing odd byte is ignored. */
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const count = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true) / 32768;
  return out;
}

/** Quanto esperar o navegador liberar o áudio antes de seguir sem som (só com legenda). */
export const AUDIO_RESUME_TIMEOUT_MS = 1000;

/**
 * Tenta liberar o áudio (`AudioContext.resume`) sem esperar para sempre: sem um gesto que o navegador reconheça, o
 * `resume()` pode ficar pendente. Devolve se o contexto ficou rodando dentro do limite.
 */
export async function resumeWithin(ctx: { resume(): Promise<void>; readonly state: string }, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<void>((r) => (timer = setTimeout(r, ms)));
  await Promise.race([ctx.resume().catch(() => undefined), limite]);
  clearTimeout(timer);
  return ctx.state === "running";
}
