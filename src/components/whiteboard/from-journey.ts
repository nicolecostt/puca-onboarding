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

/** Seta calculada: sai da borda da caixa na direção da outra e chega na borda dela, com uma curva leve
 *  (como traço à mão) e ponta aberta apontando para onde a linha chega. */
function autoEdge(a: Box, b: Box): { path: string; head: string; mid: { x: number; y: number }; steep: boolean } {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  // Ponto na borda da caixa, na direção da linha, puxado para o meio do lado (longe das quinas
  // arredondadas) e com um respiro para fora. `dir` é +1 saindo da caixa, -1 chegando nela.
  const anchor = (box: Box, c: { x: number; y: number }, dir: number, gap: number) => {
    const vx = ux * dir;
    const vy = uy * dir;
    const tx = vx ? box.w / 2 / Math.abs(vx) : Infinity;
    const ty = vy ? box.h / 2 / Math.abs(vy) : Infinity;
    if (tx < ty) {
      // sai pela lateral
      const y = c.y + vy * tx * 0.4;
      return { x: c.x + Math.sign(vx) * (box.w / 2 + gap), y };
    }
    // sai por cima ou por baixo
    const x = c.x + vx * ty * 0.4;
    return { x, y: c.y + Math.sign(vy) * (box.h / 2 + gap) };
  };
  const { x: x1, y: y1 } = anchor(a, ac, 1, 6);
  const { x: x2, y: y2 } = anchor(b, bc, -1, 9);
  // curva leve para o mesmo lado (sentido horário), proporcional ao tamanho da seta
  const len = Math.hypot(x2 - x1, y2 - y1);
  const bend = Math.min(26, len * 0.09);
  const qx = (x1 + x2) / 2 - uy * bend;
  const qy = (y1 + y2) / 2 + ux * bend;
  // quadrática escrita como cúbica (o resto do quadro espera "C")
  const c1x = x1 + ((qx - x1) * 2) / 3;
  const c1y = y1 + ((qy - y1) * 2) / 3;
  const c2x = x2 + ((qx - x2) * 2) / 3;
  const c2y = y2 + ((qy - y2) * 2) / 3;
  // ponta: chevron aberto na direção em que a curva chega
  let tx = x2 - qx;
  let ty = y2 - qy;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;
  const p = (along: number, side: number) => `${(x2 - tx * along - ty * side).toFixed(1)} ${(y2 - ty * along + tx * side).toFixed(1)}`;
  const mid = { x: 0.25 * x1 + 0.5 * qx + 0.25 * x2, y: 0.25 * y1 + 0.5 * qy + 0.25 * y2 };
  const f = (v: number) => v.toFixed(1);
  return {
    path: `M${f(x1)} ${f(y1)} C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(x2)} ${f(y2)}`,
    head: `M${p(9, 5.5)} L${f(x2)} ${f(y2)} L${p(9, -5.5)}`,
    mid,
    steep: Math.abs(dx) < Math.abs(dy),
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
