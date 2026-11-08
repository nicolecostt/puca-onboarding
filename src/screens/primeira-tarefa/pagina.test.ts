import { describe, expect, it } from "vitest";
import type { PedidoDeAprovacao } from "../../journey/primeira-tarefa";
import { pedidoDaPagina, statusDaPagina } from "./pagina";

const pedido = (id: string, at: string, extra: Partial<PedidoDeAprovacao> = {}): PedidoDeAprovacao => ({
  id,
  at,
  pessoa: "Bruno",
  gestor: "Marcos Vidal",
  tarefa: {
    no: "task-dlq",
    titulo: "Fazer a publicação de configuração tentar de novo.",
    problema: "a configuração se perde",
    porque: "a maquininha fica desatualizada",
    sistemas: "terminal-config-api e config-topic",
    onde_ler: "README do terminal-config-api",
    quem_ajuda: "Lucas Melo e Paula Nunes",
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
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z", { status: "pendente" }))).toBe("Aguardando aprovação de Marcos Vidal");
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z", { status: "enviando" }))).toBe("Aguardando aprovação de Marcos Vidal");
    expect(statusDaPagina(pedido("a", "2026-11-08T14:00:00Z"))).toBe("Aguardando aprovação de Marcos Vidal");
  });

  it("aprovada mostra quem aprovou e quando", () => {
    const p = pedido("a", "2026-11-08T14:00:00Z", { status: "aprovada", aprovada_por: "Marcos Vidal", aprovada_em: "2026-11-08T17:32:00Z" });
    expect(statusDaPagina(p)).toMatch(/^Aprovada por Marcos Vidal em \d{2}\/\d{2}, \d{1,2}h\d{2}$/);
  });
});
