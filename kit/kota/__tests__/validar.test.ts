import { describe, expect, it } from "vitest";
import { caminhoAdr, type AdrKota, type AreaId, type Email, type MapaKota, type PessoaKota, type TimeId } from "../tipos";
import { validarMapa } from "../validar";

function pessoa(id: string, nome: string, area: AreaId): PessoaKota {
  return {
    id,
    nome,
    cargo: "Engenharia",
    area,
    email: `${id}@kota.example`,
    slack: nome,
    avatar: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(nome)}`,
  };
}

function time(id: TimeId, gestor: string, techLead: string, buddy: string) {
  return {
    id,
    nome: id,
    missao: `Missão de ${id}`,
    gestor,
    techLead,
    buddies: [buddy],
    canal: `#${id}` as const,
    canalAjuda: `#${id}-ajuda` as const,
    plantao: "Rodízio semanal",
  };
}

function mapaMinimo(): MapaKota {
  return {
    repo: "JucaGF/kota-bank",
    pessoas: [
      pessoa("ana-souza", "Ana Souza", "contas"),
      pessoa("bruno-teles", "Bruno Teles", "contas"),
      pessoa("clara-dias", "Clara Dias", "contas"),
      pessoa("davi-rocha", "Davi Rocha", "livro-razao"),
      pessoa("elisa-prado", "Elisa Prado", "livro-razao"),
      pessoa("fabio-lima", "Fábio Lima", "livro-razao"),
      pessoa("helena-cruz", "Helena Cruz", "canais"),
      pessoa("ivan-moura", "Ivan Moura", "canais"),
      pessoa("joana-reis", "Joana Reis", "canais"),
      pessoa("kaue-barros", "Kauê Barros", "plataforma"),
      pessoa("laura-pinto", "Laura Pinto", "plataforma"),
      pessoa("mateus-faria", "Mateus Faria", "plataforma"),
      pessoa("nina-alves", "Nina Alves", "people"),
      pessoa("otavio-sales", "Otávio Sales", "seguranca"),
    ],
    times: [
      time("contas", "ana-souza", "bruno-teles", "clara-dias"),
      time("livro-razao", "davi-rocha", "elisa-prado", "fabio-lima"),
      time("canais", "helena-cruz", "ivan-moura", "joana-reis"),
      time("plataforma", "kaue-barros", "laura-pinto", "mateus-faria"),
    ],
    sistemas: [
      { id: "frontend", pasta: "src/frontend", time: "canais", linguagem: "Python", oQueFaz: "Site", dependeDe: ["userservice"] },
      { id: "userservice", pasta: "src/accounts/userservice", time: "contas", linguagem: "Python", oQueFaz: "Login", dependeDe: [] },
    ],
    adrs: [
      { n: 1, titulo: "Quebrar o monolito", status: "aceito", time: "livro-razao", rfc: 1, ancoras: ["src/ledger"] },
      { n: 2, titulo: "JWT assinado no userservice", status: "aceito", time: "contas", ancoras: [] },
      { n: 3, titulo: "Cache no saldo", status: "rejeitado", time: "livro-razao", rfc: 2, ancoras: [] },
    ],
    rfcs: [
      { n: 1, titulo: "Separar o livro-razão", autor: "elisa-prado", adr: 1 },
      { n: 2, titulo: "Cache de saldo", autor: "davi-rocha", adr: 3 },
    ],
    perfis: {
      novo: { pessoa: "fabio-lima", para: "livro-razao" },
      transicao: { pessoa: "clara-dias", de: "contas", para: "livro-razao" },
    },
    aliases: ["people@kota.example", "seguranca@kota.example"],
  };
}

function com(mudar: (m: MapaKota) => void): MapaKota {
  const m = mapaMinimo();
  mudar(m);
  return m;
}

const erros = (m: MapaKota, nomesProibidos?: string[]) => validarMapa(m, nomesProibidos).join("\n");

describe("validarMapa", () => {
  it("aceita o mapa mínimo", () => expect(validarMapa(mapaMinimo())).toEqual([]));

  it("acusa gestor, tech lead ou buddy que não existe", () => {
    expect(erros(com((m) => { m.times[0].gestor = "ninguem"; }))).toMatch(/time contas: gestor "ninguem" não existe/);
    expect(erros(com((m) => { m.times[1].techLead = "ninguem"; }))).toMatch(/time livro-razao: tech lead "ninguem" não existe/);
    expect(erros(com((m) => { m.times[2].buddies.push("ninguem"); }))).toMatch(/time canais: buddy "ninguem" não existe/);
  });

  it("acusa responsável de outro time", () => {
    expect(erros(com((m) => { m.times[0].techLead = "elisa-prado"; }))).toMatch(/time contas: tech lead "elisa-prado" é de livro-razao/);
    expect(erros(com((m) => { m.times[3].buddies = ["nina-alves"]; }))).toMatch(/time plataforma: buddy "nina-alves" é de people/);
  });

  it("acusa time sem buddy", () =>
    expect(erros(com((m) => { m.times[2].buddies = []; }))).toMatch(/time canais: sem buddy/));

  it("acusa contagem fora de 12 a 15 pessoas nos times", () => {
    expect(erros(com((m) => { m.pessoas = m.pessoas.filter((p) => p.id !== "mateus-faria"); }))).toMatch(/tem 11, precisa de 12 a 15/);
    const quatroAMais = ["pedro-gomes", "quiteria-luz", "renan-dutra", "sofia-vaz"].map((id) => pessoa(id, id, "plataforma"));
    expect(erros(com((m) => { m.pessoas.push(...quatroAMais); }))).toMatch(/tem 16, precisa de 12 a 15/);
    expect(validarMapa(com((m) => { m.pessoas.push(...quatroAMais.slice(1)); }))).toEqual([]);
  });

  it("acusa falta de alguém de people e de seguranca", () => {
    const m = com((m) => { m.pessoas = m.pessoas.filter((p) => p.area !== "people" && p.area !== "seguranca"); });
    expect(erros(m)).toMatch(/ninguém de people/);
    expect(erros(m)).toMatch(/ninguém de seguranca/);
  });

  it("acusa id ou nome repetido", () => {
    expect(erros(com((m) => { m.pessoas[1].id = "ana-souza"; }))).toMatch(/id "ana-souza" repetido/);
    expect(erros(com((m) => { m.pessoas[1].nome = "Ana Souza"; }))).toMatch(/pessoa bruno-teles: nome "Ana Souza" repetido/);
    expect(erros(com((m) => { m.pessoas[1].nome = "ANA SÓUZA"; }))).toMatch(/pessoa bruno-teles: nome "ANA SÓUZA" repetido/);
  });

  it("acusa e-mail ou nome do Slack repetido", () => {
    expect(erros(com((m) => { m.pessoas[1].email = "ana-souza@kota.example"; }))).toMatch(/pessoa bruno-teles: e-mail "ana-souza@kota.example" repetido/);
    expect(erros(com((m) => { m.pessoas[1].slack = "Ana Souza"; }))).toMatch(/pessoa bruno-teles: slack "Ana Souza" repetido/);
  });

  it("acusa avatar que não é o do DiceBear com o nome", () => {
    const naoCodificado = "https://api.dicebear.com/9.x/initials/png?seed=Ana Souza";
    expect(erros(com((m) => { m.pessoas[0].avatar = naoCodificado; }))).toMatch(/pessoa ana-souza: avatar .* não é o do DiceBear/);
    const codificado = "https://api.dicebear.com/9.x/initials/png?seed=Ana%20Souza";
    expect(validarMapa(com((m) => { m.pessoas[0].avatar = codificado; }))).toEqual([]);
  });

  it("acusa e-mail fora de kota.example", () => {
    expect(erros(com((m) => { m.pessoas[0].email = "ana@gmail.com" as Email; }))).toMatch(/pessoa ana-souza: e-mail .* fora de kota\.example/);
    expect(erros(com((m) => { m.pessoas[0].email = "ana@kota.example.com" as Email; }))).toMatch(/pessoa ana-souza: e-mail .* fora de kota\.example/);
    expect(erros(com((m) => { m.aliases.push("rh@kota.com" as Email); }))).toMatch(/e-mail "rh@kota\.com" fora de kota\.example/);
  });

  it("acusa sistema com dependência ou time inexistente", () => {
    expect(erros(com((m) => { m.sistemas[0].dependeDe.push("contacts"); }))).toMatch(/sistema frontend: depende de "contacts", que não existe/);
    expect(erros(com((m) => { m.sistemas[1].time = "financeiro" as TimeId; }))).toMatch(/sistema userservice: time "financeiro" não existe/);
  });

  it("acusa ADR com RFC inexistente e RFC que não volta para o ADR", () => {
    expect(erros(com((m) => { m.adrs[1].rfc = 9; }))).toMatch(/ADR 2 cita RFC 9, que não existe/);
    expect(erros(com((m) => { m.adrs[2].rfc = undefined; }))).toMatch(/RFC 2 aponta ADR 3, mas ADR 3 não cita RFC 2/);
    const cruzado = erros(com((m) => { m.rfcs[0].adr = 2; }));
    expect(cruzado).toMatch(/ADR 1 cita RFC 1, mas RFC 1 aponta ADR 2/);
    expect(cruzado).toMatch(/RFC 1 aponta ADR 2, mas ADR 2 não cita RFC 1/);
    expect(erros(com((m) => { m.rfcs[1].adr = 7; }))).toMatch(/RFC 2 aponta ADR 7, que não existe/);
  });

  it("acusa autor de RFC que não existe", () =>
    expect(erros(com((m) => { m.rfcs[0].autor = "ninguem"; }))).toMatch(/RFC 1: autor "ninguem" não existe/));

  it("acusa número de ADR ou RFC repetido ou fora de sequência", () => {
    expect(erros(com((m) => { m.adrs[1].n = 1; }))).toMatch(/ADR 1 repetido/);
    expect(erros(com((m) => { m.adrs[2].n = 5; }))).toMatch(/falta ADR 3/);
    expect(erros(com((m) => { m.rfcs[1].n = 3; }))).toMatch(/falta RFC 2/);
  });

  it("acusa pessoa do perfil novo fora do livro-razão e da transição fora de contas", () => {
    expect(erros(com((m) => { m.perfis.novo.pessoa = "clara-dias"; }))).toMatch(/perfil novo: "clara-dias" é de contas, precisa ser de livro-razao/);
    expect(erros(com((m) => { m.perfis.transicao.pessoa = "fabio-lima"; }))).toMatch(/perfil transicao: "fabio-lima" é de livro-razao, precisa ser de contas/);
    expect(erros(com((m) => { m.perfis.novo.pessoa = "ninguem"; }))).toMatch(/perfil novo: pessoa "ninguem" não existe/);
  });

  it("acusa nome proibido", () =>
    expect(erros(mapaMinimo(), ["Ana Souza"])).toMatch(/pessoa ana-souza: nome "Ana Souza" é da Tail/));

  it("acusa primeiro nome igual ao de um nome proibido", () => {
    expect(erros(mapaMinimo(), ["Davi Ramos"])).toMatch(/pessoa davi-rocha: primeiro nome "Davi" de "Davi Ramos" é da Tail/);
    expect(validarMapa(mapaMinimo(), ["Diego Rocha"])).toEqual([]);
  });

  it("compara nomes proibidos sem diferenciar maiúsculas e acentos", () => {
    expect(erros(mapaMinimo(), ["ána SOUZA"])).toMatch(/pessoa ana-souza: nome "Ana Souza" é da Tail/);
    expect(erros(mapaMinimo(), ["FABIO Nunes"])).toMatch(/pessoa fabio-lima: primeiro nome "Fábio" de "FABIO Nunes" é da Tail/);
  });
});

describe("caminhoAdr", () => {
  it("tira acento e pontuação", () =>
    expect(caminhoAdr({ n: 5, titulo: "Python em Contas e Canais, Java no Livro-razão" } as AdrKota)).toBe(
      "docs/adr/0005-python-em-contas-e-canais-java-no-livro-razao.md",
    ));
});
