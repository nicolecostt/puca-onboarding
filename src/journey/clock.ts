// Relógio da aula: o tempo só corre com a call ativa (pausar e encerrar seguram tudo).
// Mesmo padrão do wait() da call de entrevista, com cancelamento para reiniciar a aula.

export class Cancelled extends Error {
  constructor() {
    super("aula reiniciada");
  }
}

export interface Clock {
  readonly running: boolean;
  setPaused(on: boolean): void;
  setEnded(on: boolean): void;
  /** Espera `ms` de tempo de call ativa. Rejeita com Cancelled se a aula for reiniciada. */
  wait(ms: number): Promise<void>;
  /** Espera a call voltar a ficar ativa. */
  whenRunning(): Promise<void>;
  /** Cancela todas as esperas pendentes (troca de perfil, reinício). */
  cancel(): void;
  /** Segundos de call ativa desde o início. */
  readonly seconds: number;
}

const TICK = 50;

export function createClock(): Clock {
  let paused = false;
  let ended = false;
  let elapsed = 0;
  let generation = 0;
  const timers = new Set<ReturnType<typeof setInterval>>();

  const running = () => !paused && !ended;

  setInterval(() => {
    if (running()) elapsed += 1;
  }, 1000);

  function wait(ms: number): Promise<void> {
    const gen = generation;
    return new Promise((resolve, reject) => {
      let left = ms;
      const t = setInterval(() => {
        if (gen !== generation) {
          clearInterval(t);
          timers.delete(t);
          reject(new Cancelled());
          return;
        }
        if (!running()) return;
        left -= TICK;
        if (left <= 0) {
          clearInterval(t);
          timers.delete(t);
          resolve();
        }
      }, TICK);
      timers.add(t);
    });
  }

  return {
    get running() {
      return running();
    },
    get seconds() {
      return elapsed;
    },
    setPaused(on) {
      paused = on;
    },
    setEnded(on) {
      ended = on;
    },
    wait,
    whenRunning: () => wait(0),
    cancel() {
      generation++;
      elapsed = 0;
    },
  };
}
