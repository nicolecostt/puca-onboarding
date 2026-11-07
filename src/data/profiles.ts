// Os dois perfis da demo (docs/context.md, seção 7).
// Troque pela URL: ?perfil=bruno (transição, padrão) ou ?perfil=ana (recém-contratada).
import type { Profile } from "./types";

export const profiles: Record<string, Profile> = {
  bruno: {
    id: "bruno",
    kind: "transfer",
    name: "Bruno Tavares",
    nickname: "Bruno",
    initials: "BT",
    role: "Engenheiro de backend",
    fromTeam: "Antifraude",
    toTeam: "Terminais",
    managerId: "marcos",
    buddyId: "paula",
    tools: "GitHub, Slack e Jira",
    learningStyle: "Vendo o desenho primeiro",
    calibration: [
      { label: "Já trabalhou com filas", value: "sim", tone: "success" },
      { label: "Adquirência", value: "pouco", tone: "warning" },
      { label: "Prefere", value: "ver o desenho primeiro", tone: "neutral" },
    ],
  },
  ana: {
    id: "ana",
    kind: "new-hire",
    name: "Ana Ribeiro",
    nickname: "Ana",
    initials: "AR",
    role: "Engenheira de software",
    toTeam: "Terminais",
    managerId: "marcos",
    buddyId: "paula",
    tools: "GitHub e Slack",
    learningStyle: "Fazendo junto com alguém",
    calibration: [
      { label: "Já trabalhou com filas", value: "pouco", tone: "warning" },
      { label: "Adquirência", value: "nunca", tone: "warning" },
      { label: "Prefere", value: "fazer junto", tone: "neutral" },
    ],
  },
};

export function activeProfile(): Profile {
  const id = new URLSearchParams(location.search).get("perfil") ?? "bruno";
  return profiles[id] ?? profiles.bruno;
}

/** "Antifraude → Terminais" na transição; só o time novo para quem acabou de chegar. */
export function teamLine(p: Profile): string {
  return p.fromTeam ? `${p.fromTeam} → ${p.toTeam}` : p.toTeam;
}
