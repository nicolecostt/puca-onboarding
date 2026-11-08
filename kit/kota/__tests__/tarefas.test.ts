import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapa } from "../mapa";
import { conferirTarefa, corpoIssue, TAREFAS, type TarefaKota } from "../tarefas/tarefas";

const pasta = join(__dirname, "../tarefas");
const urls: Record<string, string> = JSON.parse(readFileSync(join(__dirname, "../notion/urls.json"), "utf8"));
const pessoa = (id: string) => mapa.pessoas.find((p) => p.id === id);
const tarefa = TAREFAS[0];

const verde = { ok: true, texto: "[INFO] Tests run: 21, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS" };
const vermelha = (t: TarefaKota, resumo = "Tests run: 22, Failures: 1, Errors: 0, Skipped: 0") => ({
  ok: false,
  texto: [
    "[ERROR] Failures: ",
    `[ERROR]   ${t.testeQueFalha}:245 Expected java.lang.IllegalArgumentException to be thrown, but nothing was thrown.`,
    `[ERROR] ${resumo}`,
    "[INFO] BUILD FAILURE",
  ].join("\n"),
});

describe("corpoIssue", () => {
  it("corpo tem as seis seções e nenhum @", () => {
    for (const t of TAREFAS) {
      const corpo = corpoIssue(t, 7, mapa, urls);
      const secoes = [...corpo.matchAll(/^## (.+)$/gm)].map((s) => s[1]);
      expect(secoes).toEqual(["Problema", "Por que importa", "Sistemas", "Onde ler", "Quem ajuda", "Como começar"]);
      expect(corpo).not.toContain("@");
    }
  });

  it("onde ler tem os links resolvidos para o kota-bank e o Notion", () => {
    const corpo = corpoIssue(tarefa, 7, mapa, urls);
    expect(corpo).not.toContain("notion:");
    expect(corpo).toContain(urls.sistemas);
    expect(corpo).toContain(`https://github.com/${mapa.repo}/blob/main/src/ledger/ledgerwriter/README.md`);
  });

  it("como começar aponta para as branches da issue, o teste do serviço e a aprovação do gestor", () => {
    const corpo = corpoIssue(tarefa, 7, mapa, urls);
    const gestor = pessoa(mapa.times.find((t) => t.id === tarefa.time)!.gestor)!;
    expect(corpo).toContain("git switch tarefa/7");
    expect(corpo).toContain(`scripts/testar.sh ${tarefa.servico}`);
    expect(corpo).toContain("solucao/7");
    expect(corpo).toContain(gestor.nome);
  });

  it("diz quem abriu a issue, já que no GitHub ela sai pela conta de quem publica", () => {
    expect(corpoIssue(tarefa, 7, mapa, urls)).toContain(`Aberta por ${pessoa(tarefa.autor)!.nome}`);
  });

  it("quem ajuda tem os nomes e o canal de ajuda do time", () => {
    const corpo = corpoIssue(tarefa, 7, mapa, urls);
    for (const id of tarefa.quemAjuda) expect(corpo).toContain(pessoa(id)!.nome);
    expect(corpo).toContain("#livro-razao-ajuda");
  });
});

describe("conferirTarefa", () => {
  it("aceita main verde, tarefa falhando só no teste esperado e solucao verde", () => {
    expect(conferirTarefa({ main: verde, tarefa: vermelha(tarefa), solucao: verde }, tarefa)).toEqual([]);
  });

  it("acusa tarefa que passa na branch tarefa", () => {
    expect(conferirTarefa({ main: verde, tarefa: verde, solucao: verde }, tarefa)).toHaveLength(1);
  });

  it("acusa tarefa que falha sem citar testeQueFalha", () => {
    const outra = { ...tarefa, testeQueFalha: "OutroTest.outroMetodo" };
    expect(conferirTarefa({ main: verde, tarefa: vermelha(tarefa), solucao: verde }, outra)).toHaveLength(1);
  });

  it("acusa tarefa que falha em mais de um teste", () => {
    const duas = vermelha(tarefa, "Tests run: 22, Failures: 1, Errors: 1, Skipped: 0");
    expect(conferirTarefa({ main: verde, tarefa: duas, solucao: verde }, tarefa)).toHaveLength(1);
  });

  it("acusa tarefa que não chega a rodar os testes", () => {
    const compilacao = {
      ok: false,
      texto: `[ERROR] COMPILATION ERROR :\n[ERROR] ${tarefa.testeQueFalha} cannot find symbol\n[INFO] BUILD FAILURE`,
    };
    expect(conferirTarefa({ main: verde, tarefa: compilacao, solucao: verde }, tarefa)).toHaveLength(1);
  });

  it("acusa main ou solucao vermelha", () => {
    const falha = { ok: false, texto: "[INFO] BUILD FAILURE" };
    expect(conferirTarefa({ main: falha, tarefa: vermelha(tarefa), solucao: verde }, tarefa)).toHaveLength(1);
    expect(conferirTarefa({ main: verde, tarefa: vermelha(tarefa), solucao: falha }, tarefa)).toHaveLength(1);
  });
});

describe("TAREFAS", () => {
  it("são de 3 a 5, com chave e título únicos", () => {
    expect(TAREFAS.length).toBeGreaterThanOrEqual(3);
    expect(TAREFAS.length).toBeLessThanOrEqual(5);
    expect(new Set(TAREFAS.map((t) => t.chave)).size).toBe(TAREFAS.length);
    expect(new Set(TAREFAS.map((t) => t.titulo)).size).toBe(TAREFAS.length);
  });

  it("toda tarefa tem autor e quem ajuda no mapa, e há uma no livro-razão para cada perfil", () => {
    for (const t of TAREFAS) {
      expect(pessoa(t.autor), `${t.chave}: autor`).toBeDefined();
      for (const id of t.quemAjuda) expect(pessoa(id), `${t.chave}: ${id}`).toBeDefined();
      for (const s of t.sistemas) expect(mapa.sistemas.some((x) => x.id === s), `${t.chave}: ${s}`).toBe(true);
    }
    for (const perfil of ["novo", "transicao"] as const) {
      expect(TAREFAS.some((t) => t.time === "livro-razao" && t.perfis.includes(perfil)), perfil).toBe(true);
    }
  });

  it("os patches existem, são assinados pelo autor da tarefa e só mexem no serviço dela", () => {
    for (const t of TAREFAS) {
      const servico = mapa.sistemas.find((s) => s.id === t.servico)!;
      const autor = pessoa(t.autor)!;
      for (const nome of ["teste.patch", "solucao.patch"]) {
        const patch = readFileSync(join(pasta, t.chave, nome), "utf8");
        expect(patch, `${t.chave}/${nome}`).toContain(`From: ${autor.nome} <${autor.email}>`);
        const arquivos = [...patch.matchAll(/^diff --git a\/(\S+) b\//gm)].map((d) => d[1]);
        expect(arquivos.length, `${t.chave}/${nome}`).toBeGreaterThan(0);
        for (const a of arquivos) expect(a.startsWith(`${servico.pasta}/`), `${t.chave}/${nome}: ${a}`).toBe(true);
      }
    }
  });
});
