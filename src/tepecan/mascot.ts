// Tepecan maskot varlıkları ve konuşma balonu olay yolu
import { create } from 'zustand';
import bust from '../assets/tepecan/bust.webp';
import faceAngry from '../assets/tepecan/face-angry.webp';
import faceError from '../assets/tepecan/face-error.webp';
import faceInfo from '../assets/tepecan/face-info.webp';
import faceSuccess from '../assets/tepecan/face-success.webp';
import faceSurprised from '../assets/tepecan/face-surprised.webp';
import poseAngry from '../assets/tepecan/pose-angry.webp';
import poseError from '../assets/tepecan/pose-error.webp';
import poseHello from '../assets/tepecan/pose-hello.webp';
import poseInfo from '../assets/tepecan/pose-info.webp';
import posePoint from '../assets/tepecan/pose-point.webp';
import poseSuccess from '../assets/tepecan/pose-success.webp';
import poseSurprised from '../assets/tepecan/pose-surprised.webp';

export type Mood = 'hello' | 'point' | 'info' | 'success' | 'error' | 'angry' | 'surprised';

export const POSES: Record<Mood, string> = {
  hello: poseHello,
  point: posePoint,
  info: poseInfo,
  success: poseSuccess,
  error: poseError,
  angry: poseAngry,
  surprised: poseSurprised,
};

export const FACES: Record<Mood | 'bust', string> = {
  bust,
  hello: bust,
  point: bust,
  info: faceInfo,
  success: faceSuccess,
  error: faceError,
  angry: faceAngry,
  surprised: faceSurprised,
};

export interface TepecanMessage {
  id: number;
  mood: Mood;
  title: string;
  text: string;
  actions?: { label: string; primary?: boolean; run: () => void }[];
  ttl?: number;
  key?: string;
}

interface TepecanState {
  current: TepecanMessage | null;
  queue: TepecanMessage[];
  recentKeys: Map<string, number>;
  say: (m: Omit<TepecanMessage, 'id'>) => void;
  dismiss: () => void;
}

let mid = 1;
export const useTepecan = create<TepecanState>((set, get) => ({
  current: null,
  queue: [],
  recentKeys: new Map(),
  say: (m) => {
    const now = Date.now();
    if (m.key) {
      const last = get().recentKeys.get(m.key);
      if (last && now - last < 20000) return;
      get().recentKeys.set(m.key, now);
    }
    const msg = { ...m, id: mid++ };
    if (!get().current) set({ current: msg });
    else set({ queue: [...get().queue.filter((q) => q.key !== m.key || !m.key), msg].slice(-3) });
  },
  dismiss: () => {
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
  },
}));

export const tepecan = {
  say: (m: Omit<TepecanMessage, 'id'>) => useTepecan.getState().say(m),
};
