export type TimeId = "contas" | "livro-razao" | "canais" | "plataforma";
export type AreaId = TimeId | "people" | "seguranca";
export type Email = `${string}@kota.example`;

export interface PessoaKota {
  id: string;        // kebab-case, único
  nome: string;      // único
  cargo: string;
  area: AreaId;
  email: Email;
  slack: string;     // nome exibido no Slack, sem @
  avatar: string;    // https://api.dicebear.com/9.x/initials/png?seed=<nome com encodeURIComponent>
}
export interface TimeKota {
  id: TimeId; nome: string; missao: string;
  gestor: string; techLead: string; buddies: string[];   // ids de PessoaKota
  canal: `#${string}`; canalAjuda: `#${string}`; plantao: string;
}
export interface SistemaKota {
  id: string; pasta: string;   // caminho no kota-bank, sem barra final
  time: TimeId; linguagem: "Python" | "Java" | "Postgres";
  oQueFaz: string; dependeDe: string[];   // ids de SistemaKota
  legado?: true;
}
export interface AdrKota { n: number; titulo: string; status: "aceito" | "rejeitado"; time: TimeId; rfc?: number; ancoras: string[] }
export interface RfcKota { n: number; titulo: string; autor: string; adr: number }
export interface MapaKota {
  repo: "JucaGF/kota-bank";
  pessoas: PessoaKota[]; times: TimeKota[]; sistemas: SistemaKota[];
  adrs: AdrKota[]; rfcs: RfcKota[];
  perfis: {
    novo: { pessoa: string; para: "livro-razao" };
    transicao: { pessoa: string; de: "contas"; para: "livro-razao" };
  };
  aliases: Email[];   // ex.: people@kota.example, seguranca@kota.example
}

export function caminhoAdr(a: AdrKota): string {
  const slug = a.titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `docs/adr/${String(a.n).padStart(4, "0")}-${slug}.md`;
}
