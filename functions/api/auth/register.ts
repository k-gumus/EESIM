// POST /api/auth/register  { name, email, password }
import { createSession, err, hashPassword, isEmail, json, publicUser, type Ctx, type UserRow } from '../../_lib';

export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return err('Geçersiz istek.');
  }
  const name = (body.name ?? '').trim().slice(0, 60);
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!name) return err('Adını yazmalısın.');
  if (!isEmail(email)) return err('Geçerli bir e-posta adresi yaz.');
  if (password.length < 8) return err('Şifre en az 8 karakter olmalı.');
  if (password.length > 200) return err('Şifre çok uzun.');

  const exists = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(email).first<Pick<UserRow, 'id' | 'password_hash'>>();
  if (exists) {
    return err(exists.password_hash ? 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.' : 'Bu e-posta Google ile kayıtlı. “Google ile giriş yap”ı kullan.', 409);
  }
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    name,
    avatar: null,
    password_hash: await hashPassword(password),
    google_sub: null,
    premium: 0,
    created_at: Date.now(),
  };
  await env.DB.prepare('INSERT INTO users (id, email, name, avatar, password_hash, google_sub, premium, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, user.email, user.name, user.avatar, user.password_hash, user.google_sub, user.premium, user.created_at)
    .run();
  const setCookie = await createSession(env, request, user.id);
  return json({ user: publicUser(user), created: true }, 201, { 'set-cookie': setCookie });
};
