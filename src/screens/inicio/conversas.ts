import { chaveDasConversas, listarConversas, salvarResumo, topicosValidos, type Conversa } from "../../journey/conversas";
import type { Profile } from "../../journey/types";
import { apiUrl } from "../../voice/api";

function elemento<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (texto !== undefined) el.textContent = texto;
  return el;
}

export function montarConversas(container: HTMLElement, perfil: Profile): void {
  const pendentes = new Map<string, Promise<string[]>>();
  const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

  async function buscarResumo(conversa: Conversa): Promise<string[]> {
    const resposta = await fetch(apiUrl("/api/conversas/resumo"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ falas: conversa.falas }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resposta.ok) throw new Error("resumo indisponível");
    const dados = await resposta.json() as { topicos?: unknown } | null;
    if (!topicosValidos(dados?.topicos)) throw new Error("resumo inválido");
    if (!salvarResumo(perfil, conversa, dados.topicos)) throw new Error("transcrição atualizada");
    return dados.topicos;
  }

  function montarConversa(conversa: Conversa): HTMLDetailsElement {
    const detalhe = elemento("details");
    detalhe.className = "conversa";
    const titulo = conversa.tipo === "call-inicial" ? "Call inicial" : "Sessão no quadro";
    const data = elemento("time", dataHora.format(new Date(conversa.encerradaEm)));
    data.dateTime = conversa.encerradaEm;
    const cabecalho = elemento("summary");
    cabecalho.append(elemento("strong", titulo), " ", data);

    const resumo = elemento("div");
    resumo.setAttribute("aria-live", "polite");
    const mostrarResumo = (topicos: string[]) => {
      const lista = elemento("ul");
      lista.append(...topicos.map((topico) => elemento("li", topico)));
      resumo.replaceChildren(lista);
    };

    const transcricao = elemento("ol");
    for (const fala of conversa.falas) {
      const item = elemento("li");
      item.append(elemento("strong", fala.role === "assistant" ? "Puca" : "Você"), elemento("p", fala.content));
      transcricao.append(item);
    }
    transcricao.className = "conversa__falas";
    detalhe.append(cabecalho, elemento("h3", "Resumo"), resumo, elemento("h3", "Transcrição"), transcricao);

    async function carregar(): Promise<void> {
      resumo.replaceChildren(elemento("p", "Gerando resumo…"));
      const chave = JSON.stringify([conversa.id, conversa.falas]);
      let pedido = pendentes.get(chave);
      if (!pedido) {
        pedido = buscarResumo(conversa).finally(() => pendentes.delete(chave));
        pendentes.set(chave, pedido);
      }
      try {
        mostrarResumo(await pedido);
      } catch {
        const tentar = elemento("button", "Tentar novamente");
        tentar.type = "button";
        tentar.className = "orbis-link";
        tentar.addEventListener("click", () => void carregar());
        resumo.replaceChildren(elemento("p", "Não foi possível gerar o resumo agora."), tentar);
      }
    }

    if (conversa.topicos) mostrarResumo(conversa.topicos);
    else detalhe.addEventListener("toggle", function abrir() {
      if (!detalhe.open) return;
      detalhe.removeEventListener("toggle", abrir);
      void carregar();
    });
    return detalhe;
  }

  function render(): void {
    const conversas = listarConversas(perfil);
    container.replaceChildren(
      ...(conversas.length ? conversas.map(montarConversa) : [elemento("p", "Suas conversas salvas aparecem aqui.")]),
    );
  }

  render();
  addEventListener("pageshow", (evento) => { if (evento.persisted) render(); });
  addEventListener("storage", (evento) => { if (evento.key === chaveDasConversas(perfil)) render(); });
}
