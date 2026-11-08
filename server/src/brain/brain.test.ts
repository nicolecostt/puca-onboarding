// Brain mínimo com os arquivos reais do kit da Kota.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarBrain, criarBrain, trechosDoKit, type Trecho } from "./brain";
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

  it("traz o balancereader sem as palavras de enchimento (dele, dela...)", () => {
    const ids = brain.buscar("o que é o balancereader e quem cuida dele?").map((t) => t.id);
    expect(ids).toContain("mapa:sistemas/balancereader");
    expect(ids.indexOf("mapa:sistemas/balancereader")).toBeLessThan(5);
  });

  it("relevância mínima: só um termo solto da pergunta não traz trecho", () => {
    // tail-common aparece no kit, mas nenhum trecho junta "responsável" e "tail-common"
    expect(brain.buscar("quem é o responsável pelo tail-common?")).toEqual([]);
    // "futebol" e "João" não existem no kit; "time" sozinho (1 de 3 termos) não basta
    expect(brain.buscar("qual o time de futebol do João?")).toEqual([]);
    expect(brain.buscar("a Kota tem convênio com academia?")).toEqual([]);
  });

  it("pergunta de caso pessoal traz só a regra do kit (nada sobre a pessoa citada)", () => {
    const ids = brain.buscar("qual o salário do João?").map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0].startsWith("notion:revisao-salarial#")).toBe(true);
  });

  it("corta o que está muito abaixo da melhor nota (30%)", () => {
    const t = (id: string, texto: string): Trecho => ({ id, titulo: id, url: "", texto });
    const b = criarBrain([
      t("forte", "deploy deploy deploy deploy"),
      t("fraco", "deploy " + "palavra ".repeat(60)),
      ...Array.from({ length: 6 }, (_, i) => t(`outro${i}`, "nada a ver com o assunto")),
    ]);
    expect(b.buscar("deploy").map((x) => x.id)).toEqual(["forte"]);
  });

  it("respeita o limite", () => {
    expect(brain.buscar("deploy produção time", 2).length).toBeLessThanOrEqual(2);
  });
});
