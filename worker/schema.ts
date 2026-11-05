// D1 şemasını ilk istekte otomatik uygula: kurulumda "schema.sql'i çalıştır" adımı gerekmesin.
// Tüm ifadeler CREATE … IF NOT EXISTS olduğu için tekrar çalıştırmak zararsızdır.
import type { Env } from '../functions/_lib';
import SCHEMA from '../schema.sql';

let ready: Promise<void> | null = null;

export function schemaStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ensureSchema(env: Env): Promise<void> {
  if (!env.DB) return Promise.resolve();
  ready ??= env.DB.batch(schemaStatements(SCHEMA).map((s) => env.DB.prepare(s)))
    .then(() => undefined)
    .catch((e) => {
      ready = null; // bir sonraki istekte tekrar dene
      throw e;
    });
  return ready;
}
