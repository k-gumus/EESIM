// Simülasyon denetleyicisi: motor ⇄ React durumu arasında gerçek zamanlı köprü.
// Hesaplama tamamen tarayıcıda; React'e ~15 Hz ile özet yayınlanır, kablo animasyonu doğrudan DOM üzerinden 60 Hz.
import { create } from 'zustand';
import type { Edge, Node } from '@xyflow/react';
import { compileCircuit, pinKey } from '../circuit/compile';
import { LIBRARY, LED_COLORS } from '../circuit/library';
import type { CompData, CompiledCircuit } from '../circuit/types';
import { SimError, Simulator } from '../engine/simulator';
import { useCircuit } from '../store/circuitStore';
import { tepecan } from '../tepecan/mascot';
import { formatSI } from '../circuit/format';

export interface Stats {
  min: number;
  max: number;
  avg: number;
  rms: number;
  acrms: number;
  last: number;
  n: number;
}

export interface CompLive {
  I: number[];
  P: number;
  probe: Record<string, number>;
}

export interface MeterReading {
  value: number;
  unit: 'V' | 'A';
  mode: string;
}

export type SimStatus = 'stopped' | 'running' | 'paused' | 'error';

interface SimStoreState {
  status: SimStatus;
  error: { kind: string; message: string } | null;
  t: number;
  speed: number;
  showValues: boolean;
  tick: number;
  compiled: CompiledCircuit | null;
  netV: number[];
  comp: Record<string, CompLive>;
  meters: Record<string, MeterReading>;
  lagging: boolean;
  timeDiv: number;
  vmax: number;
}

export const useSim = create<SimStoreState>(() => ({
  status: 'stopped',
  error: null,
  t: 0,
  speed: 1,
  showValues: true,
  tick: 0,
  compiled: null,
  netV: [],
  comp: {},
  meters: {},
  lagging: false,
  timeDiv: 1e-3,
  vmax: 1,
}));

// ───────────────────────── Zaman geçmişi (osiloskop, multimetre, AI özeti) ─────────────────────────

const HCAP = 2400;

export class History {
  t = new Float64Array(HCAP);
  nets: Float32Array[] = [];
  cur = new Map<string, Float32Array>();
  head = 0; // bir sonraki yazma konumu
  count = 0;
  /** son devre değişikliğinin zamanı: istatistikler bundan önceki örnekleri karıştırmaz */
  epoch = -Infinity;
  constructor(public netCount: number, elementIds: string[]) {
    for (let i = 0; i < netCount; i++) this.nets.push(new Float32Array(HCAP));
    for (const id of elementIds) this.cur.set(id, new Float32Array(HCAP));
  }
  push(sim: Simulator) {
    const h = this.head;
    this.t[h] = sim.t;
    for (let i = 1; i < this.netCount; i++) this.nets[i][h] = sim.x[i - 1];
    for (const [id, arr] of this.cur) arr[h] = sim.currentsOf(id)?.[0] ?? 0;
    this.head = (h + 1) % HCAP;
    this.count = Math.min(HCAP, this.count + 1);
  }
  /** i = 0 en eski, count-1 en yeni */
  idx(i: number) {
    return (this.head - this.count + i + HCAP * 2) % HCAP;
  }
  lastT() {
    return this.count ? this.t[this.idx(this.count - 1)] : 0;
  }
  statsOf(get: (k: number) => number, tFrom0: number): Stats {
    const tFrom = Math.max(tFrom0, Math.min(this.epoch, this.lastT()));
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sq = 0;
    let n = 0;
    let last = 0;
    for (let i = this.count - 1; i >= 0; i--) {
      const k = this.idx(i);
      if (this.t[k] < tFrom) break;
      const v = get(k);
      if (n === 0) last = v;
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      sq += v * v;
      n++;
    }
    if (!n) return { min: 0, max: 0, avg: 0, rms: 0, acrms: 0, last: 0, n: 0 };
    const avg = sum / n;
    const rms = Math.sqrt(sq / n);
    const acrms = Math.sqrt(Math.max(0, sq / n - avg * avg));
    return { min, max, avg, rms, acrms, last, n };
  }
  netStats(net: number, window: number): Stats {
    if (net === 0) return { min: 0, max: 0, avg: 0, rms: 0, acrms: 0, last: 0, n: 1 };
    const arr = this.nets[net];
    return this.statsOf((k) => arr[k], this.lastT() - window);
  }
  diffStats(a: number, b: number, window: number): Stats {
    const A = this.nets[a];
    const B = this.nets[b];
    return this.statsOf((k) => (a ? A[k] : 0) - (b ? B[k] : 0), this.lastT() - window);
  }
  curStats(id: string, window: number): Stats {
    const arr = this.cur.get(id);
    if (!arr) return { min: 0, max: 0, avg: 0, rms: 0, acrms: 0, last: 0, n: 0 };
    return this.statsOf((k) => arr[k], this.lastT() - window);
  }
}

// ───────────────────────── Kablo akım planı ─────────────────────────

interface WirePlan {
  entries: { edgeId: string; child: string; parent: string; sign: 1 | -1 }[];
  comps: { pins: string[]; sink: string | null; root: string }[];
}

function buildWirePlan(nodes: Node<CompData>[], edges: Edge[]): WirePlan {
  const typeOf = new Map(nodes.map((n) => [n.id, n.data.type]));
  const adj = new Map<string, { other: string; edge: Edge }[]>();
  const add = (k: string) => {
    if (!adj.has(k)) adj.set(k, []);
  };
  for (const e of edges) {
    if (!typeOf.has(e.source) || !typeOf.has(e.target)) continue;
    const a = pinKey(e.source, e.sourceHandle ?? '');
    const b = pinKey(e.target, e.targetHandle ?? '');
    if (a === b) continue;
    add(a);
    add(b);
    adj.get(a)!.push({ other: b, edge: e });
    adj.get(b)!.push({ other: a, edge: e });
  }
  const isSink = (k: string) => {
    const t = typeOf.get(k.split(':')[0]);
    return t === 'ground' || t === 'label';
  };
  const visited = new Set<string>();
  const plan: WirePlan = { entries: [], comps: [] };
  for (const start0 of adj.keys()) {
    if (visited.has(start0)) continue;
    // Bileşeni topla, varsa kök olarak "sink" seç (toprak / etiket)
    const compPins: string[] = [];
    const q0 = [start0];
    const seen = new Set([start0]);
    while (q0.length) {
      const u = q0.pop()!;
      compPins.push(u);
      for (const { other } of adj.get(u)!) if (!seen.has(other)) (seen.add(other), q0.push(other));
    }
    const sink = compPins.find(isSink) ?? null;
    const root = sink ?? start0;
    visited.add(root);
    const queue = [root];
    while (queue.length) {
      const u = queue.shift()!;
      for (const { other, edge } of adj.get(u)!) {
        if (visited.has(other)) continue;
        visited.add(other);
        queue.push(other);
        const srcKey = pinKey(edge.source, edge.sourceHandle ?? '');
        plan.entries.push({ edgeId: edge.id, child: other, parent: u, sign: srcKey === u ? 1 : -1 });
      }
    }
    plan.comps.push({ pins: compPins, sink, root });
  }
  return plan;
}

// ───────────────────────── Kablo DOM kaydı (60 Hz animasyon) ─────────────────────────

export const wireRegistry = new Map<string, { base: SVGPathElement; dots: SVGPathElement; offset: number }>();

function voltageColor(v: number, vmax: number): string {
  const t = Math.max(-1, Math.min(1, v / (vmax || 1)));
  // 0 V: gri-mavi; +: yeşil; −: kırmızı (Falstad geleneği)
  const g = [120, 134, 165];
  const pos = [52, 211, 120];
  const neg = [248, 82, 82];
  const c = t >= 0 ? pos : neg;
  const a = Math.abs(t);
  const r = Math.round(g[0] + (c[0] - g[0]) * a);
  const gg = Math.round(g[1] + (c[1] - g[1]) * a);
  const b = Math.round(g[2] + (c[2] - g[2]) * a);
  return `rgb(${r},${gg},${b})`;
}

// ───────────────────────── Runner ─────────────────────────

class SimRunner {
  sim: Simulator | null = null;
  compiled: CompiledCircuit | null = null;
  hist: History | null = null;
  private nodes: Node<CompData>[] = [];
  private edges: Edge[] = [];
  private plan: WirePlan = { entries: [], comps: [] };
  private edgeNet = new Map<string, number>();
  private wireI = new Map<string, number>();
  private raf = 0;
  private lastFrame = 0;
  private lastPublish = 0;
  private nextRecord = 0;
  private maxFreq = 0;
  private burntWarned = new Set<string>();
  private powerWarned = new Set<string>();
  /** osiloskop görüntüsü dondurulduğunda */
  frozen = false;

  constructor() {
    useCircuit.subscribe((s, prev) => {
      if (s.version !== prev.version) this.onCircuitChange(s.topoVersion !== prev.topoVersion);
      else if (s.nodes !== prev.nodes) {
        this.nodes = s.nodes;
        this.updateTimeDiv();
      }
    });
    this.animate = this.animate.bind(this);
  }

  get window(): number {
    return 10 * useSim.getState().timeDiv;
  }

  private recompile() {
    const { nodes, edges } = useCircuit.getState();
    this.nodes = nodes;
    this.edges = edges;
    this.compiled = compileCircuit(nodes, edges);
    this.plan = buildWirePlan(nodes, edges);
    this.edgeNet.clear();
    for (const e of edges) {
      const n = this.compiled.pinNet[pinKey(e.source, e.sourceHandle ?? '')];
      if (n !== undefined) this.edgeNet.set(e.id, n);
    }
    this.maxFreq = 0;
    for (const el of this.compiled.elements) {
      if (el.type === 'vac') this.maxFreq = Math.max(this.maxFreq, Number(el.params.freq) || 0);
    }
    this.updateTimeDiv();
    useSim.setState({ compiled: this.compiled });
  }

  updateTimeDiv() {
    const scope = this.nodes.find((n) => n.data.type === 'scope');
    let td: number;
    if (scope) td = Number(scope.data.params.timeDiv) || 1e-3;
    else if (this.maxFreq > 0) td = 2 / this.maxFreq / 10;
    else td = 1e-3;
    if (td !== useSim.getState().timeDiv) useSim.setState({ timeDiv: td });
  }

  private onCircuitChange(topo: boolean) {
    const wasRunning = useSim.getState().status === 'running' || useSim.getState().status === 'paused';
    const old = this.sim;
    this.recompile();
    if (!wasRunning) {
      this.publish(true);
      return;
    }
    if (this.blockingErrors()) {
      this.stop(false);
      return;
    }
    try {
      const sim = new Simulator(this.compiled!);
      if (!topo && old && sim.adopt(old)) {
        this.sim = sim;
        // geçmiş yapısı aynı kalır (osiloskop geçişi gösterir), ölçümler yeni durumdan başlar
        if (!this.hist || this.hist.netCount !== this.compiled!.netCount) this.resetHistory();
        else {
          this.hist.epoch = sim.t;
          this.hist.push(sim);
        }
      } else {
        sim.dcOperatingPoint();
        this.sim = sim;
        this.resetHistory();
      }
      this.burntWarned.clear();
      this.powerWarned.clear();
      useSim.setState({ error: null, status: useSim.getState().status === 'error' ? 'running' : useSim.getState().status });
      this.publish(true);
    } catch (e) {
      this.fail(e);
    }
  }

  private resetHistory() {
    this.hist = new History(
      this.compiled!.netCount,
      this.compiled!.elements.map((e) => e.id),
    );
    this.nextRecord = this.sim?.t ?? 0;
    if (this.sim) this.hist.push(this.sim);
  }

  private blockingErrors(): boolean {
    const errs = this.compiled?.issues.filter((i) => i.level === 'error') ?? [];
    if (!errs.length) return false;
    const e = errs[0];
    const applyFix = e.fix
      ? () => {
          useCircuit.getState().applyFix(e.fix!);
          tepecan.say({ mood: 'success', title: 'Düzelttim!', text: e.fix!.summary + '. Şimdi tekrar başlatabilirsin.', ttl: 5000 });
        }
      : undefined;
    tepecan.say({
      mood: 'angry',
      title: e.code === 'no-ground' ? 'Toprak nerede?!' : 'Dur bir dakika!',
      text: e.message,
      key: 'err-' + e.code + (e.comp ?? ''),
      actions: applyFix ? [{ label: 'Devreyi senin için düzelteyim mi?', primary: true, run: applyFix }] : undefined,
    });
    useSim.setState({ status: 'error', error: { kind: e.code, message: e.message } });
    return true;
  }

  start() {
    this.recompile();
    if (!this.compiled || this.compiled.elements.length === 0) {
      tepecan.say({ mood: 'info', title: 'Canvas boş', text: 'Soldaki paletten eleman sürükle ya da üstten hazır bir deney seç.', ttl: 5000, key: 'empty' });
      return;
    }
    if (this.blockingErrors()) return;
    try {
      const sim = new Simulator(this.compiled);
      sim.dcOperatingPoint();
      this.sim = sim;
      this.resetHistory();
      this.burntWarned.clear();
      this.powerWarned.clear();
      useSim.setState({ status: 'running', error: null, t: 0 });
      const warns = this.compiled.issues.filter((i) => i.level === 'warning');
      if (warns.length) {
        tepecan.say({
          mood: 'surprised',
          title: 'Bir şey dikkatimi çekti',
          text: warns.slice(0, 3).map((w) => '• ' + w.message).join('\n'),
          key: 'warn-' + warns.map((w) => w.code + w.comp).join(),
          ttl: 9000,
        });
      }
      this.publish(true);
      this.loop();
    } catch (e) {
      this.fail(e);
    }
  }

  pause() {
    if (useSim.getState().status === 'running') useSim.setState({ status: 'paused' });
  }

  resume() {
    if (useSim.getState().status === 'paused') {
      useSim.setState({ status: 'running' });
      this.loop();
    } else if (useSim.getState().status !== 'running') this.start();
  }

  stop(clear = true) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sim = null;
    if (clear) this.hist = null;
    this.wireI.clear();
    useSim.setState({ status: clear ? 'stopped' : useSim.getState().status, comp: {}, meters: {}, netV: [], t: 0, lagging: false });
    this.paintWires(0, false);
  }

  restart() {
    this.stop();
    this.start();
  }

  private fail(e: unknown) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const kind = e instanceof SimError ? e.kind : 'internal';
    const message = e instanceof Error ? e.message : String(e);
    useSim.setState({ status: 'error', error: { kind, message } });
    tepecan.say({
      mood: kind === 'singular' ? 'angry' : 'error',
      title: kind === 'convergence' ? 'Hesap yakınsamadı…' : 'Devre çözülemedi',
      text: message,
      key: 'fail-' + kind,
    });
    if (!(e instanceof SimError)) console.error(e);
  }

  private loop() {
    cancelAnimationFrame(this.raf);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.animate);
  }

  private animate(now: number) {
    this.raf = requestAnimationFrame(this.animate);
    const frameDt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const st = useSim.getState();
    if (st.status === 'running' && this.sim) {
      const win = this.window;
      let dt = win / 1000;
      if (this.maxFreq > 0) dt = Math.min(dt, 1 / (this.maxFreq * 200));
      const simRate = (win / 2) * st.speed; // ekran başına ~2 sn
      const target = this.sim.t + simRate * frameDt;
      const recInt = win / 1000;
      const t0 = performance.now();
      let lag = false;
      try {
        while (this.sim.t < target - dt * 0.5) {
          this.sim.step(dt);
          if (this.sim.t >= this.nextRecord) {
            this.hist?.push(this.sim);
            this.nextRecord = this.sim.t + recInt;
          }
          if (performance.now() - t0 > 10) {
            lag = true;
            break;
          }
        }
      } catch (e) {
        this.fail(e);
        return;
      }
      if (lag !== st.lagging) useSim.setState({ lagging: lag });
      if (now - this.lastPublish > 66) {
        this.lastPublish = now;
        this.publish(false);
      }
    }
    this.paintWires(frameDt, st.status === 'running' || st.status === 'paused');
  }

  /** Kablo renklerini ve akım noktalarının hareketini doğrudan DOM'a uygula */
  private paintWires(frameDt: number, active: boolean) {
    const { netV, vmax, status } = useSim.getState();
    const moving = status === 'running';
    for (const [id, w] of wireRegistry) {
      if (!active || !netV.length) {
        w.base.style.stroke = '';
        w.dots.style.opacity = '0';
        continue;
      }
      const net = this.edgeNet.get(id);
      const v = net !== undefined ? netV[net] ?? 0 : 0;
      w.base.style.stroke = voltageColor(v, vmax);
      const I = this.wireI.get(id) ?? 0;
      const a = Math.abs(I);
      if (a < 1e-6) {
        w.dots.style.opacity = '0';
        continue;
      }
      w.dots.style.opacity = '1';
      if (moving) {
        const speed = Math.min(140, 28 * Math.log10(1 + a / 1e-5));
        w.offset -= Math.sign(I) * speed * frameDt;
        w.dots.style.strokeDashoffset = String(w.offset % 1000);
      }
    }
  }

  /** React durumuna özet yayınla */
  publish(force: boolean) {
    const sim = this.sim;
    const circ = this.compiled;
    if (!sim || !circ) {
      if (force) useSim.setState((s) => ({ tick: s.tick + 1 }));
      return;
    }
    const netV: number[] = [0];
    let vmax = 0.5;
    for (let i = 1; i < circ.netCount; i++) {
      const v = sim.x[i - 1];
      netV.push(v);
      vmax = Math.max(vmax, Math.abs(v));
    }
    // Ekran penceresindeki tepe değeri renk ölçeğinde kullan (AC'de titremesin)
    if (this.hist) {
      for (let i = 1; i < circ.netCount; i++) {
        const s = this.hist.netStats(i, this.window);
        vmax = Math.max(vmax, Math.abs(s.max), Math.abs(s.min));
      }
    }
    const comp: Record<string, CompLive> = {};
    const pinCur = new Map<string, number>();
    for (const el of circ.elements) {
      const I = sim.currentsOf(el.id) ?? [];
      let P = 0;
      el.nets.forEach((n, k) => {
        P += (n ? sim.x[n - 1] : 0) * (I[k] ?? 0);
        pinCur.set(pinKey(el.id, el.pins[k]), I[k] ?? 0);
      });
      comp[el.id] = { I: I.slice(), P, probe: sim.probeOf(el.id) };
    }
    // Kablo akımları
    this.wireI.clear();
    const sub = new Map<string, number>();
    // Bileşen bazında sink düzeltmesi: sink pinine bileşen toplamının tersi
    const sinkCur = new Map<string, number>();
    for (const c of this.plan.comps) {
      if (!c.sink) continue;
      let s = 0;
      for (const p of c.pins) s += pinCur.get(p) ?? 0;
      sinkCur.set(c.sink, -s);
    }
    const pc = (k: string) => (pinCur.get(k) ?? 0) + (sinkCur.get(k) ?? 0);
    const E = this.plan.entries;
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      const s = (sub.get(e.child) ?? 0) + pc(e.child);
      this.wireI.set(e.edgeId, s * e.sign);
      sub.set(e.parent, (sub.get(e.parent) ?? 0) + s);
    }

    // Multimetreler
    const meters: Record<string, MeterReading> = {};
    const win = Math.max(this.window, this.maxFreq ? 1 / this.maxFreq : 0);
    if (this.hist) {
      for (const el of circ.elements) {
        if (el.type !== 'multimeter') continue;
        const mode = String(el.params.mode);
        if (mode.endsWith('V')) {
          const s = this.hist.diffStats(el.nets[0], el.nets[1], win);
          meters[el.id] = { value: mode === 'DCV' ? s.avg : s.acrms, unit: 'V', mode };
        } else {
          const s = this.hist.curStats(el.id, win);
          meters[el.id] = { value: mode === 'DCA' ? s.avg : s.acrms, unit: 'A', mode };
        }
      }
    }

    // LED ve direnç güç uyarıları
    for (const el of circ.elements) {
      const live = comp[el.id];
      if (el.type === 'led') {
        const imax = Number(el.params.Imax) || 0.03;
        const i = live.I[0] ?? 0;
        live.probe.brightness = Math.max(0, Math.min(1.4, i / 0.015));
        if (i > imax) {
          live.probe.burnt = 1;
          if (!this.burntWarned.has(el.id)) {
            this.burntWarned.add(el.id);
            tepecan.say({
              mood: 'angry',
              title: `${el.name} yandı! 💥`,
              text: `${el.name} üzerinden ${formatSI(i, 'A')} akıyor; maksimum ${formatSI(imax, 'A')}. Gerçek laboratuvarda LED'i yakardın. Seri direnci büyüt!`,
              key: 'burn-' + el.id,
            });
          }
        }
      }
      if (el.type === 'lamp') {
        const i = live.I[0] ?? 0;
        const v = Number(el.params.Vnom) || 6;
        const pn = Number(el.params.Pnom) || 0.3;
        live.probe.brightness = Math.min(1.5, (i * i * ((v * v) / pn)) / pn);
      }
      if (el.type === 'resistor' && this.hist) {
        const pmax = parseFloat(String(el.params.Pmax)) || 0.25;
        const s = this.hist.curStats(el.id, win);
        const R = Number(el.params.R) || 1000;
        const pavg = s.rms * s.rms * R;
        live.probe.Pavg = pavg;
        if (pavg > pmax && !this.powerWarned.has(el.id)) {
          this.powerWarned.add(el.id);
          tepecan.say({
            mood: 'surprised',
            title: `${el.name} ısınıyor 🔥`,
            text: `${el.name} ortalama ${formatSI(pavg, 'W')} harcıyor ama ${String(el.params.Pmax).replace('.', ',')} W'lık bir direnç. Daha yüksek güçlü direnç seç ya da akımı azalt.`,
            key: 'pow-' + el.id,
          });
        }
      }
    }

    useSim.setState((s) => ({ netV, vmax, comp, meters, t: sim.t, tick: s.tick + 1 }));
  }

  /** Yapay zekâ ve laboratuvar kontrolleri için özet */
  summary() {
    const circ = this.compiled;
    const h = this.hist;
    if (!circ) return null;
    const win = Math.max(this.window, this.maxFreq ? 1 / this.maxFreq : 0);
    const nets = circ.netNames.map((name, i) => ({ name, stats: h ? h.netStats(i, win) : null }));
    const elements = circ.elements.map((el) => ({
      el,
      cur: h ? h.curStats(el.id, win) : null,
      probe: this.sim?.probeOf(el.id) ?? {},
    }));
    return { circ, nets, elements, t: this.sim?.t ?? 0, window: win };
  }

  netStatsByName(name: string): Stats | null {
    const circ = this.compiled;
    if (!circ || !this.hist) return null;
    const i = circ.netNames.findIndex((n) => n.toUpperCase() === name.toUpperCase());
    if (i < 0) return null;
    const win = Math.max(this.window, this.maxFreq ? 1 / this.maxFreq : 0);
    return this.hist.netStats(i, win);
  }

  netIndexOfPin(nodeId: string, pin: string): number | undefined {
    return this.compiled?.pinNet[pinKey(nodeId, pin)];
  }
}

export const runner = new SimRunner();

export const ledColor = (c: unknown) => (LED_COLORS[String(c)] ?? LED_COLORS.red).rgb;
export const isRotatable = (t: keyof typeof LIBRARY) => LIBRARY[t].rotatable;
