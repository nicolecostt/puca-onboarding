// Ponte do app com o front (docs/contratos.md, "App para Mac"): só window.orbis, nada de Node.
import { contextBridge } from "electron";

const arg = process.argv.find((a) => a.startsWith("--orbis-versao="));

contextBridge.exposeInMainWorld("orbis", { versao: arg?.slice("--orbis-versao=".length) ?? "" });
