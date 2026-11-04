// Duolingo tarzı ilerleme: XP, seviye, günlük seri (streak), deney tamamlama
import { create } from 'zustand';

interface ProgressState {
  xp: number;
  streak: number;
  lastDay: string | null;
  done: Record<string, string[]>; // templateId → tamamlanan adım id'leri
  completed: Record<string, boolean>;
  addXp: (n: number) => void;
  markStep: (tpl: string, step: string, xp: number) => boolean;
  completeTemplate: (tpl: string, bonus: number) => void;
  resetTemplate: (tpl: string) => void;
}

const KEY = 'ieeesim.progress.v1';
const today = () => new Date().toISOString().slice(0, 10);

function load(): Partial<ProgressState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(s: ProgressState) {
  try {
    const { xp, streak, lastDay, done, completed } = s;
    localStorage.setItem(KEY, JSON.stringify({ xp, streak, lastDay, done, completed }));
  } catch {
    /* depolama yoksa sessizce geç */
  }
}

export const useProgress = create<ProgressState>((set, get) => {
  const init = load();
  const touch = () => {
    const d = today();
    const { lastDay, streak } = get();
    if (lastDay === d) return {};
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    return { lastDay: d, streak: lastDay === y ? streak + 1 : 1 };
  };
  return {
    xp: init.xp ?? 0,
    streak: init.streak ?? 0,
    lastDay: init.lastDay ?? null,
    done: init.done ?? {},
    completed: init.completed ?? {},
    addXp: (n) => {
      set({ xp: get().xp + n, ...touch() });
      save(get());
    },
    markStep: (tpl, step, xp) => {
      const list = get().done[tpl] ?? [];
      if (list.includes(step)) return false;
      set({ done: { ...get().done, [tpl]: [...list, step] }, xp: get().xp + xp, ...touch() });
      save(get());
      return true;
    },
    completeTemplate: (tpl, bonus) => {
      if (get().completed[tpl]) return;
      set({ completed: { ...get().completed, [tpl]: true }, xp: get().xp + bonus });
      save(get());
    },
    resetTemplate: (tpl) => {
      const done = { ...get().done };
      delete done[tpl];
      set({ done });
      save(get());
    },
  };
});

export const levelOf = (xp: number) => ({ level: Math.floor(xp / 100) + 1, pct: xp % 100 });
