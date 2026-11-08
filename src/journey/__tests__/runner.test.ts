import { describe, expect, it } from "vitest";
import demo from "../data/kota.journey.json";
import { loadJourney } from "../validate";
import { createRunner, type RunnerIO } from "../runner";
import { DEMO_PROFILES } from "../profile";
import type { BoardAction, Journey, Profile, ResultadoChecagem, SpeechCue } from "../types";

const journey = loadJourney(demo);

/** io de teste: respostas e cliques saem de filas; registra falas e ações. */
function fakeIO(replies: string[], clicks: string[] = []) {
  const said: string[] = [];
  const actions: BoardAction[] = [];
  const views: string[] = [];
  const checks: ResultadoChecagem[] = [];
  const io: RunnerIO = {
    onCheck: (c) => checks.push(c),
    enterView: (v, fresh) => views.push(`${v.mode === "board" ? v.board : "logo"}${fresh ? "" : " (herdada)"}`),
    apply: (a) => actions.push(a),
    // ações com `at` chegam ao quadro pela fala (cues), não pelo apply
    say: async (t, cues: SpeechCue[] = []) => {
      said.push(t);
      for (const c of cues) actions.push(c.action);
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
  return { io, said, actions, views, checks };
}

const run = (profile: Profile, replies: string[], clicks: string[] = ["balancereader"]) => {
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

  it("a primeira tarefa muda com o vínculo e termina pedindo a aprovação", async () => {
    const aprovacao = "Mandei a tarefa para Natália Brandão aprovar no Slack. Depois de aprovada, ela fica na página da tarefa, com tudo o que eu te mostrei.";
    const pt = (steps: string[]) => steps.filter((s) => s.startsWith("pt-"));
    const cards = (actions: BoardAction[]) => actions.flatMap((a) => (a.type === "card" ? [a.target] : []));

    const ana = await run(DEMO_PROFILES.novo, ["Pode seguir", "Ficou claro", "Pode seguir", "Terminar por hoje"]);
    expect(pt(ana.steps)).toEqual(["pt-tarefa", "pt-tarefa-novo", "pt-escopo", "pt-aprovacao"]);
    expect(cards(ana.actions)).toContain("task");
    expect(cards(ana.actions)).not.toContain("task-403");
    expect(ana.said).toContain(aprovacao);

    const bruno = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"]);
    expect(pt(bruno.steps)).toEqual(["pt-tarefa", "pt-tarefa-transicao", "pt-escopo-transicao", "pt-aprovacao"]);
    expect(cards(bruno.actions)).toContain("task-403");
    expect(cards(bruno.actions)).not.toContain("task");
    expect(bruno.said).toContain(aprovacao);
  });

  it("resposta sugerida leva ao aprofundamento, e texto livre também", async () => {
    const r = await run(DEMO_PROFILES.transicao, [
      "Ficou claro",
      "E se o balancereader cair?", // pagamentos → falha
      "É recusada, sem gravar nada", // checagem do caminho de erro
      "quem cuida disso?", // falha → quem-cuida (texto livre)
      "Terminar por hoje",
    ]);
    expect(r.moments).toEqual(["boas-vindas", "seu-time", "pagamentos", "falha", "quem-cuida", "checagem", "primeira-tarefa", "encerramento"]);
  });

  it("momento sem vista herda o quadro sem recomeçar", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "E se o balancereader cair?", "É recusada, sem gravar nada", "Pode seguir", "Terminar por hoje"]);
    expect(r.views).toEqual(["logo", "time", "pagamentos", "pagamentos (herdada)", "pagamentos (herdada)", "pagamentos (herdada)", "logo"]);
  });

  it("checagem: erro reexplica, acerto confirma", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["frontend", "balancereader"]);
    const expect_ = journey.moments.find((m) => m.id === "checagem")!.steps[0].expect!;
    expect(r.said).toContain(expect_.on_wrong);
    expect(r.said).toContain(expect_.on_correct);
    expect(r.said).not.toContain(expect_.on_reveal);
  });

  it("checagem: depois das tentativas mostra a resposta", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["frontend", "userservice"]);
    const expect_ = journey.moments.find((m) => m.id === "checagem")!.steps[0].expect!;
    expect(r.said).toContain(expect_.on_reveal);
    expect(r.actions).toContainEqual({ type: "highlight", targets: expect_.nodes, tone: "ok" });
  });

  it("checagem por toque: acertar (mesmo na segunda tentativa) é entendeu e pula o reforço", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["frontend", "balancereader"]);
    expect(r.checks).toEqual([{ tema: "pagamentos", passo: "ch-pergunta", entendeu: true, tentativas: 2, resposta: "balancereader" }]);
    expect(r.steps).not.toContain("ch-reforco");
  });

  it("checagem por toque: precisar que o Puca revele é rever e passa pelo reforço no quadro", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Terminar por hoje"], ["frontend", "userservice"]);
    expect(r.checks).toMatchObject([{ tema: "pagamentos", entendeu: false, tentativas: 2, resposta: "userservice" }]);
    expect(r.steps).toContain("ch-reforco");
    expect(r.moments.at(-2)).toBe("primeira-tarefa");
  });

  it("checagem por resposta: texto livre que casa com a resposta certa é entendeu", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "E se o balancereader cair?", "ela é recusada sem gravar nada", "Pode seguir", "Terminar por hoje"]);
    expect(r.checks[0]).toMatchObject({ tema: "falhas", passo: "fa-checa", entendeu: true, resposta: "ela é recusada sem gravar nada" });
    expect(r.steps).toContain("fa-certo");
    expect(r.steps).not.toContain("fa-reforco");
  });

  it("checagem por resposta: resposta errada é rever, reforça e segue sem confirmar", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "E se o balancereader cair?", "Fica numa fila esperando", "Pode seguir", "Terminar por hoje"]);
    expect(r.checks[0]).toMatchObject({ tema: "falhas", entendeu: false });
    expect(r.steps).toContain("fa-reforco");
    expect(r.steps).not.toContain("fa-certo");
    expect(r.steps).toContain("fa-fila");
  });

  it("rever o caminho volta ao início do momento de pagamentos", async () => {
    const r = await run(DEMO_PROFILES.transicao, ["Ficou claro", "Pode seguir", "Rever o caminho da transferência", "Pode seguir", "Terminar por hoje"], [
      "balancereader",
      "balancereader",
    ]);
    expect(r.moments.filter((m) => m === "pagamentos")).toHaveLength(2);
    expect(r.ended).toBe("done");
  });

  it("para no limite de passos se as transições formarem laço", async () => {
    const f = fakeIO(Array(500).fill("Rever o caminho da transferência"), Array(100).fill("balancereader"));
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
            line: "Oi, {nome}: primeiro o site, depois o ledgerwriter.",
            actions: [
              { type: "reveal", targets: ["ledgerwriter"], at: "o ledgerwriter" },
              { type: "clear_highlight" },
              { type: "reveal", targets: ["frontend"], at: "o site" },
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
    expect(events).toEqual(["apply clear_highlight", "say Oi, Bruno: primeiro o site, depois o ledgerwriter."]);
    const line = "Oi, Bruno: primeiro o site, depois o ledgerwriter.";
    expect(cues?.map((c) => [c.at, c.action.type === "reveal" ? c.action.targets[0] : ""])).toEqual([
      [line.indexOf("o site"), "frontend"],
      [line.indexOf("o ledgerwriter"), "ledgerwriter"],
    ]);
  });
});
