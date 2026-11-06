// POST /api/auth/login  { email, password }
import { clientKey, createSession, dummyVerify, err, json, publicUser, rateLimit, sha256, verifyPassword, type Ctx, type UserRow } from '../../_lib';

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
  // Kimlik bilgisi doldurma (credential stuffing) koruması: farklı IP'lerden gelse de aynı hesaba saatte en çok 20 deneme
  if (!(await rateLimit(env, `login-acct:${(await sha256(email)).slice(0, 24)}`, 20, 3600)))
    return err('Bu hesap için çok fazla giriş denemesi yapıldı. Güvenliğin için bir saat sonra tekrar dene.', 429);

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  // Kullanıcı sayımına karşı: hesap yoksa ya da Google hesabıysa da aynı mesaj ve aynı süre
  const ok = user?.password_hash ? await verifyPassword(password, user.password_hash) : await dummyVerify(password);
  if (!user || !ok)
    return err(env.GOOGLE_CLIENT_ID ? 'E-posta ya da şifre hatalı. (Google ile kayıt olduysan “Google ile giriş yap”ı kullan.)' : 'E-posta ya da şifre hatalı.', 401);
  const setCookie = await createSession(env, request, user.id);
  return json({ user: publicUser(user) }, 200, { 'set-cookie': setCookie });
};
