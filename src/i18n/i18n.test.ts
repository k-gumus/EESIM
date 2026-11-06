// Dil desteği: her Türkçe metnin İngilizce karşılığı var mı, çevrilmiş föyler şablonlarla uyumlu mu?
import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { t, useLang } from './index';
import { _ENTRY_EN, _SHEET_EN, localizeTemplate } from './content';
import { LIB_LIST, CATEGORIES, DIODE_MODELS, LED_COLORS } from '../circuit/library';
import { CATALOG } from '../templates/catalog';
import { TEMPLATES } from '../templates';
import { WHATS_NEW } from '../tour/whatsNew';

// Kaynak dosyaların ham metni (Vite: ?raw)
const SOURCES = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!./**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = (rel: string) => SOURCES['../' + rel];

/** Kaynak koddaki t('…') / tr('…') çağrılarının metinleri */
function literalKeys(): string[] {
  const keys = new Set<string>();
  const re = /\b(?:t|tr)\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const s of Object.values(SOURCES)) {
    for (const m of s.matchAll(re)) keys.add(m[1].replace(/\\n/g, '\n').replace(/\\'/g, "'"));
  }
  return [...keys];
}

/** Kodda t() ile değil, veri olarak tutulup ekranda çevrilen metinler */
function dataKeys(): string[] {
  const s = new Set<string>();
  for (const c of CATEGORIES) s.add(c.id);
  for (const d of LIB_LIST) {
    s.add(d.label);
    s.add(d.description);
    for (const p of d.params) {
      s.add(p.label);
      if (p.hint) s.add(p.hint);
      for (const o of p.options ?? []) s.add(o.label);
    }
  }
  for (const v of Object.values(DIODE_MODELS)) s.add(v.label);
  for (const v of Object.values(LED_COLORS)) s.add(v.label);
  for (const n of WHATS_NEW) s.add(n);
  // Tur adımları, sohbet çipleri, Dosya menüsü: kaynakta "title: '…'", "text: '…'", "label: '…'", "q: '…'", item('…'
  const re = /\b(?:title|text|label|q):\s*'((?:[^'\\]|\\.)*)'|\bitem\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const f of ['tour/Tour.tsx', 'ui/CopilotPanel.tsx', 'ui/TopBar.tsx', 'ai/store.ts']) {
    const src = source(f);
    for (const m of src.matchAll(re)) s.add((m[1] ?? m[2]).replace(/\\n/g, '\n'));
  }
  // yalnızca harf içeren (ör. "BC547B", "Model", "LED" gibi aynı kalanlar dahil) metinler
  return [...s].filter((x) => /[a-zA-ZçğıöşüÇĞİÖŞÜ]{2}/.test(x));
}

// Dilden bağımsız (iki dilde de aynı yazılan) metinler
const SAME = new Set(['Model', 'LED', 'N-MOSFET', 'P-MOSFET', 'Op-Amp', 'D Flip-Flop', 'BC547B', 'BC557B', '|Vth|', 'Slew rate', 'LM741 (1 MHz, 0,5 V/µs)', 'TL081 (3 MHz, 13 V/µs)', 'LM358 (1 MHz, 0,3 V/µs)', '1N5819 (Schottky, ~0,3 V)', 'Tepecan Bulut']);

describe('Dil desteği', () => {
  it('kodda çevrilen her metnin İngilizcesi var', () => {
    const keys = literalKeys();
    expect(keys.length).toBeGreaterThan(250);
    const missing = keys.filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('eleman kütüphanesi, tur, yenilikler ve menülerin İngilizcesi var', () => {
    const keys = dataKeys();
    expect(keys.length).toBeGreaterThan(250);
    const missing = keys.filter((k) => !(k in EN) && !SAME.has(k));
    expect(missing).toEqual([]);
  });

  it('yer tutucular iki dilde aynı', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const bad = Object.entries(EN).filter(([k, v]) => ph(k) !== ph(v));
    expect(bad).toEqual([]);
  });

  it('katalogdaki her deneyin İngilizce başlığı var', () => {
    expect(CATALOG.filter((e) => !_ENTRY_EN[e.id]).map((e) => e.id)).toEqual([]);
  });

  it('çevrilmiş föyler şablonlarla uyumlu (adımlar ve şık sayıları)', () => {
    for (const [id, sh] of Object.entries(_SHEET_EN)) {
      const tpl = TEMPLATES.find((x) => x.id === id);
      expect(tpl, id).toBeTruthy();
      for (const [sid, st] of Object.entries(sh.steps)) {
        const step = tpl!.steps.find((s) => s.id === sid);
        expect(step, `${id}/${sid}`).toBeTruthy();
        if (step!.check.kind === 'quiz') {
          expect(st.q, `${id}/${sid} soru`).toBeTruthy();
          expect(st.o?.length, `${id}/${sid} şıklar`).toBe(step!.check.options.length);
        }
      }
      expect(Object.keys(sh.steps).sort(), id).toEqual(tpl!.steps.map((s) => s.id).sort());
    }
  });

  it('İngilizce seçilince metinler ve föy değişir, Türkçeye dönünce geri gelir', () => {
    useLang.getState().setLang('en');
    expect(t('Başlat')).toBe('Start');
    expect(t('{n} günlük seri', { n: 3 })).toBe('3-day streak');
    const led = localizeTemplate(TEMPLATES.find((x) => x.id === 'led-ohm')!);
    expect(led.title).toBe('LED and Ohm’s Law');
    expect(led.steps[0].title).toBe('Start the simulation');
    const quiz = led.steps.find((s) => s.check.kind === 'quiz')!;
    if (quiz.check.kind === 'quiz') expect(quiz.check.options[quiz.check.answer]).toBe('≈ 1.85 V');
    useLang.getState().setLang('tr');
    expect(t('Başlat')).toBe('Başlat');
    expect(localizeTemplate(TEMPLATES.find((x) => x.id === 'led-ohm')!).title).toBe('LED ve Ohm Yasası');
  });
});
