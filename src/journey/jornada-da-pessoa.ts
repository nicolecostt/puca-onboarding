// Jornada da pessoa: a jornada marcada pela calibragem da call inicial (o que é novo, o que é revisão,
// o que a jornada pula) e os próximos passos. Função pura, sem DOM e sem storage. Contrato em docs/contratos.md.
// Nenhum momento sai da jornada: o runner segue o mesmo JSON; o estado só marca.
import { CALIBRAGEM_TEMAS, itemDoTema } from "./calibragem";
import type { Calibragem, EstadoMomento, ItemCalibragem, Journey, JornadaDaPessoa, MomentoDaPessoa, Nivel, Tema } from "./types";

const ORDEM_NIVEL: Record<Nivel, number> = { nao_conhece: 0, ja_ouviu: 1, usa: 2, domina: 3 };

const MOTIVO_CHECAGEM = {
  entendeu: "Na checagem da aula, ficou claro.",
  rever: "Na checagem da aula, vale rever este assunto.",
};

const MOTIVO_FIXO: Record<EstadoMomento, string> = {
  aprender: "Assunto novo para você.",
  revisar: "Você já conhece: passamos mais rápido.",
  ja_conhece: "Você disse que domina esse assunto.",
  fora: "Você já é da Tail: a aula vai direto ao seu time.",
};

/** Temas de cada momento, na ordem de CALIBRAGEM_TEMAS. */
function temasPorMomento(): Map<string, Tema[]> {
  const map = new Map<string, Tema[]>();
  for (const [tema, { momentos }] of Object.entries(CALIBRAGEM_TEMAS) as [Tema, { momentos: string[] }][]) {
    for (const id of momentos) map.set(id, [...(map.get(id) ?? []), tema]);
  }
  return map;
}

/** O item que decide o momento: o de menor nível (no empate, o primeiro tema). */
function itemQueDecide(c: Calibragem, temas: Tema[]): ItemCalibragem | undefined {
  let menor: ItemCalibragem | undefined;
  for (const t of temas) {
    const item = itemDoTema(c, t);
    if (item && (!menor || ORDEM_NIVEL[item.nivel] < ORDEM_NIVEL[menor.nivel])) menor = item;
  }
  return menor;
}

function estadoDoItem(item: ItemCalibragem): EstadoMomento {
  if (item.nivel === "domina") return item.certeza === "alta" ? "ja_conhece" : "revisar";
  if (item.nivel === "usa") return "revisar";
  return "aprender";
}

/** Monta a jornada da pessoa a partir da jornada e da calibragem. */
export function montarJornadaDaPessoa(journey: Journey, calibragem: Calibragem): JornadaDaPessoa {
  const temasDe = temasPorMomento();
  const transicao = calibragem.perfil.vinculo === "transicao";

  const momentos: MomentoDaPessoa[] = journey.moments.map((m) => {
    const temas = temasDe.get(m.id) ?? [];
    const base = { id: m.id, titulo: m.title, objetivo: m.goal, temas };
    // quem já é da empresa não passa pela parte institucional (o passo bv-oi desvia dela)
    if (transicao && temas.includes("empresa")) return { ...base, estado: "fora", motivo: MOTIVO_FIXO.fora };
    // a checagem da aula vale mais que a call: rever em qualquer tema do momento marca "revisar"
    const checados = temas.map((t) => itemDoTema(calibragem, t)?.checagem).filter((x) => x !== undefined);
    if (checados.includes("rever")) return { ...base, estado: "revisar", motivo: MOTIVO_CHECAGEM.rever };
    if (checados.includes("entendeu")) return { ...base, estado: "ja_conhece", motivo: MOTIVO_CHECAGEM.entendeu };
    const item = itemQueDecide(calibragem, temas);
    if (!item) return { ...base, estado: "aprender", motivo: "" };
    const estado = estadoDoItem(item);
    const motivo = item.evidencia ? `Você disse: “${item.evidencia}”` : MOTIVO_FIXO[estado];
    return { ...base, estado, motivo };
  });

  return { versao: 1, objetivos: [...calibragem.objetivos], momentos };
}

/** O que falta: momentos não vistos, sem o atual e sem os que ficaram fora, na ordem da jornada. */
export function proximosPassos(jornada: JornadaDaPessoa, visitados: readonly string[], atual: string | null): MomentoDaPessoa[] {
  const vistos = new Set(visitados);
  return jornada.momentos.filter((m) => m.estado !== "fora" && m.id !== atual && !vistos.has(m.id));
}
