import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CATEGORIES, LIB_LIST, type CompDef } from '../circuit/library';
import { Symbol } from './symbols';
import { useCircuit } from '../store/circuitStore';
import { useUI } from '../store/uiStore';

function Icon({ def }: { def: CompDef }) {
  if (def.type === 'multimeter')
    return (
      <svg viewBox="0 0 40 40" width={34} height={34}>
        <rect x={7} y={4} width={26} height={32} rx={4} fill="#f2b705" opacity={0.9} />
        <rect x={11} y={8} width={18} height={9} rx={1.5} fill="#9fd3a8" />
        <circle cx={15} cy={30} r={2.4} fill="#e33" />
        <circle cx={25} cy={30} r={2.4} fill="#111" />
      </svg>
    );
  if (def.type === 'scope')
    return (
      <svg viewBox="0 0 40 40" width={34} height={34}>
        <rect x={3} y={7} width={34} height={26} rx={3} fill="#2b3550" />
        <rect x={6} y={10} width={20} height={16} rx={1} fill="#0a1120" />
        <path d="M6 20 C9 12 12 12 14 18 S20 26 26 16" stroke="#f5d90a" fill="none" strokeWidth={1.4} />
        <circle cx={31} cy={14} r={2} fill="#8ba0c8" />
        <circle cx={31} cy={22} r={2} fill="#8ba0c8" />
      </svg>
    );
  // Sembolü 52×34'lük kutuya en-boy oranını koruyarak sığdır
  const pad = 4;
  const W = 52;
  const H = 34;
  const bw = def.w + pad * 2;
  const bh = def.h + pad * 2;
  const scale = Math.max(bw / W, bh / H);
  const vw = W * scale;
  const vh = H * scale;
  return (
    <svg viewBox={`${-(vw - def.w) / 2} ${-(vh - def.h) / 2} ${vw} ${vh}`} width={W} height={H} style={{ color: 'var(--sym)' }}>
      <Symbol type={def.type} params={Object.fromEntries(def.params.map((p) => [p.key, p.default]))} />
    </svg>
  );
}

export function Palette() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const add = useCircuit((s) => s.addComponent);
  const rf = useReactFlow();

  const addCenter = (def: CompDef) => {
    const el = document.querySelector('.canvas-wrap');
    const r = el?.getBoundingClientRect();
    const p = rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 800) / 2, y: (r?.top ?? 0) + (r?.height ?? 600) / 2 });
    add(def.type, { x: p.x - def.w / 2 + (Math.random() * 60 - 30), y: p.y - def.h / 2 + (Math.random() * 60 - 30) });
  };

  const query = q.trim().toLocaleLowerCase('tr');
  return (
    <aside className="palette">
      <div className="palette-head">
        <span>Elemanlar</span>
      </div>
      <input className="palette-search" placeholder="Ara: direnç, diyot…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="palette-scroll">
        {CATEGORIES.map((cat) => {
          const items = LIB_LIST.filter(
            (d) => d.category === cat.id && (!query || d.label.toLocaleLowerCase('tr').includes(query) || d.short.toLowerCase().includes(query)),
          );
          if (!items.length) return null;
          const isOpen = query ? true : open[cat.id] !== false;
          return (
            <section key={cat.id} className="pal-cat">
              <button className="pal-cat-head" onClick={() => setOpen({ ...open, [cat.id]: !isOpen })}>
                <span className={`chev ${isOpen ? 'open' : ''}`}>›</span>
                {cat.id}
                <span className="pal-count">{items.length}</span>
              </button>
              {isOpen && (
                <div className="pal-grid">
                  {items.map((d) => (
                    <button
                      key={d.type}
                      className="pal-item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/ieeesim', d.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => addCenter(d)}
                      title={`${d.label} — ${d.description}\n(Sürükle ya da tıkla · ⓘ bilgi kartı)`}
                    >
                      <Icon def={d} />
                      <span>{d.label}</span>
                      <span
                        className="pal-info"
                        role="button"
                        title="Bilgi kartı: nasıl çalışır, tipik değerler, datasheet"
                        onClick={(e) => {
                          e.stopPropagation();
                          useUI.getState().showInfo(d.type);
                        }}
                      >
                        i
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="palette-tips">
        <div><kbd>R</kbd> döndür · <kbd>F</kbd> ters çevir</div>
        <div><kbd>Del</kbd> sil · <kbd>Ctrl</kbd>+<kbd>Z</kbd> geri al</div>
        <div>Anahtar: çift tıkla / <kbd>Space</kbd></div>
      </div>
    </aside>
  );
}
