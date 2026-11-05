// Tepecan AI sohbet durumu
import { create } from 'zustand';
import type { FixPatch, Issue } from '../circuit/types';
import type { Mood } from '../tepecan/mascot';
import { tepecan } from '../tepecan/mascot';
import { useAuth } from '../auth/store';
import { chatStream, stripThink, type AIConfig, type ChatMsg } from './providers';
import { buildContext, extractFix, SYSTEM_PROMPT } from './prompt';
import { analyzeCircuit } from '../debug/rules';
import { useCircuit } from '../store/circuitStore';
import { templateById } from '../templates';

export interface UIMsg {
  id: number;
  role: 'user' | 'tepecan';
  text: string;
  mood?: Mood;
  fix?: FixPatch | null;
  fixState?: 'pending' | 'applied' | 'failed';
  streaming?: boolean;
  offline?: boolean;
}

interface AIState {
  cfg: AIConfig;
  messages: UIMsg[];
  busy: boolean;
  progress: { text: string; p: number } | null;
  stepText?: string;
  setCfg: (c: Partial<AIConfig>) => void;
  ask: (text: string) => Promise<void>;
  checkCircuit: () => Promise<void>;
  applyFix: (msgId: number) => void;
  stop: () => void;
  clear: () => void;
  setStepText: (t?: string) => void;
}

const CFG_KEY = 'ieeesim.ai.v1';
const defaultCfg: AIConfig = { provider: 'cloud', ollamaUrl: 'http://localhost:11434', ollamaModel: 'qwen2.5:7b', webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC' };
function loadCfg(): AIConfig {
  try {
    return { ...defaultCfg, ...JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}') };
  } catch {
    return defaultCfg;
  }
}

/** Bulut seçili ama sunucuda Workers AI yoksa (tek dosya, GitHub Pages) çevrimdışı davran */
export function effectiveProvider(cfg: AIConfig): AIConfig['provider'] {
  if (cfg.provider === 'cloud' && !useAuth.getState().cloudAi) return 'off';
  return cfg.provider;
}

let mid = 1;
let abort: AbortController | null = null;

const WELCOME: UIMsg = {
  id: 0,
  role: 'tepecan',
  mood: 'info',
  text:
    'Selam! Ben **Tepecan** 🤖 Devreni netlist ve simülasyon sonuçlarından okurum.\n\n• **Devremi kontrol et** — hataları bulup düzeltmeyi öneririm (yapay zekâ olmadan da çalışır)\n• Teori sor: “diyot neden 0,7 V’ta iletir?”\n• Deney adımında takıldığında ipucu iste\n\nBana her şeyi sorabilirsin; ⚙️’den yapay zekâ kaynağını (Tepecan Bulut, Ollama, WebLLM) değiştirebilirsin.',
};

function moodFor(issues: Issue[]): Mood {
  if (issues.some((i) => i.level === 'error')) return issues.some((i) => i.code === 'no-ground' || i.code.includes('short') || i.code === 'ammeter-parallel') ? 'angry' : 'error';
  if (issues.some((i) => i.level === 'warning')) return 'surprised';
  return 'success';
}

export const useAI = create<AIState>((set, get) => {
  const push = (m: Omit<UIMsg, 'id'>) => {
    const msg = { ...m, id: mid++ };
    set({ messages: [...get().messages, msg] });
    return msg.id;
  };
  const patch = (id: number, p: Partial<UIMsg>) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  return {
    cfg: loadCfg(),
    messages: [WELCOME],
    busy: false,
    progress: null,
    setStepText: (t) => set({ stepText: t }),
    setCfg: (c) => {
      const cfg = { ...get().cfg, ...c };
      set({ cfg });
      try {
        localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      } catch {
        /* yok say */
      }
    },
    clear: () => set({ messages: [WELCOME] }),
    stop: () => {
      abort?.abort();
      set({ busy: false });
    },

    checkCircuit: async () => {
      const { nodes, edges, templateId } = useCircuit.getState();
      push({ role: 'user', text: 'Devremi kontrol et' });
      const issues = analyzeCircuit(nodes, edges, templateId).filter((i) => i.level !== 'info' || i.code.startsWith('bjt'));
      if (!nodes.length) {
        push({ role: 'tepecan', mood: 'info', text: 'Canvas boş görünüyor. Paletten eleman ekle ya da bir deney şablonu yükle!', offline: true });
        return;
      }
      if (effectiveProvider(get().cfg) === 'off' || !issues.some((i) => i.level !== 'info')) {
        const fixable = issues.find((i) => i.fix);
        const lines = issues.length
          ? issues.map((i) => `${i.level === 'error' ? '⛔' : i.level === 'warning' ? '⚠️' : 'ℹ️'} ${i.message}`).join('\n')
          : 'Her şey yolunda görünüyor! ✅ Toprak var, kısa devre yok, bağlantılar tamam. Simülasyonu çalıştırıp osiloskopta sonuçları inceleyebilirsin.';
        push({
          role: 'tepecan',
          mood: moodFor(issues),
          text: lines,
          fix: fixable?.fix ?? null,
          fixState: fixable ? 'pending' : undefined,
          offline: true,
        });
        if (effectiveProvider(get().cfg) === 'off' || !issues.length) return;
      }
      await get().ask('Devremi kontrol et: yukarıdaki otomatik tespitleri ve simülasyon sonuçlarını yorumla, varsa hatayı açıkla ve düzeltme öner.');
    },

    ask: async (text) => {
      const cfg = { ...get().cfg, provider: effectiveProvider(get().cfg) };
      const isInternal = text.startsWith('Devremi kontrol et:');
      if (!isInternal) push({ role: 'user', text });
      if (cfg.provider === 'off') {
        const cloudOff = get().cfg.provider === 'cloud';
        const tpl = templateById(useCircuit.getState().templateId);
        push({
          role: 'tepecan',
          mood: 'info',
          offline: true,
          text:
            (tpl ? `**${tpl.title} — kısa teori**\n${tpl.theory}\n\n` : '') +
            (cloudOff
              ? 'Bu kopyada **Tepecan Bulut** sunucusu yok (tek dosya ya da statik barındırma). ⚙️ simgesinden **Ollama** (bilgisayarındaki yerel model) ya da **WebLLM** (doğrudan tarayıcıda) seçebilirsin.'
              : 'Serbest soru-cevap için bir dil modeli bağlamam gerekiyor. ⚙️ simgesinden **Tepecan Bulut**, **Ollama** (yerel model) ya da **WebLLM** (tarayıcıda) seç.') +
            ' Bu arada **Devremi kontrol et** her zaman çalışır!',
        });
        return;
      }
      const { nodes, edges, templateId } = useCircuit.getState();
      const issues = analyzeCircuit(nodes, edges, templateId);
      const context = buildContext(issues, get().stepText);
      const history: ChatMsg[] = get()
        .messages.filter((m) => m.id !== 0 && !m.offline && !m.streaming)
        .slice(-8)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const messages: ChatMsg[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(0, -1),
        { role: 'user', content: `${context}\n\n---\nÖğrencinin sorusu: ${text}` },
      ];
      const id = push({ role: 'tepecan', text: '', mood: 'info', streaming: true });
      set({ busy: true });
      abort = new AbortController();
      let acc = '';
      try {
        for await (const chunk of chatStream(cfg, messages, abort.signal, (t, p) => set({ progress: { text: t, p } }))) {
          if (get().progress) set({ progress: null });
          acc += chunk;
          patch(id, { text: stripThink(acc).replace(/```tepecan-fix[\s\S]*$/, '').trim() || '…' });
        }
        const { clean, fix } = extractFix(stripThink(acc));
        patch(id, { text: clean || '(boş yanıt)', fix, fixState: fix ? 'pending' : undefined, streaming: false, mood: fix ? 'surprised' : 'info' });
      } catch (e) {
        // Tepecan Bulut kendi Türkçe mesajını verir; Ollama/WebLLM hataları ham gelir
        const msg = (e as Error).message;
        patch(id, { text: cfg.provider === 'cloud' ? `⚠️ ${msg}` : `Bağlantı sorunu: ${msg}`, mood: 'error', streaming: false, offline: true });
      } finally {
        set({ busy: false, progress: null });
      }
    },

    applyFix: (msgId) => {
      const m = get().messages.find((x) => x.id === msgId);
      if (!m?.fix) return;
      const res = useCircuit.getState().applyFix(m.fix);
      patch(msgId, { fixState: res.ok ? 'applied' : 'failed' });
      push({ role: 'tepecan', mood: res.ok ? 'success' : 'error', text: res.log.join('\n'), offline: true });
      if (res.ok) tepecan.say({ mood: 'success', title: 'Düzelttim! 🛠️', text: m.fix.summary, ttl: 4000 });
    },
  };
});
