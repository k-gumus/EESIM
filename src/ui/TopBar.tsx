import { useRef } from 'react';
import { runner, useSim } from '../sim/runner';
import { useCircuit } from '../store/circuitStore';
import { useProgress, levelOf } from '../gamify/progress';
import { FACES, tepecan } from '../tepecan/mascot';
import { formatSI } from '../circuit/format';
import { download } from './NetlistModal';
import type { CircuitDoc } from '../circuit/types';

export interface Views {
  three: boolean;
  scope: boolean;
  right: boolean;
}

export function TopBar({
  views,
  setViews,
  onTemplates,
  onNetlist,
}: {
  views: Views;
  setViews: (v: Views) => void;
  onTemplates: () => void;
  onNetlist: () => void;
}) {
  const status = useSim((s) => s.status);
  const t = useSim((s) => s.t);
  const speed = useSim((s) => s.speed);
  const lagging = useSim((s) => s.lagging);
  const showValues = useSim((s) => s.showValues);
  const title = useCircuit((s) => s.title);
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const { level, pct } = levelOf(xp);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = status === 'running';
  const active = status === 'running' || status === 'paused';

  const save = () => {
    const doc = useCircuit.getState().toDoc();
    download(`${title.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/g, '-') || 'devre'}.ieeesim.json`, JSON.stringify(doc, null, 2), 'application/json');
  };
  const load = (f: File) => {
    f.text().then((txt) => {
      try {
        const doc = JSON.parse(txt) as CircuitDoc;
        if (!Array.isArray(doc.components) || !Array.isArray(doc.wires)) throw new Error('format');
        runner.stop();
        useCircuit.getState().loadDoc(doc, null);
        tepecan.say({ mood: 'success', title: 'Devre yüklendi', text: `“${doc.title ?? f.name}” açıldı.`, ttl: 3000 });
      } catch {
        tepecan.say({ mood: 'error', title: 'Dosya okunamadı', text: 'Bu bir IEEESIM JSON devre dosyası gibi görünmüyor.', ttl: 5000 });
      }
    });
  };

  return (
    <header className="topbar">
      <div className="brand">
        <img src={FACES.bust} alt="Tepecan" />
        <div>
          <div className="brand-name">
            IEEE<span>SIM</span>
          </div>
          <div className="brand-sub">Tepecan Devre Laboratuvarı</div>
        </div>
      </div>

      <button className="btn ghost" onClick={onTemplates}>
        📚 Deneyler
      </button>
      <div className="doc-title" title={title}>
        {title}
      </div>

      <div className="sim-ctrl">
        {running ? (
          <button className="btn run on" onClick={() => runner.pause()}>
            ❚❚ Duraklat
          </button>
        ) : (
          <button className="btn run" onClick={() => (status === 'paused' ? runner.resume() : runner.start())}>
            ▶ {status === 'paused' ? 'Devam' : 'Başlat'}
          </button>
        )}
        <button className="btn icon" disabled={!active && status !== 'error'} onClick={() => runner.stop()} title="Durdur">
          ■
        </button>
        <button className="btn icon" disabled={!active} onClick={() => runner.restart()} title="Baştan başlat (t = 0)">
          ↺
        </button>
        <select value={speed} onChange={(e) => useSim.setState({ speed: Number(e.target.value) })} title="Simülasyon hızı (ağır çekim)">
          {[0.1, 0.25, 0.5, 1, 2, 4].map((s) => (
            <option key={s} value={s}>
              {String(s).replace('.', ',')}×
            </option>
          ))}
        </select>
        <span className={`sim-status ${status}`}>
          <i />
          {status === 'running' ? `t = ${formatSI(t, 's')}` : status === 'paused' ? 'Duraklatıldı' : status === 'error' ? 'Hata' : 'Hazır'}
          {lagging && running && <em title="Bilgisayar istenen hızda hesaplayamıyor; simülasyon yavaşladı"> · yavaş</em>}
        </span>
      </div>

      <div className="views">
        <button className={`toggle-btn ${views.three ? 'on' : ''}`} onClick={() => setViews({ ...views, three: !views.three })}>
          🧊 3D Montaj
        </button>
        <button className={`toggle-btn ${views.scope ? 'on' : ''}`} onClick={() => setViews({ ...views, scope: !views.scope })}>
          〰 Osiloskop
        </button>
        <button className={`toggle-btn ${showValues ? 'on' : ''}`} onClick={() => useSim.setState({ showValues: !showValues })} title="Canvas üzerinde canlı akım değerleri">
          ⓘ Değerler
        </button>
      </div>

      <div className="file-btns">
        <button className="btn ghost sm" onClick={onNetlist} title="SPICE netlist / JSON">
          ⟨/⟩ Netlist
        </button>
        <button className="btn ghost sm" onClick={save} title="Devreyi JSON olarak indir">
          ⬇ Kaydet
        </button>
        <button className="btn ghost sm" onClick={() => fileRef.current?.click()} title="JSON devre dosyası aç">
          ⬆ Aç
        </button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </div>

      <div className="xp" title={`${xp} XP · ${streak} günlük seri`}>
        <span className="streak">🔥 {streak}</span>
        <div className="xp-lvl">
          <span>Sv. {level}</span>
          <div className="progress thin">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="xp-n">⚡{xp}</span>
      </div>
      <button className={`btn icon ${views.right ? 'on' : ''}`} onClick={() => setViews({ ...views, right: !views.right })} title="Sağ paneli aç/kapat">
        ☰
      </button>
    </header>
  );
}
