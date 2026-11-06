// Kullanıcı menüsü: giriş durumu, tur, çıkış
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/store';
import { useUI } from '../store/uiStore';
import { FACES } from '../tepecan/mascot';
import { deleteAccount, logout, openLogin } from '../auth/api';
import { t } from '../i18n';
import { LangSwitch } from './LangSwitch';
import { openLegal } from './Legal';
import { tepecan } from '../tepecan/mascot';

async function confirmDelete(email: string) {
  const typed = window.prompt(
    t('Hesabın, ilerlemen ve yüklediğin dosyalar KALICI olarak silinecek. Bu geri alınamaz.\n\nOnaylamak için e-posta adresini yaz:'),
  );
  if (typed == null) return;
  if (typed.trim().toLowerCase() !== email.toLowerCase()) {
    tepecan.say({ mood: 'info', title: t('Hesap silinmedi'), text: t('Yazdığın e-posta hesabınla eşleşmedi.'), ttl: 4000 });
    return;
  }
  try {
    await deleteAccount();
    tepecan.say({ mood: 'info', title: t('Hesabın silindi'), text: t('Tüm verilerin sunucudan kaldırıldı. Güle güle!'), ttl: 6000 });
  } catch (e) {
    tepecan.say({ mood: 'error', title: t('Hesap silinemedi'), text: t((e as Error).message), ttl: 6000 });
  }
}

export function UserMenu() {
  const user = useAuth((s) => s.user);
  const online = useAuth((s) => s.online);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const initials = user ? user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';
  return (
    <div className="menu" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen(!open)} title={user ? user.name : t('Misafir')} data-tour="user">
        {user?.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : user ? <span>{initials}</span> : <img src={FACES.info} alt="" />}
      </button>
      {open && (
        <div className="menu-pop right">
          <div className="menu-user">
            <b>{user ? user.name : t('Misafir')}</b>
            <small className="muted">{user ? user.email : t('İlerlemen bu tarayıcıda saklanıyor')}</small>
            {user?.premium && <span className="badge-premium">PREMIUM</span>}
          </div>
          <div className="menu-sep" />
          {!user && online !== false && (
            <button className="menu-item" onClick={() => (setOpen(false), openLogin())}>
              🔑 {t('Giriş yap / kayıt ol')}
            </button>
          )}
          <button className="menu-item" onClick={() => (setOpen(false), useUI.getState().startTour('first'))}>
            🧭 {t('Tanıtım turunu başlat')}
          </button>
          <button className="menu-item" onClick={() => (setOpen(false), useUI.getState().openCatalog('menu'))}>
            📚 {t('Deney kataloğu')}
          </button>
          <div className="menu-sep" />
          <div className="menu-lang">
            <span className="muted small">{t('Dil')}</span>
            <LangSwitch compact />
          </div>
          <button className="menu-item" onClick={() => (setOpen(false), openLegal('privacy'))}>
            🔒 {t('Gizlilik ve KVKK')}
          </button>
          <button className="menu-item" onClick={() => (setOpen(false), openLegal('terms'))}>
            📄 {t('Kullanım Koşulları')}
          </button>
          {user && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => (setOpen(false), logout())}>
                ↩ {t('Çıkış yap')}
              </button>
              <button className="menu-item danger" onClick={() => (setOpen(false), confirmDelete(user.email))}>
                🗑 {t('Hesabımı sil')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
