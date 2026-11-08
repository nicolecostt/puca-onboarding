// Brain mínimo com os arquivos reais do kit da Kota.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarBrain, trechosDoKit } from "./brain";
import { mapa } from "../../../kit/kota/mapa";

const raiz = new URL("../../../", import.meta.url).pathname;
const urls = JSON.parse(readFileSync(new URL("../../../kit/kota/notion/urls.json", import.meta.url), "utf8")) as Record<string, string>;
const trechos = trechosDoKit({ paginasDir: `${raiz}kit/kota/notion/paginas`, urls, mapa });
const brain = carregarBrain(raiz);

describe("brain", () => {
  it("tem trechos da página de deploy com a URL pública", () => {
    const deploy = trechos.filter((t) => t.id.startsWith("notion:deploy#"));
    expect(deploy.length).toBeGreaterThan(0);
    expect(deploy.every((t) => t.url === urls.deploy)).toBe(true);
    expect(deploy[0].titulo.startsWith("Deploy · ")).toBe(true);
  });

  it("tem o trecho do mapa do sistema balancereader", () => {
    const t = trechos.find((x) => x.id === "mapa:sistemas/balancereader");
    expect(t).toBeDefined();
    expect(t!.titulo).toBe("Sistemas · balancereader");
    expect(t!.url).toBe(urls.sistemas);
  });

  it("acha o deploy entre os 3 primeiros", () => {
    const ids = brain.buscar("como funciona o deploy?").slice(0, 3).map((t) => t.id);
    expect(ids.some((id) => id.startsWith("notion:deploy#"))).toBe(true);
  });

  it("acento não muda a busca", () => {
    const a = brain.buscar("transação").map((t) => t.id);
    expect(a.length).toBeGreaterThan(0);
    expect(brain.buscar("transacao").map((t) => t.id)).toEqual(a);
  });

  it("termo que não existe devolve vazio", () => {
    expect(brain.buscar("xyzqwk")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(brain.buscar("deploy produção time", 2).length).toBeLessThanOrEqual(2);
  });
});
