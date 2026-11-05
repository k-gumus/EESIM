// Kullanıcı oturumu (misafir veya giriş yapmış). Sunucu tarafı: functions/api/auth/*
import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  premium: boolean;
}

interface AuthState {
  user: User | null;
  guest: boolean;
  /** sunucu API'si erişilebilir mi (Cloudflare Pages üzerinde mi çalışıyoruz) */
  online: boolean | null;
  ready: boolean;
  loginOpen: boolean;
  setUser: (u: User | null) => void;
  continueAsGuest: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  guest: false,
  online: null,
  ready: false,
  loginOpen: false,
  setUser: (user) => set({ user, guest: false, loginOpen: false }),
  continueAsGuest: () => set({ guest: true, loginOpen: false }),
}));
