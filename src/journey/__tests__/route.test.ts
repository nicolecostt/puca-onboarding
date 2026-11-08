import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { buildFaqs } from "../faq";
import { tarefaDaPessoa } from "../primeira-tarefa";
import { DEMO_PROFILES } from "../profile";
import { routeUtterance, type RouteContext } from "../route";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const moment = journey.moments.find((m) => m.id === "pagamentos")!;
const step = moment.steps.find((s) => s.id === "pg-pergunta")!;
const ctx: RouteContext = {
  journey,
  moment,
  step,
  waiting: { kind: "reply", replies: step.suggested_replies ?? [] },
  board: "pagamentos",
  faqs: buildFaqs(journey, DEMO_PROFILES.novo),
};

describe("routeUtterance", () => {
  it("resposta sugerida, pulo e pergunta nova", () => {
    expect(routeUtterance("pode seguir", ctx)).toMatchObject({ kind: "reply", reply: "Pode seguir" });
    expect(routeUtterance("quero ver a primeira tarefa", ctx).kind).toBe("jump");
    expect(routeUtterance("Pule para a primeira tarefa", ctx)).toMatchObject({
      kind: "jump",
      moment: { id: "primeira-tarefa" },
    });
    expect(routeUtterance("Não pule para a primeira tarefa", ctx).kind).not.toBe("jump");
    expect(routeUtterance("Manipule para a primeira tarefa", ctx).kind).not.toBe("jump");
    expect(routeUtterance("Quanto ganha um engenheiro pleno aqui?", ctx).kind).toBe("ask");
  });

  it("toque por nome quando a tela espera um clique", () => {
    const node = journey.boards.pagamentos.nodes[0];
    const r = routeUtterance(`acho que é o ${node.label.replace("\n", " ")}`, { ...ctx, waiting: { kind: "select" } });
    expect(r).toMatchObject({ kind: "select", node: node.id });
  });
});

describe("routeUtterance: FAQ antes da knowledge", () => {
  it("quem cuida do nó vai para o FAQ, não para uma frase solta da knowledge", () => {
    const r = routeUtterance("Quem cuida do authorizer?", ctx);
    expect(r.kind).toBe("faq");
    if (r.kind === "faq") expect(r.faq).toMatchObject({ node: "authorizer", intent: "owner" });
  });
});

describe("routeUtterance: dono não confirmado vira encaminhamento", () => {
  it("quem cuida do tail-common cai no FAQ marcado como não confirmado", () => {
    const r = routeUtterance("Quem cuida do tail-common?", ctx);
    expect(r).toMatchObject({ kind: "faq", faq: { node: "common", intent: "owner", unconfirmed: true } });
  });

  it("dono confirmado não fica marcado", () => {
    const r = routeUtterance("Quem cuida do authorizer?", ctx);
    expect(r.kind === "faq" && r.faq.unconfirmed).toBeFalsy();
  });
});

describe("routeUtterance: checagem por resposta", () => {
  const falha = journey.moments.find((m) => m.id === "falha")!;
  const checa = falha.steps.find((s) => s.id === "fa-checa")!;
  const cctx: RouteContext = { ...ctx, moment: falha, step: checa, waiting: { kind: "reply", replies: checa.suggested_replies ?? [], check: true } };

  it("resposta livre vai inteira ao motor, sem passar pelo conhecimento que entregaria a resposta", () => {
    for (const t of ["para a dlq", "acho que se perde", "não sei"]) expect(routeUtterance(t, cctx)).toEqual({ kind: "reply", reply: t });
  });

  it("pergunta e pulo continuam funcionando durante a checagem", () => {
    expect(routeUtterance("pode repetir a pergunta?", cctx).kind).not.toBe("reply");
    expect(routeUtterance("o que é a dlq", cctx).kind).not.toBe("reply");
    expect(routeUtterance("quero ver a primeira tarefa", cctx).kind).toBe("jump");
  });

  it("fora de uma checagem, nada muda: a mesma fala vai ao conhecimento", () => {
    expect(routeUtterance("para a dlq", { ...cctx, waiting: { kind: "reply", replies: checa.suggested_replies ?? [] } }).kind).toBe("knowledge");
  });
});

describe("routeUtterance: dúvida da primeira tarefa (#79)", () => {
  const tarefaDoBruno = tarefaDaPessoa(journey, DEMO_PROFILES.transicao)!;
  const tctx: RouteContext = { ...ctx, faqs: buildFaqs(journey, DEMO_PROFILES.transicao), tarefa: tarefaDoBruno, tarefaApresentada: true };

  it("pergunta sobre a tarefa vai para o caminho tarefa", () => {
    const r = routeUtterance("por onde começo a tarefa?", tctx);
    expect(r).toMatchObject({ kind: "tarefa", resposta: { kind: "resposta", intencao: "comecar" } });
  });

  it("pulo vence a dúvida da tarefa", () => {
    expect(routeUtterance("quero ver a primeira tarefa", tctx).kind).toBe("jump");
    expect(routeUtterance("me explica a tarefa?", tctx).kind).toBe("jump");
  });

  it("numa checagem por toque, pergunta sobre a tarefa não é toque", () => {
    const checagem = journey.moments.find((m) => m.id === "checagem")!;
    const sctx: RouteContext = { ...tctx, moment: checagem, step: checagem.steps[0], waiting: { kind: "select" }, tarefaApresentada: false };
    expect(routeUtterance("o que é a primeira tarefa?", sctx)).toMatchObject({ kind: "tarefa", resposta: { kind: "ainda_nao" } });
  });

  it("numa checagem por resposta, resposta que cita a tarefa continua sendo resposta", () => {
    const falha = journey.moments.find((m) => m.id === "falha")!;
    const checa = falha.steps.find((s) => s.id === "fa-checa")!;
    const cctx: RouteContext = { ...tctx, moment: falha, step: checa, waiting: { kind: "reply", replies: checa.suggested_replies ?? [], check: true } };
    expect(routeUtterance("acho que é na tarefa", cctx)).toEqual({ kind: "reply", reply: "acho que é na tarefa" });
  });

  it("dúvida da tarefa vem antes do FAQ do nó", () => {
    expect(routeUtterance("quem ajuda na tarefa?", tctx).kind).toBe("tarefa");
    // o FAQ do nó também casaria ("o que é" + rótulo do nó): a tarefa responde mais completo
    expect(routeUtterance("o que é a primeira tarefa?", tctx)).toMatchObject({ kind: "tarefa", resposta: { intencao: "o_que" } });
  });

  it("fala que não é pergunta não vira dúvida da tarefa", () => {
    expect(routeUtterance("entendi a tarefa", tctx).kind).not.toBe("tarefa");
  });

  it("o que a tarefa não diz, mas a sessão sabe, vem do conhecimento (revisão, I5)", () => {
    const pt = journey.moments.find((m) => m.id === "primeira-tarefa")!;
    const pctx: RouteContext = { ...tctx, moment: pt, step: pt.steps.at(-1)!, waiting: null };
    expect(routeUtterance("quem aprova a tarefa?", pctx).kind).toBe("knowledge");
    expect(routeUtterance("qual o prazo da tarefa?", pctx)).toMatchObject({ kind: "tarefa", resposta: { kind: "sem_fonte" } });
  });

  it("o conhecimento só vale o do momento da tarefa, para não inventar responsável (revisão do PR #121, achado 1)", () => {
    const pt = journey.moments.find((m) => m.id === "primeira-tarefa")!;
    const pctx: RouteContext = { ...tctx, moment: pt, step: pt.steps.at(-1)!, waiting: null };
    for (const fala of ["quem é o dono da minha tarefa?", "a tarefa tem prazo?"]) {
      expect(routeUtterance(fala, pctx), fala).toMatchObject({ kind: "tarefa", resposta: { kind: "sem_fonte" } });
    }
    expect(routeUtterance("quem aprova a tarefa?", pctx).kind).toBe("knowledge");
    // o passo que apresenta a tarefa do outro vínculo (a da Ana) não responde pelo Bruno
    expect(routeUtterance("e o firmware da tarefa?", pctx)).toMatchObject({ kind: "tarefa", resposta: { kind: "sem_fonte" } });
    // de outro momento, a pergunta de aprovação também acha o conhecimento do momento da tarefa
    expect(routeUtterance("quem aprova a tarefa?", { ...tctx, waiting: null }).kind).toBe("knowledge");
  });

  it("sem tarefa no contexto, nada muda", () => {
    expect(routeUtterance("o que é a primeira tarefa?", ctx).kind).toBe("faq");
  });
});
