// JSON devre belgesi ⇄ canvas grafiği dönüşümleri (şablonlar ve kaydet/aç için)
import type { Edge, Node } from '@xyflow/react';
import { LIBRARY, defaultParams } from './library';
import type { CircuitDoc, CompData } from './types';

let uid = 0;
export const newId = (p = 'n') => `${p}_${Date.now().toString(36)}_${(uid++).toString(36)}`;

export function docToGraph(doc: CircuitDoc): { nodes: Node<CompData>[]; edges: Edge[] } {
  const nodes: Node<CompData>[] = [];
  const byName = new Map<string, Node<CompData>>();
  for (const c of doc.components) {
    const def = LIBRARY[c.type];
    if (!def) continue;
    const node: Node<CompData> = {
      id: c.id,
      type: 'comp',
      position: { x: c.x, y: c.y },
      data: { type: c.type, name: c.name, rot: c.rot ?? 0, params: { ...defaultParams(c.type), ...(c.params ?? {}) } },
    };
    nodes.push(node);
    byName.set(c.name, node);
  }
  const edges: Edge[] = [];
  doc.wires.forEach((w, i) => {
    const [an, ap] = w.from.split('.');
    const [bn, bp] = w.to.split('.');
    const a = byName.get(an);
    const b = byName.get(bn);
    if (!a || !b) return;
    edges.push({
      id: w.id ?? `w${i}_${a.id}_${b.id}`,
      type: 'wire',
      source: a.id,
      sourceHandle: ap,
      target: b.id,
      targetHandle: bp,
    });
  });
  return { nodes, edges };
}

export function graphToDoc(nodes: Node<CompData>[], edges: Edge[], title?: string): CircuitDoc {
  const nameOf = new Map(nodes.map((n) => [n.id, n.data.name]));
  return {
    version: 1,
    title,
    components: nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.name,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      rot: n.data.rot,
      params: n.data.params,
    })),
    wires: edges
      .filter((e) => nameOf.has(e.source) && nameOf.has(e.target))
      .map((e) => ({ id: e.id, from: `${nameOf.get(e.source)}.${e.sourceHandle}`, to: `${nameOf.get(e.target)}.${e.targetHandle}` })),
  };
}

/** Basit kurulum yardımcısı: test ve şablonlar için kısa yazım */
export function quickDoc(
  comps: [type: CircuitDoc['components'][number]['type'], name: string, params?: Record<string, number | string | boolean>, x?: number, y?: number, rot?: number][],
  wires: [string, string][],
  title?: string,
): CircuitDoc {
  return {
    version: 1,
    title,
    components: comps.map(([type, name, params, x, y, rot], i) => ({ id: name, type, name, params, x: x ?? i * 120, y: y ?? 0, rot: rot ?? 0 })),
    wires: wires.map(([from, to]) => ({ from, to })),
  };
}
