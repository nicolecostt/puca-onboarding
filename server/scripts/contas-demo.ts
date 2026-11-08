// Contas fixas da apresentação no Supabase (docs/stack.md §6.1): ana@kota.example (novo) e bruno@kota.example
// (transição), já confirmadas. Cria ou atualiza; rodar de novo não duplica.
// Uso: npm run contas-demo                 (senha em SENHA_DEMO no server/.env; nunca no repo)
//      npm run -s contas-demo -- --token   (só imprime um access_token da Ana, para o bench:turn no Fly)
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no server/.env.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { env } from "../src/env";
import { DEMO_PROFILES } from "../../src/journey/profile";

const { values } = parseArgs({ options: { token: { type: "boolean", default: false } } });
if (!env.supabaseUrl || !env.supabaseServiceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no server/.env.");
  process.exit(1);
}
const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const CONTAS = [
  { email: "ana@kota.example", nome: DEMO_PROFILES.novo.nome, vinculo: "novo" },
  { email: "bruno@kota.example", nome: DEMO_PROFILES.transicao.nome, vinculo: "transicao" },
] as const;

async function idPorEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
}

if (values.token) {
  // sessão da Ana sem senha: link mágico gerado pelo admin e trocado na hora (não manda e-mail)
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: CONTAS[0].email });
  if (error) throw error;
  const otp = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (otp.error || !otp.data.session) throw otp.error ?? new Error("sem sessão");
  process.stdout.write(otp.data.session.access_token);
  process.exit(0);
}

const senha = process.env.SENHA_DEMO ?? "";
if (senha.length < 8) {
  console.error("Defina SENHA_DEMO (8+ caracteres) no server/.env: é a senha das contas da apresentação.");
  process.exit(1);
}
for (const c of CONTAS) {
  const attrs = { password: senha, email_confirm: true, user_metadata: { nome: c.nome, vinculo: c.vinculo } };
  const id = await idPorEmail(c.email);
  const { error } = id ? await supabase.auth.admin.updateUserById(id, attrs) : await supabase.auth.admin.createUser({ email: c.email, ...attrs });
  if (error) throw error;
  console.log(`${id ? "atualizada" : "criada"}: ${c.email} (${c.nome}, ${c.vinculo})`);
}
