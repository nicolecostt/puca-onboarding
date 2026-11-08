import { describe, expect, it } from "vitest";
import { permitido } from "./guarda";

describe("permitido", () => {
  it("abre o kota-bank e o Notion da Kota", () => {
    expect(permitido("https://github.com/JucaGF/kota-bank")).toBe(true);
    expect(permitido("https://github.com/JucaGF/kota-bank/blob/main/README.md")).toBe(true);
    expect(permitido("https://lean-ptarmigan-dd2.notion.site/412bd621283f81849a35d3b5f53b6ac8")).toBe(true);
  });

  it("recusa o resto", () => {
    expect(permitido("https://github.com/JucaGF/kota-bank-oficina")).toBe(false);
    expect(permitido("https://github.com/features")).toBe(false);
    expect(permitido("http://github.com/JucaGF/kota-bank")).toBe(false);
    expect(permitido("https://evil.com/?u=github.com/JucaGF/kota-bank")).toBe(false);
    expect(permitido("nada")).toBe(false);
  });
});
