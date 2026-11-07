// Converte um quadro da jornada (src/journey, nós pelo centro) no que o quadro desenha
// (nós pelo canto, setas em SVG). Setas sem desenho exato (path/head) são calculadas aqui.
import type { BoardEdge, BoardNode, BoardNodeKind, NodeDetails, WhiteboardSpec } from "../../data";
import type { BoardSpec, BoardNode as JNode, BoardEdge as JEdge } from "../../journey/types";

/** Altura do nó no quadro: borda + padding (20), cada linha do rótulo (18,4) e o @dono (14,5). */
export function nodeHeight(n: Pick<JNode, "label" | "sublabel">): number {
  return 20 + 18.4 * n.label.split("\n").length + (n.sublabel ? 14.5 : 0);
}

/** Largura pelo tamanho do texto (letra à mão de 16px). */
function nodeWidth(n: JNode): number {
  const longest = Math.max(...n.label.split("\n").map((l) => l.length * 8.6), (n.sublabel?.length ?? 0) * 6);
  return Math.max(130, Math.round(longest + 40));
}

function kindOf(n: JNode): BoardNodeKind {
  if (n.look) return n.look;
  if (n.kind === "queue") return "topic";
  if (n.kind === "external") return "external";
  return "service";
}

function detailsOf(n: JNode): NodeDetails | undefined {
  const i = n.info;
  if (!i) return undefined;
  const rows: NodeDetails["rows"] = [];
  if (i.team) rows.push({ label: "Time", value: i.team });
  if (i.owner && i.owner_confirmed !== false) rows.push({ label: "Dono", value: i.owner });
  if (i.adr) rows.push({ label: "Decisão", value: `${i.adr.id} · ${i.adr.title}${i.adr.owner ? ` (${i.adr.owner})` : ""}` });
  const list = [...(i.adr ? [i.adr.summary] : []), ...(i.bullets ?? [])];
  return {
    what: i.role,
    rows,
    warn: i.owner_confirmed === false ? "Não encontrei um responsável confirmado. Fale com a sua buddy antes de assumir quem cuida." : undefined,
    list,
    docs: i.docs?.map((d) => d.title),
  };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Seta calculada: sai pela lateral (ou por baixo/cima) e chega na outra caixa, com ponta aberta. */
function autoEdge(a: Box, b: Box): { path: string; head: string; mid: { x: number; y: number }; steep: boolean } {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
  if (Math.abs(dx) > Math.abs(dy)) {
    const s = Math.sign(dx) || 1;
    x1 = ac.x + (s * a.w) / 2 + s * 3;
    y1 = ac.y;
    x2 = bc.x - (s * b.w) / 2 - s * 4;
    y2 = bc.y;
    const k = (x2 - x1) / 2;
    [c1x, c1y, c2x, c2y] = [x1 + k, y1, x2 - k, y2];
  } else {
    const s = Math.sign(dy) || 1;
    x1 = ac.x;
    y1 = ac.y + (s * a.h) / 2 + s * 3;
    x2 = bc.x;
    y2 = bc.y - (s * b.h) / 2 - s * 4;
    const k = (y2 - y1) / 2;
    [c1x, c1y, c2x, c2y] = [x1, y1 + k, x2, y2 - k];
  }
  // ponta: chevron aberto na direção em que a curva chega
  let ux = x2 - c2x;
  let uy = y2 - c2y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len;
  uy /= len;
  const p = (along: number, side: number) => `${(x2 - ux * along - uy * side).toFixed(1)} ${(y2 - uy * along + ux * side).toFixed(1)}`;
  const mid = { x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * c1y + 3 * c2y + y2) / 8 };
  const steep = Math.abs(x2 + c2x - c1x - x1) < Math.abs(y2 + c2y - c1y - y1);
  const f = (v: number) => v.toFixed(1);
  return {
    path: `M${f(x1)} ${f(y1)} C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}`,
    head: `M${p(10, 6)} L${f(x2)} ${f(y2)} L${p(10, -6)}`,
    mid,
    steep,
  };
}

export function whiteboardFromJourney(spec: BoardSpec): WhiteboardSpec {
  const boxes = new Map<string, Box>();
  const nodes: BoardNode[] = spec.nodes.map((n) => {
    const w = n.w ?? nodeWidth(n);
    const h = nodeHeight(n);
    const box = { x: n.x - w / 2, y: n.y - h / 2, w, h };
    boxes.set(n.id, box);
    return {
      id: n.id,
      label: n.label,
      kind: kindOf(n),
      x: Math.round(box.x),
      y: Math.round(box.y),
      w,
      caption: n.sublabel,
      note: n.note,
      details: detailsOf(n),
    };
  });

  const edges: BoardEdge[] = spec.edges.flatMap((e: JEdge) => {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) return [];
    const auto = autoEdge(a, b);
    let label: BoardEdge["label"];
    if (e.label) {
      const at =
        e.label_at ??
        (auto.steep
          ? { x: auto.mid.x + 10, y: auto.mid.y - 9 }
          : { x: auto.mid.x - (e.label.length * 7) / 2, y: auto.mid.y - 24 });
      label = { text: e.label, x: Math.round(at.x), y: Math.round(at.y), font: e.label_font };
    }
    return [
      {
        id: e.id,
        from: e.from,
        to: e.to,
        path: e.path ?? auto.path,
        head: e.head ?? auto.head,
        style: e.style,
        label,
        evidence: e.evidence,
      },
    ];
  });

  return { nodes, edges, labels: spec.labels ?? [], upcoming: spec.upcoming ?? [] };
}
