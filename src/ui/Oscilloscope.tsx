import { useEffect, useMemo, useRef, useState } from 'react';
import { useCircuit } from '../store/circuitStore';
import { runner, useSim } from '../sim/runner';
import { formatSI } from '../circuit/format';
import { FACES } from '../tepecan/mascot';
import { t } from '../i18n';

const seq125 = (from: number, to: number) => {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(from)); e <= Math.ceil(Math.log10(to)); e++) {
    for (const m of [1, 2, 5]) {
      const v = +(m * Math.pow(10, e)).toPrecision(3);
      if (v >= from * 0.999 && v <= to * 1.001) out.push(v);
    }
  }
  return out;
};
const TIME_DIVS = seq125(1e-6, 1);
const VOLT_DIVS = seq125(1e-3, 200);
const CH_COLORS = ['#f5d90a', '#22d3ee'];
const DIVX = 10;
const DIVY = 8;

interface Meas {
  max: number;
  min: number;
  avg: number;
  rms: number;
  freq: number;
}

export function Oscilloscope() {
  const nodes = useCircuit((s) => s.nodes);
  const updateParams = useCircuit((s) => s.updateParams);
  const scopes = nodes.filter((n) => n.data.type === 'scope');
  const [selId, setSelId] = useState<string | null>(null);
  const scope = scopes.find((s) => s.id === selId) ?? scopes[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meas, setMeas] = useState<(Meas | null)[]>([null, null]);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  frozenRef.current = frozen;
  const compiled = useSim((s) => s.compiled);
  const status = useSim((s) => s.status);

  const p = scope?.data.params ?? {};
  const timeDiv = Number(p.timeDiv) || 1e-3;
  const vdiv = [Number(p.ch1Div) || 1, Number(p.ch2Div) || 1];
  const pos = [Number(p.ch1Pos) || 0, Number(p.ch2Pos) || 0];
  const trig = Number(p.trig) || 0;
  const xy = !!p.xy;

  // Kanal → net eşlemesi (bağlı değilse −1)
  const chNets = useMemo(() => {
    if (!scope || !compiled) return [-1, -1];
    const count = new Map<number, number>();
    for (const n of Object.values(compiled.pinNet)) count.set(n, (count.get(n) ?? 0) + 1);
    return ['ch1', 'ch2'].map((pin) => {
      const net = compiled.pinNet[`${scope.id}:${pin}`];
      if (net === undefined) return -1;
      if (net !== 0 && (count.get(net) ?? 0) <= 1) return -1;
      return net;
    });
  }, [scope, compiled]);

  const netLabel = (net: number) => (net < 0 ? t('bağlı değil') : net === 0 ? 'GND' : compiled?.netNames[net] ?? '?');

  useEffect(() => {
    let raf = 0;
    let lastMeas = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#060b16';
      ctx.fillRect(0, 0, W, H);
      const dx = W / DIVX;
      const dy = H / DIVY;
      // ızgara
      ctx.strokeStyle = 'rgba(120,150,200,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < DIVX; i++) {
        ctx.moveTo(Math.round(i * dx) + 0.5, 0);
        ctx.lineTo(Math.round(i * dx) + 0.5, H);
      }
      for (let j = 1; j < DIVY; j++) {
        ctx.moveTo(0, Math.round(j * dy) + 0.5);
        ctx.lineTo(W, Math.round(j * dy) + 0.5);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,170,220,0.32)';
      ctx.beginPath();
      ctx.moveTo(W / 2 + 0.5, 0);
      ctx.lineTo(W / 2 + 0.5, H);
      ctx.moveTo(0, H / 2 + 0.5);
      ctx.lineTo(W, H / 2 + 0.5);
      for (let i = 0; i <= DIVX * 5; i++) {
        const x = Math.round((i * dx) / 5) + 0.5;
        ctx.moveTo(x, H / 2 - 3);
        ctx.lineTo(x, H / 2 + 3);
      }
      for (let j = 0; j <= DIVY * 5; j++) {
        const y = Math.round((j * dy) / 5) + 0.5;
        ctx.moveTo(W / 2 - 3, y);
        ctx.lineTo(W / 2 + 3, y);
      }
      ctx.stroke();

      const h = runner.hist;
      if (!h || h.count < 2 || !scope) return;
      const win = timeDiv * DIVX;
      const tNow = h.lastT();
      // Tetikleme: CH1 (yoksa CH2) yükselen kenar
      const tch = chNets[0] >= 0 ? chNets[0] : chNets[1];
      let tStart = tNow - win;
      let triggered = false;
      if (tch > 0) {
        const arr = h.nets[tch];
        const pre = win * 0.1;
        for (let i = h.count - 1; i > 0; i--) {
          const k = h.idx(i);
          const kp = h.idx(i - 1);
          const t = h.t[k];
          if (t + win - pre > tNow) continue;
          if (t < tNow - 2 * win) break;
          if (arr[kp] < trig && arr[k] >= trig) {
            tStart = t - pre;
            triggered = true;
            break;
          }
        }
      }
      if (frozenRef.current && (draw as unknown as { last?: number }).last !== undefined) {
        tStart = (draw as unknown as { last: number }).last;
      } else {
        (draw as unknown as { last?: number }).last = tStart;
      }
      const tEnd = tStart + win;

      // tetik seviyesi göstergesi
      if (tch >= 0) {
        const ci = chNets[0] >= 0 ? 0 : 1;
        const y = H / 2 - (trig / vdiv[ci] + pos[ci]) * dy;
        ctx.fillStyle = triggered ? '#ff8a3d' : 'rgba(255,138,61,0.4)';
        ctx.beginPath();
        ctx.moveTo(W, y);
        ctx.lineTo(W - 8, y - 5);
        ctx.lineTo(W - 8, y + 5);
        ctx.fill();
      }

      const ms: (Meas | null)[] = [null, null];
      if (xy) {
        if (chNets[0] < 0 || chNets[1] < 0) return;
        const ax = chNets[0] === 0 ? null : h.nets[chNets[0]];
        const ay = chNets[1] === 0 ? null : h.nets[chNets[1]];
        ctx.strokeStyle = '#7CFFB2';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#7CFFB2';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < h.count; i++) {
          const k = h.idx(i);
          const t = h.t[k];
          if (t < tStart || t > tEnd) continue;
          const X = W / 2 + ((ax ? ax[k] : 0) / vdiv[0] + pos[0]) * dx;
          const Y = H / 2 - ((ay ? ay[k] : 0) / vdiv[1] + pos[1]) * dy;
          if (first) (ctx.moveTo(X, Y), (first = false));
          else ctx.lineTo(X, Y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#9fb0d4';
        ctx.font = '11px monospace';
        ctx.fillText('XY: X = CH1, Y = CH2', 8, 16);
        return;
      }
      for (let c = 0; c < 2; c++) {
        const net = chNets[c];
        if (net < 0) continue;
        const arr = net === 0 ? null : h.nets[net];
        ctx.strokeStyle = CH_COLORS[c];
        ctx.lineWidth = 1.8;
        ctx.shadowColor = CH_COLORS[c];
        ctx.shadowBlur = 6;
        ctx.beginPath();
        let first = true;
        let max = -Infinity;
        let min = Infinity;
        let sum = 0;
        let sq = 0;
        let n = 0;
        const vals: number[] = [];
        const times: number[] = [];
        for (let i = 0; i < h.count; i++) {
          const k = h.idx(i);
          const t = h.t[k];
          if (t < tStart || t > tEnd) continue;
          const v = arr ? arr[k] : 0;
          const x = ((t - tStart) / win) * W;
          const y = H / 2 - (v / vdiv[c] + pos[c]) * dy;
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else ctx.lineTo(x, y);
          if (v > max) max = v;
          if (v < min) min = v;
          sum += v;
          sq += v * v;
          n++;
          vals.push(v);
          times.push(t);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // kanal işareti
        const y0 = H / 2 - pos[c] * dy;
        ctx.fillStyle = CH_COLORS[c];
        ctx.beginPath();
        ctx.moveTo(0, y0 - 5);
        ctx.lineTo(8, y0);
        ctx.lineTo(0, y0 + 5);
        ctx.fill();
        if (n > 4) {
          const avg = sum / n;
          // frekans: ortalama seviyeden yükselen geçişler
          const cross: number[] = [];
          const hyst = (max - min) * 0.05;
          let armed = false;
          for (let i = 0; i < vals.length; i++) {
            if (vals[i] < avg - hyst) armed = true;
            if (armed && vals[i] >= avg) {
              cross.push(times[i]);
              armed = false;
            }
          }
          const freq = cross.length >= 2 && max - min > 1e-3 ? (cross.length - 1) / (cross[cross.length - 1] - cross[0]) : 0;
          ms[c] = { max, min, avg, rms: Math.sqrt(sq / n), freq };
        }
      }
      if (now - lastMeas > 250) {
        lastMeas = now;
        setMeas(ms);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scope, chNets, timeDiv, vdiv[0], vdiv[1], pos[0], pos[1], trig, xy]);

  if (!scope) {
    return (
      <div className="osc osc-empty">
        <img src={FACES.info} alt="" />
        <div>
          <b>{t('Devrede osiloskop yok.')}</b>
          <div className="muted">
            {t('Paletteki')} <b>{t('Ölçü Aletleri → Osiloskop')}</b>
            {t('’u ekle, CH1/CH2 uçlarını görmek istediğin düğümlere bağla.')}
          </div>
        </div>
      </div>
    );
  }

  const set = (k: string, v: number) => updateParams(scope.id, { [k]: v });

  return (
    <div className="osc">
      <div className="osc-screen">
        <canvas ref={canvasRef} />
        <div className="osc-overlay tl">
          <span style={{ color: CH_COLORS[0] }}>CH1 {formatSI(vdiv[0], 'V')}/</span>
          <span style={{ color: CH_COLORS[1] }}>CH2 {formatSI(vdiv[1], 'V')}/</span>
          <span>
            {formatSI(timeDiv, 's')}/{t('böl.')}
          </span>
        </div>
        <div className="osc-overlay tr">
          {status === 'running' ? (frozen ? 'STOP' : 'RUN') : status === 'paused' ? t('DURAKLATILDI') : t('BEKLİYOR')}
        </div>
      </div>
      <div className="osc-side">
        <div className="osc-row head">
          <select value={scope.id} onChange={(e) => setSelId(e.target.value)} disabled={scopes.length < 2}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.data.name}
              </option>
            ))}
          </select>
          <button className={`btn sm ${xy ? 'on' : ''}`} onClick={() => updateParams(scope.id, { xy: !xy })} title={t('XY modu: CH1 yatay, CH2 dikey (karakteristik eğriler, Lissajous)')}>
            XY
          </button>
          <button className={`btn sm ${frozen ? 'on' : ''}`} onClick={() => setFrozen(!frozen)}>
            {frozen ? `▶ ${t('Devam')}` : `❚❚ ${t('Dondur')}`}
          </button>
        </div>
        <label className="osc-row">
          <span>{t('Zaman/böl.')}</span>
          <select value={timeDiv} onChange={(e) => set('timeDiv', Number(e.target.value))}>
            {TIME_DIVS.map((t) => (
              <option key={t} value={t}>
                {formatSI(t, 's')}
              </option>
            ))}
          </select>
        </label>
        {[0, 1].map((c) => (
          <div className="osc-ch" key={c} style={{ borderColor: CH_COLORS[c] }}>
            <div className="osc-row">
              <b style={{ color: CH_COLORS[c] }}>CH{c + 1}</b>
              <span className="muted small">{netLabel(chNets[c])}</span>
            </div>
            <div className="osc-row">
              <select value={vdiv[c]} onChange={(e) => set(c ? 'ch2Div' : 'ch1Div', Number(e.target.value))}>
                {VOLT_DIVS.map((v) => (
                  <option key={v} value={v}>
                    {formatSI(v, 'V')}/{t('böl.')}
                  </option>
                ))}
              </select>
              <input
                type="range"
                min={-4}
                max={4}
                step={0.2}
                value={pos[c]}
                onChange={(e) => updateParams(scope.id, { [c ? 'ch2Pos' : 'ch1Pos']: Number(e.target.value) }, false)}
                title={t('Dikey konum')}
              />
            </div>
            {meas[c] ? (
              <div className="osc-meas">
                <span>{t('Maks')} <b>{formatSI(meas[c]!.max, 'V')}</b></span>
                <span>Min <b>{formatSI(meas[c]!.min, 'V')}</b></span>
                <span>Vpp <b>{formatSI(meas[c]!.max - meas[c]!.min, 'V')}</b></span>
                <span>{t('Ort')} <b>{formatSI(meas[c]!.avg, 'V')}</b></span>
                <span>RMS <b>{formatSI(meas[c]!.rms, 'V')}</b></span>
                <span>f <b>{meas[c]!.freq ? formatSI(meas[c]!.freq, 'Hz') : '—'}</b></span>
              </div>
            ) : (
              <div className="osc-meas muted small">{t('Ölçüm için simülasyonu başlat')}</div>
            )}
          </div>
        ))}
        <label className="osc-row">
          <span>Tetik</span>
          <input
            type="range"
            min={-4 * vdiv[0]}
            max={4 * vdiv[0]}
            step={vdiv[0] / 10}
            value={trig}
            onChange={(e) => updateParams(scope.id, { trig: Number(e.target.value) }, false)}
          />
          <span className="mono small">{formatSI(trig, 'V')}</span>
        </label>
      </div>
    </div>
  );
}
