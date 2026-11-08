import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { TAREFAS, type TarefaKota } from "../../tarefas/tarefas";
import type { MapaKota } from "../../tipos";
import { existe } from "../caminhos";
import type { ContextoKota, Regra } from "../contexto";

/** O que a regra lê de uma primeira tarefa do catálogo: o cartão do nó tem de bater com a issue. */
export type TarefaDaJornada = Pick<TarefaKota, "titulo" | "perfis" | "sistemas" | "quemAjuda">;

interface NoLido {
  id: string;
  kind: string;
  info?: {
    role?: string;
    bullets?: string[];
    owner?: string;
    vinculo?: string;
    docs?: { title: string; url?: string }[];
    adr?: { id: string; title: string; owner?: string };
  };
}

const BLOB = "https://github.com/JucaGF/kota-bank/blob/main/";

export function regraJornada(tarefas: TarefaDaJornada[]): Regra {
  return {
    nome: "jornada",
    precisaRepo: false,
    checar(ctx) {
      return ctx.jornadas.flatMap((arquivo) => {
        const j = JSON.parse(readFileSync(arquivo, "utf8")) as { boards: Record<string, { nodes: NoLido[] }> };
        const nos = Object.values(j.boards).flatMap((b) => b.nodes);
        return nos.flatMap((n) => checarNo(n, ctx, tarefas).map((e) => `${basename(arquivo)}: nó ${n.id}: ${e}`));
      });
    },
  };
}

function checarNo(n: NoLido, ctx: ContextoKota, tarefas: TarefaDaJornada[]): string[] {
  const i = n.info;
  if (!i) return [];
  return [
    ...(i.docs ?? []).flatMap((d) => checarDoc(d, ctx)),
    ...(i.adr ? checarAdr(i.adr, ctx) : []),
    ...(n.kind === "task" ? checarTarefa(i.role ?? "", i.vinculo, i.bullets ?? [], tarefas, ctx.mapa) : []),
    ...[i.owner, i.adr?.owner].flatMap((nome) => checarResponsavel(nome, ctx)),
  ];
}

function checarDoc(d: { title: string; url?: string }, ctx: ContextoKota): string[] {
  if (!d.url) return [`doc "${d.title}" sem url`];
  if (Object.values(ctx.notionUrls).includes(d.url)) return [];
  if (!d.url.startsWith(BLOB)) return [`doc "${d.title}" com url fora do kit (${d.url})`];
  const caminho = d.url.slice(BLOB.length);
  if (ctx.repo && !existe(ctx.repo, caminho)) return [`doc "${d.title}" aponta para ${caminho}, que não existe no repo`];
  return [];
}

function checarAdr(a: { id: string; title: string }, ctx: ContextoKota): string[] {
  const doMapa = ctx.mapa.adrs.find((x) => a.id === `ADR-${String(x.n).padStart(4, "0")}`);
  if (!doMapa) {
    const ids = ctx.mapa.adrs.map((x) => `ADR-${String(x.n).padStart(4, "0")}`);
    return [`${a.id} não é um ADR do mapa (${ids[0]} a ${ids.at(-1)})`];
  }
  return a.title === doMapa.titulo ? [] : [`${a.id} com título "${a.title}", no mapa "${doMapa.titulo}"`];
}

function checarTarefa(titulo: string, vinculo: string | undefined, bullets: string[], tarefas: TarefaDaJornada[], m: MapaKota): string[] {
  const t = tarefas.find((x) => x.titulo === titulo);
  if (!t) return [`tarefa "${titulo}" fora do catálogo de primeira tarefa`];
  if (vinculo && !t.perfis.includes(vinculo as TarefaDaJornada["perfis"][number])) return [`tarefa "${titulo}" não é do vínculo ${vinculo}`];
  // a página da tarefa e o pedido ao gestor saem destes bullets (src/journey/primeira-tarefa.ts)
  const campo = (prefixo: string) => bullets.find((b) => b.startsWith(prefixo)) ?? "";
  const sistemas = campo("Sistemas:");
  const quemAjuda = campo("Quem ajuda:");
  const daIssue = t.quemAjuda.map((id) => m.pessoas.find((p) => p.id === id)?.nome ?? id);
  return [
    ...t.sistemas.filter((s) => !sistemas.includes(s)).map((s) => `tarefa "${titulo}" sem o sistema ${s} em "Sistemas:"`),
    ...daIssue.filter((nome) => !quemAjuda.includes(nome)).map((nome) => `tarefa "${titulo}" sem ${nome} em "Quem ajuda:", como na issue`),
    ...m.pessoas
      .filter((p) => !daIssue.includes(p.nome) && quemAjuda.includes(p.nome))
      .map((p) => `tarefa "${titulo}" com ${p.nome} em "Quem ajuda:", que a issue não cita`),
  ];
}

function checarResponsavel(nome: string | undefined, ctx: ContextoKota): string[] {
  if (!nome || /^\{\w+\}$/.test(nome)) return [];
  return ctx.mapa.pessoas.some((p) => p.nome === nome) ? [] : [`responsável "${nome}" não é uma pessoa da Kota`];
}

export const regraJornadaDaKota = regraJornada(TAREFAS);
