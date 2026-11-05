import { useEffect, useState } from 'react';
import { useCircuit } from '../store/circuitStore';
import { LIBRARY, type ParamDef } from '../circuit/library';
import { formatSI, parseSI } from '../circuit/format';
import { useSim } from '../sim/runner';
import type { ParamValue } from '../circuit/types';

function NumberField({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number) => void }) {
  const show = (v: number) => (def.unit && !['°', 'böl.'].includes(def.unit) ? formatSI(v, '', 4) : String(v).replace('.', ','));
  const [text, setText] = useState(show(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(show(value)), [value]);
  const commit = () => {
    const v = parseSI(text);
    if (!isFinite(v) || (def.min !== undefined && v < def.min)) {
      setBad(true);
      return;
    }
    setBad(false);
    if (v !== value) onChange(v);
    else setText(show(value));
  };
  return (
    <div className={`numfield ${bad ? 'bad' : ''}`}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setText(show(value));
        }}
        spellCheck={false}
      />
      {def.unit && <span className="unit">{def.unit}</span>}
    </div>
  );
}

function SliderField({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number, commit: boolean) => void }) {
  const min = def.min ?? 0;
  const max = def.max ?? 1;
  const toPos = (v: number) => (def.log ? (Math.log10(v / min) / Math.log10(max / min)) * 1000 : ((v - min) / (max - min)) * 1000);
  const fromPos = (x: number) => {
    const t = x / 1000;
    let v = def.log ? min * Math.pow(max / min, t) : min + t * (max - min);
    if (def.step) v = Math.round(v / def.step) * def.step;
    return +v.toPrecision(4);
  };
  const show = def.unit ? formatSI(value, def.unit, 3) : `%${Math.round(value * 100)}`;
  return (
    <div className="sliderfield">
      <input
        type="range"
        min={0}
        max={1000}
        value={toPos(value)}
        onChange={(e) => onChange(fromPos(Number(e.target.value)), false)}
        onPointerUp={(e) => onChange(fromPos(Number((e.target as HTMLInputElement).value)), true)}
      />
      <span className="mono small">{show}</span>
    </div>
  );
}

export function Inspector() {
  const selectedId = useCircuit((s) => s.selectedId);
  const node = useCircuit((s) => s.nodes.find((n) => n.id === s.selectedId));
  const updateParams = useCircuit((s) => s.updateParams);
  const rename = useCircuit((s) => s.rename);
  const rotate = useCircuit((s) => s.rotate);
  const flip = useCircuit((s) => s.flip);
  const remove = useCircuit((s) => s.remove);
  const live = useSim((s) => (selectedId ? s.comp[selectedId] : undefined));
  const status = useSim((s) => s.status);
  const compiled = useSim((s) => s.compiled);
  const netV = useSim((s) => s.netV);
  const [adv, setAdv] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => setName(node?.data.name ?? ''), [node?.data.name]);

  if (!node) return <CircuitSummary />;
  const def = LIBRARY[node.data.type];
  const active = status === 'running' || status === 'paused';

  const setParam = (p: ParamDef, v: ParamValue) => {
    const patch: Record<string, ParamValue> = { [p.key]: v };
    if (p.presets && typeof v === 'string' && p.presets[v]) Object.assign(patch, p.presets[v]);
    updateParams(node.id, patch);
  };

  const params = def.params.filter((p) => adv || !p.advanced);
  const hasAdv = def.params.some((p) => p.advanced);

  return (
    <div className="inspector">
      <div className="insp-head">
        <input className="insp-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => rename(node.id, name)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <span className="insp-type">{def.label}</span>
      </div>
      <p className="insp-desc">{def.description}</p>

      {params.length > 0 && (
        <div className="insp-params">
          {params.map((p) => (
            <label key={p.key} className="insp-row" title={p.hint}>
              <span>{p.label}</span>
              {p.kind === 'number' && <NumberField def={p} value={Number(node.data.params[p.key])} onChange={(v) => setParam(p, v)} />}
              {p.kind === 'slider' && (
                <SliderField def={p} value={Number(node.data.params[p.key])} onChange={(v, commit) => updateParams(node.id, { [p.key]: v }, commit)} />
              )}
              {p.kind === 'select' && (
                <select value={String(node.data.params[p.key])} onChange={(e) => setParam(p, e.target.value)}>
                  {p.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {p.kind === 'bool' && (
                <button className={`toggle ${node.data.params[p.key] ? 'on' : ''}`} onClick={(e) => (e.preventDefault(), setParam(p, !node.data.params[p.key]))}>
                  <span />
                </button>
              )}
              {p.kind === 'text' && (
                <input
                  defaultValue={String(node.data.params[p.key])}
                  key={String(node.data.params[p.key])}
                  onBlur={(e) => setParam(p, e.target.value.trim().toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              )}
              {p.hint && <small className="hint">{p.hint}</small>}
            </label>
          ))}
          {hasAdv && (
            <button className="linkbtn" onClick={() => setAdv(!adv)}>
              {adv ? '▴ Gelişmiş parametreleri gizle' : '▾ Gelişmiş parametreler (SPICE modeli)'}
            </button>
          )}
        </div>
      )}

      <div className="insp-actions">
        {def.rotatable && (
          <button className="btn sm" onClick={() => rotate(node.id)} title="R">
            ⟳ Döndür
          </button>
        )}
        {def.pins.length === 2 && def.rotatable && (
          <button className="btn sm" onClick={() => flip(node.id)} title="F — uçları ters çevir">
            ⇄ Ters çevir
          </button>
        )}
        <button className="btn sm danger" onClick={() => remove([node.id])}>
          🗑 Sil
        </button>
      </div>

      {active && live && compiled && (
        <div className="insp-live">
          <div className="insp-live-title">Canlı değerler</div>
          {def.pins.map((p, i) => {
            const net = compiled.pinNet[`${node.id}:${p.id}`];
            return (
              <div className="kv" key={p.id}>
                <span>
                  V({p.label}) <small className="muted">{net === 0 ? 'GND' : compiled.netNames[net]}</small>
                </span>
                <b>{formatSI(netV[net] ?? 0, 'V')}</b>
                {node.data.type !== 'scope' && node.data.type !== 'ground' && node.data.type !== 'label' && (
                  <small className="muted">I→ {formatSI(live.I[i] ?? 0, 'A')}</small>
                )}
              </div>
            );
          })}
          {!['scope', 'multimeter', 'ground', 'label'].includes(node.data.type) && (
            <div className="kv">
              <span>Güç (anlık)</span>
              <b>{formatSI(Math.abs(live.P), 'W')}</b>
              <small className="muted">{live.P >= 0 ? 'harcanan' : 'verilen'}</small>
            </div>
          )}
          {live.probe.vbe !== undefined && (
            <div className="kv">
              <span>V<sub>BE</sub> / V<sub>CE</sub></span>
              <b>
                {formatSI(live.probe.vbe, 'V')} / {formatSI(live.probe.vce, 'V')}
              </b>
            </div>
          )}
          {live.probe.vgs !== undefined && (
            <div className="kv">
              <span>V<sub>GS</sub> / V<sub>DS</sub></span>
              <b>
                {formatSI(live.probe.vgs, 'V')} / {formatSI(live.probe.vds, 'V')}
              </b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CircuitSummary() {
  const compiled = useSim((s) => s.compiled);
  const netV = useSim((s) => s.netV);
  const status = useSim((s) => s.status);
  const nodes = useCircuit((s) => s.nodes);
  const active = status === 'running' || status === 'paused';
  if (!nodes.length) return <div className="insp-empty muted">Bir eleman seçtiğinde parametreleri burada görünecek.</div>;
  return (
    <div className="inspector">
      <div className="insp-live-title">Devre özeti</div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        {compiled ? `${compiled.elements.length} eleman · ${compiled.netCount - 1} düğüm (+GND)` : ''}
      </div>
      {compiled && (
        <div className="netlist-table">
          {compiled.netNames.map((n, i) =>
            i === 0 ? null : (
              <div className="kv" key={i}>
                <span className="mono">{n}</span>
                <b>{active ? formatSI(netV[i] ?? 0, 'V') : '—'}</b>
              </div>
            ),
          )}
        </div>
      )}
      {compiled && compiled.issues.length > 0 && (
        <div className="issues">
          {compiled.issues.map((i, k) => (
            <div key={k} className={`issue ${i.level}`}>
              {i.level === 'error' ? '⛔' : i.level === 'warning' ? '⚠️' : 'ℹ️'} {i.message}
            </div>
          ))}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 12 }}>
        İpucu: bir elemana tıkla → parametrelerini değiştir. Değerleri <span className="mono">4.7k</span>, <span className="mono">10u</span>, <span className="mono">2,2M</span> gibi yazabilirsin.
      </p>
    </div>
  );
}
