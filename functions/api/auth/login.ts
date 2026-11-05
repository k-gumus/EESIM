// POST /api/auth/login  { email, password }
import { createSession, err, json, publicUser, verifyPassword, type Ctx, type UserRow } from '../../_lib';

export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
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
