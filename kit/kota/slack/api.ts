export interface SlackApi {
  authTest(): Promise<{ teamId: string }>;
  criarCanal(nome: string): Promise<{ id: string } | { jaExiste: true }>;
  postar(m: { canalId: string; texto: string; username: string; iconUrl: string }): Promise<void>;
}

interface RespostaSlack {
  ok: boolean;
  error?: string;
  team_id?: string;
  channel?: { id: string };
}

const esperar = (ms: number) => new Promise((fim) => setTimeout(fim, ms));

export function slackDeVerdade(tokenDoAmbiente: string): SlackApi {
  const token = tokenDoAmbiente.trim();
  // O fetch recusa cabeçalho com quebra de linha e põe o valor inteiro, token junto, na mensagem do erro.
  if (!/^[!-~]+$/.test(token)) {
    throw new Error("SLACK_BOT_TOKEN tem espaço, quebra de linha ou acento no meio. Confira a variável; o valor não aparece aqui para não vazar.");
  }
  async function chamar(metodo: string, corpo: object = {}): Promise<RespostaSlack> {
    for (;;) {
      const r = await fetch(`https://slack.com/api/${metodo}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(corpo),
      });
      if (r.status !== 429) return r.json();
      await esperar((Number(r.headers.get("Retry-After")) || 1) * 1000);
    }
  }
  const falhou = (metodo: string, r: RespostaSlack) => new Error(`Slack ${metodo}: ${r.error ?? "resposta sem ok"}`);

  return {
    async authTest() {
      const r = await chamar("auth.test");
      if (!r.ok || !r.team_id) throw falhou("auth.test", r);
      return { teamId: r.team_id };
    },
    async criarCanal(nome) {
      const r = await chamar("conversations.create", { name: nome });
      if (r.error === "name_taken") return { jaExiste: true };
      if (!r.ok || !r.channel) throw falhou("conversations.create", r);
      return { id: r.channel.id };
    },
    async postar(m) {
      const r = await chamar("chat.postMessage", { channel: m.canalId, text: m.texto, username: m.username, icon_url: m.iconUrl });
      if (!r.ok) throw falhou("chat.postMessage", r);
    },
  };
}
