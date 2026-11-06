// v0.3 yeni bileşenler: buzzer, PTC, varistör, sigorta
import { describe, expect, it } from 'vitest';
import { doc } from '../templates/lib';
import { docToGraph } from '../circuit/doc';
import { compileCircuit } from '../circuit/compile';
import { Simulator } from './simulator';
import type { CircuitDoc } from '../circuit/types';

function build(d: CircuitDoc) {
  const { nodes, edges } = docToGraph(d);
  const circ = compileCircuit(nodes, edges);
  const sim = new Simulator(circ);
  sim.dcOperatingPoint();
  const net = (name: string) => circ.netNames.indexOf(name);
  const vOf = (name: string) => sim.netV(net(name));
  return { circ, sim, vOf };
}

describe('yeni bileşenler', () => {
  it('buzzer: 100 Ω yük, 9 V → ≈ 90 mA', () => {
    const d = doc('bz', [
      ['vdc', 'V1', 100, 100, 0, { V: 9 }],
      ['buzzer', 'BZ1', 240, 60, 0, { R: 100 }],
      ['ground', 'G1', 100, 220],
      ['ground', 'G2', 340, 160],
    ], [['V1.p', 'BZ1.a'], ['BZ1.b', 'G2.g'], ['V1.n', 'G1.g']]);
    const { sim } = build(d);
    const i = sim.currentsOf('BZ1')![0];
    expect(Math.abs(i)).toBeGreaterThan(0.088);
    expect(Math.abs(i)).toBeLessThan(0.092);
  });

  it('PTC: sıcakta direnç artar → aynı seri dirençte gerilim düşer', () => {
    const mk = (temp: number) =>
      doc('ptc', [
        ['vdc', 'V1', 100, 100, 0, { V: 10 }],
        ['resistor', 'R1', 240, 20, 90, { R: 100 }],
        ['ptc', 'PTC1', 240, 120, 90, { R25: 100, alpha: 0.04, temp }],
        ['label', 'VM', 300, 60, 0, { text: 'VM' }],
        ['ground', 'G1', 100, 220],
        ['ground', 'G2', 260, 200],
      ], [['V1.p', 'R1.a'], ['R1.b', 'PTC1.a'], ['VM.p', 'R1.b'], ['PTC1.b', 'G2.g'], ['V1.n', 'G1.g']]);
    const cold = build(mk(25)).vOf('VM'); // PTC=100 → bölücü 5 V
    const hot = build(mk(100)).vOf('VM'); // PTC≈2 kΩ → VM yükselir (PTC üstünde daha çok düşer)
    expect(cold).toBeGreaterThan(4.8);
    expect(cold).toBeLessThan(5.2);
    expect(hot).toBeGreaterThan(9.0); // 10·2000/2100 ≈ 9,5 V
  });

  it('varistör: V_n altında geçirir, üstünde kenetler', () => {
    const mk = (V: number) =>
      doc('mov', [
        ['vdc', 'V1', 100, 100, 0, { V }],
        ['resistor', 'RS', 240, 20, 90, { R: 1000 }],
        ['varistor', 'RV1', 240, 120, 90, { Vn: 10 }],
        ['label', 'VC', 300, 60, 0, { text: 'VC' }],
        ['ground', 'G1', 100, 220],
        ['ground', 'G2', 260, 200],
      ], [['V1.p', 'RS.a'], ['RS.b', 'RV1.a'], ['VC.p', 'RS.b'], ['RV1.b', 'G2.g'], ['V1.n', 'G1.g']]);
    const low = build(mk(5)).vOf('VC');
    const high = build(mk(60)).vOf('VC');
    expect(low).toBeGreaterThan(4.3); // V_n altında ~kaynak gerilimi
    expect(high).toBeGreaterThan(9); // kenetlendi: V_n civarı
    expect(high).toBeLessThan(18); // 60 V'tan çok aşağıda
  });

  it('sigorta: anma akımının altında geçirir, üstünde atar (kalıcı)', () => {
    const mk = (R: number) =>
      doc('fz', [
        ['vdc', 'V1', 100, 100, 0, { V: 5 }],
        ['fuse', 'F1', 240, 20, 0, { Irated: 0.1 }],
        ['resistor', 'RL', 360, 60, 90, { R }],
        ['label', 'VL', 420, 20, 0, { text: 'VL' }],
        ['ground', 'G1', 100, 220],
        ['ground', 'G2', 380, 160],
      ], [['V1.p', 'F1.a'], ['F1.b', 'RL.a'], ['VL.p', 'RL.a'], ['RL.b', 'G2.g'], ['V1.n', 'G1.g']]);

    // Hafif yük (50 mA < 100 mA): atmaz
    const ok = build(mk(100));
    for (let i = 0; i < 50; i++) ok.sim.step(1e-4);
    expect((ok.sim.byId.get('F1') as unknown as { blown: boolean }).blown).toBe(false);
    expect(ok.vOf('VL')).toBeGreaterThan(4.9);

    // Ağır yük (500 mA > 100 mA): atar ve açık kalır
    const blow = build(mk(10));
    for (let i = 0; i < 50; i++) blow.sim.step(1e-4);
    expect((blow.sim.byId.get('F1') as unknown as { blown: boolean }).blown).toBe(true);
    expect(blow.vOf('VL')).toBeLessThan(0.1); // atınca yüke gerilim gelmez
  });

  it('JFET: V_GS=0 → I_D ≈ I_DSS; V_GS=−2 → ≈ I_DSS/4', () => {
    const d0 = doc('jfet0', [
      ['vdc', 'VDD', 100, 0, 0, { V: 10 }],
      ['resistor', 'RD', 240, -40, 90, { R: 330 }],
      ['jfet', 'J1', 220, 60, 0, { Idss: 10e-3, Vp: -4 }],
      ['ground', 'G1', 100, 120],
      ['ground', 'G2', 300, 200],
    ], [['VDD.p', 'RD.a'], ['RD.b', 'J1.d'], ['J1.s', 'G2.g'], ['J1.g', 'G2.g'], ['VDD.n', 'G1.g']]);
    const id0 = build(d0).sim.currentsOf('J1')![1];
    expect(Math.abs(id0)).toBeGreaterThan(0.008);
    expect(Math.abs(id0)).toBeLessThan(0.012);

    const d2 = doc('jfet2', [
      ['vdc', 'VDD', 100, 0, 0, { V: 10 }],
      ['resistor', 'RD', 240, -40, 90, { R: 330 }],
      ['jfet', 'J1', 220, 60, 0, { Idss: 10e-3, Vp: -4 }],
      ['vdc', 'VG', 20, 200, 0, { V: -2 }],
      ['ground', 'G1', 100, 120],
      ['ground', 'G2', 300, 200],
    ], [['VDD.p', 'RD.a'], ['RD.b', 'J1.d'], ['J1.s', 'G2.g'], ['VG.p', 'J1.g'], ['VG.n', 'G2.g'], ['VDD.n', 'G1.g']]);
    const id2 = build(d2).sim.currentsOf('J1')![1];
    expect(Math.abs(id2)).toBeGreaterThan(0.002);
    expect(Math.abs(id2)).toBeLessThan(0.0032);
  });

  it('TL431: şönt regülatör ≈ 5 V; giriş değişse de çıkış sabit', () => {
    const mk = (Vin: number) => doc('tl431', [
      ['vdc', 'V1', 100, 0, 0, { V: Vin }],
      ['resistor', 'RS', 240, -40, 90, { R: 1000 }],
      ['tl431', 'U1', 220, 60, 0, {}],
      ['resistor', 'R1', 360, 20, 90, { R: 10e3 }],
      ['resistor', 'R2', 360, 150, 90, { R: 10e3 }],
      ['label', 'VO', 300, -20, 0, { text: 'VO' }],
      ['ground', 'G1', 100, 120],
      ['ground', 'G2', 380, 250],
    ], [
      ['V1.p', 'RS.a'], ['RS.b', 'U1.k'], ['VO.p', 'U1.k'],
      ['U1.k', 'R1.a'], ['R1.b', 'U1.ref'], ['U1.ref', 'R2.a'], ['R2.b', 'G2.g'],
      ['U1.a', 'G2.g'], ['V1.n', 'G1.g'],
    ]);
    const v12 = build(mk(12)).vOf('VO');
    const v15 = build(mk(15)).vOf('VO');
    expect(v12).toBeGreaterThan(4.8); // 2,495·(1+10k/10k) ≈ 4,99 V
    expect(v12).toBeLessThan(5.2);
    expect(Math.abs(v15 - v12)).toBeLessThan(0.1); // hat regülasyonu
  });

  it('opto-kuplör: LED sürülünce çıkış iletir (≈ CTR·I_LED), sönükken kesim', () => {
    const mk = (vin: number) => doc('opto', [
      ['vdc', 'V1', 20, 0, 0, { V: vin }],
      ['resistor', 'R1', 140, -40, 90, { R: 330 }],
      ['vdc', 'V2', 360, 0, 0, { V: 5 }],
      ['resistor', 'RL', 480, -40, 90, { R: 330 }],
      ['opto', 'OK1', 240, 60, 0, { CTR: 0.5 }],
      ['label', 'VC', 540, 20, 0, { text: 'VC' }],
      ['ground', 'G1', 20, 120],
      ['ground', 'G2', 360, 120],
    ], [
      ['V1.p', 'R1.a'], ['R1.b', 'OK1.a'], ['OK1.k', 'G1.g'], ['V1.n', 'G1.g'],
      ['V2.p', 'RL.a'], ['RL.b', 'OK1.c'], ['VC.p', 'OK1.c'], ['OK1.e', 'G2.g'], ['V2.n', 'G2.g'],
    ]);
    const on = build(mk(5)); // I_LED ≈ (5−1,2)/330 ≈ 11,5 mA → I_C ≈ 5,75 mA
    const ic = Math.abs(on.sim.currentsOf('OK1')![2]);
    expect(ic).toBeGreaterThan(0.004);
    expect(ic).toBeLessThan(0.0065);
    expect(on.vOf('VC')).toBeLessThan(3.6); // kolektör aşağı çekildi
    const off = build(mk(0));
    expect(Math.abs(off.sim.currentsOf('OK1')![2])).toBeLessThan(5e-4);
    expect(off.vOf('VC')).toBeGreaterThan(4.5); // kesim: kolektör ≈ besleme
  });

  it('DC motor: kalkışta yüksek akım (≈ V/R), hızlandıkça akım düşer', () => {
    const d = doc('motor', [
      ['vdc', 'V1', 100, 0, 0, { V: 12 }],
      ['motor', 'M1', 240, 40, 0, { R: 1.5, Ke: 0.015, L: 0.5e-3, J: 2e-5, B: 5e-5 }],
      ['ground', 'G1', 100, 120],
      ['ground', 'G2', 360, 120],
    ], [['V1.p', 'M1.a'], ['M1.b', 'G2.g'], ['V1.n', 'G1.g']]);
    const { sim } = build(d);
    const stall = Math.abs(sim.currentsOf('M1')![0]);
    expect(stall).toBeGreaterThan(7); // ≈ 12/1,5 = 8 A (ω = 0)
    expect(stall).toBeLessThan(9);
    for (let i = 0; i < 4000; i++) sim.step(1e-4); // 0,4 s → hızlanma
    const run = Math.abs(sim.currentsOf('M1')![0]);
    expect(run).toBeGreaterThan(1);
    expect(run).toBeLessThan(3); // ≈ 2 A
    const m = sim.byId.get('M1') as unknown as { w: number };
    expect(m.w).toBeGreaterThan(400); // ≈ 600 rad/s
  });

  it('röle: bobin çekince COM→NO, boşta COM→NC', () => {
    const mk = (vcoil: number) => doc('relay', [
      ['vdc', 'VC', 20, 0, 0, { V: vcoil }],
      ['relay', 'K1', 160, 40, 0, { Rcoil: 200, Ipull: 0.04, L: 0.5 }],
      ['vdc', 'VS', 360, 0, 0, { V: 5 }],
      ['resistor', 'RNO', 500, -40, 90, { R: 1e3 }],
      ['resistor', 'RNC', 580, -40, 90, { R: 1e3 }],
      ['label', 'VNO', 480, 20, 0, { text: 'VNO' }],
      ['label', 'VNC', 560, 20, 0, { text: 'VNC' }],
      ['ground', 'G1', 20, 120],
      ['ground', 'G2', 360, 120],
    ], [
      ['VC.p', 'K1.c1'], ['K1.c2', 'G1.g'], ['VC.n', 'G1.g'],
      ['VS.p', 'K1.com'], ['VS.n', 'G2.g'],
      ['K1.no', 'RNO.a'], ['RNO.b', 'G2.g'], ['VNO.p', 'K1.no'],
      ['K1.nc', 'RNC.a'], ['RNC.b', 'G2.g'], ['VNC.p', 'K1.nc'],
    ]);
    const en = (s: ReturnType<typeof build>) => (s.sim.byId.get('K1') as unknown as { energized: boolean }).energized;
    // boşta: bobinde akım yok → COM, NC'ye bağlı
    const off = build(mk(0));
    expect(en(off)).toBe(false);
    expect(off.vOf('VNC')).toBeGreaterThan(4.9);
    expect(off.vOf('VNO')).toBeLessThan(0.1);
    // bobin sürülü (12 V/200 Ω = 60 mA > 40 mA): birkaç ms sonra çeker
    const on = build(mk(12));
    for (let i = 0; i < 300; i++) on.sim.step(1e-4); // 30 ms
    expect(en(on)).toBe(true);
    expect(on.vOf('VNO')).toBeGreaterThan(4.9);
    expect(on.vOf('VNC')).toBeLessThan(0.1);
  });
});
