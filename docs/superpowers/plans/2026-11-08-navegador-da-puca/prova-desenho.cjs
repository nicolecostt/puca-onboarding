// Prova: Puca desenha, marca e mostra imagem por cima de uma página real (GitHub), clica de verdade,
// é interrompida no meio de uma sequência e percebe o clique da pessoa. Tudo pelo protocolo de depuração
// do Chromium (webContents.debugger), sem permissão do macOS.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "prints");
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(`[${(performance.now() / 1000).toFixed(1)}s]`, ...a);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Camada de Puca injetada na página: não pega clique (pointer-events: none), coordenadas do documento.
const CAMADA = String.raw`
window.__puca ??= (() => {
  const NS = "http://www.w3.org/2000/svg";
  const raiz = () => {
    let l = document.getElementById("puca-camada");
    if (!l) {
      l = document.createElement("div");
      l.id = "puca-camada";
      l.style.cssText = "position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2147483647";
      l.innerHTML = '<svg id="puca-svg" style="position:absolute;left:0;top:0;overflow:visible" width="1" height="1"></svg>' +
        '<div id="puca-cursor" style="position:absolute;left:0;top:0;transition:transform .7s cubic-bezier(.3,.7,.2,1);' +
        'font:600 13px system-ui;color:#fff;background:#6b4eff;padding:3px 9px 3px 6px;border-radius:12px;box-shadow:0 2px 8px #0003">➤ Puca</div>';
      document.body.appendChild(l);
    }
    l.style.height = document.documentElement.scrollHeight + "px";
    return l;
  };
  const svg = () => (raiz(), document.getElementById("puca-svg"));
  // Traço "à mão": elipse com tremido, animada como se fosse desenhada.
  const tracar = (d, cor = "#e5484d", larg = 3) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", cor);
    p.setAttribute("stroke-width", larg); p.setAttribute("stroke-linecap", "round");
    svg().appendChild(p);
    const L = p.getTotalLength();
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset .8s ease-out"; p.style.strokeDashoffset = 0;
    return p;
  };
  const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  return {
    achar(texto, seletor = "a") {
      const vis = [...document.querySelectorAll(seletor)].filter((e) => e.textContent.trim() === texto && e.getBoundingClientRect().width > 0);
      return vis[0] ?? null;
    },
    retangulo(texto) { const el = this.achar(texto); if (!el) return null; el.scrollIntoView({ block: "center" }); return { doc: docRect(el), vp: el.getBoundingClientRect().toJSON() }; },
    cursor(x, y) { raiz(); document.getElementById("puca-cursor").style.transform = "translate(" + x + "px," + y + "px)"; },
    circulo(r) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 + 22, ry = r.h / 2 + 12;
      let d = "";
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2.15 - 0.4, j = 1 + Math.sin(i * 1.7) * 0.04;
        d += (i ? "L" : "M") + (cx + Math.cos(a) * rx * j).toFixed(1) + " " + (cy + Math.sin(a) * ry * j).toFixed(1);
      }
      tracar(d);
    },
    seta(x1, y1, x2, y2) {
      const mx = (x1 + x2) / 2 + 30, my = (y1 + y2) / 2 - 40;
      tracar("M" + x1 + " " + y1 + " Q" + mx + " " + my + " " + x2 + " " + y2, "#6b4eff", 2.5);
      const a = Math.atan2(y2 - my, x2 - mx), s = 12;
      tracar("M" + (x2 - s * Math.cos(a - .5)) + " " + (y2 - s * Math.sin(a - .5)) + " L" + x2 + " " + y2 + " L" + (x2 - s * Math.cos(a + .5)) + " " + (y2 - s * Math.sin(a + .5)), "#6b4eff", 2.5);
    },
    marcaTexto(r) {
      const m = document.createElement("div");
      m.style.cssText = "position:absolute;left:" + (r.x - 4) + "px;top:" + (r.y - 2) + "px;width:" + (r.w + 8) + "px;height:" + (r.h + 4) + "px;background:#ffe06680;border-radius:4px;mix-blend-mode:multiply";
      raiz().appendChild(m);
    },
    cartao(x, y, html) {
      const c = document.createElement("div");
      c.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;width:290px;background:#fff;border:1.5px solid #1a1a1a;border-radius:14px;padding:12px 14px;font:14px/1.4 system-ui;color:#1a1a1a;box-shadow:0 8px 24px #0002;opacity:0;transition:opacity .4s";
      c.innerHTML = html; raiz().appendChild(c); requestAnimationFrame(() => (c.style.opacity = 1));
    },
    aviso(txt) { this.cartao(scrollX + innerWidth - 330, scrollY + 20, "<b>🎙️ " + txt + "</b>"); },
    limpar() { const l = document.getElementById("puca-camada"); if (l) l.remove(); },
  };
})();`;

// Imagem que Puca mostra: um mini-mapa dos serviços (SVG inline).
const MINI_MAPA = `<div style="font-weight:600;margin-bottom:6px">Onde o livro-razão entra</div>
<svg width="262" height="96" viewBox="0 0 262 96" style="display:block">
  <g font-family="system-ui" font-size="11" text-anchor="middle">
    <rect x="2" y="34" width="70" height="28" rx="6" fill="#f1effe" stroke="#6b4eff"/><text x="37" y="52">frontend</text>
    <rect x="96" y="4" width="78" height="28" rx="6" fill="#fff" stroke="#1a1a1a"/><text x="135" y="22">ledgerwriter</text>
    <rect x="96" y="64" width="78" height="28" rx="6" fill="#fff" stroke="#1a1a1a"/><text x="135" y="82">balancereader</text>
    <rect x="196" y="34" width="64" height="28" rx="6" fill="#fff6d6" stroke="#b58900"/><text x="228" y="52">ledger-db</text>
  </g>
  <g stroke="#555" fill="none"><path d="M72 44 L96 20"/><path d="M72 52 L96 76"/><path d="M174 18 L196 42"/><path d="M174 78 L196 54"/></g>
</svg>
<div style="color:#555;font-size:12px;margin-top:6px">Comece pelo README: ele diz como subir o banco.</div>`;

setTimeout(() => { log("⏱️ tempo esgotado"); app.quit(); }, 60000);
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1280, height: 860, alwaysOnTop: true });
  log("janela aberta, carregando GitHub");
  await w.loadURL("https://github.com/JucaGF/kota-bank").catch((e) => log("loadURL:", e.message));
  log("página carregada");
  const dbg = w.webContents.debugger;
  dbg.attach("1.3");
  const cdp = (m, p = {}) => dbg.sendCommand(m, p);
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Page.setBypassCSP", { enabled: true }); // o navegador é nosso: a página não bloqueia a camada de Puca
  log("depurador conectado");

  // Clique da pessoa: a página avisa o app por um binding. Cliques de Puca levam uma marca e são ignorados.
  await cdp("Runtime.addBinding", { name: "pucaViu" });
  dbg.on("message", (_e, metodo, p) => {
    if (metodo === "Runtime.bindingCalled" && p.name === "pucaViu") log("👀 Puca percebeu: a pessoa clicou em", JSON.parse(p.payload));
  });
  const OUVIR = `if (!window.__ouvindo) { window.__ouvindo = true; document.addEventListener("click", (e) => {
    if (window.__pucaClicando) return; const a = e.target.closest("a, button");
    window.pucaViu(JSON.stringify({ texto: (a ?? e.target).textContent.trim().slice(0, 60), confiavel: e.isTrusted }));
  }, true); }`;
  const js = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
  const prepara = () => js(CAMADA + ";" + OUVIR + "; true");
  const print = async (nome) => { fs.writeFileSync(path.join(OUT, nome), (await w.webContents.capturePage()).toPNG()); log("📸", nome); };
  const clicar = async (vp, quem) => {
    const x = vp.x + vp.width / 2, y = vp.y + vp.height / 2;
    log("alvo do clique", quem, Math.round(x), Math.round(y), "→", await js(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? e.tagName + " " + (e.closest("a")?.getAttribute("href") ?? "") + " " + e.textContent.trim().slice(0, 30) : "nada"; })()`), "| viewport", await js("innerWidth + 'x' + innerHeight + ' dpr=' + devicePixelRatio + ' scrollY=' + scrollY"));
    if (quem === "puca") await js("window.__pucaClicando = true");
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
      await cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    if (quem === "puca") await js("setTimeout(() => (window.__pucaClicando = false), 50)");
  };

  // Fila de ações com cancelamento: o mesmo gatilho que corta a voz corta as ações.
  let cancelado = false;
  const passo = async (nome, fn) => { if (cancelado) throw new Error("interrompida"); log("▶", nome); await fn(); };
  w.webContents.on("before-input-event", (_e, i) => { if (i.key === "Escape") cancelado = true; });

  w.webContents.reload(); // recarrega já sem CSP
  await new Promise((r) => w.webContents.once("did-finish-load", r));
  await espera(1500);
  await prepara();
  log("camada de Puca injetada");

  // Sequência 1: mostrar, marcar, explicar com imagem, clicar.
  const alvo = await js(`__puca.retangulo("README.md")`);
  if (!alvo) { log("não achei README.md na página"); app.quit(); return; }
  await espera(400);
  const r = await js(`__puca.retangulo("README.md")`);
  await passo("cursor até o README", async () => { await js(`__puca.cursor(${r.doc.x + r.doc.w + 8}, ${r.doc.y + 4})`); await espera(900); });
  await passo("círculo à mão", async () => { await js(`__puca.circulo(${JSON.stringify(r.doc)})`); await espera(900); });
  await passo("cartão com imagem + seta", async () => {
    const cx = r.doc.x + r.doc.w + 140, cy = r.doc.y - 150;
    await js(`__puca.cartao(${cx}, ${cy}, ${JSON.stringify(MINI_MAPA)})`);
    await espera(300);
    await js(`__puca.seta(${cx}, ${cy + 120}, ${r.doc.x + r.doc.w + 24}, ${r.doc.y + r.doc.h / 2})`);
    await espera(1000);
  });
  await print("1-circulo-cartao-seta.png");
  await passo("clique de verdade no README", async () => { await clicar(r.vp, "puca"); await espera(3000); });
  await prepara();
  const t = await js(`(() => { const h = [...document.querySelectorAll("article h1, article h2, .markdown-body h1, .markdown-body h2")][0];
    if (!h) return null; h.scrollIntoView({ block: "center" }); const b = h.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
  await passo("marca-texto no título do README", async () => {
    if (t) { await js(`__puca.marcaTexto(${JSON.stringify(t)}); __puca.cursor(${t.x + t.w + 10}, ${t.y})`); }
    await espera(1000);
  });
  await print("2-depois-do-clique.png");

  // Sequência 2: a pessoa fala por cima no meio. Simulado com o mesmo gatilho do Escape.
  await js("__puca.limpar()"); await prepara();
  setTimeout(() => { log("🗣️  pessoa falou por cima (simulado)"); cancelado = true; }, 1300);
  try {
    for (let i = 0; i < 6; i++) {
      await passo(`passo longo ${i + 1}/6`, async () => { await js(`__puca.cursor(${200 + i * 120}, ${t ? t.y + 80 : 300})`); await espera(500); });
    }
  } catch (e) {
    log("⏹️  fila cancelada:", e.message);
    await js(`__puca.limpar(); __puca.aviso("Pode falar, estou ouvindo")`);
    await espera(500);
    await print("3-interrompida.png");
  }

  // A pessoa clica num link da página (simulado com clique real de mouse, sem a marca de Puca).
  await js("__puca.limpar()");
  const link = await js(`(() => { const a = [...document.querySelectorAll("a")].find((x) => x.textContent.trim() === "Issues" && x.getBoundingClientRect().width > 0);
    if (!a) return null; a.scrollIntoView({ block: "center" }); return a.getBoundingClientRect().toJSON(); })()`);
  if (link) { await clicar(link, "pessoa"); await espera(1500); }
  await print("4-clique-da-pessoa.png");
  app.quit();
});
