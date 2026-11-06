// Şematik semboller (ANSI/IEEE stili), döndürülmemiş w×h kutusunda çizilir
import type { CompType, ParamValue } from '../circuit/types';
import { LED_COLORS } from '../circuit/library';

interface SymProps {
  type: CompType;
  params: Record<string, ParamValue>;
  live?: { brightness?: number; burnt?: boolean; closed?: boolean; level?: number };
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function Symbol({ type, params, live }: SymProps) {
  switch (type) {
    case 'resistor':
      return (
        <g {...S}>
          <path d="M0 20 H14 L18 11 L26 29 L34 11 L42 29 L50 11 L58 29 L62 20 H80" />
        </g>
      );
    case 'varistor':
      return (
        <g {...S}>
          <path d="M0 20 H14 L18 11 L26 29 L34 11 L42 29 L50 11 L58 29 L62 20 H80" />
          <path d="M16 33 L64 7" strokeWidth={1.6} />
        </g>
      );
    case 'ptc':
      return (
        <g {...S}>
          <path d="M0 20 H16 M64 20 H80" />
          <rect x={16} y={10} width={48} height={20} rx={2} fill="none" />
          <path d="M22 30 L58 10" strokeWidth={1.6} />
          <path d="M24 15 h6 M27 12 v6" strokeWidth={1.4} />
        </g>
      );
    case 'fuse':
      return (
        <g {...S}>
          <path d="M0 20 H22 M58 20 H80" />
          <rect x={22} y={12} width={36} height={16} rx={3} fill="none" />
          <path d="M26 20 H54" strokeWidth={1.6} />
        </g>
      );
    case 'buzzer':
      return (
        <g {...S}>
          <path d="M0 20 H25 M55 20 H80" />
          <circle cx={40} cy={20} r={14} fill="currentColor" fillOpacity={0.12} />
          <path d="M40 7 V33" strokeWidth={1.4} />
          <path d="M60 11 a12 12 0 0 1 0 18" strokeWidth={1.4} />
          <path d="M64 7 a17 17 0 0 1 0 26" strokeWidth={1.1} opacity={0.7} />
        </g>
      );
    case 'capacitor':
      return (
        <g {...S}>
          <path d="M0 20 H35 M45 20 H80" />
          <path d="M35 6 V34 M45 6 V34" strokeWidth={3} />
        </g>
      );
    case 'inductor':
      return (
        <g {...S}>
          <path d="M0 20 H16 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 a6 6 0 0 1 12 0 H80" />
        </g>
      );
    case 'switch': {
      const closed = !!params.closed;
      return (
        <g {...S}>
          <path d="M0 20 H22 M58 20 H80" />
          <circle cx={22} cy={20} r={3} fill="currentColor" />
          <circle cx={58} cy={20} r={3} />
          <path d={closed ? 'M22 20 L58 19' : 'M22 20 L54 4'} strokeWidth={2.5} className="sw-lever" />
        </g>
      );
    }
    case 'diode':
    case 'zener':
    case 'led': {
      const col = type === 'led' ? (LED_COLORS[String(params.color)] ?? LED_COLORS.red).rgb : undefined;
      const b = live?.brightness ?? 0;
      return (
        <g {...S}>
          <path d="M0 20 H28 M52 20 H80" />
          {type === 'led' && b > 0.02 && !live?.burnt && (
            <circle cx={40} cy={20} r={10 + 14 * Math.min(1, b)} fill={col} stroke="none" opacity={0.18 + 0.4 * Math.min(1, b)} className="led-glow" />
          )}
          <path d="M28 8 L28 32 L52 20 Z" fill={type === 'led' ? (b > 0.02 && !live?.burnt ? col : 'transparent') : 'currentColor'} fillOpacity={type === 'led' ? 0.85 : 0.18} />
          {type === 'zener' ? <path d="M47 4 L52 8 V32 L57 36" /> : <path d="M52 8 V32" />}
          {type === 'led' && (
            <g strokeWidth={1.5}>
              <path d="M44 6 L52 -2 M48 -2 H52 V2" />
              <path d="M52 8 L60 0 M56 0 H60 V4" />
            </g>
          )}
          {type === 'led' && live?.burnt && <path d="M34 14 L46 26 M46 14 L34 26" stroke="#ff5a5a" strokeWidth={2.5} />}
        </g>
      );
    }
    case 'npn':
    case 'pnp': {
      const pnp = type === 'pnp';
      return (
        <g {...S}>
          <circle cx={30} cy={40} r={22} strokeWidth={1.5} opacity={0.55} />
          <path d="M0 40 H20" />
          <path d="M20 26 V54" strokeWidth={3} />
          {pnp ? (
            <>
              <path d="M20 34 L40 18 V0" />
              <path d="M20 46 L40 62 V80" />
              <path d="M27 29 L23 32 L29 34" fill="currentColor" />
            </>
          ) : (
            <>
              <path d="M20 34 L40 18 V0" />
              <path d="M20 46 L40 62 V80" />
              <path d="M33 55 L39 61 L31 62" fill="currentColor" />
            </>
          )}
        </g>
      );
    }
    case 'tl431':
      return (
        <g {...S}>
          <path d="M40 0 V18 M40 62 V80 M0 40 H26" />
          <rect x={26} y={18} width={26} height={44} rx={4} fill="none" />
          <path d="M33 44 H47 L40 54 Z" fill="currentColor" fillOpacity={0.2} />
          <path d="M33 40 H47" strokeWidth={2.4} />
        </g>
      );
    case 'relay':
      return (
        <g {...S}>
          <path d="M0 20 H18 M0 60 H18" />
          <rect x={18} y={14} width={20} height={52} rx={3} fill="none" />
          <path d="M24 20 V60 M30 20 V60" strokeWidth={1.2} />
          <path d="M38 40 H64" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
          <circle cx={66} cy={40} r={2.6} fill="currentColor" />
          <path d="M100 40 H66 M66 40 L90 66" />
          <circle cx={90} cy={12} r={2.6} />
          <circle cx={90} cy={66} r={2.6} fill="currentColor" />
          <path d="M100 10 H90 M100 70 H90" />
        </g>
      );
    case 'motor':
      return (
        <g {...S}>
          <path d="M0 20 H18 M62 20 H80" />
          <circle cx={40} cy={20} r={18} />
          <text x={40} y={20} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={700} fill="currentColor" stroke="none">M</text>
        </g>
      );
    case 'opto':
      return (
        <g {...S}>
          <path d="M0 20 H16 V30 M0 60 H16 V44" />
          <path d="M10 30 H22 L16 44 Z" fill="currentColor" fillOpacity={0.2} />
          <path d="M10 44 H22" strokeWidth={2} />
          <path d="M24 28 l7 -4 M27 24 h4 v4" strokeWidth={1} />
          <path d="M24 38 l7 -4 M27 34 h4 v4" strokeWidth={1} />
          <path d="M40 8 V72" strokeDasharray="3 4" strokeWidth={1} opacity={0.55} />
          <circle cx={60} cy={40} r={16} strokeWidth={1.2} opacity={0.5} />
          <path d="M80 20 V28 L58 34" />
          <path d="M80 60 V52 L58 46" />
          <path d="M58 28 V52" strokeWidth={3} />
          <path d="M60 46 l-5 3 l7 2" fill="currentColor" stroke="none" />
        </g>
      );
    case 'jfet':
      return (
        <g {...S}>
          <path d="M0 40 H14" />
          <path d="M14 34 L24 40 L14 46 Z" fill="currentColor" stroke="none" />
          <path d="M24 16 V64" strokeWidth={3} />
          <path d="M24 22 H40 V0" />
          <path d="M24 58 H40 V80" />
        </g>
      );
    case 'nmos':
    case 'pmos': {
      const p = type === 'pmos';
      return (
        <g {...S}>
          <path d="M0 40 H12" />
          <path d="M12 24 V56" />
          <path d="M20 22 V30 M20 36 V44 M20 50 V58" strokeWidth={3} />
          <path d="M20 26 H40 V0" />
          <path d="M20 54 H40 V80" />
          <path d="M20 40 H40 V54" />
          {p ? <path d="M36 37 L40 40 L36 43" /> : <path d="M25 37 L21 40 L25 43" />}
          {p && <circle cx={8} cy={40} r={3} />}
        </g>
      );
    }
    case 'vdc':
      return (
        <g {...S}>
          <path d="M20 0 V24 M20 56 V80" />
          <circle cx={20} cy={40} r={16} />
          <path d="M20 28 V36 M16 32 H24" strokeWidth={1.8} />
          <path d="M16 48 H24" strokeWidth={1.8} />
        </g>
      );
    case 'vac':
      return (
        <g {...S}>
          <path d="M20 0 V24 M20 56 V80" />
          <circle cx={20} cy={40} r={16} />
          {params.wave === 'square' ? (
            <path d="M9 44 V36 H20 V44 H31 V36" strokeWidth={1.8} />
          ) : params.wave === 'triangle' ? (
            <path d="M9 44 L14.5 36 L25.5 44 L31 36" strokeWidth={1.8} />
          ) : (
            <path d="M9 40 C12 32 17 32 20 40 C23 48 28 48 31 40" strokeWidth={1.8} />
          )}
          <text x={27} y={22} fontSize={10} fill="currentColor" stroke="none">+</text>
        </g>
      );
    case 'idc':
      return (
        <g {...S}>
          <path d="M20 0 V24 M20 56 V80" />
          <circle cx={20} cy={40} r={16} />
          <path d="M20 50 V31 M15 36 L20 30 L25 36" strokeWidth={1.8} />
        </g>
      );
    case 'ground':
      return (
        <g {...S}>
          <path d="M20 0 V16 M6 16 H34 M11 23 H29 M16 30 H24" />
        </g>
      );
    case 'label':
      return (
        <g>
          <path d="M0 20 H10" {...S} />
          <path d="M10 20 L20 8 H78 V32 H20 Z" fill="var(--label-bg)" stroke="var(--accent)" strokeWidth={1.5} />
          <text x={48} y={24.5} fontSize={12} fontWeight={700} textAnchor="middle" fill="var(--accent)" fontFamily="var(--mono)">
            {String(params.text ?? '').slice(0, 7)}
          </text>
        </g>
      );
    case 'xfmr':
    case 'xfmr_ct': {
      const coil = (x: number, dir: 1 | -1) => {
        let d = `M${x} 8`;
        for (let i = 0; i < 4; i++) d += ` a8 8 0 0 ${dir === 1 ? 1 : 0} 0 16`;
        return d;
      };
      return (
        <g {...S}>
          <path d="M0 0 H24 V8 M0 80 H24 V72" />
          <path d={coil(24, 1)} />
          <path d="M80 0 H56 V8 M80 80 H56 V72" />
          <path d={coil(56, -1)} />
          <path d="M38 6 V74 M42 6 V74" strokeWidth={1.5} />
          {type === 'xfmr_ct' && <path d="M80 40 H56" />}
          <circle cx={30} cy={6} r={2} fill="currentColor" />
          <circle cx={50} cy={6} r={2} fill="currentColor" />
        </g>
      );
    }
    case 'battery':
      return (
        <g {...S}>
          <path d="M20 0 V30 M20 50 V80" />
          <path d="M6 30 H34 M6 44 H34" strokeWidth={2.5} />
          <path d="M13 37 H27 M13 50 H27" strokeWidth={4} />
          <text x={30} y={24} fontSize={11} fill="currentColor" stroke="none">+</text>
        </g>
      );
    case 'clock':
      return (
        <g {...S}>
          <path d="M20 0 V24 M20 56 V80" />
          <circle cx={20} cy={40} r={16} />
          <path d="M9 46 V34 H16 V46 H24 V34 H31" strokeWidth={1.8} />
        </g>
      );
    case 'vcvs':
    case 'vccs':
    case 'cccs':
    case 'ccvs': {
      const vOut = type === 'vcvs' || type === 'ccvs';
      const iCtrl = type === 'cccs' || type === 'ccvs';
      return (
        <g {...S}>
          <path d="M60 0 V24 M60 56 V80" />
          <path d="M60 24 L76 40 L60 56 L44 40 Z" />
          {vOut ? (
            <>
              <path d="M60 30 V36 M57 33 H63" strokeWidth={1.6} />
              <path d="M57 47 H63" strokeWidth={1.6} />
            </>
          ) : (
            <path d="M60 50 V31 M56 35 L60 30 L64 35" strokeWidth={1.6} />
          )}
          {iCtrl ? (
            <>
              <path d="M0 20 H20 V60 H0" />
              <path d="M16 36 L20 42 L24 36" strokeWidth={1.6} />
            </>
          ) : (
            <>
              <path d="M0 20 H14 M0 60 H14" />
              <circle cx={16} cy={20} r={2} />
              <circle cx={16} cy={60} r={2} />
              <path d="M16 26 V54" strokeDasharray="3 3" strokeWidth={1.2} />
            </>
          )}
        </g>
      );
    }
    case 'pot':
      return (
        <g {...S}>
          <path d="M0 20 H14 L18 11 L26 29 L34 11 L42 29 L50 11 L58 29 L62 20 H80" />
          <path d="M40 0 V9" />
          <path d="M35 4 L40 10 L45 4" fill="currentColor" />
        </g>
      );
    case 'button': {
      const pressed = !!params.pressed;
      return (
        <g {...S}>
          <path d="M0 20 H22 M58 20 H80" />
          <circle cx={22} cy={20} r={3} fill="currentColor" />
          <circle cx={58} cy={20} r={3} fill="currentColor" />
          <path d={pressed ? 'M18 17 H62 M40 17 V2' : 'M18 8 H62 M40 8 V-4'} strokeWidth={2.5} />
          {params.kind === 'NC' && <text x={68} y={8} fontSize={9} fill="currentColor" stroke="none">NC</text>}
        </g>
      );
    }
    case 'lamp': {
      const b = Math.min(1, live?.brightness ?? 0);
      return (
        <g {...S}>
          <path d="M0 20 H28 M52 20 H80" />
          {b > 0.02 && <circle cx={40} cy={20} r={14 + 12 * b} fill="#ffd36b" stroke="none" opacity={0.2 + 0.45 * b} className="led-glow" />}
          <circle cx={40} cy={20} r={12} fill={b > 0.02 ? `rgba(255,214,107,${0.3 + 0.6 * b})` : 'transparent'} />
          <path d="M31.5 11.5 L48.5 28.5 M48.5 11.5 L31.5 28.5" strokeWidth={1.6} />
        </g>
      );
    }
    case 'ldr':
      return (
        <g {...S}>
          <path d="M0 20 H16 M64 20 H80" />
          <rect x={16} y={12} width={48} height={16} rx={2} />
          <circle cx={40} cy={20} r={19} strokeWidth={1.2} opacity={0.6} />
          <g strokeWidth={1.4}>
            <path d="M14 -6 L26 6 M22 6 H26 V2" />
            <path d="M24 -10 L36 2 M32 2 H36 V-2" />
          </g>
        </g>
      );
    case 'ntc':
      return (
        <g {...S}>
          <path d="M0 20 H16 M64 20 H80" />
          <rect x={16} y={12} width={48} height={16} rx={2} />
          <path d="M14 36 L22 36 L60 2" strokeWidth={1.4} />
          <text x={58} y={40} fontSize={9} fill="currentColor" stroke="none">−t°</text>
        </g>
      );
    case 'opamp':
      return (
        <g {...S}>
          <path d="M0 20 H12 M0 60 H12 M72 40 H80" />
          <path d="M12 4 L12 76 L72 40 Z" fill="var(--sym-fill)" />
          <path d="M17 20 H25" strokeWidth={1.8} />
          <path d="M17 60 H25 M21 56 V64" strokeWidth={1.8} />
        </g>
      );
    case 'timer555':
      return (
        <g {...S}>
          <path d="M0 20 H12 M0 40 H12 M0 60 H12 M0 80 H12 M88 40 H100 M88 60 H100 M60 0 V8 M60 92 V100" />
          <rect x={12} y={8} width={76} height={84} rx={4} fill="var(--sym-fill)" />
          <g fill="currentColor" stroke="none" fontSize={8.5} fontFamily="var(--mono)">
            <text x={15} y={23}>RST</text>
            <text x={15} y={43}>TRIG</text>
            <text x={15} y={63}>THR</text>
            <text x={15} y={83}>CV</text>
            <text x={85} y={43} textAnchor="end">OUT</text>
            <text x={85} y={63} textAnchor="end">DIS</text>
            <text x={60} y={18} textAnchor="middle">VCC</text>
            <text x={60} y={88} textAnchor="middle">GND</text>
            <text x={58} y={54} textAnchor="middle" fontSize={14} fontWeight={800}>555</text>
          </g>
        </g>
      );
    case 'reg78':
      return (
        <g {...S}>
          <path d="M0 20 H16 M64 20 H80 M40 44 V60" />
          <rect x={16} y={6} width={48} height={38} rx={3} fill="var(--sym-fill)" />
          <text x={40} y={24} textAnchor="middle" fontSize={11} fontWeight={800} fill="currentColor" stroke="none" fontFamily="var(--mono)">
            78{String(Number(params.Vout ?? 5)).padStart(2, '0')}
          </text>
          <text x={40} y={38} textAnchor="middle" fontSize={8} fill="currentColor" stroke="none">GND</text>
        </g>
      );
    case 'and':
    case 'nand':
      return (
        <g {...S}>
          <path d="M0 20 H20 M0 60 H20" />
          <path d="M20 12 H42 A28 28 0 0 1 42 68 H20 Z" fill="var(--sym-fill)" />
          {type === 'nand' ? <><circle cx={74} cy={40} r={4} /><path d="M78 40 H80" /></> : <path d="M70 40 H80" />}
        </g>
      );
    case 'or':
    case 'nor':
    case 'xor':
      return (
        <g {...S}>
          <path d="M0 20 H24 M0 60 H24" />
          <path d="M18 12 Q32 40 18 68 Q50 68 70 40 Q50 12 18 12 Z" fill="var(--sym-fill)" />
          {type === 'xor' && <path d="M11 12 Q25 40 11 68" />}
          {type === 'nor' ? <><circle cx={74} cy={40} r={4} /><path d="M78 40 H80" /></> : <path d="M70 40 H80" />}
        </g>
      );
    case 'not':
      return (
        <g {...S}>
          <path d="M0 20 H16 M70 20 H80" />
          <path d="M16 5 L16 35 L60 20 Z" fill="var(--sym-fill)" />
          <circle cx={65} cy={20} r={5} />
        </g>
      );
    case 'dff':
      return (
        <g {...S}>
          <path d="M0 20 H14 M0 60 H14 M66 20 H80 M66 60 H80" />
          <rect x={14} y={6} width={52} height={68} rx={3} fill="var(--sym-fill)" />
          <path d="M14 53 L22 60 L14 67" strokeWidth={1.6} />
          <g fill="currentColor" stroke="none" fontSize={10} fontFamily="var(--mono)" fontWeight={700}>
            <text x={18} y={24}>D</text>
            <text x={62} y={24} textAnchor="end">Q</text>
            <text x={62} y={64} textAnchor="end">Q̄</text>
          </g>
        </g>
      );
    case 'logicin': {
      const on = !!params.on;
      return (
        <g {...S}>
          <path d="M44 20 H60" />
          <rect x={2} y={6} width={42} height={28} rx={14} fill={on ? 'rgba(43,212,107,0.25)' : 'var(--sym-fill)'} stroke={on ? '#2bd46b' : 'currentColor'} />
          <circle cx={on ? 30 : 16} cy={20} r={9} fill={on ? '#2bd46b' : 'currentColor'} stroke="none" />
          <text x={on ? 15 : 31} y={24} fontSize={11} fontWeight={900} textAnchor="middle" fill={on ? '#2bd46b' : 'currentColor'} stroke="none" fontFamily="var(--mono)">
            {on ? '1' : '0'}
          </text>
        </g>
      );
    }
    case 'logicprobe': {
      const lv = live?.level;
      const col = lv === 1 ? '#ff4d4d' : lv === 0.5 ? '#f5b301' : 'var(--sym-fill)';
      return (
        <g {...S}>
          <path d="M0 20 H18" />
          {lv === 1 && <circle cx={34} cy={20} r={18} fill="#ff4d4d" stroke="none" opacity={0.35} className="led-glow" />}
          <circle cx={34} cy={20} r={13} fill={col} />
          <text x={34} y={24.5} fontSize={12} fontWeight={900} textAnchor="middle" fill={lv === 1 ? '#fff' : 'currentColor'} stroke="none" fontFamily="var(--mono)">
            {lv === undefined ? '' : lv === 1 ? '1' : lv === 0 ? '0' : '?'}
          </text>
        </g>
      );
    }
    default:
      return null;
  }
}
