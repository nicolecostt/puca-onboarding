// Os dois perfis da demo: novo e transição (CONTEXT.md), as pessoas de mapa.perfis no kit da Kota.
// Troque pela URL: ?perfil=bruno (transição, padrão) ou ?perfil=ana (recém-contratada).
import { mapa } from "../../kit/kota/mapa";
import type { Profile } from "./types";

const pessoa = (id: string) => mapa.pessoas.find((p) => p.id === id)!;
const time = (id: string) => mapa.times.find((t) => t.id === id)!;
const iniciais = (nome: string) => nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const novo = pessoa(mapa.perfis.novo.pessoa);
const transicao = pessoa(mapa.perfis.transicao.pessoa);
const destino = time(mapa.perfis.novo.para);

export const profiles: Record<string, Profile> = {
  [transicao.id]: {
    id: transicao.id,
    kind: "transfer",
    name: transicao.nome,
    nickname: transicao.nome.split(" ")[0],
    initials: iniciais(transicao.nome),
    role: transicao.cargo,
    fromTeam: time(mapa.perfis.transicao.de).nome,
    toTeam: time(mapa.perfis.transicao.para).nome,
    managerId: destino.gestor,
    buddyId: destino.buddies[0],
    tools: "GitHub, Slack e Notion",
    learningStyle: "Vendo o desenho primeiro",
    calibration: [
      { label: "Login e JWT", value: "sim", tone: "success" },
      { label: "Saldo e extrato", value: "nunca", tone: "warning" },
      { label: "Prefere", value: "ver o desenho primeiro", tone: "neutral" },
    ],
  },
  [novo.id]: {
    id: novo.id,
    kind: "new-hire",
    name: novo.nome,
    nickname: novo.nome.split(" ")[0],
    initials: iniciais(novo.nome),
    role: novo.cargo,
    toTeam: destino.nome,
    managerId: destino.gestor,
    buddyId: destino.buddies[0],
    tools: "GitHub e Slack",
    learningStyle: "Fazendo junto com alguém",
    calibration: [
      { label: "Java e Spring", value: "pouco", tone: "warning" },
      { label: "Banco digital", value: "nunca", tone: "warning" },
      { label: "Prefere", value: "fazer junto", tone: "neutral" },
    ],
  },
};

export function activeProfile(): Profile {
  const id = new URLSearchParams(location.search).get("perfil") ?? transicao.id;
  return profiles[id] ?? profiles[transicao.id];
}

/** "Contas → Livro-razão" na transição; só o time novo para quem acabou de chegar. */
export function teamLine(p: Profile): string {
  return p.fromTeam ? `${p.fromTeam} → ${p.toTeam}` : p.toTeam;
}
