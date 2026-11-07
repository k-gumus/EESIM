// PCB pop-up: iki sekme — "Şema" (temiz şematik) ve "PCB" (gerber / 2 katman: footprint + 45° izler + GND düzlemi).
// 3D görünümün yanında ayrı bir özellik; devreyi salt-görüntü olarak çizer, indirir.
import { useMemo, useRef, useState, type Ref } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { LIBRARY, rotatePin, rotatedSize } from '../circuit/library';
import type { CompData } from '../circuit/types';
import { useCircuit } from '../store/circuitStore';
import { Symbol } from './symbols';
import { buildPcb, type Footprint } from '../pcb/layout';
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

// ───────────────────────── PCB sekmesi (gerber / 2 katman) ─────────────────────────
const F_CU = '#cf4a3a'; // üst bakır — sinyal izleri
const B_CU = '#2bb3a3'; // alt bakır — GND zemin düzlemi
const SILK = '#e6d75a'; // serigrafi (sarı)
const BOARD = '#0a0a0c'; // kart zemini (koyu)

/** İki pad arasını 45° yönlendirilmiş izle bağla (düz → 45° köşe) */
function route45(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 0.5 || ady < 0.5) return `M ${x1} ${y1} L ${x2} ${y2}`;
  if (adx > ady) {
    const mx = x1 + Math.sign(dx) * (adx - ady);
    return `M ${x1} ${y1} L ${mx} ${y1} L ${x2} ${y2}`;
  }
  const my = y1 + Math.sign(dy) * (ady - adx);
  return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${y2}`;
}

function Pad({ p }: { p: Footprint['pads'][number] }) {
  const ring = p.gnd ? B_CU : F_CU; // GND → alt bakır (teal), sinyal → üst bakır (kırmızı)
  if (p.shape === 'rect') {
    return (
      <g>
        <rect x={p.x - 7} y={p.y - 7} width={14} height={14} rx={2} fill="#caa23a" stroke={ring} strokeWidth={1.8} />
        <circle cx={p.x} cy={p.y} r={2.6} fill={BOARD} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={7.5} fill="#caa23a" stroke={ring} strokeWidth={1.8} />
      <circle cx={p.x} cy={p.y} r={2.6} fill={BOARD} />
    </g>
  );
}

function BoardView({
  nodes,
  edges,
  svgRef,
  showTraces,
  showSilk,
  showPlane,
}: {
  nodes: CNode[];
  edges: Edge[];
  svgRef: Ref<SVGSVGElement>;
  showTraces: boolean;
  showSilk: boolean;
  showPlane: boolean;
}) {
  const pcb = useMemo(() => buildPcb(nodes, edges), [nodes, edges]);
  const { viewBox: vb } = pcb;
  const grid: number[] = [];
  for (let gx = Math.ceil(vb.x / 40) * 40; gx < vb.x + vb.w; gx += 40) grid.push(gx);
  const gridY: number[] = [];
  for (let gy = Math.ceil(vb.y / 40) * 40; gy < vb.y + vb.h; gy += 40) gridY.push(gy);

  return (
    <svg ref={svgRef} className="pcb-svg board" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} rx={8} fill={BOARD} />
      {/* B.Cu: GND zemin düzlemi (alt bakır) */}
      {showPlane && (
        <rect x={vb.x + 10} y={vb.y + 10} width={vb.w - 20} height={vb.h - 20} rx={6} fill={B_CU} fillOpacity={0.12} stroke={B_CU} strokeOpacity={0.5} strokeWidth={1} />
      )}
      {/* ince ızgara */}
      <g stroke="#1b1b22" strokeWidth={0.5}>
        {grid.map((gx) => (
          <line key={`gx${gx}`} x1={gx} y1={vb.y} x2={gx} y2={vb.y + vb.h} />
        ))}
        {gridY.map((gy) => (
          <line key={`gy${gy}`} x1={vb.x} y1={gy} x2={vb.x + vb.w} y2={gy} />
        ))}
      </g>
      {/* Edge.Cuts (kart kenarı) */}
      <rect x={vb.x + 4} y={vb.y + 4} width={vb.w - 8} height={vb.h - 8} rx={7} fill="none" stroke="#9a8f1c" strokeOpacity={0.6} strokeWidth={1} />

      {/* F.Cu: sinyal izleri (45° yönlendirilmiş, üst bakır) */}
      {showTraces && (
        <g stroke={F_CU} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95}>
          {pcb.rats.map((r, i) => (
            <path key={i} d={route45(r.x1, r.y1, r.x2, r.y2)} />
          ))}
        </g>
      )}

      {/* serigrafi (silkscreen) */}
      {showSilk &&
        pcb.footprints.map((f) => (
          <g key={`b${f.id}`}>
            <rect
              x={f.x + 2}
              y={f.y + 2}
              width={Math.max(10, f.w - 4)}
              height={Math.max(10, f.h - 4)}
              rx={4}
              fill="none"
              stroke={f.onBoard ? SILK : '#67e8f9'}
              strokeOpacity={0.9}
              strokeWidth={1}
              strokeDasharray={f.onBoard ? undefined : '5 3'}
            />
            <text x={f.x + f.w / 2} y={f.y - 3} textAnchor="middle" fontSize={11} fontWeight={700} fill={SILK}>
              {f.name}
            </text>
            {f.value && (
              <text x={f.x + f.w / 2} y={f.y + f.h + 12} textAnchor="middle" fontSize={9} fill="#b8ad55">
                {f.value}
              </text>
            )}
          </g>
        ))}

      {/* pad'ler (delikli; GND pad'leri alt düzleme iner) */}
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
  const [showTraces, setShowTraces] = useState(true);
  const [showSilk, setShowSilk] = useState(true);
  const [showPlane, setShowPlane] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

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
              <label className={showTraces ? 'on' : ''}>
                <input type="checkbox" checked={showTraces} onChange={(e) => setShowTraces(e.target.checked)} /> {t('İzler')}
              </label>
              <label className={showSilk ? 'on' : ''}>
                <input type="checkbox" checked={showSilk} onChange={(e) => setShowSilk(e.target.checked)} /> {t('Baskı (silk)')}
              </label>
              <label className={showPlane ? 'on' : ''}>
                <input type="checkbox" checked={showPlane} onChange={(e) => setShowPlane(e.target.checked)} /> {t('Zemin düzlemi')}
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
            <BoardView nodes={nodes} edges={edges} svgRef={svgRef} showTraces={showTraces} showSilk={showSilk} showPlane={showPlane} />
          )}
        </div>

        <div className="pcb-foot">
          {tab === 'pcb' ? (
            <>
              <span className="pcb-legend-item">
                <span className="sw" style={{ background: F_CU }} /> F.Cu ({t('sinyal')})
              </span>
              <span className="pcb-legend-item">
                <span className="sw" style={{ background: B_CU }} /> B.Cu ({t('GND düzlemi')})
              </span>
              <span className="muted small" style={{ marginLeft: 'auto' }}>
                {t('F.Cu (kırmızı): sinyal izleri 45° yönlendirildi. B.Cu (teal): GND zemin düzlemi — delikli pad’ler her iki katmana da iner.')}
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
