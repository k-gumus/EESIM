// EESIM Cloudflare Worker: statik siteyi (dist/) sunar, /api/* isteklerini functions/ içindeki işleyicilere yönlendirir.
// İşleyiciler Pages Functions biçiminde yazıldı (onRequestGet/Post…); burada küçük bir uyarlayıcıyla çağrılıyor.
/// <reference types="@cloudflare/workers-types" />
import type { Ctx, Env } from '../functions/_lib';
import { err } from '../functions/_lib';
import { ensureSchema } from './schema';
import { onRequest as middleware } from '../functions/api/_middleware';
import * as health from '../functions/api/health';
import * as register from '../functions/api/auth/register';
import * as login from '../functions/api/auth/login';
import * as logout from '../functions/api/auth/logout';
import * as me from '../functions/api/auth/me';
import * as google from '../functions/api/auth/google';
import * as googleCallback from '../functions/api/auth/google/callback';
import * as progress from '../functions/api/progress';
import * as datasheets from '../functions/api/datasheets/index';
import * as datasheet from '../functions/api/datasheets/[id]';
import * as ask from '../functions/api/ask';

type Handler = (ctx: Ctx) => Response | Promise<Response>;
type Mod = Partial<Record<'onRequestGet' | 'onRequestPost' | 'onRequestPut' | 'onRequestDelete', Handler>>;

const ROUTES: [RegExp, Mod][] = [
  [/^\/api\/health$/, health],
  [/^\/api\/auth\/register$/, register],
  [/^\/api\/auth\/login$/, login],
  [/^\/api\/auth\/logout$/, logout],
  [/^\/api\/auth\/me$/, me],
  [/^\/api\/auth\/google$/, google],
  [/^\/api\/auth\/google\/callback$/, googleCallback],
  [/^\/api\/progress$/, progress],
  [/^\/api\/datasheets$/, datasheets],
  [/^\/api\/datasheets\/(?<id>[^/]+)$/, datasheet],
  [/^\/api\/ask$/, ask],
];

const METHOD: Record<string, keyof Mod> = { GET: 'onRequestGet', HEAD: 'onRequestGet', POST: 'onRequestPost', PUT: 'onRequestPut', DELETE: 'onRequestDelete' };

/** Yol ve yönteme göre işleyiciyi bul (test edilebilsin diye dışa açık) */
export function route(method: string, path: string): { handler: Handler; params: Record<string, string> } | 'not-found' | 'method' {
  for (const [re, mod] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    const key = METHOD[method];
    const handler = key ? mod[key] : undefined;
    return handler ? { handler, params: { ...(m.groups ?? {}) } } : 'method';
  }
  return 'not-found';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Statik dosyalar bağlı değil', { status: 500 });
    }
    const r = route(request.method, url.pathname);
    if (r === 'not-found') return err('Bulunamadı.', 404);
    if (r === 'method') return err('Bu yöntem desteklenmiyor.', 405);
    const ectx = {
      request,
      env,
      params: r.params,
      data: {},
      functionPath: url.pathname,
      waitUntil: ctx.waitUntil.bind(ctx),
      passThroughOnException: () => ctx.passThroughOnException(),
      next: async () => {
        // Veritabanı tabloları yoksa oluştur (ilk istekte bir kez; sonraki isteklerde hiçbir şey yapmaz)
        if (url.pathname !== '/api/health') await ensureSchema(env);
        return r.handler(ectx);
      },
    } as unknown as Ctx;
    return middleware(ectx);
  },

  // Zamanlanmış temizlik (wrangler.toml → [triggers] crons). Kendiliğinden büyüyen tabloları buda:
  // süresi dolmuş oturumlar, 7 günden eski kota satırları, süresi geçmiş hız sınırı kayıtları.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        if (!env.DB) return;
        const now = Date.now();
        await env.DB.batch([
          env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
          env.DB.prepare("DELETE FROM ai_usage WHERE day < date('now','-7 day')"),
          env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(Math.floor(now / 1000)),
        ]);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
