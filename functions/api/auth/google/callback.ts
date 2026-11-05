// GET /api/auth/google/callback?code=…&state=… → kullanıcıyı oluştur/bağla, oturum aç, ana sayfaya dön
import { cookie, createSession, getCookie, type Ctx, type UserRow } from '../../../_lib';

const back = (req: Request, msg?: string, setCookies: string[] = []) => {
  const h = new Headers({ location: msg ? `/?login_error=${encodeURIComponent(msg)}` : '/?login=ok' });
  for (const c of [...setCookies, cookie(req, 'oauth_state', '', 0)]) h.append('set-cookie', c);
  return new Response(null, { status: 302, headers: h });
};

export const onRequestGet = async (ctx: Ctx) => {
  const { env, request } = ctx;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error')) return back(request, 'Google girişi iptal edildi.');
  if (!code || !state || state !== getCookie(request, 'oauth_state')) return back(request, 'Geçersiz ya da süresi dolmuş giriş isteği. Tekrar dene.');
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return back(request, 'Google ile giriş yapılandırılmamış.');

  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tok.ok) return back(request, 'Google ile bağlantı kurulamadı.');
  const { access_token } = (await tok.json()) as { access_token: string };
  const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${access_token}` } });
  if (!info.ok) return back(request, 'Google profil bilgisi alınamadı.');
  const g = (await info.json()) as { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string };
  if (!g.email || g.email_verified === false) return back(request, 'Google hesabının e-postası doğrulanmamış.');
  const email = g.email.toLowerCase();

  let user = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(g.sub).first<UserRow>();
  if (!user) {
    // Aynı e-postayla şifreli hesap varsa Google'ı ona bağla (Google e-postayı doğruladı)
    user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
    if (user) {
      await env.DB.prepare('UPDATE users SET google_sub = ?, avatar = COALESCE(avatar, ?) WHERE id = ?').bind(g.sub, g.picture ?? null, user.id).run();
    } else {
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO users (id, email, name, avatar, password_hash, google_sub, premium, created_at) VALUES (?, ?, ?, ?, NULL, ?, 0, ?)')
        .bind(id, email, (g.name ?? email.split('@')[0]).slice(0, 60), g.picture ?? null, g.sub, Date.now())
        .run();
      user = { id } as UserRow;
    }
  } else if (g.picture && g.picture !== user.avatar) {
    await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(g.picture, user.id).run();
  }
  return back(request, undefined, [await createSession(env, request, user.id)]);
};
