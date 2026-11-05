// Deney kataloğu: konu başlıklarına göre gruplanmış tüm deneyler (etkileşimli + yakında)
import { useMemo, useState } from 'react';
import { useCircuit } from '../store/circuitStore';
import { useUI } from '../store/uiStore';
import { useProgress, levelOf } from '../gamify/progress';
import { POSES } from '../tepecan/mascot';
import { runner } from '../sim/runner';
import { CATALOG, searchCatalog, type CatalogEntry } from '../templates/catalog';
import { TOPICS, type TopicId } from '../templates/topics';
import { openEntry } from './TopBar';

/** İlk kez gelenler için önerilen sıra */
const STARTER = ['led-ohm', 'voltage-divider', 'rc-charge', 'half-wave', 'pullup-pulldown', 'logic-gates', 'opamp-inverting', '555-astable'];
const LEVELS = ['Isınma', 'Temel', 'Orta', 'İleri'] as const;

type Sel = TopicId | 'start';

export function TemplatesModal({ onClose, first }: { onClose: () => void; first?: boolean }) {
  const clear = useCircuit((s) => s.clear);
  const done = useProgress((s) => s.done);
  const completed = useProgress((s) => s.completed);
  const xp = useProgress((s) => s.xp);
  const { level, pct } = levelOf(xp);
  const initial = useUI((s) => s.catalogTopic) as TopicId | null;
  const [sel, setSel] = useState<Sel>(initial ?? 'start');
  const [q, setQ] = useState('');
  const [lvl, setLvl] = useState<string | null>(null);
  const [showPlanned, setShowPlanned] = useState(true);

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; ready: number; done: number }>();
    for (const t of TOPICS) m.set(t.id, { total: 0, ready: 0, done: 0 });
    for (const e of CATALOG) {
      const s = m.get(e.topic)!;
      s.total++;
      if (e.template) s.ready++;
      if (completed[e.id]) s.done++;
    }
    return m;
  }, [completed]);
  const readyCount = CATALOG.filter((e) => e.template).length;

  const list: CatalogEntry[] = useMemo(() => {
    let l: CatalogEntry[];
    if (q.trim()) l = searchCatalog(q, 60);
    else if (sel === 'start') l = STARTER.map((id) => CATALOG.find((e) => e.id === id)!).filter(Boolean);
    else l = CATALOG.filter((e) => e.topic === sel);
    if (lvl) l = l.filter((e) => e.level === lvl);
    if (!showPlanned) l = l.filter((e) => e.template);
    // etkileşimli olanlar önce, seviyeye göre
    return [...l].sort((a, b) => (q.trim() ? 0 : Number(!!b.template) - Number(!!a.template) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)));
  }, [q, sel, lvl, showPlanned]);

  const topic = sel === 'start' ? null : TOPICS.find((t) => t.id === sel)!;

  const open = (e: CatalogEntry) => {
    if (!e.template) return;
    openEntry(e);
    onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal cat-modal" onClick={(e) => e.stopPropagation()} data-testid="catalog">
        <div className="tpl-hero cat-hero">
          <img src={first ? POSES.hello : POSES.point} alt="Tepecan" className="tpl-hero-img" />
          <div className="tpl-hero-text">
            <div className="bubble">
              {first ? (
                <>
                  <b>Merhaba, ben Tepecan!</b> 🤖 EESIM devre laboratuvarına hoş geldin. Devreleri burada kurar, osiloskopta ölçer, 3D breadboard’da görürsün.
                  Nereden başlayacağını bilmiyorsan <b>★ Başlangıç</b> yolunu izle.
                </>
              ) : (
                <>
                  <b>Hangi deneyi yapalım?</b> {readyCount} etkileşimli föy, {CATALOG.length - readyCount} tanesi daha yolda. Konuya göre seç ya da ara.
                </>
              )}
            </div>
            <div className="tpl-level">
              <span className="lvl">Seviye {level}</span>
              <div className="progress">
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="muted small">{xp} XP</span>
            </div>
          </div>
          <button className="iconbtn close" onClick={onClose} title="Kapat">
            ✕
          </button>
        </div>

        <div className="cat-body">
          <nav className="cat-side">
            <button className={`cat-topic ${sel === 'start' && !q ? 'on' : ''}`} onClick={() => (setSel('start'), setQ(''))}>
              <span className="cat-ico">★</span>
              <span className="cat-tname">Başlangıç yolu</span>
            </button>
            <div className="cat-sep">Konular</div>
            {TOPICS.map((t) => {
              const s = stats.get(t.id)!;
              return (
                <button key={t.id} className={`cat-topic ${sel === t.id && !q ? 'on' : ''}`} onClick={() => (setSel(t.id), setQ(''))} title={t.desc}>
                  <span className="cat-ico">{t.icon}</span>
                  <span className="cat-tname">{t.title}</span>
                  <span className="cat-count">
                    {s.done > 0 && <b>{s.done}/</b>}
                    {s.ready}
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="cat-main">
            <div className="cat-tools">
              <div className="cat-search">
                <span>🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tüm katalogda ara: köprü, pull-down, 555, Bode…" autoFocus={!first} />
                {q && (
                  <button className="iconbtn" onClick={() => setQ('')} title="Temizle">
                    ✕
                  </button>
                )}
              </div>
              <div className="cat-chips">
                {LEVELS.map((l) => (
                  <button key={l} className={`chip ${lvl === l ? 'on' : ''}`} onClick={() => setLvl(lvl === l ? null : l)}>
                    <span className={`lvl-${l}`}>{l}</span>
                  </button>
                ))}
                <label className="chip chk">
                  <input type="checkbox" checked={showPlanned} onChange={(e) => setShowPlanned(e.target.checked)} /> Yakında olanlar
                </label>
              </div>
            </div>

            <div className="cat-head">
              {q.trim() ? (
                <>
                  <h3>“{q}” için {list.length} sonuç</h3>
                </>
              ) : topic ? (
                <>
                  <h3>
                    <span className="cat-ico big">{topic.icon}</span> {topic.title}
                  </h3>
                  <p className="muted small">{topic.desc}</p>
                </>
              ) : (
                <>
                  <h3>★ Başlangıç yolu</h3>
                  <p className="muted small">Ohm yasasından 555 zamanlayıcıya: sırayla yaparsan her deney bir öncekinin üzerine kurulur.</p>
                </>
              )}
            </div>

            <div className="tpl-grid cat-grid">
              {list.map((e, i) => {
                const t = e.template;
                const n = t ? (done[t.id]?.length ?? 0) : 0;
                const pc = t ? Math.round((n / t.steps.length) * 100) : 0;
                const tp = TOPICS.find((x) => x.id === e.topic)!;
                return (
                  <button
                    key={e.id}
                    className={`tpl-card ${completed[e.id] ? 'done' : ''} ${t ? '' : 'planned'}`}
                    onClick={() => open(e)}
                    disabled={!t}
                    title={t ? 'Deneyi aç' : 'Bu deneyin etkileşimli föyü hazırlanıyor'}
                  >
                    <div className="tpl-num">{completed[e.id] ? '✓' : sel === 'start' && !q ? i + 1 : t ? '▶' : '…'}</div>
                    {t ? <img src={POSES[t.mood]} alt="" /> : <div className="cat-soon">{tp.icon}</div>}
                    <div className="tpl-info">
                      <div className="tpl-tag">
                        <span className={`lvl-${e.level}`}>{e.level}</span>
                        {(q.trim() || sel === 'start') && <> · {tp.title}</>}
                        {t ? (
                          <>
                            {' '}
                            · {t.steps.length} adım · +{t.xp + t.steps.reduce((a, s) => a + (s.xp ?? 10), 0)} XP
                          </>
                        ) : (
                          <span className="soon-badge">Yakında</span>
                        )}
                      </div>
                      <div className="tpl-title">{e.title}</div>
                      <div className="tpl-sub">{e.subtitle}</div>
                      {t && (
                        <div className="progress thin">
                          <span style={{ width: `${pc}%` }} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {!list.length && <div className="muted cat-empty">Bu filtrelerle deney bulunamadı.</div>}
            </div>
          </section>
        </div>

        <div className="tpl-foot">
          <button
            className="btn"
            onClick={() => {
              runner.stop();
              clear();
              onClose();
            }}
          >
            Boş canvas ile başla
          </button>
        </div>
      </div>
    </div>
  );
}
