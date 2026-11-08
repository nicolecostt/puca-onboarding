import { describe, expect, it } from "vitest";
import type { PedidoDeAprovacao } from "../../journey/primeira-tarefa";
import { pedidoDaPagina, statusDaPagina } from "./pagina";

const pedido = (id: string, at: string, extra: Partial<PedidoDeAprovacao> = {}): PedidoDeAprovacao => ({
  id,
  at,
  pessoa: "Bruno",
  gestor: "Natália Brandão",
  tarefa: {
    no: "task-403",
    titulo: "Extrato de outra conta responde 403 no transactionhistory",
    problema: "o extrato de outra conta responde 401",
    porque: "401 quer dizer token inválido",
    sistemas: "só o transactionhistory",
    onde_ler: "ADR 2 e README do transactionhistory",
    quem_ajuda: "Beatriz Cavalcanti e Thiago Nakamura",
  },
  moment: "primeira-tarefa",
  status: "aguardando",
  ...extra,
});

describe("pedidoDaPagina", () => {
  it("pedidoDaPagina com lixo devolve null", () => {
    for (const raw of ["x", [{}], null, undefined, { a: 1 }, [{ id: "1", status: "aguardando" }]]) {
      expect(pedidoDaPagina(raw, null), JSON.stringify(raw)).toBeNull();
    }
  });

  it("sem id devolve o mais recente", () => {
    const list = [pedido("a", "2026-11-08T14:00:00Z"), pedido("b", "2026-11-08T15:00:00Z"), pedido("c", "2026-11-08T13:00:00Z")];
    expect(pedidoDaPagina(list, null)?.id).toBe("b");
  });

  it("com id devolve aquele, e id que não existe devolve null", () => {
    const list = [pedido("a", "2026-11-08T14:00:00Z"), pedido("b", "2026-11-08T15:00:00Z")];
    expect(pedidoDaPagina(list, "a")?.id).toBe("a");
    expect(pedidoDaPagina(list, "z")).toBeNull();
  });

  it("ignora itens quebrados no meio da lista", () => {
    const list = [pedido("a", "2026-11-08T14:00:00Z"), { id: "b", at: "2026-11-08T16:00:00Z" }];
    expect(pedidoDaPagina(list, null)?.id).toBe("a");
  });
});

describe("statusDaPagina", () => {
  it("antes de o Slack enviar e enquanto espera, mostra quem aprova", () => {
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z", { status: "pendente" }))).toBe("Aguardando aprovação de Natália Brandão");
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z", { status: "enviando" }))).toBe("Aguardando aprovação de Natália Brandão");
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z"))).toBe("Aguardando aprovação de Natália Brandão");
  });

  it("aprovada mostra quem aprovou e quando", () => {
    const p = pedido("a", "2026-11-08T14:00:00Z", { status: "aprovada", aprovada_por: "Natália Brandão", aprovada_em: "2026-11-08T17:32:00Z" });
    expect(statusDaPagina(p)).toMatch(/^Aprovada por Natália Brandão em \d{2}\/\d{2}, \d{1,2}h\d{2}$/);
  });
});
