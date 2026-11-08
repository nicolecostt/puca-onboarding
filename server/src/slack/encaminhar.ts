// Encaminhamento no Slack da Kota (#129, docs/contratos.md "Encaminhamento no Slack da Kota", docs/stack.md §10.1).
// O bot da Kota manda uma mensagem direta ao PRÓPRIO jurado, nunca num canal: todos os jurados entram no mesmo
// workspace, e a dúvida de um (às vezes um caso pessoal) não pode aparecer para os outros (PRODUCT.md §5).
import type { PedidoDeEncaminhamento, ResultadoDoEncaminhamento } from "../../../src/journey/encaminhamento-slack";

/** O que o encaminhamento usa do Slack. Injetável para teste. */
export interface SlackDm {
  /** Id do usuário com esse e-mail no workspace; null se não houver. */
  acharPorEmail(email: string): Promise<string | null>;
  /** Abre (ou reabre) a conversa direta do bot com o usuário; devolve o id do canal. */
  abrirConversa(usuario: string): Promise<string>;
  /** Posta como "Puca"; devolve o ts da mensagem. */
  postar(m: { canal: string; texto: string }): Promise<string>;
  link(canal: string, ts: string): Promise<string>;
}

const QUEM: Record<PedidoDeEncaminhamento["destino"], (para: string) => string> = {
  buddy: (para) => `${para}, sua buddy`,
  gestor: (para) => `${para}, da gestão do seu time`,
  rh: () => "o RH da Kota",
};

/** Texto da mensagem: a quem iria na Kota, a dúvida, o que foi consultado e o motivo. Sem o nome digitado. */
export function mensagemDoEncaminhamento(p: PedidoDeEncaminhamento): string {
  const fontes = p.fontes_consultadas.length ? p.fontes_consultadas.join("; ") : "não achei nenhuma fonte sobre isso.";
  return [
    "Oi! Aqui é a Puca, do Orbis.",
    `Você me fez uma pergunta que eu não consegui responder com segurança. Na Kota, ela iria para ${QUEM[p.destino](p.para)}.`,
    `*Pergunta:* "${p.pergunta}"`,
    ...(p.resumo && p.resumo !== p.pergunta ? [`*Resumo:* ${p.resumo}`] : []),
    `*O que eu já consultei:* ${fontes}`,
    `*Por que não respondi:* ${p.motivo}`,
  ].join("\n");
}

/**
 * Encaminha uma vez por id: a mesma chamada repetida (ou ao mesmo tempo, de duas abas) devolve o mesmo resultado sem
 * postar de novo (#70). Vale enquanto o servidor não reinicia. Falha do Slack não fica guardada: dá para tentar de novo.
 */
export function createEncaminhador(slack: SlackDm) {
  const feitos = new Map<string, Promise<ResultadoDoEncaminhamento>>();

  async function enviar(p: PedidoDeEncaminhamento): Promise<ResultadoDoEncaminhamento> {
    if (!p.email) return { enviado: false, motivo: "sem_slack" };
    const usuario = await slack.acharPorEmail(p.email);
    if (!usuario) return { enviado: false, motivo: "sem_slack" };
    const canal = await slack.abrirConversa(usuario);
    const ts = await slack.postar({ canal, texto: mensagemDoEncaminhamento(p) });
    return { enviado: true, canal, ts, link: await slack.link(canal, ts) };
  }

  return (p: PedidoDeEncaminhamento): Promise<ResultadoDoEncaminhamento> => {
    const ja = feitos.get(p.id);
    if (ja) return ja;
    const r = enviar(p);
    feitos.set(p.id, r);
    r.catch(() => feitos.delete(p.id));
    return r;
  };
}

interface RespostaSlack {
  ok: boolean;
  error?: string;
  user?: { id: string };
  channel?: { id: string };
  ts?: string;
  permalink?: string;
}

/** Cliente do Slack com o token do bot (mesmo cuidado de kit/kota/slack/api.ts: token sem espaço e espera no 429). */
export function slackDmDeVerdade(tokenDoAmbiente: string, fetchFn: typeof fetch = fetch): SlackDm {
  const token = tokenDoAmbiente.trim();
  if (!/^[!-~]+$/.test(token)) throw new Error("SLACK_BOT_TOKEN tem espaço, quebra de linha ou acento no meio.");
  const auth = { Authorization: `Bearer ${token}` };

  async function chamar(metodo: string, init: { query?: Record<string, string>; corpo?: object }): Promise<RespostaSlack> {
    const url = `https://slack.com/api/${metodo}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
    for (let tentativa = 0; ; tentativa++) {
      // métodos de leitura (lookupByEmail, getPermalink) não aceitam corpo JSON: vão por query
      const r = init.corpo
        ? await fetchFn(url, { method: "POST", headers: { ...auth, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(init.corpo) })
        : await fetchFn(url, { headers: auth });
      if (r.status !== 429 || tentativa >= 2) return r.json() as Promise<RespostaSlack>;
      await new Promise((fim) => setTimeout(fim, (Number(r.headers.get("Retry-After")) || 1) * 1000));
    }
  }
  const falhou = (metodo: string, r: RespostaSlack) => new Error(`Slack ${metodo}: ${r.error ?? "resposta sem ok"}`);

  return {
    async acharPorEmail(email) {
      const r = await chamar("users.lookupByEmail", { query: { email } });
      if (r.error === "users_not_found") return null;
      if (!r.ok || !r.user) throw falhou("users.lookupByEmail", r);
      return r.user.id;
    },
    async abrirConversa(usuario) {
      const r = await chamar("conversations.open", { corpo: { users: usuario } });
      if (!r.ok || !r.channel) throw falhou("conversations.open", r);
      return r.channel.id;
    },
    async postar(m) {
      const r = await chamar("chat.postMessage", { corpo: { channel: m.canal, text: m.texto, username: "Puca", icon_emoji: ":sparkles:", unfurl_links: false } });
      if (!r.ok || !r.ts) throw falhou("chat.postMessage", r);
      return r.ts;
    },
    async link(canal, ts) {
      const r = await chamar("chat.getPermalink", { query: { channel: canal, message_ts: ts } });
      if (!r.ok || !r.permalink) throw falhou("chat.getPermalink", r);
      return r.permalink;
    },
  };
}
