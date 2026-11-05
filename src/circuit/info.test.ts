import { describe, expect, it } from 'vitest';
import { COMP_INFO } from './info';
import { PALETTE_ORDER } from './library';

describe('Bilgi kartları', () => {
  it('paletteki her eleman için kart var ve dolu', () => {
    for (const t of PALETTE_ORDER) {
      const i = COMP_INFO[t];
      expect(i, t).toBeTruthy();
      expect(i!.what.length, t).toBeGreaterThan(20);
      expect(i!.how.length, t).toBeGreaterThan(20);
      expect(i!.typical.length, t).toBeGreaterThan(0);
      for (const d of i!.datasheets ?? []) expect(d.url, t).toMatch(/^https:\/\//);
    }
  });
});
