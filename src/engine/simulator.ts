// EESIM simülasyon çekirdeği
// Modified Nodal Analysis (MNA) + Newton-Raphson (doğrusal olmayan elemanlar) + BDF2/Geri-Euler geçici analiz.
// Tamamen istemci tarafında çalışır, harici bağımlılık yoktur.

import { solveDense, SingularMatrixError } from './linalg';
import type { CompiledCircuit, CompiledElement } from '../circuit/types';
import { LED_COLORS } from '../circuit/library';

export const VT = 0.025852; // 300 K'de termal gerilim kT/q
const GMIN_NODE = 1e-12;
const EXP_LIM = 80;
const E_LIM = Math.exp(EXP_LIM);

interface Ctx {
  A: Float64Array;
  b: Float64Array;
  n: number;
  x: Float64Array;
  t: number;
  dt: number;
  mode: 'dc' | 'tran';
  order: 1 | 2;
  srcScale: number;
  gmin: number;
  limited: boolean;
}

const num = (v: unknown, d: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return isFinite(n) ? n : d;
};

function V(x: Float64Array, net: number): number {
  return net === 0 ? 0 : x[net - 1];
}

function addA(c: Ctx, r: number, col: number, v: number) {
  if (r < 0 || col < 0) return;
  c.A[r * c.n + col] += v;
}

/** a ve b düğümleri arasına iletkenlik */
function addG(c: Ctx, a: number, b: number, g: number) {
  const ia = a - 1;
  const ib = b - 1;
  addA(c, ia, ia, g);
  addA(c, ib, ib, g);
  addA(c, ia, ib, -g);
  addA(c, ib, ia, -g);
}

/** a düğümünden eleman içinden b düğümüne akan sabit akım */
function addIsrc(c: Ctx, a: number, b: number, i: number) {
  if (a > 0) c.b[a - 1] -= i;
  if (b > 0) c.b[b - 1] += i;
}

/**
 * Genel doğrusallaştırılmış eleman damgası.
 * I[k]: k ucundan elemana giren akım, J[k][j] = ∂I[k]/∂V[j], Veff: doğrusallaştırma noktası (sınırlanmış).
 */
function stampNL(c: Ctx, nets: number[], I: number[], J: number[][], Veff: number[]) {
  for (let k = 0; k < nets.length; k++) {
    const rk = nets[k] - 1;
    if (rk < 0) continue;
    let rhs = -I[k];
    for (let j = 0; j < nets.length; j++) {
      rhs += J[k][j] * Veff[j];
      const cj = nets[j] - 1;
      if (cj >= 0) c.A[rk * c.n + cj] += J[k][j];
    }
    c.b[rk] += rhs;
  }
}

/** Taşmaya karşı korumalı üstel: exp(x) ve türevi */
function sexp(x: number): [number, number] {
  if (x > EXP_LIM) {
    return [E_LIM * (1 + (x - EXP_LIM)), E_LIM];
  }
  const e = Math.exp(x);
  return [e, e];
}

/** SPICE3 pn-eklem gerilim sınırlaması (Newton-Raphson yakınsaması için) */
export function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(vnew / vt);
    }
  }
  return vnew;
}

function limStep(vnew: number, vold: number, max: number): number {
  const d = vnew - vold;
  if (d > max) return vold + max;
  if (d < -max) return vold - max;
  return vnew;
}

// ───────────────────────────── Elemanlar ─────────────────────────────

abstract class Device {
  branches = 0;
  b0 = -1;
  nonlinear = false;
  /** Son kabul edilen adımda her uçtan elemana giren akımlar */
  cur: number[];
  constructor(public el: CompiledElement) {
    this.cur = el.nets.map(() => 0);
  }
  abstract stamp(c: Ctx): void;
  abstract currents(x: Float64Array, c: Ctx): number[];
  accept(x: Float64Array, c: Ctx): void {
    this.cur = this.currents(x, c);
  }
  initHistory(_x: Float64Array): void {}
  /** Ek ölçümler (diyot gerilimi vb.) */
  probe(_x: Float64Array): Record<string, number> {
    return {};
  }
}

class Resistor extends Device {
  g: number;
  constructor(el: CompiledElement) {
    super(el);
    this.g = 1 / Math.max(1e-6, num(el.params.R, 1000));
  }
  stamp(c: Ctx) {
    addG(c, this.el.nets[0], this.el.nets[1], this.g);
  }
  currents(x: Float64Array) {
    const i = (V(x, this.el.nets[0]) - V(x, this.el.nets[1])) * this.g;
    return [i, -i];
  }
}

class Switch extends Resistor {
  constructor(el: CompiledElement) {
    super(el);
    // Açık anahtar: 1 TΩ (gerçek anahtarın yalıtım direnci mertebesi; sızıntı pA düzeyinde kalır)
    this.g = el.params.closed ? 1e3 : 1e-12;
  }
}

class Capacitor extends Device {
  C: number;
  v1 = 0;
  v2 = 0;
  constructor(el: CompiledElement) {
    super(el);
    this.C = Math.max(1e-18, num(el.params.C, 1e-6));
  }
  coeffs(c: Ctx): [number, number] {
    if (c.mode === 'dc') return [0, 0];
    if (c.order === 2) return [(1.5 * this.C) / c.dt, (this.C / c.dt) * (-2 * this.v1 + 0.5 * this.v2)];
    return [this.C / c.dt, (-this.C / c.dt) * this.v1];
  }
  stamp(c: Ctx) {
    const [geq, ieq] = this.coeffs(c);
    const [a, b] = this.el.nets;
    addG(c, a, b, geq);
    addIsrc(c, a, b, ieq);
  }
  currents(x: Float64Array, c: Ctx) {
    const [geq, ieq] = this.coeffs(c);
    const v = V(x, this.el.nets[0]) - V(x, this.el.nets[1]);
    const i = geq * v + ieq;
    return [i, -i];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    const v = V(x, this.el.nets[0]) - V(x, this.el.nets[1]);
    this.v2 = this.v1;
    this.v1 = v;
  }
  initHistory(x: Float64Array) {
    const v = this.el.params.useIc ? num(this.el.params.ic, 0) : V(x, this.el.nets[0]) - V(x, this.el.nets[1]);
    this.v1 = this.v2 = v;
  }
}

class Inductor extends Device {
  L: number;
  i1 = 0;
  i2 = 0;
  constructor(el: CompiledElement) {
    super(el);
    this.L = Math.max(1e-15, num(el.params.L, 1e-3));
    this.branches = 1;
  }
  stamp(c: Ctx) {
    const [a, b] = this.el.nets;
    const k = this.b0;
    addA(c, a - 1, k, 1);
    addA(c, b - 1, k, -1);
    addA(c, k, a - 1, 1);
    addA(c, k, b - 1, -1);
    if (c.mode === 'tran') {
      if (c.order === 2) {
        addA(c, k, k, (-1.5 * this.L) / c.dt);
        c.b[k] += (this.L / c.dt) * (-2 * this.i1 + 0.5 * this.i2);
      } else {
        addA(c, k, k, -this.L / c.dt);
        c.b[k] += (-this.L / c.dt) * this.i1;
      }
    }
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [i, -i];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    this.i2 = this.i1;
    this.i1 = x[this.b0];
  }
  initHistory(x: Float64Array) {
    this.i1 = this.i2 = x[this.b0];
  }
}

class VSource extends Device {
  Rs: number;
  constructor(el: CompiledElement, public value: (t: number) => number) {
    super(el);
    this.branches = 1;
    this.Rs = Math.max(0, num(el.params.Rs, 0));
  }
  stamp(c: Ctx) {
    const [a, b] = this.el.nets;
    const k = this.b0;
    addA(c, a - 1, k, 1);
    addA(c, b - 1, k, -1);
    addA(c, k, a - 1, 1);
    addA(c, k, b - 1, -1);
    if (this.Rs > 0) addA(c, k, k, -this.Rs);
    c.b[k] += this.value(c.t) * c.srcScale;
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [i, -i];
  }
}

export function waveValue(params: Record<string, unknown>, t: number): number {
  const amp = num(params.amp, 5);
  const f = num(params.freq, 1000);
  const off = num(params.offset, 0);
  const ph = num(params.phase, 0);
  const wave = String(params.wave ?? 'sine');
  if (wave === 'square' || wave === 'triangle') {
    let fr = (f * t + ph / 360) % 1;
    if (fr < 0) fr += 1;
    if (wave === 'square') return off + amp * (fr < 0.5 ? 1 : -1);
    const tri = fr < 0.25 ? 4 * fr : fr < 0.75 ? 2 - 4 * fr : 4 * fr - 4;
    return off + amp * tri;
  }
  return off + amp * Math.sin(2 * Math.PI * f * t + (ph * Math.PI) / 180);
}

class ISource extends Device {
  I: number;
  constructor(el: CompiledElement) {
    super(el);
    this.I = num(el.params.I, 1e-3);
  }
  stamp(c: Ctx) {
    const [p, n] = this.el.nets;
    addIsrc(c, n, p, this.I * c.srcScale);
  }
  currents() {
    return [-this.I, this.I];
  }
}

class Ammeter extends Device {
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 1;
  }
  stamp(c: Ctx) {
    const [a, b] = this.el.nets;
    const k = this.b0;
    addA(c, a - 1, k, 1);
    addA(c, b - 1, k, -1);
    addA(c, k, a - 1, 1);
    addA(c, k, b - 1, -1);
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [i, -i];
  }
}

class Transformer extends Device {
  k: number;
  constructor(el: CompiledElement) {
    super(el);
    this.k = 1 / Math.max(1e-6, num(el.params.n, 10));
    this.branches = 1;
  }
  stamp(c: Ctx) {
    const [p1, p2, s1, s2] = this.el.nets;
    const j = this.b0;
    const k = this.k;
    addA(c, s1 - 1, j, 1);
    addA(c, s2 - 1, j, -1);
    addA(c, p1 - 1, j, -k);
    addA(c, p2 - 1, j, k);
    addA(c, j, s1 - 1, 1);
    addA(c, j, s2 - 1, -1);
    addA(c, j, p1 - 1, -k);
    addA(c, j, p2 - 1, k);
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [-this.k * i, this.k * i, i, -i];
  }
}

class TransformerCT extends Device {
  k: number;
  constructor(el: CompiledElement) {
    super(el);
    this.k = 1 / (2 * Math.max(1e-6, num(el.params.n, 10)));
    this.branches = 2;
  }
  stamp(c: Ctx) {
    const [p1, p2, s1, ct, s2] = this.el.nets;
    const j1 = this.b0;
    const j2 = this.b0 + 1;
    const k = this.k;
    // Sargı 1: S1–CT
    addA(c, s1 - 1, j1, 1);
    addA(c, ct - 1, j1, -1);
    addA(c, j1, s1 - 1, 1);
    addA(c, j1, ct - 1, -1);
    addA(c, j1, p1 - 1, -k);
    addA(c, j1, p2 - 1, k);
    // Sargı 2: CT–S2
    addA(c, ct - 1, j2, 1);
    addA(c, s2 - 1, j2, -1);
    addA(c, j2, ct - 1, 1);
    addA(c, j2, s2 - 1, -1);
    addA(c, j2, p1 - 1, -k);
    addA(c, j2, p2 - 1, k);
    // Primer akımı: ip = −k(i1 + i2)
    for (const j of [j1, j2]) {
      addA(c, p1 - 1, j, -k);
      addA(c, p2 - 1, j, k);
    }
  }
  currents(x: Float64Array) {
    const i1 = x[this.b0];
    const i2 = x[this.b0 + 1];
    const ip = -this.k * (i1 + i2);
    return [ip, -ip, i1, i2 - i1, -i2];
  }
}

class Diode extends Device {
  Is: number;
  vt: number;
  vcrit: number;
  bv = Infinity;
  ibv = 1e-3;
  vtz = VT;
  vcritz = 0;
  vd = 0;
  id = 0;
  constructor(el: CompiledElement, Is: number, N: number, bv = Infinity) {
    super(el);
    this.nonlinear = true;
    this.Is = Math.max(1e-30, Is);
    this.vt = Math.max(0.1, N) * VT;
    this.vcrit = this.vt * Math.log(this.vt / (Math.SQRT2 * this.Is));
    this.bv = bv;
    this.vcritz = this.vtz * Math.log(this.vtz / (Math.SQRT2 * this.ibv));
  }
  iv(v: number): [number, number] {
    const [e, de] = sexp(v / this.vt);
    let id = this.Is * (e - 1);
    let gd = (this.Is / this.vt) * de;
    if (isFinite(this.bv)) {
      const [eb, deb] = sexp(-(v + this.bv) / this.vtz);
      id -= this.ibv * eb;
      gd += (this.ibv / this.vtz) * deb;
    }
    return [id, gd];
  }
  limit(vnew: number): number {
    const vold = this.vd;
    let v = pnjlim(vnew, vold, this.vt, this.vcrit);
    if (isFinite(this.bv) && v < 0) {
      const w = pnjlim(-v - this.bv, -vold - this.bv, this.vtz, this.vcritz);
      v = -w - this.bv;
    }
    return v;
  }
  stamp(c: Ctx) {
    const [a, k] = this.el.nets;
    const vk = V(c.x, k);
    const vraw = V(c.x, a) - vk;
    const v = this.limit(vraw);
    if (Math.abs(v - vraw) > 1e-12) c.limited = true;
    this.vd = v;
    const [id0, gd0] = this.iv(v);
    const g = gd0 + c.gmin;
    const I = id0 + c.gmin * v;
    stampNL(c, [a, k], [I, -I], [[g, -g], [-g, g]], [vk + v, vk]);
  }
  currents(x: Float64Array) {
    const v = V(x, this.el.nets[0]) - V(x, this.el.nets[1]);
    const [id] = this.iv(v);
    this.id = id;
    return [id, -id];
  }
  probe(x: Float64Array) {
    return { vd: V(x, this.el.nets[0]) - V(x, this.el.nets[1]), id: this.id };
  }
}

class BJT extends Device {
  p: number;
  Is: number;
  bf: number;
  br: number;
  vcrit: number;
  vbe = 0;
  vbc = 0;
  constructor(el: CompiledElement, pnp: boolean) {
    super(el);
    this.nonlinear = true;
    this.p = pnp ? -1 : 1;
    this.Is = Math.max(1e-30, num(el.params.Is, 1e-14));
    this.bf = Math.max(0.1, num(el.params.beta, 100));
    this.br = Math.max(0.01, num(el.params.betaR, 1));
    this.vcrit = VT * Math.log(VT / (Math.SQRT2 * this.Is));
    // Başlangıç tahmini: aktif bölge
    this.vbe = 0.6;
    this.vbc = 0;
  }
  eval(vbe: number, vbc: number, gmin: number) {
    const [ef, def] = sexp(vbe / VT);
    const [er, der] = sexp(vbc / VT);
    const If = this.Is * (ef - 1);
    const gif = (this.Is / VT) * def;
    const Ir = this.Is * (er - 1);
    const gir = (this.Is / VT) * der;
    const Ic = If - Ir - Ir / this.br - gmin * vbc;
    const Ib = If / this.bf + Ir / this.br + gmin * (vbe + vbc);
    return {
      Ic,
      Ib,
      dIc_dvbe: gif,
      dIc_dvbc: -gir - gir / this.br - gmin,
      dIb_dvbe: gif / this.bf + gmin,
      dIb_dvbc: gir / this.br + gmin,
    };
  }
  stamp(c: Ctx) {
    const [nb, nc, ne] = this.el.nets;
    const p = this.p;
    const Vb = V(c.x, nb);
    const Vc = V(c.x, nc);
    const Ve = V(c.x, ne);
    const vbeR = p * (Vb - Ve);
    const vbcR = p * (Vb - Vc);
    const vbe = pnjlim(vbeR, this.vbe, VT, this.vcrit);
    const vbc = pnjlim(vbcR, this.vbc, VT, this.vcrit);
    if (Math.abs(vbe - vbeR) > 1e-12 || Math.abs(vbc - vbcR) > 1e-12) c.limited = true;
    this.vbe = vbe;
    this.vbc = vbc;
    const r = this.eval(vbe, vbc, c.gmin);
    const JC = [r.dIc_dvbe + r.dIc_dvbc, -r.dIc_dvbc, -r.dIc_dvbe];
    const JB = [r.dIb_dvbe + r.dIb_dvbc, -r.dIb_dvbc, -r.dIb_dvbe];
    const JE = [-(JC[0] + JB[0]), -(JC[1] + JB[1]), -(JC[2] + JB[2])];
    const Ib = p * r.Ib;
    const Ic = p * r.Ic;
    const Ie = -(Ib + Ic);
    const VbE = Ve + p * vbe;
    const VcE = VbE - p * vbc;
    stampNL(c, [nb, nc, ne], [Ib, Ic, Ie], [JB, JC, JE], [VbE, VcE, Ve]);
  }
  currents(x: Float64Array, c: Ctx) {
    const [nb, nc, ne] = this.el.nets;
    const p = this.p;
    const r = this.eval(p * (V(x, nb) - V(x, ne)), p * (V(x, nb) - V(x, nc)), c.gmin);
    const Ib = p * r.Ib;
    const Ic = p * r.Ic;
    return [Ib, Ic, -(Ib + Ic)];
  }
  probe(x: Float64Array) {
    const [nb, nc, ne] = this.el.nets;
    const p = this.p;
    const vbe = p * (V(x, nb) - V(x, ne));
    const vce = p * (V(x, nc) - V(x, ne));
    const vbc = p * (V(x, nb) - V(x, nc));
    // Çalışma bölgesi: 0 kesim, 1 aktif, 2 doyum, 3 ters aktif
    let region = 0;
    if (vbe > 0.5 && vbc < 0.4) region = 1;
    else if (vbe > 0.5 && vbc >= 0.4) region = 2;
    else if (vbe <= 0.5 && vbc > 0.5) region = 3;
    return { vbe, vce, region };
  }
}

class MOSFET extends Device {
  p: number;
  vth: number;
  K: number;
  lambda: number;
  vgs = 0;
  vds = 0;
  constructor(el: CompiledElement, pmos: boolean) {
    super(el);
    this.nonlinear = true;
    this.p = pmos ? -1 : 1;
    this.vth = Math.abs(num(el.params.Vth, 1));
    this.K = Math.max(1e-12, num(el.params.K, 2e-3));
    this.lambda = Math.max(0, num(el.params.lambda, 0));
  }
  core(vgs: number, vds: number): [number, number, number] {
    const vov = vgs - this.vth;
    if (vov <= 0) return [0, 0, 0];
    const K = this.K;
    const l = this.lambda;
    const cl = 1 + l * vds;
    if (vds < vov) {
      const f = vov * vds - (vds * vds) / 2;
      return [K * f * cl, K * vds * cl, K * (vov - vds) * cl + K * f * l];
    }
    const f = 0.5 * vov * vov;
    return [K * f * cl, K * vov * cl, K * f * l];
  }
  /** Çerçeve (NMOS) koordinatlarında Id ve düğüm türevleri [dVg, dVd, dVs] */
  evalFrame(vgs: number, vds: number, gmin: number): [number, number[]] {
    let id: number;
    let J: number[];
    if (vds >= 0) {
      const [i, gm, gds] = this.core(vgs, vds);
      id = i;
      J = [gm, gds, -gm - gds];
    } else {
      const [i, gm, gds] = this.core(vgs - vds, -vds);
      id = -i;
      J = [-gm, gm + gds, -gds];
    }
    id += gmin * vds;
    J[1] += gmin;
    J[2] -= gmin;
    return [id, J];
  }
  stamp(c: Ctx) {
    const [ng, nd, ns] = this.el.nets;
    const p = this.p;
    const Vs = V(c.x, ns);
    const vgsR = p * (V(c.x, ng) - Vs);
    const vdsR = p * (V(c.x, nd) - Vs);
    const vgs = limStep(vgsR, this.vgs, 1.5);
    const vds = limStep(vdsR, this.vds, 3);
    if (vgs !== vgsR || vds !== vdsR) c.limited = true;
    this.vgs = vgs;
    this.vds = vds;
    const [idF, J] = this.evalFrame(vgs, vds, c.gmin);
    const Id = p * idF;
    const Jd = J;
    const Js = [-J[0], -J[1], -J[2]];
    stampNL(c, [ng, nd, ns], [0, Id, -Id], [[0, 0, 0], Jd, Js], [Vs + p * vgs, Vs + p * vds, Vs]);
  }
  currents(x: Float64Array, c: Ctx) {
    const [ng, nd, ns] = this.el.nets;
    const p = this.p;
    const [idF] = this.evalFrame(p * (V(x, ng) - V(x, ns)), p * (V(x, nd) - V(x, ns)), c.gmin);
    const Id = p * idF;
    return [0, Id, -Id];
  }
  probe(x: Float64Array) {
    const [ng, nd, ns] = this.el.nets;
    const p = this.p;
    const vgs = p * (V(x, ng) - V(x, ns));
    const vds = p * (V(x, nd) - V(x, ns));
    const vov = vgs - this.vth;
    const region = vov <= 0 ? 0 : Math.abs(vds) < vov ? 2 : 1; // 0 kesim, 1 doyum, 2 triyot
    return { vgs, vds, region };
  }
}

/** JFET (N-kanal, deplesyon): kare yasası MOSFET ile aynı formda — vth = V_P (işaretli, negatif), K = 2·I_DSS/V_P². Kapı akımı ihmal. */
class JFET extends MOSFET {
  constructor(el: CompiledElement) {
    super(el, false);
    const Vp = num(el.params.Vp, -4) || -4;
    const Idss = Math.max(1e-9, num(el.params.Idss, 10e-3));
    this.vth = Vp;
    this.K = (2 * Idss) / (Vp * Vp);
    this.lambda = Math.max(0, num(el.params.lambda, 0));
  }
}

class Passive extends Device {
  stamp() {}
  currents() {
    return this.el.nets.map(() => 0);
  }
}

// ───────────────────────────── v0.2 elemanları ─────────────────────────────

/** Basit direnç türevleri: lamba, LDR, NTC — direnç değeri parametrelerden hesaplanır */
export function resistanceOf(el: CompiledElement): number {
  const p = el.params;
  switch (el.type) {
    case 'lamp': {
      const v = num(p.Vnom, 6);
      const pw = Math.max(1e-3, num(p.Pnom, 0.3));
      return (v * v) / pw;
    }
    case 'ldr': {
      const lux = Math.max(0.01, num(p.lux, 100));
      return Math.max(10, num(p.R10, 20e3) * Math.pow(lux / 10, -num(p.gamma, 0.7)));
    }
    case 'ntc': {
      const T = num(p.temp, 25) + 273.15;
      return num(p.R25, 10e3) * Math.exp(num(p.B, 3950) * (1 / T - 1 / 298.15));
    }
    case 'ptc':
      return Math.max(1e-3, num(p.R25, 100) * Math.exp(num(p.alpha, 0.04) * (num(p.temp, 25) - 25)));
    case 'buzzer':
      return Math.max(1, num(p.R, 100));
    default:
      return num(p.R, 1000);
  }
}

class ResistorLike extends Resistor {
  constructor(el: CompiledElement) {
    super(el);
    this.g = 1 / Math.max(1e-6, resistanceOf(el));
  }
}

/** Varistör (MOV): çift yönlü; V_n'yi aşınca sertçe iletir. İki zıt zener gibi simetrik üstel model. */
class Varistor extends Device {
  vs: number;
  Is: number;
  Gleak = 1e-9;
  v = 0;
  constructor(el: CompiledElement) {
    super(el);
    this.nonlinear = true;
    const Vn = Math.max(0.5, num(el.params.Vn, 30));
    this.vs = Vn / 10; // ölçek
    this.Is = 1e-3 * Math.exp(-10); // v = V_n'de ≈ 1 mA (V_1mA noktası); yük altında biraz üstünde kenetler
  }
  iv(v: number): [number, number] {
    const [ep, dep] = sexp(v / this.vs);
    const [en, den] = sexp(-v / this.vs);
    const i = this.Is * (ep - en) + this.Gleak * v;
    const g = (this.Is / this.vs) * (dep + den) + this.Gleak;
    return [i, g];
  }
  stamp(c: Ctx) {
    const [a, b] = this.el.nets;
    const vb = V(c.x, b);
    const vraw = V(c.x, a) - vb;
    const v = limStep(vraw, this.v, this.vs * 2);
    if (Math.abs(v - vraw) > 1e-12) c.limited = true;
    this.v = v;
    const [I, g] = this.iv(v);
    stampNL(c, [a, b], [I, -I], [[g, -g], [-g, g]], [vb + v, vb]);
  }
  currents(x: Float64Array) {
    const [i] = this.iv(V(x, this.el.nets[0]) - V(x, this.el.nets[1]));
    return [i, -i];
  }
  probe(x: Float64Array) {
    return { vd: V(x, this.el.nets[0]) - V(x, this.el.nets[1]) };
  }
}

/** Sigorta: akım anma değerini aşınca atar ve açık kalır (durum accept'te, adımlar arasında güncellenir). */
class Fuse extends Device {
  Irated: number;
  Ron = 0.01;
  blown = false;
  constructor(el: CompiledElement) {
    super(el);
    this.Irated = Math.max(1e-3, num(el.params.Irated, 0.5));
  }
  private cond() {
    return this.blown ? 1e-12 : 1 / this.Ron;
  }
  stamp(c: Ctx) {
    addG(c, this.el.nets[0], this.el.nets[1], this.cond());
  }
  currents(x: Float64Array) {
    const i = (V(x, this.el.nets[0]) - V(x, this.el.nets[1])) * this.cond();
    return [i, -i];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    if (!this.blown && Math.abs(this.cur[0]) > this.Irated) this.blown = true;
  }
  probe() {
    return { blown: this.blown ? 1 : 0 };
  }
}

class Button extends Resistor {
  constructor(el: CompiledElement) {
    super(el);
    const closed = !!el.params.pressed !== (el.params.kind === 'NC');
    this.g = closed ? 1e3 : 1e-12;
  }
}

/** Potansiyometre: a —(R·konum)— w —(R·(1−konum))— b */
class Pot extends Device {
  g1: number;
  g2: number;
  constructor(el: CompiledElement) {
    super(el);
    const R = Math.max(1, num(el.params.R, 10e3));
    const pos = Math.min(1, Math.max(0, num(el.params.pos, 0.5)));
    this.g1 = 1 / Math.max(0.01, R * pos);
    this.g2 = 1 / Math.max(0.01, R * (1 - pos));
  }
  stamp(c: Ctx) {
    const [a, w, b] = this.el.nets;
    addG(c, a, w, this.g1);
    addG(c, w, b, this.g2);
  }
  currents(x: Float64Array) {
    const [a, w, b] = this.el.nets;
    const ia = (V(x, a) - V(x, w)) * this.g1;
    const ib = (V(x, b) - V(x, w)) * this.g2;
    return [ia, -(ia + ib), ib];
  }
}

/** Tek uçlu lojik kaynak (0 V / 5 V), toprağa göre */
class LogicSource extends Device {
  constructor(el: CompiledElement, public value: number) {
    super(el);
    this.branches = 1;
  }
  stamp(c: Ctx) {
    const [y] = this.el.nets;
    const k = this.b0;
    addA(c, y - 1, k, 1);
    addA(c, k, y - 1, 1);
    c.b[k] += this.value * c.srcScale;
  }
  currents(x: Float64Array) {
    return [x[this.b0]];
  }
}

/** E: gerilim kontrollü gerilim kaynağı — V(o+,o−) = μ·V(c+,c−) */
class VCVS extends Device {
  mu: number;
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 1;
    this.mu = num(el.params.gain, 10);
  }
  stamp(c: Ctx) {
    const [op, on, cp, cn] = this.el.nets;
    const k = this.b0;
    addA(c, op - 1, k, 1);
    addA(c, on - 1, k, -1);
    addA(c, k, op - 1, 1);
    addA(c, k, on - 1, -1);
    addA(c, k, cp - 1, -this.mu);
    addA(c, k, cn - 1, this.mu);
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [i, -i, 0, 0];
  }
}

/** G: gerilim kontrollü akım kaynağı — o+'dan kaynağın içinden o−'ye gm·V(c+,c−) */
class VCCS extends Device {
  gm: number;
  constructor(el: CompiledElement) {
    super(el);
    this.gm = num(el.params.gain, 1e-3);
  }
  stamp(c: Ctx) {
    const [op, on, cp, cn] = this.el.nets;
    addA(c, op - 1, cp - 1, this.gm);
    addA(c, op - 1, cn - 1, -this.gm);
    addA(c, on - 1, cp - 1, -this.gm);
    addA(c, on - 1, cn - 1, this.gm);
  }
  currents(x: Float64Array) {
    const [op, on, cp, cn] = this.el.nets;
    void op;
    void on;
    const i = this.gm * (V(x, cp) - V(x, cn));
    return [i, -i, 0, 0];
  }
}

/** F: akım kontrollü akım kaynağı — algılama ucundan (s+→s−) geçen akımın β katı */
class CCCS extends Device {
  beta: number;
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 1;
    this.beta = num(el.params.gain, 10);
  }
  stamp(c: Ctx) {
    const [op, on, sp, sn] = this.el.nets;
    const k = this.b0;
    addA(c, sp - 1, k, 1);
    addA(c, sn - 1, k, -1);
    addA(c, k, sp - 1, 1);
    addA(c, k, sn - 1, -1);
    addA(c, op - 1, k, this.beta);
    addA(c, on - 1, k, -this.beta);
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [this.beta * i, -this.beta * i, i, -i];
  }
}

/** H: akım kontrollü gerilim kaynağı — V(o+,o−) = r·I(s+→s−) */
class CCVS extends Device {
  r: number;
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 2;
    this.r = num(el.params.gain, 1000);
  }
  stamp(c: Ctx) {
    const [op, on, sp, sn] = this.el.nets;
    const ks = this.b0;
    const ko = this.b0 + 1;
    addA(c, sp - 1, ks, 1);
    addA(c, sn - 1, ks, -1);
    addA(c, ks, sp - 1, 1);
    addA(c, ks, sn - 1, -1);
    addA(c, op - 1, ko, 1);
    addA(c, on - 1, ko, -1);
    addA(c, ko, op - 1, 1);
    addA(c, ko, on - 1, -1);
    addA(c, ko, ks, -this.r);
  }
  currents(x: Float64Array) {
    const io = x[this.b0 + 1];
    const is = x[this.b0];
    return [io, -io, is, -is];
  }
}

/** u / (1 + |u|^8)^(1/8): |u| < ~0,8'e kadar doğrusal, ±1'de yumuşak doyum. Türeviyle birlikte. */
function softClip(u: number): [number, number] {
  const a = Math.pow(Math.abs(u), 8);
  const base = 1 + a;
  return [u * Math.pow(base, -1 / 8), Math.pow(base, -1 / 8 - 1)];
}

export const OPAMP_MODELS: Record<string, { A0: number; GBW: number; SR: number; head: number; Rin: number; Rout: number; vos: number; label: string }> = {
  ideal: { A0: 1e6, GBW: 100e6, SR: 1000, head: 0, Rin: 1e12, Rout: 1, vos: 0, label: 'İdeal (sonsuza yakın)' },
  LM741: { A0: 2e5, GBW: 1e6, SR: 0.5, head: 1.5, Rin: 2e6, Rout: 75, vos: 1e-3, label: 'LM741 (1 MHz, 0,5 V/µs)' },
  TL081: { A0: 2e5, GBW: 3e6, SR: 13, head: 1.5, Rin: 1e12, Rout: 75, vos: 3e-3, label: 'TL081 (JFET, 3 MHz, 13 V/µs)' },
  LM358: { A0: 1e5, GBW: 1e6, SR: 0.3, head: 1.5, Rin: 1e7, Rout: 75, vos: 2e-3, label: 'LM358 (tek beslemeli)' },
};

/**
 * Op-amp makro modeli: giriş direnci → gm (eğim sınırlı, slew) → iç kazanç düğümü X (R1‖C1 ile baskın kutup)
 * → yumuşak doyumlu çıkış katı (besleme sınırları). Kazanç-bant genişliği çarpımı ve slew rate gerçekçidir.
 */
class OpAmp extends Device {
  Gin: number;
  G1: number;
  R1 = 1e6;
  C1: number;
  Imax: number;
  Gout: number;
  mid: number;
  half: number;
  vos: number;
  v1 = 0;
  v2 = 0;
  constructor(el: CompiledElement) {
    super(el);
    this.nonlinear = true;
    this.branches = 1; // iç düğüm X
    const p = el.params;
    const m = OPAMP_MODELS[String(p.model)] ?? OPAMP_MODELS.LM741;
    const A0 = num(p.A0, m.A0);
    const GBW = num(p.GBW, m.GBW);
    const SR = num(p.SR, m.SR) * 1e6;
    const vcc = num(p.Vcc, 15);
    const vee = num(p.Vee, -15);
    this.Gin = 1 / m.Rin;
    this.G1 = A0 / this.R1;
    const fp = GBW / A0;
    this.C1 = 1 / (2 * Math.PI * this.R1 * fp);
    this.Imax = SR * this.C1;
    this.Gout = 1 / m.Rout;
    this.vos = num(p.Vos, m.vos);
    this.mid = (vcc + vee) / 2;
    this.half = Math.max(0.1, (vcc - vee) / 2 - m.head);
  }
  private X() {
    return this.b0 + 1; // sahte net numarası
  }
  private capCoeffs(c: Ctx): [number, number] {
    if (c.mode === 'dc') return [0, 0];
    if (c.order === 2) return [(1.5 * this.C1) / c.dt, (this.C1 / c.dt) * (-2 * this.v1 + 0.5 * this.v2)];
    return [this.C1 / c.dt, (-this.C1 / c.dt) * this.v1];
  }
  stamp(c: Ctx) {
    const [p, n, o] = this.el.nets;
    const X = this.X();
    const x = c.x;
    addG(c, p, n, this.Gin);
    // iç düğüm: R1, C1, gmin
    addG(c, X, 0, 1 / this.R1 + 1e-12);
    const [geq, ieq] = this.capCoeffs(c);
    addG(c, X, 0, geq);
    addIsrc(c, X, 0, ieq);
    // transkondüktans (eğim sınırlı): X düğümüne I1 enjekte eder
    const vd = V(x, p) - V(x, n) + this.vos;
    const u = (this.G1 * vd) / this.Imax;
    const th = Math.tanh(u);
    const I1 = this.Imax * th;
    const g1 = this.G1 * (1 - th * th);
    // kenetleme: X düğümünü besleme sınırları civarında tutar
    const vx = V(x, X);
    const w = 0.05;
    const hi = this.mid + 1.5 * this.half;
    const lo = this.mid - 1.5 * this.half;
    const sp = (z: number) => (z > 30 ? z : Math.log1p(Math.exp(z)));
    const sg = (z: number) => 1 / (1 + Math.exp(-z));
    const Gc = 1;
    const Icl = Gc * w * (sp((vx - hi) / w) - sp((lo - vx) / w));
    const gcl = Gc * (sg((vx - hi) / w) + sg((lo - vx) / w));
    // çıkış katı: rayına kadar neredeyse doğrusal, sonra yumuşak doyum
    const [fz, dfz] = softClip((vx - this.mid) / this.half);
    const vt = this.mid + this.half * fz;
    const dvt = dfz;
    const vo = V(x, o);
    const Io = this.Gout * (vo - vt);
    // X satırı: cihaza giren akım = −I1 + Icl ; o satırı: Io
    stampNL(c, [p, n, X], [0, 0, -I1 + Icl], [[0, 0, 0], [0, 0, 0], [-g1, g1, gcl]], [V(x, p), V(x, n), vx]);
    stampNL(c, [o, X], [Io, 0], [[this.Gout, -this.Gout * dvt], [0, 0]], [vo, vx]);
  }
  currents(x: Float64Array) {
    const [p, n, o] = this.el.nets;
    const ip = (V(x, p) - V(x, n)) * this.Gin;
    const vx = x[this.b0];
    const vt = this.mid + this.half * softClip((vx - this.mid) / this.half)[0];
    return [ip, -ip, this.Gout * (V(x, o) - vt)];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    this.v2 = this.v1;
    this.v1 = x[this.b0];
  }
  initHistory(x: Float64Array) {
    this.v1 = this.v2 = x[this.b0];
  }
  probe(x: Float64Array) {
    const [p, n, o] = this.el.nets;
    const vo = V(x, o);
    const sat = Math.abs(vo - this.mid) > this.half * 0.95 ? 1 : 0;
    return { vd: V(x, p) - V(x, n), vo, sat };
  }
}

/** 78xx doğrusal regülatör (davranışsal): çıkış = min(Vreg, Vgiriş − düşüm), yumuşak geçişli */
class Regulator extends Device {
  Vreg: number;
  drop: number;
  Gout = 20;
  constructor(el: CompiledElement) {
    super(el);
    this.nonlinear = true;
    this.Vreg = num(el.params.Vout, 5);
    this.drop = num(el.params.drop, 2);
  }
  target(vinRel: number): [number, number] {
    const a = this.Vreg;
    const b = vinRel - this.drop;
    const w = 0.05;
    const m = Math.min(a, b);
    const d = Math.abs(a - b) / w;
    const soft = m - w * Math.log1p(Math.exp(-d));
    const s = 1 / (1 + Math.exp((b - a) / w)); // ∂/∂b
    return [soft, s];
  }
  stamp(c: Ctx) {
    const [vin, g, vout] = this.el.nets;
    const x = c.x;
    const Vg = V(x, g);
    const [vt, s] = this.target(V(x, vin) - Vg);
    const Io = this.Gout * (V(x, vout) - Vg - vt);
    const J = [-this.Gout * s, -this.Gout * (1 - s), this.Gout]; // ∂Io/∂[Vin, Vg, Vout]
    stampNL(c, [vin, g, vout], [-Io, 0, Io], [J.map((v) => -v), [0, 0, 0], J], [V(x, vin), Vg, V(x, vout)]);
  }
  currents(x: Float64Array) {
    const [vin, g, vout] = this.el.nets;
    const Vg = V(x, g);
    const [vt] = this.target(V(x, vin) - Vg);
    const Io = this.Gout * (V(x, vout) - Vg - vt);
    return [-Io, 0, Io];
  }
}

/** TL431 ayarlanabilir şönt referans (davranışsal): REF − anot > 2,495 V iken katottan anoda yüksek kazançla akım çeker. */
class TL431 extends Device {
  Vr = 2.495;
  Imax = 0.1;
  a = 400;
  Gka = 1e-5;
  constructor(el: CompiledElement) {
    super(el);
    this.nonlinear = true;
  }
  private sink(Vref: number, Va: number, Vk: number) {
    const z = this.a * (Vref - Va - this.Vr);
    const s = z > 40 ? 1 : z < -40 ? 0 : 1 / (1 + Math.exp(-z));
    const ds = z > 40 || z < -40 ? 0 : s * (1 - s);
    const dRef = this.Imax * this.a * ds;
    return { Ika: this.Imax * s + this.Gka * (Vk - Va), dRef, dVk: this.Gka, dVa: -dRef - this.Gka };
  }
  stamp(c: Ctx) {
    const [ref, anode, cathode] = this.el.nets;
    addG(c, ref, anode, 1e-9); // REF ucu yüksek empedans
    const Vref = V(c.x, ref);
    const Va = V(c.x, anode);
    const Vk = V(c.x, cathode);
    const { Ika, dRef, dVk, dVa } = this.sink(Vref, Va, Vk);
    stampNL(c, [ref, anode, cathode], [0, -Ika, Ika], [[0, 0, 0], [-dRef, -dVa, -dVk], [dRef, dVa, dVk]], [Vref, Va, Vk]);
  }
  currents(x: Float64Array) {
    const [ref, anode, cathode] = this.el.nets;
    const { Ika } = this.sink(V(x, ref), V(x, anode), V(x, cathode));
    return [0, -Ika, Ika];
  }
  probe(x: Float64Array) {
    return { vref: V(x, this.el.nets[0]) - V(x, this.el.nets[1]) };
  }
}

/** Opto-kuplör: giriş LED'i, çıkış foto-transistörünü I_ce = CTR·I_LED·sat(V_ce) ile sürer; iki taraf galvanik yalıtımlı. */
class OptoCoupler extends Device {
  CTR: number;
  vt = 2 * VT;
  Is: number;
  vcrit: number;
  vd = 0;
  Vsat = 0.15;
  constructor(el: CompiledElement) {
    super(el);
    this.nonlinear = true;
    this.CTR = Math.max(0.01, num(el.params.CTR, 0.5));
    this.Is = 0.01 / Math.exp(1.2 / this.vt); // IR LED, Vf ≈ 1,2 V
    this.vcrit = this.vt * Math.log(this.vt / (Math.SQRT2 * this.Is));
  }
  private out(Id: number, vce: number) {
    const th = Math.tanh(vce / this.Vsat - 2); // V_ce ~0,3–0,6 V'ta doyumdan çıkar
    const sat = 0.5 * (1 + th);
    return { Ice: this.CTR * Id * sat, dVce: (this.CTR * Id * 0.5 * (1 - th * th)) / this.Vsat, dId: this.CTR * sat };
  }
  stamp(c: Ctx) {
    const [a, k, col, em] = this.el.nets;
    const x = c.x;
    const Vk = V(x, k);
    const vraw = V(x, a) - Vk;
    const v = pnjlim(vraw, this.vd, this.vt, this.vcrit);
    if (Math.abs(v - vraw) > 1e-12) c.limited = true;
    this.vd = v;
    const [ex, dex] = sexp(v / this.vt);
    const Id = this.Is * (ex - 1);
    const gd = (this.Is / this.vt) * dex + c.gmin;
    stampNL(c, [a, k], [Id + c.gmin * v, -(Id + c.gmin * v)], [[gd, -gd], [-gd, gd]], [Vk + v, Vk]);
    const Vc = V(x, col);
    const Ve = V(x, em);
    const { Ice, dVce, dId } = this.out(Id, Vc - Ve);
    const dA = dId * gd;
    stampNL(c, [a, k, col, em], [0, 0, Ice, -Ice], [[0, 0, 0, 0], [0, 0, 0, 0], [dA, -dA, dVce, -dVce], [-dA, dA, -dVce, dVce]], [V(x, a), Vk, Vc, Ve]);
  }
  currents(x: Float64Array) {
    const [a, k, col, em] = this.el.nets;
    const [ex] = sexp((V(x, a) - V(x, k)) / this.vt);
    const Id = this.Is * (ex - 1);
    const { Ice } = this.out(Id, V(x, col) - V(x, em));
    return [Id, -Id, Ice, -Ice];
  }
  probe(x: Float64Array) {
    const [ex] = sexp((V(x, this.el.nets[0]) - V(x, this.el.nets[1])) / this.vt);
    return { iled: this.Is * (ex - 1) };
  }
}

/** Fırçalı DC motor: sargı R+L ile seri, hıza bağlı zıt-EMK (E = Ke·ω). ω atalet/sürtünmeyle her adımda güncellenir (Kt = Ke, SI). */
class DCMotor extends Device {
  R: number;
  L: number;
  Ke: number;
  J: number;
  B: number;
  w = 0;
  i1 = 0;
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 1;
    this.R = Math.max(1e-3, num(el.params.R, 1.5));
    this.L = Math.max(1e-9, num(el.params.L, 0.5e-3));
    this.Ke = num(el.params.Ke, 0.015);
    this.J = Math.max(1e-9, num(el.params.J, 2e-5));
    this.B = Math.max(1e-12, num(el.params.B, 5e-5));
  }
  stamp(c: Ctx) {
    const [a, b] = this.el.nets;
    const k = this.b0;
    addA(c, a - 1, k, 1);
    addA(c, b - 1, k, -1);
    addA(c, k, a - 1, 1);
    addA(c, k, b - 1, -1);
    const Ldt = c.mode === 'tran' ? this.L / c.dt : 0;
    addA(c, k, k, -(this.R + Ldt));
    c.b[k] += this.Ke * this.w - Ldt * this.i1;
  }
  currents(x: Float64Array) {
    const i = x[this.b0];
    return [i, -i];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    const i = x[this.b0];
    if (c.mode === 'tran') this.w += (c.dt * (this.Ke * i - this.B * this.w)) / this.J;
    this.i1 = i;
  }
  initHistory(x: Float64Array) {
    this.i1 = x[this.b0];
  }
  probe() {
    return { w: this.w, rpm: (this.w * 60) / (2 * Math.PI) };
  }
}

// ── Lojik (5 V CMOS benzeri, davranışsal) ──
const VDD = 5;
const VTH = 2.5;
const LW = 0.12;
const GLEAK = 1e-9;
const sig = (v: number) => 1 / (1 + Math.exp(-(v - VTH) / LW));

/** Lojik giriş: boşta kalırsa ~2,5 V'a (belirsiz) süzülür — pull-up/pull-down dersinin özü */
function stampLogicInput(c: Ctx, net: number) {
  addG(c, net, 0, GLEAK);
  addIsrc(c, net, 0, -GLEAK * VTH);
}

class Gate extends Device {
  Gout = 1 / 50;
  Cout = 20e-12;
  v1 = 0;
  constructor(el: CompiledElement, public kind: string) {
    super(el);
    this.nonlinear = true;
  }
  fn(s: number[]): [number, number[]] {
    const [a, b = 0] = s;
    switch (this.kind) {
      case 'not':
        return [1 - a, [-1]];
      case 'and':
        return [a * b, [b, a]];
      case 'nand':
        return [1 - a * b, [-b, -a]];
      case 'or':
        return [a + b - a * b, [1 - b, 1 - a]];
      case 'nor':
        return [(1 - a) * (1 - b), [-(1 - b), -(1 - a)]];
      case 'xor':
        return [a + b - 2 * a * b, [1 - 2 * b, 1 - 2 * a]];
      default:
        return [0, [0, 0]];
    }
  }
  stamp(c: Ctx) {
    const nets = this.el.nets;
    const ins = nets.slice(0, -1);
    const out = nets[nets.length - 1];
    const x = c.x;
    for (const n of ins) stampLogicInput(c, n);
    const vin = ins.map((n) => V(x, n));
    const s = vin.map(sig);
    const ds = s.map((v) => v * (1 - v) / LW);
    const [f, df] = this.fn(s);
    const vt = VDD * f;
    const vo = V(x, out);
    const Io = this.Gout * (vo - vt);
    const Jrow = [...ds.map((d, k) => -this.Gout * VDD * df[k] * d), this.Gout];
    const zero = Jrow.map(() => 0);
    stampNL(c, [...ins, out], [...ins.map(() => 0), Io], [...ins.map(() => zero), Jrow], [...vin, vo]);
    if (c.mode === 'tran') {
      const geq = this.Cout / c.dt;
      addG(c, out, 0, geq);
      addIsrc(c, out, 0, -geq * this.v1);
    }
  }
  currents(x: Float64Array) {
    const nets = this.el.nets;
    const out = nets[nets.length - 1];
    const s = nets.slice(0, -1).map((n) => sig(V(x, n)));
    const [f] = this.fn(s);
    return [...nets.slice(0, -1).map((n) => GLEAK * (V(x, n) - VTH)), this.Gout * (V(x, out) - VDD * f)];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    this.v1 = V(x, this.el.nets[this.el.nets.length - 1]);
  }
  initHistory(x: Float64Array) {
    this.v1 = V(x, this.el.nets[this.el.nets.length - 1]);
  }
  probe(x: Float64Array) {
    const out = V(x, this.el.nets[this.el.nets.length - 1]);
    return { out, level: out > 3.5 ? 1 : out < 1.5 ? 0 : 0.5 };
  }
}

/** D flip-flop (yükselen kenar tetiklemeli). Durum her kabul edilen adımda güncellenir. */
class DFlipFlop extends Device {
  q = 0;
  prevClk = 0;
  Gout = 1 / 50;
  constructor(el: CompiledElement) {
    super(el);
  }
  stamp(c: Ctx) {
    const [d, clk, q, qn] = this.el.nets;
    stampLogicInput(c, d);
    stampLogicInput(c, clk);
    addG(c, q, 0, this.Gout);
    addIsrc(c, q, 0, -this.Gout * VDD * this.q);
    addG(c, qn, 0, this.Gout);
    addIsrc(c, qn, 0, -this.Gout * VDD * (1 - this.q));
  }
  currents(x: Float64Array) {
    const [d, clk, q, qn] = this.el.nets;
    return [GLEAK * (V(x, d) - VTH), GLEAK * (V(x, clk) - VTH), this.Gout * (V(x, q) - VDD * this.q), this.Gout * (V(x, qn) - VDD * (1 - this.q))];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    const [d, clk] = this.el.nets;
    const vc = V(x, clk);
    if (this.prevClk < VTH && vc >= VTH) this.q = V(x, d) > VTH ? 1 : 0;
    this.prevClk = vc;
  }
  initHistory(x: Float64Array) {
    this.prevClk = V(x, this.el.nets[1]);
  }
  probe() {
    return { q: this.q };
  }
}

/** NE555 zamanlayıcı (davranışsal): 3×5 kΩ bölücü, iki karşılaştırıcı, SR mandal, deşarj transistörü, çıkış katı */
class Timer555 extends Device {
  q = 0;
  Gout = 1 / 10;
  constructor(el: CompiledElement) {
    super(el);
    this.branches = 1; // iç düğüm: 1/3 Vcc
  }
  private M() {
    return this.b0 + 1;
  }
  stamp(c: Ctx) {
    const [vcc, gnd, trig, thr, ctrl, reset, dis, out] = this.el.nets;
    const M = this.M();
    const g5k = 1 / 5000;
    addG(c, vcc, ctrl, g5k);
    addG(c, ctrl, M, g5k);
    addG(c, M, gnd, g5k);
    for (const n of [trig, thr, reset]) addG(c, n, gnd, 1e-9);
    if (this.q) {
      addG(c, out, vcc, this.Gout);
      addIsrc(c, out, vcc, 1.5 * this.Gout);
      addG(c, dis, gnd, 1e-9);
    } else {
      addG(c, out, gnd, this.Gout);
      addG(c, dis, gnd, 1 / 10);
    }
  }
  currents(x: Float64Array) {
    const [vcc, gnd, trig, thr, ctrl, reset, dis, out] = this.el.nets;
    const v = (n: number) => V(x, n);
    const vm = x[this.b0];
    const g5k = 1 / 5000;
    const iTop = (v(vcc) - v(ctrl)) * g5k;
    const iBot = (vm - v(gnd)) * g5k;
    const iOut = this.q ? this.Gout * (v(out) - v(vcc)) + 1.5 * this.Gout : this.Gout * (v(out) - v(gnd));
    const iDis = (v(dis) - v(gnd)) * (this.q ? 1e-9 : 0.1);
    const iVcc = iTop + (this.q ? -iOut : 0);
    const iTrig = (v(trig) - v(gnd)) * 1e-9;
    const iThr = (v(thr) - v(gnd)) * 1e-9;
    const iRst = (v(reset) - v(gnd)) * 1e-9;
    const iCtrl = -iTop + (v(ctrl) - vm) * g5k;
    const iGnd = -(iVcc + iTrig + iThr + iCtrl + iRst + iDis + iOut);
    void iBot;
    return [iVcc, iGnd, iTrig, iThr, iCtrl, iRst, iDis, iOut];
  }
  accept(x: Float64Array, c: Ctx) {
    super.accept(x, c);
    const [, gnd, trig, thr, ctrl, reset] = this.el.nets;
    const vg = V(x, gnd);
    if (V(x, reset) - vg < 0.7) this.q = 0;
    else if (V(x, trig) < x[this.b0]) this.q = 1;
    else if (V(x, thr) > V(x, ctrl)) this.q = 0;
  }
  probe() {
    return { q: this.q };
  }
}

function makeDevice(el: CompiledElement): Device | null {
  const p = el.params;
  switch (el.type) {
    case 'resistor':
      return new Resistor(el);
    case 'switch':
      return new Switch(el);
    case 'capacitor':
      return new Capacitor(el);
    case 'inductor':
      return new Inductor(el);
    case 'vdc':
      return new VSource(el, () => num(p.V, 5));
    case 'vac':
      return new VSource(el, (t) => waveValue(p, t));
    case 'idc':
      return new ISource(el);
    case 'xfmr':
      return new Transformer(el);
    case 'xfmr_ct':
      return new TransformerCT(el);
    case 'diode':
      return new Diode(el, num(p.Is, 1e-14), num(p.N, 1));
    case 'zener':
      return new Diode(el, num(p.Is, 1e-14), num(p.N, 1), Math.max(0.5, num(p.Vz, 5.1)));
    case 'led': {
      const col = LED_COLORS[String(p.color)] ?? LED_COLORS.red;
      const N = 2;
      const Is = 0.01 / Math.exp(col.vf / (N * VT));
      return new Diode(el, Is, N);
    }
    case 'npn':
      return new BJT(el, false);
    case 'pnp':
      return new BJT(el, true);
    case 'nmos':
      return new MOSFET(el, false);
    case 'pmos':
      return new MOSFET(el, true);
    case 'jfet':
      return new JFET(el);
    case 'multimeter':
      return String(p.mode).endsWith('A') ? new Ammeter(el) : new Passive(el);
    case 'scope':
    case 'logicprobe':
      return new Passive(el);
    case 'lamp':
    case 'ldr':
    case 'ntc':
    case 'ptc':
    case 'buzzer':
      return new ResistorLike(el);
    case 'varistor':
      return new Varistor(el);
    case 'fuse':
      return new Fuse(el);
    case 'button':
      return new Button(el);
    case 'pot':
      return new Pot(el);
    case 'battery':
      return new VSource({ ...el, params: { ...el.params, Rs: num(p.Rint, 0) } }, () => num(p.V, 9));
    case 'clock':
      return new VSource(el, (t) => {
        const f = Math.max(1e-6, num(p.freq, 1000));
        let fr = (t * f) % 1;
        if (fr < 0) fr += 1;
        return fr < num(p.duty, 0.5) ? num(p.V, 5) : 0;
      });
    case 'logicin':
      return new LogicSource(el, p.on ? num(p.V, 5) : 0);
    case 'vcvs':
      return new VCVS(el);
    case 'vccs':
      return new VCCS(el);
    case 'cccs':
      return new CCCS(el);
    case 'ccvs':
      return new CCVS(el);
    case 'opamp':
      return new OpAmp(el);
    case 'reg78':
      return new Regulator(el);
    case 'tl431':
      return new TL431(el);
    case 'opto':
      return new OptoCoupler(el);
    case 'motor':
      return new DCMotor(el);
    case 'and':
    case 'or':
    case 'not':
    case 'nand':
    case 'nor':
    case 'xor':
      return new Gate(el, el.type);
    case 'dff':
      return new DFlipFlop(el);
    case 'timer555':
      return new Timer555(el);
    default:
      return null;
  }
}

// ───────────────────────────── Simülatör ─────────────────────────────

export type SimErrorKind = 'singular' | 'convergence' | 'numeric';

export class SimError extends Error {
  constructor(public kind: SimErrorKind, message: string) {
    super(message);
  }
}

export class Simulator {
  devices: Device[] = [];
  byId = new Map<string, Device>();
  n: number;
  nv: number;
  x: Float64Array;
  private xSave: Float64Array;
  private xNew: Float64Array;
  private A: Float64Array;
  private b: Float64Array;
  private anyNonlinear = false;
  t = 0;
  private lastDt = -1;
  private histDC = false;
  lastIterations = 0;
  /** Sözde-geçici (pseudo-transient) DC yardımı: her düğümü önceki çözüme bağlayan iletkenlik */
  private ptG = 0;
  private ptX: Float64Array | null = null;

  constructor(public circ: CompiledCircuit) {
    this.nv = circ.netCount - 1;
    let idx = this.nv;
    for (const el of circ.elements) {
      const d = makeDevice(el);
      if (!d) continue;
      if (d.branches > 0) {
        d.b0 = idx;
        idx += d.branches;
      }
      if (d.nonlinear) this.anyNonlinear = true;
      this.devices.push(d);
      this.byId.set(el.id, d);
    }
    this.n = idx;
    this.x = new Float64Array(this.n);
    this.xSave = new Float64Array(this.n);
    this.xNew = new Float64Array(this.n);
    this.A = new Float64Array(this.n * this.n);
    this.b = new Float64Array(this.n);
  }

  netV(net: number): number {
    return net === 0 ? 0 : this.x[net - 1];
  }

  private ctx(mode: 'dc' | 'tran', dt: number, order: 1 | 2, srcScale = 1, gmin = 1e-12): Ctx {
    return { A: this.A, b: this.b, n: this.n, x: this.x, t: this.t + (mode === 'tran' ? dt : 0), dt, mode, order, srcScale, gmin, limited: false };
  }

  private newton(c: Ctx, maxIter: number): boolean {
    const n = this.n;
    if (n === 0) return true;
    for (let it = 0; it < maxIter; it++) {
      this.A.fill(0);
      this.b.fill(0);
      c.limited = false;
      c.x = this.x;
      for (const d of this.devices) d.stamp(c);
      for (let i = 0; i < this.nv; i++) this.A[i * n + i] += GMIN_NODE;
      if (this.ptG > 0 && this.ptX) {
        for (let i = 0; i < this.nv; i++) {
          this.A[i * n + i] += this.ptG;
          this.b[i] += this.ptG * this.ptX[i];
        }
      }
      try {
        solveDense(this.A, this.b, n, this.xNew);
      } catch (e) {
        if (e instanceof SingularMatrixError) {
          throw new SimError('singular', this.describeSingular(e.row));
        }
        throw e;
      }
      let conv = !c.limited;
      for (let i = 0; i < n; i++) {
        const xn = this.xNew[i];
        if (!isFinite(xn) || Math.abs(xn) > 1e9) {
          throw new SimError('numeric', 'Çözüm sayısal olarak patladı (çok büyük gerilim/akım). Kısa devre ya da kaynak döngüsü olabilir.');
        }
        const xo = this.x[i];
        const tol = (i < this.nv ? 1e-6 : 1e-9) + 1e-3 * Math.max(Math.abs(xn), Math.abs(xo));
        if (Math.abs(xn - xo) > tol) conv = false;
      }
      this.x.set(this.xNew);
      this.lastIterations = it + 1;
      if (!this.anyNonlinear) return true;
      if (conv && it > 0) return true;
    }
    return false;
  }

  private describeSingular(_row: number): string {
    return 'Devre matrisi tekil: paralel bağlı/kısa devre edilmiş gerilim kaynakları, kaynak–bobin döngüsü ya da ampermetre kademesinde paralel bağlanmış multimetre olabilir.';
  }

  /** DC çalışma noktası (kapasitörler açık devre, bobinler kısa devre) */
  dcOperatingPoint(): void {
    this.t = 0;
    this.x.fill(0);
    let ok = this.newton(this.ctx('dc', 0, 1), 200);
    if (!ok) {
      // Gmin adımlama
      this.x.fill(0);
      ok = true;
      for (let g = 1e-2; g >= 1e-12; g /= 10) {
        if (!this.newton(this.ctx('dc', 0, 1, 1, g), 200)) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) {
      // Kaynak adımlama
      this.x.fill(0);
      ok = true;
      for (let s = 0.05; s <= 1.0001; s += 0.05) {
        if (!this.newton(this.ctx('dc', 0, 1, Math.min(1, s)), 200)) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) ok = this.pseudoTransient();
    if (!ok) throw new SimError('convergence', 'DC çalışma noktası bulunamadı (Newton-Raphson yakınsamadı).');
    const c = this.ctx('dc', 0, 1);
    for (const d of this.devices) {
      d.initHistory(this.x);
      d.accept(this.x, c);
    }
    // accept() kapasitör geçmişini kaydırdı; DC'de geçmiş sabit kabul edilir
    for (const d of this.devices) d.initHistory(this.x);
    this.histDC = true;
    this.lastDt = -1;
  }

  /**
   * Sözde-geçici süreklilik: her düğüme önceki çözüme çeken bir iletkenlik eklenir ve bu
   * iletkenlik yakınsadıkça azaltılır. Çift kararlı (mandal) ve keskin geçişli devrelerde
   * Gmin/kaynak adımlamanın bulamadığı çalışma noktasını bulur.
   */
  private pseudoTransient(): boolean {
    this.x.fill(0);
    return this.relax(this.ctx('dc', 0, 1), 1e-2) && this.newton(this.ctx('dc', 0, 1), 200);
  }

  /**
   * Her düğüme bir önceki iterasyon çözümüne bağlayan sahte iletkenlik (g) ekleyip g'yi
   * azaltarak denklemleri sağlayan çözüme "sürünerek" ulaş. Geri besleme ile ani sıçrama
   * yapan devrelerde (mandal, multivibratör) Newton'un uzaktaki dalı bulmasını sağlar.
   */
  private relax(c: Ctx, g0: number): boolean {
    const xp = new Float64Array(this.n);
    let g = g0;
    try {
      for (let k = 0; k < 800; k++) {
        xp.set(this.x);
        this.ptX = xp;
        this.ptG = g;
        if (!this.newton(c, 100)) {
          this.x.set(xp);
          g *= 8;
          if (g > 1e5) return false;
          continue;
        }
        let dmax = 0;
        for (let i = 0; i < this.nv; i++) dmax = Math.max(dmax, Math.abs(this.x[i] - xp[i]));
        if (dmax < 1e-3) g /= 4;
        else if (dmax < 0.5) g /= 1.5;
        if (g < 1e-11) return true;
      }
      return false;
    } finally {
      this.ptG = 0;
      this.ptX = null;
    }
  }

  /** Bir geçici analiz adımı */
  step(dt: number): void {
    const order: 1 | 2 = this.histDC || this.lastDt === dt ? 2 : 1;
    this.xSave.set(this.x);
    const c = this.ctx('tran', dt, order);
    if (this.newton(c, 60)) {
      this.acceptStep(c);
      return;
    }
    // Yakınsamadı: adımı alt adımlara böl (Geri-Euler), gerekirse yinelemeli olarak küçült
    this.x.set(this.xSave);
    this.subStep(dt, 0);
  }

  private subStep(h: number, depth: number) {
    const k = 8;
    const hs = h / k;
    const save = new Float64Array(this.n);
    for (let s = 0; s < k; s++) {
      save.set(this.x);
      const cs = this.ctx('tran', hs, 1);
      if (this.newton(cs, 120)) {
        this.acceptStep(cs);
        continue;
      }
      this.x.set(save);
      if (depth < 1) {
        this.subStep(hs, depth + 1);
        continue;
      }
      // Son çare: sözde-geçici gevşetme ile sıçramayı çöz
      if (this.relax(cs, 1e-1) && this.newton(cs, 200)) {
        this.acceptStep(cs);
        continue;
      }
      throw new SimError('convergence', `t = ${(this.t * 1e3).toFixed(3)} ms anında Newton-Raphson yakınsamadı.`);
    }
  }

  private acceptStep(c: Ctx) {
    for (const d of this.devices) d.accept(this.x, c);
    this.t += c.dt;
    this.lastDt = c.dt;
    this.histDC = false;
  }

  /** Parametre değişikliğinde (topoloji aynı) eski simülatörün durumunu devral → geçici olay kesintisiz sürer */
  adopt(old: Simulator): boolean {
    if (old.n !== this.n) return false;
    this.x.set(old.x);
    this.t = old.t;
    this.lastDt = old.lastDt;
    this.histDC = old.histDC;
    const keys = ['v1', 'v2', 'i1', 'i2', 'vd', 'vbe', 'vbc', 'vgs', 'vds', 'id', 'q', 'prevClk'];
    for (const d of this.devices) {
      const od = old.byId.get(d.el.id) as unknown as Record<string, unknown> | undefined;
      if (!od || od.constructor !== d.constructor) continue;
      for (const k of keys) if (k in od) (d as unknown as Record<string, unknown>)[k] = od[k];
      d.cur = (od.cur as number[]).slice();
    }
    return true;
  }

  /** Eleman uç akımları (elemana giren yön pozitif) */
  currentsOf(id: string): number[] | undefined {
    return this.byId.get(id)?.cur;
  }

  probeOf(id: string): Record<string, number> {
    return this.byId.get(id)?.probe(this.x) ?? {};
  }

  /** Ampermetre / kaynak dal akımı */
  branchCurrent(id: string): number {
    const d = this.byId.get(id);
    if (!d || d.b0 < 0) return 0;
    return this.x[d.b0];
  }
}
