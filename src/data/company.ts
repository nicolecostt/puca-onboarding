// A empresa da demo é a Kota, lida do mapa do kit (kit/kota/mapa.ts): o mesmo de onde saem o CODEOWNERS e o Notion.
import { mapa } from "../../kit/kota/mapa";
import type { AreaId, MapaKota, TimeId } from "../../kit/kota/tipos";
import type { Company, JourneyStep } from "./types";

const AREAS_FORA_DOS_TIMES: Record<Exclude<AreaId, TimeId>, string> = {
  people: "People",
  seguranca: "Segurança da informação",
};

export function empresaDoMapa(m: MapaKota): Company {
  const nomeDaArea = (a: AreaId) => m.times.find((t) => t.id === a)?.nome ?? AREAS_FORA_DOS_TIMES[a as Exclude<AreaId, TimeId>];
  return {
    name: "Kota",
    teams: m.times.map((t) => t.nome),
    people: Object.fromEntries(
      m.pessoas.map((p) => [p.id, { id: p.id, name: p.nome, handle: p.slack, role: p.cargo, team: nomeDaArea(p.area) }]),
    ),
  };
}

export const company = empresaDoMapa(mapa);

/** Etapas da jornada (topo das telas). */
export const journey: JourneyStep[] = [
  { id: "access", label: "Acessos" },
  { id: "lesson", label: "Sessão" },
  { id: "first-ticket", label: "Primeira tarefa" },
  { id: "ready", label: "Pronto para contribuir" },
];
