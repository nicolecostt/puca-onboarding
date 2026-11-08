// Brain com ADRs e código do kota-bank (#228), num clone falso montado na hora (o CI não tem o kota-bank).
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { criarBrain, trechosDoKotaBank } from "./brain";

const dir = mkdtempSync(join(tmpdir(), "kota-bank-"));
const escreve = (rel: string, texto: string) => {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), texto);
};
escreve("docs/adr/0004-saldo-com-cache.md", "# 4. Saldo e extrato com cache em memória\n\n## Contexto\n\nO saldo era lido do livro-razão a cada pedido.\n\n## Decisão\n\nO balancereader guarda o saldo em cache em memória.\n");
escreve("src/ledger/balancereader/BalanceReaderController.java", "public class BalanceReaderController {\n  // devolve o saldo da conta pelo cache\n  public long getBalance(String accountId) { return cache.get(accountId); }\n}\n");
escreve("src/ledger/balancereader/BalanceReaderControllerTest.java", "class BalanceReaderControllerTest {}\n");
escreve("extras/qualquer.py", "print('outra empresa')\n");

const trechos = trechosDoKotaBank(dir, "JucaGF/kota-bank");

describe("brain com o kota-bank", () => {
  it("ADR vira trechos por seção, com título e link do GitHub", () => {
    const decisao = trechos.find((t) => t.id === "adr:0004-saldo-com-cache#decisao");
    expect(decisao?.titulo).toBe("ADR · 4. Saldo e extrato com cache em memória · Decisão");
    expect(decisao?.url).toMatch(/^https:\/\/github\.com\/JucaGF\/kota-bank\/blob\/[^/]+\/docs\/adr\/0004-saldo-com-cache\.md\?plain=1$/);
  });

  it("código vira trechos com linhas no link; teste e extras ficam de fora", () => {
    const codigo = trechos.filter((t) => t.id.startsWith("codigo:"));
    expect(codigo.map((t) => t.id)).toEqual(["codigo:src/ledger/balancereader/BalanceReaderController.java#L1"]);
    expect(codigo[0].url).toMatch(/BalanceReaderController\.java#L1-L5$/);
  });

  it("a busca acha o ADR e o código do balancereader", () => {
    const brain = criarBrain(trechos);
    expect(brain.buscar("por que o saldo tem cache?")[0]?.id).toMatch(/^adr:0004/);
    expect(brain.buscar("onde fica o código do balancereader?").some((t) => t.id.startsWith("codigo:"))).toBe(true);
  });

  it("sem pasta docs/adr nem src, não quebra", () => {
    expect(trechosDoKotaBank(mkdtempSync(join(tmpdir(), "vazio-")))).toEqual([]);
  });
});
