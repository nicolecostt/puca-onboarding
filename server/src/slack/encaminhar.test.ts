import { describe, expect, it } from "vitest";
import { lerPedidoDeEncaminhamento, type PedidoDeEncaminhamento } from "../../../src/journey/encaminhamento-slack";
import { createEncaminhador, mensagemDoEncaminhamento, type SlackDm } from "./encaminhar";

const pedido = (extra: Partial<PedidoDeEncaminhamento> = {}): PedidoDeEncaminhamento => ({
  id: "f1",
  destino: "buddy",
  para: "Paula Nunes",
  pergunta: "Quem cuida do tail-common?",
  resumo: "Quem cuida do tail-common?",
  fontes_consultadas: ["ADR-012", "README do pos-gateway"],
  motivo: "Não há responsável confirmado para o tail-common nas fontes.",
  email: "jurado@exemplo.com",
  ...extra,
});

/** Slack falso: guarda o que foi postado. */
function slackFalso(opts: { semConta?: boolean; postarDemora?: number } = {}) {
  const posts: { canal: string; texto: string }[] = [];
  const slack: SlackDm = {
    async acharPorEmail(email) {
      return opts.semConta ? null : `U-${email}`;
    },
    async abrirConversa(usuario) {
      return `D-${usuario}`;
    },
    async postar(m) {
      if (opts.postarDemora) await new Promise((r) => setTimeout(r, opts.postarDemora));
      posts.push(m);
      return `ts-${posts.length}`;
    },
    async link(canal, ts) {
      return `https://kota.slack.com/archives/${canal}/p${ts}`;
    },
  };
  return { slack, posts };
}

describe("createEncaminhador", () => {
  it("manda uma mensagem direta ao jurado e devolve canal, ts e link", async () => {
    const { slack, posts } = slackFalso();
    const r = await createEncaminhador(slack)(pedido());
    expect(r).toEqual({ enviado: true, canal: "D-U-jurado@exemplo.com", ts: "ts-1", link: "https://kota.slack.com/archives/D-U-jurado@exemplo.com/pts-1" });
    expect(posts).toHaveLength(1);
    expect(posts[0].canal).toBe("D-U-jurado@exemplo.com");
  });

  it("o mesmo id duas vezes, até ao mesmo tempo, posta uma vez só e devolve o mesmo resultado (#70)", async () => {
    const { slack, posts } = slackFalso({ postarDemora: 20 });
    const encaminhar = createEncaminhador(slack);
    const [a, b] = await Promise.all([encaminhar(pedido()), encaminhar(pedido())]);
    const c = await encaminhar(pedido());
    expect(posts).toHaveLength(1);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("sem e-mail, nada é postado", async () => {
    const { slack, posts } = slackFalso();
    expect(await createEncaminhador(slack)(pedido({ email: undefined }))).toEqual({ enviado: false, motivo: "sem_slack" });
    expect(posts).toHaveLength(0);
  });

  it("e-mail sem conta no Slack da Kota: nada é postado", async () => {
    const { slack, posts } = slackFalso({ semConta: true });
    expect(await createEncaminhador(slack)(pedido())).toEqual({ enviado: false, motivo: "sem_slack" });
    expect(posts).toHaveLength(0);
  });

  it("falha do Slack lança e deixa tentar de novo com o mesmo id", async () => {
    const { slack, posts } = slackFalso();
    let falhar = true;
    const postar = slack.postar;
    slack.postar = async (m) => {
      if (falhar) throw new Error("Slack chat.postMessage: ratelimited");
      return postar(m);
    };
    const encaminhar = createEncaminhador(slack);
    await expect(encaminhar(pedido())).rejects.toThrow();
    falhar = false;
    expect((await encaminhar(pedido())).enviado).toBe(true);
    expect(posts).toHaveLength(1);
  });
});

describe("mensagemDoEncaminhamento", () => {
  it("diz a quem iria na Kota e leva a pergunta, as fontes e o motivo", () => {
    const msg = mensagemDoEncaminhamento(pedido());
    expect(msg).toContain("Paula Nunes");
    expect(msg).toContain("Quem cuida do tail-common?");
    expect(msg).toContain("ADR-012; README do pos-gateway");
    expect(msg).toContain("Não há responsável confirmado para o tail-common nas fontes.");
  });

  it("não supõe o gênero de quem recebe (#86)", () => {
    expect(mensagemDoEncaminhamento(pedido({ para: "Lucas Prado" }))).not.toMatch(/\b(a|o) (Lucas|Paula)\b/);
  });

  it("sem fontes, diz que não achou nenhuma", () => {
    expect(mensagemDoEncaminhamento(pedido({ fontes_consultadas: [] }))).toContain("não achei nenhuma fonte");
  });

  it("RH e gestor aparecem pelo papel", () => {
    expect(mensagemDoEncaminhamento(pedido({ destino: "rh", para: "RH" }))).toContain("RH");
  });
});

describe("lerPedidoDeEncaminhamento", () => {
  it("aceita o exemplo do contrato", () => {
    expect(lerPedidoDeEncaminhamento(pedido())).toEqual(pedido());
  });

  it("recusa sem id, sem pergunta, sem motivo ou com destino desconhecido", () => {
    for (const ruim of [{ id: "" }, { pergunta: " " }, { motivo: undefined }, { destino: "canal" }]) {
      expect(lerPedidoDeEncaminhamento({ ...pedido(), ...ruim })).toBeNull();
    }
    expect(lerPedidoDeEncaminhamento(null)).toBeNull();
  });

  it("e-mail vazio vira sem e-mail, e fonte que não é texto é descartada", () => {
    const p = lerPedidoDeEncaminhamento({ ...pedido(), email: "  ", fontes_consultadas: ["ADR-012", 3, null] });
    expect(p?.email).toBeUndefined();
    expect(p?.fontes_consultadas).toEqual(["ADR-012"]);
  });
});
