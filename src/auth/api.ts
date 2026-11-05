// İstemci tarafı oturum API'si (sunucu: functions/api/auth/*). Görev 12'de genişletilecek.
import { useAuth } from './store';

export function openLogin() {
  useAuth.setState({ guest: false, loginOpen: true });
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    /* çevrimdışı */
  }
  useAuth.setState({ user: null, guest: false, loginOpen: true });
}
