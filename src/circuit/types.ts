export type CompType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'switch'
  | 'xfmr'
  | 'xfmr_ct'
  | 'diode'
  | 'zener'
  | 'led'
  | 'npn'
  | 'pnp'
  | 'nmos'
  | 'pmos'
  | 'vdc'
  | 'vac'
  | 'idc'
  | 'ground'
  | 'label'
  | 'multimeter'
  | 'scope'
  // v0.2 eklemeleri
  | 'opamp'
  | 'vcvs'
  | 'vccs'
  | 'cccs'
  | 'ccvs'
  | 'pot'
  | 'button'
  | 'battery'
  | 'lamp'
  | 'ldr'
  | 'ntc'
  | 'reg78'
  | 'and'
  | 'or'
  | 'not'
  | 'nand'
  | 'nor'
  | 'xor'
  | 'clock'
  | 'logicin'
  | 'logicprobe'
  | 'dff'
  | 'timer555'
  // v0.3 ek bileşenler
  | 'buzzer'
  | 'ptc'
  | 'varistor'
  | 'fuse'
  | 'jfet'
  | 'tl431';

export type ParamValue = number | string | boolean;

/** React Flow düğümünün data alanı */
export interface CompData {
  [key: string]: unknown;
  type: CompType;
  name: string;
  params: Record<string, ParamValue>;
  rot: number;
}

/** Kaydedilebilir/paylaşılabilir devre (JSON şablon formatı) */
export interface CircuitDoc {
  version: 1;
  title?: string;
  components: {
    id: string;
    type: CompType;
    name: string;
    x: number;
    y: number;
    rot?: number;
    params?: Record<string, ParamValue>;
  }[];
  wires: { id?: string; from: string; to: string }[]; // "R1.a" → "D1.k" (isim.pin)
}

export interface CompiledElement {
  id: string;
  name: string;
  type: CompType;
  nets: number[];
  pins: string[];
  params: Record<string, ParamValue>;
}

export interface Issue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  comp?: string; // eleman adı
  fix?: FixPatch;
}

export interface CompiledCircuit {
  netCount: number;
  netNames: string[];
  elements: CompiledElement[];
  pinNet: Record<string, number>; // `${nodeId}:${pinId}` → net
  /** Kablo akımı hesabı için ağaç bilgisi */
  wireTree: WireTreeEntry[];
  issues: Issue[];
  hasGround: boolean;
}

export interface WireTreeEntry {
  edgeId: string;
  child: string; // pin anahtarı
  parent: string;
  sign: 1 | -1; // kenar source→target yönü ile parent→child yönü aynı ise +1
  order: number;
}

export type FixAction =
  | { op: 'flip'; id: string }
  | { op: 'set'; id: string; param: string; value: ParamValue }
  | { op: 'toggle'; id: string }
  | { op: 'remove'; id: string }
  | { op: 'connectGround'; id: string; pin: string };

export interface FixPatch {
  summary: string;
  actions: FixAction[];
}
