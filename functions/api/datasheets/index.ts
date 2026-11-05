// GET  /api/datasheets?key=npn          → kullanıcının o elemana yüklediği PDF'ler
// POST /api/datasheets?key=npn&name=x.pdf (gövde: PDF) → R2'ye kaydet
import { err, json, requireUser, type Ctx } from '../../_lib';

const MAX = 20 * 1024 * 1024;
const MAX_PER_USER = 200;

export const onRequestGet = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const key = new URL(ctx.request.url).searchParams.get('key') ?? '';
  const { results } = await ctx.env.DB.prepare('SELECT id, key, name, size, created_at AS added FROM datasheets WHERE user_id = ? AND key = ? ORDER BY created_at DESC')
    .bind(u.id, key)
    .all();
  return json({ items: results });
};

export const onRequestPost = async (ctx: Ctx) => {
  const u = await requireUser(ctx);
  if (u instanceof Response) return u;
  const url = new URL(ctx.request.url);
  const key = (url.searchParams.get('key') ?? '').slice(0, 64);
  const name = (url.searchParams.get('name') ?? 'datasheet.pdf').replace(/[\\/\r\n]/g, '_').slice(0, 120);
  if (!key) return err('Eleman anahtarı (key) eksik.');
  const len = Number(ctx.request.headers.get('content-length') ?? 0);
  if (len > MAX) return err('Dosya 20 MB’tan büyük.', 413);
  const count = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM datasheets WHERE user_id = ?').bind(u.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PER_USER) return err('Datasheet sınırına ulaştın (200).', 429);

  const buf = await ctx.request.arrayBuffer();
  if (buf.byteLength > MAX) return err('Dosya 20 MB’tan büyük.', 413);
  const head = new Uint8Array(buf.slice(0, 5));
  if (String.fromCharCode(...head) !== '%PDF-') return err('Yalnızca PDF yüklenebilir.', 415);

  const id = crypto.randomUUID();
  await ctx.env.FILES.put(`ds/${u.id}/${id}.pdf`, buf, { httpMetadata: { contentType: 'application/pdf', contentDisposition: `inline; filename="${encodeURIComponent(name)}"` } });
  const added = Date.now();
  await ctx.env.DB.prepare('INSERT INTO datasheets (id, user_id, key, name, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, u.id, key, name, buf.byteLength, added)
    .run();
  return json({ id, key, name, size: buf.byteLength, added }, 201);
};
