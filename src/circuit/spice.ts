// Canvas devresi → standart SPICE netlist metni (ngspice / LTspice ile uyumlu)
import type { Node } from '@xyflow/react';
import { DIODE_MODELS, LED_COLORS } from './library';
import { spiceNum } from './format';
import type { CompData, CompiledCircuit } from './types';

const num = (v: unknown, d: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isFinite(n) ? n : d;
};

export function buildSpiceNetlist(circ: CompiledCircuit, nodes: Node<CompData>[], title = 'IEEESIM devresi'): string {
  const N = (i: number) => (i === 0 ? '0' : circ.netNames[i]);
  const lines: string[] = [];
  const models = new Map<string, string>();
  const comments: string[] = [];
  lines.push(`* ${title}`);
  lines.push(`* IEEESIM tarafından üretildi — ${new Date().toISOString().slice(0, 10)}`);

  let hasAC = false;
  let maxFreq = 0;

  for (const el of circ.elements) {
    const p = el.params;
    const n = el.nets.map(N);
    switch (el.type) {
      case 'resistor':
        lines.push(`${el.name} ${n[0]} ${n[1]} ${spiceNum(num(p.R, 1000))}`);
        break;
      case 'capacitor':
        lines.push(`${el.name} ${n[0]} ${n[1]} ${spiceNum(num(p.C, 1e-6))}`);
        break;
      case 'inductor':
        lines.push(`${el.name} ${n[0]} ${n[1]} ${spiceNum(num(p.L, 1e-3))}`);
        break;
      case 'switch':
        lines.push(`R${el.name} ${n[0]} ${n[1]} ${p.closed ? '1m' : '1G'} ; anahtar ${p.closed ? 'KAPALI' : 'AÇIK'}`);
        break;
      case 'vdc':
        lines.push(`${el.name} ${n[0]} ${n[1]} DC ${spiceNum(num(p.V, 5))}`);
        break;
      case 'vac': {
        hasAC = true;
        const amp = num(p.amp, 5);
        const f = num(p.freq, 1000);
        const off = num(p.offset, 0);
        const ph = num(p.phase, 0);
        maxFreq = Math.max(maxFreq, f);
        const T = 1 / f;
        let src: string;
        if (p.wave === 'square') {
          src = `PULSE(${spiceNum(off - amp)} ${spiceNum(off + amp)} 0 1n 1n ${spiceNum(T / 2)} ${spiceNum(T)})`;
        } else if (p.wave === 'triangle') {
          src = `PULSE(${spiceNum(off - amp)} ${spiceNum(off + amp)} 0 ${spiceNum(T / 2)} ${spiceNum(T / 2)} 1n ${spiceNum(T)})`;
        } else {
          src = `SIN(${spiceNum(off)} ${spiceNum(amp)} ${spiceNum(f)} 0 0 ${ph})`;
        }
        const rs = num(p.Rs, 0);
        if (rs > 0) {
          lines.push(`${el.name} ${el.name}_int ${n[1]} ${src}`);
          lines.push(`R${el.name}_S ${n[0]} ${el.name}_int ${spiceNum(rs)}`);
        } else {
          lines.push(`${el.name} ${n[0]} ${n[1]} ${src} AC ${spiceNum(amp)}`);
        }
        break;
      }
      case 'idc':
        lines.push(`${el.name} ${n[1]} ${n[0]} DC ${spiceNum(num(p.I, 1e-3))}`);
        break;
      case 'diode': {
        const key = String(p.model ?? 'ideal');
        const mname = key === 'ideal' ? 'DGENEL' : `D${key}`;
        lines.push(`${el.name} ${n[0]} ${n[1]} ${mname}`);
        const m = DIODE_MODELS[key];
        const Is = num(p.Is, m?.Is ?? 1e-14);
        const Nn = num(p.N, m?.N ?? 1);
        models.set(mname, `.model ${mname} D(IS=${spiceNum(Is)} N=${+Nn.toPrecision(4)})`);
        break;
      }
      case 'zener': {
        const mname = `DZ_${String(num(p.Vz, 5.1)).replace('.', 'V')}`;
        lines.push(`D${el.name} ${n[0]} ${n[1]} ${mname}`);
        models.set(mname, `.model ${mname} D(IS=${spiceNum(num(p.Is, 1e-14))} N=${num(p.N, 1)} BV=${num(p.Vz, 5.1)} IBV=1m)`);
        break;
      }
      case 'led': {
        const col = LED_COLORS[String(p.color)] ?? LED_COLORS.red;
        const mname = `LED_${String(p.color).toUpperCase()}`;
        const Is = 0.01 / Math.exp(col.vf / (2 * 0.025852));
        lines.push(`D${el.name} ${n[0]} ${n[1]} ${mname}`);
        models.set(mname, `.model ${mname} D(IS=${Is.toExponential(3)} N=2) ; Vf≈${col.vf} V @ 10 mA`);
        break;
      }
      case 'npn':
      case 'pnp': {
        const kind = el.type.toUpperCase();
        const mname = `Q${kind}_B${num(p.beta, 100)}`;
        // SPICE sırası: C B E
        lines.push(`${el.name} ${n[1]} ${n[0]} ${n[2]} ${mname}`);
        models.set(mname, `.model ${mname} ${kind}(IS=${spiceNum(num(p.Is, 1e-14))} BF=${num(p.beta, 100)} BR=${num(p.betaR, 1)})`);
        break;
      }
      case 'nmos':
      case 'pmos': {
        const kind = el.type.toUpperCase();
        const vth = Math.abs(num(p.Vth, 1));
        const mname = `${kind}_${el.name}`;
        // SPICE sırası: D G S B (gövde kaynağa bağlı)
        lines.push(`${el.name} ${n[1]} ${n[0]} ${n[2]} ${n[2]} ${mname} W=1u L=1u`);
        models.set(mname, `.model ${mname} ${kind}(LEVEL=1 VTO=${el.type === 'pmos' ? -vth : vth} KP=${spiceNum(num(p.K, 2e-3))} LAMBDA=${num(p.lambda, 0)})`);
        break;
      }
      case 'xfmr': {
        const k = 1 / num(p.n, 10);
        lines.push(`* ${el.name}: ideal trafo ${num(p.n, 10)}:1 (E/F kontrollü kaynaklarla)`);
        lines.push(`E${el.name} ${n[2]} ${el.name}_x ${n[0]} ${n[1]} ${+k.toPrecision(6)}`);
        lines.push(`V${el.name}_S ${el.name}_x ${n[3]} 0`);
        lines.push(`F${el.name} ${n[0]} ${n[1]} V${el.name}_S ${+(-k).toPrecision(6)}`);
        break;
      }
      case 'xfmr_ct': {
        const k = 1 / (2 * num(p.n, 10));
        lines.push(`* ${el.name}: orta uçlu ideal trafo ${num(p.n, 10)}:1`);
        lines.push(`E${el.name}A ${n[2]} ${el.name}_xa ${n[0]} ${n[1]} ${+k.toPrecision(6)}`);
        lines.push(`V${el.name}_SA ${el.name}_xa ${n[3]} 0`);
        lines.push(`E${el.name}B ${n[3]} ${el.name}_xb ${n[0]} ${n[1]} ${+k.toPrecision(6)}`);
        lines.push(`V${el.name}_SB ${el.name}_xb ${n[4]} 0`);
        lines.push(`F${el.name}A ${n[0]} ${n[1]} V${el.name}_SA ${+(-k).toPrecision(6)}`);
        lines.push(`F${el.name}B ${n[0]} ${n[1]} V${el.name}_SB ${+(-k).toPrecision(6)}`);
        break;
      }
      case 'multimeter':
        if (String(p.mode).endsWith('A')) lines.push(`V${el.name} ${n[0]} ${n[1]} DC 0 ; ampermetre (${p.mode})`);
        else comments.push(`* ${el.name}: voltmetre (${p.mode}) → V(${n[0]},${n[1]})`);
        break;
      case 'scope':
        comments.push(`* ${el.name}: osiloskop CH1 = V(${n[0]})  CH2 = V(${n[1]})`);
        break;
    }
  }

  if (models.size) {
    lines.push('');
    lines.push(...models.values());
  }
  if (comments.length) {
    lines.push('');
    lines.push(...comments);
  }
  lines.push('');
  const scope = nodes.find((n) => n.data.type === 'scope');
  if (hasAC || scope) {
    const tdiv = scope ? num(scope.data.params.timeDiv, 1e-3) : 2 / Math.max(maxFreq, 1) / 10;
    const tstop = tdiv * 10 * 3;
    lines.push(`.tran ${spiceNum(tdiv / 100)} ${spiceNum(tstop)}`);
  } else {
    lines.push('.op');
  }
  lines.push('.end');
  return lines.join('\n');
}
