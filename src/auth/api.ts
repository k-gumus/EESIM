// İstemci tarafı oturum API'si (sunucu: functions/api/auth/*)
import { GUEST_KEY, useAuth, type User } from './store';
import { startProgressSync, stopProgressSync } from './sync';
import { tepecan } from '../tepecan/mascot';
import { t } from '../i18n';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Sunucu hatası (${r.status})`);
  return j;
}

function signedIn(user: User, welcome: boolean) {
  useAuth.getState().setUser(user);
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* yok say */
  }
  startProgressSync();
  if (welcome) tepecan.say({ mood: 'success', title: t('Hoş geldin, {n}!', { n: user.name.split(' ')[0] }), text: t('İlerlemen artık hesabına kaydediliyor; her cihazdan devam edebilirsin.'), ttl: 5000 });
}

/**
 * Açılışta: sunucu var mı, oturum açık mı? Sonuca göre giriş ekranını aç.
 * Statik barındırmada (tek dosya, GitHub Pages) /api yoktur → çevrimdışı/misafir modu.
 */
export async function initAuth(): Promise<void> {
  const url = new URL(location.href);
  const loginError = url.searchParams.get('login_error');
  const loginOk = url.searchParams.get('login') === 'ok';
  if (loginError || loginOk) {
    url.searchParams.delete('login_error');
    url.searchParams.delete('login');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  let online = false;
  let google = false;
  let cloudAi = false;
  if (location.protocol.startsWith('http')) {
    try {
      const r = await fetch('/api/health', { credentials: 'include' });
      const ct = r.headers.get('content-type') ?? '';
      if (r.ok && ct.includes('json')) {
        const h = (await r.json()) as { ok: boolean; google?: boolean; ai?: boolean };
        online = !!h.ok;
        google = !!h.google;
        cloudAi = !!h.ai;
      }
    } catch {
      /* sunucu yok */
    }
  }
  useAuth.setState({ online, google, cloudAi });

  if (online) {
    try {
      const { user } = await call<{ user: User }>('/api/auth/me');
      signedIn(user, loginOk);
      useAuth.setState({ ready: true });
      return;
    } catch {
      /* oturum yok */
    }
  }
  let guest = false;
  try {
    guest = localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    /* yok say */
  }
  useAuth.setState({ ready: true, guest, loginOpen: !guest || !!loginError });
  if (loginError) setTimeout(() => tepecan.say({ mood: 'error', title: 'Giriş yapılamadı', text: loginError, ttl: 7000 }), 300);
}

export function openLogin() {
  useAuth.setState({ loginOpen: true });
}

export async function login(email: string, password: string) {
  const { user } = await call<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  signedIn(user, true);
}

export async function register(name: string, email: string, password: string) {
  const { user } = await call<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  signedIn(user, true);
}

export function loginWithGoogle() {
  location.href = '/api/auth/google';
}

/** Hesabı ve tüm sunucu verilerini kalıcı olarak sil (KVKK silme hakkı) */
export async function deleteAccount() {
  await call<{ ok: boolean }>('/api/auth/me', { method: 'DELETE' });
  stopProgressSync();
  useAuth.setState({ user: null, guest: false, loginOpen: true });
}

export async function logout() {
  stopProgressSync();
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    /* çevrimdışı */
  }
  useAuth.setState({ user: null, guest: false, loginOpen: true });
}
