// Kural tabanlı hata ayıklayıcı (yapay zekâ olmadan da çalışır). Sonuçlar AI bağlamına da eklenir.
import type { Edge, Node } from '@xyflow/react';
import { compileCircuit } from '../circuit/compile';
import { docToGraph } from '../circuit/doc';
import { formatSI } from '../circuit/format';
import type { CompData, CompiledCircuit, Issue } from '../circuit/types';
import { runner } from '../sim/runner';
import { templateById } from '../templates';

const DIODE_LIKE = new Set(['diode', 'zener', 'led']);

/** Bir eleman ucunun komşuluk imzası: aynı nette bulunan diğer (isim.pin) ve etiketler */
function signatures(circ: CompiledCircuit, nodes: Node<CompData>[]) {
  const nameOf = new Map(nodes.map((n) => [n.id, n.data]));
  const byNet = new Map<number, string[]>();
  for (const [key, net] of Object.entries(circ.pinNet)) {
    const [id, pin] = key.split(':');
    const d = nameOf.get(id);
    if (!d) continue;
    let tag = `${d.name}.${pin}`;
    if (d.type === 'ground') tag = 'GND';
    if (d.type === 'label') tag = `#${String(d.params.text).toUpperCase()}`;
    if (!byNet.has(net)) byNet.set(net, []);
    byNet.get(net)!.push(tag);
  }
  return (name: string, pin: string): Set<string> => {
    const node = nodes.find((n) => n.data.name === name);
    if (!node) return new Set();
    const net = circ.pinNet[`${node.id}:${pin}`];
    const s = new Set((byNet.get(net) ?? []).filter((t) => !t.startsWith(name + '.')));
    if (net === 0) s.add('GND');
    return s;
  };
}

const jac = (a: Set<string>, b: Set<string>) => {
  if (!a.size && !b.size) return 1;
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};

export function analyzeCircuit(nodes: Node<CompData>[], edges: Edge[], templateId: string | null): Issue[] {
  const circ = runner.compiled ?? compileCircuit(nodes, edges);
  const issues: Issue[] = [...circ.issues];

  // 1) Şablona göre ters takılmış diyotlar
  const tpl = templateById(templateId);
  if (tpl) {
    const flipAllowed = new Set(tpl.steps.filter((s) => s.check.kind === 'pin').map((s) => (s.check as { comp: string }).comp));
    const ref = docToGraph(tpl.doc);
    const refCirc = compileCircuit(ref.nodes, ref.edges);
    const sigRef = signatures(refCirc, ref.nodes);
    const sigCur = signatures(circ, nodes);
    for (const n of nodes) {
      if (!DIODE_LIKE.has(n.data.type) || flipAllowed.has(n.data.name)) continue;
      const r = ref.nodes.find((x) => x.data.name === n.data.name);
      if (!r) continue;
      const ca = sigCur(n.data.name, 'a');
      const ck = sigCur(n.data.name, 'k');
      const ra = sigRef(n.data.name, 'a');
      const rk = sigRef(n.data.name, 'k');
      const straight = jac(ca, ra) + jac(ck, rk);
      const reversed = jac(ca, rk) + jac(ck, ra);
      if (reversed > straight + 0.5) {
        issues.push({
          level: 'error',
          code: 'diode-reversed',
          comp: n.data.name,
          message: `${n.data.name} ters takılmış görünüyor: anot ve katot, deney föyündeki bağlantının tersine bağlı. Bu yüzden çıkışın polaritesi/şekli beklenenden farklı.`,
          fix: { summary: `${n.data.name}'i ters çevir`, actions: [{ op: 'flip', id: n.data.name }] },
        });
      }
    }
  }

  // 2) Simülasyon sonuçlarına dayalı kontroller
  const sum = runner.summary();
  if (sum && runner.sim) {
    const hasAC = circ.elements.some((e) => e.type === 'vac');
    for (const { el, cur, probe } of sum.elements) {
      if (!cur) continue;
      if (DIODE_LIKE.has(el.type) && el.type !== 'zener' && cur.max < 1e-6 && cur.n > 10) {
        issues.push({
          level: hasAC ? 'warning' : 'info',
          code: 'diode-off',
          comp: el.name,
          message: `${el.name} hiç iletime geçmiyor (maks. akım ${formatSI(cur.max, 'A')}). Ters kutuplanmış ya da yolu açık olabilir.`,
        });
      }
      if (el.type === 'led' && cur.max > (Number(el.params.Imax) || 0.03)) {
        const vs = circ.elements.find((e) => e.type === 'resistor');
        issues.push({
          level: 'error',
          code: 'led-overcurrent',
          comp: el.name,
          message: `${el.name} üzerinden ${formatSI(cur.max, 'A')} akıyor; LED'in maksimum akımı ${formatSI(Number(el.params.Imax) || 0.03, 'A')}.`,
          fix: vs ? { summary: `${vs.name}'i 1 kΩ yap`, actions: [{ op: 'set', id: vs.name, param: 'R', value: 1000 }] } : undefined,
        });
      }
      if ((el.type === 'npn' || el.type === 'pnp') && probe.region === 2) {
        issues.push({ level: 'info', code: 'bjt-sat', comp: el.name, message: `${el.name} doyumda (V_CE ≈ ${formatSI(probe.vce ?? 0, 'V')}). Yükselteç için aktif bölge gerekir.` });
      }
      if ((el.type === 'npn' || el.type === 'pnp') && probe.region === 0) {
        issues.push({ level: 'info', code: 'bjt-cut', comp: el.name, message: `${el.name} kesimde (V_BE ≈ ${formatSI(probe.vbe ?? 0, 'V')}).` });
      }
    }
    for (const n of nodes) {
      if (n.data.type !== 'scope') continue;
      const nets = ['ch1', 'ch2'].map((p) => circ.pinNet[`${n.id}:${p}`]);
      const used = nets.filter((x) => x !== undefined && Object.values(circ.pinNet).filter((y) => y === x).length > 1);
      if (!used.length) issues.push({ level: 'info', code: 'scope-unconnected', comp: n.data.name, message: `${n.data.name} kanallarından hiçbiri bağlı değil.` });
    }
  }

  // Tekilleştir
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = i.code + i.comp;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
