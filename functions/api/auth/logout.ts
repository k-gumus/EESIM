// POST /api/auth/logout
import { cookie, getCookie, json, sha256, SESSION_COOKIE, type Ctx } from '../../_lib';

export const onRequestPost = async (ctx: Ctx) => {
  const token = getCookie(ctx.request, SESSION_COOKIE);
  if (token) await ctx.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookie(ctx.request, SESSION_COOKIE, '', 0) });
};
