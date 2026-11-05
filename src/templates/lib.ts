// Şablon yazım kütüphanesi: ortak tipler + hızlı devre kurucu (Builder)
import type { CircuitDoc, CompType, ParamValue } from '../circuit/types';
import type { Mood } from '../tepecan/mascot';
import type { TopicId } from './topics';

export type StepCheck =
  | { kind: 'run' }
  | { kind: 'manual'; label?: string }
  | { kind: 'switch'; comp: string; closed: boolean }
  | { kind: 'param'; comp: string; param: string; op: '>=' | '<=' | '==' | '!='; value: number | string | boolean }
  | { kind: 'pin'; comp: string; pin: string; net: string }
  | { kind: 'measure'; net: string; stat: 'max' | 'min' | 'avg' | 'rms' | 'pp'; op: '>=' | '<='; value: number }
  | { kind: 'quiz'; question: string; options: string[]; answer: number; explain: string };

export interface LabStep {
  id: string;
  title: string;
  text: string;
  check: StepCheck;
  xp?: number;
  hint?: string;
  success?: string;
}

export interface Template {
  id: string;
  title: string;
  subtitle: string;
  level: 'Isınma' | 'Temel' | 'Orta' | 'İleri';
  topic: TopicId;
  keywords?: string[];
  mood: Mood;
  xp: number;
  doc: CircuitDoc;
  steps: LabStep[];
  theory: string;
}

export type C = [type: CompType, name: string, x: number, y: number, rot?: number, params?: Record<string, ParamValue>];

export const doc = (title: string, comps: C[], wires: [string, string][]): CircuitDoc => ({
  version: 1,
  title,
  components: comps.map(([type, name, x, y, rot, params]) => ({ id: `${name}`, type, name, x, y, rot: rot ?? 0, params })),
  wires: wires.map(([from, to], i) => ({ id: `w${i}`, from, to })),
});

export const D4001 = { model: '1N4001', Is: 14.11e-9, N: 1.984 };
export const D4148 = { model: '1N4148', Is: 2.52e-9, N: 1.752 };
export const D5819 = { model: '1N5819', Is: 31.7e-6, N: 1.373 };

/**
 * Hızlı devre kurucu. Konum kuralları (20 px ızgara):
 *  - dikey kaynak (x,y): + ucu (x+20, y), − ucu (x+20, y+80)
 *  - yatay 2 uçlu (x,y): uçlar (x, y+20) ve (x+80, y+20); rot 90 → (x+20, y) üst, (x+20, y+80) alt
 *  - toprak (x,y): ucu (x+20, y);  etiket (x,y): ucu (x, y+20)
 */
export class B {
  comps: C[] = [];
  wires: [string, string][] = [];
  private g = 0;
  private l = 0;
  add(type: CompType, name: string, x: number, y: number, rot = 0, params?: Record<string, ParamValue>) {
    this.comps.push([type, name, x, y, rot, params]);
    return this;
  }
  w(...pairs: [string, string][]) {
    this.wires.push(...pairs);
    return this;
  }
  /** pin'in (px, py) altına toprak koy ve bağla */
  gnd(pin: string, px: number, py: number) {
    const n = `GND${++this.g}`;
    this.add('ground', n, px - 20, py + 20);
    this.w([pin, `${n}.g`]);
    return this;
  }
  /** etiket: ucu (x, y+20) */
  label(text: string, x: number, y: number, pin?: string) {
    const n = `${text}_${++this.l}`;
    this.add('label', n, x, y, 0, { text });
    if (pin) this.w([pin, `${n}.p`]);
    return this;
  }
  /** osiloskop + kanal etiketleri */
  scope(x: number, y: number, ch1: string | null, ch2: string | null, params: Record<string, ParamValue>, name = 'OSC1') {
    this.add('scope', name, x, y, 0, params);
    if (ch1) this.label(ch1, x - 40, y + 140, `${name}.ch1`);
    if (ch2) this.label(ch2, x + 60, y + 180, `${name}.ch2`);
    return this;
  }
  doc(title: string) {
    return doc(title, this.comps, this.wires);
  }
}

export const quiz = (question: string, options: string[], explain: string, answer = 0): StepCheck => ({ kind: 'quiz', question, options, answer, explain });
export const run = (text = '**▶ Başlat**’a bas.'): LabStep => ({ id: 'run', title: 'Başlat', text, check: { kind: 'run' } });
