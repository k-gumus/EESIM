// GET    /api/auth/me → oturumdaki kullanıcı (yoksa 401)
// DELETE /api/auth/me → hesabı ve tüm verilerini kalıcı olarak sil (KVKK: silme hakkı)
import { cookie, currentUser, err, json, publicUser, SESSION_COOKIE, type Ctx } from '../../_lib';

export const onRequestGet = async (ctx: Ctx) => {
  const u = await currentUser(ctx.env, ctx.request);
  if (!u) return err('Oturum yok.', 401);
  return json({ user: publicUser(u) });
};

export const onRequestDelete = async (ctx: Ctx) => {
  const { env, request } = ctx;
  const u = await currentUser(env, request);
  if (!u) return err('Oturum yok.', 401);

  // Bulut deposundaki PDF'ler (R2 bağlıysa)
  if (env.FILES) {
    const { results } = await env.DB.prepare('SELECT id FROM datasheets WHERE user_id = ?').bind(u.id).all<{ id: string }>();
    const keys = results.map((r) => `ds/${u.id}/${r.id}.pdf`);
    for (let i = 0; i < keys.length; i += 500) await env.FILES.delete(keys.slice(i, i + 500));
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM datasheets WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM ai_usage WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': cookie(request, SESSION_COOKIE, '', 0) });
};
