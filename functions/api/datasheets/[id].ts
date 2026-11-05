// GET /api/datasheets/:id → PDF;  DELETE /api/datasheets/:id
import { err, json, requireUser, type Ctx } from '../../_lib';

const idOf = (ctx: Ctx) => String(ctx.params.id ?? '');

export const onRequestGet = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const row = await ctx.env.DB.prepare('SELECT id, name FROM datasheets WHERE id = ? AND user_id = ?').bind(idOf(ctx), u.id).first<{ id: string; name: string }>();
  if (!row) return err('Bulunamadı.', 404);
  const obj = await ctx.env.FILES.get(`ds/${u.id}/${row.id}.pdf`);
  if (!obj) return err('Dosya bulunamadı.', 404);
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const onRequestDelete = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const id = idOf(ctx);
  const r = await ctx.env.DB.prepare('DELETE FROM datasheets WHERE id = ? AND user_id = ?').bind(id, u.id).run();
  if (!r.meta.changes) return err('Bulunamadı.', 404);
  await ctx.env.FILES.delete(`ds/${u.id}/${id}.pdf`);
  return json({ ok: true });
};
