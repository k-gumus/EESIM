// Giriş yapmış kullanıcının ilerlemesini (XP, adımlar, seri) sunucuyla eşitle.
// Birleştirme kuralı: XP en büyüğü, tamamlanan adım/deney kümelerinin birleşimi, seri en büyüğü.
import { useProgress } from '../gamify/progress';

export interface ProgressData {
  xp: number;
  streak: number;
  lastDay: string | null;
  done: Record<string, string[]>;
  completed: Record<string, boolean>;
}

export function mergeProgress(a: ProgressData, b: ProgressData | null): ProgressData {
  if (!b) return a;
  const done: Record<string, string[]> = { ...a.done };
  for (const [k, v] of Object.entries(b.done ?? {})) done[k] = [...new Set([...(done[k] ?? []), ...v])];
  const lastDay = [a.lastDay, b.lastDay].filter(Boolean).sort().pop() ?? null;
  return {
    xp: Math.max(a.xp ?? 0, b.xp ?? 0),
    streak: a.lastDay === lastDay && b.lastDay === lastDay ? Math.max(a.streak, b.streak) : lastDay === a.lastDay ? a.streak : b.streak,
    lastDay,
    done,
    completed: { ...(b.completed ?? {}), ...a.completed },
  };
}

const pick = (): ProgressData => {
  const { xp, streak, lastDay, done, completed } = useProgress.getState();
  return { xp, streak, lastDay, done, completed };
};

let unsub: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function push() {
  try {
    await fetch('/api/progress', { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pick()) });
  } catch {
    /* çevrimdışı: bir sonraki değişiklikte yeniden denenir */
  }
}

export async function startProgressSync() {
  stopProgressSync();
  try {
    const r = await fetch('/api/progress', { credentials: 'include' });
    if (r.ok) {
      const { progress } = (await r.json()) as { progress: ProgressData | null };
      const merged = mergeProgress(pick(), progress);
      useProgress.setState(merged);
      try {
        localStorage.setItem('ieeesim.progress.v1', JSON.stringify(merged));
      } catch {
        /* yok say */
      }
      await push();
    }
  } catch {
    /* sunucu yok */
  }
  unsub = useProgress.subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 1500);
  });
}

export function stopProgressSync() {
  unsub?.();
  unsub = null;
  if (timer) clearTimeout(timer);
  timer = null;
}
