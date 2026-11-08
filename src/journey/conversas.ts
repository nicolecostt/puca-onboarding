import { onboardingStore, type KeyValueStore } from "./storage";
import { escopoDoPerfil } from "./profile";
import { uid } from "./uid";
import type { Profile } from "./types";

export interface FalaDaConversa {
  role: "user" | "assistant";
  content: string;
}

export interface Conversa {
  id: string;
  tipo: "call-inicial" | "sessao";
  encerradaEm: string;
  falas: FalaDaConversa[];
  topicos?: string[];
}

export function falaValida(valor: unknown): valor is FalaDaConversa {
  if (!valor || typeof valor !== "object") return false;
  const { role, content } = valor as Partial<FalaDaConversa>;
  return (role === "user" || role === "assistant") && typeof content === "string" && !!content.trim();
}

export function topicosValidos(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.length >= 1 && valor.length <= 8 &&
    valor.every((item) => typeof item === "string" && !!item.trim() && item.length <= 500);
}

function conversaValida(valor: unknown): valor is Conversa {
  if (!valor || typeof valor !== "object") return false;
  const { id, tipo, encerradaEm, falas, topicos } = valor as Partial<Conversa>;
  return typeof id === "string" && (tipo === "call-inicial" || tipo === "sessao") &&
    typeof encerradaEm === "string" && Number.isFinite(Date.parse(encerradaEm)) &&
    Array.isArray(falas) && falas.length > 0 && falas.every(falaValida) &&
    (topicos === undefined || topicosValidos(topicos));
}

export function chaveDasConversas(perfil: Profile): string {
  return `puca:conversas:${escopoDoPerfil(perfil)}`;
}

export function listarConversas(perfil: Profile, store?: KeyValueStore): Conversa[] {
  try {
    const valor: unknown = JSON.parse((store ?? onboardingStore()).getItem(chaveDasConversas(perfil)) ?? "[]");
    return Array.isArray(valor)
      ? valor.filter(conversaValida).sort((a, b) => b.encerradaEm.localeCompare(a.encerradaEm))
      : [];
  } catch {
    return [];
  }
}

function gravar(perfil: Profile, conversa: Conversa, lista: Conversa[], store?: KeyValueStore): void {
  (store ?? onboardingStore()).setItem(
    chaveDasConversas(perfil),
    JSON.stringify([conversa, ...lista.filter(({ id }) => id !== conversa.id)]),
  );
}

export function criarRegistro(tipo: Conversa["tipo"]) {
  const id = uid();
  const falas: FalaDaConversa[] = [];
  let versao = 0;
  let versaoSalva = 0;
  return {
    anotar(role: FalaDaConversa["role"], content: string): ((texto: string) => void) | undefined {
      if (!content.trim()) return;
      const fala = { role, content };
      falas.push(fala);
      versao++;
      return (texto) => {
        fala.content = texto;
        versao++;
      };
    },
    salvar(perfil: Profile, store?: KeyValueStore): boolean {
      if (versao === versaoSalva) return true;
      try {
        gravar(perfil, { id, tipo, encerradaEm: new Date().toISOString(), falas }, listarConversas(perfil, store), store);
        versaoSalva = versao;
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function salvarResumo(perfil: Profile, original: Conversa, topicos: string[], store?: KeyValueStore): boolean {
  const lista = listarConversas(perfil, store);
  const atual = lista.find(({ id }) => id === original.id);
  // A retomada acrescenta falas ao mesmo registro. Só a versão enviada pode receber o resumo.
  if (!atual || JSON.stringify(atual.falas) !== JSON.stringify(original.falas)) return false;
  gravar(perfil, { ...atual, topicos }, lista, store);
  return true;
}

export function avisarFalhaAoSalvarConversa(): void {
  window.alert("O Orbis não conseguiu salvar esta conversa neste dispositivo.");
}
