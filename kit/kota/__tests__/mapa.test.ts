import { expect, it } from "vitest";
import { mapa } from "../mapa";
import { validarMapa } from "../validar";

// As pessoas da empresa de teste que veio antes da Kota (decisão 0005). Fixas aqui: o src/data/company.ts agora é a Kota.
const NOMES_ANTIGOS = ["Diego Ramos", "Júlia Paiva", "Rafael Lins", "Carla Mendes", "Lucas Melo", "Marcos Vidal", "Paula Nunes"];

it("o mapa da Kota é válido e não reaproveita nomes antigos", () => expect(validarMapa(mapa, NOMES_ANTIGOS)).toEqual([]));

it("os sistemas cobrem os 10 serviços do §2", () =>
  expect(mapa.sistemas.map((s) => s.id).sort()).toEqual(["accounts-db", "balancereader", "contacts", "frontend", "ledger-db",
    "ledgermonolith", "ledgerwriter", "loadgenerator", "transactionhistory", "userservice"]));

it("o registro tem 7 ADRs e 3 RFCs", () => {
  expect(mapa.adrs).toHaveLength(7);
  expect(mapa.rfcs).toHaveLength(3);
});
