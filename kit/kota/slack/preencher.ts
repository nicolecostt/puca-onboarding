import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";
import { slackDeVerdade, type SlackApi } from "./api";
import { HISTORICO, type MensagemKota } from "./historico";

export async function preencherSlack(api: SlackApi, m: MapaKota, historico: MensagemKota[], teamIdEsperado: string):
  Promise<{ canaisCriados: string[]; canaisPulados: string[]; mensagens: number }> {
  const canais: `#${string}`[] = ["#geral", "#people", ...m.times.flatMap((t) => [t.canal, t.canalAjuda])];
  const pessoas = new Map(m.pessoas.map((p) => [p.id, p]));

  // Valida tudo antes de escrever: um canal criado e não preenchido seria pulado para sempre nas próximas execuções.
  const problemas = historico.flatMap((h) => [
    ...(pessoas.has(h.autor) ? [] : [`autor "${h.autor}" de ${h.canal} não está no mapa`]),
    ...(canais.includes(h.canal) ? [] : [`${h.canal} não é um canal da Kota`]),
  ]);
  if (problemas.length) throw new Error(`histórico inválido, nada foi criado nem postado:\n${problemas.join("\n")}`);

  const { teamId } = await api.authTest();
  if (teamId !== teamIdEsperado) {
    throw new Error(`workspace ${teamId} não é o da Kota (${teamIdEsperado}); nada foi criado nem postado`);
  }

  const canaisCriados: string[] = [];
  const canaisPulados: string[] = [];
  let mensagens = 0;
  for (const canal of canais) {
    const r = await api.criarCanal(canal.slice(1));
    if (!("id" in r)) {
      canaisPulados.push(canal);
      continue;
    }
    canaisCriados.push(canal);
    try {
      for (const h of historico.filter((h) => h.canal === canal)) {
        const p = pessoas.get(h.autor)!;
        await api.postar({ canalId: r.id, texto: h.texto, username: p.slack, iconUrl: p.avatar });
        mensagens++;
      }
    } catch (e) {
      // Arquivar não libera o nome no Slack: só apagando o canal a próxima execução cria e preenche de novo.
      throw new Error(`${canal} ficou pela metade: ${(e as Error).message}. Apague o canal no Slack e rode de novo.`, { cause: e });
    }
  }
  return { canaisCriados, canaisPulados, mensagens };
}

async function main() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("Falta SLACK_BOT_TOKEN no ambiente: o token do bot do app da Kota, que fica fora do repositório.");
    process.exit(1);
  }
  const { teamId } = JSON.parse(readFileSync(new URL("./workspace.json", import.meta.url), "utf8")) as { teamId: string };
  const r = await preencherSlack(slackDeVerdade(token), mapa, HISTORICO, teamId);
  console.log(`canais criados: ${r.canaisCriados.join(", ") || "nenhum"}`);
  console.log(`canais pulados (já existiam): ${r.canaisPulados.join(", ") || "nenhum"}`);
  console.log(`mensagens: ${r.mensagens}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
