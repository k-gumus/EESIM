// Tepecan'a Sor: model emekliye ayrıldığında yedek modele geçiş ve kota iadesi
import { describe, expect, it } from 'vitest';
import { aiAttempts, onRequestPost, FALLBACK_MODELS } from '../functions/api/ask';
import type { Ctx, Env } from '../functions/_lib';

/** Yalnızca ai_usage sorgularını anlayan küçük sahte D1 */
function fakeDB() {
  const usage = new Map<string, number>();
  const db = {
    usage,
    prepare(sql: string) {
      return {
        bind(...a: unknown[]) {
          const key = `${a[0]}|${a[1]}`;
          return {
            async first() {
              if (sql.startsWith('INSERT INTO ai_usage')) {
                usage.set(key, (usage.get(key) ?? 0) + 1);
                return { count: usage.get(key) };
              }
              return null;
            },
            async run() {
              if (sql.startsWith('UPDATE ai_usage SET count = count - 1')) usage.set(key, (usage.get(key) ?? 0) - 1);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return db;
}

function fakeAI(ok: (model: string, inputs: Record<string, unknown>) => boolean) {
  const calls: { model: string; inputs: Record<string, unknown> }[] = [];
  return {
    calls,
    async run(model: string, inputs: Record<string, unknown>) {
      calls.push({ model, inputs });
      if (model.includes('llama-3.1-8b')) throw new Error('5028: @cf/meta/infire-llama-3.1-8b-instruct was deprecated on 2026-05-30.');
      if (!ok(model, inputs)) throw new Error('3040: Capacity temporarily exceeded');
      return new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Selam"}}]}\n\ndata: [DONE]\n\n'));
          c.close();
        },
      });
    },
  };
}

function ctx(env: Partial<Env>): Ctx {
  const request = new Request('https://eesim.fyi/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
    body: JSON.stringify({ messages: [{ role: 'system', content: 'Sen Tepecan’sın.' }, { role: 'user', content: 'Diyot neden 0,7 V’ta iletir?' }] }),
  });
  return { request, env, params: {} } as unknown as Ctx;
}

describe("Tepecan'a Sor — model seçimi", () => {
  it('ayarlanan model önce, sonra yedekler; düşünen modellerde düşünme kapatılır', () => {
    const a = aiAttempts('@cf/meta/llama-3.1-8b-instruct', []);
    expect(a[0].model).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(a[0].inputs.chat_template_kwargs).toBeUndefined();
    const g = a.find((x) => x.model === FALLBACK_MODELS[0])!;
    expect(g.inputs.chat_template_kwargs).toEqual({ enable_thinking: false });
    // her model bir kez listelenir (düşünme ayarlı + ayarsız)
    expect(aiAttempts(FALLBACK_MODELS[0], []).filter((x) => x.model === FALLBACK_MODELS[0]).length).toBe(2);
  });

  it('emekliye ayrılmış model yerine yedek modelle cevap verir', async () => {
    const DB = fakeDB();
    const AI = fakeAI(() => true);
    const r = await onRequestPost(ctx({ DB: DB as never, AI: AI as never, AI_MODEL: '@cf/meta/llama-3.1-8b-instruct' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('x-ai-model')).toBe(FALLBACK_MODELS[0]);
    expect(await r.text()).toContain('Selam');
    expect(AI.calls.map((c) => c.model)).toEqual(['@cf/meta/llama-3.1-8b-instruct', FALLBACK_MODELS[0]]);
    expect([...DB.usage.values()]).toEqual([1]);
  });

  it('düşünme ayarı reddedilirse aynı modeli ayarsız dener', async () => {
    const AI = fakeAI((_m, inp) => !inp.chat_template_kwargs);
    const r = await onRequestPost(ctx({ DB: fakeDB() as never, AI: AI as never, AI_MODEL: FALLBACK_MODELS[0] }));
    expect(r.status).toBe(200);
    expect(r.headers.get('x-ai-model')).toBe(FALLBACK_MODELS[0]);
    expect(AI.calls.length).toBe(2);
  });

  it('hiçbir model cevap veremezse anlaşılır bir mesaj döner ve hak iade edilir', async () => {
    const DB = fakeDB();
    const AI = fakeAI(() => false);
    const r = await onRequestPost(ctx({ DB: DB as never, AI: AI as never, AI_MODEL: '@cf/meta/llama-3.1-8b-instruct' }));
    expect(r.status).toBe(502);
    const j = (await r.json()) as { error: string };
    expect(j.error).toMatch(/Tepecan Bulut şu an cevap veremiyor/);
    expect(j.error).not.toMatch(/5028|deprecated/);
    expect([...DB.usage.values()]).toEqual([0]);
    expect(r.headers.get('x-quota-remaining')).toBe('5');
    // emekli model sayılmaz; en fazla 5 gerçek deneme, son yedek (llama-3.3) de denenir
    expect(AI.calls.length).toBe(6);
    expect(AI.calls.at(-1)!.model).toBe(FALLBACK_MODELS.at(-1));
  });
});
