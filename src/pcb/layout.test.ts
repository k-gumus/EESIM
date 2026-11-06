import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates';
import { docToGraph } from '../circuit/doc';
import { buildPcb } from './layout';

describe('PCB yerleşimi', () => {
  it('tüm şablonlar hatasız yerleşir; pad↔net eşlemesi ve ratsnest tutarlı', () => {
    for (const tpl of TEMPLATES) {
      const { nodes, edges } = docToGraph(tpl.doc);
      const pcb = buildPcb(nodes, edges);

      // footprint yalnızca ground/label dışı elemanlar için üretilir
      const expected = nodes.filter((n) => n.data.type !== 'ground' && n.data.type !== 'label').length;
      expect(pcb.footprints.length, tpl.id).toBe(expected);

      // her pad geçerli bir net'e eşlenir
      for (const f of pcb.footprints) for (const p of f.pads) expect(p.net, `${tpl.id}/${f.name}.${p.pin}`).toBeGreaterThanOrEqual(0);

      // ratsnest GND (net 0) içermez — GND zemin bakırıdır
      for (const r of pcb.rats) expect(r.net, tpl.id).toBeGreaterThan(0);

      // MST değişmezi: net başına rat sayısı = (o net'teki pad sayısı − 1)
      const padCount = new Map<number, number>();
      for (const f of pcb.footprints) for (const p of f.pads) if (p.net > 0) padCount.set(p.net, (padCount.get(p.net) ?? 0) + 1);
      const ratCount = new Map<number, number>();
      for (const r of pcb.rats) ratCount.set(r.net, (ratCount.get(r.net) ?? 0) + 1);
      for (const [net, c] of padCount) if (c >= 2) expect(ratCount.get(net) ?? 0, `${tpl.id} net${net}`).toBe(c - 1);

      expect(pcb.viewBox.w, tpl.id).toBeGreaterThan(0);
      expect(pcb.viewBox.h, tpl.id).toBeGreaterThan(0);
    }
  });

  it('LED-Ohm: pad sayıları, pin-1 kare pad ve GND işareti', () => {
    const { nodes, edges } = docToGraph(TEMPLATES.find((t) => t.id === 'led-ohm')!.doc);
    const pcb = buildPcb(nodes, edges);
    const r1 = pcb.footprints.find((f) => f.name === 'R1')!;
    expect(r1.pads.length).toBe(2);
    expect(r1.pads[0].shape).toBe('rect'); // ilk pin kare pad (pin-1 işareti)
    // devrede toprak olduğundan en az bir GND pad'i bulunmalı
    expect(pcb.footprints.some((f) => f.pads.some((p) => p.gnd))).toBe(true);
  });
});
