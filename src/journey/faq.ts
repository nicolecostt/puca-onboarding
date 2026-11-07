// Respostas prontas sobre os nós do quadro ("o que é", "quem cuida", "por que existe"), tiradas
// de node.info da jornada. Determinístico: não inventa fato e serve tanto à tela quanto ao servidor.
import type { FaqIntent } from "./conditions";
import { interpolate } from "./profile";
import type { BoardAction, Journey, Profile } from "./types";

export interface Faq {
  board: string;
  node: string;
  label: string;
  intent: FaqIntent;
  text: string;
  actions: BoardAction[];
  /** Dono sem fonte confiável (owner_confirmed: false): a dúvida vira encaminhamento à buddy. */
  unconfirmed?: true;
}

// ponytail: frases por template a partir de node.info. Para soar mais natural, reescrever offline com LLM e revisar.
export function buildFaqs(journey: Journey, profile: Profile): Faq[] {
  const buddy = Object.values(journey.boards).flatMap((b) => b.nodes).find((n) => n.id === "buddy")?.label;
  const askBuddy = buddy ? `A ${buddy.split(" ")[0]}, sua buddy, pode te indicar.` : "Sua buddy pode te indicar.";
  const out: Faq[] = [];
  for (const [board, spec] of Object.entries(journey.boards)) {
    for (const n of spec.nodes) {
      const i = n.info;
      if (!i) continue;
      const label = n.label.replace(/\n/g, " ");
      const base = { board, node: n.id, label };
      const focus: BoardAction[] = [{ type: "highlight", targets: [n.id], tone: "focus" }];
      if (i.role) out.push({ ...base, intent: "what", text: `${label}: ${lowerFirst(i.role)}`, actions: focus });
      const confirmed = !!i.owner && i.owner_confirmed !== false;
      const owner = confirmed
        ? `Quem cuida do ${label} é ${i.owner}${i.team ? `, do time ${i.team}` : ""}.`
        : `Não tenho um responsável confirmado para o ${label}. ${askBuddy}`;
      out.push({ ...base, intent: "owner", text: owner, actions: [{ type: "card", target: n.id }], ...(confirmed ? {} : { unconfirmed: true as const }) });
      if (i.adr) {
        out.push({ ...base, intent: "why", text: `Isso vem do ${i.adr.id}, ${i.adr.title}. ${i.adr.summary}`, actions: [{ type: "card", target: n.id }] });
      }
    }
  }
  return out.map((f) => ({ ...f, text: interpolate(f.text, profile), label: interpolate(f.label, profile) }));
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
