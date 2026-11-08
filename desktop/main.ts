// App para Mac (decisão 0004, docs/stack.md §3): uma janela com o mesmo front, servido de dist/ por app://orbis/.
// Em desenvolvimento (npm run dev:app), ORBIS_DEV_URL aponta a janela para o Vite.
import { app, BrowserWindow, dialog, Menu, net, protocol, session, shell, systemPreferences } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ligarNavegador } from "./navegador";

const ORIGEM = "app://orbis";
const DEV_URL = process.env.ORBIS_DEV_URL?.replace(/\/+$/, "");
const INICIO = DEV_URL ? `${DEV_URL}/` : `${ORIGEM}/index.html`;

// Antes do `ready`: sem isso o app:// não é origem segura, e microfone, localStorage e CORS do Fly não funcionam.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const pastaDoFront = path.join(app.getAppPath(), "dist");

/** Arquivo de dist/ para um endereço app://orbis/…; null se sair da pasta ou for outro host. */
function arquivoDe(url: string): string | null {
  const u = new URL(url);
  if (u.host !== "orbis") return null;
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  else if (!path.extname(rel)) rel += "/index.html";
  const alvo = path.normalize(path.join(pastaDoFront, rel));
  return alvo.startsWith(pastaDoFront + path.sep) ? alvo : null;
}

/** Página do próprio Orbis (o app empacotado, ou o Vite em dev). */
const doOrbis = (url: string) => url.startsWith(`${ORIGEM}/`) || (!!DEV_URL && url.startsWith(`${DEV_URL}/`));
const externo = (url: string) => /^https?:\/\//.test(url) && !doOrbis(url);

const preferencias = {
  preload: path.join(__dirname, "preload.cjs"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  additionalArguments: [`--orbis-versao=${app.getVersion()}`],
};

function cuidarDaNavegacao(win: BrowserWindow): void {
  const wc = win.webContents;
  // Só navega dentro do Orbis; link de fora abre no navegador da pessoa.
  wc.on("will-navigate", (e, url) => {
    if (doOrbis(url)) return;
    e.preventDefault();
    if (externo(url)) void shell.openExternal(url);
  });
  // O Slack simulado e a página da tarefa abrem em janela própria (target="puca-…"); o resto vai para fora.
  wc.setWindowOpenHandler(({ url }) => {
    if (doOrbis(url)) return { action: "allow", overrideBrowserWindowOptions: { width: 1280, height: 860, webPreferences: preferencias } };
    if (externo(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("did-create-window", (filha) => cuidarDaNavegacao(filha));
}

/** Menu do Mac em português. "Visualizar" mantém as ferramentas de desenvolvedor para investigar problema na demo. */
function montarMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Orbis",
        submenu: [
          { role: "about", label: "Sobre o Orbis" },
          { type: "separator" },
          { role: "hide", label: "Ocultar Orbis" },
          { role: "hideOthers", label: "Ocultar outros" },
          { role: "unhide", label: "Mostrar tudo" },
          { type: "separator" },
          { role: "quit", label: "Sair do Orbis" },
        ],
      },
      {
        label: "Editar",
        submenu: [
          { role: "undo", label: "Desfazer" },
          { role: "redo", label: "Refazer" },
          { type: "separator" },
          { role: "cut", label: "Recortar" },
          { role: "copy", label: "Copiar" },
          { role: "paste", label: "Colar" },
          { role: "selectAll", label: "Selecionar tudo" },
        ],
      },
      {
        label: "Visualizar",
        submenu: [
          { role: "reload", label: "Recarregar" },
          { role: "togglefullscreen", label: "Tela cheia" },
          { type: "separator" },
          { role: "toggleDevTools", label: "Ferramentas de desenvolvedor" },
        ],
      },
      {
        label: "Janela",
        submenu: [
          { role: "minimize", label: "Minimizar" },
          { role: "close", label: "Fechar" },
        ],
      },
    ]),
  );
}

/** Microfone negado (§3.3): diz o caminho em Ajustes; a sessão segue pelo chat. */
async function avisarMicrofoneNegado(win: BrowserWindow): Promise<void> {
  const { response } = await dialog.showMessageBox(win, {
    type: "info",
    message: "A Puca não tem acesso ao microfone",
    detail:
      "Você pode seguir a sessão pelo chat. Para falar com a Puca, abra Ajustes do Sistema → Privacidade e Segurança → Microfone, ligue o Orbis e abra o app de novo.",
    buttons: ["Seguir pelo chat", "Abrir Ajustes"],
    defaultId: 0,
  });
  if (response === 1) await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
}

function abrirJanela(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Orbis",
    backgroundColor: "#ffffff",
    webPreferences: preferencias,
  });
  cuidarDaNavegacao(win);
  void win.loadURL(INICIO);
  return win;
}

app.setName("Orbis");
app.setAboutPanelOptions({ applicationName: "Orbis", applicationVersion: app.getVersion(), credits: "A Puca conduz o seu onboarding por voz." });

if (!app.requestSingleInstanceLock()) app.quit();

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win?.isMinimized()) win.restore();
  win?.focus();
});

app.whenReady().then(async () => {
  protocol.handle("app", async (req) => {
    const arquivo = arquivoDe(req.url);
    if (!arquivo) return new Response("não encontrado", { status: 404 });
    try {
      return await net.fetch(pathToFileURL(arquivo).toString());
    } catch {
      return new Response("não encontrado", { status: 404 });
    }
  });

  // Microfone (§3.3): só para as páginas do Orbis. Negado, a sessão segue pelo chat.
  session.defaultSession.setPermissionRequestHandler((_wc, permissao, responder, detalhes) => {
    const permitidas = ["media", "clipboard-sanitized-write", "fullscreen"];
    responder(permitidas.includes(permissao) && doOrbis(detalhes.requestingUrl));
  });
  montarMenu();
  const microfone = process.platform === "darwin" ? await systemPreferences.askForMediaAccess("microphone").catch(() => false) : true;

  const win = abrirJanela();
  ligarNavegador(win);
  if (!microfone) win.webContents.once("did-finish-load", () => void avisarMicrofoneNegado(win));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) abrirJanela();
  });
});

app.on("window-all-closed", () => app.quit());
