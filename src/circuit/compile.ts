// Canvas grafiği (React Flow düğümleri + kablolar) → düğüm (net) listesi + eleman listesi + sorun tespiti
import type { Edge, Node } from '@xyflow/react';
import { LIBRARY } from './library';
import type { CompData, CompiledCircuit, CompiledElement, Issue, WireTreeEntry } from './types';

class DSU {
  parent = new Map<string, string>();
  find(a: string): string {
    if (!this.parent.has(a)) this.parent.set(a, a);
    let r = a;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = a;
    while (this.parent.get(c) !== r) {
      const nx = this.parent.get(c)!;
      this.parent.set(c, r);
      c = nx;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // GND her zaman kök olsun
    if (rb === 'GND') this.parent.set(ra, rb);
    else this.parent.set(rb, ra);
  }
}

export const pinKey = (nodeId: string, pin: string) => `${nodeId}:${pin}`;
const LOGIC_IN_TYPES = new Set(['and', 'or', 'nand', 'nor', 'xor', 'not', 'dff']);

export function compileCircuit(nodes: Node<CompData>[], edges: Edge[]): CompiledCircuit {
  const dsu = new DSU();
  dsu.find('GND');
  const pinDeg = new Map<string, number>();
  const validKeys = new Set<string>();

  for (const n of nodes) {
    const def = LIBRARY[n.data.type];
    if (!def) continue;
    for (const p of def.pins) {
      const k = pinKey(n.id, p.id);
      dsu.find(k);
      validKeys.add(k);
      pinDeg.set(k, 0);
    }
    if (n.data.type === 'ground') dsu.union('GND', pinKey(n.id, 'g'));
  }

  const labelNets = new Map<string, string>(); // kök → etiket
  for (const n of nodes) {
    if (n.data.type === 'label') {
      const text = String(n.data.params.text ?? '').trim().toUpperCase();
      if (!text) continue;
      if (text === 'GND' || text === '0') dsu.union('GND', pinKey(n.id, 'p'));
      else dsu.union(`LBL:${text}`, pinKey(n.id, 'p'));
    }
  }

  const goodEdges: Edge[] = [];
  for (const e of edges) {
    const a = pinKey(e.source, e.sourceHandle ?? '');
    const b = pinKey(e.target, e.targetHandle ?? '');
    if (!validKeys.has(a) || !validKeys.has(b) || a === b) continue;
    dsu.union(a, b);
    pinDeg.set(a, (pinDeg.get(a) ?? 0) + 1);
    pinDeg.set(b, (pinDeg.get(b) ?? 0) + 1);
    goodEdges.push(e);
  }

  // Etiket isimlerini köklere bağla
  for (const n of nodes) {
    if (n.data.type === 'label') {
      const text = String(n.data.params.text ?? '').trim().toUpperCase();
      if (!text || text === 'GND' || text === '0') continue;
      const r = dsu.find(pinKey(n.id, 'p'));
      if (!labelNets.has(r)) labelNets.set(r, text);
    }
  }

  // Net numaralandırma
  const rootToNet = new Map<string, number>();
  const groundRoot = dsu.find('GND');
  rootToNet.set(groundRoot, 0);
  const netNames: string[] = ['0'];
  const pinNet: Record<string, number> = {};
  let auto = 1;
  const netMembers = new Map<number, string[]>();
  for (const k of validKeys) {
    const r = dsu.find(k);
    let net = rootToNet.get(r);
    if (net === undefined) {
      net = netNames.length;
      rootToNet.set(r, net);
      const lbl = labelNets.get(r);
      netNames.push(lbl ?? `N${String(auto++).padStart(3, '0')}`);
    }
    pinNet[k] = net;
    if (!netMembers.has(net)) netMembers.set(net, []);
    netMembers.get(net)!.push(k);
  }

  const elements: CompiledElement[] = [];
  const nameOf = new Map<string, string>();
  let hasGround = false;
  for (const n of nodes) {
    nameOf.set(n.id, n.data.name);
    const t = n.data.type;
    if (t === 'ground') {
      hasGround = true;
      continue;
    }
    if (t === 'label') continue;
    const def = LIBRARY[t];
    if (!def) continue;
    elements.push({
      id: n.id,
      name: n.data.name,
      type: t,
      nets: def.pins.map((p) => pinNet[pinKey(n.id, p.id)]),
      pins: def.pins.map((p) => p.id),
      params: n.data.params,
    });
  }
  // GND isimli etiket de toprak sayılır
  if (!hasGround && nodes.some((n) => n.data.type === 'label' && /^(GND|0)$/i.test(String(n.data.params.text).trim()))) hasGround = true;

  const issues = findIssues(elements, nodes, pinNet, pinDeg, netMembers, hasGround);
  const wireTree = buildWireTree(goodEdges, pinNet);

  return { netCount: netNames.length, netNames, elements, pinNet, wireTree, issues, hasGround };
}

function findIssues(
  elements: CompiledElement[],
  nodes: Node<CompData>[],
  pinNet: Record<string, number>,
  pinDeg: Map<string, number>,
  netMembers: Map<number, string[]>,
  hasGround: boolean,
): Issue[] {
  const issues: Issue[] = [];
  const active = elements.filter((e) => e.type !== 'scope');
  if (active.length === 0) return issues;

  const FLOATING_SRC = new Set(['vdc', 'vac', 'idc', 'battery', 'clock', 'xfmr', 'xfmr_ct', 'vcvs', 'vccs', 'cccs', 'ccvs']);
  // Yalnızca lojik kaynak/kapılardan oluşan devrelerde toprak örtüktür
  if (!hasGround && elements.some((e) => FLOATING_SRC.has(e.type))) {
    const src = elements.find((e) => ['vdc', 'vac', 'idc', 'battery', 'clock'].includes(e.type));
    issues.push({
      level: 'error',
      code: 'no-ground',
      message: 'Devrede toprak (GND) yok! SPICE ve MNA bir 0 V referans düğümü olmadan gerilimleri hesaplayamaz.',
      comp: src?.name,
      fix: src
        ? { summary: `${src.name} kaynağının (−) ucuna toprak ekle`, actions: [{ op: 'connectGround', id: src.name, pin: 'n' }] }
        : undefined,
    });
  }

  const pinLabel = (e: CompiledElement, pin: string) => LIBRARY[e.type].pins.find((p) => p.id === pin)?.label ?? pin;

  for (const e of elements) {
    // Boşta kalan uçlar
    e.pins.forEach((pin, i) => {
      const net = e.nets[i];
      const members = netMembers.get(net) ?? [];
      if (members.length <= 1 && net !== 0) {
        if (e.type === 'scope' || e.type === 'multimeter' || e.type === 'logicprobe' || LOGIC_IN_TYPES.has(e.type)) return;
        issues.push({
          level: 'warning',
          code: 'floating-pin',
          comp: e.name,
          message: `${e.name} elemanının ${pinLabel(e, pin)} ucu hiçbir yere bağlı değil.`,
        });
      }
    });

    if (['vdc', 'vac', 'battery', 'clock'].includes(e.type) && e.nets[0] === e.nets[1]) {
      issues.push({
        level: 'error',
        code: 'short-source',
        comp: e.name,
        message: `${e.name} gerilim kaynağının iki ucu aynı düğüme bağlı: kaynak kısa devre!`,
      });
    }
    if (e.type === 'multimeter' && String(e.params.mode).endsWith('A')) {
      // Ampermetre bir gerilim kaynağına paralel mi?
      const src = elements.find(
        (s) =>
          (s.type === 'vdc' || s.type === 'vac') &&
          ((s.nets[0] === e.nets[0] && s.nets[1] === e.nets[1]) || (s.nets[0] === e.nets[1] && s.nets[1] === e.nets[0])),
      );
      if (src) {
        issues.push({
          level: 'error',
          code: 'ammeter-parallel',
          comp: e.name,
          message: `${e.name} akım kademesinde ama ${src.name} kaynağına PARALEL bağlı. Gerçek laboratuvarda bu sigortayı attırır! Ampermetre seri bağlanmalı.`,
          fix: { summary: `${e.name}'yi gerilim kademesine (V ⎓) al`, actions: [{ op: 'set', id: e.name, param: 'mode', value: 'DCV' }] },
        });
      }
    }
    if (['resistor', 'capacitor', 'inductor', 'diode', 'zener', 'led'].includes(e.type) && e.nets[0] === e.nets[1]) {
      issues.push({
        level: 'info',
        code: 'shorted-element',
        comp: e.name,
        message: `${e.name} elemanının iki ucu aynı düğümde; üzerinden akım akmaz (kısa devre edilmiş).`,
      });
    }
  }

  // Lojik girişler: sürücüsü olmayan (boşta) giriş → pull-up / pull-down uyarısı
  const typeOf = new Map(nodes.map((n) => [n.id, n.data.type]));
  const LOGIC_IN: Record<string, string[]> = { and: ['a', 'b'], or: ['a', 'b'], nand: ['a', 'b'], nor: ['a', 'b'], xor: ['a', 'b'], not: ['a'], dff: ['d', 'clk'] };
  const isPassiveReader = (key: string) => {
    const [id, pin] = key.split(':');
    const t = typeOf.get(id);
    if (!t) return true;
    if (t === 'label' || t === 'scope' || t === 'logicprobe') return true;
    if (t === 'multimeter') return true;
    return (LOGIC_IN[t] ?? []).includes(pin);
  };
  for (const e of elements) {
    const ins = LOGIC_IN[e.type];
    if (!ins) continue;
    for (const pin of ins) {
      const net = e.nets[e.pins.indexOf(pin)];
      if (net === 0) continue;
      const members = netMembers.get(net) ?? [];
      if (members.every(isPassiveReader)) {
        issues.push({
          level: 'warning',
          code: 'floating-input',
          comp: e.name,
          message: `${e.name} kapısının ${pin.toUpperCase()} girişi boşta: seviyesi belirsiz (~2,5 V). Bir pull-down (toprağa ~10 kΩ) ya da pull-up (5 V'a ~10 kΩ) direnci ekle.`,
        });
      }
    }
  }

  // Kablosuz pinler (ama aynı nette başka şey olabilir — örn. etiket) — sadece bilgi
  void pinDeg;
  void nodes;
  void pinNet;
  return issues;
}

/** Her net için kablo grafiğinde yayılan ağaç → kablo akımlarını KCL ile hesaplamak için */
function buildWireTree(edges: Edge[], pinNet: Record<string, number>): WireTreeEntry[] {
  const adj = new Map<string, { other: string; edge: Edge }[]>();
  for (const e of edges) {
    const a = pinKey(e.source, e.sourceHandle ?? '');
    const b = pinKey(e.target, e.targetHandle ?? '');
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ other: b, edge: e });
    adj.get(b)!.push({ other: a, edge: e });
  }
  const visited = new Set<string>();
  const out: WireTreeEntry[] = [];
  let order = 0;
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    visited.add(start);
    const queue = [start];
    const entries: WireTreeEntry[] = [];
    while (queue.length) {
      const u = queue.shift()!;
      for (const { other, edge } of adj.get(u)!) {
        if (visited.has(other)) continue;
        visited.add(other);
        queue.push(other);
        const srcKey = pinKey(edge.source, edge.sourceHandle ?? '');
        entries.push({ edgeId: edge.id, child: other, parent: u, sign: srcKey === u ? 1 : -1, order: order++ });
      }
    }
    out.push(...entries);
  }
  void pinNet;
  return out;
}

/**
 * Kablo akımları: pin akımlarından (elemana giren) yaprağa doğru toplayarak.
 * Dönen değer: edgeId → source pin'den target pin'e akan akım.
 */
export function computeWireCurrents(tree: WireTreeEntry[], pinCurrent: (key: string) => number): Map<string, number> {
  const sub = new Map<string, number>();
  const res = new Map<string, number>();
  // Ters BFS sırası: önce yapraklar. Kenardaki akım (ebeveyn → çocuk) = çocuğun alt ağacındaki elemanlara giren toplam akım.
  for (let i = tree.length - 1; i >= 0; i--) {
    const t = tree[i];
    const s = (sub.get(t.child) ?? 0) + pinCurrent(t.child);
    res.set(t.edgeId, s * t.sign);
    sub.set(t.parent, (sub.get(t.parent) ?? 0) + s);
  }
  return res;
}
