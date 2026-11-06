// Dil desteği (Türkçe / English).
// Anahtarlar Türkçe metnin kendisidir: t('Başlat') → İngilizce sözlükte karşılığı varsa o, yoksa Türkçesi.
// Böylece çevrilmemiş bir metin hiçbir zaman boş görünmez; yeni dil eklemek için yalnızca sözlük yazılır.
import { create } from 'zustand';
import { EN } from './en';

export type Lang = 'tr' | 'en';
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];
const KEY = 'ieeesim.lang';

function initial(): Lang {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'tr' || s === 'en') return s;
  } catch {
    /* depolama yok */
  }
  if (typeof window === 'undefined') return 'tr'; // testler / sunucu
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return !nav || nav.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: initial(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* depolama yok */
    }
    set({ lang });
  },
}));

const apply = (l: Lang) => {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
};
apply(useLang.getState().lang);
useLang.subscribe((s) => apply(s.lang));

export const getLang = () => useLang.getState().lang;

/** Metni seçili dile çevir. {ad} biçimindeki yer tutucular vars ile doldurulur. */
export function t(tr: string, vars?: Record<string, string | number>): string {
  let s = getLang() === 'en' ? (EN[tr] ?? tr) : tr;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Bileşenin dil değişince yeniden çizilmesi için (aynı t'yi döndürür) */
export function useT() {
  useLang((s) => s.lang);
  return t;
}

/** Dile göre iki metinden birini seç (uzun paragraflar için sözlük yerine) */
export const tr2 = (tr: string, en: string) => (getLang() === 'en' ? en : tr);
