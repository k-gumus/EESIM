// Katalogdaki her etkileşimli deney: simülasyon hatasız koşar ve test sorularının
// doğru şıkları simülasyonla tutarlıdır.
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './index';
import { CATALOG, searchCatalog, entriesOfTopic } from './catalog';
import { TOPICS } from './topics';
import { docToGraph } from '../circuit/doc';
import { compileCircuit } from '../circuit/compile';
import { Simulator } from '../engine/simulator';
import type { CircuitDoc } from '../circuit/types';

type Doc = CircuitDoc;
type Phase = { dur: number; mutate?: (d: Doc) => void };

const set = (doc: Doc, name: string, params: Record<string, unknown>) => {
  const c = doc.components.find((x) => x.name === name)!;
  c.params = { ...c.params, ...(params as Record<string, never>) };
};

/** Şablonu (isteğe bağlı aşamalarla) simüle et; kayıt son `rec` saniyede tutulur */
function sim(id: string, opts: { phases?: Phase[]; dur?: number; dt?: number; rec?: number; mutate?: (d: Doc) => void } = {}) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const doc: Doc = JSON.parse(JSON.stringify(t.doc));
  opts.mutate?.(doc);
  const phases = opts.phases ?? [{ dur: opts.dur ?? 0 }];
  let s: Simulator | null = null;
  let circ = null as ReturnType<typeof compileCircuit> | null;
  const total = phases.reduce((a, p) => a + p.dur, 0);
  const rec = opts.rec ?? total / 3;
  const T: number[] = [];
  const nets: Record<string, number[]> = {};
  for (const ph of phases) {
    ph.mutate?.(doc);
    const { nodes, edges } = docToGraph(doc);
    circ = compileCircuit(nodes, edges);
    const ns = new Simulator(circ);
    if (s) {
      if (!ns.adopt(s)) throw new Error('adopt');
    } else ns.dcOperatingPoint();
    s = ns;
    const end = s.t + ph.dur;
    const dt = opts.dt ?? 1e-5;
    while (s.t < end - dt / 2) {
      s.step(dt);
      if (s.t >= total - rec) {
        T.push(s.t);
        circ.netNames.forEach((n, i) => (nets[n] ??= []).push(s!.netV(i)));
      }
    }
  }
  if (!T.length) circ!.netNames.forEach((n, i) => (nets[n] = [s!.netV(i)]));
  const st = (n: string) => {
    const a = nets[n];
    if (!a) throw new Error(`net yok: ${n}`);
    return { max: Math.max(...a), min: Math.min(...a), avg: a.reduce((x, y) => x + y, 0) / a.length, last: a[a.length - 1] };
  };
  /** Yükselen kenar sayısından frekans */
  const freq = (n: string, level?: number) => {
    const a = nets[n];
    const { max, min } = st(n);
    const L = level ?? (max + min) / 2;
    const ups: number[] = [];
    for (let i = 1; i < a.length; i++) if (a[i - 1] < L && a[i] >= L) ups.push(T[i]);
    if (ups.length < 2) return 0;
    return (ups.length - 1) / (ups[ups.length - 1] - ups[0]);
  };
  /** Bir netin, diğer netin kenar anlarındaki değeri (eşik ölçümü) */
  const at = (n: string, i: number) => nets[n][i];
  return { sim: s!, circ: circ!, st, freq, nets, T, at };
}

const level = (s: Simulator, circ: ReturnType<typeof compileCircuit>, probe: string) => {
  const el = circ.elements.find((e) => e.name === probe)!;
  const v = s.netV(el.nets[0]);
  return v > 3.5 ? 1 : v < 1.5 ? 0 : 0.5;
};

describe('Deney kataloğu', () => {
  it('her konu en az bir deney içerir, kimlikler benzersiz', () => {
    const ids = new Set<string>();
    for (const e of CATALOG) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
    }
    for (const t of TOPICS) expect(entriesOfTopic(t.id).length, t.id).toBeGreaterThan(0);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(45);
  });

  it('arama Türkçe karakterlerden bağımsız çalışır', () => {
    expect(searchCatalog('kopru')[0]?.id).toBeTruthy();
    expect(searchCatalog('pull down').some((e) => e.id === 'pullup-pulldown')).toBe(true);
    expect(searchCatalog('555').some((e) => e.id === '555-astable')).toBe(true);
    expect(searchCatalog('evirmeyen').some((e) => e.id === 'opamp-noninverting')).toBe(true);
  });

  it('her şablonun test sorusu geçerli, adım kimlikleri benzersiz', () => {
    for (const t of TEMPLATES) {
      const ids = new Set(t.steps.map((s) => s.id));
      expect(ids.size, t.id).toBe(t.steps.length);
      for (const s of t.steps) {
        if (s.check.kind === 'quiz') {
          expect(s.check.answer, `${t.id}/${s.id}`).toBeLessThan(s.check.options.length);
        }
        if (s.check.kind === 'param' || s.check.kind === 'switch') {
          const comp = (s.check as { comp: string }).comp;
          expect(t.doc.components.some((c) => c.name === comp), `${t.id}/${s.id} → ${comp}`).toBe(true);
        }
      }
    }
  });

  it('her şablon kısa bir geçici analizi hatasız tamamlar', () => {
    for (const t of TEMPLATES) {
      const { nodes, edges } = docToGraph(t.doc);
      const circ = compileCircuit(nodes, edges);
      const sc = circ.elements.find((e) => e.type === 'scope');
      const fs = circ.elements.filter((e) => e.type === 'vac' || e.type === 'clock').map((e) => Number(e.params.freq));
      const win = sc ? Number(sc.params.timeDiv) * 10 : fs.length ? 2 / Math.max(...fs) : 1e-2;
      let dt = win / 1000;
      if (fs.length) dt = Math.min(dt, 1 / (Math.max(...fs) * 200));
      const s = new Simulator(circ);
      expect(() => {
        s.dcOperatingPoint();
        for (let i = 0; i < 600; i++) s.step(dt);
      }, t.id).not.toThrow();
    }
  });
});

describe('Deney sonuçları (test sorularının doğru şıkkı)', () => {
  it('gerilim bölücü: 6 V, yükle 4 V', () => {
    expect(sim('voltage-divider').st('VOUT').last).toBeCloseTo(6, 2);
    expect(sim('voltage-divider', { mutate: (d) => set(d, 'S1', { closed: true }) }).st('VOUT').last).toBeCloseTo(4, 2);
  });

  it('KVL/KCL: VA ≈ 6,55 V; Thevenin 5 V; süperpozisyon 5 V; bağımlı kaynak 41,3 V', () => {
    expect(sim('kvl-kcl').st('VA').last).toBeCloseTo(6.545, 2);
    expect(sim('thevenin').st('VAB').last).toBeCloseTo(5, 2);
    expect(sim('superposition').st('VM').last).toBeCloseTo(5, 2);
    expect(sim('dependent-source').st('VOUT').last).toBeCloseTo(41.32, 1);
  });

  it('RLC basamak: ≈ %73 aşma', () => {
    const a = sim('rlc-step', { dur: 15e-3, dt: 5e-6, rec: 15e-3 });
    expect(a.st('VC').max).toBeGreaterThan(8.3);
    expect(a.st('VC').max).toBeLessThan(8.9);
  });

  it('RC faz: 1 kHz’te 3,54 V; seri rezonans 1,59 kHz’te VR ≥ 4,5 V', () => {
    expect(sim('rc-phase', { dur: 5e-3, dt: 2e-6 }).st('VOUT').max).toBeCloseTo(3.54, 1);
    const r = sim('series-resonance', { dur: 30e-3, dt: 1e-6, rec: 3e-3, mutate: (d) => set(d, 'VG1', { freq: 1592 }) });
    expect(r.st('VR').max).toBeGreaterThan(4.5);
  });

  it('trafo 10:1 → 22 V RMS (31,1 V tepe)', () => {
    const a = sim('transformer-ratio', { dur: 40e-3, dt: 2e-5, rec: 25e-3 });
    const t = TEMPLATES.find((x) => x.id === 'transformer-ratio')!;
    const rl = t.doc.components.find((c) => c.type === 'resistor')!;
    const nets = Object.keys(a.nets);
    const peak = Math.max(...nets.map((n) => (n === '0' ? 0 : a.st(n).max)).filter((v) => v < 100));
    expect(peak).toBeGreaterThan(30.5);
    expect(peak).toBeLessThan(31.5);
    expect(rl).toBeTruthy();
  });

  it('orta uçlu: tepe ≈ 14,9 V; katlayıcı ≈ 18,7 V', () => {
    expect(sim('center-tap', { dur: 60e-3, dt: 5e-5 }).st('VOUT').max).toBeGreaterThan(14.6);
    const d = sim('voltage-doubler', { dur: 60e-3, dt: 5e-6 }).st('VOUT').max;
    expect(d).toBeGreaterThan(18.3);
    expect(d).toBeLessThan(19.2);
  });

  it('ortak emetör: |A_v| ≈ 165, R_E ile ≈ 3,1', () => {
    const a = sim('ce-amp', { dur: 6e-3, dt: 2e-6, rec: 2e-3 });
    const vin = a.st('VIN').max - a.st('VIN').min;
    const g = (a.st('VOUT').max - a.st('VOUT').min) / vin;
    expect(g).toBeGreaterThan(130);
    expect(g).toBeLessThan(200);
    const b = sim('ce-amp', { dur: 6e-3, dt: 2e-6, rec: 2e-3, mutate: (d) => set(d, 'S1', { closed: false }) });
    const step = TEMPLATES.find((x) => x.id === 'ce-amp')!.steps.find((s) => s.check.kind === 'switch');
    if (step && step.check.kind === 'switch') {
      const c = sim('ce-amp', { dur: 6e-3, dt: 2e-6, rec: 2e-3, mutate: (d) => set(d, 'S1', { closed: (step.check as { closed: boolean }).closed }) });
      const g2 = (c.st('VOUT').max - c.st('VOUT').min) / (c.st('VIN').max - c.st('VIN').min);
      expect(g2).toBeGreaterThan(2.6);
      expect(g2).toBeLessThan(3.6);
    }
    expect(b).toBeTruthy();
  });

  it('op-amp eviren −10, evirmeyen 11, izleyici 1, toplayıcı −(v1+2)', () => {
    const inv = sim('opamp-inverting', { dur: 3e-3, dt: 2e-6 });
    expect(inv.st('VOUT').max).toBeCloseTo(5, 0);
    const sat = sim('opamp-inverting', { dur: 3e-3, dt: 2e-6, mutate: (d) => set(d, 'R2', { R: 47e3 }) });
    expect(sat.st('VOUT').max).toBeGreaterThan(13);
    expect(sat.st('VOUT').max).toBeLessThan(14.2);
    expect(sim('opamp-noninverting', { dur: 3e-3, dt: 2e-6 }).st('VOUT').max).toBeCloseTo(5.5, 0);
    expect(sim('opamp-noninverting', { dur: 3e-3, dt: 2e-6, mutate: (d) => set(d, 'S1', { closed: true }) }).st('VOUT').max).toBeCloseTo(0.5, 1);
    const sum = sim('opamp-summing', { dur: 3e-3, dt: 2e-6 });
    expect(sum.st('VOUT').max).toBeCloseTo(-1, 1);
    expect(sum.st('VOUT').min).toBeCloseTo(-3, 1);
    const sum2 = sim('opamp-summing', { dur: 3e-3, dt: 2e-6, mutate: (d) => set(d, 'R2', { R: 20e3 }) });
    expect(sum2.st('VOUT').avg).toBeCloseTo(-1, 1);
  });

  it('integral alıcı: üçgen ≈ 0,5 Vpp', () => {
    const a = sim('opamp-integrator', { dur: 4e-3, dt: 1e-6, rec: 2e-3 });
    const pp = a.st('VOUT').max - a.st('VOUT').min;
    expect(pp).toBeGreaterThan(0.45);
    expect(pp).toBeLessThan(0.56);
  });

  it('Schmitt: eşikler ≈ ±1,23 V', () => {
    const a = sim('opamp-schmitt', { dur: 30e-3, dt: 5e-6, rec: 20e-3 });
    const vo = a.nets.VOUT;
    const thr: number[] = [];
    const rail = a.st('VOUT').max - 0.2;
    // çıkışın raydan ayrıldığı an = eşik geçildi (slew rate gecikmesini dışarıda bırak)
    for (let i = 1; i < vo.length; i++) if (Math.abs(vo[i - 1]) > rail && Math.abs(vo[i]) <= rail) thr.push(a.at('VIN', i));
    expect(thr.length).toBeGreaterThanOrEqual(2);
    for (const v of thr) expect(Math.abs(Math.abs(v) - 1.23)).toBeLessThan(0.15);
  });

  it('555 astable ≈ 6,9 Hz, D ≈ %52; monostable ≈ 1,1 s', () => {
    const a = sim('555-astable', { dur: 1.5, dt: 1e-4, rec: 1.0 });
    expect(a.freq('OUT')).toBeGreaterThan(6.2);
    expect(a.freq('OUT')).toBeLessThan(7.5);
    const out = a.nets.OUT;
    const hi = out.filter((v) => v > 3).length / out.length;
    expect(hi).toBeGreaterThan(0.47);
    expect(hi).toBeLessThan(0.58);
    const m = sim('555-monostable', {
      phases: [{ dur: 0.05 }, { dur: 0.01, mutate: (d) => set(d, 'BTN1', { pressed: true }) }, { dur: 1.6, mutate: (d) => set(d, 'BTN1', { pressed: false }) }],
      dt: 2e-4,
      rec: 1.66,
    });
    const o = m.nets.OUT;
    const width = o.filter((v) => v > 3).length * 2e-4;
    expect(width).toBeGreaterThan(1.0);
    expect(width).toBeLessThan(1.25);
  });

  it('transistörlü multivibratör ≈ 1,5 Hz; op-amp gevşemeli ≈ 455 Hz', () => {
    const a = sim('bjt-astable', { dur: 4, dt: 2e-3, rec: 3 });
    expect(a.freq('VC1')).toBeGreaterThan(1.3);
    expect(a.freq('VC1')).toBeLessThan(1.9);
    const r = sim('opamp-relaxation', { dur: 20e-3, dt: 2e-6, rec: 12e-3 });
    expect(r.freq('OUT', 0)).toBeGreaterThan(400);
    expect(r.freq('OUT', 0)).toBeLessThan(480);
  });

  it('güç kaynağı: 5 V, ripple ≈ 1 V; buck ≈ 6 V; boost ≈ 10 V', () => {
    const p = sim('linear-psu', { dur: 0.12, dt: 5e-5, rec: 0.04 });
    expect(p.st('VOUT').avg).toBeCloseTo(5, 1);
    const rip = p.st('VRAW').max - p.st('VRAW').min;
    expect(rip).toBeGreaterThan(0.7);
    expect(rip).toBeLessThan(1.2);
    const bu = sim('buck', { dur: 15e-3, dt: 2.5e-7, rec: 2e-3 }).st('VOUT').avg;
    expect(bu).toBeGreaterThan(5.4);
    expect(bu).toBeLessThan(6.1);
    const bo = sim('boost', { dur: 20e-3, dt: 2.5e-7, rec: 2e-3 }).st('VOUT').avg;
    expect(bo).toBeGreaterThan(9.0);
    expect(bo).toBeLessThan(10.1);
  });

  it('mantık kapıları, yarım toplayıcı, pull-down, SR mandal', () => {
    const g = sim('logic-gates', { mutate: (d) => { set(d, 'A', { on: true }); set(d, 'B', { on: true }); } });
    expect(level(g.sim, g.circ, 'P_G1')).toBe(1);
    expect(level(g.sim, g.circ, 'P_G2')).toBe(1);
    expect(level(g.sim, g.circ, 'P_G3')).toBe(0);
    expect(level(g.sim, g.circ, 'P_G4')).toBe(0);
    const h = sim('half-adder', { mutate: (d) => { set(d, 'A', { on: true }); set(d, 'B', { on: true }); } });
    expect(level(h.sim, h.circ, 'S')).toBe(0);
    expect(level(h.sim, h.circ, 'CARRY')).toBe(1);
    const f = sim('pullup-pulldown');
    expect(level(f.sim, f.circ, 'P_IN')).toBe(0.5);
    const pd = sim('pullup-pulldown', { mutate: (d) => set(d, 'S1', { closed: true }) });
    expect(level(pd.sim, pd.circ, 'P_IN')).toBe(0);
    expect(level(pd.sim, pd.circ, 'P_OUT')).toBe(1);
    const pr = sim('pullup-pulldown', { mutate: (d) => { set(d, 'S1', { closed: true }); set(d, 'BTN1', { pressed: true }); } });
    expect(level(pr.sim, pr.circ, 'P_IN')).toBe(1);
    const sr = sim('sr-latch', {
      phases: [{ dur: 1e-3, mutate: (d) => set(d, 'S', { on: true }) }, { dur: 1e-3, mutate: (d) => set(d, 'S', { on: false }) }],
      dt: 1e-5,
    });
    expect(level(sr.sim, sr.circ, 'Q')).toBe(1);
  });

  it('2 bitlik sayıcı: Q1 = saat/4', () => {
    const a = sim('ripple-counter', { dur: 6, dt: 2e-3, rec: 5 });
    expect(a.freq('CLK')).toBeCloseTo(2, 1);
    expect(a.freq('Q1S')).toBeCloseTo(0.5, 1);
  });

  it('Wheatstone: 25 °C’de 0 V, 50 °C’de ≈ 1,18 V; LDR: 5 lx’te LED yanar', () => {
    const w = sim('wheatstone-ntc');
    expect(w.st('VA').last - w.st('VB').last).toBeCloseTo(0, 2);
    const w2 = sim('wheatstone-ntc', { mutate: (d) => set(d, 'NTC1', { temp: 50 }) });
    expect(w2.st('VA').last - w2.st('VB').last).toBeCloseTo(1.18, 1);
    const n = sim('ldr-nightlight');
    expect(n.st('VS').last).toBeCloseTo(6.4, 0);
    const led = (s: ReturnType<typeof sim>) => s.sim.currentsOf('LED1')![0];
    expect(led(n)).toBeLessThan(1e-4);
    const n2 = sim('ldr-nightlight', { mutate: (d) => set(d, 'LDR1', { lux: 5 }) });
    expect(n2.st('VS').last).toBeLessThan(4.5);
    expect(led(n2)).toBeGreaterThan(5e-3);
  });
});
