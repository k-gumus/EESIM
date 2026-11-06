import { useEffect } from 'react';
import { POSES, useTepecan } from '../tepecan/mascot';
import { t } from '../i18n';

export function TepecanToast() {
  const current = useTepecan((s) => s.current);
  const dismiss = useTepecan((s) => s.dismiss);

  useEffect(() => {
    if (!current) return;
    const ttl = current.ttl ?? (current.actions ? 0 : 8000);
    if (!ttl) return;
    const timer = setTimeout(dismiss, ttl);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  if (!current) return null;
  return (
    <div className={`tep-toast mood-${current.mood}`} key={current.id}>
      <img src={POSES[current.mood]} alt="" className="tep-toast-img" />
      <div className="tep-toast-bubble">
        <button className="tep-x" onClick={dismiss} aria-label={t('Kapat')}>
          ✕
        </button>
        <div className="tep-toast-title">{t(current.title)}</div>
        <div className="tep-toast-text">{t(current.text)}</div>
        {current.actions && (
          <div className="tep-toast-actions">
            {current.actions.map((a) => (
              <button
                key={a.label}
                className={`btn sm ${a.primary ? 'primary' : ''}`}
                onClick={() => {
                  a.run();
                  dismiss();
                }}
              >
                {t(a.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
