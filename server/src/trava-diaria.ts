// Trava diária global de um provedor pago (docs/stack.md §5.3): conta o uso do dia e recusa o que passar do limite.
// Fica na memória do processo (uma máquina só); reiniciar zera a contagem do dia.

/** Dia corrente em São Paulo (AAAA-MM-DD): a trava vira à meia-noite do time. */
export function diaEmSaoPaulo(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export class TravaDiaria {
  private dia = "";
  private usado = 0;

  constructor(
    readonly limite: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private vira(): void {
    const hoje = diaEmSaoPaulo(this.now());
    if (hoje !== this.dia) {
      this.dia = hoje;
      this.usado = 0;
    }
  }

  /** Reserva `n` unidades do dia. false = passaria do limite (nada é contado). */
  usa(n = 1): boolean {
    this.vira();
    if (this.usado + n > this.limite) return false;
    this.usado += n;
    return true;
  }

  /** Devolve `n` unidades reservadas e não usadas (ex.: síntese que falhou antes do primeiro byte). */
  devolve(n: number): void {
    this.vira();
    this.usado = Math.max(0, this.usado - n);
  }

  /** true quando o limite do dia já foi atingido. */
  esgotada(): boolean {
    this.vira();
    return this.usado >= this.limite;
  }
}
