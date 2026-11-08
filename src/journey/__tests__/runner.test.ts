import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { loadJourney } from "../validate";
import { createRunner, type RunnerIO } from "../runner";
import { DEMO_PROFILES } from "../profile";
import type { BoardAction, Journey, Profile, SpeechCue } from "../types";

const journey = loadJourney(demo);

/** io de teste: respostas e cliques saem de filas; registra falas e ações. */
function fakeIO(replies: string[], clicks: string[] = []) {
  const said: string[] = [];
  const actions: BoardAction[] = [];
  const views: string[] = [];
  const io: RunnerIO = {
    enterView: (v, fresh) => views.push(`${v.mode === "board" ? v.board : "logo"}${fresh ? "" : " (herdada)"}`),
    apply: (a) => actions.push(a),
    say: async (t) => {
      said.push(t);
    },
    listen: async () => {
      const r = replies.shift();
      if (r === undefined) throw new Error("teste sem resposta para um passo wait");
      return r;
    },
    select: async () => {
      const c = clicks.shift();
      if (c === undefined) throw new Error("teste sem clique para um passo select");
      return c;
    },
  };
  return { io, said, actions, views };
}

const run = (profile: Profile, replies: string[], clicks: string[] = ["settlement"]) => {
  const f = fakeIO(replies, clicks);
  return createRunner(journey, profile, f.io).run().then((r) => ({ ...r, ...f }));
};

describe("runner", () => {
  it("recém-contratado passa pela parte institucional", async () => {
    const r = await run(DEMO_PROFILES.novo, ["Pode seguir", "Ficou claro", "Pode seguir", "Terminar por hoje"]);
    expect(r.ended).toBe("done");
    expect(r.moments).toEqual(["boas-vindas", "empresa-e-cultura", "seu-time", "pagamentos", "checagem", "primeira-tarefa", "encerramento"]);
    expect(r.steps).toContain("bv-novo");
    expect(r.steps).not.toContain("bv-transicao");
    expect(r.said[0]).toBe("Oi, Ana! Agora que eu já te conheço um pouco, vamos para a sua primeira sessão.");
  });

  it("quem está mudando de time pula a parte institucional", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"]);
    expect(r.moments).toEqual(["boas-vindas", "seu-time", "pagamentos", "checagem", "primeira-tarefa", "encerramento"]);
    expect(r.steps).toContain("bv-transicao");
    expect(r.steps).not.toContain("bv-novo");
  });

  it("resposta sugerida leva ao aprofundamento, e texto livre também", async () => {
    const r = await run(DEMO_PROFILES.transicao, [
      "Ficou claro",
      "E se a liquidação falhar?", // pagamentos → falha
      "quem cuida disso?", // falha → quem-cuida (texto livre)
      "Terminar por hoje",
    ]);
    expect(r.moments).toEqual(["boas-vindas", "seu-time", "pagamentos", "falha", "quem-cuida", "checagem", "primeira-tarefa", "encerramento"]);
  });

  it("momento sem vista herda o quadro sem recomeçar", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "E se a liquidação falhar?", "Pode seguir", "Terminar por hoje"]);
    expect(r.views).toEqual(["logo", "time", "pagamentos", "pagamentos (herdada)", "pagamentos (herdada)", "pagamentos (herdada)", "logo"]);
  });

  it("checagem: erro reexplica, acerto confirma", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["pos", "settlement"]);
    const expect_ = journey.moments.find((m) => m.id === "checagem")!.steps[0].expect!;
    expect(r.said).toContain(expect_.on_wrong);
    expect(r.said).toContain(expect_.on_correct);
    expect(r.said).not.toContain(expect_.on_reveal);
  });

  it("checagem: depois das tentativas mostra a resposta", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["pos", "gateway"]);
    const expect_ = journey.moments.find((m) => m.id === "checagem")!.steps[0].expect!;
    expect(r.said).toContain(expect_.on_reveal);
    expect(r.actions).toContainEqual({ type: "highlight", targets: expect_.nodes, tone: "ok" });
  });

  it("rever o caminho volta ao início do momento de pagamentos", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Rever o caminho da transação", "Pode seguir", "Terminar por hoje"], [
      "settlement",
      "settlement",
    ]);
    expect(r.moments.filter((m) => m === "pagamentos")).toHaveLength(2);
    expect(r.ended).toBe("done");
  });

  it("para no limite de passos se as transições formarem laço", async () => {
    const f = fakeIO(Array(500).fill("Rever o caminho da transação"), Array(100).fill("settlement"));
    const r = await createRunner(journey, DEMO_PROFILES.transicao, f.io, { maxSteps: 40 }).run();
    expect(r.ended).toBe("limit");
    expect(r.steps).toHaveLength(40);
  });

  it("ação sem at sai antes da fala; com at vira marca na fala, na ordem do texto e com o perfil preenchido", async () => {
    const j = JSON.parse(JSON.stringify(demo)) as Journey;
    j.moments = [
      {
        id: "m",
        title: "Teste",
        goal: "testar as marcas na fala",
        view: { mode: "board", board: j.moments[3].view && "board" in j.moments[3].view ? j.moments[3].view.board : "" },
        steps: [
          {
            id: "s",
            goal: "falar com marcas",
            line: "Oi, {nome}: primeiro o POS, depois o gateway.",
            actions: [
              { type: "reveal", targets: ["gateway"], at: "o gateway" },
              { type: "clear_highlight" },
              { type: "reveal", targets: ["pos"], at: "o POS" },
            ],
          },
        ],
      },
    ];
    const events: string[] = [];
    let cues: SpeechCue[] | undefined;
    const io: RunnerIO = {
      enterView: () => {},
      apply: (a) => events.push(`apply ${a.type}`),
      say: async (t, c) => {
        events.push(`say ${t}`);
        cues = c;
      },
      listen: async () => "",
      select: async () => "",
    };
    await createRunner(loadJourney(j), DEMO_PROFILES.transicao, io).run();
    expect(events).toEqual(["apply clear_highlight", "say Oi, Bruno: primeiro o POS, depois o gateway."]);
    const line = "Oi, Bruno: primeiro o POS, depois o gateway.";
    expect(cues?.map((c) => [c.at, c.action.type === "reveal" ? c.action.targets[0] : ""])).toEqual([
      [line.indexOf("o POS"), "pos"],
      [line.indexOf("o gateway"), "gateway"],
    ]);
  });
});
