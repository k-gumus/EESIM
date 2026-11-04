// Şematik semboller (ANSI/IEEE stili), döndürülmemiş w×h kutusunda çizilir
import type { CompType, ParamValue } from '../circuit/types';
import { LED_COLORS } from '../circuit/library';

interface SymProps {
  type: CompType;
  params: Record<string, ParamValue>;
  live?: { brightness?: number; burnt?: boolean; closed?: boolean };
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
    default:
      return null;
  }
}
