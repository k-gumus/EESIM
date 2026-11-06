// Üst bar: Logo | Dosya | Deney bul | açık deney | Simülasyon araçları | XP | kullanıcı
import { useEffect, useRef, useState } from 'react';
import { runner, useSim } from '../sim/runner';
import { useCircuit } from '../store/circuitStore';
import { useUI } from '../store/uiStore';
import { useProgress, levelOf } from '../gamify/progress';
import { FACES, tepecan } from '../tepecan/mascot';
import { formatSI } from '../circuit/format';
import { download } from './NetlistModal';
import { compileCircuit } from '../circuit/compile';
import { buildSpiceNetlist } from '../circuit/spice';
import type { CircuitDoc } from '../circuit/types';
import { searchCatalog, type CatalogEntry } from '../templates/catalog';
import { topicById } from '../templates/topics';
import { templateById } from '../templates';
import { UserMenu } from './UserMenu';
import { t } from '../i18n';
import { entryTitle, tLevel, topicTitle } from '../i18n/content';

const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/[^a-z0-9ğüşöçı]+/g, '-').replace(/^-|-$/g, '') || 'devre';

export function openEntry(e: CatalogEntry) {
  if (!e.template) {
    useUI.getState().openCatalog('menu', e.topic);
    tepecan.say({ mood: 'info', title: t('Bu deney yakında!'), text: t('“{x}” katalogda listeleniyor; etkileşimli föyü henüz hazır değil.', { x: entryTitle(e) }), ttl: 4500 });
    return;
  }
  runner.stop();
  useCircuit.getState().loadDoc(e.template.doc, e.template.id);
  useUI.getState().setTab('lab');
}

function FileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const title = useCircuit((s) => s.title);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const save = () => {
    const doc = useCircuit.getState().toDoc();
    download(`${slug(title)}.eesim.json`, JSON.stringify(doc, null, 2), 'application/json');
  };
  const exportNetlist = () => {
    const { nodes, edges } = useCircuit.getState();
    download(`${slug(title)}.cir`, buildSpiceNetlist(compileCircuit(nodes, edges), nodes, title));
  };
  const load = (f: File) => {
    f.text().then((txt) => {
      try {
        const doc = JSON.parse(txt) as CircuitDoc;
        if (!Array.isArray(doc.components) || !Array.isArray(doc.wires)) throw new Error('format');
        runner.stop();
        useCircuit.getState().loadDoc(doc, null);
        tepecan.say({ mood: 'success', title: t('Devre yüklendi'), text: t('“{x}” açıldı.', { x: doc.title ?? f.name }), ttl: 3000 });
      } catch {
        tepecan.say({ mood: 'error', title: t('Dosya okunamadı'), text: t('Bu bir EESIM devre dosyası (.json) gibi görünmüyor.'), ttl: 5000 });
      }
    });
  };
  const item = (label: string, kbd: string | null, fn: () => void) => (
    <button
      className="menu-item"
      onClick={() => {
        setOpen(false);
        fn();
      }}
    >
      <span>{t(label)}</span>
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );

  // Kısayollar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        save();
      } else if (k === 'o') {
        e.preventDefault();
        fileRef.current?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return (
    <div className="menu" ref={ref}>
      <button className={`btn ghost ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} data-tour="file">
        📁<span className="fm-label"> {t('Dosya')}</span> <span className="caret">▾</span>
      </button>
      {open && (
        <div className="menu-pop">
          {item('Yeni devre', null, () => {
            runner.stop();
            useCircuit.getState().clear();
          })}
          {item('Aç… (.json)', 'Ctrl+O', () => fileRef.current?.click())}
          {item('Kaydet (.json)', 'Ctrl+S', save)}
          <div className="menu-sep" />
          {item('Netlist’i görüntüle', null, () => useUI.getState().setNetlist(true))}
          {item('SPICE netlist indir (.cir)', null, exportNetlist)}
          <div className="menu-sep" />
          {item('Deney kataloğu', 'Ctrl+K', () => useUI.getState().openCatalog('menu'))}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && (load(e.target.files[0]), (e.target.value = ''))} />
    </div>
  );
}

function ExperimentSearch() {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchCatalog(q, 9);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setSel(0), [q]);

  const choose = (e: CatalogEntry) => {
    setQ('');
    inputRef.current?.blur();
    openEntry(e);
  };

  return (
    <div className="exp-search" data-tour="search">
      <span className="exp-search-ico">🔍</span>
      <input
        ref={inputRef}
        value={q}
        placeholder={t('Deney bul… (doğrultucu, op-amp, 555, RC…)')}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel(Math.min(results.length - 1, sel + 1)));
          if (e.key === 'ArrowUp') (e.preventDefault(), setSel(Math.max(0, sel - 1)));
          if (e.key === 'Enter') {
            if (results[sel]) choose(results[sel]);
            else useUI.getState().openCatalog('menu');
          }
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
      />
      <kbd className="exp-search-kbd">Ctrl K</kbd>
      {focus && (
        <div className="exp-results">
          {q.trim() === '' ? (
            <button className="exp-res all" onMouseDown={() => useUI.getState().openCatalog('menu')}>
              📚 {t('Tüm deneyleri konu başlıklarına göre gör')}
            </button>
          ) : results.length ? (
            results.map((r, i) => (
              <button key={r.id} className={`exp-res ${i === sel ? 'sel' : ''}`} onMouseDown={() => choose(r)} onMouseEnter={() => setSel(i)}>
                <span className="exp-res-topic">{topicById(r.topic)?.icon}</span>
                <span className="exp-res-main">
                  <b>{entryTitle(r)}</b>
                  <small>
                    {topicTitle(r.topic)} · {tLevel(r.level)}
                    {!r.template && ` · ${t('yakında')}`}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <div className="exp-res empty">{t('“{q}” için deney bulunamadı.', { q })}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ExperimentChip() {
  const templateId = useCircuit((s) => s.templateId);
  const title = useCircuit((s) => s.title);
  const tpl = templateById(templateId);
  const done = useProgress((s) => (tpl ? s.done[tpl.id]?.length ?? 0 : 0));
  if (!tpl) {
    return (
      <div className="exp-chip free" title={title}>
        <span className="muted small">{t('Serbest çalışma')}</span>
        <b>{title}</b>
      </div>
    );
  }
  return (
    <button className="exp-chip" onClick={() => useUI.getState().setTab('lab')} title={t('Deney föyünü aç')} data-tour="chip">
      <span className="muted small">
        {topicById(tpl.topic)?.icon} {topicTitle(tpl.topic)}
      </span>
      <b>{entryTitle(tpl)}</b>
      <span className="exp-chip-prog">
        <i style={{ width: `${(done / tpl.steps.length) * 100}%` }} />
      </span>
    </button>
  );
}

function SimTools() {
  const status = useSim((s) => s.status);
  const simT = useSim((s) => s.t);
  const speed = useSim((s) => s.speed);
  const lagging = useSim((s) => s.lagging);
  const showValues = useSim((s) => s.showValues);
  const views = useUI((s) => s.views);
  const setViews = useUI((s) => s.setViews);
  const running = status === 'running';
  const active = status === 'running' || status === 'paused';
  return (
    <div className="simtools" data-tour="simtools">
      <span className="simtools-label">{t('Simülasyon')}</span>
      {running ? (
        <button className="btn run on" onClick={() => runner.pause()} data-tour="run">
          ❚❚ {t('Duraklat')}
        </button>
      ) : (
        <button className="btn run" onClick={() => (status === 'paused' ? runner.resume() : runner.start())} data-tour="run">
          ▶ {status === 'paused' ? t('Devam') : t('Başlat')}
        </button>
      )}
      <button className="btn icon" disabled={!active && status !== 'error'} onClick={() => runner.stop()} title={t('Durdur')} data-sim="stop">
        ■
      </button>
      <button className="btn icon" disabled={!active} onClick={() => runner.restart()} title={t('Baştan başlat (t = 0)')} data-sim="restart">
        ↺
      </button>
      <select value={speed} onChange={(e) => useSim.setState({ speed: Number(e.target.value) })} title={t('Simülasyon hızı (ağır çekim)')}>
        {[0.1, 0.25, 0.5, 1, 2, 4].map((s) => (
          <option key={s} value={s}>
            {String(s).replace('.', ',')}×
          </option>
        ))}
      </select>
      <span className={`sim-status ${status}`} title={lagging ? t('Bilgisayar istenen hızda hesaplayamıyor; simülasyon yavaşladı') : undefined}>
        <i />
        <span className="ss-text">
          {status === 'running' ? `${formatSI(simT, 's')}` : status === 'paused' ? t('Duraklatıldı') : status === 'error' ? t('Hata') : t('Hazır')}
          {lagging && running && <em> · {t('yavaş')}</em>}
        </span>
      </span>
      <span className="simtools-sep" />
      <button className={`toggle-btn ${views.three ? 'on' : ''}`} onClick={() => setViews({ three: !views.three })} data-tour="three">
        🧊 <span className="tl">{t('3D Görünüm')}</span>
      </button>
      <button className={`toggle-btn ${views.scope ? 'on' : ''}`} onClick={() => setViews({ scope: !views.scope })} data-tour="scope">
        〰 <span className="tl">{t('Osiloskop')}</span>
      </button>
      <button className={`toggle-btn ${showValues ? 'on' : ''}`} onClick={() => useSim.setState({ showValues: !showValues })} title={t('Canvas üzerinde canlı akım/gerilim değerleri')}>
        ⓘ <span className="tl">{t('Değer Okuma')}</span>
      </button>
    </div>
  );
}

export function TopBar() {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const { level, pct } = levelOf(xp);
  const views = useUI((s) => s.views);
  const setViews = useUI((s) => s.setViews);
  const palette = useUI((s) => s.palette);

  return (
    <header className="topbar">
      <div className="brand" title="EESIM · Tepecan Devre Laboratuvarı">
        <img src={FACES.bust} alt="Tepecan" />
        <div className="brand-name">
          EE<span>SIM</span>
        </div>
      </div>
      <button className={`btn icon pal-toggle ${palette ? 'on' : ''}`} onClick={() => useUI.getState().setPalette(!palette)} title={t('Elemanlar')}>
        🧩
      </button>
      <FileMenu />
      <ExperimentSearch />
      <ExperimentChip />
      <div className="topbar-spacer" />
      <SimTools />
      <div className="xp" title={t('{xp} XP · {n} günlük seri', { xp, n: streak })}>
        <span className="streak">🔥 {streak}</span>
        <div className="xp-lvl">
          <span>{t('Sv.')} {level}</span>
          <div className="progress thin">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="xp-n">⚡{xp}</span>
      </div>
      <UserMenu />
      <button className={`btn icon right-toggle ${views.right ? 'on' : ''}`} onClick={() => setViews({ right: !views.right })} title={t('Deney föyü / Tepecan panelini aç-kapat')}>
        ☰
      </button>
    </header>
  );
}
