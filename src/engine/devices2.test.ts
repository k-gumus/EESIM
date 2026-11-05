import { describe, expect, it } from 'vitest';
import { compileCircuit } from '../circuit/compile';
import { docToGraph, quickDoc } from '../circuit/doc';
import { Simulator } from './simulator';
import type { CircuitDoc } from '../circuit/types';

function setup(doc: CircuitDoc) {
  const { nodes, edges } = docToGraph(doc);
  const circ = compileCircuit(nodes, edges);
  const sim = new Simulator(circ);
  const net = (name: string) => {
    const i = circ.netNames.indexOf(name);
    if (i < 0) throw new Error('net yok: ' + name + ' / ' + circ.netNames.join(','));
    return i;
  };
  return { circ, sim, net };
}

function trace(sim: Simulator, tEnd: number, dt: number, probe: () => number, from = 0) {
  const out: number[] = [];
  const ts: number[] = [];
  sim.dcOperatingPoint();
  while (sim.t < tEnd - dt / 2) {
    sim.step(dt);
    if (sim.t >= from) {
      out.push(probe());
      ts.push(sim.t);
    }
  }
  return { v: out, t: ts };
}

describe('Op-amp', () => {
  it('eviren kuvvetlendirici: kazanç −10', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 0.5 }], ['resistor', 'R1', { R: 1e3 }], ['resistor', 'R2', { R: 10e3 }], ['opamp', 'U1', { model: 'LM741' }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'U1.n'], ['U1.n', 'R2.a'], ['R2.b', 'U1.o'], ['U1.p', 'G.g'], ['V1.n', 'G.g'], ['U1.o', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('OUT'))).toBeCloseTo(-5, 2);
  });

  it('doyum: kazanç × giriş > besleme → ~±13,5 V', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 2 }], ['resistor', 'R1', { R: 1e3 }], ['resistor', 'R2', { R: 10e3 }], ['opamp', 'U1', { model: 'LM741' }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'U1.n'], ['U1.n', 'R2.a'], ['R2.b', 'U1.o'], ['U1.p', 'G.g'], ['V1.n', 'G.g'], ['U1.o', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    const v = sim.netV(net('OUT'));
    expect(v).toBeLessThan(-13);
    expect(v).toBeGreaterThan(-14);
  });

  it('evirmeyen kuvvetlendirici AC: kazanç 11, 1 kHz', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'V1', { amp: 0.5, freq: 1000 }], ['resistor', 'R1', { R: 1e3 }], ['resistor', 'R2', { R: 10e3 }], ['opamp', 'U1', { model: 'TL081' }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'U1.p'], ['U1.n', 'R1.a'], ['R1.b', 'G.g'], ['U1.n', 'R2.a'], ['R2.b', 'U1.o'], ['V1.n', 'G.g'], ['U1.o', 'L.p']],
      ),
    );
    const { v } = trace(sim, 4e-3, 2e-6, () => sim.netV(net('OUT')), 2e-3);
    expect(Math.max(...v)).toBeGreaterThan(5.3);
    expect(Math.max(...v)).toBeLessThan(5.6);
  });

  it('741 slew rate: 10 Vpp kare dalga eğimi ≈ 0,5 V/µs', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'V1', { amp: 5, freq: 5000, wave: 'square' }], ['opamp', 'U1', { model: 'LM741' }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'U1.p'], ['U1.n', 'U1.o'], ['V1.n', 'G.g'], ['U1.o', 'L.p']],
      ),
    );
    const { v, t } = trace(sim, 400e-6, 0.2e-6, () => sim.netV(net('OUT')), 200e-6);
    let maxSlope = 0;
    for (let i = 1; i < v.length; i++) maxSlope = Math.max(maxSlope, Math.abs(v[i] - v[i - 1]) / (t[i] - t[i - 1]));
    expect(maxSlope / 1e6).toBeGreaterThan(0.4);
    expect(maxSlope / 1e6).toBeLessThan(0.6);
  });
});

describe('Bağımlı kaynaklar', () => {
  it('VCVS ×10, VCCS, CCCS, CCVS', () => {
    const { sim, net } = setup(
      quickDoc(
        [
          ['vdc', 'V1', { V: 1 }], ['ground', 'G'],
          ['vcvs', 'E1', { gain: 10 }], ['resistor', 'RE', { R: 1e3 }], ['label', 'LE', { text: 'E' }],
          ['vccs', 'G1', { gain: 2e-3 }], ['resistor', 'RG', { R: 1e3 }], ['label', 'LG', { text: 'GN' }],
          ['resistor', 'RS', { R: 1e3 }], ['cccs', 'F1', { gain: 5 }], ['resistor', 'RF', { R: 100 }], ['label', 'LF', { text: 'F' }],
          ['ccvs', 'H1', { gain: 2000 }], ['resistor', 'RS2', { R: 1e3 }], ['resistor', 'RH', { R: 1e3 }], ['label', 'LH', { text: 'H' }],
        ],
        [
          ['V1.p', 'E1.cp'], ['E1.cn', 'G.g'], ['V1.n', 'G.g'], ['E1.op', 'RE.a'], ['RE.b', 'G.g'], ['E1.on', 'G.g'], ['E1.op', 'LE.p'],
          ['V1.p', 'G1.cp'], ['G1.cn', 'G.g'], ['G1.on', 'RG.a'], ['RG.b', 'G.g'], ['G1.op', 'G.g'], ['G1.on', 'LG.p'],
          ['V1.p', 'RS.a'], ['RS.b', 'F1.sp'], ['F1.sn', 'G.g'], ['F1.on', 'RF.a'], ['RF.b', 'G.g'], ['F1.op', 'G.g'], ['F1.on', 'LF.p'],
          ['V1.p', 'RS2.a'], ['RS2.b', 'H1.sp'], ['H1.sn', 'G.g'], ['H1.op', 'RH.a'], ['RH.b', 'G.g'], ['H1.on', 'G.g'], ['H1.op', 'LH.p'],
        ],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('E'))).toBeCloseTo(10, 6);
    // G: op'dan kaynak içinden on'a 2 mA → on düğümüne 2 mA çıkar → RG üzerinde +2 V
    expect(sim.netV(net('GN'))).toBeCloseTo(2, 6);
    // F: algılanan akım 1 mA → 5 mA, on düğümünden çıkar → RF üzerinde +0,5 V
    expect(sim.netV(net('F'))).toBeCloseTo(0.5, 6);
    expect(sim.netV(net('H'))).toBeCloseTo(2, 6);
  });
});

describe('Pasif / sensör / regülatör', () => {
  it('potansiyometre %25 → 2,5 V', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 10 }], ['pot', 'P1', { R: 10e3, pos: 0.75 }], ['ground', 'G'], ['label', 'L', { text: 'W' }]],
        [['V1.p', 'P1.a'], ['P1.b', 'G.g'], ['V1.n', 'G.g'], ['P1.w', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('W'))).toBeCloseTo(2.5, 6);
  });

  it('7805: 9 V girişte 5 V, 6 V girişte düşüm (~4 V)', () => {
    for (const [vin, lo, hi] of [[9, 4.95, 5.02], [6, 3.85, 4.05]] as const) {
      const { sim, net } = setup(
        quickDoc(
          [['vdc', 'V1', { V: vin }], ['reg78', 'U1', { Vout: 5 }], ['resistor', 'RL', { R: 100 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
          [['V1.p', 'U1.in'], ['U1.gnd', 'G.g'], ['U1.out', 'RL.a'], ['RL.b', 'G.g'], ['V1.n', 'G.g'], ['U1.out', 'L.p']],
        ),
      );
      sim.dcOperatingPoint();
      const v = sim.netV(net('OUT'));
      expect(v).toBeGreaterThan(lo);
      expect(v).toBeLessThan(hi);
    }
  });

  it('pil iç direnci: 9 V, 1,5 Ω, 15 Ω yük → 8,18 V', () => {
    const { sim, net } = setup(
      quickDoc(
        [['battery', 'B1', { V: 9, Rint: 1.5 }], ['resistor', 'RL', { R: 15 }], ['ground', 'G'], ['label', 'L', { text: 'T' }]],
        [['B1.p', 'RL.a'], ['RL.b', 'G.g'], ['B1.n', 'G.g'], ['B1.p', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('T'))).toBeCloseTo((9 * 15) / 16.5, 5);
  });
});

describe('Dijital', () => {
  const gateDoc = (type: string, a: boolean, b: boolean, pulldown = true): CircuitDoc =>
    quickDoc(
      [['logicin', 'A', { on: a }], ['logicin', 'B', { on: b }], [type as never, 'G1'], ['ground', 'G'], ['label', 'L', { text: 'Y' }]],
      [['A.y', 'G1.a'], ['B.y', 'G1.b'], ['G1.y', 'L.p']],
    );
  const truth: Record<string, number[]> = { and: [0, 0, 0, 1], or: [0, 1, 1, 1], nand: [1, 1, 1, 0], nor: [1, 0, 0, 0], xor: [0, 1, 1, 0] };
  for (const [g, tt] of Object.entries(truth)) {
    it(`${g} doğruluk tablosu`, () => {
      [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ].forEach(([a, b], i) => {
        const { sim, net } = setup(gateDoc(g, a, b));
        sim.dcOperatingPoint();
        const y = sim.netV(net('Y'));
        expect(y > 2.5 ? 1 : 0, `${g}(${a},${b})`).toBe(tt[i]);
      });
    });
  }

  it('boşta giriş belirsiz, pull-down ile 0', () => {
    const floating = setup(
      quickDoc([['not', 'N1'], ['ground', 'G'], ['label', 'L', { text: 'IN' }], ['label', 'L2', { text: 'Y' }]], [['N1.a', 'L.p'], ['N1.y', 'L2.p']]),
    );
    floating.sim.dcOperatingPoint();
    const vin = floating.sim.netV(floating.net('IN'));
    expect(vin).toBeGreaterThan(2);
    expect(vin).toBeLessThan(3);
    const pd = setup(
      quickDoc(
        [['not', 'N1'], ['resistor', 'RPD', { R: 10e3 }], ['ground', 'G'], ['label', 'L2', { text: 'Y' }]],
        [['N1.a', 'RPD.a'], ['RPD.b', 'G.g'], ['N1.y', 'L2.p']],
      ),
    );
    pd.sim.dcOperatingPoint();
    expect(pd.sim.netV(pd.net('Y'))).toBeGreaterThan(4.9);
  });

  it('D flip-flop ile ÷2 frekans bölücü', () => {
    const { sim, net } = setup(
      quickDoc(
        [['clock', 'C1', { freq: 1000 }], ['dff', 'FF1'], ['ground', 'G'], ['label', 'L', { text: 'Q' }]],
        [['C1.p', 'FF1.clk'], ['C1.n', 'G.g'], ['FF1.qn', 'FF1.d'], ['FF1.q', 'L.p']],
      ),
    );
    const { v } = trace(sim, 8e-3, 5e-6, () => sim.netV(net('Q')));
    let rises = 0;
    for (let i = 1; i < v.length; i++) if (v[i - 1] < 2.5 && v[i] >= 2.5) rises++;
    expect(rises).toBe(4);
  });

  it('NOR SR mandalı: set/reset sonrası durumunu korur', () => {
    const mk = (s: boolean, r: boolean) =>
      quickDoc(
        [['logicin', 'S', { on: s }], ['logicin', 'R', { on: r }], ['nor', 'N1'], ['nor', 'N2'], ['ground', 'G'], ['label', 'L', { text: 'Q' }]],
        [['R.y', 'N1.a'], ['N2.y', 'N1.b'], ['S.y', 'N2.a'], ['N1.y', 'N2.b'], ['N1.y', 'L.p']],
      );
    const a = setup(mk(true, false));
    const ra = trace(a.sim, 1e-5, 1e-7, () => a.sim.netV(a.net('Q')));
    expect(ra.v[ra.v.length - 1]).toBeGreaterThan(4.5);
    const b = setup(mk(false, true));
    const rb = trace(b.sim, 1e-5, 1e-7, () => b.sim.netV(b.net('Q')));
    expect(rb.v[rb.v.length - 1]).toBeLessThan(0.5);
  });
});

describe('555', () => {
  it('astable: f ≈ 1,44 / ((R1 + 2R2)·C)', () => {
    const R1 = 1e3;
    const R2 = 10e3;
    const C = 100e-9;
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'VCC', { V: 9 }], ['timer555', 'U1'], ['resistor', 'R1', { R: R1 }], ['resistor', 'R2', { R: R2 }], ['capacitor', 'C1', { C }], ['capacitor', 'C2', { C: 10e-9 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [
          ['VCC.p', 'U1.vcc'], ['VCC.p', 'U1.reset'], ['VCC.n', 'G.g'], ['U1.gnd', 'G.g'],
          ['VCC.p', 'R1.a'], ['R1.b', 'U1.dis'], ['U1.dis', 'R2.a'], ['R2.b', 'U1.thr'], ['U1.thr', 'U1.trig'], ['U1.trig', 'C1.a'], ['C1.b', 'G.g'],
          ['U1.ctrl', 'C2.a'], ['C2.b', 'G.g'], ['U1.out', 'L.p'],
        ],
      ),
    );
    const { v, t } = trace(sim, 20e-3, 2e-6, () => sim.netV(net('OUT')), 5e-3);
    const rises: number[] = [];
    for (let i = 1; i < v.length; i++) if (v[i - 1] < 4 && v[i] >= 4) rises.push(t[i]);
    const T = (rises[rises.length - 1] - rises[0]) / (rises.length - 1);
    const fExp = 1.44 / ((R1 + 2 * R2) * C);
    expect(1 / T / fExp).toBeGreaterThan(0.93);
    expect(1 / T / fExp).toBeLessThan(1.07);
  });
});
