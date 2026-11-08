// Camada da Puca injetada nas páginas do navegador dela (docs/stack.md §4.4): cursor, círculo à mão e marca-texto,
// em coordenadas do documento (rolam junto), sem pegar clique. O script é montado das funções abaixo, então o que roda
// na página é o que os testes cobrem.

/** Texto para comparar: minúsculas, sem acento, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Índice do melhor candidato para o texto procurado, ou -1: só visíveis que contêm o texto; clicável antes; o mais curto. */
export function escolherAlvo(candidatos: { texto: string; visivel: boolean; clicavel: boolean }[], procurado: string): number {
  const alvo = normalizar(procurado);
  if (!alvo) return -1;
  let melhor = -1;
  let melhorNota = Infinity;
  candidatos.forEach((c, i) => {
    if (!c.visivel) return;
    const t = normalizar(c.texto);
    if (!t.includes(alvo)) return;
    const nota = (c.clicavel ? 0 : 100000) + t.length;
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = i;
    }
  });
  return melhor;
}

// Os nomes vêm de `.name`: o esbuild pode renomear as funções no pacote, e o script segue o que ele gerou.
export const CAMADA = String.raw`
${normalizar.toString()}
${escolherAlvo.toString()}
window.__puca ??= (() => {
  const NS = "http://www.w3.org/2000/svg";
  const raiz = () => {
    let l = document.getElementById("puca-camada");
    if (!l) {
      l = document.createElement("div");
      l.id = "puca-camada";
      l.style.cssText = "position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2147483647";
      l.innerHTML = '<svg id="puca-svg" style="position:absolute;left:0;top:0;overflow:visible" width="1" height="1"></svg>' +
        '<div id="puca-cursor" style="position:absolute;left:0;top:0;display:flex;align-items:flex-start;gap:2px;' +
        'transition:transform .8s cubic-bezier(.3,.7,.2,1);transform:translate(-80px,-80px)">' +
        '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 3.2 20.4 10a.6.6 0 0 1-.05 1.13l-6.8 2.1a1 1 0 0 0-.65.62l-2.3 6.6a.6.6 0 0 1-1.13.02L3.2 4a.6.6 0 0 1 .8-.8z" fill="#6b4eff" stroke="#fff" stroke-width="1.5"/></svg>' +
        '<span style="margin-top:14px;font:600 12px system-ui;color:#fff;background:#6b4eff;padding:2px 8px;border-radius:10px;box-shadow:0 2px 8px #0003">Puca</span></div>';
      document.body.appendChild(l);
    }
    l.style.height = document.documentElement.scrollHeight + "px";
    return l;
  };
  const svg = () => (raiz(), document.getElementById("puca-svg"));
  const tracar = (d, cor, larg) => {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", cor);
    p.setAttribute("stroke-width", larg); p.setAttribute("stroke-linecap", "round");
    svg().appendChild(p);
    const L = p.getTotalLength();
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset .8s ease-out"; p.style.strokeDashoffset = 0;
  };
  const visivel = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const CLICAVEIS = "a, button, [role=button], input, textarea, summary";
  const TEXTOS = "h1, h2, h3, h4, p, li, span, td, code, strong";
  return {
    achar(alvo) {
      let el = null;
      if (alvo.seletor) el = [...document.querySelectorAll(alvo.seletor)].find(visivel) ?? null;
      if (!el && alvo.texto) {
        const lista = [...document.querySelectorAll(CLICAVEIS), ...document.querySelectorAll(TEXTOS)];
        const i = ${escolherAlvo.name}(lista.map((e) => ({ texto: e.textContent || e.getAttribute("aria-label") || "", visivel: visivel(e), clicavel: e.matches(CLICAVEIS) })), alvo.texto);
        el = i >= 0 ? lista[i] : null;
      }
      if (!el) return null;
      el = el.closest("a, button") ?? el;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { doc: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }, vp: { x: r.left, y: r.top, width: r.width, height: r.height } };
    },
    cursor(x, y) { raiz(); document.getElementById("puca-cursor").style.transform = "translate(" + x + "px," + y + "px)"; },
    circular(r) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 + 18, ry = r.h / 2 + 10;
      let d = "";
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2.15 - 0.4, j = 1 + Math.sin(i * 1.7) * 0.04;
        d += (i ? "L" : "M") + (cx + Math.cos(a) * rx * j).toFixed(1) + " " + (cy + Math.sin(a) * ry * j).toFixed(1);
      }
      tracar(d, "#e5484d", 3);
    },
    marcar(r) {
      const m = document.createElement("div");
      m.style.cssText = "position:absolute;left:" + (r.x - 4) + "px;top:" + (r.y - 2) + "px;width:" + (r.w + 8) + "px;height:" + (r.h + 4) + "px;background:#ffe06680;border-radius:4px;mix-blend-mode:multiply";
      raiz().appendChild(m);
    },
    limpar() { document.getElementById("puca-camada")?.remove(); },
  };
})();
true;
`;
