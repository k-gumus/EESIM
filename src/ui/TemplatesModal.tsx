import { TEMPLATES } from '../templates';
import { useCircuit } from '../store/circuitStore';
import { useProgress, levelOf } from '../gamify/progress';
import { POSES } from '../tepecan/mascot';
import { runner } from '../sim/runner';

export function TemplatesModal({ onClose, first }: { onClose: () => void; first?: boolean }) {
  const loadDoc = useCircuit((s) => s.loadDoc);
  const clear = useCircuit((s) => s.clear);
  const done = useProgress((s) => s.done);
  const completed = useProgress((s) => s.completed);
  const xp = useProgress((s) => s.xp);
  const { level, pct } = levelOf(xp);

  const open = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    runner.stop();
    loadDoc(t.doc, t.id);
    onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-hero">
          <img src={first ? POSES.hello : POSES.point} alt="Tepecan" className="tpl-hero-img" />
          <div className="tpl-hero-text">
            <div className="bubble">
              {first ? (
                <>
                  <b>Merhaba, ben Tepecan!</b> 🤖 EE212 laboratuvarına hoş geldin. Devreleri burada kurar, osiloskopta ölçer, 3D breadboard’da görürsün.
                  Takıldığında bana sor — devrenin netlist’ini okuyup hatayı bulurum.
                </>
              ) : (
                <>
                  <b>Hangi deneyi yapalım?</b> Her föy adım adım görevler ve kısa quizler içeriyor. Tamamladıkça XP kazanırsın!
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

        <div className="tpl-grid">
          {TEMPLATES.map((t, i) => {
            const n = done[t.id]?.length ?? 0;
            const pc = Math.round((n / t.steps.length) * 100);
            return (
              <button key={t.id} className={`tpl-card ${completed[t.id] ? 'done' : ''}`} onClick={() => open(t.id)}>
                <div className="tpl-num">{completed[t.id] ? '✓' : i}</div>
                <img src={POSES[t.mood]} alt="" />
                <div className="tpl-info">
                  <div className="tpl-tag">
                    <span className={`lvl-${t.level}`}>{t.level}</span> · {t.steps.length} adım · +{t.xp + t.steps.reduce((a, s) => a + (s.xp ?? 10), 0)} XP
                  </div>
                  <div className="tpl-title">{t.title}</div>
                  <div className="tpl-sub">{t.subtitle}</div>
                  <div className="progress thin">
                    <span style={{ width: `${pc}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
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
