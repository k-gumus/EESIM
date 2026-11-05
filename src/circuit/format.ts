// SI önekli sayı biçimlendirme / ayrıştırma (1k, 4.7µ, 10m, 2.2M ...)

const PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

export function formatSI(value: number, unit = '', digits = 3): string {
  if (!isFinite(value)) return value > 0 ? '∞' : value < 0 ? '-∞' : '—';
  if (value === 0 || Math.abs(value) < 1e-12) return `0 ${unit}`.trim();
  const abs = Math.abs(value);
  for (const [scale, prefix] of PREFIXES) {
    if (abs >= scale * 0.9995) {
      const v = value / scale;
      return `${trimNum(v, digits)} ${prefix}${unit}`.trim();
    }
  }
  const v = value / 1e-12;
  return `${trimNum(v, digits)} p${unit}`.trim();
}

function trimNum(v: number, digits: number): string {
  const abs = Math.abs(v);
  const dec = abs >= 100 ? Math.max(0, digits - 3) : abs >= 10 ? Math.max(0, digits - 2) : Math.max(0, digits - 1);
  let s = v.toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/** Canlı akım etiketi: açık anahtarın ~pA'lik sızıntısı gibi 1 nA altı akımlar "0 A" gösterilir (öğrenci "akım akmıyor" görsün) */
export function formatCurrent(value: number): string {
  return Math.abs(value) < 1e-9 ? '0 A' : formatSI(value, 'A');
}

/** Ölçü aletinin çözünürlüğünün altı: gerçek multimetre bunları 0 gösterir */
const METER_FLOOR: Record<string, number> = { A: 1e-9, V: 1e-6 };

/** Sabit ondalıklı ölçüm gösterimi (multimetre LCD'si gibi) */
export function formatMeter(value: number, unit: string): string {
  if (!isFinite(value)) return 'OL';
  if (Math.abs(value) < (METER_FLOOR[unit] ?? 0)) value = 0;
  const abs = Math.abs(value);
  let scale = 1;
  let prefix = '';
  if (abs >= 1e3) { scale = 1e3; prefix = 'k'; }
  else if (abs >= 1 || abs === 0) { scale = 1; prefix = ''; }
  else if (abs >= 1e-3) { scale = 1e-3; prefix = 'm'; }
  else if (abs >= 1e-6) { scale = 1e-6; prefix = 'µ'; }
  else { scale = 1e-9; prefix = 'n'; }
  const v = value / scale;
  const a = Math.abs(v);
  const dec = a >= 100 ? 1 : a >= 10 ? 2 : 3;
  return `${v.toFixed(dec).replace('.', ',')} ${prefix}${unit}`;
}

const PREFIX_MAP: Record<string, number> = {
  T: 1e12, G: 1e9, M: 1e6, meg: 1e6, MEG: 1e6, k: 1e3, K: 1e3,
  m: 1e-3, u: 1e-6, µ: 1e-6, μ: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15,
};

/** "4.7k", "4,7 kΩ", "10u", "2.2M", "1e-3" → sayı. Ayrıştırılamazsa NaN. */
export function parseSI(input: string): number {
  if (typeof input !== 'string') return Number(input);
  let s = input.trim().replace(',', '.').replace(/\s+/g, '');
  s = s.replace(/(Ω|ohm|Ohm|V|A|F|H|Hz|W|s)$/i, (m) => (/^(m|M)$/.test(m) ? m : ''));
  const m = s.match(/^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(meg|MEG|[TGMkKmuµμnpf])?$/);
  if (!m) return NaN;
  const base = parseFloat(m[1]);
  const mult = m[2] ? PREFIX_MAP[m[2]] : 1;
  return base * mult;
}

/** SPICE netlistine uygun (ASCII) sayı yazımı */
export function spiceNum(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const table: [number, string][] = [
    [1e12, 'T'], [1e9, 'G'], [1e6, 'MEG'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p'],
  ];
  for (const [scale, p] of table) {
    if (abs >= scale * 0.9995) {
      const v = +(value / scale).toPrecision(4);
      return `${v}${p}`;
    }
  }
  return value.toExponential(3);
}

export const RESISTOR_E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
