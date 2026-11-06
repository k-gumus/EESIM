// API ortak yardımcıları (Cloudflare Worker — worker/index.ts yönlendirir): yanıtlar, çerezler, oturum, parola özeti
/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  /** R2 (datasheet PDF'leri). R2 etkinleştirilmemişse bağlanmaz; o zaman PDF'ler tarayıcıda saklanır. */
  FILES?: R2Bucket;
  /** Statik site (dist/) */
  ASSETS?: Fetcher;
  AI?: Ai;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Günlük ücretsiz "Tepecan'a Sor" hakkı (varsayılan 20; premium için 200) */
  AI_DAILY_FREE?: string;
  AI_DAILY_PREMIUM?: string;
  AI_MODEL?: string;
  /** Premium kullanıcılar için (isteğe bağlı) daha büyük model */
  AI_MODEL_PREMIUM?: string;
  /** Yalnızca yerel geliştirme: Workers AI yokken sahte akış üret */
  AI_FAKE?: string;
}

export type Ctx = EventContext<Env, string, Record<string, unknown>>;

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  password_hash: string | null;
  google_sub: string | null;
  premium: number;
  created_at: number;
}

export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 30;

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const err = (message: string, status = 400) => json({ error: message }, status);

export function getCookie(req: Request, name: string): string | null {
  const h = req.headers.get('cookie');
  if (!h) return null;
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Yerel geliştirmede (http://localhost) Secure bayrağı tarayıcıyı engeller; https'te ekle */
export function cookie(req: Request, name: string, value: string, maxAge: number): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const randomToken = (bytes = 32) => {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// PBKDF2-SHA256. Cloudflare Workers en fazla 100 000 yinelemeye izin verir.
const PBKDF2_ITER = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const h = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(h)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2') return false;
  const h = await pbkdf2(password, unb64(salt), Number(iter));
  const ref = unb64(hash);
  if (h.length !== ref.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h[i] ^ ref[i];
  return diff === 0;
}

export const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar, premium: !!u.premium });

/** Yeni oturum aç → Set-Cookie başlığı */
export async function createSession(env: Env, req: Request, userId: string): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * 864e5)
    .run();
  await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, userId).run();
  return cookie(req, SESSION_COOKIE, token, SESSION_DAYS * 86400);
}

/** Çerezdeki oturumdan kullanıcıyı bul (yoksa null) */
export async function currentUser(env: Env, req: Request): Promise<UserRow | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256(token), Date.now())
    .first<UserRow>();
  return row ?? null;
}

export async function requireUser(ctx: Ctx): Promise<UserRow | Response> {
  const u = await currentUser(ctx.env, ctx.request);
  return u ?? err('Giriş yapmalısın.', 401);
}

export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Aynı kökenden gelmeyen durum değiştiren istekleri reddet (CSRF'e karşı ek önlem) */
export function sameOrigin(req: Request): boolean {
  const o = req.headers.get('origin');
  if (!o) return true; // aynı köken GET/form gönderimlerinde Origin olmayabilir
  return o === new URL(req.url).origin;
}

/** İstek yapanın IP'sinin kısa SHA-256 özeti (hız sınırı anahtarı; ham IP saklanmaz) */
export async function clientKey(req: Request): Promise<string> {
  return (await sha256(req.headers.get('cf-connecting-ip') ?? 'yerel')).slice(0, 24);
}

/**
 * Basit sabit-pencere hız sınırı (D1 ile). `windowSec` içinde `max` isteğe izin verir.
 * Bir hata olursa isteğe İZİN VERİR (fail-open) — sınır mekanizması asla gerçek kullanıcıyı kilitlemesin.
 * @returns true = izin ver, false = sınır aşıldı (429 dön)
 */
export async function rateLimit(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (k, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(k) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < ? THEN ? ELSE rate_limits.reset_at END
       RETURNING count`,
    )
      .bind(key, now + windowSec, now, now, now + windowSec)
      .first<{ count: number }>();
    return (row?.count ?? 1) <= max;
  } catch {
    return true; // fail-open
  }
}
