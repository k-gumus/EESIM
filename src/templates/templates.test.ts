import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './index';
import { docToGraph } from '../circuit/doc';
import { compileCircuit } from '../circuit/compile';
import { Simulator } from '../engine/simulator';
import type { CompiledCircuit } from '../circuit/types';

function runTemplate(id: string, mutate?: (doc: (typeof TEMPLATES)[number]['doc']) => void, periods = 6) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const doc = JSON.parse(JSON.stringify(t.doc));
  mutate?.(doc);
  const { nodes, edges } = docToGraph(doc);
  const circ: CompiledCircuit = compileCircuit(nodes, edges);
  const sim = new Simulator(circ);
  sim.dcOperatingPoint();
  const vac = circ.elements.find((e) => e.type === 'vac');
  const f = vac ? Number(vac.params.freq) : 0;
  const nets: Record<string, number[]> = {};
  circ.netNames.forEach((n) => (nets[n] = []));
  if (f) {
    const T = 1 / f;
    const dt = T / 400;
    while (sim.t < periods * T) {
      sim.step(dt);
      if (sim.t > (periods - 1) * T) circ.netNames.forEach((n, i) => nets[n].push(sim.netV(i)));
    }
  } else circ.netNames.forEach((n, i) => nets[n].push(sim.netV(i)));
  const st = (n: string) => {
    const a = nets[n];
    return { max: Math.max(...a), min: Math.min(...a), avg: a.reduce((x, y) => x + y, 0) / a.length };
  };
  return { circ, sim, st };
}

const set = (doc: any, name: string, params: Record<string, unknown>) => {
  const c = doc.components.find((x: any) => x.name === name);
  c.params = { ...c.params, ...params };
};

describe('Şablonlar', () => {
  it('hepsi hatasız derlenir', () => {
    for (const t of TEMPLATES) {
      const { nodes, edges } = docToGraph(t.doc);
      const circ = compileCircuit(nodes, edges);
      expect(circ.issues.filter((i) => i.level !== 'info'), t.id).toEqual([]);
      expect(edges.length, t.id).toBe(t.doc.wires.length);
    }
  });

  it('LED: anahtar kapalı ≈ 15 mA, 220 Ω → > 30 mA', () => {
    const a = runTemplate('led-ohm', (d) => set(d, 'S1', { closed: true }));
    const i = a.sim.branchCurrent('DMM1');
    expect(i).toBeGreaterThan(0.0145);
    expect(i).toBeLessThan(0.0158);
    const b = runTemplate('led-ohm', (d) => {
      set(d, 'S1', { closed: true });
      set(d, 'R1', { R: 220 });
    });
    expect(b.sim.branchCurrent('DMM1')).toBeGreaterThan(0.03);
  });

  it('yarım dalga: tepe ≈ 9,2 V, ort ≈ V_p/π, filtreli ripple < 0,95 V', () => {
    const a = runTemplate('half-wave');
    expect(a.st('VOUT').max).toBeGreaterThan(9.0);
    expect(a.st('VOUT').max).toBeLessThan(9.4);
    expect(a.st('VOUT').avg).toBeGreaterThan(2.7);
    expect(a.st('VOUT').avg).toBeLessThan(3.05);
    const b = runTemplate('half-wave', (d) => set(d, 'S1', { closed: true }), 12);
    const r = b.st('VOUT').max - b.st('VOUT').min;
    expect(r).toBeGreaterThan(0.6);
    expect(r).toBeLessThan(0.95);
  });

  it('köprü: tepe ≈ 29,6 V', () => {
    const a = runTemplate('full-wave', undefined, 3);
    expect(a.st('VOUT').max).toBeGreaterThan(29.2);
    expect(a.st('VOUT').max).toBeLessThan(30.0);
  });

  it('kırpıcı: +3,7 / −2,7', () => {
    const a = runTemplate('clipper');
    expect(a.st('VOUT').max).toBeGreaterThan(3.5);
    expect(a.st('VOUT').max).toBeLessThan(3.85);
    expect(a.st('VOUT').min).toBeLessThan(-2.5);
    expect(a.st('VOUT').min).toBeGreaterThan(-2.85);
  });

  it('kenetleyici: −0,6 … +9,4', () => {
    const a = runTemplate('clamper', undefined, 20);
    expect(a.st('VOUT').min).toBeGreaterThan(-0.75);
    expect(a.st('VOUT').min).toBeLessThan(-0.4);
    expect(a.st('VOUT').max).toBeGreaterThan(9.2);
    expect(a.st('VOUT').max).toBeLessThan(9.65);
  });

  it('zener: 15 V → I_Z ≈ 16 mA, RL=220 → regülasyon bozulur', () => {
    const a = runTemplate('zener', (d) => set(d, 'V1', { V: 15 }));
    const vout = a.st('VOUT').max;
    expect(vout).toBeGreaterThan(5.1);
    expect(vout).toBeLessThan(5.3);
    const iz = (15 - vout) / 470 - vout / 1000;
    expect(iz).toBeGreaterThan(0.0145);
    expect(iz).toBeLessThan(0.0175);
    const b = runTemplate('zener', (d) => set(d, 'RL', { R: 220 }));
    expect(b.st('VOUT').max).toBeLessThan(4.6);
    expect(b.st('VOUT').max).toBeGreaterThan(3.8);
  });

  it('BJT: I_C ≈ 1,3 mA, V_CE ≈ 7,7 V, β=200 ile küçük değişim', () => {
    const a = runTemplate('bjt-bias');
    const ic = a.sim.currentsOf('Q1')![1];
    expect(ic).toBeGreaterThan(0.00125);
    expect(ic).toBeLessThan(0.00145);
    const vce = a.st('VC').max - a.st('VE').max;
    expect(vce).toBeGreaterThan(7.3);
    expect(vce).toBeLessThan(8.1);
    const b = runTemplate('bjt-bias', (d) => set(d, 'Q1', { beta: 200 }));
    const ic2 = b.sim.currentsOf('Q1')![1];
    expect(ic2 / ic).toBeGreaterThan(1.01);
    expect(ic2 / ic).toBeLessThan(1.08);
  });
});
