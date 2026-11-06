// POST /api/auth/login  { email, password }
import { clientKey, createSession, err, json, publicUser, rateLimit, verifyPassword, type Ctx, type UserRow } from '../../_lib';

export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
  // Kaba kuvvet koruması: IP başına 10 dk'da en çok 10 giriş denemesi
  if (!(await rateLimit(env, `login:${await clientKey(request)}`, 10, 600)))
    return err('Çok fazla giriş denemesi yaptın. Lütfen birkaç dakika sonra tekrar dene.', 429);
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return err('Geçersiz istek.');
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user) return err('E-posta ya da şifre hatalı.', 401);
  if (!user.password_hash) return err('Bu hesap Google ile açılmış. “Google ile giriş yap”ı kullan.', 401);
  if (!(await verifyPassword(password, user.password_hash))) return err('E-posta ya da şifre hatalı.', 401);
  const setCookie = await createSession(env, request, user.id);
  return json({ user: publicUser(user) }, 200, { 'set-cookie': setCookie });
};
