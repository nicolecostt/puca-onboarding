import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";

export interface ContextoKota {
  mapa: MapaKota;
  repo?: string;                       // raiz de um checkout do kota-bank ou da oficina
  notionUrls: Record<string, string>;  // conteúdo de kit/kota/notion/urls.json, {} se não existir
  jornadas: string[];                  // caminhos absolutos de src/journey/data/*.journey.json
}

export interface Regra {
  nome: string;
  precisaRepo: boolean;
  checar(ctx: ContextoKota): string[];
}

export function carregarContexto(raiz: string, repo?: string): ContextoKota {
  const urls = join(raiz, "kit/kota/notion/urls.json");
  const dados = join(raiz, "src/journey/data");
  return {
    mapa,
    repo,
    notionUrls: existsSync(urls) ? JSON.parse(readFileSync(urls, "utf8")) : {},
    jornadas: readdirSync(dados).filter((f) => f.endsWith(".journey.json")).sort().map((f) => join(dados, f)),
  };
}
