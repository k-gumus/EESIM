import { describe, expect, it } from 'vitest';
import { compileCircuit } from '../circuit/compile';
import { docToGraph, quickDoc } from '../circuit/doc';
import { Simulator } from './simulator';
import type { CircuitDoc } from '../circuit/types';
import { buildSpiceNetlist } from '../circuit/spice';

function setup(doc: CircuitDoc) {
  const { nodes, edges } = docToGraph(doc);
  const circ = compileCircuit(nodes, edges);
  const sim = new Simulator(circ);
  const net = (name: string) => {
    const i = circ.netNames.indexOf(name);
    if (i < 0) throw new Error('net yok: ' + name + ' / ' + circ.netNames.join(','));
    return i;
  };
  return { circ, sim, net, nodes, edges };
}

function run(sim: Simulator, tEnd: number, dt: number, probe: () => number) {
  const out: number[] = [];
  sim.dcOperatingPoint();
  while (sim.t < tEnd - dt / 2) {
    sim.step(dt);
    out.push(probe());
  }
  return out;
}

describe('MNA çözücü — doğrusal', () => {
  it('gerilim bölücü', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 10 }], ['resistor', 'R1', { R: 1000 }], ['resistor', 'R2', { R: 3000 }], ['ground', 'G'], ['label', 'L', { text: 'MID' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'R2.a'], ['R2.b', 'V1.n'], ['V1.n', 'G.g'], ['R1.b', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('MID'))).toBeCloseTo(7.5, 6);
  });

  it('RC alçak geçiren: kesim frekansında |H| = 0,707', () => {
    const R = 1000;
    const C = 1e-6;
    const fc = 1 / (2 * Math.PI * R * C);
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'V1', { amp: 1, freq: fc }], ['resistor', 'R1', { R }], ['capacitor', 'C1', { C }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'C1.a'], ['C1.b', 'G.g'], ['V1.n', 'G.g'], ['C1.a', 'L.p']],
      ),
    );
    const T = 1 / fc;
    const dt = T / 1000;
    const v = run(sim, 8 * T, dt, () => sim.netV(net('OUT')));
    const last = v.slice(-1000);
    const peak = Math.max(...last);
    expect(peak).toBeGreaterThan(0.70);
    expect(peak).toBeLessThan(0.715);
  });

  it('RL: DC çalışma noktasında bobin kısa devre', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 5 }], ['resistor', 'R1', { R: 100 }], ['inductor', 'L1', { L: 0.1 }], ['ground', 'G'], ['label', 'L', { text: 'X' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'L1.a'], ['L1.b', 'G.g'], ['V1.n', 'G.g'], ['R1.b', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('X'))).toBeCloseTo(0, 6);
    expect(sim.currentsOf('L1')![0]).toBeCloseTo(0.05, 6);
  });

  it('ideal trafo 10:1', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 100 }], ['xfmr', 'T1', { n: 10 }], ['resistor', 'RL', { R: 100 }], ['ground', 'G'], ['label', 'L', { text: 'S' }]],
        [['V1.p', 'T1.p1'], ['T1.p2', 'G.g'], ['V1.n', 'G.g'], ['T1.s1', 'RL.a'], ['RL.b', 'T1.s2'], ['T1.s2', 'G.g'], ['T1.s1', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('S'))).toBeCloseTo(10, 6);
    // Primer akımı: 0,1 A sekonder / 10 = 10 mA
    expect(Math.abs(sim.currentsOf('V1')![0])).toBeCloseTo(0.01, 6);
  });
});

describe('Yarı iletkenler', () => {
  it('diyot + direnç (1N4001)', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 5 }], ['resistor', 'R1', { R: 1000 }], ['diode', 'D1', { model: '1N4001', Is: 14.11e-9, N: 1.984 }], ['ground', 'G'], ['label', 'L', { text: 'A' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'D1.a'], ['D1.k', 'G.g'], ['V1.n', 'G.g'], ['R1.b', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    const vd = sim.netV(net('A'));
    const i = (5 - vd) / 1000;
    const expected = 14.11e-9 * (Math.exp(vd / (1.984 * 0.025852)) - 1);
    expect(vd).toBeGreaterThan(0.5);
    expect(vd).toBeLessThan(0.75);
    expect(i).toBeCloseTo(expected, 7);
  });

  it('zener regülatör 5,1 V', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'V1', { V: 12 }], ['resistor', 'R1', { R: 470 }], ['zener', 'Z1', { Vz: 5.1 }], ['resistor', 'RL', { R: 1000 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['V1.p', 'R1.a'], ['R1.b', 'Z1.k'], ['Z1.a', 'G.g'], ['R1.b', 'RL.a'], ['RL.b', 'G.g'], ['V1.n', 'G.g'], ['R1.b', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    const v = sim.netV(net('OUT'));
    expect(v).toBeGreaterThan(5.1);
    expect(v).toBeLessThan(5.3);
  });

  it('NPN ortak emetör (β=100)', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'VCC', { V: 10 }], ['vdc', 'VBB', { V: 5 }], ['resistor', 'RB', { R: 100e3 }], ['resistor', 'RC', { R: 1000 }], ['npn', 'Q1', { beta: 100 }], ['ground', 'G'], ['label', 'L', { text: 'C' }], ['label', 'L2', { text: 'B' }]],
        [['VCC.p', 'RC.a'], ['RC.b', 'Q1.c'], ['VBB.p', 'RB.a'], ['RB.b', 'Q1.b'], ['Q1.e', 'G.g'], ['VCC.n', 'G.g'], ['VBB.n', 'G.g'], ['Q1.c', 'L.p'], ['Q1.b', 'L2.p']],
      ),
    );
    sim.dcOperatingPoint();
    const vb = sim.netV(net('B'));
    const ib = (5 - vb) / 100e3;
    const vc = sim.netV(net('C'));
    expect(vb).toBeGreaterThan(0.6);
    expect(vb).toBeLessThan(0.75);
    expect((10 - vc) / 1000).toBeCloseTo(100 * ib, 5);
    expect(sim.probeOf('Q1').region).toBe(1);
  });

  it('PNP ayna devre', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'VEE', { V: 10 }], ['resistor', 'RB', { R: 100e3 }], ['resistor', 'RC', { R: 1000 }], ['pnp', 'Q1', { beta: 100 }], ['vdc', 'VB', { V: 5 }], ['ground', 'G'], ['label', 'L', { text: 'C' }]],
        [['VEE.p', 'Q1.e'], ['VEE.n', 'G.g'], ['Q1.b', 'RB.a'], ['RB.b', 'VB.p'], ['VB.n', 'G.g'], ['Q1.c', 'RC.a'], ['RC.b', 'G.g'], ['Q1.c', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    const vc = sim.netV(net('C'));
    // Ib ≈ (10 − 0,7 − 5)/100k = 43 µA → Ic ≈ 4,3 mA → Vc ≈ 4,3 V
    expect(vc).toBeGreaterThan(4.0);
    expect(vc).toBeLessThan(4.6);
  });

  it('NMOS doyum bölgesi', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'VDD', { V: 10 }], ['vdc', 'VG', { V: 3 }], ['resistor', 'RD', { R: 1000 }], ['nmos', 'M1', { Vth: 1, K: 2e-3 }], ['ground', 'G'], ['label', 'L', { text: 'D' }]],
        [['VDD.p', 'RD.a'], ['RD.b', 'M1.d'], ['VG.p', 'M1.g'], ['M1.s', 'G.g'], ['VDD.n', 'G.g'], ['VG.n', 'G.g'], ['M1.d', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    expect(sim.netV(net('D'))).toBeCloseTo(6, 4);
  });

  it('PMOS', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vdc', 'VDD', { V: 10 }], ['vdc', 'VG', { V: 7 }], ['resistor', 'RD', { R: 1000 }], ['pmos', 'M1', { Vth: 1, K: 2e-3 }], ['ground', 'G'], ['label', 'L', { text: 'D' }]],
        [['VDD.p', 'M1.s'], ['M1.d', 'RD.a'], ['RD.b', 'G.g'], ['VG.p', 'M1.g'], ['VDD.n', 'G.g'], ['VG.n', 'G.g'], ['M1.d', 'L.p']],
      ),
    );
    sim.dcOperatingPoint();
    // Vsg = 3, Vov = 2 → Id = 4 mA → Vd = 4 V
    expect(sim.netV(net('D'))).toBeCloseTo(4, 4);
  });
});

describe('EE212 deneyleri (geçici analiz)', () => {
  it('yarım dalga doğrultucu', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'VG1', { amp: 10, freq: 1000 }], ['diode', 'D1'], ['resistor', 'RL', { R: 1000 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['VG1.p', 'D1.a'], ['D1.k', 'RL.a'], ['RL.b', 'G.g'], ['VG1.n', 'G.g'], ['D1.k', 'L.p']],
      ),
    );
    const v = run(sim, 3e-3, 2e-6, () => sim.netV(net('OUT')));
    const max = Math.max(...v);
    const min = Math.min(...v);
    expect(max).toBeGreaterThan(9.1);
    expect(max).toBeLessThan(9.5);
    expect(min).toBeGreaterThan(-0.01);
  });

  it('köprü doğrultucu + trafo', () => {
    const { sim, net } = setup(
      quickDoc(
        [
          ['vac', 'VG1', { amp: 311, freq: 50 }], ['xfmr', 'T1', { n: 10 }],
          ['diode', 'D1'], ['diode', 'D2'], ['diode', 'D3'], ['diode', 'D4'],
          ['resistor', 'RL', { R: 1000 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }],
        ],
        [
          ['VG1.p', 'T1.p1'], ['T1.p2', 'G.g'], ['VG1.n', 'G.g'],
          ['T1.s1', 'D1.a'], ['T1.s2', 'D2.a'], ['D1.k', 'RL.a'], ['D2.k', 'RL.a'],
          ['D3.k', 'T1.s1'], ['D4.k', 'T1.s2'], ['D3.a', 'G.g'], ['D4.a', 'G.g'], ['RL.b', 'G.g'], ['RL.a', 'L.p'],
        ],
      ),
    );
    const v = run(sim, 60e-3, 20e-6, () => sim.netV(net('OUT')));
    const max = Math.max(...v);
    const tail = v.slice(-1000);
    expect(max).toBeGreaterThan(29.5);
    expect(max).toBeLessThan(30.5);
    expect(Math.min(...tail)).toBeGreaterThan(-0.05);
    // tam dalga: periyodun her iki yarısında da tepe olmalı → 20 ms'de 2 tepe
    let peaks = 0;
    for (let i = 1; i < tail.length - 1; i++) if (tail[i] > 29 && tail[i] >= tail[i - 1] && tail[i] > tail[i + 1]) peaks++;
    expect(peaks).toBe(2);
  });

  it('pozitif kenetleyici', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'VG1', { amp: 5, freq: 1000 }], ['capacitor', 'C1', { C: 1e-6 }], ['diode', 'D1', { model: '1N4148', Is: 2.52e-9, N: 1.752 }], ['resistor', 'RL', { R: 100e3 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['VG1.p', 'C1.a'], ['C1.b', 'D1.k'], ['D1.a', 'G.g'], ['C1.b', 'RL.a'], ['RL.b', 'G.g'], ['VG1.n', 'G.g'], ['C1.b', 'L.p']],
      ),
    );
    const v = run(sim, 20e-3, 2e-6, () => sim.netV(net('OUT')));
    const tail = v.slice(-500);
    const min = Math.min(...tail);
    const max = Math.max(...tail);
    expect(min).toBeGreaterThan(-0.7);
    expect(min).toBeLessThan(-0.2);
    expect(max).toBeGreaterThan(9.3);
    expect(max).toBeLessThan(10.2);
  });

  it('çift taraflı kırpıcı', () => {
    const { sim, net } = setup(
      quickDoc(
        [['vac', 'VG1', { amp: 8, freq: 1000 }], ['resistor', 'R1', { R: 1000 }], ['diode', 'D1'], ['vdc', 'VB1', { V: 3 }], ['diode', 'D2'], ['vdc', 'VB2', { V: 2 }], ['ground', 'G'], ['label', 'L', { text: 'OUT' }]],
        [['VG1.p', 'R1.a'], ['R1.b', 'D1.a'], ['D1.k', 'VB1.p'], ['VB1.n', 'G.g'], ['R1.b', 'D2.k'], ['D2.a', 'VB2.n'], ['VB2.p', 'G.g'], ['VG1.n', 'G.g'], ['R1.b', 'L.p']],
      ),
    );
    const v = run(sim, 2e-3, 2e-6, () => sim.netV(net('OUT')));
    expect(Math.max(...v)).toBeGreaterThan(3.4);
    expect(Math.max(...v)).toBeLessThan(3.9);
    expect(Math.min(...v)).toBeLessThan(-2.4);
    expect(Math.min(...v)).toBeGreaterThan(-2.9);
  });

  it('SPICE netlist üretimi', () => {
    const { circ, nodes } = setup(
      quickDoc(
        [['vac', 'VG1', { amp: 10, freq: 1000 }], ['diode', 'D1'], ['resistor', 'RL', { R: 1000 }], ['ground', 'G'], ['label', 'L', { text: 'VOUT' }]],
        [['VG1.p', 'D1.a'], ['D1.k', 'RL.a'], ['RL.b', 'G.g'], ['VG1.n', 'G.g'], ['D1.k', 'L.p']],
      ),
    );
    const net = buildSpiceNetlist(circ, nodes, 'Test');
    expect(net).toContain('RL VOUT 0 1k');
    expect(net).toMatch(/D1 N001 VOUT D1N4001/);
    expect(net).toContain('.model D1N4001 D(IS=14.11n N=1.984)');
    expect(net).toContain('.end');
  });
});
