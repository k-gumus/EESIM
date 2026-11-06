// Tepecan'lı tanıtım turu (ilk giriş) ve "tekrar hoş geldin / kaldığın yer" kartı (sonraki girişler)
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useUI, isPhone } from '../store/uiStore';
import { useAuth } from '../auth/store';
import { useCircuit } from '../store/circuitStore';
import { useProgress, levelOf } from '../gamify/progress';
import { POSES, type Mood } from '../tepecan/mascot';
import { TEMPLATES, templateById } from '../templates';
import { openEntry } from '../ui/TopBar';
import { CATALOG } from '../templates/catalog';
import { WHATS_NEW, APP_VERSION } from './whatsNew';
import { t } from '../i18n';
import { entrySubtitle, entryTitle } from '../i18n/content';

interface Step {
  target?: string;
  title: string;
  text: string;
  mood: Mood;
  /** hedef görünmüyorsa görünür yap */
  prepare?: () => void;
  /** telefon düzeninde farklı hedef / metin */
  phone?: { target?: string; text?: string };
}

const STEPS: Step[] = [
  {
    title: 'Merhaba, ben Tepecan! 🤖',
    text: 'EESIM’e hoş geldin. Bir dakikada her şeyin yerini göstereyim. İstediğin an **Esc** ile çıkabilirsin.',
    mood: 'hello',
  },
  {
    target: '.palette',
    title: 'Elemanlar',
    text: 'Direnç, diyot, transistör, op-amp, 555, mantık kapıları… Canvas’a **sürükle** ya da **tıkla**. Üzerine gelince çıkan **i** düğmesi bilgi kartını açar: nasıl çalışır, tipik değerler, datasheet.',
    mood: 'point',
    phone: {
      target: '.pal-toggle',
      text: 'Direnç, diyot, transistör, op-amp, 555… **🧩** düğmesi eleman çekmecesini açar; bir elemana **dokun**, canvas’a eklensin. **i** düğmesi bilgi kartını açar.',
    },
  },
  {
    target: '.canvas-wrap',
    title: 'Çalışma alanı',
    text: 'Bir ucu sürükleyip başka uca bırakınca **kablo** olur. **R** döndürür, **Del** siler, anahtara **çift tıklayınca** açılıp kapanır.',
    mood: 'info',
    phone: {
      text: 'Bir bacağı sürükleyip başka bacağa bırakınca **kablo** olur. **İki parmakla** yakınlaştır, anahtara **iki kez dokununca** açılıp kapanır.',
    },
  },
  {
    target: '[data-tour="run"]',
    title: 'Simülasyonu başlat',
    text: 'Devre hazır olunca **Başlat**’a bas. Kablolarda akım noktaları akar, renkler gerilimi gösterir. Hata varsa sana söylerim.',
    mood: 'success',
  },
  {
    target: '[data-tour="simtools"]',
    title: 'Simülasyon araçları',
    text: '**3D Görünüm** devreni breadboard üstünde kurar, **Osiloskop** dalga şekillerini çizer, **Değer Okuma** her elemanın akım ve gerilimini canvas’ta gösterir.',
    mood: 'point',
  },
  {
    target: '[data-tour="search"]',
    title: 'Deney bul',
    text: '“doğrultucu”, “op-amp”, “pull-down”… yaz, ilgili deney föyü açılsın. Kısayol: **Ctrl + K**.',
    mood: 'info',
  },
  {
    target: '[data-tour="file"]',
    title: 'Dosya',
    text: 'Devreni kaydet, aç, **SPICE netlist**’ini gör ya da .cir olarak indir (LTspice ile açılır).',
    mood: 'point',
  },
  {
    target: '.right .tabs',
    title: 'Deney föyü · Özellikler · Tepecan’a Sor',
    text: '**Deney** sekmesi adım adım görevler ve quizler içerir. **Özellikler**’de seçili elemanın değerlerini değiştirirsin. Takılırsan **Tepecan’a Sor**: devreni okuyup hatayı bulurum.',
    mood: 'hello',
    prepare: () => useUI.getState().setViews({ right: true }),
  },
  {
    target: '[data-tour="user"]',
    title: 'Profilin',
    text: 'XP, seviye ve günlük serin burada. Giriş yaptıysan ilerlemen her cihazda seninle. Turu buradan tekrar başlatabilirsin.',
    mood: 'success',
  },
  {
    title: 'Hazırsın! 🎉',
    text: 'İlk deneyini seçelim: **★ Başlangıç yolu** Ohm yasasından 555 zamanlayıcıya kadar seni adım adım götürür.',
    mood: 'success',
  },
];

const md = (s: string) =>
  s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>));

function Spotlight({ onDone }: { onDone: (openCatalog: boolean) => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const phone = isPhone();
  const base = STEPS[i];
  const step = phone && base.phone ? { ...base, ...base.phone } : base;
  const target = step.target;
  const last = i === STEPS.length - 1;

  const measure = useCallback(() => {
    if (!target) return setRect(null);
    const el = document.querySelector(target);
    const r = el?.getBoundingClientRect();
    // gizli ya da ekran dışındaki hedefi gösterme (balon ortada açılır)
    setRect(r && r.width > 0 && r.right > 0 && r.left < window.innerWidth ? r : null);
  }, [target]);

  useLayoutEffect(() => {
    base.prepare?.();
    const t = setTimeout(measure, base.prepare ? 60 : 0);
    measure();
    return () => clearTimeout(t);
  }, [i, measure, base]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(false);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', k);
    };
  });

  const next = () => (last ? onDone(true) : setI(i + 1));

  // Balonu hedefin yanına yerleştir (sığmazsa altına/üstüne/ortaya)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = Math.min(440, vw - 24);
  const H = vw < 500 ? 260 : 220;
  let style: React.CSSProperties = { left: vw / 2 - W / 2, top: vh / 2 - H / 2 };
  if (rect) {
    const pad = 14;
    if (rect.right + pad + W < vw && rect.width < vw * 0.45) style = { left: rect.right + pad, top: Math.min(vh - H - 16, Math.max(16, rect.top + rect.height / 2 - H / 2)) };
    else if (rect.left - pad - W > 0 && rect.width < vw * 0.45) style = { left: rect.left - pad - W, top: Math.min(vh - H - 16, Math.max(16, rect.top + rect.height / 2 - H / 2)) };
    else if (rect.bottom + pad + H < vh) style = { left: Math.min(vw - W - 16, Math.max(16, rect.left + rect.width / 2 - W / 2)), top: rect.bottom + pad };
    else if (rect.top - pad - H > 0) style = { left: Math.min(vw - W - 16, Math.max(16, rect.left + rect.width / 2 - W / 2)), top: rect.top - pad - H };
  }

  return (
    <div className="tour-layer" data-testid="tour">
      {rect ? (
        <div className="tour-hole" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-bubble" style={{ ...style, width: W }}>
        <img src={POSES[step.mood]} alt="" className="tour-mascot" />
        <div className="tour-content">
          <div className="tour-title">{t(step.title)}</div>
          <div className="tour-text">{md(t(step.text))}</div>
          <div className="tour-foot">
            <div className="tour-dots">
              {STEPS.map((_, k) => (
                <span key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />
              ))}
            </div>
            {!last && (
              <button className="linkbtn" onClick={() => onDone(false)}>
                {t('Atla')}
              </button>
            )}
            {i > 0 && (
              <button className="btn" onClick={() => setI(i - 1)}>
                ←
              </button>
            )}
            <button className="btn primary" onClick={next} autoFocus>
              {last ? t('İlk deneyi seç →') : i === 0 ? t('Başlayalım →') : t('İleri →')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const LAST_KEY = 'ieeesim.last';
const SEEN_KEY = 'ieeesim.seenVersion';

/** Son açılan deneyi hatırla ("kaldığın yer") */
export function rememberLastTemplate() {
  return useCircuit.subscribe((s, prev) => {
    if (s.templateId && s.templateId !== prev.templateId) {
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({ id: s.templateId, at: Date.now() }));
      } catch {
        /* yok say */
      }
    }
  });
}

function lastTemplate() {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { id: string; at: number } | null;
    return v ? templateById(v.id) ?? null : null;
  } catch {
    return null;
  }
}

function WelcomeBack({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user);
  const { xp, streak, done, completed } = useProgress();
  const { level, pct } = levelOf(xp);
  const last = lastTemplate();
  const lastDone = last ? (done[last.id]?.length ?? 0) : 0;
  const lastFinished = last ? !!completed[last.id] || lastDone >= last.steps.length : false;
  // Sıradaki öneri: son deney bittiyse, aynı konudaki bitmemiş ilk deney
  const suggestion = (() => {
    if (last && !lastFinished) return null;
    const pool = TEMPLATES.filter((t) => !completed[t.id]);
    return pool.find((t) => t.topic === last?.topic) ?? pool[0] ?? null;
  })();
  let seenVersion: string | null = null;
  try {
    seenVersion = localStorage.getItem(SEEN_KEY);
  } catch {
    /* yok say */
  }
  const news = seenVersion === APP_VERSION ? [] : WHATS_NEW;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
    } catch {
      /* yok say */
    }
    onClose();
  };
  const go = (id: string) => {
    const e = CATALOG.find((x) => x.id === id);
    if (e) openEntry(e);
    close();
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal wb-modal" onClick={(e) => e.stopPropagation()} data-testid="welcome-back">
        <div className="wb-head">
          <img src={POSES.hello} alt="" />
          <div>
            <h2>
              {t('Tekrar hoş geldin')}
              {user ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </h2>
            <div className="wb-stats">
              <span>🔥 {t('{n} günlük seri', { n: streak })}</span>
              <span>⭐ {t('Seviye')} {level}</span>
              <span>⚡ {xp} XP</span>
              <span>✅ {t('{n} deney tamamlandı', { n: Object.keys(completed).length })}</span>
            </div>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button className="iconbtn close" onClick={close} title={t('Kapat')}>
            ✕
          </button>
        </div>
        <div className="wb-body">
          {last && !lastFinished && (
            <div className="wb-card">
              <div className="wb-label">{t('Kaldığın yer')}</div>
              <div className="wb-title">{entryTitle(last)}</div>
              <div className="muted small">
                {lastDone}/{last.steps.length} {t('adım')}
              </div>
              <div className="progress thin">
                <span style={{ width: `${(lastDone / last.steps.length) * 100}%` }} />
              </div>
              <button className="btn primary" onClick={() => go(last.id)}>
                {t('Kaldığın yerden devam et →')}
              </button>
            </div>
          )}
          {suggestion && (
            <div className="wb-card">
              <div className="wb-label">{last ? t('Sıradaki öneri') : t('Başlamak için')}</div>
              <div className="wb-title">{entryTitle(suggestion)}</div>
              <div className="muted small">{entrySubtitle(suggestion)}</div>
              <button className="btn primary" onClick={() => go(suggestion.id)}>
                {t('Deneyi aç →')}
              </button>
            </div>
          )}
          {news.length > 0 && (
            <div className="wb-news">
              <div className="wb-label">
                {t('Yenilikler')} · v{APP_VERSION}
              </div>
              <ul>
                {news.map((n) => (
                  <li key={n}>{md(t(n))}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="wb-foot">
          <button className="linkbtn" onClick={() => (close(), useUI.getState().startTour('first'))}>
            🧭 {t('Turu tekrar göster')}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => (close(), useUI.getState().openCatalog('menu'))}>
            📚 {t('Deney kataloğu')}
          </button>
          <button className="btn" onClick={close}>
            {t('Kapat')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Tour() {
  const tour = useUI((s) => s.tour);
  if (tour === 'first')
    return (
      <Spotlight
        onDone={(cat) => {
          useUI.getState().startTour(null);
          try {
            localStorage.setItem(SEEN_KEY, APP_VERSION);
          } catch {
            /* yok say */
          }
          if (cat) useUI.getState().openCatalog('first');
        }}
      />
    );
  if (tour === 'return') return <WelcomeBack onClose={() => useUI.getState().startTour(null)} />;
  return null;
}
