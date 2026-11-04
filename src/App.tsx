import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { TopBar, type Views } from './ui/TopBar';
import { Palette } from './ui/Palette';
import { CanvasView } from './ui/CanvasView';
import { Inspector } from './ui/Inspector';
import { Oscilloscope } from './ui/Oscilloscope';
import { LabPanel } from './ui/LabPanel';
import { CopilotPanel } from './ui/CopilotPanel';
import { TemplatesModal } from './ui/TemplatesModal';
import { NetlistModal } from './ui/NetlistModal';
import { TepecanToast } from './ui/TepecanToast';
import { useCircuit } from './store/circuitStore';
import { TEMPLATES } from './templates';

const Assembly3D = lazy(() => import('./three/Assembly3D').then((m) => ({ default: m.Assembly3D })));

type Tab = 'lab' | 'props' | 'ai';

function loadViews(): Views {
  try {
    return { three: false, scope: true, right: true, ...JSON.parse(localStorage.getItem('ieeesim.views') ?? '{}') };
  } catch {
    return { three: false, scope: true, right: true };
  }
}

export default function App() {
  const [views, setViewsState] = useState<Views>(loadViews);
  const setViews = (v: Views) => {
    setViewsState(v);
    try {
      localStorage.setItem('ieeesim.views', JSON.stringify(v));
    } catch {
      /* yok say */
    }
  };
  const [tab, setTab] = useState<Tab>('lab');
  const [tplOpen, setTplOpen] = useState<'first' | 'menu' | null>(() => {
    try {
      return localStorage.getItem('ieeesim.welcomed') === '1' ? null : 'first';
    } catch {
      return 'first';
    }
  });
  const [netOpen, setNetOpen] = useState(false);
  const selectedId = useCircuit((s) => s.selectedId);
  const hasScope = useCircuit((s) => s.nodes.some((n) => n.data.type === 'scope'));
  const [split, setSplit] = useState(0.5);
  const dragRef = useRef(false);

  // İlk açılış: Tepecan karşılama + ilk deneyi arka planda yükle
  useEffect(() => {
    const st = useCircuit.getState();
    if (!st.nodes.length) st.loadDoc(TEMPLATES[1].doc, TEMPLATES[1].id);
    try {
      localStorage.setItem('ieeesim.welcomed', '1');
    } catch {
      /* yok say */
    }
  }, []);

  // Eleman seçilince Özellikler sekmesine geç
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== lastSel.current && tab === 'lab') setTab('props');
    lastSel.current = selectedId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const el = document.querySelector('.workspace') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSplit(Math.min(0.8, Math.max(0.2, (e.clientX - r.left) / r.width)));
    };
    const up = () => (dragRef.current = false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <ReactFlowProvider>
      <div className={`app ${views.right ? '' : 'no-right'}`}>
        <TopBar views={views} setViews={setViews} onTemplates={() => setTplOpen('menu')} onNetlist={() => setNetOpen(true)} />
        <div className="main">
          <Palette />
          <div className="center">
            <div className="workspace">
              <div className="pane" style={{ flexBasis: views.three ? `${split * 100}%` : '100%' }}>
                <CanvasView />
              </div>
              {views.three && (
                <>
                  <div className="splitter" onPointerDown={() => (dragRef.current = true)} />
                  <div className="pane" style={{ flexBasis: `${(1 - split) * 100}%` }}>
                    <Suspense fallback={<div className="three-loading">3D sahne yükleniyor…</div>}>
                      <Assembly3D />
                    </Suspense>
                  </div>
                </>
              )}
            </div>
            {views.scope && (
              <div className={`scope-drawer ${hasScope ? '' : 'empty'}`}>
                <Oscilloscope />
              </div>
            )}
          </div>
          {views.right && (
            <aside className="right">
              <nav className="tabs">
                <button className={tab === 'lab' ? 'on' : ''} onClick={() => setTab('lab')}>
                  🧪 Deney
                </button>
                <button className={tab === 'props' ? 'on' : ''} onClick={() => setTab('props')}>
                  ⚙ Özellikler
                </button>
                <button className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>
                  🤖 Tepecan AI
                </button>
              </nav>
              <div className="tab-body">
                {tab === 'lab' && <LabPanel onOpenTemplates={() => setTplOpen('menu')} />}
                {tab === 'props' && <Inspector />}
                {tab === 'ai' && <CopilotPanel />}
              </div>
            </aside>
          )}
        </div>
        <TepecanToast />
        {tplOpen && <TemplatesModal first={tplOpen === 'first'} onClose={() => setTplOpen(null)} />}
        {netOpen && <NetlistModal onClose={() => setNetOpen(false)} />}
      </div>
    </ReactFlowProvider>
  );
}
