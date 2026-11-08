// Confere o token do Supabase (Authorization: Bearer <access_token>) contra o JWKS do projeto.
// Contrato "API do servidor" em docs/contratos.md.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Quem fez a requisição, segundo o token do Supabase. */
export interface Pessoa {
  id: string;
  nome?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    pessoa?: Pessoa;
  }
}

export type VerificaToken = (token: string) => Promise<Pessoa | null>;

/** Monta o verificador. `keys` substitui o JWKS remoto (testes). */
export function criaVerificaToken(opts: { supabaseUrl: string; jwksUrl: string; keys?: JWTVerifyGetKey }): VerificaToken {
  const keys = opts.keys ?? createRemoteJWKSet(new URL(opts.jwksUrl));
  const issuer = `${opts.supabaseUrl}/auth/v1`;
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: "authenticated" });
      if (typeof payload.sub !== "string" || !payload.sub) return null;
      const meta = payload.user_metadata as { nome?: unknown } | undefined;
      return { id: payload.sub, nome: typeof meta?.nome === "string" ? meta.nome : undefined };
    } catch {
      return null;
    }
  };
}

/** Token do cabeçalho Authorization: Bearer; null se ausente ou mal formado. */
export function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return m ? m[1] : null;
}
