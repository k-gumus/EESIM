// Netlist → breadboard yerleşimi. Her net bir "hub" sütununa atanır (breadboard'da dikey 5'li şeritler
// aynı düğümdür), iki uçlu elemanlar sütunlar arasına, transistörler yan yana üç sütuna takılır.
// Toprak (GND) üst ve alt mavi raylardır. Masa üstü cihazlar (güç kaynağı, sinyal üreteci, DMM, osiloskop)
// tahta dışında durur ve probları/kablolarıyla ilgili deliklere bağlanır.
import { LIBRARY } from '../circuit/library';
import type { CompType, CompiledCircuit, ParamValue } from '../circuit/types';

export interface Hole {
  col: number;
  row: number; // -2: üst GND rayı, -1: üst + rayı, 0..4: a–e, 5..9: f–j, 10: alt + rayı, 11: alt GND rayı
}

export interface PlacedPart {
  id: string;
  name: string;
  type: CompType;
  params: Record<string, ParamValue>;
  legs: { pin: string; hole: Hole }[];
}

export interface Jumper {
  a: Hole;
  b: Hole;
  color: string;
}

export interface InstrumentLead {
  pin: string;
  label: string;
  to: Hole | { instrument: string; pin: string };
  color: string;
}

export interface PlacedInstrument {
  id: string;
  name: string;
  type: CompType;
  params: Record<string, ParamValue>;
  kind: 'psu' | 'siggen' | 'dmm' | 'scope' | 'transformer' | 'current-source';
  x: number;
  z: number;
  leads: InstrumentLead[];
}

export interface NetTag {
  net: number;
  name: string;
  hole: Hole;
}

export interface Assembly {
  cols: number;
  parts: PlacedPart[];
  jumpers: Jumper[];
  instruments: PlacedInstrument[];
  tags: NetTag[];
  warnings: string[];
}

export const rowZ = (row: number): number => {
  if (row === -2) return -10;
  if (row === -1) return -9;
  if (row <= 4) return -6 + row;
  if (row <= 9) return 2 + (row - 5);
  if (row === 10) return 9;
  return 10;
};

const JUMPER_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#00acc1', '#f06292'];
const THREE_PIN = new Set<CompType>(['npn', 'pnp', 'nmos', 'pmos']);
/** TO-92 bacak sırası (soldan sağa, düz yüz öne bakarken): 2N3904/2N3906 → E B C, 2N7000 → S G D */
const LEG_ORDER: Partial<Record<CompType, string[]>> = { npn: ['e', 'b', 'c'], pnp: ['e', 'b', 'c'], nmos: ['s', 'g', 'd'], pmos: ['s', 'g', 'd'] };

interface Hub {
  col: number;
  bottom: boolean;
}

export function buildAssembly(circ: CompiledCircuit): Assembly {
  const used = new Set<string>();
  const k = (h: Hole) => `${h.col}:${h.row}`;
  const isFree = (h: Hole) => !used.has(k(h));
  const take = (h: Hole) => (used.add(k(h)), h);
  const hubs = new Map<number, Hub>();
  const jumpers: Jumper[] = [];
  const warnings: string[] = [];
  let nextCol = 3;
  let colorIdx = 0;
  const netColor = new Map<number, string>();
  const colorOf = (net: number) => {
    if (net === 0) return '#222222';
    if (!netColor.has(net)) netColor.set(net, JUMPER_COLORS[colorIdx++ % JUMPER_COLORS.length]);
    return netColor.get(net)!;
  };

  const elements = circ.elements;
  const board = elements.filter((e) => LIBRARY[e.type].physical.onBoard);
  const instruments = elements.filter((e) => !LIBRARY[e.type].physical.onBoard && LIBRARY[e.type].physical.instrument);

  // Kaynaklardan başlayarak BFS → soldan sağa akış
  const netDist = new Map<number, number>();
  const queue: number[] = [];
  for (const e of instruments) {
    if (e.type === 'vdc' || e.type === 'vac' || e.type === 'idc') {
      const n = e.nets[0];
      if (n && !netDist.has(n)) (netDist.set(n, 0), queue.push(n));
    }
    if (e.type === 'xfmr' || e.type === 'xfmr_ct') {
      const n = e.nets[2];
      if (n && !netDist.has(n)) (netDist.set(n, 0), queue.push(n));
    }
  }
  while (queue.length) {
    const n = queue.shift()!;
    for (const p of board) {
      if (!p.nets.includes(n)) continue;
      for (const m of p.nets) {
        if (m && !netDist.has(m)) (netDist.set(m, netDist.get(n)! + 1), queue.push(m));
      }
    }
  }
  const partRank = (p: (typeof board)[number]) => Math.min(...p.nets.map((n) => (n ? netDist.get(n) ?? 99 : 99)));
  board.sort((a, b) => partRank(a) - partRank(b));

  const newHub = (net: number, col: number) => {
    hubs.set(net, { col, bottom: false });
    // e satırı köprü için ayrılır
  };

  const enableBottom = (net: number) => {
    const h = hubs.get(net)!;
    if (h.bottom) return;
    h.bottom = true;
    const a = { col: h.col, row: 4 };
    const b = { col: h.col, row: 5 };
    take(a);
    take(b);
    jumpers.push({ a, b, color: colorOf(net) });
  };

  const takeHole = (net: number): Hole => {
    const h = hubs.get(net)!;
    for (const r of [0, 1, 2, 3]) {
      const hole = { col: h.col, row: r };
      if (isFree(hole)) return take(hole);
    }
    enableBottom(net);
    for (const r of [6, 7, 8, 9]) {
      const hole = { col: h.col, row: r };
      if (isFree(hole)) return take(hole);
    }
    warnings.push(`Düğüm ${circ.netNames[net]} için breadboard sütunu doldu`);
    return { col: h.col, row: 3 };
  };

  const takeRail = (col: number, top: boolean): Hole => {
    const row = top ? -2 : 11;
    for (let d = 0; d < 40; d++) {
      for (const c of [col + d, col - d]) {
        if (c < 1) continue;
        const h = { col: c, row };
        if (isFree(h)) return take(h);
      }
    }
    return { col, row };
  };

  // 1) Sütun ataması
  const blocks = new Map<string, { block: number; inline: boolean }>();
  for (const p of board) {
    if (THREE_PIN.has(p.type)) {
      const order = LEG_ORDER[p.type]!;
      const nets = order.map((pin) => p.nets[p.pins.indexOf(pin)]);
      const nonGnd = nets.filter((n) => n !== 0);
      const distinct = new Set(nonGnd).size === nonGnd.length;
      if (distinct && nonGnd.every((n) => !hubs.has(n))) {
        nets.forEach((n, i) => {
          if (n !== 0) newHub(n, nextCol + i);
        });
        blocks.set(p.id, { block: nextCol, inline: true });
        nextCol += 3 + 3;
      } else {
        blocks.set(p.id, { block: -1, inline: false });
      }
    } else {
      for (const n of p.nets) {
        if (n !== 0 && !hubs.has(n)) {
          newHub(n, nextCol);
          nextCol += 4;
        }
      }
    }
  }
  // Cihazların tahtaya giren netleri (örn. sadece DMM'ye bağlı bir düğüm) — kartta elemanı olmayanlar hariç
  const boardNets = new Set<number>();
  for (const p of board) for (const n of p.nets) boardNets.add(n);
  // Transistör blokları için sütun (bağımsız yerleşim)
  for (const p of board) {
    const pp = blocks.get(p.id);
    if (THREE_PIN.has(p.type) && pp && pp.block === -1) {
      pp.block = nextCol + 1;
      nextCol += 5;
    }
  }

  // 2) Eleman yerleşimi
  const parts: PlacedPart[] = [];
  for (const p of board) {
    if (THREE_PIN.has(p.type)) {
      const pp = blocks.get(p.id)!;
      const order = LEG_ORDER[p.type]!;
      const legs = order.map((pin, i) => {
        const net = p.nets[p.pins.indexOf(pin)];
        const col = pp.block + i;
        if (pp.inline && net !== 0) {
          return { pin, hole: takeHole(net) };
        }
        // bağımsız sütun: bacak c satırına, a satırından köprü
        const hole = take({ col, row: 2 });
        const from = take({ col, row: 0 });
        const to = net === 0 ? takeRail(col, true) : takeHole(net);
        jumpers.push({ a: from, b: to, color: colorOf(net) });
        return { pin, hole };
      });
      parts.push({ id: p.id, name: p.name, type: p.type, params: p.params, legs });
      continue;
    }
    const [n1, n2] = p.nets;
    const [p1, p2] = p.pins;
    if (n1 === 0 && n2 === 0) {
      warnings.push(`${p.name} iki ucu da toprakta`);
      continue;
    }
    if (n1 === 0 || n2 === 0) {
      const net = n1 === 0 ? n2 : n1;
      const hh = takeHole(net);
      const rail = takeRail(hubs.get(net)!.col, hh.row <= 4);
      const legs = n1 === 0 ? [{ pin: p1, hole: rail }, { pin: p2, hole: hh }] : [{ pin: p1, hole: hh }, { pin: p2, hole: rail }];
      parts.push({ id: p.id, name: p.name, type: p.type, params: p.params, legs });
      continue;
    }
    if (n1 === n2) {
      const a = takeHole(n1);
      const b = takeHole(n1);
      parts.push({ id: p.id, name: p.name, type: p.type, params: p.params, legs: [{ pin: p1, hole: a }, { pin: p2, hole: b }] });
      continue;
    }
    // ortak serbest satır
    const h1 = hubs.get(n1)!;
    const h2 = hubs.get(n2)!;
    let placed = false;
    for (const bank of ['top', 'bottom'] as const) {
      const rows = bank === 'top' ? [0, 1, 2, 3] : [6, 7, 8, 9];
      for (const r of rows) {
        const a = { col: h1.col, row: r };
        const b = { col: h2.col, row: r };
        if (isFree(a) && isFree(b)) {
          if (bank === 'bottom') {
            enableBottom(n1);
            enableBottom(n2);
          }
          take(a);
          take(b);
          parts.push({ id: p.id, name: p.name, type: p.type, params: p.params, legs: [{ pin: p1, hole: a }, { pin: p2, hole: b }] });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      const a = takeHole(n1);
      const b = takeHole(n2);
      parts.push({ id: p.id, name: p.name, type: p.type, params: p.params, legs: [{ pin: p1, hole: a }, { pin: p2, hole: b }] });
    }
  }

  // Üst ve alt GND raylarını birbirine bağla
  const anyGnd = elements.some((e) => e.nets.includes(0));
  if (anyGnd) {
    const a = take({ col: 1, row: -2 });
    const b = take({ col: 1, row: 11 });
    jumpers.push({ a, b, color: '#222222' });
  }

  // 3) Masa üstü cihazlar
  const back = instruments.filter((e) => ['vdc', 'vac', 'idc', 'xfmr', 'xfmr_ct'].includes(e.type));
  const front = instruments.filter((e) => ['multimeter', 'scope'].includes(e.type));
  const cols = Math.max(30, nextCol + 3);
  const spread = (list: typeof instruments, i: number) => {
    const w = Math.min(cols - 10, (list.length - 1) * 18);
    return list.length <= 1 ? -cols / 4 : -w / 2 + (w * i) / (list.length - 1);
  };
  const placedInst: PlacedInstrument[] = [];
  const instPins = new Map<number, { instrument: string; pin: string }[]>();
  const scopes = front.filter((e) => e.type === 'scope');
  const meters = front.filter((e) => e.type !== 'scope');
  const all = [
    ...back.map((e, i) => ({ e, x: spread(back, i), z: -25 })),
    ...scopes.map((e, i) => ({ e, x: -cols / 2 - 12, z: -2 + i * 16 })),
    ...meters.map((e, i) => ({ e, x: cols / 2 + 7, z: -6 + i * 15 })),
  ];
  for (const { e, x, z } of all) {
    const def = LIBRARY[e.type];
    const kind = def.physical.instrument!;
    const leads: InstrumentLead[] = [];
    e.pins.forEach((pin, i) => {
      const net = e.nets[i];
      const label = def.pins[i].label;
      let color = net === 0 ? '#1b1b1b' : colorOf(net);
      if (kind === 'psu' || kind === 'siggen' || kind === 'current-source') color = pin === 'p' ? '#d32f2f' : '#1b1b1b';
      if (kind === 'dmm') color = pin === 'pos' ? '#d32f2f' : '#1b1b1b';
      if (kind === 'scope') color = pin === 'ch1' ? '#f5d90a' : '#22d3ee';
      const unconnected = net !== 0 && !Object.entries(circ.pinNet).some(([key, n]) => n === net && !key.startsWith(e.id + ':'));
      if (unconnected) return;
      const colX = x + (cols / 2);
      if (net === 0) leads.push({ pin, label, to: takeRail(Math.max(2, Math.min(cols - 2, Math.round(colX))), z < 0), color });
      else if (hubs.has(net)) leads.push({ pin, label, to: takeHole(net), color });
      else {
        // yalnızca cihazlar arasında kalan düğüm (örn. sinyal üreteci → trafo primeri)
        if (!instPins.has(net)) instPins.set(net, []);
        const others = instPins.get(net)!;
        if (others.length) leads.push({ pin, label, to: others[0], color });
        others.push({ instrument: e.id, pin });
      }
    });
    placedInst.push({ id: e.id, name: e.name, type: e.type, params: e.params, kind, x, z, leads });
  }

  // 4) Düğüm etiketleri (isimli netler)
  const tags: NetTag[] = [];
  for (const [net, h] of hubs) {
    const name = circ.netNames[net];
    if (/^N\d{3}$/.test(name)) continue;
    tags.push({ net, name, hole: { col: h.col, row: -1 } });
  }
  void boardNets;

  return { cols, parts, jumpers, instruments: placedInst, tags, warnings };
}
