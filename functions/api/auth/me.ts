// GET /api/auth/me → oturumdaki kullanıcı (yoksa 401)
import { currentUser, err, json, publicUser, type Ctx } from '../../_lib';

export const onRequestGet = async (ctx: Ctx) => {
  const u = await currentUser(ctx.env, ctx.request);
  if (!u) return err('Oturum yok.', 401);
  return json({ user: publicUser(u) });
};
