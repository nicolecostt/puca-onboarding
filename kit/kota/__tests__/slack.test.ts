import { afterEach, describe, expect, it, vi } from "vitest";
import { mapa } from "../mapa";
import { caminhoAdr } from "../tipos";
import { slackDeVerdade, type SlackApi } from "../slack/api";
import { HISTORICO, type MensagemKota } from "../slack/historico";
import { preencherSlack } from "../slack/preencher";

type Escrita =
  | { tipo: "canal"; nome: string }
  | { tipo: "mensagem"; canalId: string; texto: string; username: string; iconUrl: string };

function falsa(o: { teamId?: string; existentes?: string[] } = {}) {
  const existentes = new Set(o.existentes ?? []);
  const escritas: Escrita[] = [];
  const api: SlackApi = {
    async authTest() {
      return { teamId: o.teamId ?? "TKOTA" };
    },
    async criarCanal(nome) {
      if (existentes.has(nome)) return { jaExiste: true };
      existentes.add(nome);
      escritas.push({ tipo: "canal", nome });
      return { id: `C-${nome}` };
    },
    async postar(m) {
      escritas.push({ tipo: "mensagem", ...m });
    },
  };
  return { api, escritas };
}

const CANAIS = ["#geral", "#people", "#contas", "#contas-ajuda", "#livro-razao", "#livro-razao-ajuda",
  "#canais", "#canais-ajuda", "#plataforma", "#plataforma-ajuda"];

describe("preencherSlack", () => {
  it("para sem escrever nada se o token é de outro workspace", async () => {
    const { api, escritas } = falsa({ teamId: "TOUTRO" });
    await expect(preencherSlack(api, mapa, HISTORICO, "TKOTA")).rejects.toThrow(/workspace TOUTRO não é o da Kota/);
    expect(escritas).toEqual([]);
  });

  it("cria o #geral, o #people e os dois canais de cada time", async () => {
    const { api, escritas } = falsa();
    const r = await preencherSlack(api, mapa, [], "TKOTA");
    expect(r).toEqual({ canaisCriados: CANAIS, canaisPulados: [], mensagens: 0 });
    expect(escritas.filter((e) => e.tipo === "canal").map((e) => e.nome)).toEqual(CANAIS.map((c) => c.slice(1)));
  });

  it("cria só os canais que faltam", async () => {
    const { api } = falsa({ existentes: ["geral", "livro-razao"] });
    const r = await preencherSlack(api, mapa, [], "TKOTA");
    expect(r.canaisPulados).toEqual(["#geral", "#livro-razao"]);
    expect(r.canaisCriados).toEqual(CANAIS.filter((c) => c !== "#geral" && c !== "#livro-razao"));
  });

  it("não posta em canal que já existia", async () => {
    const { api, escritas } = falsa({ existentes: ["livro-razao"] });
    const historico: MensagemKota[] = [
      { canal: "#livro-razao", autor: "beatriz", texto: "fica de fora" },
      { canal: "#geral", autor: "simone", texto: "entra" },
    ];
    const r = await preencherSlack(api, mapa, historico, "TKOTA");
    expect(r.mensagens).toBe(1);
    expect(escritas.flatMap((e) => (e.tipo === "mensagem" ? [e.texto] : []))).toEqual(["entra"]);
  });

  it("rodar de novo não duplica canal nem mensagem", async () => {
    const { api, escritas } = falsa();
    const primeira = await preencherSlack(api, mapa, HISTORICO, "TKOTA");
    const depoisDaPrimeira = escritas.length;
    const segunda = await preencherSlack(api, mapa, HISTORICO, "TKOTA");
    expect(primeira.mensagens).toBe(HISTORICO.length);
    expect(segunda).toEqual({ canaisCriados: [], canaisPulados: CANAIS, mensagens: 0 });
    expect(escritas).toHaveLength(depoisDaPrimeira);
  });

  it("posta com nome e avatar da pessoa do mapa", async () => {
    const { api, escritas } = falsa();
    await preencherSlack(api, mapa, [{ canal: "#livro-razao", autor: "beatriz", texto: "oi" }], "TKOTA");
    expect(escritas.filter((e) => e.tipo === "mensagem")).toEqual([{
      tipo: "mensagem",
      canalId: "C-livro-razao",
      texto: "oi",
      username: "Beatriz Cavalcanti",
      iconUrl: "https://api.dicebear.com/9.x/initials/png?seed=Beatriz%20Cavalcanti",
    }]);
  });

  it("falha antes de qualquer escrita se um autor não está no mapa", async () => {
    const { api, escritas } = falsa();
    const historico: MensagemKota[] = [
      { canal: "#geral", autor: "simone", texto: "certo" },
      { canal: "#geral", autor: "fulano", texto: "autor inventado" },
    ];
    await expect(preencherSlack(api, mapa, historico, "TKOTA")).rejects.toThrow(/fulano/);
    expect(escritas).toEqual([]);
  });

  it("se cair no meio de um canal, diz qual canal ficou pela metade", async () => {
    const { api } = falsa();
    let postadas = 0;
    api.postar = async () => {
      if (++postadas === 2) throw new Error("ratelimited");
    };
    const historico: MensagemKota[] = [
      { canal: "#people", autor: "simone", texto: "primeira" },
      { canal: "#people", autor: "simone", texto: "segunda" },
    ];
    await expect(preencherSlack(api, mapa, historico, "TKOTA")).rejects.toThrow(/#people ficou pela metade.*ratelimited/s);
  });

  it("falha antes de qualquer escrita se o canal não é da Kota", async () => {
    const { api, escritas } = falsa();
    await expect(preencherSlack(api, mapa, [{ canal: "#random", autor: "simone", texto: "x" }], "TKOTA"))
      .rejects.toThrow(/#random/);
    expect(escritas).toEqual([]);
  });
});

describe("HISTORICO", () => {
  const ids = new Set(mapa.pessoas.map((p) => p.id));

  it("toda mensagem tem autor do mapa e canal existente", () => {
    expect(HISTORICO.filter((m) => !ids.has(m.autor) || !CANAIS.includes(m.canal))).toEqual([]);
  });

  it("cada canal de time tem de 5 a 10 mensagens, e o #geral e o #people têm alguma", () => {
    const porCanal = (c: string) => HISTORICO.filter((m) => m.canal === c).length;
    for (const c of CANAIS.slice(2)) expect(porCanal(c), c).toBeGreaterThanOrEqual(5);
    for (const c of CANAIS.slice(2)) expect(porCanal(c), c).toBeLessThanOrEqual(10);
    expect(porCanal("#geral")).toBeGreaterThan(0);
    expect(porCanal("#people")).toBeGreaterThan(0);
  });

  it("ninguém marca ninguém e nada cita a origem do código", () => {
    expect(HISTORICO.filter((m) => /<[@!#]|(^|\s)@/.test(m.texto))).toEqual([]);
    expect(HISTORICO.filter((m) => /anthos|cymbal|google/i.test(m.texto))).toEqual([]);
  });

  it("cita um ADR e o runbook ledger-db-cheio, e todo link do repo existe no mapa", () => {
    const base = "https://github.com/JucaGF/kota-bank/blob/main/";
    const runbook = `${base}docs/runbooks/ledger-db-cheio.md`;
    const adrs = mapa.adrs.map((a) => base + caminhoAdr(a));
    const links = HISTORICO.flatMap((m) => m.texto.match(/https:\/\/github\.com\/\S+/g) ?? []);
    expect(links.filter((l) => l !== runbook && !adrs.includes(l))).toEqual([]);
    expect(links.some((l) => adrs.includes(l))).toBe(true);
    expect(HISTORICO.some((m) => m.canal === "#livro-razao" && m.texto.includes(runbook))).toBe(true);
  });
});

describe("slackDeVerdade", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const resposta = (corpo: object, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...headers } });

  it("espera o Retry-After num 429 e repete a chamada", async () => {
    vi.useFakeTimers();
    const fetchFalso = vi.fn()
      .mockResolvedValueOnce(resposta({ ok: false, error: "ratelimited" }, 429, { "Retry-After": "1" }))
      .mockResolvedValueOnce(resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchFalso);

    const postado = slackDeVerdade("token-de-teste").postar({ canalId: "C1", texto: "oi", username: "Beatriz Cavalcanti", iconUrl: "https://x/a.png" });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await postado;
    expect(fetchFalso).toHaveBeenCalledTimes(2);

    const [url, init] = fetchFalso.mock.calls[1];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.headers.Authorization).toBe("Bearer token-de-teste");
    expect(JSON.parse(init.body)).toEqual({ channel: "C1", text: "oi", username: "Beatriz Cavalcanti", icon_url: "https://x/a.png" });
  });

  it("criarCanal devolve o id, ou jaExiste quando o nome está em uso", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(resposta({ ok: true, channel: { id: "C9" } }))
      .mockResolvedValueOnce(resposta({ ok: false, error: "name_taken" })));
    const api = slackDeVerdade("token-de-teste");
    expect(await api.criarCanal("livro-razao")).toEqual({ id: "C9" });
    expect(await api.criarCanal("livro-razao")).toEqual({ jaExiste: true });
  });

  it("erro da API vira exceção com o motivo e sem o token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({ ok: false, error: "invalid_auth" })));
    const erro = await slackDeVerdade("token-secreto").authTest().catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/invalid_auth/);
    expect((erro as Error).message).not.toMatch(/token-secreto/);
  });

  it("token com quebra de linha no meio vira erro que aponta a variável e não mostra o token", async () => {
    const erro = await (async () => slackDeVerdade("token-de-teste\nsegredo-colado").authTest())().catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/SLACK_BOT_TOKEN/);
    expect((erro as Error).message).not.toMatch(/token-de-teste|segredo-colado/);
  });
});
