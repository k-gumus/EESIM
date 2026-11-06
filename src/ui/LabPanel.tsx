import { useEffect, useMemo, useState } from 'react';
import { useCircuit } from '../store/circuitStore';
import { runner, useSim } from '../sim/runner';
import { templateById, type LabStep, type StepCheck } from '../templates';
import { useProgress } from '../gamify/progress';
import { POSES, tepecan } from '../tepecan/mascot';
import { Markdown } from './Markdown';
import { useAI } from '../ai/store';
import { t } from '../i18n';
import { localizeTemplate, sheetAvailable, tLevel, topicTitle } from '../i18n/content';

function evalCheck(c: StepCheck): boolean {
  const st = useCircuit.getState();
  const sim = useSim.getState();
  switch (c.kind) {
    case 'run':
      return sim.status === 'running' || sim.status === 'paused';
    case 'switch':
      return !!st.byName(c.comp)?.data.params.closed === c.closed;
    case 'param': {
      const v = st.byName(c.comp)?.data.params[c.param];
      if (v === undefined) return false;
      const a = typeof c.value === 'number' ? Number(v) : String(v);
      if (c.op === '>=') return a >= c.value;
      if (c.op === '<=') return a <= c.value;
      if (c.op === '==') return a === c.value;
      return a !== c.value;
    }
    case 'pin': {
      const n = st.byName(c.comp);
      const circ = runner.compiled;
      if (!n || !circ) return false;
      const net = circ.pinNet[`${n.id}:${c.pin}`];
      return net !== undefined && circ.netNames[net]?.toUpperCase() === c.net.toUpperCase();
    }
    case 'measure': {
      if (sim.status !== 'running' && sim.status !== 'paused') return false;
      const s = runner.netStatsByName(c.net);
      if (!s || s.n < 10) return false;
      const v = c.stat === 'pp' ? s.max - s.min : s[c.stat];
      return c.op === '>=' ? v >= c.value : v <= c.value;
    }
    default:
      return false;
  }
}

export function LabPanel({ onOpenTemplates }: { onOpenTemplates: () => void }) {
  const templateId = useCircuit((s) => s.templateId);
  const version = useCircuit((s) => s.version);
  const loadDoc = useCircuit((s) => s.loadDoc);
  const tick = useSim((s) => s.tick);
  const status = useSim((s) => s.status);
  const raw = templateById(templateId);
  const tpl = raw ? localizeTemplate(raw) : undefined;
  const done = useProgress((s) => (tpl ? s.done[tpl.id] ?? [] : []));
  const completed = useProgress((s) => (tpl ? !!s.completed[tpl.id] : false));
  const markStep = useProgress((s) => s.markStep);
  const completeTemplate = useProgress((s) => s.completeTemplate);
  const resetTemplate = useProgress((s) => s.resetTemplate);
  const setStepText = useAI((s) => s.setStepText);
  const [quiz, setQuiz] = useState<Record<string, number>>({});
  const [showTheory, setShowTheory] = useState(false);

  const current: LabStep | undefined = useMemo(() => tpl?.steps.find((s) => !done.includes(s.id)), [tpl, done]);

  useEffect(() => {
    setStepText(current ? `${current.title} — ${current.text.replace(/\*\*/g, '')}` : undefined);
  }, [current, setStepText]);

  const finish = (step: LabStep) => {
    if (!tpl) return;
    const xp = step.xp ?? 10;
    if (!markStep(tpl.id, step.id, xp)) return;
    const remaining = tpl.steps.filter((s) => s.id !== step.id && !done.includes(s.id));
    if (!remaining.length) {
      completeTemplate(tpl.id, tpl.xp);
      tepecan.say({ mood: 'success', title: t('Deney tamamlandı! +{xp} XP 🎉', { xp: tpl.xp + xp }), text: t('“{x}” föyünü bitirdin. Bir sonraki deneye hazır mısın?', { x: tpl.title }), ttl: 7000, actions: [{ label: t('Deneylere dön'), primary: true, run: onOpenTemplates }] });
    } else {
      tepecan.say({ mood: 'success', title: `+${xp} XP`, text: step.success ?? t('Süper, devam!'), ttl: step.success ? 6000 : 2200 });
    }
  };

  // Otomatik adım kontrolü
  useEffect(() => {
    if (!current || current.check.kind === 'quiz' || current.check.kind === 'manual') return;
    if (evalCheck(current.check)) finish(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, tick, version, status]);

  if (!tpl) {
    return (
      <div className="lab lab-empty">
        <img src={POSES.point} alt="" className="lab-hero" />
        <h3>{t('Serbest çalışma modu')}</h3>
        <p className="muted">{t('Bir deney seçersen adım adım görevler, quizler ve XP seni bekliyor.')}</p>
        <button className="btn primary" onClick={onOpenTemplates}>
          {t('Deneylere göz at')}
        </button>
      </div>
    );
  }

  const pct = Math.round((done.length / tpl.steps.length) * 100);
  return (
    <div className="lab">
      <div className="lab-head">
        <img src={POSES[tpl.mood]} alt="" className="lab-mini" />
        <div>
          <div className="lab-level">
            {tLevel(tpl.level)} · {topicTitle(tpl.topic)}
          </div>
          <div className="lab-title">{tpl.title}</div>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="muted small">
            {done.length}/{tpl.steps.length} {t('adım')} {completed && `· ✓ ${t('tamamlandı')}`}
          </div>
        </div>
      </div>
      {!sheetAvailable(tpl.id) && <div className="lang-note">ℹ️ This experiment sheet is only available in Turkish for now. The 8 experiments in the ★ Starter path are fully in English.</div>}

      <button className="linkbtn" onClick={() => setShowTheory(!showTheory)}>
        {showTheory ? `▴ ${t('Teoriyi gizle')}` : `▾ ${t('Kısa teori')}`}
      </button>
      {showTheory && <div className="theory">{tpl.theory}</div>}

      <ol className="steps">
        {tpl.steps.map((s, i) => {
          const isDone = done.includes(s.id);
          const isCur = current?.id === s.id;
          return (
            <li key={s.id} className={`step ${isDone ? 'done' : isCur ? 'cur' : 'locked'}`}>
              <div className="step-head">
                <span className="step-num">{isDone ? '✓' : i + 1}</span>
                <span>{s.title}</span>
                <span className="step-xp">+{s.xp ?? 10}</span>
              </div>
              {isCur && (
                <div className="step-body">
                  <Markdown text={s.text} />
                  {s.check.kind === 'quiz' && (
                    <Quiz
                      check={s.check}
                      chosen={quiz[s.id]}
                      onChoose={(k) => {
                        setQuiz({ ...quiz, [s.id]: k });
                        if (s.check.kind === 'quiz' && k !== s.check.answer) tepecan.say({ mood: 'error', title: t('Tam değil…'), text: t('Bir daha düşün! Osiloskop ölçümleri ipucu verir.'), ttl: 2500 });
                      }}
                      onNext={() => finish(s)}
                    />
                  )}
                  {s.check.kind === 'manual' && (
                    <button className="btn primary sm" onClick={() => finish(s)}>
                      {s.check.label ?? t('Tamamladım')}
                    </button>
                  )}
                  {s.check.kind !== 'quiz' && s.check.kind !== 'manual' && (
                    <div className="step-wait">
                      <span className="pulse" /> {t('Tepecan bu adımı otomatik kontrol ediyor…')}
                    </div>
                  )}
                  {s.hint && <div className="muted small">💡 {s.hint}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="lab-foot">
        <button
          className="btn sm"
          onClick={() => {
            resetTemplate(tpl.id);
            loadDoc(tpl.doc, tpl.id);
            setQuiz({});
            runner.stop();
          }}
        >
          ↺ {t('Deneyi baştan al')}
        </button>
      </div>
    </div>
  );
}

/** Soruya göre sabit (deterministik) karıştırma — doğru cevap hep ilk sırada görünmesin */
function shuffled(n: number, seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function Quiz({ check, chosen, onChoose, onNext }: { check: Extract<StepCheck, { kind: 'quiz' }>; chosen?: number; onChoose: (k: number) => void; onNext: () => void }) {
  const correct = chosen === check.answer;
  const order = useMemo(() => shuffled(check.options.length, check.question), [check]);
  return (
    <div className="quiz">
      <div className="quiz-q">{check.question}</div>
      <div className="quiz-opts">
        {order.map((k) => [check.options[k], k] as const).map(([o, k]) => (
          <button
            key={k}
            className={`quiz-opt ${chosen === k ? (k === check.answer ? 'right' : 'wrong') : ''}`}
            disabled={correct}
            onClick={() => onChoose(k)}
          >
            {o}
          </button>
        ))}
      </div>
      {correct && (
        <div className="quiz-ok">
          <div>✅ {check.explain}</div>
          <button className="btn primary sm" onClick={onNext}>
            {t('Devam →')}
          </button>
        </div>
      )}
    </div>
  );
}
