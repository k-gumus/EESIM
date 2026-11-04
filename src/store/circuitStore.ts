// Devre durumu (React Flow düğümleri + kablolar), geri al/yinele ve düzeltme yamaları
import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { LIBRARY, defaultParams, rotatePin } from '../circuit/library';
import { docToGraph, graphToDoc, newId } from '../circuit/doc';
import type { CircuitDoc, CompData, CompType, FixPatch, ParamValue } from '../circuit/types';

type CNode = Node<CompData>;

interface Snapshot {
  nodes: CNode[];
  edges: Edge[];
}

export interface CircuitState {
  nodes: CNode[];
  edges: Edge[];
  title: string;
  templateId: string | null;
  selectedId: string | null;
  /** elektriksel değişikliklerde artar → yeniden derleme */
  version: number;
  /** topoloji değişikliklerinde artar → simülasyon sıfırlanır */
  topoVersion: number;
  past: Snapshot[];
  future: Snapshot[];

  onNodesChange: (changes: NodeChange<CNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  addComponent: (type: CompType, pos: { x: number; y: number }) => string;
  updateParams: (id: string, params: Record<string, ParamValue>, commit?: boolean) => void;
  rename: (id: string, name: string) => void;
  rotate: (id: string) => void;
  flip: (id: string) => void;
  toggleSwitch: (id: string) => void;
  remove: (ids: string[]) => void;
  select: (id: string | null) => void;
  loadDoc: (doc: CircuitDoc, templateId?: string | null) => void;
  clear: () => void;
  toDoc: () => CircuitDoc;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  applyFix: (patch: FixPatch) => { ok: boolean; log: string[] };
  byName: (name: string) => CNode | undefined;
}

const GRID = 20;
export const snap = (v: number) => Math.round(v / GRID) * GRID;

function nextName(nodes: CNode[], type: CompType): string {
  const prefix = LIBRARY[type].prefix;
  const used = new Set(nodes.map((n) => n.data.name));
  for (let i = 1; ; i++) {
    const nm = `${prefix}${i}`;
    if (!used.has(nm)) return nm;
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useCircuit = create<CircuitState>((set, get) => {
  const pushHistory = () => {
    const { nodes, edges, past } = get();
    const snap: Snapshot = { nodes: clone(nodes.map((n) => ({ ...n, selected: false }))), edges: clone(edges) };
    set({ past: [...past.slice(-60), snap], future: [] });
  };
  const bump = (topo = true) =>
    set((s) => ({ version: s.version + 1, topoVersion: topo ? s.topoVersion + 1 : s.topoVersion }));

  return {
    nodes: [],
    edges: [],
    title: 'Yeni devre',
    templateId: null,
    selectedId: null,
    version: 0,
    topoVersion: 0,
    past: [],
    future: [],

    onNodesChange: (changes) => {
      const structural = changes.some((c) => c.type === 'remove' || c.type === 'add');
      const dragEnd = changes.some((c) => c.type === 'position' && c.dragging === false);
      if (structural) pushHistory();
      let selectedId = get().selectedId;
      for (const c of changes) {
        if (c.type === 'select') {
          if (c.selected) selectedId = c.id;
          else if (selectedId === c.id) selectedId = null;
        }
        if (c.type === 'remove' && c.id === selectedId) selectedId = null;
      }
      const nodes = applyNodeChanges(changes, get().nodes);
      let edges = get().edges;
      if (structural) {
        const ids = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      }
      set({ nodes, edges, selectedId });
      if (structural) bump();
      if (dragEnd) {
        // sürükleme bitti — geçmişe ekle (konum değişikliği)
        const { past } = get();
        void past;
      }
    },

    onEdgesChange: (changes) => {
      const structural = changes.some((c) => c.type === 'remove' || c.type === 'add');
      if (structural) pushHistory();
      set({ edges: applyEdgeChanges(changes, get().edges) });
      if (structural) bump();
    },

    onConnect: (c) => {
      if (!c.source || !c.target || (c.source === c.target && c.sourceHandle === c.targetHandle)) return;
      const exists = get().edges.some(
        (e) =>
          (e.source === c.source && e.sourceHandle === c.sourceHandle && e.target === c.target && e.targetHandle === c.targetHandle) ||
          (e.source === c.target && e.sourceHandle === c.targetHandle && e.target === c.source && e.targetHandle === c.sourceHandle),
      );
      if (exists) return;
      pushHistory();
      set({ edges: addEdge({ ...c, id: newId('w'), type: 'wire' }, get().edges) });
      bump();
    },

    addComponent: (type, pos) => {
      pushHistory();
      const id = newId(type);
      const nodes = get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
      const node: CNode = {
        id,
        type: 'comp',
        position: { x: snap(pos.x), y: snap(pos.y) },
        selected: true,
        data: { type, name: nextName(nodes, type), params: defaultParams(type), rot: 0 },
      };
      set({ nodes: [...nodes, node], selectedId: id });
      bump();
      return id;
    },

    updateParams: (id, params, commit = true) => {
      if (commit) pushHistory();
      const target = get().nodes.find((n) => n.id === id);
      set({
        nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n)),
      });
      // Osiloskop ayarları elektriksel değildir → yeniden derleme gerekmez
      if (target?.data.type !== 'scope') bump(false);
    },

    rename: (id, name) => {
      const clean = name.trim().replace(/\s+/g, '_');
      if (!clean || get().nodes.some((n) => n.id !== id && n.data.name === clean)) return;
      pushHistory();
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, name: clean } } : n)) });
      bump(false);
    },

    rotate: (id) => {
      const n = get().nodes.find((x) => x.id === id);
      if (!n || !LIBRARY[n.data.type].rotatable) return;
      pushHistory();
      set({ nodes: get().nodes.map((x) => (x.id === id ? { ...x, data: { ...x.data, rot: (x.data.rot + 90) % 360 } } : x)) });
      bump(false);
    },

    flip: (id) => {
      const n = get().nodes.find((x) => x.id === id);
      if (!n) return;
      const def = LIBRARY[n.data.type];
      if (def.pins.length !== 2) return;
      pushHistory();
      const [p0, p1] = def.pins.map((p) => p.id);
      const swap = (h?: string | null) => (h === p0 ? p1 : h === p1 ? p0 : h);
      const edges = get().edges.map((e) => ({
        ...e,
        sourceHandle: e.source === id ? swap(e.sourceHandle) : e.sourceHandle,
        targetHandle: e.target === id ? swap(e.targetHandle) : e.targetHandle,
      }));
      const nodes = get().nodes.map((x) => (x.id === id ? { ...x, data: { ...x.data, rot: (x.data.rot + 180) % 360 } } : x));
      set({ nodes, edges });
      bump();
    },

    toggleSwitch: (id) => {
      const n = get().nodes.find((x) => x.id === id);
      if (!n || n.data.type !== 'switch') return;
      get().updateParams(id, { closed: !n.data.params.closed });
    },

    remove: (ids) => {
      if (!ids.length) return;
      pushHistory();
      const set_ = new Set(ids);
      set({
        nodes: get().nodes.filter((n) => !set_.has(n.id)),
        edges: get().edges.filter((e) => !set_.has(e.source) && !set_.has(e.target) && !set_.has(e.id)),
        selectedId: set_.has(get().selectedId ?? '') ? null : get().selectedId,
      });
      bump();
    },

    select: (id) => {
      set({
        selectedId: id,
        nodes: get().nodes.map((n) => (n.selected !== (n.id === id) ? { ...n, selected: n.id === id } : n)),
      });
    },

    loadDoc: (doc, templateId = null) => {
      const { nodes, edges } = docToGraph(clone(doc));
      set({ nodes, edges, title: doc.title ?? 'Devre', templateId, selectedId: null, past: [], future: [] });
      bump();
    },

    clear: () => {
      pushHistory();
      set({ nodes: [], edges: [], title: 'Yeni devre', templateId: null, selectedId: null });
      bump();
    },

    toDoc: () => graphToDoc(get().nodes, get().edges, get().title),

    commit: pushHistory,

    undo: () => {
      const { past, nodes, edges, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ nodes: prev.nodes, edges: prev.edges, past: past.slice(0, -1), future: [{ nodes, edges }, ...future].slice(0, 60), selectedId: null });
      bump();
    },

    redo: () => {
      const { past, nodes, edges, future } = get();
      const next = future[0];
      if (!next) return;
      set({ nodes: next.nodes, edges: next.edges, future: future.slice(1), past: [...past, { nodes, edges }], selectedId: null });
      bump();
    },

    byName: (name) => get().nodes.find((n) => n.data.name.toLowerCase() === name.toLowerCase()),

    applyFix: (patch) => {
      const log: string[] = [];
      let ok = true;
      pushHistory();
      for (const a of patch.actions) {
        const node = get().byName(a.id);
        if (!node) {
          log.push(`✗ ${a.id} bulunamadı`);
          ok = false;
          continue;
        }
        switch (a.op) {
          case 'flip': {
            const def = LIBRARY[node.data.type];
            if (def.pins.length !== 2) {
              log.push(`✗ ${a.id} ters çevrilemez`);
              ok = false;
              break;
            }
            const [p0, p1] = def.pins.map((p) => p.id);
            const swap = (h?: string | null) => (h === p0 ? p1 : h === p1 ? p0 : h);
            set({
              edges: get().edges.map((e) => ({
                ...e,
                sourceHandle: e.source === node.id ? swap(e.sourceHandle) : e.sourceHandle,
                targetHandle: e.target === node.id ? swap(e.targetHandle) : e.targetHandle,
              })),
              nodes: get().nodes.map((x) => (x.id === node.id ? { ...x, data: { ...x.data, rot: (x.data.rot + 180) % 360 } } : x)),
            });
            log.push(`✓ ${a.id} ters çevrildi`);
            break;
          }
          case 'set': {
            const pdef = LIBRARY[node.data.type].params.find((p) => p.key === a.param);
            if (!pdef) {
              log.push(`✗ ${a.id} için '${a.param}' parametresi yok`);
              ok = false;
              break;
            }
            let v: ParamValue = a.value;
            if (pdef.kind === 'number') v = typeof v === 'number' ? v : parseFloat(String(v));
            if (pdef.kind === 'bool') v = v === true || v === 'true' || v === 1;
            set({ nodes: get().nodes.map((x) => (x.id === node.id ? { ...x, data: { ...x.data, params: { ...x.data.params, [a.param]: v } } } : x)) });
            log.push(`✓ ${a.id}.${a.param} = ${v}`);
            break;
          }
          case 'toggle': {
            set({
              nodes: get().nodes.map((x) =>
                x.id === node.id ? { ...x, data: { ...x.data, params: { ...x.data.params, closed: !x.data.params.closed } } } : x,
              ),
            });
            log.push(`✓ ${a.id} anahtarı değiştirildi`);
            break;
          }
          case 'remove': {
            set({
              nodes: get().nodes.filter((x) => x.id !== node.id),
              edges: get().edges.filter((e) => e.source !== node.id && e.target !== node.id),
            });
            log.push(`✓ ${a.id} silindi`);
            break;
          }
          case 'connectGround': {
            const def = LIBRARY[node.data.type];
            const pin = def.pins.find((p) => p.id === a.pin) ?? def.pins[def.pins.length - 1];
            const rp = rotatePin(def, pin, node.data.rot);
            const gx = node.position.x + rp.x - 20;
            const gy = node.position.y + rp.y + 40;
            const gid = newId('ground');
            const gnode: CNode = {
              id: gid,
              type: 'comp',
              position: { x: snap(gx), y: snap(gy) },
              data: { type: 'ground', name: nextName(get().nodes, 'ground'), params: {}, rot: 0 },
            };
            set({
              nodes: [...get().nodes, gnode],
              edges: [...get().edges, { id: newId('w'), type: 'wire', source: node.id, sourceHandle: pin.id, target: gid, targetHandle: 'g' }],
            });
            log.push(`✓ ${a.id}.${pin.label} ucuna toprak eklendi`);
            break;
          }
        }
      }
      bump();
      return { ok, log };
    },
  };
});
