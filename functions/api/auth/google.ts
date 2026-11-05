// GET /api/auth/google → Google OAuth 2.0 onay ekranına yönlendir
import { cookie, err, randomToken, type Ctx } from '../../_lib';

export const onRequestGet = (ctx: Ctx) => {
  const { env, request } = ctx;
  if (!env.GOOGLE_CLIENT_ID) return err('Google ile giriş henüz yapılandırılmadı (GOOGLE_CLIENT_ID yok).', 501);
  const origin = new URL(request.url).origin;
  const state = randomToken(16);
  const p = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return new Response(null, {
    status: 302,
    headers: { location: `https://accounts.google.com/o/oauth2/v2/auth?${p}`, 'set-cookie': cookie(request, 'oauth_state', state, 600) },
  });
};
