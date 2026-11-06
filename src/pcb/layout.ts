// PCB yerleşim motoru (saf, test edilebilir): devre grafiğini footprint'lere + ratsnest'e çevirir.
// Kart koordinatları şematik koordinatlarıyla aynıdır (pad'ler pin konumlarında) → öğrenci şemayla kartı eşleştirebilir.
import type { Edge, Node } from '@xyflow/react';
import { LIBRARY, rotatePin, rotatedSize } from '../circuit/library';
import { compileCircuit, pinKey } from '../circuit/compile';
import type { CompData, CompType } from '../circuit/types';

export interface Pad {
  pin: string;
  label: string;
  x: number;
  y: number;
  net: number;
  netName: string;
  shape: 'rect' | 'round';
  gnd: boolean;
}

export interface Footprint {
  id: string;
  name: string;
  type: CompType;
  value: string;
  onBoard: boolean; // true = karta dizilen eleman, false = dış bağlantı (konnektör/terminal)
  bodyKind: string; // physical.body
  x: number;
  y: number;
  w: number;
  h: number;
  pads: Pad[];
}

export interface Rat {
  net: number;
  netName: string;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface NetInfo {
  net: number;
  name: string;
  color: string;
  pads: number;
  gnd: boolean;
}

export interface PcbLayout {
  footprints: Footprint[];
  rats: Rat[];
  nets: NetInfo[];
  viewBox: { x: number; y: number; w: number; h: number };
}

/** GND dışı netler için ayırt edici renk paleti (ratsnest + lejant) */
export const NET_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#8b5cf6', '#eab308',
];
export const GND_COLOR = '#64748b';

/** Kısa değer metni (silkscreen için) */
function valueText(type: CompType, p: Record<string, unknown>): string {
  const n = (k: string) => Number(p[k]);
  const si = (v: number, u: string) => {
    if (!isFinite(v) || v === 0) return `0 ${u}`;
    const pre = [
      { e: 9, s: 'G' }, { e: 6, s: 'M' }, { e: 3, s: 'k' }, { e: 0, s: '' },
      { e: -3, s: 'm' }, { e: -6, s: 'µ' }, { e: -9, s: 'n' }, { e: -12, s: 'p' },
    ];
    const exp = Math.floor(Math.log10(Math.abs(v)) / 3) * 3;
    const m = pre.find((x) => x.e <= exp) ?? pre[pre.length - 1];
    const val = v / 10 ** m.e;
    return `${Math.round(val * 100) / 100}${m.s} ${u}`;
  };
  switch (type) {
    case 'resistor': return si(n('R'), 'Ω');
    case 'capacitor': return si(n('C'), 'F');
    case 'inductor': return si(n('L'), 'H');
    case 'zener': return `${n('Vz')} V`;
    case 'vdc': case 'battery': return `${n('V')} V`;
    case 'vac': return `${n('amp')} Vp`;
    case 'led': return String(p.color ?? '');
    case 'diode': return String(p.model ?? '');
    case 'reg78': return `78${String(n('Vout')).padStart(2, '0')}`;
    case 'opamp': return String(p.model ?? '');
    case 'timer555': return '555';
    default: return '';
  }
}

const sq = (dx: number, dy: number) => dx * dx + dy * dy;

/** Bir net'teki pad'ler için minimum yayılan ağaç (Prim) → ratsnest kenarları */
function mst(pts: { x: number; y: number }[]): [number, number][] {
  const n = pts.length;
  if (n < 2) return [];
  const inTree = new Array(n).fill(false);
  // 0. düğümü ağaca al ve komşularını gevşet (yoksa ilk adımda hepsi Infinity kalır)
  const dist = pts.map((p) => sq(p.x - pts[0].x, p.y - pts[0].y));
  const parent = new Array(n).fill(0);
  inTree[0] = true;
  const out: [number, number][] = [];
  for (let it = 1; it < n; it++) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < n; i++) if (!inTree[i] && dist[i] < bd) (bd = dist[i]), (best = i);
    if (best < 0) break;
    inTree[best] = true;
    out.push([parent[best], best]);
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue;
      const d = sq(pts[i].x - pts[best].x, pts[i].y - pts[best].y);
      if (d < dist[i]) (dist[i] = d), (parent[i] = best);
    }
  }
  return out;
}

/** Devre grafiğini (React Flow düğüm + kablo) PCB yerleşimine çevir */
export function buildPcb(nodes: Node<CompData>[], edges: Edge[]): PcbLayout {
  const circ = compileCircuit(nodes, edges);
  const footprints: Footprint[] = [];
  const padsByNet = new Map<number, { x: number; y: number }[]>();

  for (const node of nodes) {
    const def = LIBRARY[node.data.type];
    if (!def) continue;
    if (node.data.type === 'ground' || node.data.type === 'label') continue; // net birleştiricileri: footprint yok
    const rot = node.data.rot ?? 0;
    const { w, h } = rotatedSize(def, rot);
    const ox = node.position.x;
    const oy = node.position.y;
    const pads: Pad[] = def.pins.map((p, i) => {
      const rp = rotatePin(def, p, rot);
      const net = circ.pinNet[pinKey(node.id, p.id)] ?? -1;
      const gnd = net === 0;
      const x = ox + rp.x;
      const y = oy + rp.y;
      if (net > 0) {
        if (!padsByNet.has(net)) padsByNet.set(net, []);
        padsByNet.get(net)!.push({ x, y });
      }
      return {
        pin: p.id,
        label: p.label || p.id,
        x,
        y,
        net,
        netName: net === 0 ? 'GND' : (circ.netNames[net] ?? '?'),
        shape: i === 0 ? 'rect' : 'round',
        gnd,
      };
    });
    footprints.push({
      id: node.id,
      name: node.data.name,
      type: node.data.type,
      value: valueText(node.data.type, node.data.params),
      onBoard: def.physical.onBoard,
      bodyKind: def.physical.body,
      x: ox,
      y: oy,
      w,
      h,
      pads,
    });
  }

  // Netlere renk ata (GND hariç; GND zemin bakırı sayılır, ratsnest çizilmez)
  const nets: NetInfo[] = [];
  const colorOf = new Map<number, string>();
  let ci = 0;
  for (let net = 1; net < circ.netCount; net++) {
    const pads = padsByNet.get(net)?.length ?? 0;
    const color = NET_COLORS[ci % NET_COLORS.length];
    colorOf.set(net, color);
    if (pads >= 1) ci++;
    nets.push({ net, name: circ.netNames[net] ?? `N${net}`, color, pads, gnd: false });
  }

  // Ratsnest: GND dışı, en az 2 pad'li netler
  const rats: Rat[] = [];
  for (const [net, pts] of padsByNet) {
    if (pts.length < 2) continue;
    const color = colorOf.get(net) ?? NET_COLORS[0];
    for (const [a, b] of mst(pts)) {
      rats.push({ net, netName: circ.netNames[net] ?? `N${net}`, color, x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y });
    }
  }

  // Görüntü kutusu (tüm gövde + pad'leri kapsa) + kenar boşluğu
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const f of footprints) {
    grow(f.x, f.y);
    grow(f.x + f.w, f.y + f.h);
    for (const p of f.pads) grow(p.x, p.y);
  }
  if (!isFinite(minX)) (minX = 0), (minY = 0), (maxX = 200), (maxY = 200);
  const M = 40;
  const viewBox = { x: minX - M, y: minY - M, w: maxX - minX + 2 * M, h: maxY - minY + 2 * M };

  return { footprints, rats, nets: nets.filter((n) => n.pads >= 1), viewBox };
}
