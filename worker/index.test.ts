import { describe, expect, it } from 'vitest';
import { route } from './index';
import { schemaStatements } from './schema';
import SCHEMA from '../schema.sql';

describe('Worker yönlendirici', () => {
  it('yolları ve yöntemleri doğru işleyiciye bağlar', () => {
    const r = route('GET', '/api/datasheets/abc-123');
    expect(typeof r).toBe('object');
    if (typeof r === 'object') expect(r.params.id).toBe('abc-123');
    expect(typeof route('POST', '/api/auth/login')).toBe('object');
    expect(typeof route('GET', '/api/auth/google/callback')).toBe('object');
    expect(route('PATCH', '/api/progress')).toBe('method');
    expect(route('GET', '/api/yok')).toBe('not-found');
  });
  it('şema ifadeleri yorumlardan arındırılıp ayrılır', () => {
    const st = schemaStatements(SCHEMA);
    // Şemaya tablo eklendikçe sayı artabilir; sabit sayı yerine her ifadenin geçerli olduğunu doğrula.
    expect(st.length).toBeGreaterThanOrEqual(7);
    for (const s of st) expect(s).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS/);
  });
});
