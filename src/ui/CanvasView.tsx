import { useCallback, useEffect, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import { useCircuit } from '../store/circuitStore';
import { ComponentNode } from './nodes/ComponentNode';
import { WireEdge } from './edges/WireEdge';
import type { CompType } from '../circuit/types';
import { LIBRARY } from '../circuit/library';

const nodeTypes: NodeTypes = { comp: ComponentNode };
const edgeTypes: EdgeTypes = { wire: WireEdge };

/** Tuval üstü araç çubuğu: Geri al / Yinele / Sil — dokunmatikte (klavyesiz) de erişilebilir olsun */
function CanvasToolbar() {
  const canUndo = useCircuit((s) => s.past.length > 0);
  const canRedo = useCircuit((s) => s.future.length > 0);
  const hasSel = useCircuit((s) => !!s.selectedId);
  return (
    <div className="canvas-toolbar">
      <button className="ctbtn" onClick={() => useCircuit.getState().undo()} disabled={!canUndo} title="Geri al (Ctrl+Z)" aria-label="Geri al">
        ↶
      </button>
      <button className="ctbtn" onClick={() => useCircuit.getState().redo()} disabled={!canRedo} title="Yinele (Ctrl+Y)" aria-label="Yinele">
        ↷
      </button>
      <button
        className="ctbtn danger"
        onClick={() => {
          const id = useCircuit.getState().selectedId;
          if (id) useCircuit.getState().remove([id]);
        }}
        disabled={!hasSel}
        title="Seçili elemanı sil (Del)"
        aria-label="Seçili elemanı sil"
      >
        🗑
      </button>
    </div>
  );
}

export function CanvasView() {
  const nodes = useCircuit((s) => s.nodes);
  const edges = useCircuit((s) => s.edges);
  const onNodesChange = useCircuit((s) => s.onNodesChange);
  const onEdgesChange = useCircuit((s) => s.onEdgesChange);
  const onConnect = useCircuit((s) => s.onConnect);
  const addComponent = useCircuit((s) => s.addComponent);
  const version = useCircuit((s) => s.topoVersion);
  const templateId = useCircuit((s) => s.templateId);
  const rf = useReactFlow();
  const wrap = useRef<HTMLDivElement>(null);

  // Yeni şablon yüklendiğinde görünüme sığdır
  const lastTpl = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastTpl.current !== templateId) {
      lastTpl.current = templateId;
      setTimeout(() => rf.fitView({ padding: 0.18, duration: 400, maxZoom: 1.25 }), 60);
    }
  }, [templateId, version, rf]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/ieeesim') as CompType;
      if (!type || !LIBRARY[type]) return;
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const def = LIBRARY[type];
      addComponent(type, { x: pos.x - def.w / 2, y: pos.y - def.h / 2 });
    },
    [rf, addComponent],
  );

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useCircuit.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && st.selectedId) {
        st.rotate(st.selectedId);
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && st.selectedId) {
        st.flip(st.selectedId);
      } else if (e.key === ' ' && st.selectedId) {
        const n = st.nodes.find((x) => x.id === st.selectedId);
        if (n?.data.type === 'switch') {
          e.preventDefault();
          st.toggleSwitch(n.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="canvas-wrap" ref={wrap} onDragOver={onDragOver} onDrop={onDrop}>
      <CanvasToolbar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Step}
        connectionRadius={22}
        snapToGrid
        snapGrid={[20, 20]}
        zoomOnDoubleClick={false}
        deleteKeyCode={['Delete', 'Backspace']}
        defaultEdgeOptions={{ type: 'wire' }}
        minZoom={0.25}
        maxZoom={3}
        onPaneClick={() => useCircuit.getState().select(null)}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--grid)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="canvas-empty">
          <div>Soldaki paletten eleman sürükle</div>
          <div className="muted">ya da üstteki <b>Deney bul</b> kutusundan hazır bir deney yükle</div>
        </div>
      )}
    </div>
  );
}
