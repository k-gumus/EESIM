// IEEESIM simülasyon çekirdeği
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
    this.g = el.params.closed ? 1e3 : 1e-9;
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
    const v = V(x, this.el.nets[0]) - V(x, this.el.nets[1]);
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

class Passive extends Device {
  stamp() {}
  currents() {
    return this.el.nets.map(() => 0);
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
    case 'multimeter':
      return String(p.mode).endsWith('A') ? new Ammeter(el) : new Passive(el);
    case 'scope':
      return new Passive(el);
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

  /** Bir geçici analiz adımı */
  step(dt: number): void {
    const order: 1 | 2 = this.histDC || this.lastDt === dt ? 2 : 1;
    this.xSave.set(this.x);
    const c = this.ctx('tran', dt, order);
    if (this.newton(c, 60)) {
      this.acceptStep(c);
      return;
    }
    // Yakınsamadı: adımı 8 alt adıma böl (Geri-Euler)
    this.x.set(this.xSave);
    const h = dt / 8;
    for (let s = 0; s < 8; s++) {
      const cs = this.ctx('tran', h, 1);
      if (!this.newton(cs, 150)) {
        throw new SimError('convergence', `t = ${(this.t * 1e3).toFixed(3)} ms anında Newton-Raphson yakınsamadı.`);
      }
      this.acceptStep(cs);
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
    const keys = ['v1', 'v2', 'i1', 'i2', 'vd', 'vbe', 'vbc', 'vgs', 'vds', 'id'];
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
