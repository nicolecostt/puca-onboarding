// Corta texto em streaming em frases, para cada uma ir ao TTS assim que fecha.

const END = /[.!?…](?=\s|$)/;
// ponytail: heurística simples; "Sr." ou "1.5" podem cortar cedo. Trocar por Intl.Segmenter se incomodar.
const MIN_CHARS = 8;

// O modelo às vezes rotula a fala em vez de falar ("Pergunto: como prefere ser chamado?", "Puca: oi!").
// Tudo vira voz e legenda, então o rótulo sai do começo da frase, junto com as aspas que ele deixa em volta.
const ROTULO =
  /^\s*(?:(?:o\s+)?puca|pergunto|pergunta|minha pergunta(?:\s+é)?|próxima pergunta|resposta|respondo|explico|digo|falo|fala|comento|retomo|sigo|resumo|resumindo|em resumo)(?:\s*:\s*|\s+[–—-]\s+)/i; // hífen colado é palavra composta ("Pergunta-chave")

/** A frase sem rótulo no começo ("Pergunto:", "Puca:"…) e sem as aspas que sobram em volta dela. */
export function limparFala(frase: string): string {
  let s = frase;
  for (let i = 0; i < 2 && ROTULO.test(s); i++) s = s.replace(ROTULO, "");
  if (s === frase) return s.trim();
  // aspas só saem quando envolvem a fala inteira ("Pergunta: 'API' é o quê?" fica com as aspas)
  const par = /^["“”'‘’]\s*(.*?)\s*["“”'‘’]([.!?…]?)\s*$/.exec(s.trim());
  s = (par ? par[1] + par[2] : s).trim();
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

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
      const s = limparFala(this.buf.slice(0, cut));
      if (s) out.push(s);
      this.buf = this.buf.slice(cut);
    }
    return out;
  }

  /** O que sobrou no fim do stream. */
  flush(): string | null {
    const s = limparFala(this.buf);
    this.buf = "";
    return s || null;
  }
}
