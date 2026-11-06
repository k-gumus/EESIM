// KVKK silme hakkı: DELETE /api/auth/me hesabı ve tüm verilerini siler, oturum çerezini temizler
import { describe, expect, it } from 'vitest';
import { route } from './index';
import { onRequestDelete } from '../functions/api/auth/me';
import { sha256, type Ctx } from '../functions/_lib';

describe('Hesap silme', () => {
  it('yönlendirici DELETE /api/auth/me isteğini kabul eder', () => {
    expect(typeof route('DELETE', '/api/auth/me')).toBe('object');
  });

  it('oturumdaki kullanıcının tüm satırlarını siler ve çerezi boşaltır', async () => {
    const token = 'abc123';
    const th = await sha256(token);
    const ran: string[] = [];
    const DB = {
      prepare(sql: string) {
        const st = {
          args: [] as unknown[],
          bind(...a: unknown[]) {
            st.args = a;
            return st;
          },
          async first() {
            if (sql.includes('FROM sessions')) return st.args[0] === th ? { id: 'u1', email: 'a@b.c', name: 'A', premium: 0 } : null;
            return null;
          },
          async all() {
            return { results: [] };
          },
          sql,
        };
        return st;
      },
      async batch(list: { sql: string; args: unknown[] }[]) {
        for (const s of list) ran.push(`${s.sql} [${s.args.join(',')}]`);
        return [];
      },
    };
    const request = new Request('https://eeesim.fyi/api/auth/me', { method: 'DELETE', headers: { cookie: `sid=${token}` } });
    const r = await onRequestDelete({ request, env: { DB }, params: {} } as unknown as Ctx);
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/sid=;.*Max-Age=0/i);
    for (const tbl of ['datasheets', 'progress', 'ai_usage', 'sessions', 'users']) expect(ran.some((x) => x.startsWith(`DELETE FROM ${tbl}`) && x.endsWith('[u1]'))).toBe(true);
  });

  it('oturum yoksa 401 döner', async () => {
    const DB = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
    const r = await onRequestDelete({ request: new Request('https://eeesim.fyi/api/auth/me', { method: 'DELETE' }), env: { DB }, params: {} } as unknown as Ctx);
    expect(r.status).toBe(401);
  });
});
