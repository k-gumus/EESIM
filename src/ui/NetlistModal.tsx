import { useMemo, useState } from 'react';
import { compileCircuit } from '../circuit/compile';
import { buildSpiceNetlist } from '../circuit/spice';
import { useCircuit } from '../store/circuitStore';

function download(name: string, text: string, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function NetlistModal({ onClose }: { onClose: () => void }) {
  const nodes = useCircuit((s) => s.nodes);
  const edges = useCircuit((s) => s.edges);
  const title = useCircuit((s) => s.title);
  const toDoc = useCircuit((s) => s.toDoc);
  const [tab, setTab] = useState<'spice' | 'json'>('spice');
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    if (tab === 'json') return JSON.stringify(toDoc(), null, 2);
    return buildSpiceNetlist(compileCircuit(nodes, edges), nodes, title);
  }, [tab, nodes, edges, title, toDoc]);

  const slug = title.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/g, '-');
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal netlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="seg">
            <button className={tab === 'spice' ? 'on' : ''} onClick={() => setTab('spice')}>
              SPICE netlist
            </button>
            <button className={tab === 'json' ? 'on' : ''} onClick={() => setTab('json')}>
              JSON şablon
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="btn sm"
            onClick={() => {
              navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? '✓ Kopyalandı' : 'Kopyala'}
          </button>
          <button className="btn sm" onClick={() => download(tab === 'spice' ? `${slug}.cir` : `${slug}.json`, text, tab === 'json' ? 'application/json' : 'text/plain')}>
            İndir
          </button>
          <button className="iconbtn" onClick={onClose}>
            ✕
          </button>
        </div>
        <pre className="netlist-pre">{text}</pre>
        <div className="muted small" style={{ padding: '0 16px 14px' }}>
          {tab === 'spice'
            ? 'Bu netlist ngspice ve LTspice ile doğrudan çalıştırılabilir. Tepecan da devreni bu metinden okur.'
            : 'JSON şablon biçimi: hazır deney paketleri bu formatta saklanır. Kaydedip daha sonra “Aç” ile yükleyebilirsin.'}
        </div>
      </div>
    </div>
  );
}

export { download };
