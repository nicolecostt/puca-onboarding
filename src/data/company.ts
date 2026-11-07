// Empresa fictícia da demo (a mesma das telas do Figma).
import type { Company, JourneyStep } from "./types";

export const company: Company = {
  name: "Tail",
  teams: ["Antifraude", "Terminais", "Autorização", "Liquidação", "Plataforma"],
  people: {
    diego: { id: "diego", name: "Diego Ramos", handle: "diegoramos", role: "Tech lead", team: "Autorização" },
    julia: { id: "julia", name: "Júlia Paiva", handle: "juliapaiva", role: "Engenheira sênior", team: "Autorização" },
    rafa: { id: "rafa", name: "Rafael Lins", handle: "rafalins", role: "Engenheiro", team: "Liquidação" },
    carla: { id: "carla", name: "Carla Mendes", handle: "carlamendes", role: "Tech lead", team: "Liquidação" },
    lucas: { id: "lucas", name: "Lucas Melo", handle: "lucasmelo", role: "Tech lead", team: "Terminais" },
    marcos: { id: "marcos", name: "Marcos Vidal", handle: "marcosvidal", role: "Gestor de engenharia", team: "Terminais" },
    paula: { id: "paula", name: "Paula Nunes", handle: "paulanunes", role: "Engenheira", team: "Terminais" },
  },
};

/** Etapas da jornada (topo das telas). */
export const journey: JourneyStep[] = [
  { id: "access", label: "Acessos" },
  { id: "lesson", label: "Aula" },
  { id: "first-ticket", label: "Primeiro ticket" },
  { id: "ready", label: "Pronto para contribuir" },
];
