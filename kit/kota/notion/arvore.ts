import { mapa } from "../mapa";
import { caminhoAdr, type AreaId, type MapaKota, type TimeId, type TimeKota } from "../tipos";

export type ChaveNotion = string;
export interface NoNotion { chave: ChaveNotion; titulo: string; pai: ChaveNotion | null; tipo: "pagina" | "database" | "linha" }
type Database = "pessoas" | "times" | "sistemas" | "rfcs";
type Linha = Record<string, string | string[] | boolean | number>;

const no = (chave: ChaveNotion, titulo: string, pai: ChaveNotion | null, tipo: NoNotion["tipo"] = "pagina"): NoNotion =>
  ({ chave, titulo, pai, tipo });

// A N2 cria na ordem do array: o pai sempre vem antes dos filhos.
export const ARVORE: NoNotion[] = [
  no("kota", "Kota", null),
  no("comece-aqui", "Comece aqui", "kota"),
  no("quem-somos", "Quem somos", "kota"),
  no("pessoas", "Pessoas", "kota", "database"),
  no("times", "Times", "kota", "database"),
  no("sistemas", "Sistemas", "kota", "database"),
  no("jeito-de-trabalhar", "Jeito de trabalhar", "kota"),
  no("rituais", "Rituais", "jeito-de-trabalhar"),
  no("code-review", "Code review", "jeito-de-trabalhar"),
  no("deploy", "Deploy", "jeito-de-trabalhar"),
  no("incidentes", "Incidentes", "jeito-de-trabalhar"),
  no("de-rfc-a-adr", "De RFC a ADR", "jeito-de-trabalhar"),
  no("comunicacao", "Comunicação", "jeito-de-trabalhar"),
  no("rfcs", "RFCs", "kota", "database"),
  ...mapa.rfcs.map((r) => no(`rfc-${r.n}`, r.titulo, "rfcs", "linha")),
  no("politicas", "Políticas", "kota"),
  no("seguranca-e-acesso", "Segurança e acesso a produção", "politicas"),
  no("dados-de-cliente-e-lgpd", "Dados de cliente e LGPD", "politicas"),
  no("ferias", "Férias", "politicas"),
  no("home-office", "Home office", "politicas"),
  no("despesas", "Despesas", "politicas"),
  no("papeis-buddy-gestor-rh", "Papéis de buddy, gestor e RH", "politicas"),
  no("kota-people", "Kota People", "kota"),
  no("ciclo-de-desempenho", "Ciclo de desempenho", "kota-people"),
  no("trilha-de-carreira", "Trilha de carreira", "kota-people"),
  no("promocao", "Promoção", "kota-people"),
  no("bonus", "Bônus", "kota-people"),
  no("revisao-salarial", "Revisão salarial", "kota-people"),
  no("onboarding", "Onboarding", "kota"),
  no("onboarding-novo", "Novo na Kota", "onboarding"),
  no("onboarding-transicao", "Mudando de time", "onboarding"),
  no("glossario", "Glossário do banco", "kota"),
];

const PAPEIS: Record<string, (t: TimeKota) => string[]> = {
  gestor: (t) => [t.gestor],
  "tech lead": (t) => [t.techLead],
  buddy: (t) => t.buddies,
};

export function linhasDatabase(m: MapaKota, db: Database): Linha[] {
  const nome = (id: string) => m.pessoas.find((p) => p.id === id)!.nome;
  const time = (id: TimeId) => m.times.find((t) => t.id === id)!.nome;
  const area = (a: AreaId) => (a === "people" ? "People" : a === "seguranca" ? "Segurança" : time(a));
  const papeis = (id: string) =>
    Object.keys(PAPEIS).filter((papel) => m.times.some((t) => PAPEIS[papel](t).includes(id)));
  const github = (tipo: "tree" | "blob", caminho: string) => `https://github.com/${m.repo}/${tipo}/main/${caminho}`;

  const linhas: Record<Database, () => Linha[]> = {
    pessoas: () => m.pessoas.map((p) => ({
      Nome: p.nome, Cargo: p.cargo, Área: area(p.area), "E-mail": p.email, Slack: p.slack, Papel: papeis(p.id),
    })),
    times: () => m.times.map((t) => ({
      Nome: t.nome, Missão: t.missao, Gestor: nome(t.gestor), "Tech lead": nome(t.techLead), Buddies: t.buddies.map(nome),
      Canal: t.canal, "Canal de ajuda": t.canalAjuda, Plantão: t.plantao,
    })),
    sistemas: () => m.sistemas.map((s) => ({
      Nome: s.id, Time: time(s.time), Linguagem: s.linguagem, "O que faz": s.oQueFaz, "Depende de": s.dependeDe,
      "Pasta no repo": github("tree", s.pasta), Legado: s.legado === true,
    })),
    rfcs: () => m.rfcs.map((r) => {
      const adr = m.adrs.find((a) => a.n === r.adr)!;
      return {
        Título: r.titulo, Número: r.n, Autor: nome(r.autor),
        Status: adr.status === "aceito" ? "virou ADR" : "rejeitada", ADR: github("blob", caminhoAdr(adr)),
      };
    }),
  };
  return linhas[db]();
}
