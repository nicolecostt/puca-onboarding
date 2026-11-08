import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";

const INICIO = "<!-- kota:servico:inicio -->";
const FIM = "<!-- kota:servico:fim -->";
const BLOCO = new RegExp(`${INICIO}[\\s\\S]*?${FIM}\\n*`, "g");
// Os serviços que o scripts/testar.sh da oficina sabe testar.
const COM_TESTES = ["userservice", "contacts", "ledgerwriter", "balancereader", "transactionhistory"];

export function blocoServico(m: MapaKota, sistemaId: string): string {
  const s = m.sistemas.find((x) => x.id === sistemaId)!;
  const t = m.times.find((x) => x.id === s.time)!;
  const nome = (id: string) => m.pessoas.find((p) => p.id === id)!.nome;
  // Sem linha em branco entre elas, o Markdown junta as linhas num parágrafo só.
  return [
    INICIO,
    `**Time:** ${t.nome} (${t.canal})`,
    `**Responsáveis:** ${nome(t.techLead)} (tech lead), ${nome(t.gestor)} (gestor)`,
    `**Depende de:** ${s.dependeDe.join(", ") || "nada"}`,
    `**Como rodar:** ${s.legado ? "legado, fora do docker compose" : `\`docker compose up --build ${s.id}\``}`,
    `**Como testar:** ${COM_TESTES.includes(s.id) ? `\`scripts/testar.sh ${s.id}\`` : "sem testes automatizados"}`,
    FIM,
  ].join("\n\n");
}

// O título "# <id>" e o bloco abrem o README; o resto é texto escrito à mão e fica como está.
export function readmeServico(texto: string, m: MapaKota, sistemaId: string): string {
  const semBloco = texto.replace(BLOCO, "").replace(/^\s*\n/, "");
  const semTitulo = semBloco.startsWith("# ") ? semBloco.slice(semBloco.indexOf("\n") + 1 || semBloco.length) : semBloco;
  const corpo = semTitulo.replace(/^\s*\n/, "");
  return `# ${sistemaId}\n\n${blocoServico(m, sistemaId)}\n${corpo && `\n${corpo}`}`;
}

export function aplicarBlocos(raiz: string, m: MapaKota): string[] {
  const faltam = m.sistemas.filter((s) => !existsSync(join(raiz, s.pasta))).map((s) => s.pasta);
  if (faltam.length) throw new Error(`pasta de sistema do mapa não existe em ${raiz}: ${faltam.join(", ")}`);
  return m.sistemas.flatMap((s) => {
    const arquivo = join(raiz, s.pasta, "README.md");
    const atual = existsSync(arquivo) ? readFileSync(arquivo, "utf8") : "";
    const novo = readmeServico(atual, m, s.id);
    if (novo === atual) return [];
    writeFileSync(arquivo, novo);
    return [`${s.pasta}/README.md`];
  });
}

function main() {
  const raiz = process.argv[2];
  if (!raiz) {
    console.error("uso: npm run kota:readmes -- <raiz do repo>");
    process.exit(1);
  }
  if (!existsSync(raiz)) {
    console.error(`repo ${raiz} não existe`);
    process.exit(1);
  }
  const mudaram = aplicarBlocos(raiz, mapa);
  console.log(mudaram.length ? `READMEs atualizados:\n${mudaram.join("\n")}` : "Os READMEs já estavam iguais ao mapa.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
