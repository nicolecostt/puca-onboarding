// Eventos que os componentes disparam no document, com tipos.
// Ex.: document.addEventListener("callbar:pause", (e) => e.detail.on)

export type CallBarAction = "pause" | "control" | "mute" | "chat" | "end" | "start";

export interface CallBarEventDetail {
  /** Estado depois do clique, para botões que ligam/desligam (pause, control, mute, chat). */
  on?: boolean;
}

declare global {
  interface DocumentEventMap {
    "callbar:pause": CustomEvent<CallBarEventDetail>;
    "callbar:control": CustomEvent<CallBarEventDetail>;
    "callbar:mute": CustomEvent<CallBarEventDetail>;
    "callbar:chat": CustomEvent<CallBarEventDetail>;
    "callbar:end": CustomEvent<CallBarEventDetail>;
    "callbar:start": CustomEvent<CallBarEventDetail>;
    "chatpanel:change": CustomEvent<{ open: boolean }>;
    "chatpanel:send": CustomEvent<{ text: string }>;
    "onboarding:answer": CustomEvent<{ key: string; value: string; answers: Record<string, string> }>;
    /** Sessão no quadro: entrou num momento / começou um passo da jornada. */
    "journey:moment": CustomEvent<{ id: string; title: string }>;
    "journey:step": CustomEvent<{ id: string; moment: string }>;
    /** Painel "Sua jornada": a pessoa clicou num momento (a tela pula para o início dele). */
    "journeypanel:pick": CustomEvent<{ id: string }>;
    /** A câmera da Puca mudou de lugar ou de visibilidade (a barra presa nela acompanha). */
    "agentcam:move": CustomEvent<{ rect: DOMRect; visible: boolean }>;
  }
}

export function emit<K extends keyof DocumentEventMap>(
  type: K,
  detail: DocumentEventMap[K] extends CustomEvent<infer D> ? D : never,
): void {
  document.dispatchEvent(new CustomEvent(type, { detail }));
}
