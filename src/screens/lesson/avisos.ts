// O aviso no canto da sessão é um só. O do Slack (pedido de aprovação, encaminhamento) leva ao roteiro da demo,
// então a tarefa nova não o tampa: espera ele sumir (revisão do #223). Slack troca qualquer aviso, como antes.

export interface Aviso {
  tipo: "slack" | "tarefa";
  text: string;
  link: { href: string; target: string; label: string };
}

interface Timers {
  ms: number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/** `mostrar(null)` esconde o aviso. */
export function createAvisos(mostrar: (a: Aviso | null) => void, t: Timers) {
  let atual: Aviso | null = null;
  let timer = 0;
  const fila: Aviso[] = [];
  const exibir = (a: Aviso | null) => {
    atual = a;
    mostrar(a);
    t.clearTimeout(timer);
    if (a) timer = t.setTimeout(() => exibir(fila.shift() ?? null), t.ms);
  };
  return {
    avisar(a: Aviso): void {
      if (a.tipo === "tarefa" && atual?.tipo === "slack") fila.push(a);
      else exibir(a);
    },
  };
}
