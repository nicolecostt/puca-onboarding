import type { AreaId, MapaKota, PessoaKota } from "./tipos";

const pessoa = (id: string, nome: string, cargo: string, area: AreaId): PessoaKota => ({
  id,
  nome,
  cargo,
  area,
  email: `${id}@kota.example`,
  slack: nome,
  avatar: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(nome)}`,
});

export const mapa: MapaKota = {
  repo: "JucaGF/kota-bank",

  pessoas: [
    pessoa("camila", "Camila Azevedo", "Gestora de engenharia", "contas"),
    pessoa("rodrigo", "Rodrigo Queiroz", "Tech lead", "contas"),
    pessoa("raissa", "Raíssa Bentes", "Engenheira de software sênior", "contas"),
    pessoa("bruno", "Bruno Siqueira", "Engenheiro de software pleno", "contas"),

    pessoa("natalia", "Natália Brandão", "Gestora de engenharia", "livro-razao"),
    pessoa("thiago", "Thiago Nakamura", "Tech lead", "livro-razao"),
    pessoa("beatriz", "Beatriz Cavalcanti", "Engenheira de software sênior", "livro-razao"),
    pessoa("gustavo", "Gustavo Schmitt", "Engenheiro de software pleno", "livro-razao"),
    pessoa("ana", "Ana Lacerda", "Engenheira de software pleno", "livro-razao"),

    pessoa("priscila", "Priscila Antunes", "Gestora de engenharia", "canais"),
    pessoa("larissa", "Larissa Fagundes", "Tech lead", "canais"),
    pessoa("igor", "Igor Valadares", "Engenheiro de software sênior", "canais"),

    pessoa("eduardo", "Eduardo Kaminski", "Gestor de engenharia", "plataforma"),
    pessoa("nadia", "Nádia Saliba", "Tech lead", "plataforma"),
    pessoa("vinicius", "Vinícius Pires", "Engenheiro de plataforma sênior", "plataforma"),

    pessoa("simone", "Simone Araújo", "People partner", "people"),
    pessoa("jonas", "Jonas Ferraz", "Analista de segurança da informação", "seguranca"),
  ],

  times: [
    {
      id: "contas",
      nome: "Contas",
      missao: "Garantir que cada cliente consiga abrir a conta, entrar com segurança e guardar os contatos para quem costuma transferir.",
      gestor: "camila",
      techLead: "rodrigo",
      buddies: ["raissa"],
      canal: "#contas",
      canalAjuda: "#contas-ajuda",
      plantao: "Rodízio semanal, 24 horas por dia, porque o login não pode ficar fora do ar.",
    },
    {
      id: "livro-razao",
      nome: "Livro-razão",
      missao: "Registrar cada centavo que entra e sai das contas, sem perder nem duplicar transação, e mostrar saldo e extrato corretos.",
      gestor: "natalia",
      techLead: "thiago",
      buddies: ["beatriz"],
      canal: "#livro-razao",
      canalAjuda: "#livro-razao-ajuda",
      plantao: "Rodízio semanal, 24 horas por dia; quem chega acompanha um plantão antes de entrar na escala.",
    },
    {
      id: "canais",
      nome: "Canais",
      missao: "Manter o site da Kota rápido e simples para o cliente ver o saldo, transferir e depositar.",
      gestor: "priscila",
      techLead: "larissa",
      buddies: ["igor"],
      canal: "#canais",
      canalAjuda: "#canais-ajuda",
      plantao: "Horário comercial; à noite e no fim de semana, o plantão de Plataforma cobre o site.",
    },
    {
      id: "plataforma",
      nome: "Plataforma",
      missao: "Dar aos outros times um jeito confiável de subir, testar e operar os serviços, do ambiente local à produção.",
      gestor: "eduardo",
      techLead: "nadia",
      buddies: ["vinicius"],
      canal: "#plataforma",
      canalAjuda: "#plataforma-ajuda",
      plantao: "Rodízio semanal, 24 horas por dia, que também cobre o site fora do horário comercial.",
    },
  ],

  sistemas: [
    {
      id: "frontend",
      pasta: "src/frontend",
      time: "canais",
      linguagem: "Python",
      oQueFaz: "Site do banco: login, cadastro, saldo, transferência e depósito.",
      dependeDe: ["userservice", "contacts", "ledgerwriter", "balancereader", "transactionhistory"],
    },
    {
      id: "userservice",
      pasta: "src/accounts/userservice",
      time: "contas",
      linguagem: "Python",
      oQueFaz: "Cadastro e login dos clientes; assina o JWT que os outros serviços conferem.",
      dependeDe: ["accounts-db"],
    },
    {
      id: "contacts",
      pasta: "src/accounts/contacts",
      time: "contas",
      linguagem: "Python",
      oQueFaz: "Contatos de cada cliente, usados para transferir.",
      dependeDe: ["accounts-db"],
    },
    {
      id: "accounts-db",
      pasta: "src/accounts/accounts-db",
      time: "contas",
      linguagem: "Postgres",
      oQueFaz: "Banco de contas e contatos.",
      dependeDe: [],
    },
    {
      id: "ledgerwriter",
      pasta: "src/ledger/ledgerwriter",
      time: "livro-razao",
      linguagem: "Java",
      oQueFaz: "Valida e grava as transações no livro-razão.",
      dependeDe: ["balancereader", "ledger-db"],
    },
    {
      id: "balancereader",
      pasta: "src/ledger/balancereader",
      time: "livro-razao",
      linguagem: "Java",
      oQueFaz: "Saldo de cada conta, com cache, lido do livro-razão.",
      dependeDe: ["ledger-db"],
    },
    {
      id: "transactionhistory",
      pasta: "src/ledger/transactionhistory",
      time: "livro-razao",
      linguagem: "Java",
      oQueFaz: "Extrato de cada conta, com cache, lido do livro-razão.",
      dependeDe: ["ledger-db"],
    },
    {
      id: "ledger-db",
      pasta: "src/ledger/ledger-db",
      time: "livro-razao",
      linguagem: "Postgres",
      oQueFaz: "Banco do livro-razão, com todas as transações.",
      dependeDe: [],
    },
    {
      id: "loadgenerator",
      pasta: "src/loadgenerator",
      time: "plataforma",
      linguagem: "Python",
      oQueFaz: "Simula clientes usando o site, para testar o banco sob carga.",
      dependeDe: ["frontend"],
    },
    {
      id: "ledgermonolith",
      pasta: "src/ledgermonolith",
      time: "livro-razao",
      linguagem: "Java",
      oQueFaz: "Versão antiga, em monolito, dos três serviços do livro-razão.",
      dependeDe: ["ledger-db"],
      legado: true,
    },
  ],

  adrs: [
    { n: 1, titulo: "Quebrar o monolito do livro-razão em três serviços", status: "aceito", time: "livro-razao", rfc: 1, ancoras: ["src/ledgermonolith", "src/ledger"] },
    { n: 2, titulo: "JWT assinado pelo userservice e validado em cada serviço", status: "aceito", time: "contas", ancoras: ["src/accounts/userservice"] },
    { n: 3, titulo: "Um banco por domínio", status: "aceito", time: "plataforma", rfc: 2, ancoras: ["src/accounts/accounts-db", "src/ledger/ledger-db"] },
    { n: 4, titulo: "Saldo e extrato com cache em memória, lidos do livro-razão", status: "aceito", time: "livro-razao", ancoras: ["src/ledger/balancereader", "src/ledger/transactionhistory"] },
    { n: 5, titulo: "Python em Contas e Canais, Java no Livro-razão", status: "aceito", time: "plataforma", ancoras: ["src/accounts", "src/ledger"] },
    { n: 6, titulo: "Fila entre o ledgerwriter e os leitores", status: "rejeitado", time: "livro-razao", rfc: 3, ancoras: ["src/ledger/balancereader"] },
    { n: 7, titulo: "Ambiente local com docker compose construído do código", status: "aceito", time: "plataforma", ancoras: ["docker-compose.yml"] },
  ],

  rfcs: [
    { n: 1, titulo: "Separar o livro-razão do monolito", autor: "thiago", adr: 1 },
    { n: 2, titulo: "Banco de contas separado do livro-razão", autor: "nadia", adr: 3 },
    { n: 3, titulo: "Fila de eventos de transação", autor: "gustavo", adr: 6 },
  ],

  perfis: {
    novo: { pessoa: "ana", para: "livro-razao" },
    transicao: { pessoa: "bruno", de: "contas", para: "livro-razao" },
  },

  aliases: ["people@kota.example", "seguranca@kota.example"],
};
