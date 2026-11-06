// POST /api/auth/register  { name, email, password }
import { clientKey, createSession, err, hashPassword, isEmail, json, publicUser, rateLimit, type Ctx, type UserRow } from '../../_lib';

export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
  // Spam/otomasyon koruması: IP başına saatte en çok 5 kayıt denemesi
  if (!(await rateLimit(env, `register:${await clientKey(request)}`, 5, 3600)))
    return err('Çok fazla kayıt denemesi yaptın. Lütfen biraz sonra tekrar dene.', 429);
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
  try {
    await env.DB.prepare('INSERT INTO users (id, email, name, avatar, password_hash, google_sub, premium, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(user.id, user.email, user.name, user.avatar, user.password_hash, user.google_sub, user.premium, user.created_at)
      .run();
  } catch (e) {
    // Yarış durumu: aynı e-postayla eşzamanlı iki kayıt → ikincisi UNIQUE kısıtına takılır
    if (/unique/i.test(String(e))) return err('Bu e-posta zaten kayıtlı. Giriş yapmayı dene.', 409);
    throw e;
  }
  const setCookie = await createSession(env, request, user.id);
  return json({ user: publicUser(user), created: true }, 201, { 'set-cookie': setCookie });
};
