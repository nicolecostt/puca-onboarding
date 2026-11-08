import type { ContextoKota, Regra } from "./contexto";

export function checarKota(ctx: ContextoKota, regras: Regra[]): { erros: string[]; pulas: string[] } {
  const erros: string[] = [];
  const pulas: string[] = [];
  for (const r of regras) {
    if (r.precisaRepo && !ctx.repo) pulas.push(`${r.nome}: sem --repo`);
    else erros.push(...rodar(r, ctx).map((e) => `[${r.nome}] ${e}`));
  }
  return { erros, pulas };
}

function rodar(r: Regra, ctx: ContextoKota): string[] {
  try {
    return r.checar(ctx);
  } catch (e) {
    return [`falhou: ${e instanceof Error ? e.message : String(e)}`];
  }
}
