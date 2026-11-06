// Tepecan AI için sistem istemi ve devre bağlamı (yapay zekâ arayüzü "görmez", netlist + sonuçları okur)
import { buildSpiceNetlist } from '../circuit/spice';
import { formatSI } from '../circuit/format';
import type { FixAction, FixPatch, Issue } from '../circuit/types';
import { runner } from '../sim/runner';
import { useCircuit } from '../store/circuitStore';
import { templateById } from '../templates';

export const SYSTEM_PROMPT = `Sen Tepecan'sın: EESIM devre laboratuvarının robot maskotu ve elektrik-elektronik öğrencilerinin laboratuvar asistanı.
Kişiliğin: sıcak, esprili ama net; Duolingo maskotu gibi öğrenciyi cesaretlendirirsin. Her zaman TÜRKÇE yaz.

Üç rolün var:
1) Teorik Mentor — yarı iletken fiziği (pn eklemi, Shockley denklemi, BJT/MOSFET bölgeleri) ve devre analizini (KVL/KCL, Thevenin, küçük işaret) açıklarsın. Formülleri sade yaz (ör. I_D = I_S·(e^(V_D/nV_T) − 1)).
2) Laboratuvar Asistanı — öğrenciyi deney föyündeki adımlarda yönlendirirsin; cevabı hemen vermek yerine önce ipucu verip düşündürürsün.
3) Hata Ayıklayıcı — yanlış bağlanmış ya da çalışmayan devreleri netlist ve simülasyon sonuçlarından teşhis edersin.

Arayüzü GÖRMEZSİN. Sana her mesajda güncel SPICE netlist'i, düğüm gerilimi istatistikleri (min/maks/ort/RMS), eleman akımları ve otomatik tespit edilen sorunlar verilir. Yalnızca bu verilere dayan; sayı uydurma.
Düğüm adları: 0 = toprak (GND), VIN/VOUT gibi isimler etiketlerdir, N001 gibi isimler otomatik düğümlerdir.

Devrede somut bir değişiklik öneriyorsan, cevabının SONUNA tam olarak şu biçimde bir blok ekle (arayüz bunu algılayıp öğrenciye "Devreyi senin için düzelteyim mi?" düğmesi gösterir):
\`\`\`tepecan-fix
{"summary":"kısa açıklama","actions":[{"op":"flip","id":"D1"}]}
\`\`\`
İzin verilen işlemler:
- {"op":"flip","id":"D1"}  → iki uçlu elemanı (diyot vb.) ters çevir
- {"op":"set","id":"R1","param":"R","value":2200} → parametre değiştir
- {"op":"toggle","id":"S1"} → anahtarı aç/kapat
- {"op":"remove","id":"C2"} → elemanı sil
- {"op":"connectGround","id":"V1","pin":"n"} → bir uca toprak ekle
Parametre adları: direnç R (Ω), kapasitör C (F), bobin L (H), DC kaynak V, AC kaynak amp/freq/offset, zener Vz, BJT beta, MOSFET Vth/K, trafo n, multimetre mode (DCV/ACV/DCA/ACA), anahtar closed.
"id" alanında netlist'teki eleman adlarını aynen kullan (SPICE'ta zener DZ1 görünse de id "Z1", LED için DLED1 → "LED1", anahtar RS1 → "S1"). Emin değilsen blok ekleme.
Cevapların kısa olsun (en fazla ~150 kelime), gerekirse madde işaretleri kullan.`;

/** Seçili arayüz diline göre sistem istemi (Tepecan öğrencinin dilinde cevap verir) */
export function systemPrompt(lang: 'tr' | 'en'): string {
  if (lang === 'tr') return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT.replace('Her zaman TÜRKÇE yaz.', 'Her zaman İNGİLİZCE yaz.') +
    '\n\nIMPORTANT: The student is using the English interface. ALWAYS answer in clear, simple ENGLISH, even though the circuit data and experiment notes below may be in Turkish. Keep the tepecan-fix block format exactly as specified (its "summary" in English).'
  );
}

function statLine(name: string, s: { min: number; max: number; avg: number; acrms: number } | null) {
  if (!s) return `${name}: (veri yok)`;
  const ac = s.max - s.min > 1e-3;
  return ac
    ? `${name}: min ${formatSI(s.min, 'V')}, maks ${formatSI(s.max, 'V')}, ort ${formatSI(s.avg, 'V')}, AC-RMS ${formatSI(s.acrms, 'V')}`
    : `${name}: ${formatSI(s.avg, 'V')} (DC)`;
}

export function buildContext(issues: Issue[], stepText?: string): string {
  const { nodes, title, templateId } = useCircuit.getState();
  const circ = runner.compiled;
  const parts: string[] = [];
  if (!circ || !nodes.length) return 'Canvas boş — henüz devre yok.';
  parts.push(`## Devre: ${title}`);
  parts.push('```spice\n' + buildSpiceNetlist(circ, nodes, title) + '\n```');
  const sum = runner.summary();
  if (sum && runner.sim) {
    parts.push(`## Simülasyon sonuçları (t = ${formatSI(sum.t, 's')}, pencere ${formatSI(sum.window, 's')})`);
    parts.push(sum.nets.slice(1).map((n) => '- ' + statLine(n.name, n.stats)).join('\n'));
    const cur = sum.elements
      .filter((e) => !['scope'].includes(e.el.type) && e.cur && e.cur.n)
      .map((e) => {
        const c = e.cur!;
        const ac = c.max - c.min > 1e-6;
        let extra = '';
        if (e.probe.region !== undefined) {
          const reg = e.el.type === 'npn' || e.el.type === 'pnp' ? ['kesim', 'aktif', 'doyum', 'ters aktif'] : ['kesim', 'doyum', 'triyot'];
          extra = `, bölge: ${reg[e.probe.region]}`;
        }
        return `- ${e.el.name}: ${ac ? `akım ${formatSI(c.min, 'A')} … ${formatSI(c.max, 'A')}, RMS ${formatSI(c.rms, 'A')}` : `akım ${formatSI(c.avg, 'A')}`}${extra}`;
      });
    parts.push('Eleman akımları (ilk uçtan elemana giren yön +):\n' + cur.join('\n'));
  } else {
    parts.push('Simülasyon şu an çalışmıyor; yalnızca netlist mevcut.');
  }
  if (issues.length) {
    parts.push('## Otomatik tespit edilen sorunlar\n' + issues.map((i) => `- [${i.level}] ${i.message}`).join('\n'));
  }
  const tpl = templateById(templateId);
  if (tpl) {
    parts.push(`## Deney föyü: ${tpl.title}\n${tpl.theory}`);
    if (stepText) parts.push(`Öğrencinin şu anki adımı: ${stepText}`);
  }
  return parts.join('\n\n');
}

const OPS = new Set(['flip', 'set', 'toggle', 'remove', 'connectGround']);

/** Yanıttaki ```tepecan-fix bloğunu ayrıştır ve doğrula */
export function extractFix(text: string): { clean: string; fix: FixPatch | null } {
  const m = text.match(/```(?:tepecan-fix|json)\s*([\s\S]*?)```/);
  if (!m) return { clean: text, fix: null };
  try {
    const j = JSON.parse(m[1]) as { summary?: string; actions?: FixAction[] };
    const actions = (j.actions ?? []).filter((a) => a && OPS.has(a.op) && typeof a.id === 'string');
    if (!actions.length) return { clean: text, fix: null };
    // SPICE adlarını arayüz adlarına çevir (DZ1 → Z1, DLED1 → LED1, RS1 → S1)
    const st = useCircuit.getState();
    for (const a of actions) {
      if (!st.byName(a.id)) {
        const alt = a.id.replace(/^D(?=(Z|LED)\d)/i, '').replace(/^R(?=S\d)/i, '');
        if (st.byName(alt)) a.id = alt;
      }
    }
    return { clean: text.replace(m[0], '').trim(), fix: { summary: j.summary ?? 'Önerilen düzeltme', actions } };
  } catch {
    return { clean: text, fix: null };
  }
}
