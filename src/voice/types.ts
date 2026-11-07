// Tipos de voz compartilhados entre o browser e o servidor.

/** Tempo de uma palavra falada, em ms desde o início daquele áudio. */
export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

/** Legenda ao vivo da fala da pessoa (Deepgram, no browser). */
export interface SttCaption {
  kind: "interim" | "final";
  text: string;
  words: { word: string; start_ms: number; end_ms: number; confidence: number }[];
  speech_final: boolean;
}

/** Resposta de POST /api/voice/token. */
export interface VoiceTokenResponse {
  token: string;
  expires_in: number;
  ws_url: string;
  params: Record<string, string>;
}

/** Player de áudio do agente no browser. */
export interface SpeechPlayer {
  /** Resolve quando o áudio termina (ou é parado). */
  play(audio_url: string, signal?: AbortSignal): Promise<void>;
  stop(): void;
  /** Recebe as palavras do áudio atual na hora em que são faladas (legenda). */
  onWord(cb: (word: WordTiming) => void): () => void;
  /** Amplitude de saída 0..1 (para o visual do agente). */
  level(): number;
}
