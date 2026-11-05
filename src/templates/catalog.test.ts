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

describe('Deney havuzu v0.2.1 (test sorularının doğru şıkkı)', () => {
  const pp = (s: ReturnType<typeof sim>, n: string) => s.st(n).max - s.st(n).min;
  const cur = (s: ReturnType<typeof sim>, name: string) => s.sim.currentsOf(name)![0];
  const duty = (s: ReturnType<typeof sim>, n: string, th: number) => s.nets[n].filter((v) => v > th).length / s.nets[n].length;

  it('Norton: 5 V açık devre, 10 mA kısa devre', () => {
    const a = sim('norton');
    expect(a.st('VA').last).toBeCloseTo(5, 2);
    expect(a.st('VB').last).toBeCloseTo(5, 2);
    expect(sim('norton', { mutate: (d) => set(d, 'S1', { closed: true }) }).sim.branchCurrent('DMM1')).toBeCloseTo(0.01, 4);
  });

  it('voltmetre yüklemesi: 3,33 V, 10 MΩ ile 4,76 V', () => {
    expect(sim('meter-loading', { mutate: (d) => set(d, 'S1', { closed: true }) }).st('VOUT').last).toBeCloseTo(3.333, 2);
    expect(sim('meter-loading', { mutate: (d) => { set(d, 'S1', { closed: true }); set(d, 'RM', { R: 10e6 }); } }).st('VOUT').last).toBeCloseTo(4.76, 1);
  });

  it('RL: son akım 50 mA; L = 300 mH ile 5 ms yetmez', () => {
    const a = sim('rl-transient', { dur: 30e-3, dt: 1e-5, rec: 20e-3 });
    expect(a.st('VR').max).toBeGreaterThan(4.9);
    const b = sim('rl-transient', { dur: 30e-3, dt: 1e-5, rec: 20e-3, mutate: (d) => set(d, 'L1', { L: 0.3 }) });
    expect(b.st('VR').max).toBeLessThan(4.6);
  });

  it('bobin geri tepmesi: ≈ 47 V, diyotla ≈ 12,7 V', () => {
    const a = sim('inductive-kick', { dur: 0.3, dt: 1e-4, rec: 0.2 });
    expect(a.st('VD').max).toBeGreaterThan(45);
    expect(a.st('VD').max).toBeLessThan(49);
    const b = sim('inductive-kick', { dur: 0.3, dt: 1e-4, rec: 0.2, mutate: (d) => set(d, 'S1', { closed: true }) });
    expect(b.st('VD').max).toBeGreaterThan(12.3);
    expect(b.st('VD').max).toBeLessThan(13.2);
  });

  it('paralel rezonans: 1592 Hz’te VT ≥ 4,5 V', () => {
    const a = sim('parallel-resonance', { dur: 40e-3, dt: 2e-6, rec: 3e-3, mutate: (d) => set(d, 'VG1', { freq: 1592 }) });
    expect(a.st('VT').max).toBeGreaterThan(4.5);
  });

  it('güç faktörü ≈ 0,54: kompanzasyonla kaynak akımı ≈ 0,54 katına iner', () => {
    const a = sim('power-factor', { dur: 0.2, dt: 2e-5, rec: 0.04 });
    const b = sim('power-factor', { dur: 0.2, dt: 2e-5, rec: 0.04, mutate: (d) => set(d, 'S1', { closed: true }) });
    const r = pp(b, 'VI') / pp(a, 'VI');
    expect(r).toBeGreaterThan(0.45);
    expect(r).toBeLessThan(0.62);
  });

  it('bant geçiren: 2575 Hz’te ≈ 0,707; Q = 5 ile daha küçük', () => {
    const a = sim('band-pass', { dur: 10e-3, dt: 1e-6, rec: 2e-3, mutate: (d) => set(d, 'VG1', { freq: 2575 }) });
    expect(a.st('VOUT').max).toBeGreaterThan(0.66);
    expect(a.st('VOUT').max).toBeLessThan(0.75);
    const b = sim('band-pass', { dur: 20e-3, dt: 1e-6, rec: 2e-3, mutate: (d) => { set(d, 'VG1', { freq: 2575 }); set(d, 'R1', { R: 20 }); } });
    expect(b.st('VOUT').max).toBeLessThan(0.3);
  });

  it('aktif YGF: 2 / 1,41 / 0,2', () => {
    expect(sim('active-hpf', { dur: 2e-3, dt: 5e-7, rec: 0.5e-3 }).st('VOUT').max).toBeCloseTo(2, 1);
    const c = sim('active-hpf', { dur: 6e-3, dt: 1e-6, rec: 2e-3, mutate: (d) => set(d, 'VG1', { freq: 1592 }) }).st('VOUT').max;
    expect(c).toBeGreaterThan(1.33);
    expect(c).toBeLessThan(1.5);
    const l = sim('active-hpf', { dur: 40e-3, dt: 1e-5, rec: 13e-3, mutate: (d) => set(d, 'VG1', { freq: 159 }) }).st('VOUT').max;
    expect(l).toBeGreaterThan(0.15);
    expect(l).toBeLessThan(0.25);
  });

  it('tepe dedektörü: ≈ 4,4 V, dalgalanma ≈ 45 mV', () => {
    const a = sim('peak-detector', { dur: 30e-3, dt: 5e-6, rec: 5e-3 });
    expect(a.st('VOUT').avg).toBeGreaterThan(4.3);
    expect(a.st('VOUT').avg).toBeLessThan(4.5);
    expect(pp(a, 'VOUT')).toBeGreaterThan(0.03);
    expect(pp(a, 'VOUT')).toBeLessThan(0.06);
  });

  it('ters polarite: 8,2 V; ters takınca ≈ 0', () => {
    expect(sim('reverse-polarity').st('VL').last).toBeCloseTo(8.2, 1);
    expect(Math.abs(sim('reverse-polarity', { mutate: (d) => set(d, 'V1', { V: -9 }) }).st('VL').last)).toBeLessThan(0.01);
  });

  it('paralel LED: mavi yanmaz, ayrı dirençlerle iki mavi de yanar', () => {
    const a = sim('led-series-parallel');
    expect(cur(a, 'LED2')).toBeLessThan(1e-4);
    expect(cur(a, 'LED1')).toBeGreaterThan(0.018);
    expect(cur(a, 'LED4')).toBeGreaterThan(0.015);
    const b = sim('led-series-parallel', { mutate: (d) => set(d, 'R1', { R: 100 }) });
    expect(cur(b, 'LED1')).toBeGreaterThan(0.028);
  });

  it('emetör izleyici: kazanç ≈ 0,98', () => {
    const a = sim('emitter-follower', { dur: 10e-3, dt: 2e-6, rec: 2e-3 });
    const g = pp(a, 'VOUT') / pp(a, 'VIN');
    expect(g).toBeGreaterThan(0.94);
    expect(g).toBeLessThan(1.0);
  });

  it('Darlington: tek transistör ≈ 4,3 mA, Darlington lambayı doyurur, V_CE ≈ 0,8 V', () => {
    const a = sim('darlington', { mutate: (d) => set(d, 'IN1', { on: true }) });
    const ic1 = a.sim.currentsOf('Q1')![1];
    expect(ic1).toBeGreaterThan(0.0035);
    expect(ic1).toBeLessThan(0.005);
    expect(Math.abs(cur(a, 'LMP2'))).toBeGreaterThan(0.23);
    expect(a.st('VC2').last).toBeGreaterThan(0.6);
    expect(a.st('VC2').last).toBeLessThan(1.1);
  });

  it('diferansiyel çift: tek uç kazanç ≈ 110, zıt faz, ortak mod bastırılır', () => {
    const a = sim('diff-pair', { dur: 4e-3, dt: 2e-6, rec: 2e-3 });
    const g = pp(a, 'VC1') / 0.02;
    expect(g).toBeGreaterThan(90);
    expect(g).toBeLessThan(130);
    const c1 = a.nets.VC1, c2 = a.nets.VC2;
    const m1 = a.st('VC1').avg, m2 = a.st('VC2').avg;
    const corr = c1.reduce((s, v, i) => s + (v - m1) * (c2[i] - m2), 0);
    expect(corr).toBeLessThan(0);
    const b = sim('diff-pair', { dur: 4e-3, dt: 2e-6, rec: 2e-3, mutate: (d) => set(d, 'VG2', { amp: 0.01 }) });
    expect(pp(b, 'VC1')).toBeLessThan(0.05);
  });

  it('push-pull: tepe ≈ 4,25 V, ölü bölge ±0,5 V', () => {
    const a = sim('push-pull', { dur: 3e-3, dt: 1e-6, rec: 1e-3 });
    expect(a.st('VOUT').max).toBeGreaterThan(4.1);
    expect(a.st('VOUT').max).toBeLessThan(4.4);
    a.nets.VIN.forEach((v, i) => {
      if (Math.abs(v) < 0.4) expect(Math.abs(a.nets.VOUT[i])).toBeLessThan(0.02);
    });
  });

  it('I_D–V_GS: eşik 2,1 V, 5 V’ta ≈ 0,35 A', () => {
    const a = sim('id-vgs', { dur: 40e-3, dt: 2e-5, rec: 20e-3 });
    expect(a.st('VID').max).toBeGreaterThan(0.3);
    expect(a.st('VID').max).toBeLessThan(0.4);
    a.nets.VGS.forEach((v, i) => {
      if (v < 2.0) expect(a.nets.VID[i]).toBeLessThan(0.002);
    });
  });

  it('P-MOSFET yük anahtarı: IN = 1 → yük 12 V', () => {
    expect(sim('load-switch').st('VOUT').last).toBeLessThan(0.1);
    expect(sim('load-switch', { mutate: (d) => set(d, 'IN1', { on: true }) }).st('VOUT').last).toBeGreaterThan(11.5);
  });

  it('H-köprüsü: ±1,2 A, A = B → 0', () => {
    expect(Math.abs(sim('h-bridge').sim.branchCurrent('DMM1'))).toBeLessThan(1e-3);
    const f = sim('h-bridge', { mutate: (d) => set(d, 'B', { on: true }) }).sim.branchCurrent('DMM1');
    expect(f).toBeGreaterThan(1.0);
    expect(f).toBeLessThan(1.25);
    const r = sim('h-bridge', { mutate: (d) => set(d, 'A', { on: true }) }).sim.branchCurrent('DMM1');
    expect(r).toBeLessThan(-1.0);
  });

  it('zener + emetör izleyici: ≈ 5,5 V, yük artınca az düşer', () => {
    const a = sim('zener-follower').st('VOUT').last;
    expect(a).toBeGreaterThan(5.4);
    expect(a).toBeLessThan(5.6);
    const b = sim('zener-follower', { mutate: (d) => set(d, 'RL', { R: 47 }) }).st('VOUT').last;
    expect(a - b).toBeGreaterThan(0);
    expect(a - b).toBeLessThan(0.15);
  });

  it('akım sınırlama: kısa devrede ≈ 0,1 A', () => {
    const i = sim('current-limit', { mutate: (d) => set(d, 'S1', { closed: true }) }).sim.branchCurrent('DMM1');
    expect(i).toBeGreaterThan(0.09);
    expect(i).toBeLessThan(0.125);
  });

  it('fark kuvvetlendiricisi: 1 V; ortak modda 0; R4 hatasıyla ≈ 0,17 V', () => {
    expect(sim('difference-amp').st('VOUT').last).toBeCloseTo(1, 1);
    expect(Math.abs(sim('difference-amp', { mutate: (d) => set(d, 'V2', { V: 2 }) }).st('VOUT').last)).toBeLessThan(0.05);
    const e = sim('difference-amp', { mutate: (d) => { set(d, 'V2', { V: 2 }); set(d, 'R4', { R: 11e3 }); } }).st('VOUT').last;
    expect(e).toBeGreaterThan(0.13);
    expect(e).toBeLessThan(0.21);
  });

  it('türev alıcı: ±0,4 V kare', () => {
    const a = sim('differentiator', { dur: 4e-3, dt: 1e-6, rec: 2e-3 });
    expect(a.st('VOUT').max).toBeGreaterThan(0.37);
    expect(a.st('VOUT').max).toBeLessThan(0.45);
  });

  it('hassas doğrultucu: 0,5 V tepe; sıradan diyot ≈ 0,12 V', () => {
    const a = sim('precision-rectifier', { dur: 40e-3, dt: 1e-5, rec: 20e-3 });
    expect(a.st('VP').max).toBeGreaterThan(0.48);
    expect(a.st('VP').min).toBeGreaterThan(-0.02);
    expect(a.st('VD').max).toBeLessThan(0.2);
  });

  it('pencere karşılaştırıcı: periyodun ≈ %20’si', () => {
    const a = sim('comparator-window', { dur: 0.3, dt: 1e-4, rec: 0.2 });
    const dd = duty(a, 'OK', 2.5);
    expect(dd).toBeGreaterThan(0.16);
    expect(dd).toBeLessThan(0.24);
  });

  it('Wien ≈ 1,6 kHz; faz kaydırmalı ≈ 650 Hz ve kazanç düşünce söner', () => {
    const w = sim('wien', { dur: 30e-3, dt: 2e-6, rec: 10e-3 });
    expect(w.freq('OUT', 0)).toBeGreaterThan(1400);
    expect(w.freq('OUT', 0)).toBeLessThan(1700);
    expect(w.st('OUT').max).toBeGreaterThan(1);
    const r = sim('rc-phase-shift', { dur: 40e-3, dt: 5e-6, rec: 20e-3 });
    expect(r.freq('OUT', 0)).toBeGreaterThan(550);
    expect(r.freq('OUT', 0)).toBeLessThan(720);
    const off = sim('rc-phase-shift', { dur: 60e-3, dt: 5e-6, rec: 5e-3, mutate: (d) => set(d, 'RF', { R: 220e3 }) });
    expect(pp(off, 'OUT')).toBeLessThan(0.5);
  });

  it('555 PWM: ≈ 1,4 kHz; konum 0,5 → %50, 0,2 → %20', () => {
    const a = sim('555-pwm', { dur: 8e-3, dt: 1e-6, rec: 5e-3 });
    expect(a.freq('OUT')).toBeGreaterThan(1100);
    expect(a.freq('OUT')).toBeLessThan(1600);
    const d1 = duty(a, 'OUT', 3);
    expect(d1).toBeGreaterThan(0.44);
    expect(d1).toBeLessThan(0.56);
    const b = sim('555-pwm', { dur: 8e-3, dt: 1e-6, rec: 5e-3, mutate: (d) => set(d, 'POT1', { pos: 0.2 }) });
    const d2 = duty(b, 'OUT', 3);
    expect(d2).toBeGreaterThan(0.14);
    expect(d2).toBeLessThan(0.28);
    expect(b.freq('OUT')).toBeGreaterThan(1000);
  });

  it('tam toplayıcı, MUX, kaydırmalı yazmaç', () => {
    const f = sim('full-adder', { mutate: (d) => { set(d, 'A', { on: true }); set(d, 'B', { on: true }); set(d, 'CIN', { on: true }); } });
    expect(level(f.sim, f.circ, 'S')).toBe(1);
    expect(level(f.sim, f.circ, 'COUT')).toBe(1);
    const g = sim('full-adder', { mutate: (d) => { set(d, 'A', { on: true }); set(d, 'B', { on: true }); } });
    expect(level(g.sim, g.circ, 'S')).toBe(0);
    expect(level(g.sim, g.circ, 'COUT')).toBe(1);
    const m0 = sim('mux', { mutate: (d) => set(d, 'D1', { on: true }) });
    expect(level(m0.sim, m0.circ, 'Y')).toBe(0);
    const m1 = sim('mux', { mutate: (d) => { set(d, 'D1', { on: true }); set(d, 'SEL', { on: true }); } });
    expect(level(m1.sim, m1.circ, 'Y')).toBe(1);
    const s = sim('shift-register', {
      phases: [{ dur: 0.6, mutate: (d) => set(d, 'DIN', { on: true }) }, { dur: 1.0, mutate: (d) => set(d, 'DIN', { on: false }) }],
      dt: 1e-3,
    });
    expect(level(s.sim, s.circ, 'Q0')).toBe(0);
    expect(level(s.sim, s.circ, 'Q2')).toBe(1);
  });

  it('R-2R DAC: 101 → 3,125 V; ampermetre iç direnci → 91 mA', () => {
    const a = sim('dac-r2r', { mutate: (d) => { set(d, 'B2', { on: true }); set(d, 'B0', { on: true }); } });
    expect(a.st('VOUT').last).toBeCloseTo(3.125, 2);
    expect(sim('meter-internal').sim.branchCurrent('DMM1')).toBeCloseTo(0.1, 3);
    expect(sim('meter-internal', { mutate: (d) => set(d, 'S1', { closed: false }) }).sim.branchCurrent('DMM1')).toBeCloseTo(0.0909, 3);
  });
});
