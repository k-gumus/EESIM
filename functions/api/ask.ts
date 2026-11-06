// POST /api/ask  { messages: [{role, content}] }  → Workers AI yanıtı (SSE akışı)
//   Eski modeller `data: {"response":"…"}`, yeniler OpenAI biçiminde `data: {"choices":[{"delta":{"content":"…"}}]}` akıtır;
//   istemci (src/ai/providers.ts → parseSSE) ikisini de okur.
// Kota: misafir (IP başına) 5, ücretsiz hesap AI_DAILY_FREE (20), premium AI_DAILY_PREMIUM (200) soru/gün.
// Premium kullanıcılar AI_MODEL_PREMIUM tanımlıysa onu kullanır.
// Cloudflare bir modeli emekliye ayırırsa (ör. llama-3.1-8b, 30.05.2026) sıradaki yedek modele geçilir; Tepecan susmaz.
import { currentUser, err, sha256, type Ctx } from '../_lib';

const GUEST_DAILY = 5;
const MAX_CHARS = 24_000;
/** Ayarlanan model çalışmazsa sırayla denenecek modeller (Workers AI kataloğunda etkin olanlar) */
export const FALLBACK_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/zai-org/glm-4.7-flash', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
const MAX_ATTEMPTS = 5;

/** "Düşünen" (reasoning) yeni nesil modeller: düşünme kapatılır ki öğrenci beklemesin ve cevap hemen akmaya başlasın */
const isReasoningModel = (m: string) => /gemma-4|glm-|qwen3|kimi-|nemotron|deepseek-v|gpt-oss/.test(m);

/** Denenecek (model, girdi) çiftleri: önce ayarlanan model, sonra yedekler. Düşünme ayarı reddedilirse aynı model ayarsız denenir. */
export function aiAttempts(primary: string | undefined, messages: Msg[]): { model: string; inputs: Record<string, unknown> }[] {
  const models = [...new Set([primary, ...FALLBACK_MODELS].filter((m): m is string => !!m && m.trim().length > 0).map((m) => m.trim()))];
  const out: { model: string; inputs: Record<string, unknown> }[] = [];
  for (const model of models) {
    const base = { messages, stream: true, max_tokens: 1024, temperature: 0.3 };
    if (isReasoningModel(model)) out.push({ model, inputs: { ...base, chat_template_kwargs: { enable_thinking: false } } });
    out.push({ model, inputs: base });
  }
  return out;
}

export interface Msg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export const onRequestPost = async (ctx: Ctx) => {
  const { env, request } = ctx;
  const fake = env.AI_FAKE === '1';
  if (!env.AI && !fake) return err('Bulut yapay zekâsı bu sunucuda bağlı değil (Workers AI).', 503);

  let body: { messages?: Msg[] };
  try {
    body = await request.json();
  } catch {
    return err('Geçersiz istek.');
  }
  const messages = (body.messages ?? []).filter((m) => m && typeof m.content === 'string' && ['system', 'user', 'assistant'].includes(m.role));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return err('Soru bulunamadı.');
  // Bağlam çok uzunsa eski mesajları at (sistem istemi ve son soru kalır)
  while (messages.length > 2 && messages.reduce((a, m) => a + m.content.length, 0) > MAX_CHARS) messages.splice(1, 1);
  const last = messages[messages.length - 1];
  if (last.content.length > MAX_CHARS) last.content = last.content.slice(-MAX_CHARS);

  const user = await currentUser(env, request);
  const premium = !!user?.premium;
  const limit = user ? Number(premium ? env.AI_DAILY_PREMIUM ?? 200 : env.AI_DAILY_FREE ?? 20) : GUEST_DAILY;
  const who = user ? user.id : `ip:${(await sha256(request.headers.get('cf-connecting-ip') ?? 'yerel')).slice(0, 24)}`;
  const day = today();

  // Sayaç: önce artır, sınırı aşarsa geri al (yarış durumunda bile sınır korunur)
  const row = await env.DB.prepare(
    'INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count',
  )
    .bind(who, day)
    .first<{ count: number }>();
  const used = row?.count ?? 1;
  if (used > limit) {
    await env.DB.prepare('UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ?').bind(who, day).run();
    const en = request.headers.get('x-eesim-lang') === 'en';
    const free = env.AI_DAILY_FREE ?? 20;
    const msg = user
      ? premium
        ? en
          ? `You have used all ${limit} questions for today. See you tomorrow!`
          : `Bugünlük ${limit} soru hakkını kullandın. Yarın görüşürüz!`
        : en
          ? `Your ${limit} free questions for today are used up. They reset tomorrow — or ask without limits on your own computer with Ollama/WebLLM.`
          : `Bugünlük ${limit} ücretsiz soru hakkın doldu. Yarın yenilenir — ya da Ollama/WebLLM ile kendi bilgisayarında sınırsız sor.`
      : en
        ? `Guests can ask ${limit} questions a day. Sign in to raise your limit to ${free}.`
        : `Misafirler günde ${limit} soru sorabilir. Giriş yaparak hakkını ${free}’ye çıkar.`;
    return new Response(JSON.stringify({ error: msg, limit, remaining: 0 }), {
      status: 429,
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-quota-limit': String(limit), 'x-quota-remaining': '0' },
    });
  }

  const headers = {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'x-quota-limit': String(limit),
    'x-quota-remaining': String(Math.max(0, limit - used)),
  };

  if (!env.AI && fake) {
    // Yalnızca yerel geliştirme: Workers AI olmadan akışı ve kotayı denemek için
    const words = `Merhaba! Bu yerel test yanıtı. Sorduğun: “${last.content.slice(-60)}”. Kalan hakkın: ${limit - used}.`.split(' ');
    const stream = new ReadableStream({
      async start(c) {
        const e = new TextEncoder();
        for (const w of words) {
          c.enqueue(e.encode(`data: ${JSON.stringify({ response: w + ' ' })}\n\n`));
          await new Promise((r) => setTimeout(r, 15));
        }
        c.enqueue(e.encode('data: [DONE]\n\n'));
        c.close();
      },
    });
    return new Response(stream, { headers });
  }

  const primary = (premium && env.AI_MODEL_PREMIUM) || env.AI_MODEL;
  const failed = new Set<string>();
  let lastError = '';
  let tries = 0;
  for (const { model, inputs } of aiAttempts(primary, messages)) {
    if (failed.has(model) || tries >= MAX_ATTEMPTS) continue;
    tries++;
    try {
      const stream = (await env.AI!.run(model as Parameters<Ai['run']>[0], inputs as never)) as unknown as ReadableStream;
      if (model !== primary) console.warn(`Tepecan: "${primary}" çalışmadı, "${model}" kullanıldı. ${lastError}`);
      return new Response(stream, { headers: { ...headers, 'x-ai-model': model } });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`Tepecan: ${model} → ${lastError}`);
      // Model emekliye ayrıldıysa / bulunamadıysa: hemen sıradakine geç (deneme hakkından sayılmaz)
      if (/deprecated|no such model|not found|5007|5028/i.test(lastError)) {
        failed.add(model);
        tries--;
      }
    }
  }
  // Hiçbiri olmadı: hakkı geri ver
  await env.DB.prepare('UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ?').bind(who, day).run();
  return new Response(
    JSON.stringify({ error: 'Tepecan Bulut şu an cevap veremiyor (yapay zekâ servisi yanıt vermedi). Birazdan tekrar dene; bu soru hakkından düşülmedi.', detail: lastError }),
    { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'x-quota-limit': String(limit), 'x-quota-remaining': String(Math.max(0, limit - used + 1)) } },
  );
};

/** GET /api/ask → bugünkü kota durumu */
export const onRequestGet = async (ctx: Ctx) => {
  const { env, request } = ctx;
  const user = await currentUser(env, request);
  const premium = !!user?.premium;
  const limit = user ? Number(premium ? env.AI_DAILY_PREMIUM ?? 200 : env.AI_DAILY_FREE ?? 20) : GUEST_DAILY;
  const who = user ? user.id : `ip:${(await sha256(request.headers.get('cf-connecting-ip') ?? 'yerel')).slice(0, 24)}`;
  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').bind(who, today()).first<{ count: number }>();
  return new Response(JSON.stringify({ limit, remaining: Math.max(0, limit - (row?.count ?? 0)), premium, available: !!env.AI || env.AI_FAKE === '1' }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
};
