// Ponte do app com o front (docs/contratos.md, "App para Mac"): só window.orbis, nada de Node.
import { contextBridge, ipcRenderer } from "electron";
import type { AcaoDaPuca } from "../src/lib/orbis";

const arg = process.argv.find((a) => a.startsWith("--orbis-versao="));

contextBridge.exposeInMainWorld("orbis", {
  versao: arg?.slice("--orbis-versao=".length) ?? "",
  // navegador do Puca (contrato "Computer use"): só estes quatro métodos, pelo IPC
  navegador: {
    mostrar: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.send("orbis:navegador:mostrar", bounds),
    esconder: () => ipcRenderer.send("orbis:navegador:esconder"),
    executar: (acoes: AcaoDaPuca[]) => ipcRenderer.invoke("orbis:navegador:executar", acoes),
    cancelar: () => ipcRenderer.send("orbis:navegador:cancelar"),
  },
});
