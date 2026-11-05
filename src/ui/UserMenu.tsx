// Kullanıcı menüsü: giriş durumu, tur, çıkış
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/store';
import { useUI } from '../store/uiStore';
import { FACES } from '../tepecan/mascot';
import { logout, openLogin } from '../auth/api';

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
      <button className="avatar-btn" onClick={() => setOpen(!open)} title={user ? user.name : 'Misafir'} data-tour="user">
        {user?.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : user ? <span>{initials}</span> : <img src={FACES.info} alt="" />}
      </button>
      {open && (
        <div className="menu-pop right">
          <div className="menu-user">
            <b>{user ? user.name : 'Misafir'}</b>
            <small className="muted">{user ? user.email : 'İlerlemen bu tarayıcıda saklanıyor'}</small>
            {user?.premium && <span className="badge-premium">PREMIUM</span>}
          </div>
          <div className="menu-sep" />
          {!user && online !== false && (
            <button className="menu-item" onClick={() => (setOpen(false), openLogin())}>
              🔑 Giriş yap / kayıt ol
            </button>
          )}
          <button className="menu-item" onClick={() => (setOpen(false), useUI.getState().startTour('first'))}>
            🧭 Tanıtım turunu başlat
          </button>
          <button className="menu-item" onClick={() => (setOpen(false), useUI.getState().openCatalog('menu'))}>
            📚 Deney kataloğu
          </button>
          {user && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => (setOpen(false), logout())}>
                ↩ Çıkış yap
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
