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
  kind: 'number' | 'select' | 'bool' | 'text' | 'slider';
  default: ParamValue;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  /** kaydırıcı logaritmik mi */
  log?: boolean;
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
    | 'dip8'
    | 'dip14'
    | 'to220'
    | 'trimpot'
    | 'tactile'
    | 'bulb'
    | 'ldr'
    | 'thermistor'
    | 'instrument'
    | 'none';
  length?: number;
  diameter?: number;
  /** breadboard'a takılır mı, yoksa masa üstü cihaz mı */
  onBoard: boolean;
  instrument?: 'psu' | 'siggen' | 'dmm' | 'scope' | 'transformer' | 'current-source' | 'battery' | 'logic';
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

export type Category =
  | 'Kaynaklar'
  | 'Pasif Elemanlar'
  | 'Anahtar ve Sensörler'
  | 'Yarı İletkenler'
  | 'Entegre Devreler'
  | 'Dijital'
  | 'Ölçü Aletleri'
  | 'Bağlantı';

export const CATEGORIES: { id: Category; icon: string }[] = [
  { id: 'Kaynaklar', icon: '⚡' },
  { id: 'Pasif Elemanlar', icon: '〰' },
  { id: 'Anahtar ve Sensörler', icon: '⏻' },
  { id: 'Yarı İletkenler', icon: '▶' },
  { id: 'Entegre Devreler', icon: '▭' },
  { id: 'Dijital', icon: '01' },
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
  '1N5819': { Is: 31.7e-6, N: 1.373, Imax: 1, label: '1N5819 (Schottky, ~0,3 V)' },
  ideal: { Is: 1e-14, N: 1, Imax: 10, label: 'Genel (Is=10 fA, n=1)' },
};

export const LED_COLORS: Record<string, { vf: number; rgb: string; label: string }> = {
  red: { vf: 1.8, rgb: '#ff3b3b', label: 'Kırmızı (1,8 V)' },
  yellow: { vf: 2.0, rgb: '#ffd23b', label: 'Sarı (2,0 V)' },
  green: { vf: 2.1, rgb: '#3bff6e', label: 'Yeşil (2,1 V)' },
  blue: { vf: 3.0, rgb: '#3b9bff', label: 'Mavi (3,0 V)' },
  white: { vf: 3.0, rgb: '#f2f6ff', label: 'Beyaz (3,0 V)' },
};

function gate(type: 'and' | 'or' | 'nand' | 'nor' | 'xor', label: string, description: string): CompDef {
  return {
    type, label, short: type.toUpperCase(), prefix: 'G', category: 'Dijital',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'a', label: 'A', x: 0, y: 20 },
      { id: 'b', label: 'B', x: 0, y: 60 },
      { id: 'y', label: 'Y', x: 80, y: 40 },
    ],
    params: [],
    physical: { body: 'dip14', onBoard: true },
    description: description + ' 5 V CMOS benzeri; eşik 2,5 V. Boşta kalan giriş belirsizdir!',
  };
}

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
    params: [
      { key: 'C', label: 'Kapasitans', unit: 'F', kind: 'number', default: 10e-6, min: 1e-15 },
      { key: 'useIc', label: 'Başlangıç gerilimi kullan', kind: 'bool', default: false, advanced: true },
      { key: 'ic', label: 'Başlangıç gerilimi', unit: 'V', kind: 'number', default: 0, advanced: true, hint: 'Osilatörleri başlatmak için küçük bir değer (ör. 0,1 V)' },
    ],
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
    type: 'switch', label: 'Anahtar', short: 'S', prefix: 'S', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'closed', label: 'Kapalı', kind: 'bool', default: false, hint: 'Canvas üzerinde tıklayarak da açıp kapatabilirsin' }],
    physical: { body: 'slide-switch', onBoard: true },
    description: 'Açık: ~1 TΩ, Kapalı: ~1 mΩ',
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
      {
        key: 'model', label: 'Model', kind: 'select', default: 'genel',
        options: [
          { value: 'genel', label: 'Genel (β = 100)' },
          { value: '2N3904', label: '2N3904 (küçük sinyal)' },
          { value: '2N2222', label: '2N2222 (anahtarlama, 600 mA)' },
          { value: 'BC547', label: 'BC547B' },
        ],
        presets: {
          genel: { beta: 100, betaR: 1, Is: 1e-14 },
          '2N3904': { beta: 416, betaR: 0.737, Is: 6.734e-15 },
          '2N2222': { beta: 256, betaR: 6.09, Is: 14.34e-15 },
          BC547: { beta: 290, betaR: 7.5, Is: 7e-15 },
        },
      },
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
      {
        key: 'model', label: 'Model', kind: 'select', default: 'genel',
        options: [
          { value: 'genel', label: 'Genel (β = 100)' },
          { value: '2N3906', label: '2N3906 (küçük sinyal)' },
          { value: 'BC557', label: 'BC557B' },
        ],
        presets: {
          genel: { beta: 100, betaR: 1, Is: 1e-14 },
          '2N3906': { beta: 181, betaR: 4.98, Is: 1.41e-15 },
          BC557: { beta: 250, betaR: 5, Is: 5e-15 },
        },
      },
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
      {
        key: 'model', label: 'Model', kind: 'select', default: 'genel',
        options: [
          { value: 'genel', label: 'Genel (Vth = 1 V)' },
          { value: '2N7000', label: '2N7000 (küçük sinyal, 200 mA)' },
          { value: 'IRF540', label: 'IRF540N (güç, 33 A)' },
        ],
        presets: {
          genel: { Vth: 1, K: 2e-3, lambda: 0 },
          '2N7000': { Vth: 2.1, K: 0.1, lambda: 0.01 },
          IRF540: { Vth: 3.5, K: 3, lambda: 0.005 },
        },
      },
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
      {
        key: 'model', label: 'Model', kind: 'select', default: 'genel',
        options: [
          { value: 'genel', label: 'Genel (|Vth| = 1 V)' },
          { value: 'BS250', label: 'BS250 (küçük sinyal)' },
          { value: 'IRF9540', label: 'IRF9540 (güç)' },
        ],
        presets: {
          genel: { Vth: 1, K: 2e-3, lambda: 0 },
          BS250: { Vth: 2, K: 0.05, lambda: 0.01 },
          IRF9540: { Vth: 3.5, K: 2, lambda: 0.005 },
        },
      },
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
      { key: 'xy', label: 'XY modu', kind: 'bool', default: false, advanced: true },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'scope' },
    description: 'İki kanallı osiloskop. Problar devre toprağına göre ölçer (toprak klipsi GND’de).',
  },
  // ───────────── v0.2: yeni elemanlar ─────────────
  battery: {
    type: 'battery', label: 'Pil / Akü', short: 'BAT', prefix: 'BAT', category: 'Kaynaklar',
    w: 40, h: 80, pins: vert('p', 'n'), rotatable: true, electrical: true,
    params: [
      {
        key: 'preset', label: 'Tip', kind: 'select', default: '9V',
        options: [
          { value: 'AA', label: 'AA kalem pil (1,5 V)' },
          { value: '9V', label: '9 V pil' },
          { value: 'Li', label: 'Li-ion hücre (3,7 V)' },
          { value: '12V', label: '12 V kurşun-asit akü' },
          { value: 'custom', label: 'Özel' },
        ],
        presets: { AA: { V: 1.5, Rint: 0.15 }, '9V': { V: 9, Rint: 1.5 }, Li: { V: 3.7, Rint: 0.05 }, '12V': { V: 12, Rint: 0.02 } },
      },
      { key: 'V', label: 'Gerilim', unit: 'V', kind: 'number', default: 9 },
      { key: 'Rint', label: 'İç direnç', unit: 'Ω', kind: 'number', default: 1.5, min: 0, advanced: true },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'battery' },
    description: 'İç dirençli gerçek pil. Yük akımı arttıkça uç gerilimi I·R_iç kadar düşer.',
  },
  clock: {
    type: 'clock', label: 'Kare Dalga / Saat', short: 'CLK', prefix: 'CLK', category: 'Kaynaklar',
    w: 40, h: 80, pins: vert('p', 'n'), rotatable: true, electrical: true,
    params: [
      { key: 'freq', label: 'Frekans', unit: 'Hz', kind: 'number', default: 1000, min: 1e-3 },
      { key: 'duty', label: 'Doluluk oranı', kind: 'slider', default: 0.5, min: 0.01, max: 0.99, step: 0.01 },
      { key: 'V', label: 'Yüksek seviye', unit: 'V', kind: 'number', default: 5 },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'siggen' },
    description: '0 V ile V arasında gidip gelen kare dalga (PWM). Dijital devrelerde saat (clock) sinyali olarak kullanılır.',
  },
  vcvs: {
    type: 'vcvs', label: 'Bağımlı Gerilim Kaynağı (VCVS)', short: 'E', prefix: 'E', category: 'Kaynaklar',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'op', label: '+', x: 60, y: 0 },
      { id: 'on', label: '−', x: 60, y: 80 },
      { id: 'cp', label: 'c+', x: 0, y: 20 },
      { id: 'cn', label: 'c−', x: 0, y: 60 },
    ],
    params: [{ key: 'gain', label: 'Kazanç μ', unit: 'V/V', kind: 'number', default: 10 }],
    physical: { body: 'none', onBoard: false },
    description: 'Gerilim kontrollü gerilim kaynağı: V(+,−) = μ·V(c+,c−). Devre teorisi derslerindeki “bağımlı kaynak”.',
  },
  vccs: {
    type: 'vccs', label: 'Bağımlı Akım Kaynağı (VCCS)', short: 'G', prefix: 'G', category: 'Kaynaklar',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'op', label: '+', x: 60, y: 0 },
      { id: 'on', label: '−', x: 60, y: 80 },
      { id: 'cp', label: 'c+', x: 0, y: 20 },
      { id: 'cn', label: 'c−', x: 0, y: 60 },
    ],
    params: [{ key: 'gain', label: 'Geçiş iletkenliği gm', unit: 'S', kind: 'number', default: 1e-3 }],
    physical: { body: 'none', onBoard: false },
    description: 'Gerilim kontrollü akım kaynağı: (+) ucundan kaynağın içinden (−) ucuna gm·V(c+,c−) akar. Transistörün küçük işaret modeli.',
  },
  cccs: {
    type: 'cccs', label: 'Akım Kontrollü Akım K. (CCCS)', short: 'F', prefix: 'F', category: 'Kaynaklar',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'op', label: '+', x: 60, y: 0 },
      { id: 'on', label: '−', x: 60, y: 80 },
      { id: 'sp', label: 'i→', x: 0, y: 20 },
      { id: 'sn', label: '→', x: 0, y: 60 },
    ],
    params: [{ key: 'gain', label: 'Akım kazancı β', unit: 'A/A', kind: 'number', default: 10 }],
    physical: { body: 'none', onBoard: false },
    description: 'Algılama ucundan (üst→alt) geçen akımın β katını üretir. BJT’nin “Ic = β·Ib” modelinin özü.',
  },
  ccvs: {
    type: 'ccvs', label: 'Akım Kontrollü Gerilim K. (CCVS)', short: 'H', prefix: 'H', category: 'Kaynaklar',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'op', label: '+', x: 60, y: 0 },
      { id: 'on', label: '−', x: 60, y: 80 },
      { id: 'sp', label: 'i→', x: 0, y: 20 },
      { id: 'sn', label: '→', x: 0, y: 60 },
    ],
    params: [{ key: 'gain', label: 'Geçiş direnci r', unit: 'Ω', kind: 'number', default: 1000 }],
    physical: { body: 'none', onBoard: false },
    description: 'Algılama ucundan geçen akımla orantılı gerilim üretir: V = r·i (transimpedans).',
  },
  pot: {
    type: 'pot', label: 'Potansiyometre', short: 'POT', prefix: 'POT', category: 'Pasif Elemanlar',
    w: 80, h: 40, rotatable: true, electrical: true,
    pins: [
      { id: 'a', label: '1', x: 0, y: 20 },
      { id: 'w', label: 'W', x: 40, y: 0 },
      { id: 'b', label: '3', x: 80, y: 20 },
    ],
    params: [
      { key: 'R', label: 'Toplam direnç', unit: 'Ω', kind: 'number', default: 10e3, min: 1 },
      { key: 'pos', label: 'Konum (1 → 3)', kind: 'slider', default: 0.5, min: 0, max: 1, step: 0.01, hint: 'Simülasyon çalışırken kaydır' },
    ],
    physical: { body: 'trimpot', onBoard: true },
    description: 'Ayarlı gerilim bölücü: orta uç (W) 1 ile 3 arasında kayar. Ses ayarı, kalibrasyon, referans gerilimi.',
  },
  button: {
    type: 'button', label: 'Buton', short: 'BTN', prefix: 'BTN', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      {
        key: 'kind', label: 'Tip', kind: 'select', default: 'NO',
        options: [
          { value: 'NO', label: 'Normalde açık (NO)' },
          { value: 'NC', label: 'Normalde kapalı (NC)' },
        ],
      },
      { key: 'pressed', label: 'Basılı', kind: 'bool', default: false, hint: 'Canvas’ta butonun üstüne basılı tut' },
    ],
    physical: { body: 'tactile', onBoard: true },
    description: 'Basıldığı sürece kontak kapanır. Dijital girişlerde mutlaka pull-up ya da pull-down direnciyle kullanılır.',
  },
  lamp: {
    type: 'lamp', label: 'Lamba', short: 'LMP', prefix: 'LMP', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      { key: 'Vnom', label: 'Anma gerilimi', unit: 'V', kind: 'number', default: 6, min: 0.1 },
      { key: 'Pnom', label: 'Anma gücü', unit: 'W', kind: 'number', default: 0.3, min: 1e-3 },
    ],
    physical: { body: 'bulb', onBoard: true },
    description: 'Akkor lamba (sabit dirençli model, R = V²/P). Parlaklık harcanan güçle orantılıdır.',
  },
  ldr: {
    type: 'ldr', label: 'LDR (Işık Sensörü)', short: 'LDR', prefix: 'LDR', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      { key: 'lux', label: 'Işık şiddeti', unit: 'lx', kind: 'slider', default: 100, min: 0.1, max: 10000, log: true },
      { key: 'R10', label: '10 lx’teki direnç', unit: 'Ω', kind: 'number', default: 20e3, advanced: true },
      { key: 'gamma', label: 'γ (eğim)', kind: 'number', default: 0.7, advanced: true },
    ],
    physical: { body: 'ldr', onBoard: true },
    description: 'Işık arttıkça direnci düşen foto-direnç (CdS). R = R10·(E/10 lx)^−γ.',
  },
  ntc: {
    type: 'ntc', label: 'NTC Termistör', short: 'NTC', prefix: 'NTC', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      { key: 'temp', label: 'Sıcaklık', unit: '°C', kind: 'slider', default: 25, min: -20, max: 120, step: 1 },
      { key: 'R25', label: '25 °C direnci', unit: 'Ω', kind: 'number', default: 10e3, advanced: true },
      { key: 'B', label: 'B sabiti', unit: 'K', kind: 'number', default: 3950, advanced: true },
    ],
    physical: { body: 'thermistor', onBoard: true },
    description: 'Sıcaklık arttıkça direnci üstel olarak düşer: R = R25·e^(B(1/T − 1/298 K)).',
  },
  opamp: {
    type: 'opamp', label: 'Op-Amp', short: 'U', prefix: 'U', category: 'Entegre Devreler',
    w: 80, h: 80, rotatable: true, electrical: true,
    pins: [
      { id: 'p', label: '+', x: 0, y: 60 },
      { id: 'n', label: '−', x: 0, y: 20 },
      { id: 'o', label: 'çıkış', x: 80, y: 40 },
    ],
    params: [
      {
        key: 'model', label: 'Model', kind: 'select', default: 'LM741',
        options: [
          { value: 'ideal', label: 'İdeal' },
          { value: 'LM741', label: 'LM741 (1 MHz, 0,5 V/µs)' },
          { value: 'TL081', label: 'TL081 (3 MHz, 13 V/µs)' },
          { value: 'LM358', label: 'LM358 (1 MHz, 0,3 V/µs)' },
        ],
        presets: {
          ideal: { A0: 1e6, GBW: 100e6, SR: 1000, Vos: 0 },
          LM741: { A0: 2e5, GBW: 1e6, SR: 0.5, Vos: 1e-3 },
          TL081: { A0: 2e5, GBW: 3e6, SR: 13, Vos: 3e-3 },
          LM358: { A0: 1e5, GBW: 1e6, SR: 0.3, Vos: 2e-3 },
        },
      },
      { key: 'Vcc', label: 'Pozitif besleme', unit: 'V', kind: 'number', default: 15 },
      { key: 'Vee', label: 'Negatif besleme', unit: 'V', kind: 'number', default: -15 },
      { key: 'A0', label: 'Açık çevrim kazancı', unit: 'V/V', kind: 'number', default: 2e5, advanced: true },
      { key: 'GBW', label: 'Kazanç-bant genişliği', unit: 'Hz', kind: 'number', default: 1e6, advanced: true },
      { key: 'SR', label: 'Slew rate', unit: 'V/µs', kind: 'number', default: 0.5, advanced: true },
      { key: 'Vos', label: 'Giriş ofset gerilimi', unit: 'V', kind: 'number', default: 1e-3, advanced: true },
    ],
    physical: { body: 'dip8', onBoard: true },
    description: 'İşlemsel kuvvetlendirici: Vout = A·(V+ − V−). Negatif geri beslemeyle girişler arası fark ~0 olur (sanal kısa devre). Besleme uçları ±Vcc parametresiyle ideal kabul edilir.',
  },
  timer555: {
    type: 'timer555', label: '555 Zamanlayıcı', short: 'U', prefix: 'U', category: 'Entegre Devreler',
    w: 100, h: 100, rotatable: false, electrical: true,
    pins: [
      { id: 'vcc', label: 'VCC 8', x: 60, y: 0 },
      { id: 'gnd', label: 'GND 1', x: 60, y: 100 },
      { id: 'trig', label: 'TRIG 2', x: 0, y: 40 },
      { id: 'thr', label: 'THR 6', x: 0, y: 60 },
      { id: 'ctrl', label: 'CV 5', x: 0, y: 80 },
      { id: 'reset', label: 'RST 4', x: 0, y: 20 },
      { id: 'dis', label: 'DIS 7', x: 100, y: 60 },
      { id: 'out', label: 'OUT 3', x: 100, y: 40 },
    ],
    params: [],
    physical: { body: 'dip8', onBoard: true },
    description: 'NE555: iki karşılaştırıcı + SR mandal + deşarj transistörü. TRIG < Vcc/3 → çıkış yüksek; THR > 2Vcc/3 → çıkış düşük ve DIS toprağa çeker.',
  },
  reg78: {
    type: 'reg78', label: 'Gerilim Regülatörü 78xx', short: 'U', prefix: 'U', category: 'Entegre Devreler',
    w: 80, h: 60, rotatable: false, electrical: true,
    pins: [
      { id: 'in', label: 'GİRİŞ', x: 0, y: 20 },
      { id: 'gnd', label: 'GND', x: 40, y: 60 },
      { id: 'out', label: 'ÇIKIŞ', x: 80, y: 20 },
    ],
    params: [
      {
        key: 'Vout', label: 'Çıkış gerilimi', unit: 'V', kind: 'number', default: 5,
        hint: '7805 → 5 V, 7809 → 9 V, 7812 → 12 V',
      },
      { key: 'drop', label: 'Düşüm gerilimi', unit: 'V', kind: 'number', default: 2, advanced: true },
    ],
    physical: { body: 'to220', onBoard: true },
    description: 'Doğrusal regülatör: giriş en az ~2 V yüksek oldukça çıkışı sabit tutar; aradaki fark ısı olarak harcanır (P = (Vin − Vout)·I).',
  },
  logicin: {
    type: 'logicin', label: 'Lojik Anahtar (0/1)', short: 'IN', prefix: 'IN', category: 'Dijital',
    w: 60, h: 40, rotatable: false, electrical: true,
    pins: [{ id: 'y', label: '', x: 60, y: 20 }],
    params: [
      { key: 'on', label: 'Değer (1 = 5 V)', kind: 'bool', default: false, hint: 'Canvas’ta çift tıkla' },
      { key: 'V', label: 'Yüksek seviye', unit: 'V', kind: 'number', default: 5, advanced: true },
    ],
    physical: { body: 'instrument', onBoard: false, instrument: 'logic' },
    description: 'Toprağa göre 0 V ya da 5 V veren ideal lojik kaynak. Gerçek devrede bunu bir buton + pull-up/pull-down direnci yapar.',
  },
  logicprobe: {
    type: 'logicprobe', label: 'Lojik Gösterge', short: 'OUT', prefix: 'P', category: 'Dijital',
    w: 60, h: 40, rotatable: false, electrical: true,
    pins: [{ id: 'a', label: '', x: 0, y: 20 }],
    params: [],
    physical: { body: 'instrument', onBoard: false, instrument: 'logic' },
    description: 'Bağlı olduğu düğümü okur: > 3,5 V → 1 (yanar), < 1,5 V → 0, arası → ? (belirsiz/boşta).',
  },
  and: gate('and', 'VE (AND)', 'Y = A·B — iki giriş de 1 ise çıkış 1.'),
  or: gate('or', 'VEYA (OR)', 'Y = A + B — girişlerden biri 1 ise çıkış 1.'),
  nand: gate('nand', 'VE-DEĞİL (NAND)', 'Y = (A·B)′ — evrensel kapı: tüm kapılar NAND ile kurulabilir.'),
  nor: gate('nor', 'VEYA-DEĞİL (NOR)', 'Y = (A + B)′ — o da evrensel bir kapı.'),
  xor: gate('xor', 'ÖZEL VEYA (XOR)', 'Y = A ⊕ B — girişler farklıysa 1. Toplayıcıların temel taşı.'),
  not: {
    type: 'not', label: 'DEĞİL (NOT)', short: 'NOT', prefix: 'G', category: 'Dijital',
    w: 80, h: 40, rotatable: true, electrical: true,
    pins: [
      { id: 'a', label: 'A', x: 0, y: 20 },
      { id: 'y', label: 'Y', x: 80, y: 20 },
    ],
    params: [],
    physical: { body: 'dip14', onBoard: true },
    description: 'Evirici: Y = A′. 5 V CMOS benzeri; eşik 2,5 V.',
  },
  dff: {
    type: 'dff', label: 'D Flip-Flop', short: 'FF', prefix: 'FF', category: 'Dijital',
    w: 80, h: 80, rotatable: false, electrical: true,
    pins: [
      { id: 'd', label: 'D', x: 0, y: 20 },
      { id: 'clk', label: 'CLK', x: 0, y: 60 },
      { id: 'q', label: 'Q', x: 80, y: 20 },
      { id: 'qn', label: 'Q̄', x: 80, y: 60 },
    ],
    params: [],
    physical: { body: 'dip14', onBoard: true },
    description: 'Saatin yükselen kenarında D girişini Q’ya kopyalar ve bir sonraki kenara kadar tutar (1 bitlik bellek).',
  },
  // ───────────── v0.3: yeni bileşenler ─────────────
  buzzer: {
    type: 'buzzer', label: 'Buzzer / Hoparlör', short: 'BZ', prefix: 'BZ', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'R', label: 'Ses direnci', unit: 'Ω', kind: 'number', default: 100, min: 1 }],
    physical: { body: 'none', onBoard: true },
    description: 'Ses çıkaran yük (hoparlör/buzzer). Üzerinden akım geçtikçe ses verir; devrede direnç gibi görünür.',
  },
  ptc: {
    type: 'ptc', label: 'PTC Termistör', short: 'PTC', prefix: 'PTC', category: 'Anahtar ve Sensörler',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [
      { key: 'temp', label: 'Sıcaklık', unit: '°C', kind: 'slider', default: 25, min: -20, max: 150, step: 1 },
      { key: 'R25', label: '25 °C direnci', unit: 'Ω', kind: 'number', default: 100, advanced: true },
      { key: 'alpha', label: 'Sıcaklık katsayısı α', unit: '1/°C', kind: 'number', default: 0.04, advanced: true },
    ],
    physical: { body: 'thermistor', onBoard: true },
    description: 'Sıcaklık arttıkça direnci artan termistör: R = R25·e^(α·(T−25)). Yumuşak başlatma (inrush) ve kendiliğinden sıfırlanan sigorta.',
  },
  varistor: {
    type: 'varistor', label: 'Varistör (MOV)', short: 'MOV', prefix: 'RV', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'Vn', label: 'Kenetleme gerilimi', unit: 'V', kind: 'number', default: 30, min: 1 }],
    physical: { body: 'disc-cap', onBoard: true },
    description: 'Metal oksit varistör: gerilim V_n’yi aşınca iletime geçip fazlalığı kırpar (çift yönlü). Ani aşırı gerilim koruması.',
  },
  fuse: {
    type: 'fuse', label: 'Sigorta', short: 'F', prefix: 'F', category: 'Pasif Elemanlar',
    w: 80, h: 40, pins: two('a', 'b'), rotatable: true, electrical: true,
    params: [{ key: 'Irated', label: 'Anma akımı', unit: 'A', kind: 'number', default: 0.5, min: 1e-3 }],
    physical: { body: 'glass-diode', onBoard: true },
    description: 'Akım anma değerini aşınca atar (açık devre olur) ve öyle kalır. Aşırı akım/kısa devre koruması.',
  },
};

export const PALETTE_ORDER: CompType[] = [
  'vdc', 'battery', 'vac', 'clock', 'idc', 'vcvs', 'vccs', 'cccs', 'ccvs',
  'resistor', 'pot', 'capacitor', 'inductor', 'xfmr', 'xfmr_ct', 'varistor', 'fuse',
  'switch', 'button', 'lamp', 'buzzer', 'ldr', 'ntc', 'ptc',
  'diode', 'zener', 'led', 'npn', 'pnp', 'nmos', 'pmos',
  'opamp', 'timer555', 'reg78',
  'logicin', 'logicprobe', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'dff',
  'multimeter', 'scope', 'ground', 'label',
];

export const LIB_LIST: CompDef[] = PALETTE_ORDER.map((t) => LIBRARY[t]);

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
