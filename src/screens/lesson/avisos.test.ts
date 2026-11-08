// Um aviso por vez no canto da sessão: a tarefa nova não tampa o aviso do Slack (revisão do #223).
import { describe, expect, it } from "vitest";
import { createAvisos, type Aviso } from "./avisos";

function relogio() {
  let t = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 1;
  return {
    setTimeout: (fn: () => void, ms: number) => (timers.push({ at: t + ms, fn, id: next }), next++),
    clearTimeout: (id: number) => void timers.splice(timers.findIndex((x) => x.id === id) >>> 0, timers.some((x) => x.id === id) ? 1 : 0),
    avancar(ms: number) {
      t += ms;
      for (const x of timers.filter((x) => x.at <= t).sort((a, b) => a.at - b.at)) {
        timers.splice(timers.indexOf(x), 1);
        x.fn();
      }
    },
  };
}

const slack: Aviso = { tipo: "slack", text: "Pedido de aprovação enviado a Natália Brandão no Slack", link: { href: "s", target: "s", label: "Abrir Slack" } };
const tarefa: Aviso = { tipo: "tarefa", text: "Nova tarefa: Ler a ADR 1", link: { href: "t", target: "t", label: "Ver tarefas" } };

describe("createAvisos", () => {
  it("a tarefa espera o aviso do Slack sumir e aparece depois", () => {
    const r = relogio();
    const vistos: (string | null)[] = [];
    const avisos = createAvisos((a) => vistos.push(a?.text ?? null), { ms: 8000, setTimeout: r.setTimeout, clearTimeout: r.clearTimeout });
    avisos.avisar(slack);
    r.avancar(2000);
    avisos.avisar(tarefa);
    expect(vistos).toEqual([slack.text]);
    r.avancar(6000);
    expect(vistos).toEqual([slack.text, tarefa.text]);
    r.avancar(8000);
    expect(vistos).toEqual([slack.text, tarefa.text, null]);
  });

  it("o Slack troca a tarefa na hora, e Slack novo troca Slack (como antes)", () => {
    const r = relogio();
    const vistos: (string | null)[] = [];
    const avisos = createAvisos((a) => vistos.push(a?.text ?? null), { ms: 8000, setTimeout: r.setTimeout, clearTimeout: r.clearTimeout });
    avisos.avisar(tarefa);
    avisos.avisar(slack);
    avisos.avisar({ ...slack, text: "Mandei a dúvida no seu Slack da Kota" });
    expect(vistos).toEqual([tarefa.text, slack.text, "Mandei a dúvida no seu Slack da Kota"]);
    r.avancar(8000);
    expect(vistos.at(-1)).toBeNull();
  });

  it("sem aviso na tela, a tarefa aparece na hora", () => {
    const r = relogio();
    const vistos: (string | null)[] = [];
    const avisos = createAvisos((a) => vistos.push(a?.text ?? null), { ms: 8000, setTimeout: r.setTimeout, clearTimeout: r.clearTimeout });
    avisos.avisar(tarefa);
    expect(vistos).toEqual([tarefa.text]);
  });
});
