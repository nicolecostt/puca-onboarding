import { expect, it } from "vitest";
import { company } from "../../../src/data/company"; // a Tail, enquanto existir
import { mapa } from "../mapa";
import { validarMapa } from "../validar";

it("o mapa da Kota é válido e não reaproveita nomes da Tail", () =>
  expect(validarMapa(mapa, Object.values(company.people).map((p) => p.name))).toEqual([]));

it("os sistemas cobrem os 10 serviços do §2", () =>
  expect(mapa.sistemas.map((s) => s.id).sort()).toEqual(["accounts-db", "balancereader", "contacts", "frontend", "ledger-db",
    "ledgermonolith", "ledgerwriter", "loadgenerator", "transactionhistory", "userservice"]));

it("o registro tem 7 ADRs e 3 RFCs", () => {
  expect(mapa.adrs).toHaveLength(7);
  expect(mapa.rfcs).toHaveLength(3);
});
