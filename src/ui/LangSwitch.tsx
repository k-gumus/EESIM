// Dil seçici: TR | EN
import { LANGS, useLang } from '../i18n';

export function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  return (
    <div className={`lang-switch ${compact ? 'compact' : ''}`} role="group" aria-label="Dil / Language">
      {LANGS.map((l) => (
        <button key={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)} title={l.label} aria-pressed={lang === l.id}>
          {/* bayrak emojileri Windows’ta harf olarak görünür; bu yüzden yalnızca yazı */}
          {compact ? l.id.toUpperCase() : l.label}
        </button>
      ))}
    </div>
  );
}
