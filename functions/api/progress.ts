// GET /api/progress → kayıtlı ilerleme;  PUT /api/progress { xp, streak, lastDay, done, completed }
import { err, json, requireUser, type Ctx } from '../_lib';

export const onRequestGet = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const row = await ctx.env.DB.prepare('SELECT data, updated_at FROM progress WHERE user_id = ?').bind(u.id).first<{ data: string; updated_at: number }>();
  return json({ progress: row ? JSON.parse(row.data) : null, updated: row?.updated_at ?? 0 });
};

export const onRequestPut = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const text = await ctx.request.text();
  if (text.length > 200_000) return err('İlerleme verisi çok büyük.', 413);
  let data: { xp?: unknown; done?: unknown; completed?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return err('Geçersiz JSON.');
  }
  if (typeof data.xp !== 'number' || typeof data.done !== 'object' || typeof data.completed !== 'object') return err('Eksik alan.');
  const now = Date.now();
  await ctx.env.DB.prepare(
    'INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
  )
    .bind(u.id, text, now)
    .run();
  return json({ ok: true, updated: now });
};
