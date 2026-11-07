// Valida uma jornada (JSON) antes de rodar. Além da forma, checa as regras de boas práticas
// do modelo de jornadas: ids e objetivos únicos, transições só para destinos que existem
// (passo do mesmo momento, ou início de outro momento a partir do último passo),
// passo "wait" com pergunta ou respostas sugeridas, ações só sobre nós do quadro em vigor.
import type { BoardSpec, Journey, Moment, View } from "./types";

export type ValidationResult = { ok: true; journey: Journey } | { ok: false; errors: string[] };

const ACTION_TYPES = new Set(["reveal", "highlight", "clear_highlight", "focus", "flow", "card", "close_card", "reset"]);
const DECISIONS = new Set(["auto", "wait", "select"]);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Vista em vigor de cada momento (sem `view`, herda a do momento anterior). */
export function effectiveViews(moments: Moment[]): (View | undefined)[] {
  let current: View | undefined;
  return moments.map((m) => (current = m.view ?? current));
}

function checkBoard(name: string, b: unknown, errors: string[]): void {
  if (!isObj(b) || !Array.isArray(b.nodes) || !Array.isArray(b.edges)) {
    errors.push(`quadro "${name}": precisa de nodes[] e edges[]`);
    return;
  }
  const ids = new Set<string>();
  for (const n of b.nodes as unknown[]) {
    if (!isObj(n) || !isStr(n.id) || !isStr(n.label) || typeof n.x !== "number" || typeof n.y !== "number") {
      errors.push(`quadro "${name}": nó inválido (precisa de id, label, x, y)`);
      continue;
    }
    if (ids.has(n.id)) errors.push(`quadro "${name}": nó "${n.id}" repetido`);
    ids.add(n.id);
  }
  for (const e of b.edges as unknown[]) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.from) || !isStr(e.to)) {
      errors.push(`quadro "${name}": aresta inválida (precisa de id, from, to)`);
      continue;
    }
    if (ids.has(e.id)) errors.push(`quadro "${name}": id "${e.id}" repetido`);
    ids.add(e.id);
    for (const end of [e.from, e.to]) {
      if (!(b.nodes as { id?: unknown }[]).some((n) => n.id === end)) {
        errors.push(`quadro "${name}": aresta "${e.id}" liga nó inexistente "${end}"`);
      }
    }
  }
}

export function validateJourney(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["a jornada precisa ser um objeto"] };
  if (input.version !== 1) errors.push("version precisa ser 1");
  for (const k of ["id", "title", "company"] as const) if (!isStr(input[k])) errors.push(`campo "${k}" obrigatório`);
  const agent = input.agent;
  if (!isObj(agent) || !isStr(agent.name) || !isObj(agent.guidelines)) {
    errors.push("agent precisa de name e guidelines");
  } else {
    for (const k of ["core_identity", "personality_and_tone", "safety_and_escalation"]) {
      if (!isStr(agent.guidelines[k])) errors.push(`agent.guidelines.${k} obrigatório`);
    }
  }
  if (!isObj(input.boards)) errors.push("boards precisa ser um objeto");
  else for (const [name, b] of Object.entries(input.boards)) checkBoard(name, b, errors);
  if (!Array.isArray(input.moments) || input.moments.length === 0) errors.push("moments precisa ter ao menos um momento");
  if (errors.length) return { ok: false, errors };

  // A partir daqui a forma básica está certa; checa as regras de conteúdo.
  const j = input as unknown as Journey;
  const momentIds = new Set<string>();
  const momentGoals = new Set<string>();
  const stepIds = new Set<string>();
  for (const m of j.moments) {
    if (!isStr(m.id) || !isStr(m.title) || !isStr(m.goal) || !Array.isArray(m.steps) || m.steps.length === 0) {
      errors.push(`momento "${String(m.id)}": precisa de id, title, goal e ao menos um passo`);
      continue;
    }
    if (momentIds.has(m.id)) errors.push(`momento "${m.id}" repetido`);
    momentIds.add(m.id);
    if (momentGoals.has(m.goal)) errors.push(`momento "${m.id}": objetivo repetido (o agente se perde com objetivos iguais)`);
    momentGoals.add(m.goal);
    const stepGoals = new Set<string>();
    for (const s of m.steps) {
      if (!isStr(s.id) || !isStr(s.goal) || !isStr(s.line)) {
        errors.push(`momento "${m.id}": passo sem id, goal ou line`);
        continue;
      }
      if (stepIds.has(s.id)) errors.push(`passo "${s.id}" repetido`);
      stepIds.add(s.id);
      if (stepGoals.has(s.goal)) errors.push(`passo "${s.id}": objetivo repetido no momento "${m.id}"`);
      stepGoals.add(s.goal);
    }
  }
  if (errors.length) return { ok: false, errors };

  const views = effectiveViews(j.moments);
  if (!views[0]) errors.push(`momento "${j.moments[0].id}": o primeiro momento precisa de view`);

  j.moments.forEach((m, mi) => {
    const view = views[mi];
    let board: BoardSpec | undefined;
    if (view?.mode === "board") {
      board = j.boards[view.board];
      if (!board) errors.push(`momento "${m.id}": quadro "${view.board}" não existe`);
    }
    const nodeIds = new Set(board?.nodes.map((n) => n.id) ?? []);
    const edgeIds = new Set(board?.edges.map((e) => e.id) ?? []);
    const where = (s: { id: string }) => `passo "${s.id}" (momento "${m.id}")`;

    m.steps.forEach((s, si) => {
      const decision = s.decision ?? "auto";
      if (!DECISIONS.has(decision)) errors.push(`${where(s)}: decision "${decision}" desconhecida`);

      for (const a of s.actions ?? []) {
        if (!ACTION_TYPES.has(a.type)) {
          errors.push(`${where(s)}: ação "${(a as { type: string }).type}" desconhecida`);
          continue;
        }
        if (!board) {
          errors.push(`${where(s)}: ação "${a.type}" num momento sem quadro`);
          continue;
        }
        const refs: string[] =
          a.type === "reveal" || a.type === "highlight" ? a.targets
          : a.type === "focus" ? (a.target ? [a.target] : [])
          : a.type === "card" ? [a.target]
          : a.type === "flow" ? a.path
          : [];
        for (const r of refs) {
          const ok = a.type === "flow" ? edgeIds.has(r) : a.type === "card" || a.type === "focus" ? nodeIds.has(r) : nodeIds.has(r) || edgeIds.has(r);
          if (!ok) errors.push(`${where(s)}: ação "${a.type}" cita "${r}", que não existe no quadro`);
        }
      }

      if (decision === "wait" && !s.line.trim().endsWith("?") && !s.suggested_replies?.length) {
        errors.push(`${where(s)}: passo "wait" precisa terminar em pergunta ou ter respostas sugeridas`);
      }
      if (decision === "select") {
        if (!board) errors.push(`${where(s)}: passo "select" precisa de um quadro na vista`);
        if (!s.expect || !s.expect.nodes?.length || !isStr(s.expect.on_correct) || !isStr(s.expect.on_wrong)) {
          errors.push(`${where(s)}: passo "select" precisa de expect.nodes, on_correct e on_wrong`);
        } else {
          for (const n of s.expect.nodes) if (!nodeIds.has(n)) errors.push(`${where(s)}: expect cita nó "${n}" que não existe no quadro`);
        }
      }

      for (const t of s.transitions ?? []) {
        // Ir para outro momento sempre entra pelo primeiro passo dele (passos se apoiam uns nos outros).
        if ("step" in t.to) {
          const target = t.to.step;
          const ti = m.steps.findIndex((x) => x.id === target);
          if (ti < 0) errors.push(`${where(s)}: transição para passo "${target}" fora deste momento`);
          else if (ti === si) errors.push(`${where(s)}: transição para o próprio passo`);
        } else if ("moment" in t.to) {
          if (!momentIds.has(t.to.moment)) errors.push(`${where(s)}: transição para momento inexistente "${t.to.moment}"`);
        } else {
          errors.push(`${where(s)}: transição sem destino`);
        }
        if (t.if && "reply" in t.if && !s.suggested_replies?.includes(t.if.reply)) {
          errors.push(`${where(s)}: transição espera a resposta "${t.if.reply}", que não está em suggested_replies`);
        }
      }
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, journey: j };
}

/** Valida e devolve a jornada; lança erro com a lista de problemas. */
export function loadJourney(input: unknown): Journey {
  const r = validateJourney(input);
  if (!r.ok) throw new Error("Jornada inválida:\n- " + r.errors.join("\n- "));
  return r.journey;
}
