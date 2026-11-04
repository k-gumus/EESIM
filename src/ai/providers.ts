// Yapay zekâ sağlayıcıları: Ollama (yerel ağ) ve WebLLM (tarayıcı içinde, WebGPU)

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  provider: 'off' | 'ollama' | 'webllm';
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

export function chatStream(cfg: AIConfig, messages: ChatMsg[], signal: AbortSignal, onProgress: (t: string, p: number) => void): AsyncGenerator<string> {
  if (cfg.provider === 'ollama') return ollamaStream(cfg, messages, signal);
  if (cfg.provider === 'webllm') return webllmStream(cfg, messages, signal, onProgress);
  throw new Error('Yapay zekâ kapalı');
}
