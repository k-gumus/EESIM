// Yapay zekâ sağlayıcıları: Tepecan Bulut (Cloudflare Workers AI), Ollama (yerel ağ) ve WebLLM (tarayıcı içinde, WebGPU)

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  provider: 'off' | 'cloud' | 'ollama' | 'webllm';
  ollamaUrl: string;
  ollamaModel: string;
  webllmModel: string;
}

export const WEBLLM_MODELS = [
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 3B (önerilen, ~2 GB)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B (hızlı, ~1 GB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (~2 GB)' },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 7B (en iyi, ~5 GB)' },
];

export async function listOllamaModels(url: string): Promise<string[]> {
  const r = await fetch(`${url.replace(/\/$/, '')}/api/tags`);
  if (!r.ok) throw new Error(`Ollama yanıt vermedi (${r.status})`);
  const j = (await r.json()) as { models?: { name: string }[] };
  return (j.models ?? []).map((m) => m.name);
}

async function* ollamaStream(cfg: AIConfig, messages: ChatMsg[], signal: AbortSignal): AsyncGenerator<string> {
  let r: Response;
  try {
    r = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.ollamaModel, messages, stream: true, options: { temperature: 0.3, num_ctx: 8192 } }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw new Error(
      `Ollama'ya ulaşılamadı (${cfg.ollamaUrl}). Ollama çalışıyor mu? Uygulamayı localhost dışından açtıysan OLLAMA_ORIGINS ayarını yapman gerekir (README).`,
    );
  }
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Ollama hatası ${r.status}: ${txt.slice(0, 200)}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (j.error) throw new Error(j.error);
        if (j.message?.content) yield j.message.content;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

// ───────────── WebLLM (dinamik içe aktarma: sadece seçilince yüklenir) ─────────────
type Engine = {
  chat: { completions: { create: (o: unknown) => Promise<AsyncIterable<{ choices: { delta?: { content?: string } }[] }>> } };
  interruptGenerate?: () => void;
};
let engine: Engine | null = null;
let engineModel = '';

export async function ensureWebLLM(model: string, onProgress: (text: string, p: number) => void): Promise<Engine> {
  if (engine && engineModel === model) return engine;
  if (!('gpu' in navigator)) throw new Error('Bu tarayıcı WebGPU desteklemiyor. Chrome/Edge 113+ kullan ya da Ollama’yı seç.');
  const webllm = (await import('@mlc-ai/web-llm')) as unknown as {
    CreateMLCEngine: (m: string, c: { initProgressCallback: (r: { text: string; progress: number }) => void }) => Promise<Engine>;
  };
  engine = await webllm.CreateMLCEngine(model, { initProgressCallback: (r) => onProgress(r.text, r.progress) });
  engineModel = model;
  return engine;
}

async function* webllmStream(cfg: AIConfig, messages: ChatMsg[], signal: AbortSignal, onProgress: (t: string, p: number) => void): AsyncGenerator<string> {
  const eng = await ensureWebLLM(cfg.webllmModel, onProgress);
  const chunks = await eng.chat.completions.create({ messages, stream: true, temperature: 0.3, max_tokens: 900 });
  for await (const c of chunks) {
    if (signal.aborted) {
      eng.interruptGenerate?.();
      return;
    }
    const d = c.choices[0]?.delta?.content;
    if (d) yield d;
  }
}

// ───────────── Tepecan Bulut: /api/ask (Workers AI, sunucu tarafı kota) ─────────────
export interface Quota {
  limit: number;
  remaining: number;
}
export let lastQuota: Quota | null = null;

export async function fetchQuota(): Promise<Quota | null> {
  try {
    const r = await fetch('/api/ask', { credentials: 'include' });
    if (!r.ok) return null;
    const j = (await r.json()) as Quota;
    lastQuota = { limit: j.limit, remaining: j.remaining };
    return lastQuota;
  } catch {
    return null;
  }
}

/** SSE satırlarından metin parçalarını çıkar ("data: {\"response\":\"…\"}") */
export function* parseSSE(buf: { rest: string }, chunk: string): Generator<string> {
  buf.rest += chunk;
  let i: number;
  while ((i = buf.rest.indexOf('\n')) >= 0) {
    const line = buf.rest.slice(0, i).trim();
    buf.rest = buf.rest.slice(i + 1);
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const j = JSON.parse(data) as { response?: string; choices?: { delta?: { content?: string } }[] };
      const t = j.response ?? j.choices?.[0]?.delta?.content;
      if (t) yield t;
    } catch {
      /* yarım satır: yok say */
    }
  }
}

/** Bazı modeller düşünme adımlarını <think>…</think> içinde akıtır: öğrenciye yalnızca cevabı göster (akış sürerken kapanmamış blok da gizlenir) */
export function stripThink(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').replace(/^\s+/, '');
}

async function* cloudStream(messages: ChatMsg[], signal: AbortSignal): AsyncGenerator<string> {
  let r: Response;
  try {
    r = await fetch('/api/ask', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    throw new Error('Tepecan Bulut’a ulaşılamadı. İnternet bağlantını kontrol et.');
  }
  const lim = r.headers.get('x-quota-limit');
  if (lim) lastQuota = { limit: Number(lim), remaining: Number(r.headers.get('x-quota-remaining') ?? 0) };
  if (!r.ok || !r.body) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Sunucu hatası (${r.status})`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  const buf = { rest: '' };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    yield* parseSSE(buf, dec.decode(value, { stream: true }));
  }
  yield* parseSSE(buf, '\n');
}

export function chatStream(cfg: AIConfig, messages: ChatMsg[], signal: AbortSignal, onProgress: (t: string, p: number) => void): AsyncGenerator<string> {
  if (cfg.provider === 'cloud') return cloudStream(messages, signal);
  if (cfg.provider === 'ollama') return ollamaStream(cfg, messages, signal);
  if (cfg.provider === 'webllm') return webllmStream(cfg, messages, signal, onProgress);
  throw new Error('Yapay zekâ kapalı');
}
