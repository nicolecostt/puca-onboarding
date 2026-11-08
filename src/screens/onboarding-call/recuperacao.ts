import { calibragemFromAnswers, DEMO_CALIBRAGENS } from "../../journey/calibragem";
import { DEMO_PROFILES, profileFromAnswers, vinculoFromAnswer } from "../../journey/profile";
import type { Vinculo } from "../../journey/types";

/** Sem call, usa a demo; se a conversa já começou, conserva o que a pessoa contou. */
export function dadosParaSessao(answers: Record<string, string>, conhecido: Vinculo | null) {
  const vinculo = conhecido ?? vinculoFromAnswer(answers.vinculo);
  const perfil = profileFromAnswers({ ...DEMO_PROFILES[vinculo], ...answers }, vinculo);
  const temRespostas = Object.keys(answers).some((key) => key !== "vinculo" && answers[key].trim());
  return {
    perfil,
    calibragem: temRespostas ? calibragemFromAnswers(perfil, answers) : DEMO_CALIBRAGENS[vinculo],
  };
}
