// Valida o harness dos agentes: o que a skill nova-regra descreve continua consistente.
//   npx tsx scripts/check-harness.ts
// Confere skills (name, description, linha na tabela do CLAUDE.md, referências entre skills), o revisor e os hooks
// do .claude/settings.json (o script existe e é executável no git, senão o hook não roda na máquina dos outros).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface Resultado {
  erros: string[];
  avisos: string[];
}

export interface Arquivo {
  nome: string;
  conteudo: string;
}

/** Chaves simples do frontmatter (`chave: valor`), sem aspas em volta. */
export function frontmatter(md: string): Record<string, string> | null {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const l of m[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(l);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** Skills citadas na tabela "Skills da equipe" do CLAUDE.md (última coluna de cada linha). */
export function skillsDaTabela(claudeMd: string): string[] {
  const nomes: string[] = [];
  for (const l of claudeMd.split("\n")) {
    if (!l.startsWith("|") || l.startsWith("|---")) continue;
    const celulas = l.split("|").map((c) => c.trim()).filter(Boolean);
    const m = /^`([a-z0-9-]+)`/.exec(celulas[celulas.length - 1] ?? "");
    if (m) nomes.push(m[1]);
  }
  return nomes;
}

export function checarSkills(skills: Arquivo[], claudeMd: string): Resultado {
  const erros: string[] = [];
  const avisos: string[] = [];
  const nomes = new Set(skills.map((s) => s.nome));
  const tabela = skillsDaTabela(claudeMd);

  for (const s of skills) {
    const onde = `.claude/skills/${s.nome}/SKILL.md`;
    const fm = frontmatter(s.conteudo);
    if (!fm) {
      erros.push(`${onde}: sem frontmatter (--- name / description ---)`);
      continue;
    }
    if (fm.name !== s.nome) erros.push(`${onde}: name "${fm.name ?? ""}" diferente da pasta "${s.nome}"`);
    if (!fm.description) erros.push(`${onde}: sem description (é ela que faz o agente chamar a skill sozinho)`);
    else if (!/^Chame automaticamente/.test(fm.description))
      avisos.push(`${onde}: description não começa com "Chame automaticamente…" (padrão das skills do time)`);
    if (!tabela.includes(s.nome)) erros.push(`${onde}: skill fora da tabela "Skills da equipe" do CLAUDE.md`);
  }
  for (const t of tabela) if (!nomes.has(t)) erros.push(`CLAUDE.md: a tabela de skills cita \`${t}\`, que não existe em .claude/skills/`);

  // "skill `x`" num texto tem que apontar para uma skill que existe
  const textos: Arquivo[] = [{ nome: "CLAUDE.md", conteudo: claudeMd }, ...skills.map((s) => ({ nome: `.claude/skills/${s.nome}/SKILL.md`, conteudo: s.conteudo }))];
  for (const t of textos) {
    t.conteudo.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/skills? `\/?([a-z0-9-]+)`/g)) {
        if (!nomes.has(m[1]) && m[1] !== "nome" && m[1] !== "<nome>") erros.push(`${t.nome}:${i + 1}: cita a skill \`${m[1]}\`, que não existe`);
      }
    });
  }
  return { erros, avisos };
}

export function checarAgentes(agentes: Arquivo[]): Resultado {
  const erros: string[] = [];
  for (const a of agentes) {
    const onde = `.claude/agents/${a.nome}.md`;
    const fm = frontmatter(a.conteudo);
    if (!fm) erros.push(`${onde}: sem frontmatter`);
    else {
      if (fm.name !== a.nome) erros.push(`${onde}: name "${fm.name ?? ""}" diferente do arquivo`);
      if (!fm.description) erros.push(`${onde}: sem description`);
    }
  }
  return { erros, avisos: [] };
}

/** Modo de um arquivo: "100755"/"100644" como está no git, ou null se não está no git. */
export type ModoNoGit = (caminho: string) => string | null;

export function checarHooks(settingsTexto: string, existe: (caminho: string) => boolean, modo: ModoNoGit): Resultado {
  const erros: string[] = [];
  const avisos: string[] = [];
  let settings: { hooks?: Record<string, { hooks?: { command?: string }[] }[]> };
  try {
    settings = JSON.parse(settingsTexto);
  } catch (e) {
    return { erros: [`.claude/settings.json: JSON inválido (${(e as Error).message})`], avisos };
  }
  const vistos = new Set<string>();
  for (const [evento, grupos] of Object.entries(settings.hooks ?? {})) {
    for (const g of grupos) {
      for (const h of g.hooks ?? []) {
        const cmd = h.command ?? "";
        const m = /\$CLAUDE_PROJECT_DIR"?\/([^\s"]+)/.exec(cmd);
        if (!m) {
          avisos.push(`.claude/settings.json: hook ${evento} não chama um script do repo ("$CLAUDE_PROJECT_DIR"/scripts/…): ${cmd}`);
          continue;
        }
        const caminho = m[1];
        if (vistos.has(caminho)) continue;
        vistos.add(caminho);
        if (!existe(caminho)) {
          erros.push(`.claude/settings.json: hook ${evento} chama ${caminho}, que não existe`);
          continue;
        }
        const md = modo(caminho);
        if (md === null) avisos.push(`${caminho}: ainda não está no git (git add --chmod=+x ${caminho})`);
        else if (md !== "100755") erros.push(`${caminho}: não é executável no git, o hook falha na máquina dos outros (git add --chmod=+x ${caminho})`);
      }
    }
  }
  return { erros, avisos };
}

// ---------- CLI ----------

function lerPasta(dir: string, ler: (nome: string) => string | null): Arquivo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((nome) => {
      const conteudo = ler(nome);
      return conteudo === null ? [] : [{ nome: nome.replace(/\.md$/, ""), conteudo }];
    });
}

function main(): void {
  const skills = lerPasta(".claude/skills", (n) => {
    const p = join(".claude/skills", n);
    if (!statSync(p).isDirectory()) return null;
    return existsSync(join(p, "SKILL.md")) ? readFileSync(join(p, "SKILL.md"), "utf8") : "";
  });
  const agentes = lerPasta(".claude/agents", (n) => (n.endsWith(".md") ? readFileSync(join(".claude/agents", n), "utf8") : null));
  const modo: ModoNoGit = (c) => {
    try {
      const s = execFileSync("git", ["ls-files", "-s", "--", c], { encoding: "utf8" }).trim();
      return s ? s.split(/\s/)[0] : null;
    } catch {
      return null;
    }
  };
  const partes = [
    checarSkills(skills, readFileSync("CLAUDE.md", "utf8")),
    checarAgentes(agentes),
    checarHooks(readFileSync(".claude/settings.json", "utf8"), existsSync, modo),
  ];
  const erros = partes.flatMap((p) => p.erros);
  const avisos = partes.flatMap((p) => p.avisos);

  for (const a of avisos) console.log(`aviso  ${a}`);
  for (const e of erros) console.log(`erro   ${e}`);
  console.log(
    erros.length
      ? `\nHarness: ${erros.length} erro(s). Padrão na skill nova-regra.`
      : `Harness ok (${skills.length} skills, ${agentes.length} agente(s), hooks do settings.json).`,
  );
  process.exit(erros.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
