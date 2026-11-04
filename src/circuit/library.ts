// Eleman kütüphanesi: her devre elemanının "manifestosu" (pinler, boyut, parametreler, 3D karşılığı)
import type { CompType, ParamValue } from './types';

export interface PinDef {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface ParamDef {
  key: string;
  label: string;
  unit?: string;
  kind: 'number' | 'select' | 'bool' | 'text';
  default: ParamValue;
  options?: { value: string; label: string }[];
  min?: number;
  /** select değiştiğinde diğer parametrelere uygulanacak hazır değerler */
  presets?: Record<string, Record<string, ParamValue>>;
  advanced?: boolean;
  hint?: string;
}

/** 3D montaj manifestosu: fiziksel gövde tipi ve boyutları (mm) */
export interface Physical {
  body:
    | 'axial-resistor'
    | 'axial-diode'
    | 'glass-diode'
    | 'radial-cap'
    | 'disc-cap'
    | 'axial-inductor'
    | 'led-5mm'
    | 'to92'
    | 'slide-switch'
    | 'instrument'
    | 'none';
  length?: number;
  diameter?: number;
  /** breadboard'a takılır mı, yoksa masa üstü cihaz mı */
  onBoard: boolean;
  instrument?: 'psu' | 'siggen' | 'dmm' | 'scope' | 'transformer' | 'current-source';
}

export interface CompDef {
  type: CompType;
  label: string;
  short: string;
  prefix: string;
  category: Category;
  w: number;
  h: number;
  pins: PinDef[];
  params: ParamDef[];
  rotatable: boolean;
  electrical: boolean;
  physical: Physical;
  description: string;
}

export type Category = 'Pasif Elemanlar' | 'Yarı İletkenler' | 'Kaynaklar' | 'Ölçü Aletleri' | 'Bağlantı';

export const CATEGORIES: { id: Category; icon: string }[] = [
  { id: 'Kaynaklar', icon: '⚡' },
  { id: 'Pasif Elemanlar', icon: '〰' },
  { id: 'Yarı İletkenler', icon: '▶' },
  { id: 'Ölçü Aletleri', icon: '◎' },
  { id: 'Bağlantı', icon: '⏚' },
];

const two = (a = 'a', b = 'b', la = '1', lb = '2'): PinDef[] => [
  { id: a, label: la, x: 0, y: 20 },
  { id: b, label: lb, x: 80, y: 20 },
];
const vert = (p = 'p', n = 'n'): PinDef[] => [
  { id: p, label: '+', x: 20, y: 0 },
  { id: n, label: '−', x: 20, y: 80 },
];

export const DIODE_MODELS: Record<string, { Is: number; N: number; Imax: number; label: string }> = {
  '1N4001': { Is: 14.11e-9, N: 1.984, Imax: 1, label: '1N4001 (doğrultucu, 1 A)' },
  '1N4148': { Is: 2.52e-9, N: 1.752, Imax: 0.3, label: '1N4148 (sinyal, 300 mA)' },
  ideal: { Is: 1e-14, N: 1, Imax: 10, label: 'Genel (Is=10 fA, n=1)' },
};

export const LED_COLORS: Record<string, { vf: number; rgb: string; label: string }> = {
  red: { vf: 1.8, rgb: '#ff3b3b', label: 'Kırmızı (1,8 V)' },
  yellow: { vf: 2.0, rgb: '#ffd23b', label: 'Sarı (2,0 V)' },
  green: { vf: 2.1, rgb: '#3bff6e', label: 'Yeşil (2,1 V)' },
  blue: { vf: 3.0, rgb: '#3b9bff', label: 'Mavi (3,0 V)' },
  white: { vf: 3.0, rgb: '#f2f6ff', label: 'Beyaz (3,0 V)' },
};

export const LIBRARY: Record<CompType, CompDef> = {
  resistor: {
    type: 'resistor', label: 'Direnç', short: 'R', prefix: 'R', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      { key: 'R', label: 'Direnç', unit: 'Ω', kind: 'number', default: 1000, min: 1e-3 },
      {
        key: 'Pmax', label: 'Güç değeri', unit: 'W', kind: 'select', default: '0.25',
        options: ['0.125', '0.25', '0.5', '1', '2', '5'].map((v) => ({ value: v, label: `${v.replace('.', ',')} W` })),
        advanced: true,
      },
    ],
    physical: { body: 'axial-resistor', length: 6.3, diameter: 2.4, onBoard: true },
    description: 'Ohm yasasına uyan doğrusal eleman: V = I·R',
  },
  capacitor: {
    type: 'capacitor', label: 'Kapasitör', short: 'C', prefix: 'C', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'C', label: 'Kapasitans', unit: 'F', kind: 'number', default: 10e-6, min: 1e-15 }],
    physical: { body: 'radial-cap', length: 11, diameter: 5, onBoard: true },
    description: 'Yük depolar: i = C·dv/dt. DC’de açık devre gibi davranır.',
  },
  inductor: {
    type: 'inductor', label: 'Bobin', short: 'L', prefix: 'L', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'L', label: 'Endüktans', unit: 'H', kind: 'number', default: 10e-3, min: 1e-12 }],
    physical: { body: 'axial-inductor', length: 9, diameter: 4, onBoard: true },
    description: 'Manyetik alanda enerji depolar: v = L·di/dt. DC’de kısa devre gibi davranır.',
  },
  switch: {
    type: 'switch', label: 'Anahtar', short: 'S', prefix: 'S', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'closed', label: 'Kapalı', kind: 'bool', default: false, hint: 'Canvas üzerinde tıklayarak da açıp kapatabilirsin' }],
    physical: { body: 'slide-switch', onBoard: true },
    description: 'Açık: ~1 GΩ, Kapalı: ~1 mΩ',
  },
  xfmr: {
    type: 'xfmr', label: 'Transformatör', short: 'T', prefix: 'T', category: 'Pasif Elemanlar',
    w: 80, h: 80, rotatable: false, electrical: true,
    pins: [
      { id: 'p1', label: 'P1', x: 0, y: 0 },
      { id: 'p2', label: 'P2', x: 0, y: 80 },
      { id: 's1', label: 'S1', x: 80, y: 0 },
      { id: 's2', label: 'S2', x: 80, y: 80 },
    ],
    params: [{ key: 'n', label: 'Sarım oranı (Np:Ns)', kind: 'number', default: 10, min: 1e-3, hint: '10 → 220 V girişte 22 V çıkış' }],
    physical: { body: 'instrument', onBoard: false, instrument: 'transformer' },
    description: 'İdeal transformatör: Vs = Vp / n, primer ve sekonder galvanik olarak yalıtılmış.',
  },
  xfmr_ct: {
    type: 'xfmr_ct', label: 'Orta Uçlu Trafo', short: 'T', prefix: 'T', category: 'Pasif Elemanlar',
    w: 80, h: 80, rotatable: false, electrical: true,
    pins: [
      { id: 'p1', label: 'P1', x: 0, y: 0 },
      { id: 'p2', label: 'P2', x: 0, y: 80 },
      { id: 's1', label: 'S1', x: 80, y: 0 },
      { id: 'ct', label: 'CT', x: 80, y: 40 },
      { id: 's2', label: 'S2', x: 80, y: 80 },
    ],
    params: [{ key: 'n', label: 'Sarım oranı (Np:Ns toplam)', kind: 'number', default: 10, min: 1e-3 }],
    physical: { body: 'instrument', onBoard: false, instrument: 'transformer' },
    description: 'Orta uçlu (center-tap) ideal trafo; her yarı sargı Vp/(2n) verir.',
  },
  diode: {
    type: 'diode', label: 'Diyot', short: 'D', prefix: 'D', category: 'Yarı İletkenler',
    w: 80, h: 40, pins: two('a', 'k', 'A', 'K'), rotatable: true, electrical: true,
    params: [
      {
        key: 'model', label: 'Model', kind: 'select', default: '1N4001',
        options: Object.entries(DIODE_MODELS).map(([k, v]) => ({ value: k, label: v.label })),
        presets: Object.fromEntries(Object.entries(DIODE_MODELS).map(([k, v]) => [k, { Is: v.Is, N: v.N }])),
      },
      { key: 'Is', label: 'Doyma akımı Is', unit: 'A', kind: 'number', default: DIODE_MODELS['1N4001'].Is, advanced: true },
      { key: 'N', label: 'İdealite faktörü n', kind: 'number', default: DIODE_MODELS['1N4001'].N, advanced: true },
    ],
    physical: { body: 'axial-diode', length: 5.2, diameter: 2.7, onBoard: true },
    description: 'Shockley modeli: I = Is·(e^(V/nVT) − 1). Anot (A) → Katot (K) yönünde iletir.',
  },
  zener: {
    type: 'zener', label: 'Zener Diyot', short: 'Z', prefix: 'Z', category: 'Yarı İletkenler',
    w: 80, h: 40, pins: two('a', 'k', 'A', 'K'), rotatable: true, electrical: true,
    params: [
      { key: 'Vz', label: 'Zener gerilimi', unit: 'V', kind: 'number', default: 5.1, min: 0.5 },
      { key: 'Is', label: 'Doyma akımı Is', unit: 'A', kind: 'number', default: 1e-14, advanced: true },
      { key: 'N', label: 'İdealite faktörü n', kind: 'number', default: 1, advanced: true },
    ],
    physical: { body: 'glass-diode', length: 3.5, diameter: 1.8, onBoard: true },
    description: 'Ters yönde Vz geriliminde kırılmaya girer; gerilim regülatörü olarak kullanılır.',
  },
  led: {
    type: 'led', label: 'LED', short: 'LED', prefix: 'LED', category: 'Yarı İletkenler',
    w: 80, h: 40, pins: two('a', 'k', 'A', 'K'), rotatable: true, electrical: true,
    params: [
      {
        key: 'color', label: 'Renk', kind: 'select', default: 'red',
        options: Object.entries(LED_COLORS).map(([k, v]) => ({ value: k, label: v.label })),
      },
      { key: 'Imax', label: 'Maks. akım', unit: 'A', kind: 'number', default: 0.03, advanced: true },
    ],
    physical: { body: 'led-5mm', onBoard: true },
    description: 'Işık yayan diyot. Akımı sınırlamak için seri direnç şarttır!',
  },
  npn: {
    type: 'npn', label: 'NPN Transistör', short: 'Q', prefix: 'Q', category: 'Yarı İletkenler',
    w: 60, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'b', label: 'B', x: 0, y: 40 },
      { id: 'c', label: 'C', x: 40, y: 0 },
      { id: 'e', label: 'E', x: 40, y: 80 },
    ],
    params: [
      { key: 'beta', label: 'Akım kazancı βF', kind: 'number', default: 100, min: 1 },
      { key: 'betaR', label: 'Ters kazanç βR', kind: 'number', default: 1, min: 0.01, advanced: true },
      { key: 'Is', label: 'Doyma akımı Is', unit: 'A', kind: 'number', default: 1e-14, advanced: true },
    ],
    physical: { body: 'to92', onBoard: true },
    description: 'Ebers-Moll modeli. Aktif bölgede Ic ≈ β·Ib.',
  },
  pnp: {
    type: 'pnp', label: 'PNP Transistör', short: 'Q', prefix: 'Q', category: 'Yarı İletkenler',
    w: 60, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'b', label: 'B', x: 0, y: 40 },
      { id: 'c', label: 'C', x: 40, y: 80 },
      { id: 'e', label: 'E', x: 40, y: 0 },
    ],
    params: [
      { key: 'beta', label: 'Akım kazancı βF', kind: 'number', default: 100, min: 1 },
      { key: 'betaR', label: 'Ters kazanç βR', kind: 'number', default: 1, min: 0.01, advanced: true },
      { key: 'Is', label: 'Doyma akımı Is', unit: 'A', kind: 'number', default: 1e-14, advanced: true },
    ],
    physical: { body: 'to92', onBoard: true },
    description: 'Ebers-Moll modeli (PNP). Emetör üstte, aktif bölgede Ic ≈ β·Ib.',
  },
  nmos: {
    type: 'nmos', label: 'N-MOSFET', short: 'M', prefix: 'M', category: 'Yarı İletkenler',
    w: 60, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'g', label: 'G', x: 0, y: 40 },
      { id: 'd', label: 'D', x: 40, y: 0 },
      { id: 's', label: 'S', x: 40, y: 80 },
    ],
    params: [
      { key: 'Vth', label: 'Eşik gerilimi Vth', unit: 'V', kind: 'number', default: 1 },
      { key: 'K', label: "k'n·(W/L)", unit: 'A/V²', kind: 'number', default: 2e-3, min: 1e-9 },
      { key: 'lambda', label: 'Kanal boyu modülasyonu λ', unit: '1/V', kind: 'number', default: 0, advanced: true },
    ],
    physical: { body: 'to92', onBoard: true },
    description: 'Seviye-1 (Shichman-Hodges): doyumda Id = ½·k·(Vgs − Vth)²',
  },
  pmos: {
    type: 'pmos', label: 'P-MOSFET', short: 'M', prefix: 'M', category: 'Yarı İletkenler',
    w: 60, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'g', label: 'G', x: 0, y: 40 },
      { id: 'd', label: 'D', x: 40, y: 80 },
      { id: 's', label: 'S', x: 40, y: 0 },
    ],
    params: [
      { key: 'Vth', label: '|Vth|', unit: 'V', kind: 'number', default: 1 },
      { key: 'K', label: "k'p·(W/L)", unit: 'A/V²', kind: 'number', default: 2e-3, min: 1e-9 },
      { key: 'lambda', label: 'Kanal boyu modülasyonu λ', unit: '1/V', kind: 'number', default: 0, advanced: true },
    ],
    physical: { body: 'to92', onBoard: true },
    description: 'Seviye-1 PMOS. Kaynak (S) üstte; Vsg > |Vth| olduğunda iletir.',
  },
  vdc: {
    type: 'vdc', label: 'DC Gerilim Kaynağı', short: 'V', prefix: 'V', category: 'Kaynaklar',
    w: 40, h: 80, pins: vert('p', 'n'), rotatable: true, electrical: true,
    params: [{ key: 'V', label: 'Gerilim', unit: 'V', kind: 'number', default: 5 }],
    physical: { body: 'instrument', onBoard: false, instrument: 'psu' },
    description: 'İdeal DC gerilim kaynağı (laboratuvar güç kaynağı).',
  },
  vac: {
    type: 'vac', label: 'Sinyal Üreteci (AC)', short: 'VG', prefix: 'VG', category: 'Kaynaklar',
    w: 40, h: 80, pins: vert('p', 'n'), rotatable: true, electrical: true,
    params: [
      {
        key: 'wave', label: 'Dalga şekli', kind: 'select', default: 'sine',
        options: [
          { value: 'sine', label: 'Sinüs' },
          { value: 'square', label: 'Kare' },
          { value: 'triangle', label: 'Üçgen' },
        ],
      },
      { key: 'amp', label: 'Genlik (tepe)', unit: 'V', kind: 'number', default: 5, min: 0 },
      { key: 'freq', label: 'Frekans', unit: 'Hz', kind: 'number', default: 1000, min: 1e-3 },
      { key: 'offset', label: 'DC ofset', unit: 'V', kind: 'number', default: 0 },
      { key: 'phase', label: 'Faz', unit: '°', kind: 'number', default: 0, advanced: true },
      { key: 'Rs', label: 'İç direnç', unit: 'Ω', kind: 'number', default: 0, min: 0, advanced: true, hint: 'Gerçek fonksiyon üreteçleri ~50 Ω' },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'siggen' },
    description: 'Fonksiyon üreteci: v(t) = ofset + genlik·sin(2πft + φ)',
  },
  idc: {
    type: 'idc', label: 'DC Akım Kaynağı', short: 'I', prefix: 'I', category: 'Kaynaklar',
    w: 40, h: 80, pins: vert('p', 'n'), rotatable: true, electrical: true,
    params: [{ key: 'I', label: 'Akım', unit: 'A', kind: 'number', default: 1e-3 }],
    physical: { body: 'instrument', onBoard: false, instrument: 'current-source' },
    description: 'İdeal akım kaynağı; akım (+) ucundan dış devreye çıkar.',
  },
  ground: {
    type: 'ground', label: 'Toprak (GND)', short: 'GND', prefix: 'GND', category: 'Bağlantı',
    w: 40, h: 40, pins: [{ id: 'g', label: 'GND', x: 20, y: 0 }], rotatable: false, electrical: false,
    params: [],
    physical: { body: 'none', onBoard: false },
    description: '0 V referans düğümü. Her devrede en az bir tane olmalı!',
  },
  label: {
    type: 'label', label: 'Düğüm Etiketi', short: 'NET', prefix: 'NET', category: 'Bağlantı',
    w: 80, h: 40, pins: [{ id: 'p', label: '', x: 0, y: 20 }], rotatable: false, electrical: false,
    params: [{ key: 'text', label: 'Etiket', kind: 'text', default: 'VOUT' }],
    physical: { body: 'none', onBoard: false },
    description: 'Aynı isimli etiketler kablo olmadan birbirine bağlıdır. Yapay zekâ düğümleri bu isimlerle görür.',
  },
  multimeter: {
    type: 'multimeter', label: 'Multimetre', short: 'DMM', prefix: 'DMM', category: 'Ölçü Aletleri',
    w: 120, h: 100, rotatable: false, electrical: true,
    pins: [
      { id: 'pos', label: 'V/A', x: 40, y: 100 },
      { id: 'com', label: 'COM', x: 80, y: 100 },
    ],
    params: [
      {
        key: 'mode', label: 'Kademe', kind: 'select', default: 'DCV',
        options: [
          { value: 'DCV', label: 'V ⎓ (DC gerilim)' },
          { value: 'ACV', label: 'V ∿ (AC gerilim, RMS)' },
          { value: 'DCA', label: 'A ⎓ (DC akım)' },
          { value: 'ACA', label: 'A ∿ (AC akım, RMS)' },
        ],
        hint: 'Akım kademesinde multimetre devreye SERİ bağlanmalı!',
      },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'dmm' },
    description: 'Voltmetre (ideal, sonsuz iç direnç) veya ampermetre (0 Ω) olarak çalışır.',
  },
  scope: {
    type: 'scope', label: 'Osiloskop', short: 'OSC', prefix: 'OSC', category: 'Ölçü Aletleri',
    w: 140, h: 100, rotatable: false, electrical: false,
    pins: [
      { id: 'ch1', label: 'CH1', x: 40, y: 100 },
      { id: 'ch2', label: 'CH2', x: 100, y: 100 },
    ],
    params: [
      { key: 'timeDiv', label: 'Zaman/böl.', unit: 's', kind: 'number', default: 0.2e-3 },
      { key: 'ch1Div', label: 'CH1 V/böl.', unit: 'V', kind: 'number', default: 2 },
      { key: 'ch2Div', label: 'CH2 V/böl.', unit: 'V', kind: 'number', default: 2 },
      { key: 'ch1Pos', label: 'CH1 konum', unit: 'böl.', kind: 'number', default: 0, advanced: true },
      { key: 'ch2Pos', label: 'CH2 konum', unit: 'böl.', kind: 'number', default: 0, advanced: true },
      { key: 'trig', label: 'Tetik seviyesi', unit: 'V', kind: 'number', default: 0, advanced: true },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'scope' },
    description: 'İki kanallı osiloskop. Problar devre toprağına göre ölçer (toprak klipsi GND’de).',
  },
};

export const LIB_LIST: CompDef[] = Object.values(LIBRARY);

export function defaultParams(type: CompType): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const p of LIBRARY[type].params) out[p.key] = p.default;
  return out;
}

/** Döndürülmüş kutu boyutu */
export function rotatedSize(def: CompDef, rot: number): { w: number; h: number } {
  return rot % 180 === 0 ? { w: def.w, h: def.h } : { w: def.h, h: def.w };
}

/** Pin koordinatını döndür (saat yönünde) */
export function rotatePin(def: CompDef, pin: PinDef, rot: number): { x: number; y: number } {
  const { w, h } = def;
  switch (((rot % 360) + 360) % 360) {
    case 90: return { x: h - pin.y, y: pin.x };
    case 180: return { x: w - pin.x, y: h - pin.y };
    case 270: return { x: pin.y, y: w - pin.x };
    default: return { x: pin.x, y: pin.y };
  }
}

export function pinSide(def: CompDef, pin: PinDef, rot: number): 'left' | 'right' | 'top' | 'bottom' {
  const { w, h } = rotatedSize(def, rot);
  const p = rotatePin(def, pin, rot);
  const d = [
    { s: 'left' as const, v: p.x },
    { s: 'right' as const, v: w - p.x },
    { s: 'top' as const, v: p.y },
    { s: 'bottom' as const, v: h - p.y },
  ];
  d.sort((a, b) => a.v - b.v);
  return d[0].s;
}
