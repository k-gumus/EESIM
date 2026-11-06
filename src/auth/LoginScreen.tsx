// Giriş ekranı: Google ile giriş, e-posta/şifre (giriş + kayıt), misafir modu
import { useState } from 'react';
import { useAuth } from './store';
import { login, loginWithGoogle, register } from './api';
import { POSES } from '../tepecan/mascot';
import { TEMPLATES } from '../templates';
import { t } from '../i18n';
import { LangSwitch } from '../ui/LangSwitch';
import { openLegal } from '../ui/Legal';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width={18} height={18} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginScreen() {
  const open = useAuth((s) => s.loginOpen);
  const ready = useAuth((s) => s.ready);
  const online = useAuth((s) => s.online);
  const google = useAuth((s) => s.google);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!ready || !open) return null;
  const off = online === false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
    } catch (er) {
      setError(t(er instanceof Error ? er.message : String(er)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-back" data-testid="login">
      <div className="login-shell">
        <section className="login-hero">
          <div className="login-brand">
            EE<span>SIM</span>
          </div>
          <p className="login-tag">{t('Elektrik-elektronik öğrencileri için Tepecan’lı devre laboratuvarı')}</p>
          <ul className="login-points">
            <li>⚡ {t('Devreni kur, gerçek zamanlı simüle et')}</li>
            <li>📈 {t('Osiloskop, multimetre ve 3D breadboard')}</li>
            <li>🧪 {t('{n} adım adım deney föyü, 12 konu başlığı', { n: TEMPLATES.length })}</li>
            <li>🤖 {t('Takıldığında Tepecan’a sor')}</li>
          </ul>
          <img src={POSES.hello} alt="Tepecan" className="login-mascot" />
        </section>

        <section className="login-card">
          <div className="login-lang">
            <LangSwitch />
          </div>
          <h2>{mode === 'login' ? t('Tekrar hoş geldin!') : t('Hesap oluştur')}</h2>
          <p className="muted small">{mode === 'login' ? t('XP’in, serin ve deneylerin kaldığı yerden devam etsin.') : t('İlerlemen ve datasheet’lerin her cihazda seninle olsun.')}</p>

          {off && (
            <div className="login-note">
              <b>{t('Çevrimdışı sürüm.')}</b> {t('Bu kopyada giriş sunucusu yok (tek dosya ya da statik barındırma). Misafir olarak devam edebilirsin; ilerlemen bu tarayıcıda saklanır.')}
            </div>
          )}

          <button className="btn google-btn" onClick={loginWithGoogle} disabled={off || !google} title={!google && !off ? t('Google ile giriş henüz yapılandırılmadı') : undefined}>
            <GoogleIcon /> {mode === 'login' ? t('Google ile giriş yap') : t('Google ile kayıt ol')}
          </button>
          {!google && !off && <div className="muted small tcenter">{t('Google ile giriş yakında — şimdilik e-posta ile devam et.')}</div>}

          <div className="login-or">
            <span>{t('ya da e-posta ile')}</span>
          </div>

          <form onSubmit={submit} className="login-form">
            {mode === 'register' && (
              <label>
                {t('Ad Soyad')}
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required disabled={off} maxLength={60} />
              </label>
            )}
            <label>
              {t('E-posta')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={off} />
            </label>
            <label>
              {t('Şifre')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
                disabled={off}
              />
              {mode === 'register' && <small className="muted">{t('En az 8 karakter.')}</small>}
            </label>
            {error && <div className="login-error">{error}</div>}
            <button className="btn primary" type="submit" disabled={off || busy}>
              {busy ? t('Bekle…') : mode === 'login' ? t('Giriş yap') : t('Kayıt ol')}
            </button>
          </form>

          <div className="login-switch">
            {mode === 'login' ? (
              <>
                {t('Hesabın yok mu?')}{' '}
                <button className="linkbtn" onClick={() => (setMode('register'), setError(''))} disabled={off}>
                  {t('Kayıt ol')}
                </button>
              </>
            ) : (
              <>
                {t('Zaten hesabın var mı?')}{' '}
                <button className="linkbtn" onClick={() => (setMode('login'), setError(''))}>
                  {t('Giriş yap')}
                </button>
              </>
            )}
          </div>

          <div className="login-sep" />
          <button className="btn ghost guest-btn" onClick={() => useAuth.getState().continueAsGuest()}>
            {t('Misafir olarak devam et →')}
          </button>
          <p className="muted small tcenter">{t('Misafir modunda her şey çalışır; ilerlemen yalnızca bu tarayıcıda tutulur.')}</p>
          <p className="muted small tcenter login-legal">
            {mode === 'register' ? t('Kayıt olarak') : t('Devam ederek')}{' '}
            <button className="linkbtn" onClick={() => openLegal('terms')}>
              {t('Kullanım Koşulları')}
            </button>{' '}
            {t('ve')}{' '}
            <button className="linkbtn" onClick={() => openLegal('privacy')}>
              {t('Gizlilik ve KVKK Aydınlatma Metni')}
            </button>
            {t('’ni kabul etmiş olursun.')}
          </p>
        </section>
      </div>
    </div>
  );
}
