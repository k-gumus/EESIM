// PCB pop-up: iki sekme — "Şema" (temiz şematik) ve "PCB" (footprint'ler + ratsnest).
// 3D görünümün yanında ayrı bir özellik; devreyi salt-görüntü olarak çizer, indirir.
import { useMemo, useRef, useState, type Ref } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { LIBRARY, rotatePin, rotatedSize } from '../circuit/library';
import type { CompData } from '../circuit/types';
import { useCircuit } from '../store/circuitStore';
import { Symbol } from './symbols';
import { buildPcb, GND_COLOR, type Footprint } from '../pcb/layout';
import { t } from '../i18n';

type Tab = 'schem' | 'pcb';
type CNode = Node<CompData>;

const BOX_TYPES = new Set(['multimeter', 'scope']); // sembol yerine basit kutu çizilenler

function pinXY(node: CNode, pin: string): { x: number; y: number } | null {
  const def = LIBRARY[node.data.type];
  const pd = def?.pins.find((p) => p.id === pin);
  if (!pd) return null;
  const rp = rotatePin(def, pd, node.data.rot ?? 0);
  return { x: node.position.x + rp.x, y: node.position.y + rp.y };
}

function rotTransform(w: number, h: number, rot: number): string | undefined {
  return rot === 90 ? `translate(${h} 0) rotate(90)` : rot === 180 ? `translate(${w} ${h}) rotate(180)` : rot === 270 ? `translate(0 ${w}) rotate(270)` : undefined;
}

// ───────────────────────── Şema sekmesi ─────────────────────────
function SchematicView({ nodes, edges, title, svgRef }: { nodes: CNode[]; edges: Edge[]; title: string; svgRef: Ref<SVGSVGElement> }) {
  const box = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const def = LIBRARY[n.data.type];
      if (!def) continue;
      const { w, h } = rotatedSize(def, n.data.rot ?? 0);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    if (!isFinite(minX)) return { x: 0, y: 0, w: 400, h: 300 };
    const M = 50;
    return { x: minX - M, y: minY - M, w: maxX - minX + 2 * M, h: maxY - minY + 2 * M };
  }, [nodes]);

  const wires = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out: { d: string; key: string }[] = [];
    for (const e of edges) {
      const sn = byId.get(e.source);
      const tn = byId.get(e.target);
      if (!sn || !tn) continue;
      const a = pinXY(sn, e.sourceHandle ?? '');
      const b = pinXY(tn, e.targetHandle ?? '');
      if (!a || !b) continue;
      // Manhattan L (yatay → dikey)
      out.push({ key: e.id, d: `M ${a.x} ${a.y} L ${b.x} ${a.y} L ${b.x} ${b.y}` });
    }
    return out;
  }, [nodes, edges]);

  const junctions = useMemo(() => {
    // 3+ kablonun buluştuğu pin konumlarında bağlantı noktası
    const count = new Map<string, { x: number; y: number; n: number }>();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const tally = (node: CNode | undefined, pin: string) => {
      if (!node) return;
      const p = pinXY(node, pin);
      if (!p) return;
      const k = `${p.x},${p.y}`;
      const c = count.get(k) ?? { x: p.x, y: p.y, n: 0 };
      c.n++;
      count.set(k, c);
    };
    for (const e of edges) {
      tally(byId.get(e.source), e.sourceHandle ?? '');
      tally(byId.get(e.target), e.targetHandle ?? '');
    }
    return [...count.values()].filter((c) => c.n >= 3);
  }, [nodes, edges]);

  return (
    <svg ref={svgRef} className="pcb-svg schem" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#ffffff" />
      <g stroke="#1b2a3a" strokeWidth={2} fill="none">
        {wires.map((w) => (
          <path key={w.key} d={w.d} />
        ))}
      </g>
      <g fill="#1b2a3a">
        {junctions.map((j, i) => (
          <circle key={i} cx={j.x} cy={j.y} r={3.5} />
        ))}
      </g>
      {nodes.map((n) => {
        const def = LIBRARY[n.data.type];
        if (!def) return null;
        const rot = n.data.rot ?? 0;
        if (BOX_TYPES.has(n.data.type)) {
          const { w, h } = rotatedSize(def, rot);
          return (
            <g key={n.id} transform={`translate(${n.position.x} ${n.position.y})`}>
              <rect x={0} y={0} width={w} height={h} rx={6} fill="#eef2f7" stroke="#1b2a3a" strokeWidth={1.5} />
              <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#1b2a3a">
                {n.data.type === 'scope' ? 'OSC' : 'DMM'}
              </text>
            </g>
          );
        }
        const isHidden = n.data.type === 'ground' || n.data.type === 'label';
        return (
          <g key={n.id} transform={`translate(${n.position.x} ${n.position.y})`} style={{ color: '#1b2a3a' }}>
            <g transform={rotTransform(def.w, def.h, rot)}>
              <Symbol type={n.data.type} params={n.data.params} />
            </g>
            {!isHidden && (
              <text x={rotatedSize(def, rot).w / 2} y={-6} textAnchor="middle" fontSize={11} fill="#51607a">
                {n.data.name}
              </text>
            )}
          </g>
        );
      })}
      <g>
        <rect x={box.x + box.w - 230} y={box.y + box.h - 54} width={218} height={42} rx={4} fill="#f7f9fc" stroke="#9fb0c8" />
        <text x={box.x + box.w - 220} y={box.y + box.h - 34} fontSize={13} fontWeight={700} fill="#1b2a3a">
          {title}
        </text>
        <text x={box.x + box.w - 220} y={box.y + box.h - 19} fontSize={10} fill="#6b7a93">
          EESIM · {new Date().toLocaleDateString('tr-TR')}
        </text>
      </g>
    </svg>
  );
}

// ───────────────────────── PCB sekmesi ─────────────────────────
function Pad({ p }: { p: Footprint['pads'][number] }) {
  const stroke = p.gnd ? GND_COLOR : '#8a6410';
  const sw = p.gnd ? 2 : 1;
  if (p.shape === 'rect') {
    return (
      <g>
        <rect x={p.x - 6} y={p.y - 6} width={12} height={12} rx={2} fill="#d9a441" stroke={stroke} strokeWidth={sw} />
        <circle cx={p.x} cy={p.y} r={2.4} fill="#1a1205" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={6} fill="#d9a441" stroke={stroke} strokeWidth={sw} />
      <circle cx={p.x} cy={p.y} r={2.4} fill="#1a1205" />
    </g>
  );
}

function BoardView({
  nodes,
  edges,
  svgRef,
  showRats,
  showSilk,
  netColor,
}: {
  nodes: CNode[];
  edges: Edge[];
  svgRef: Ref<SVGSVGElement>;
  showRats: boolean;
  showSilk: boolean;
  netColor: boolean;
}) {
  const pcb = useMemo(() => buildPcb(nodes, edges), [nodes, edges]);
  const { viewBox: vb } = pcb;
  // ızgara çizgileri (2.5 mm ~ 50 px görsel)
  const grid: number[] = [];
  for (let gx = Math.ceil(vb.x / 40) * 40; gx < vb.x + vb.w; gx += 40) grid.push(gx);
  const gridY: number[] = [];
  for (let gy = Math.ceil(vb.y / 40) * 40; gy < vb.y + vb.h; gy += 40) gridY.push(gy);

  return (
    <svg ref={svgRef} className="pcb-svg board" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} rx={10} fill="#0b5e3b" />
      <rect x={vb.x + 8} y={vb.y + 8} width={vb.w - 16} height={vb.h - 16} rx={8} fill="none" stroke="#0a7a4a" strokeWidth={2} />
      <g stroke="#0a7a4a" strokeWidth={0.5} opacity={0.5}>
        {grid.map((gx) => (
          <line key={`gx${gx}`} x1={gx} y1={vb.y} x2={gx} y2={vb.y + vb.h} />
        ))}
        {gridY.map((gy) => (
          <line key={`gy${gy}`} x1={vb.x} y1={gy} x2={vb.x + vb.w} y2={gy} />
        ))}
      </g>

      {showRats && (
        <g strokeWidth={1.2} strokeDasharray="4 3" opacity={0.95}>
          {pcb.rats.map((r, i) => (
            <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={netColor ? r.color : '#9fb0c8'} />
          ))}
        </g>
      )}

      {/* footprint gövdeleri (silkscreen) */}
      {showSilk &&
        pcb.footprints.map((f) => (
          <g key={`b${f.id}`}>
            <rect
              x={f.x + 2}
              y={f.y + 2}
              width={Math.max(10, f.w - 4)}
              height={Math.max(10, f.h - 4)}
              rx={4}
              fill={f.onBoard ? 'rgba(255,255,255,0.04)' : 'rgba(80,200,255,0.06)'}
              stroke={f.onBoard ? '#e9eef5' : '#67e8f9'}
              strokeWidth={1.2}
              strokeDasharray={f.onBoard ? undefined : '5 3'}
            />
            <text x={f.x + f.w / 2} y={f.y - 3} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e9eef5">
              {f.name}
            </text>
            {f.value && (
              <text x={f.x + f.w / 2} y={f.y + f.h + 12} textAnchor="middle" fontSize={9} fill="#b9c6d6">
                {f.value}
              </text>
            )}
          </g>
        ))}

      {/* pad'ler */}
      {pcb.footprints.map((f) => (
        <g key={`p${f.id}`}>
          {f.pads.map((p) => (
            <Pad key={p.pin} p={p} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// ───────────────────────── Modal ─────────────────────────
function serialize(svg: SVGSVGElement): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}
function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function savePng(svg: SVGSVGElement, name: string) {
  const xml = serialize(svg);
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  const img = new Image();
  img.onload = () => {
    const vbv = svg.viewBox.baseVal;
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vbv.width * scale));
    c.height = Math.max(1, Math.round(vbv.height * scale));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, vbv.width, vbv.height);
    c.toBlob((b) => b && downloadBlob(b, name), 'image/png');
  };
  img.src = url;
}

export function PcbModal({ onClose }: { onClose: () => void }) {
  const nodes = useCircuit((s) => s.nodes);
  const edges = useCircuit((s) => s.edges);
  const title = useCircuit((s) => s.title);
  const [tab, setTab] = useState<Tab>('schem');
  const [showRats, setShowRats] = useState(true);
  const [showSilk, setShowSilk] = useState(true);
  const [netColor, setNetColor] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const pcb = useMemo(() => (tab === 'pcb' ? buildPcb(nodes, edges) : null), [tab, nodes, edges]);

  const slug = title.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/g, '-').replace(/^-|-$/g, '') || 'devre';
  const empty = nodes.filter((n) => n.data.type !== 'ground' && n.data.type !== 'label').length === 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal pcb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="seg">
            <button className={tab === 'schem' ? 'on' : ''} onClick={() => setTab('schem')}>
              {t('Şema')}
            </button>
            <button className={tab === 'pcb' ? 'on' : ''} onClick={() => setTab('pcb')}>
              {t('PCB')}
            </button>
          </div>
          {tab === 'pcb' && (
            <div className="pcb-toggles">
              <label className={showRats ? 'on' : ''}>
                <input type="checkbox" checked={showRats} onChange={(e) => setShowRats(e.target.checked)} /> {t('Ratsnest')}
              </label>
              <label className={showSilk ? 'on' : ''}>
                <input type="checkbox" checked={showSilk} onChange={(e) => setShowSilk(e.target.checked)} /> {t('Baskı (silk)')}
              </label>
              <label className={netColor ? 'on' : ''}>
                <input type="checkbox" checked={netColor} onChange={(e) => setNetColor(e.target.checked)} /> {t('Net renkleri')}
              </label>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => svgRef.current && downloadBlob(new Blob([serialize(svgRef.current)], { type: 'image/svg+xml' }), `${slug}-${tab}.svg`)}>
            SVG
          </button>
          <button className="btn sm" onClick={() => svgRef.current && savePng(svgRef.current, `${slug}-${tab}.png`)}>
            PNG
          </button>
          <button className="iconbtn" onClick={onClose} title={t('Kapat')}>
            ✕
          </button>
        </div>

        <div className="pcb-body">
          {empty ? (
            <div className="pcb-empty">{t('Devre boş — önce paletten eleman ekle ya da hazır bir deney aç.')}</div>
          ) : tab === 'schem' ? (
            <SchematicView nodes={nodes} edges={edges} title={title} svgRef={svgRef} />
          ) : (
            <BoardView nodes={nodes} edges={edges} svgRef={svgRef} showRats={showRats} showSilk={showSilk} netColor={netColor} />
          )}
        </div>

        <div className="pcb-foot">
          {tab === 'pcb' ? (
            <>
              <span className="pcb-legend-item">
                <span className="sw" style={{ background: GND_COLOR }} /> GND ({t('zemin bakırı')})
              </span>
              {pcb?.nets
                .filter((n) => n.pads >= 2)
                .slice(0, 10)
                .map((n) => (
                  <span key={n.net} className="pcb-legend-item">
                    <span className="sw" style={{ background: n.color }} /> {n.name}
                  </span>
                ))}
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                {t('Pad’ler pin konumlarında; ince kesik çizgiler aynı net’teki pad’leri gösterir (ratsnest). GND zemin bakırı olduğundan çizilmez.')}
              </span>
            </>
          ) : (
            <span className="muted small">{t('Baskıya uygun temiz şema. SVG/PNG olarak indirip çıktı alabilir ya da sunumda kullanabilirsin.')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
