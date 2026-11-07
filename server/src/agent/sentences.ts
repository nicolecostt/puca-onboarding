// Corta texto em streaming em frases, para cada uma ir ao TTS assim que fecha.

const END = /[.!?…](?=\s|$)/;
// ponytail: heurística simples; "Sr." ou "1.5" podem cortar cedo. Trocar por Intl.Segmenter se incomodar.
const MIN_CHARS = 8;

export class SentenceSplitter {
  private buf = "";

  /** Recebe um pedaço de texto e devolve as frases que fecharam. */
  push(chunk: string): string[] {
    this.buf += chunk;
    const out: string[] = [];
    for (;;) {
      const m = END.exec(this.buf.slice(MIN_CHARS));
      if (!m) break;
      const cut = MIN_CHARS + m.index + 1;
      const s = this.buf.slice(0, cut).trim();
      if (s) out.push(s);
      this.buf = this.buf.slice(cut);
    }
    return out;
  }

  /** O que sobrou no fim do stream. */
  flush(): string | null {
    const s = this.buf.trim();
    this.buf = "";
    return s || null;
  }
}
