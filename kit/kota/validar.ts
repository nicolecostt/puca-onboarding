import type { AreaId, MapaKota, PessoaKota } from "./tipos";

const AREAS_FORA_DOS_TIMES: AreaId[] = ["people", "seguranca"];
const EMAIL_KOTA = /^[^@\s]+@kota\.example$/;
const AVATAR = "https://api.dicebear.com/9.x/initials/png?seed=";
// A database Pessoas sai do mapa, e a trilha de carreira (notion/paginas/trilha-de-carreira.md) diz que o cargo traz o nível.
const CARGO_DA_TRILHA = /^(Engenheir[oa] de (software|plataforma) (júnior|pleno|sênior)|Tech lead|Gestora? de engenharia)$/;

export function validarMapa(m: MapaKota, nomesProibidos: string[] = []): string[] {
  return [
    ...repetidos(m.pessoas),
    ...slackComArroba(m.pessoas),
    ...avatares(m.pessoas),
    ...emailsForaDaKota(m),
    ...contagem(m.pessoas),
    ...cargos(m.pessoas),
    ...responsaveis(m),
    ...sistemas(m),
    ...adrsERfcs(m),
    ...numeracao("ADR", m.adrs.map((a) => a.n)),
    ...numeracao("RFC", m.rfcs.map((r) => r.n)),
    ...perfis(m),
    ...proibidos(m.pessoas, nomesProibidos),
  ];
}

const chave = (s: string) => s.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
const palavras = (s: string) => s.replace(/\p{Cf}/gu, "").split(/[^\p{L}\p{M}]+/u).filter(Boolean);

function repetidos(pessoas: PessoaKota[]): string[] {
  const campos = [["id", "id"], ["nome", "nome"], ["email", "e-mail"], ["slack", "slack"]] as const;
  const erros: string[] = [];
  for (const [campo, rotulo] of campos) {
    const vistos = new Set<string>();
    for (const p of pessoas) {
      if (vistos.has(chave(p[campo]))) erros.push(`pessoa ${p.id}: ${rotulo} "${p[campo]}" repetido`);
      vistos.add(chave(p[campo]));
    }
  }
  return erros;
}

function slackComArroba(pessoas: PessoaKota[]): string[] {
  return pessoas
    .filter((p) => chave(p.slack).startsWith("@"))
    .map((p) => `pessoa ${p.id}: slack "${p.slack}" com @; o nome do Slack vai sem @`);
}

function avatares(pessoas: PessoaKota[]): string[] {
  return pessoas
    .filter((p) => p.avatar !== AVATAR + encodeURIComponent(p.nome))
    .map((p) => `pessoa ${p.id}: avatar "${p.avatar}" não é o do DiceBear para "${p.nome}"`);
}

function emailsForaDaKota(m: MapaKota): string[] {
  return [
    ...m.pessoas.filter((p) => !EMAIL_KOTA.test(p.email)).map((p) => `pessoa ${p.id}: e-mail "${p.email}" fora de kota.example`),
    ...m.aliases.filter((a) => !EMAIL_KOTA.test(a)).map((a) => `alias: e-mail "${a}" fora de kota.example`),
  ];
}

function contagem(pessoas: PessoaKota[]): string[] {
  const nosTimes = pessoas.filter((p) => !AREAS_FORA_DOS_TIMES.includes(p.area)).length;
  const erros = nosTimes < 12 || nosTimes > 15 ? [`pessoas nos times: tem ${nosTimes}, precisa de 12 a 15`] : [];
  for (const area of AREAS_FORA_DOS_TIMES) {
    if (!pessoas.some((p) => p.area === area)) erros.push(`ninguém de ${area}`);
  }
  return erros;
}

function cargos(pessoas: PessoaKota[]): string[] {
  return pessoas
    .filter((p) => !AREAS_FORA_DOS_TIMES.includes(p.area) && !CARGO_DA_TRILHA.test(p.cargo))
    .map((p) => `pessoa ${p.id}: cargo "${p.cargo}" fora da trilha de carreira`);
}

function responsaveis(m: MapaKota): string[] {
  const porId = new Map(m.pessoas.map((p) => [p.id, p]));
  return m.times.flatMap((t) => {
    const erros = t.buddies.length ? [] : [`time ${t.id}: sem buddy`];
    const papeis = [["gestor", t.gestor], ["tech lead", t.techLead], ...t.buddies.map((b) => ["buddy", b])];
    for (const [papel, id] of papeis) {
      const p = porId.get(id);
      if (!p) erros.push(`time ${t.id}: ${papel} "${id}" não existe`);
      else if (p.area !== t.id) erros.push(`time ${t.id}: ${papel} "${id}" é de ${p.area}`);
    }
    return erros;
  });
}

function sistemas(m: MapaKota): string[] {
  const ids = new Set(m.sistemas.map((s) => s.id));
  const times = new Set(m.times.map((t) => t.id));
  return m.sistemas.flatMap((s) => [
    ...(times.has(s.time) ? [] : [`sistema ${s.id}: time "${s.time}" não existe`]),
    ...s.dependeDe.filter((d) => !ids.has(d)).map((d) => `sistema ${s.id}: depende de "${d}", que não existe`),
  ]);
}

function adrsERfcs(m: MapaKota): string[] {
  const adrs = new Map(m.adrs.map((a) => [a.n, a]));
  const rfcs = new Map(m.rfcs.map((r) => [r.n, r]));
  const pessoas = new Set(m.pessoas.map((p) => p.id));
  const erros: string[] = [];
  for (const a of m.adrs) {
    if (a.rfc === undefined) continue;
    const r = rfcs.get(a.rfc);
    if (!r) erros.push(`ADR ${a.n} cita RFC ${a.rfc}, que não existe`);
    else if (r.adr !== a.n) erros.push(`ADR ${a.n} cita RFC ${a.rfc}, mas RFC ${a.rfc} aponta ADR ${r.adr}`);
  }
  for (const r of m.rfcs) {
    const a = adrs.get(r.adr);
    if (!a) erros.push(`RFC ${r.n} aponta ADR ${r.adr}, que não existe`);
    else if (a.rfc !== r.n) erros.push(`RFC ${r.n} aponta ADR ${r.adr}, mas ADR ${r.adr} não cita RFC ${r.n}`);
    if (!pessoas.has(r.autor)) erros.push(`RFC ${r.n}: autor "${r.autor}" não existe`);
  }
  return erros;
}

function numeracao(tipo: "ADR" | "RFC", numeros: number[]): string[] {
  const valido = (n: number) => Number.isInteger(n) && n >= 1;
  const erros = numeros.filter((n) => !valido(n)).map((n) => `${tipo} ${n} inválido: o número é inteiro a partir de 1`);
  const vistos = new Set<number>();
  for (const n of numeros.filter(valido)) {
    if (vistos.has(n)) erros.push(`${tipo} ${n} repetido`);
    vistos.add(n);
  }
  for (let n = 1; n <= Math.max(0, ...vistos); n++) {
    if (!vistos.has(n)) erros.push(`${tipo}s fora de sequência: falta ${tipo} ${n}`);
  }
  return erros;
}

function perfis(m: MapaKota): string[] {
  const porId = new Map(m.pessoas.map((p) => [p.id, p]));
  const regras = [
    ["novo", m.perfis.novo.pessoa, "livro-razao"],
    ["transicao", m.perfis.transicao.pessoa, "contas"],
  ] as const;
  return regras.flatMap(([perfil, id, area]) => {
    const p = porId.get(id);
    if (!p) return [`perfil ${perfil}: pessoa "${id}" não existe`];
    return p.area === area ? [] : [`perfil ${perfil}: "${id}" é de ${p.area}, precisa ser de ${area}`];
  });
}

function proibidos(pessoas: PessoaKota[], nomes: string[]): string[] {
  return pessoas.flatMap((p) => {
    const erros = new Set<string>();
    for (const [campo, texto] of [["nome", p.nome], ["slack", p.slack]] as const) {
      if (nomes.some((n) => chave(n) === chave(texto))) {
        erros.add(`pessoa ${p.id}: ${campo} "${texto}" é da Tail`);
        continue;
      }
      for (const palavra of palavras(texto)) {
        const xara = nomes.find((n) => chave(palavras(n)[0]) === chave(palavra));
        if (xara) erros.add(`pessoa ${p.id}: primeiro nome "${palavra}" de "${xara}" é da Tail`);
      }
    }
    return [...erros];
  });
}
