// Encaminhamento no Slack da Kota pelo servidor (#129, docs/contratos.md "Encaminhamento no Slack da Kota").
import { describe, expect, it } from "vitest";
import { createOutbox, type Forwarding } from "../forwarding";
import { enviarNoSlackReal, lerEmailDoSlack, salvarEmailDoSlack } from "../slack-real";
import { memoryStore } from "../storage";

const draft = (question = "Quem cuida do ledgermonolith?"): Omit<Forwarding, "id" | "at" | "status"> => ({
  to: { name: "Beatriz Cavalcanti", role: "buddy" },
  pessoa: "Ana",
  question,
  summary: question,
  consulted: ["ADR 6"],
  reason: "Não há responsável confirmado.",
  moment: "pagamentos",
});

const LINK = "https://kota.slack.com/archives/D1/p12";
/** fetch falso que guarda os pedidos e responde o que o teste mandar. */
function fetchFalso(resposta: () => Promise<Response>) {
  const pedidos: { url: string; corpo: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? "{}")) });
    return resposta();
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}
const json = (status: number, corpo: unknown) => async () => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

describe("enviarNoSlackReal", () => {
  it("enviado: o encaminhamento sai dos pendentes, guarda o link e não vai para o Slack simulado", async () => {
    const outbox = createOutbox(memoryStore());
    const f = outbox.add(draft());
    const { fn, pedidos } = fetchFalso(json(200, { enviado: true, canal: "D1", ts: "1.2", link: LINK }));
    expect(await enviarNoSlackReal(f, { outbox, email: "jurado@exemplo.com", fetchFn: fn })).toBe(LINK);
    expect(outbox.pending("aba-do-slack")).toEqual([]);
    expect(outbox.list()[0]).toMatchObject({ status: "enviado", slack_link: LINK });
    expect(pedidos[0].url).toMatch(/\/api\/encaminhamentos$/);
    expect(pedidos[0].corpo).toEqual({
      id: f.id,
      destino: "buddy",
      para: "Beatriz Cavalcanti",
      pergunta: "Quem cuida do ledgermonolith?",
      resumo: "Quem cuida do ledgermonolith?",
      fontes_consultadas: ["ADR 6"],
      motivo: "Não há responsável confirmado.",
      email: "jurado@exemplo.com",
    });
  });

  it("enquanto o servidor responde, o Slack simulado não pega o encaminhamento", async () => {
    const outbox = createOutbox(memoryStore());
    const f = outbox.add(draft());
    let responder: (r: Response) => void = () => {};
    const { fn } = fetchFalso(() => new Promise<Response>((r) => (responder = r)));
    const envio = enviarNoSlackReal(f, { outbox, email: "jurado@exemplo.com", fetchFn: fn });
    expect(outbox.pending("aba-do-slack")).toEqual([]);
    responder(new Response(JSON.stringify({ enviado: false, motivo: "sem_slack" }), { status: 200 }));
    await envio;
  });

  it("sem_slack, erro do servidor ou servidor fora do ar: volta para pendente e o simulado envia", async () => {
    const respostas = [json(200, { enviado: false, motivo: "sem_slack" }), json(502, { error: "slack_falhou" }), async () => Promise.reject(new TypeError("Failed to fetch"))];
    for (const resposta of respostas) {
      const outbox = createOutbox(memoryStore());
      const f = outbox.add(draft());
      const { fn } = fetchFalso(resposta);
      expect(await enviarNoSlackReal(f, { outbox, email: "jurado@exemplo.com", fetchFn: fn })).toBeNull();
      expect(outbox.pending("aba-do-slack").map((p) => p.id)).toEqual([f.id]);
    }
  });

  it("encaminhamento que já saiu (mesma pergunta em menos de 2 min) não é reenviado nem volta para pendente", async () => {
    const outbox = createOutbox(memoryStore());
    const f = outbox.add(draft());
    outbox.marcarNoSlack(f.id, LINK);
    const { fn, pedidos } = fetchFalso(json(502, { error: "slack_falhou" }));
    const mesma = outbox.add(draft());
    expect(await enviarNoSlackReal(mesma, { outbox, email: "jurado@exemplo.com", fetchFn: fn })).toBe(LINK);
    expect(pedidos).toHaveLength(0);
    expect(outbox.list()[0].status).toBe("enviado");
  });

  it("sem e-mail do Slack, nem chama o servidor", async () => {
    const outbox = createOutbox(memoryStore());
    const f = outbox.add(draft());
    const { fn, pedidos } = fetchFalso(json(200, { enviado: true, canal: "D1", ts: "1.2", link: LINK }));
    expect(await enviarNoSlackReal(f, { outbox, email: null, fetchFn: fn })).toBeNull();
    expect(pedidos).toHaveLength(0);
    expect(outbox.pending().map((p) => p.id)).toEqual([f.id]);
  });
});

describe("e-mail do Slack da Kota", () => {
  it("guarda aparado e minúsculo; vazio apaga", () => {
    const store = memoryStore();
    expect(lerEmailDoSlack(store)).toBeNull();
    salvarEmailDoSlack(store, "  Jurado@Exemplo.com ");
    expect(lerEmailDoSlack(store)).toBe("jurado@exemplo.com");
    salvarEmailDoSlack(store, " ");
    expect(lerEmailDoSlack(store)).toBeNull();
  });

  it("texto sem @ não vale como e-mail", () => {
    const store = memoryStore();
    salvarEmailDoSlack(store, "jurado");
    expect(lerEmailDoSlack(store)).toBeNull();
  });
});
