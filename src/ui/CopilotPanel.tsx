import { useEffect, useRef, useState } from 'react';
import { useAI } from '../ai/store';
import { listOllamaModels, WEBLLM_MODELS } from '../ai/providers';
import { FACES } from '../tepecan/mascot';
import { Markdown } from './Markdown';

declare const __SINGLE_FILE__: boolean;

const CHIPS = [
  { label: '🔍 Devremi kontrol et', check: true },
  { label: '💡 Bu devre nasıl çalışır?', q: 'Bu devre nasıl çalışıyor? Akımın yolunu ve her elemanın görevini kısaca anlat.' },
  { label: '🧭 Sonraki adım için ipucu', q: 'Şu anki deney adımı için cevabı söylemeden bir ipucu ver.' },
  { label: '📐 Diyot fiziği', q: 'pn ekleminde diyotun neden yaklaşık 0,7 V’ta iletime geçtiğini Shockley denklemiyle anlat.' },
];

export function CopilotPanel() {
  const { messages, busy, cfg, progress, ask, checkCircuit, applyFix, setCfg, stop, clear } = useAI();
  const [text, setText] = useState('');
  const [showCfg, setShowCfg] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelErr, setModelErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const refreshModels = async () => {
    setModelErr(null);
    try {
      const m = await listOllamaModels(cfg.ollamaUrl);
      setModels(m);
      if (m.length && !m.includes(cfg.ollamaModel)) setCfg({ ollamaModel: m[0] });
    } catch (e) {
      setModels(null);
      setModelErr((e as Error).message + ' — Ollama kurulu ve çalışıyor mu? (ollama serve)');
    }
  };
  useEffect(() => {
    if (cfg.provider === 'ollama' && showCfg) refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.provider, showCfg]);

  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    ask(t);
  };

  const providerLabel = cfg.provider === 'off' ? 'Çevrimdışı mod' : cfg.provider === 'ollama' ? `Ollama · ${cfg.ollamaModel}` : `WebLLM · ${cfg.webllmModel.split('-').slice(0, 2).join(' ')}`;

  return (
    <div className="copilot">
      <div className="cop-head">
        <img src={FACES.bust} className="cop-avatar" alt="" />
        <div className="cop-title">
          <b>Tepecan AI</b>
          <span className={`cop-status ${cfg.provider !== 'off' ? 'on' : ''}`}>{providerLabel}</span>
        </div>
        <button className="iconbtn" title="Sohbeti temizle" onClick={clear}>
          ⟲
        </button>
        <button className={`iconbtn ${showCfg ? 'on' : ''}`} title="Yapay zekâ ayarları" onClick={() => setShowCfg(!showCfg)}>
          ⚙
        </button>
      </div>

      {showCfg && (
        <div className="cop-cfg">
          <div className="seg">
            {(['off', 'ollama', 'webllm'] as const).map((p) => (
              <button key={p} className={cfg.provider === p ? 'on' : ''} onClick={() => setCfg({ provider: p })}>
                {p === 'off' ? 'Kapalı' : p === 'ollama' ? 'Ollama' : 'WebLLM'}
              </button>
            ))}
          </div>
          {cfg.provider === 'ollama' && (
            <>
              <label className="insp-row">
                <span>Sunucu</span>
                <input value={cfg.ollamaUrl} onChange={(e) => setCfg({ ollamaUrl: e.target.value })} onBlur={refreshModels} />
              </label>
              <label className="insp-row">
                <span>Model</span>
                {models && models.length ? (
                  <select value={cfg.ollamaModel} onChange={(e) => setCfg({ ollamaModel: e.target.value })}>
                    {models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input value={cfg.ollamaModel} onChange={(e) => setCfg({ ollamaModel: e.target.value })} />
                )}
              </label>
              {modelErr && <div className="issue warning small">{modelErr}</div>}
              <div className="muted small">
                Kurulum: <code>ollama pull qwen2.5:7b</code> → <code>ollama serve</code>. Türkçe için Qwen2.5 7B ya da Llama 3.1 8B önerilir.
              </div>
            </>
          )}
          {cfg.provider === 'webllm' && (
            <>
              <label className="insp-row">
                <span>Model</span>
                <select value={cfg.webllmModel} onChange={(e) => setCfg({ webllmModel: e.target.value })}>
                  {WEBLLM_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="muted small">
                Model ilk kullanımda indirilir ve tarayıcıda önbelleğe alınır. WebGPU gerekir (Chrome/Edge).
                {typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__ && <b> Tek dosyalık sürümde WebLLM yok — npm run dev kullan.</b>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="cop-list" ref={listRef}>
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg user">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="msg bot">
              <img src={FACES[m.mood ?? 'info']} className="msg-face" alt="" />
              <div className="msg-body">
                {m.streaming && !m.text ? <span className="typing"><i /><i /><i /></span> : <Markdown text={m.text} />}
                {m.fix && (
                  <div className={`fixcard ${m.fixState}`}>
                    <div className="fix-sum">🛠️ {m.fix.summary}</div>
                    {m.fixState === 'pending' ? (
                      <button className="btn primary sm" onClick={() => applyFix(m.id)}>
                        Devreyi senin için düzelteyim mi?
                      </button>
                    ) : (
                      <span className="small">{m.fixState === 'applied' ? '✓ Uygulandı' : '✗ Uygulanamadı'}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {progress && (
          <div className="msg bot">
            <img src={FACES.info} className="msg-face" alt="" />
            <div className="msg-body">
              <div className="small">Model yükleniyor… {Math.round(progress.p * 100)}%</div>
              <div className="bar">
                <span style={{ width: `${progress.p * 100}%` }} />
              </div>
              <div className="muted small">{progress.text.slice(0, 120)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="cop-chips">
        {CHIPS.map((c) => (
          <button key={c.label} className="chip" disabled={busy} onClick={() => (c.check ? checkCircuit() : ask(c.q!))}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="cop-input">
        <textarea
          rows={1}
          placeholder="Tepecan’a sor…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        {busy ? (
          <button className="btn sm" onClick={stop}>
            ■
          </button>
        ) : (
          <button className="btn primary sm" onClick={send} disabled={!text.trim()}>
            ➤
          </button>
        )}
      </div>
    </div>
  );
}
