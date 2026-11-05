import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps, type Node } from '@xyflow/react';
import { LIBRARY, LED_COLORS, DIODE_MODELS, pinSide, rotatePin, rotatedSize } from '../../circuit/library';
import { formatCurrent, formatMeter, formatSI } from '../../circuit/format';
import type { CompData } from '../../circuit/types';
import { useSim } from '../../sim/runner';
import { useCircuit } from '../../store/circuitStore';
import { Symbol } from '../symbols';

const SIDE: Record<string, Position> = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };

function valueText(d: CompData): string {
  const p = d.params;
  const n = (k: string) => Number(p[k]);
  switch (d.type) {
    case 'resistor': return formatSI(n('R'), 'Ω');
    case 'capacitor': return formatSI(n('C'), 'F');
    case 'inductor': return formatSI(n('L'), 'H');
    case 'switch': return p.closed ? 'KAPALI' : 'AÇIK';
    case 'diode': return DIODE_MODELS[String(p.model)] ? String(p.model) === 'ideal' ? 'genel' : String(p.model) : 'özel';
    case 'zener': return `${String(n('Vz')).replace('.', ',')} V`;
    case 'led': return (LED_COLORS[String(p.color)]?.label ?? '').split(' ')[0];
    case 'npn': case 'pnp': return `β=${n('beta')}`;
    case 'nmos': case 'pmos': return `Vth=${String(n('Vth')).replace('.', ',')} V`;
    case 'vdc': return formatSI(n('V'), 'V');
    case 'vac': return `${formatSI(n('amp'), 'V')}p · ${formatSI(n('freq'), 'Hz')}`;
    case 'idc': return formatSI(n('I'), 'A');
    case 'xfmr': case 'xfmr_ct': return `${n('n')}:1`;
    case 'battery': return formatSI(n('V'), 'V');
    case 'clock': return `${formatSI(n('freq'), 'Hz')} · %${Math.round(n('duty') * 100)}`;
    case 'vcvs': return `×${n('gain')}`;
    case 'vccs': return `gm=${formatSI(n('gain'), 'S')}`;
    case 'cccs': return `β=${n('gain')}`;
    case 'ccvs': return `r=${formatSI(n('gain'), 'Ω')}`;
    case 'pot': return `${formatSI(n('R'), 'Ω')} · %${Math.round(n('pos') * 100)}`;
    case 'button': return p.pressed ? 'BASILI' : p.kind === 'NC' ? 'NC' : 'NO';
    case 'lamp': return `${formatSI(n('Vnom'), 'V')} ${formatSI(n('Pnom'), 'W')}`;
    case 'ldr': return `${formatSI(n('lux'), 'lx')}`;
    case 'ntc': return `${n('temp')} °C`;
    case 'opamp': return String(p.model ?? '');
    case 'reg78': return `78${String(n('Vout')).padStart(2, '0')}`;
    default: return '';
  }
}

const logicLevel = (v: number | undefined) => (v === undefined ? undefined : v > 3.5 ? 1 : v < 1.5 ? 0 : 0.5);
const NO_PIN_LABELS = new Set(['opamp', 'timer555', 'dff', 'reg78', 'and', 'or', 'nand', 'nor', 'xor', 'not', 'logicin', 'logicprobe', 'battery', 'clock', 'button', 'lamp', 'ldr', 'ntc']);

const REGION_BJT = ['kesim', 'aktif', 'doyum', 'ters aktif'];
const REGION_MOS = ['kesim', 'doyum', 'triyot'];

function ComponentNodeImpl({ id, data, selected }: NodeProps<Node<CompData>>) {
  const def = LIBRARY[data.type];
  const rot = data.rot ?? 0;
  const { w, h } = rotatedSize(def, rot);
  const update = useUpdateNodeInternals();
  useEffect(() => {
    update(id);
  }, [rot, id, update]);

  const status = useSim((s) => s.status);
  const showValues = useSim((s) => s.showValues);
  const live = useSim((s) => s.comp[id]);
  const meter = useSim((s) => (data.type === 'multimeter' ? s.meters[id] : undefined));
  const pinNet = useSim((s) => s.compiled?.pinNet);
  const netV = useSim((s) => s.netV);
  const netNames = useSim((s) => s.compiled?.netNames);
  const active = status === 'running' || status === 'paused';

  const toggle = useCircuit((s) => s.toggleSwitch);

  const transform =
    rot === 90 ? `translate(${def.h} 0) rotate(90)` : rot === 180 ? `translate(${def.w} ${def.h}) rotate(180)` : rot === 270 ? `translate(0 ${def.w}) rotate(270)` : undefined;

  const horizontal = w >= h;
  let readout = '';
  if (active && live && showValues) {
    const I = live.I;
    switch (data.type) {
      case 'resistor':
      case 'capacitor':
      case 'inductor':
      case 'switch':
      case 'diode':
      case 'zener':
        readout = formatCurrent(Math.abs(I[0] ?? 0));
        break;
      case 'led':
        readout = (live.probe.burnt ? '💥 YANDI · ' : '') + formatCurrent(Math.abs(I[0] ?? 0));
        break;
      case 'vdc':
      case 'vac':
      case 'idc':
        readout = formatCurrent(-(I[0] ?? 0));
        break;
      case 'npn':
      case 'pnp':
        readout = `Ic ${formatCurrent(Math.abs(I[1] ?? 0))} · ${REGION_BJT[live.probe.region ?? 0]}`;
        break;
      case 'nmos':
      case 'pmos':
        readout = `Id ${formatCurrent(Math.abs(I[1] ?? 0))} · ${REGION_MOS[live.probe.region ?? 0]}`;
        break;
      case 'lamp':
      case 'ldr':
      case 'ntc':
      case 'button':
        readout = formatCurrent(Math.abs(I[0] ?? 0));
        break;
      case 'battery':
      case 'clock':
        readout = formatCurrent(-(I[0] ?? 0));
        break;
      case 'opamp':
        readout = `Vo ${formatSI(live.probe.vo ?? 0, 'V')}${live.probe.sat ? ' · DOYUM' : ''}`;
        break;
      case 'timer555':
      case 'dff':
        readout = `Q = ${live.probe.q ? 1 : 0}`;
        break;
    }
  }

  const isMeter = data.type === 'multimeter';
  const isScope = data.type === 'scope';
  const isLabel = data.type === 'label';
  const isGround = data.type === 'ground';

  const pinTitle = (pin: string, label: string) => {
    const net = pinNet?.[`${id}:${pin}`];
    if (net === undefined) return `${data.name}.${label}`;
    const name = net === 0 ? 'GND' : netNames?.[net] ?? '';
    const v = active && netV.length ? ` = ${formatSI(netV[net] ?? 0, 'V')}` : '';
    return `${data.name}.${label} → ${name}${v}`;
  };

  return (
    <div
      className={`cnode t-${data.type} ${selected ? 'selected' : ''}`}
      style={{ width: w, height: h }}
      onDoubleClick={(e) => {
        if (data.type === 'switch') {
          e.stopPropagation();
          toggle(id);
        } else if (data.type === 'logicin') {
          e.stopPropagation();
          useCircuit.getState().updateParams(id, { on: !data.params.on });
        }
      }}
      onPointerDown={(e) => {
        if (data.type === 'button' && e.button === 0 && (e.target as HTMLElement).closest('.sym')) {
          useCircuit.getState().updateParams(id, { pressed: true }, false);
          const up = () => {
            useCircuit.getState().updateParams(id, { pressed: false }, false);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointerup', up);
        }
      }}
      title={
        data.type === 'switch' || data.type === 'logicin'
          ? 'Çift tıkla: değiştir'
          : data.type === 'button'
            ? 'Basılı tut: buton kapanır'
            : undefined
      }
    >
      {isMeter ? (
        <MeterBody mode={String(data.params.mode)} reading={meter ? formatMeter(meter.value, meter.unit) : '— — —'} active={active} name={data.name} />
      ) : isScope ? (
        <ScopeBody name={data.name} />
      ) : (
        <svg width={w} height={h} overflow="visible" className="sym">
          <g transform={transform}>
            <Symbol
              type={data.type}
              params={data.params}
              live={{
                brightness: active ? live?.probe.brightness : 0,
                burnt: active && !!live?.probe.burnt,
                level: data.type === 'logicprobe' && active ? logicLevel(netV[pinNet?.[`${id}:a`] ?? -1]) : undefined,
              }}
            />
          </g>
        </svg>
      )}

      {!isMeter && !isScope && !isLabel && !isGround && (
        <>
          <div className={`clabel ${horizontal ? 'h' : 'v'}`} style={horizontal ? { width: Math.max(w, 120), left: w / 2 } : { left: w + 6 }}>
            <span className="cname">{data.name}</span>
            <span className="cval">{valueText(data)}</span>
            {!horizontal && readout && <span className="clive">{readout}</span>}
          </div>
          {horizontal && readout && (
            <div className="clive h" style={{ top: h + 2, left: w / 2 }}>
              {readout}
            </div>
          )}
        </>
      )}

      {def.pins.map((p) => {
        const rp = rotatePin(def, p, rot);
        const side = pinSide(def, p, rot);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={SIDE[side]}
            className={`pin pin-${p.id}`}
            style={{ left: rp.x, top: rp.y, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }}
            title={pinTitle(p.id, p.label)}
          >
            {def.pins.length > 1 && !NO_PIN_LABELS.has(data.type) && !['resistor', 'capacitor', 'inductor', 'switch'].includes(data.type) && (
              <span className={`pinlbl ${side}`}>{p.label}</span>
            )}
          </Handle>
        );
      })}
    </div>
  );
}

function MeterBody({ mode, reading, active, name }: { mode: string; reading: string; active: boolean; name: string }) {
  const MODE: Record<string, string> = { DCV: 'V ⎓', ACV: 'V ∿', DCA: 'A ⎓', ACA: 'A ∿' };
  return (
    <div className="meter">
      <div className="meter-name">{name}</div>
      <div className={`lcd ${active ? 'on' : ''}`}>{active ? reading : '- - - -'}</div>
      <div className="meter-mode">{MODE[mode] ?? mode}</div>
      <div className="jacks">
        <span className="jack red" />
        <span className="jack black" />
      </div>
    </div>
  );
}

function ScopeBody({ name }: { name: string }) {
  return (
    <div className="scope-mini">
      <div className="scope-mini-screen">
        <svg viewBox="0 0 100 50" preserveAspectRatio="none">
          <path d="M0 25 H100 M50 0 V50" stroke="#2a3a5a" strokeWidth="0.6" />
          <path d="M0 30 C10 10 20 10 25 25 S40 40 50 25 S65 10 75 25 S90 40 100 25" stroke="#f5d90a" fill="none" strokeWidth="1.4" />
          <path d="M0 22 C8 40 18 42 25 22 S42 8 50 22 S68 40 75 22 S92 8 100 22" stroke="#22d3ee" fill="none" strokeWidth="1.4" opacity="0.8" />
        </svg>
      </div>
      <div className="scope-mini-name">{name}</div>
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeImpl);
