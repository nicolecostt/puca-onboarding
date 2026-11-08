// Dados da admissão que Puca confirma na call (a empresa já sabe; ele não pergunta). Quem entra só se sabe na conversa:
// até o vínculo ser anotado, o cargo vai sem gênero; depois, é a admissão da pessoa da demo (Ana ou Bruno).
import { company, profiles } from "../../data";
import type { Vinculo } from "../../journey/types";

const CARGO_SEM_GENERO = "Engenharia de software, nível pleno";

export function admissaoDaCall(vinculo: Vinculo | null): { cargo: string; time: string; gestor: string } {
  const p = vinculo === "transicao" ? profiles.bruno : profiles.ana;
  return {
    cargo: vinculo ? p.role : CARGO_SEM_GENERO,
    time: p.toTeam,
    gestor: company.people[p.managerId]?.name ?? "",
  };
}
