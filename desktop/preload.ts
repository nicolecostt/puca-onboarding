// Ponte do app com o front (docs/contratos.md, "App para Mac"): só window.orbis, nada de Node.
import { contextBridge, ipcRenderer } from "electron";
import type { AcaoDaPuca } from "../src/lib/orbis";

const arg = process.argv.find((a) => a.startsWith("--orbis-versao="));

contextBridge.exposeInMainWorld("orbis", {
  versao: arg?.slice("--orbis-versao=".length) ?? "",
  // navegador de Puca (contrato "Computer use"): só estes quatro métodos, pelo IPC
  navegador: {
    mostrar: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.send("orbis:navegador:mostrar", bounds),
    esconder: () => ipcRenderer.send("orbis:navegador:esconder"),
    executar: (acoes: AcaoDaPuca[]) => ipcRenderer.invoke("orbis:navegador:executar", acoes),
    cancelar: () => ipcRenderer.send("orbis:navegador:cancelar"),
  },
});

// Setas ‹ › para voltar e avançar entre as telas do app (no navegador comum, o próprio navegador já tem).
window.addEventListener("DOMContentLoaded", () => {
  const nav = document.createElement("div");
  nav.setAttribute("role", "navigation");
  nav.setAttribute("aria-label", "Voltar e avançar");
  nav.style.cssText =
    "position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;gap:4px;padding:4px;" +
    "border:1px solid var(--color-border,#e5e5e5);border-radius:var(--radius-pill,999px);background:var(--color-surface,#fff);" +
    "box-shadow:0 2px 8px rgba(0,0,0,.08);font:16px/1 system-ui,sans-serif";
  const seta = (texto: string, rotulo: string, ir: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.title = rotulo;
    b.setAttribute("aria-label", rotulo);
    b.style.cssText =
      "all:unset;cursor:pointer;width:32px;height:32px;display:grid;place-items:center;border-radius:999px;" +
      "color:var(--color-text,#0a0a0a);font-size:20px";
    b.addEventListener("mouseenter", () => (b.style.background = "var(--color-surface-muted,#f5f5f5)"));
    b.addEventListener("mouseleave", () => (b.style.background = "transparent"));
    b.addEventListener("click", ir);
    return b;
  };
  nav.append(seta("‹", "Voltar (⌘ [)", () => history.back()), seta("›", "Avançar (⌘ ])", () => history.forward()));
  document.body.append(nav);
});
