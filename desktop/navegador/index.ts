// Navegador da Puca (decisão 0008, docs/stack.md §4, contrato "Computer use"): uma área da janela do Orbis com um
// navegador de verdade, controlado pelo protocolo de depuração do Chromium. A sessão pede ações pelo IPC; elas rodam
// numa fila serial que para quando a pessoa fala por cima.
import { BrowserWindow, ipcMain, WebContentsView } from "electron";
import type { AcaoDaPuca, Alvo, ResultadoDaFila } from "../../src/lib/orbis";
import { CAMADA } from "./camada";
import { permitido } from "./guarda";

type Bounds = { x: number; y: number; width: number; height: number };
type Achado = { doc: { x: number; y: number; w: number; h: number }; vp: Bounds };

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function ligarNavegador(win: BrowserWindow): void {
  let view: WebContentsView | null = null;
  let criando: Promise<WebContentsView> | null = null;
  let geracao = 0;
  let fila: Promise<unknown> = Promise.resolve();
  let carregou: (() => void) | null = null;

  const cdp = (metodo: string, params: Record<string, unknown> = {}) => view!.webContents.debugger.sendCommand(metodo, params);
  const js = async <T>(expr: string): Promise<T> =>
    ((await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })) as { result: { value: T } }).result.value;
  const garantirCamada = () => js<boolean>(CAMADA);

  /** Cria o navegador uma vez só (mostrar e executar podem chegar juntos). */
  const obter = () => (criando ??= criar());

  async function criar(): Promise<WebContentsView> {
    const v = new WebContentsView({
      webPreferences: { partition: "persist:kota", sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    v.setBackgroundColor("#ffffff");
    win.contentView.addChildView(v);
    view = v;
    const wc = v.webContents;
    // Guarda: só o mundo da Kota; janela nova nunca.
    const bloquear = (e: { preventDefault(): void }, url: string) => {
      if (!permitido(url)) e.preventDefault();
    };
    wc.on("will-navigate", (e, url) => bloquear(e, url));
    wc.on("will-redirect", (e, url) => bloquear(e, url));
    wc.setWindowOpenHandler(() => ({ action: "deny" }));

    await wc.loadURL("about:blank"); // o depurador só responde com um documento carregado
    wc.debugger.attach("1.3");
    await cdp("Page.enable");
    await cdp("Runtime.enable");
    await cdp("Page.setBypassCSP", { enabled: true }); // o navegador é nosso: a página não bloqueia a camada
    await cdp("Page.addScriptToEvaluateOnNewDocument", { source: CAMADA });
    wc.debugger.on("message", (_e, metodo, p: { frame?: { parentId?: string } }) => {
      if (metodo === "Page.frameStoppedLoading" || metodo === "Page.loadEventFired") carregou?.();
      // página nova (inclusive sem recarregar, como GitHub e Notion): os desenhos da anterior somem
      if ((metodo === "Page.frameNavigated" && !p.frame?.parentId) || metodo === "Page.navigatedWithinDocument") {
        void js("window.__puca?.limpar()").catch(() => {});
      }
    });
    return v;
  }

  async function achar(alvo: Alvo): Promise<Achado | null> {
    await garantirCamada();
    const r = await js<Achado | null>(`__puca.achar(${JSON.stringify(alvo)})`);
    if (r) await espera(250); // deixa a rolagem assentar e mede de novo
    return r ? js<Achado | null>(`__puca.achar(${JSON.stringify(alvo)})`) : null;
  }

  async function levarCursor(a: Achado): Promise<void> {
    await js(`__puca.cursor(${a.doc.x + a.doc.w - 6}, ${a.doc.y + a.doc.h / 2})`);
    await espera(900);
  }

  async function abrir(url: string): Promise<void> {
    const parou = new Promise<void>((r) => (carregou = r));
    await cdp("Page.navigate", { url });
    // sites de página única às vezes não avisam que pararam de carregar: teto de 8 s
    await Promise.race([parou, espera(8000)]);
    carregou = null;
    await espera(600);
  }

  async function clicar(a: Achado): Promise<void> {
    const x = a.vp.x + a.vp.width / 2;
    const y = a.vp.y + a.vp.height / 2;
    await js("window.__pucaClicando = true");
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
      await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    }
    await js("setTimeout(() => (window.__pucaClicando = false), 50)").catch(() => {});
    await espera(1500);
  }

  /** Uma ação; devolve o motivo da falha ou null. */
  async function rodar(acao: AcaoDaPuca): Promise<string | null> {
    if (acao.tipo === "abrir") {
      if (!permitido(acao.url)) return "fora da Kota";
      await abrir(acao.url);
      return null;
    }
    if (acao.tipo === "limpar") {
      await js("window.__puca?.limpar()");
      return null;
    }
    const achado = await achar(acao.alvo);
    if (!achado) return `não achei ${"texto" in acao.alvo ? acao.alvo.texto : acao.alvo.seletor}`;
    await levarCursor(achado);
    if (acao.tipo === "circular") await js(`__puca.circular(${JSON.stringify(achado.doc)})`);
    if (acao.tipo === "marcar") await js(`__puca.marcar(${JSON.stringify(achado.doc)})`);
    if (acao.tipo === "clicar") await clicar(achado);
    if (acao.tipo === "circular" || acao.tipo === "marcar") await espera(800);
    return null;
  }

  /** `minha` é a geração de quando o lote chegou: lote pedido antes de um cancelar não roda. */
  async function executar(acoes: AcaoDaPuca[], minha: number): Promise<ResultadoDaFila> {
    const resultado: ResultadoDaFila = { feitas: 0, falhas: [], cancelada: false };
    await obter();
    for (const acao of acoes) {
      if (geracao !== minha) {
        resultado.cancelada = true;
        break;
      }
      try {
        const motivo = await rodar(acao);
        if (motivo) resultado.falhas.push({ acao, motivo });
        else resultado.feitas++;
      } catch (e) {
        resultado.falhas.push({ acao, motivo: e instanceof Error ? e.message : String(e) });
      }
    }
    return resultado;
  }

  ipcMain.on("orbis:navegador:mostrar", (_e, b: Bounds) => {
    const bounds = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(1, Math.round(b.width)), height: Math.max(1, Math.round(b.height)) };
    const aplicar = (v: WebContentsView) => {
      v.setBounds(bounds);
      v.setVisible(true);
    };
    void obter().then(aplicar).catch((e) => console.warn("navegador da Puca:", e));
  });
  ipcMain.on("orbis:navegador:esconder", () => view?.setVisible(false));
  ipcMain.on("orbis:navegador:cancelar", () => {
    geracao++;
    if (view) void js("window.__puca?.limpar()").catch(() => {});
  });
  // um lote de cada vez, na ordem em que chegaram
  ipcMain.handle("orbis:navegador:executar", (_e, acoes: AcaoDaPuca[]) => {
    const g = geracao;
    const vez = fila.then(() => executar(acoes, g));
    fila = vez.catch(() => {});
    return vez;
  });
}
