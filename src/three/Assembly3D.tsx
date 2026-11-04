// Simulink tarzı 3D montaj görünümü: netlist'ten otomatik oluşturulan breadboard + masa üstü cihazlar
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildAssembly, rowZ, type Assembly, type Hole, type PlacedInstrument, type PlacedPart } from './layout';
import { runner, useSim } from '../sim/runner';
import { useCircuit } from '../store/circuitStore';
import { formatMeter, formatSI } from '../circuit/format';
import { LED_COLORS } from '../circuit/library';

const BOARD_Y = 0;
type V3 = [number, number, number];

function holePos(h: Hole, cols: number): V3 {
  return [h.col - cols / 2, BOARD_Y, rowZ(h.row)];
}

// ───────────── Yardımcı geometriler ─────────────
const UP = new THREE.Vector3(0, 1, 0);
function Rod({ a, b, r = 0.09, color = '#c9ccd1', metal = 0.9 }: { a: V3; b: V3; r?: number; color?: string; metal?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len };
  }, [a[0], a[1], a[2], b[0], b[1], b[2]]);
  if (len < 1e-4) return null;
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={0.35} />
    </mesh>
  );
}

function Polyline({ pts, r, color }: { pts: V3[]; r?: number; color?: string }) {
  return (
    <>
      {pts.slice(1).map((p, i) => (
        <Rod key={i} a={pts[i]} b={p} r={r} color={color} />
      ))}
    </>
  );
}

function Cable({ pts, r = 0.18, color }: { pts: V3[]; r?: number; color: string }) {
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    return new THREE.TubeGeometry(curve, 64, r, 8, false);
  }, [JSON.stringify(pts), r]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} castShadow>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

// ───────────── Breadboard ─────────────
function Breadboard({ cols }: { cols: number }) {
  const holesRef = useRef<THREE.InstancedMesh>(null);
  const holes = useMemo(() => {
    const out: V3[] = [];
    for (let c = 1; c < cols; c++) {
      for (let r = 0; r < 10; r++) out.push([c - cols / 2, BOARD_Y + 0.01, rowZ(r)]);
      if (c % 6 !== 0) for (const r of [-2, -1, 10, 11]) out.push([c - cols / 2, BOARD_Y + 0.01, rowZ(r)]);
    }
    return out;
  }, [cols]);
  useEffect(() => {
    const m = holesRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    holes.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [holes]);
  const W = cols + 1;
  return (
    <group>
      <mesh position={[0, BOARD_Y - 0.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[W, 1.2, 23]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.8} />
      </mesh>
      {/* orta kanal */}
      <mesh position={[0, BOARD_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.4, 1.2]} />
        <meshStandardMaterial color="#d3d7dc" />
      </mesh>
      {/* ray çizgileri: kırmızı (+), mavi (−) */}
      {[
        [-10.8, '#1e63d6'],
        [-8.2, '#d62828'],
        [8.2, '#d62828'],
        [10.8, '#1e63d6'],
      ].map(([z, c]) => (
        <mesh key={String(z)} position={[0, BOARD_Y + 0.003, z as number]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 2, 0.12]} />
          <meshBasicMaterial color={c as string} />
        </mesh>
      ))}
      <instancedMesh ref={holesRef} args={[undefined, undefined, holes.length]}>
        <boxGeometry args={[0.38, 0.02, 0.38]} />
        <meshBasicMaterial color="#3a3f47" />
      </instancedMesh>
    </group>
  );
}

// ───────────── Direnç renk kodu ─────────────
const BAND = ['#111111', '#6b3a1e', '#d32f2f', '#f57c00', '#fbc02d', '#2e7d32', '#1565c0', '#6a1b9a', '#757575', '#fafafa'];
function resistorBands(R: number): string[] {
  if (!(R > 0)) return [BAND[0], BAND[0], BAND[0], '#c9a227'];
  let exp = Math.floor(Math.log10(R)) - 1;
  let sig = Math.round(R / Math.pow(10, exp));
  if (sig >= 100) {
    sig = Math.round(sig / 10);
    exp += 1;
  }
  const d1 = Math.floor(sig / 10);
  const d2 = sig % 10;
  const mult = exp < 0 ? (exp === -1 ? '#c9a227' : '#b0b0b0') : BAND[Math.min(9, exp)];
  return [BAND[d1], BAND[d2], mult, '#c9a227'];
}

// ───────────── Parçalar ─────────────
function useSelect(id: string) {
  const selected = useCircuit((s) => s.selectedId === id);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useCircuit.getState().select(id);
  };
  return { selected, onClick };
}

function AxialPart({ p, cols }: { p: PlacedPart; cols: number }) {
  const { selected, onClick } = useSelect(p.id);
  const A = holePos(p.legs[0].hole, cols);
  const B = holePos(p.legs[1].hole, cols);
  const isRes = p.type === 'resistor';
  const L = isRes ? 3.0 : p.type === 'inductor' ? 3.6 : p.type === 'zener' || p.params.model === '1N4148' ? 2.0 : 2.6;
  const D = isRes ? 1.15 : p.type === 'inductor' ? 1.5 : p.type === 'zener' || p.params.model === '1N4148' ? 0.9 : 1.25;
  const dx = B[0] - A[0];
  const dz = B[2] - A[2];
  const dist = Math.hypot(dx, dz);
  const lying = dist >= L + 0.8;
  const h = 1.2;
  let body: JSX.Element;
  let legs: V3[][];
  const bodyColor = isRes
    ? '#d9c08c'
    : p.type === 'inductor'
      ? '#2e7d32'
      : p.type === 'zener' || p.params.model === '1N4148'
        ? '#e0803a'
        : '#1c1c1c';
  const glass = !isRes && (p.type === 'zener' || p.params.model === '1N4148');
  const bands = isRes ? resistorBands(Number(p.params.R)) : [];
  const ang = Math.atan2(dz, dx);
  if (lying) {
    const M: V3 = [(A[0] + B[0]) / 2, h, (A[2] + B[2]) / 2];
    const ux = dx / dist;
    const uz = dz / dist;
    const e1: V3 = [M[0] - (ux * L) / 2, h, M[2] - (uz * L) / 2];
    const e2: V3 = [M[0] + (ux * L) / 2, h, M[2] + (uz * L) / 2];
    legs = [
      [A, [A[0], h, A[2]], e1],
      [B, [B[0], h, B[2]], e2],
    ];
    body = (
      <group position={M} rotation={[0, -ang, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[D / 2, D / 2, L, 20]} />
          <meshStandardMaterial color={bodyColor} roughness={glass ? 0.15 : 0.6} transparent={glass} opacity={glass ? 0.85 : 1} />
        </mesh>
        {isRes &&
          bands.map((c, i) => (
            <mesh key={i} position={[-L / 2 + 0.55 + i * (i === 3 ? 0.62 : 0.5), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[D / 2 + 0.02, D / 2 + 0.02, 0.24, 20]} />
              <meshStandardMaterial color={c} roughness={0.5} />
            </mesh>
          ))}
        {!isRes && p.type !== 'inductor' && (
          // katot bandı: legs[1] = 'k' ise +x ucunda
          <mesh position={[(p.legs[1].pin === 'k' ? 1 : -1) * (L / 2 - 0.3), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[D / 2 + 0.02, D / 2 + 0.02, 0.28, 20]} />
            <meshStandardMaterial color={glass ? '#111' : '#cfd3d6'} metalness={glass ? 0 : 0.6} roughness={0.4} />
          </mesh>
        )}
      </group>
    );
  } else {
    // dik (saç tokası) montaj: gövde A deliği üzerinde dikey
    const top = 1.0 + L + 0.5;
    legs = [
      [A, [A[0], 1.0, A[2]]],
      [B, [B[0], top, B[2]], [A[0], top, A[2]], [A[0], 1.0 + L, A[2]]],
    ];
    body = (
      <group position={[A[0], 1.0 + L / 2, A[2]]}>
        <mesh castShadow>
          <cylinderGeometry args={[D / 2, D / 2, L, 20]} />
          <meshStandardMaterial color={bodyColor} roughness={glass ? 0.15 : 0.6} transparent={glass} opacity={glass ? 0.85 : 1} />
        </mesh>
        {isRes &&
          bands.map((c, i) => (
            <mesh key={i} position={[0, -L / 2 + 0.55 + i * (i === 3 ? 0.62 : 0.5), 0]}>
              <cylinderGeometry args={[D / 2 + 0.02, D / 2 + 0.02, 0.24, 20]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
        {!isRes && p.type !== 'inductor' && (
          <mesh position={[0, (p.legs[1].pin === 'k' ? 1 : -1) * (L / 2 - 0.3), 0]}>
            <cylinderGeometry args={[D / 2 + 0.02, D / 2 + 0.02, 0.28, 20]} />
            <meshStandardMaterial color={glass ? '#111' : '#cfd3d6'} metalness={0.5} />
          </mesh>
        )}
      </group>
    );
  }
  return (
    <group onClick={onClick}>
      {legs.map((l, i) => (
        <Polyline key={i} pts={l} r={0.08} />
      ))}
      {body}
      {selected && <SelRing at={[(A[0] + B[0]) / 2, 0.05, (A[2] + B[2]) / 2]} r={Math.max(1.6, dist / 2 + 0.6)} />}
      <PartLabel at={[(A[0] + B[0]) / 2, lying ? 2.6 : L + 2.4, (A[2] + B[2]) / 2]} name={p.name} />
    </group>
  );
}

function SelRing({ at, r }: { at: V3; r: number }) {
  return (
    <mesh position={at} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - 0.15, r, 48]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
    </mesh>
  );
}

function PartLabel({ at, name }: { at: V3; name: string }) {
  return (
    <Html position={at} center distanceFactor={42} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="lbl3d">{name}</div>
    </Html>
  );
}

function CapPart({ p, cols }: { p: PlacedPart; cols: number }) {
  const { selected, onClick } = useSelect(p.id);
  const A = holePos(p.legs[0].hole, cols);
  const B = holePos(p.legs[1].hole, cols);
  const C = Number(p.params.C) || 1e-6;
  const electro = C >= 1e-7;
  const M: V3 = [(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2];
  const r = electro ? Math.min(2.2, 0.8 + 0.25 * Math.log10(C / 1e-7 + 1)) : 0.9;
  const hgt = electro ? Math.min(6, 2.4 + 0.5 * Math.log10(C / 1e-7 + 1)) : 0.4;
  const base = 1.0;
  const off = Math.min(0.5, r * 0.5);
  const ang = Math.atan2(B[2] - A[2], B[0] - A[0]);
  const ex = Math.cos(ang) * off;
  const ez = Math.sin(ang) * off;
  const legs: V3[][] = [
    [A, [A[0], 0.4, A[2]], [M[0] - ex, base, M[2] - ez]],
    [B, [B[0], 0.4, B[2]], [M[0] + ex, base, M[2] + ez]],
  ];
  return (
    <group onClick={onClick}>
      {legs.map((l, i) => (
        <Polyline key={i} pts={l} r={0.07} />
      ))}
      {electro ? (
        <group position={[M[0], base + hgt / 2, M[2]]}>
          <mesh castShadow>
            <cylinderGeometry args={[r, r, hgt, 28]} />
            <meshStandardMaterial color="#1d3f8f" roughness={0.45} />
          </mesh>
          <mesh position={[0, hgt / 2 + 0.01, 0]}>
            <cylinderGeometry args={[r * 0.96, r * 0.96, 0.03, 28]} />
            <meshStandardMaterial color="#b9c0c8" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* (−) şeridi */}
          <mesh position={[Math.cos(ang + Math.PI) * r * 0.98, 0, Math.sin(ang + Math.PI) * r * 0.98]} rotation={[0, -ang, 0]}>
            <boxGeometry args={[0.08, hgt * 0.96, r * 0.7]} />
            <meshStandardMaterial color="#d8dde6" />
          </mesh>
        </group>
      ) : (
        <mesh position={[M[0], base + 0.9, M[2]]} rotation={[Math.PI / 2, 0, -ang + Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.4, 24]} />
          <meshStandardMaterial color="#e3a018" roughness={0.6} />
        </mesh>
      )}
      {selected && <SelRing at={[M[0], 0.05, M[2]]} r={r + 0.8} />}
      <PartLabel at={[M[0], base + (electro ? hgt : 1.8) + 1.0, M[2]]} name={p.name} />
    </group>
  );
}

function LedPart({ p, cols }: { p: PlacedPart; cols: number }) {
  const { selected, onClick } = useSelect(p.id);
  const A = holePos(p.legs[0].hole, cols);
  const B = holePos(p.legs[1].hole, cols);
  const M: V3 = [(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2];
  const col = (LED_COLORS[String(p.params.color)] ?? LED_COLORS.red).rgb;
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const st = useSim.getState();
    const live = st.comp[p.id];
    const active = st.status === 'running' || st.status === 'paused';
    const b = active && live && !live.probe.burnt ? Math.min(1.4, live.probe.brightness ?? 0) : 0;
    if (mat.current) {
      mat.current.emissiveIntensity = 0.05 + b * 3.2;
      mat.current.color.set(live?.probe.burnt && active ? '#3a3a3a' : col);
    }
    if (light.current) light.current.intensity = b * 30;
  });
  const base = 1.4;
  return (
    <group onClick={onClick}>
      <Polyline pts={[A, [A[0], 0.6, A[2]], [M[0] - 0.3, base, M[2]]]} r={0.07} />
      <Polyline pts={[B, [B[0], 0.6, B[2]], [M[0] + 0.3, base, M[2]]]} r={0.07} />
      <group position={[M[0], base, M[2]]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 0.2, 28]} />
          <meshStandardMaterial ref={undefined} color={col} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <cylinderGeometry args={[0.98, 0.98, 1.8, 28]} />
          <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={0.05} transparent opacity={0.88} roughness={0.15} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <sphereGeometry args={[0.98, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.4} transparent opacity={0.85} roughness={0.1} />
        </mesh>
        <pointLight ref={light} position={[0, 2.4, 0]} color={col} intensity={0} distance={18} decay={2} />
      </group>
      {selected && <SelRing at={[M[0], 0.05, M[2]]} r={2} />}
      <PartLabel at={[M[0], 5.0, M[2]]} name={p.name} />
    </group>
  );
}

function SwitchPart({ p, cols }: { p: PlacedPart; cols: number }) {
  const { selected } = useSelect(p.id);
  const A = holePos(p.legs[0].hole, cols);
  const B = holePos(p.legs[1].hole, cols);
  const M: V3 = [(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2];
  const ang = Math.atan2(B[2] - A[2], B[0] - A[0]);
  const closed = !!p.params.closed;
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useCircuit.getState().select(p.id);
        useCircuit.getState().toggleSwitch(p.id);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <Polyline pts={[A, [A[0], 0.8, A[2]], [M[0] - Math.cos(ang) * 1.0, 0.8, M[2] - Math.sin(ang) * 1.0]]} r={0.08} />
      <Polyline pts={[B, [B[0], 0.8, B[2]], [M[0] + Math.cos(ang) * 1.0, 0.8, M[2] + Math.sin(ang) * 1.0]]} r={0.08} />
      <group position={[M[0], 1.3, M[2]]} rotation={[0, -ang, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 1.2, 1.6]} />
          <meshStandardMaterial color="#2b2f36" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[closed ? 0.55 : -0.55, 0.85, 0]}>
          <boxGeometry args={[0.8, 0.6, 0.7]} />
          <meshStandardMaterial color={closed ? '#22c55e' : '#e5e7eb'} />
        </mesh>
      </group>
      {selected && <SelRing at={[M[0], 0.05, M[2]]} r={2.2} />}
      <PartLabel at={[M[0], 3.6, M[2]]} name={`${p.name} · ${closed ? 'KAPALI' : 'AÇIK'} (tıkla)`} />
    </group>
  );
}

function To92Part({ p, cols }: { p: PlacedPart; cols: number }) {
  const { selected, onClick } = useSelect(p.id);
  const pts = p.legs.map((l) => holePos(l.hole, cols));
  const M: V3 = [pts.reduce((a, v) => a + v[0], 0) / 3, 0, pts.reduce((a, v) => a + v[2], 0) / 3];
  const base = 2.2;
  const part = p.type === 'npn' ? '2N3904' : p.type === 'pnp' ? '2N3906' : p.type === 'nmos' ? '2N7000' : 'BS250';
  return (
    <group onClick={onClick}>
      {pts.map((h, i) => (
        <Polyline key={i} pts={[h, [h[0], 0.8, h[2]], [M[0] + (i - 1) * 0.5, base, M[2]]]} r={0.07} />
      ))}
      <mesh position={[M[0], base + 1.1, M[2]]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 2.2, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#151515" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[M[0], base + 1.1, M[2]]} rotation={[0, 0, 0]}>
        <boxGeometry args={[2.5, 2.2, 0.02]} />
        <meshStandardMaterial color="#1d1d1d" />
      </mesh>
      {selected && <SelRing at={[M[0], 0.05, M[2]]} r={2.2} />}
      <Html position={[M[0], base + 3.6, M[2]]} center distanceFactor={42} style={{ pointerEvents: 'none' }}>
        <div className="lbl3d">
          {p.name} <small>{part}</small>
          <br />
          <small>{p.legs.map((l) => l.pin.toUpperCase()).join(' ')}</small>
        </div>
      </Html>
    </group>
  );
}

function PartView({ p, cols }: { p: PlacedPart; cols: number }) {
  switch (p.type) {
    case 'capacitor':
      return <CapPart p={p} cols={cols} />;
    case 'led':
      return <LedPart p={p} cols={cols} />;
    case 'switch':
      return <SwitchPart p={p} cols={cols} />;
    case 'npn':
    case 'pnp':
    case 'nmos':
    case 'pmos':
      return <To92Part p={p} cols={cols} />;
    default:
      return <AxialPart p={p} cols={cols} />;
  }
}

// ───────────── Cihazlar ─────────────
interface InstGeom {
  w: number;
  h: number;
  d: number;
  color: string;
  terms: Record<string, V3>;
}
function instGeom(inst: PlacedInstrument): InstGeom {
  switch (inst.kind) {
    case 'psu':
    case 'current-source':
      return { w: 12, h: 7, d: 9, color: '#2a2f38', terms: { p: [-1.5, 1.6, 4.6], n: [1.5, 1.6, 4.6] } };
    case 'siggen':
      return { w: 14, h: 6, d: 9, color: '#30343c', terms: { p: [3.5, 1.4, 4.6], n: [5.5, 1.4, 4.6] } };
    case 'transformer':
      return { w: 7, h: 6.5, d: 5, color: '#5b6068', terms: { p1: [-2.6, 5.2, 2.7], p2: [-2.6, 1.2, 2.7], s1: [2.6, 5.2, 2.7], s2: [2.6, 1.2, 2.7], ct: [2.6, 3.2, 2.7] } };
    case 'dmm':
      return { w: 8, h: 1.8, d: 13, color: '#f2b705', terms: { pos: [-1.6, 1.0, 5.4], com: [1.6, 1.0, 5.4] } };
    case 'scope':
      return { w: 18, h: 10, d: 9, color: '#262c38', terms: { ch1: [-3, 1.6, 4.6], ch2: [1, 1.6, 4.6] } };
  }
}

function InstrumentDisplay({ inst }: { inst: PlacedInstrument }) {
  const meter = useSim((s) => (inst.kind === 'dmm' ? s.meters[inst.id] : undefined));
  const status = useSim((s) => s.status);
  const p = inst.params;
  const on = status === 'running' || status === 'paused';
  let text = '';
  let sub = '';
  switch (inst.kind) {
    case 'psu':
      text = formatMeter(Number(p.V), 'V');
      sub = 'DC GÜÇ KAYNAĞI';
      break;
    case 'current-source':
      text = formatMeter(Number(p.I), 'A');
      sub = 'AKIM KAYNAĞI';
      break;
    case 'siggen':
      text = `${formatSI(Number(p.freq), 'Hz')}`;
      sub = `${formatSI(Number(p.amp), 'V')}p ${p.wave === 'square' ? '⊓' : p.wave === 'triangle' ? '⋀' : '∿'}`;
      break;
    case 'dmm':
      text = on && meter ? formatMeter(meter.value, meter.unit) : '- - - -';
      sub = String(p.mode);
      break;
    case 'transformer':
      text = `${p.n}:1`;
      sub = inst.type === 'xfmr_ct' ? 'ORTA UÇLU TRAFO' : 'TRAFO';
      break;
    default:
      return null;
  }
  return (
    <div className={`lcd3d ${inst.kind}`}>
      <div className="v">{text}</div>
      <div className="s">
        {inst.name} · {sub}
      </div>
    </div>
  );
}

/** Osiloskop ekranı: runner geçmişinden canlı çizilen CanvasTexture */
function ScopeScreen({ inst, w, h }: { inst: PlacedInstrument; w: number; h: number }) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  }, []);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.08) return;
    last.current = clock.elapsedTime;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#071019';
    ctx.fillRect(0, 0, 320, 200);
    ctx.strokeStyle = 'rgba(120,160,210,0.22)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32, 0);
      ctx.lineTo(i * 32, 200);
      ctx.stroke();
    }
    for (let j = 1; j < 8; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * 25);
      ctx.lineTo(320, j * 25);
      ctx.stroke();
    }
    const hist = runner.hist;
    const node = useCircuit.getState().nodes.find((n) => n.id === inst.id);
    if (hist && node && hist.count > 2) {
      const win = 10 * (Number(node.data.params.timeDiv) || 1e-3);
      const tEnd = hist.lastT();
      ['ch1', 'ch2'].forEach((pin, c) => {
        const net = runner.netIndexOfPin(inst.id, pin);
        if (net === undefined || !inst.leads.some((l) => l.pin === pin)) return;
        const vdiv = Number(node.data.params[c ? 'ch2Div' : 'ch1Div']) || 1;
        const pos = Number(node.data.params[c ? 'ch2Pos' : 'ch1Pos']) || 0;
        ctx.strokeStyle = c ? '#22d3ee' : '#f5d90a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i < hist.count; i++) {
          const k = hist.idx(i);
          const t = hist.t[k];
          if (t < tEnd - win) continue;
          const v = net ? hist.nets[net][k] : 0;
          const x = ((t - (tEnd - win)) / win) * 320;
          const y = 100 - (v / vdiv + pos) * 25;
          if (first) (ctx.moveTo(x, y), (first = false));
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
    }
    tex.needsUpdate = true;
  });
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[-2, h / 2 + 0.8, w / 2 + 0.01]}>
      <planeGeometry args={[11, 6.8]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function InstrumentView({ inst, cols, asm }: { inst: PlacedInstrument; cols: number; asm: Assembly }) {
  const { selected, onClick } = useSelect(inst.id);
  const g = instGeom(inst);
  const yaw = inst.kind === 'scope' ? Math.PI / 5 : inst.kind === 'dmm' ? -Math.PI / 7 : 0;
  const pos: V3 = [inst.x, -1.2, inst.z];
  const world = (local: V3): V3 => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return [pos[0] + local[0] * c + local[2] * s, pos[1] + local[1], pos[2] - local[0] * s + local[2] * c];
  };
  const instById = new Map(asm.instruments.map((i) => [i.id, i]));
  return (
    <group>
      <group position={pos} rotation={[0, yaw, 0]} onClick={onClick}>
        {inst.kind === 'transformer' ? (
          <group position={[0, g.h / 2, 0]}>
            <mesh castShadow>
              <boxGeometry args={[g.w, g.h, g.d]} />
              <meshStandardMaterial color="#4a4f57" metalness={0.6} roughness={0.4} />
            </mesh>
            {[-1.6, 1.6].map((x) => (
              <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[1.5, 1.5, g.d + 0.6, 24]} />
                <meshStandardMaterial color="#b8732e" metalness={0.7} roughness={0.35} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh position={[0, g.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[g.w, g.h, g.d]} />
            <meshStandardMaterial color={g.color} roughness={0.55} metalness={0.15} />
          </mesh>
        )}
        {inst.kind === 'dmm' && (
          <mesh position={[0, g.h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[g.w - 1, g.d - 1]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
        )}
        {inst.kind === 'scope' && <ScopeScreen inst={inst} w={g.d} h={g.h} />}
        {Object.entries(g.terms)
          .filter(([pin]) => inst.leads.some((l) => l.pin === pin) || inst.kind !== 'transformer' || pin !== 'ct' || inst.type === 'xfmr_ct')
          .map(([pin, p]) => (
            <mesh key={pin} position={p}>
              <cylinderGeometry args={[0.45, 0.45, 0.8, 16]} />
              <meshStandardMaterial
                color={pin === 'p' || pin === 'pos' ? '#d32f2f' : pin === 'ch1' ? '#f5d90a' : pin === 'ch2' ? '#22d3ee' : pin.startsWith('s') ? '#c0c4ca' : '#1b1b1b'}
                metalness={0.4}
              />
            </mesh>
          ))}
        <Html
          position={inst.kind === 'dmm' ? [0, g.h + 0.4, -2.5] : inst.kind === 'scope' ? [0, g.h + 1.6, 0] : [0, g.h + 1.4, 0]}
          center
          distanceFactor={44}
          zIndexRange={[30, 0]}
        >
          <InstrumentDisplay inst={inst} />
          {inst.kind === 'scope' && <div className="lbl3d">{inst.name} · Osiloskop</div>}
        </Html>
        {selected && <SelRing at={[0, 0.05, 0]} r={Math.max(g.w, g.d) / 2 + 1} />}
      </group>
      {/* Kablolar / problar */}
      {inst.leads.map((l) => {
        const start = world(g.terms[l.pin] ?? [0, 1, 0]);
        let end: V3;
        if ('col' in l.to) end = holePos(l.to, cols);
        else {
          const other = instById.get(l.to.instrument);
          if (!other) return null;
          const og = instGeom(other);
          const oy = other.kind === 'scope' ? Math.PI / 5 : other.kind === 'dmm' ? -Math.PI / 7 : 0;
          const lp = og.terms[l.to.pin] ?? [0, 1, 0];
          end = [other.x + lp[0] * Math.cos(oy) + lp[2] * Math.sin(oy), -1.2 + lp[1], other.z - lp[0] * Math.sin(oy) + lp[2] * Math.cos(oy)];
        }
        const mid: V3 = [(start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 4 + Math.hypot(end[0] - start[0], end[2] - start[2]) * 0.06, (start[2] + end[2]) / 2];
        const pts: V3[] = [start, [start[0], start[1], start[2] + 1.5], mid, [end[0], end[1] + 3.2, end[2]], [end[0], end[1] + 1.2, end[2]]];
        return (
          <group key={l.pin}>
            <Cable pts={pts} color={l.color} r={0.2} />
            {'col' in l.to && <Rod a={[end[0], end[1] + 1.25, end[2]]} b={end} r={0.12} color="#cfd3d8" />}
          </group>
        );
      })}
    </group>
  );
}

function JumperView({ a, b, color, cols }: { a: Hole; b: Hole; color: string; cols: number }) {
  const A = holePos(a, cols);
  const B = holePos(b, cols);
  const d = Math.hypot(B[0] - A[0], B[2] - A[2]);
  const lift = 0.5 + d * 0.12;
  const pts: V3[] = [A, [A[0], lift, A[2]], [(A[0] + B[0]) / 2, lift + 0.3, (A[2] + B[2]) / 2], [B[0], lift, B[2]], B];
  return <Cable pts={pts} color={color} r={0.14} />;
}

function NetTagView({ tag, cols }: { tag: Assembly['tags'][number]; cols: number }) {
  const v = useSim((s) => s.netV[tag.net]);
  const status = useSim((s) => s.status);
  const p = holePos(tag.hole, cols);
  return (
    <Html position={[p[0], 1.6, p[2] - 0.5]} center distanceFactor={42} zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag3d">
        {tag.name}
        {(status === 'running' || status === 'paused') && v !== undefined && <b>{formatSI(v, 'V')}</b>}
      </div>
    </Html>
  );
}

/** Montaj değiştiğinde kamerayı tüm sahneyi görecek şekilde konumlandır */
function CameraRig({ asm }: { asm: Assembly | null }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const size = useThree((s) => s.size);
  const key = asm ? `${asm.cols}|${asm.instruments.map((i) => i.id).join()}` : '';
  const wide = Math.round((size.width / Math.max(1, size.height)) * 4);
  useEffect(() => {
    if (!asm) return;
    let minX = -asm.cols / 2 - 1;
    let maxX = asm.cols / 2 + 1;
    let minZ = -12;
    let maxZ = 12;
    const wideView = size.width / Math.max(1, size.height) > 1.5;
    for (const i of asm.instruments) {
      // arka sıradaki cihazlar her zaman, yandakiler sadece geniş görünümde kadraja alınır
      if (Math.abs(i.z) < 20 && !wideView) continue;
      minX = Math.min(minX, i.x - 7);
      maxX = Math.max(maxX, i.x + 7);
      minZ = Math.min(minZ, i.z - 4);
      maxZ = Math.max(maxZ, i.z + 6);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const aspect = size.width / Math.max(1, size.height);
    const tanV = Math.tan(((camera.fov ?? 38) * Math.PI) / 360);
    const tanH = tanV * aspect;
    const elev = (52 * Math.PI) / 180;
    const halfW = ((maxX - minX) / 2) * 1.06;
    const halfD = ((maxZ - minZ) / 2) * Math.sin(elev) * 1.1;
    const d = Math.max(halfW / tanH, halfD / tanV) * 1.12 + 6;
    camera.position.set(cx, d * Math.sin(elev), cz + d * Math.cos(elev));
    camera.lookAt(cx, 0, cz);
    if (controls) {
      controls.target.set(cx, 0, cz);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, controls, wide]);
  return null;
}

export function Assembly3D() {
  const compiled = useSim((s) => s.compiled);
  const nodesSig = useCircuit((s) => s.version);
  const asm = useMemo(() => (compiled ? buildAssembly(compiled) : null), [compiled, nodesSig]);
  const cols = asm?.cols ?? 64;
  return (
    <div className="three-wrap">
      <Canvas shadows camera={{ position: [0, 52, 62], fov: 38, near: 0.5, far: 800 }} dpr={[1, 2]} onPointerMissed={() => useCircuit.getState().select(null)}>
        <color attach="background" args={['#0b1020']} />
        <fog attach="fog" args={['#0b1020', 140, 320]} />
        <hemisphereLight args={['#dbe7ff', '#1a2033', 0.9]} />
        <directionalLight position={[30, 60, 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <directionalLight position={[-40, 30, -30]} intensity={0.4} />
        {/* masa */}
        <mesh position={[0, -1.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 300]} />
          <meshStandardMaterial color="#1b2236" roughness={0.9} />
        </mesh>
        <gridHelper args={[400, 80, '#24304d', '#1f2840']} position={[0, -1.24, 0]} />
        <Breadboard cols={cols} />
        {asm?.parts.map((p) => <PartView key={p.id} p={p} cols={cols} />)}
        {asm?.jumpers.map((j, i) => <JumperView key={i} {...j} cols={cols} />)}
        {asm?.instruments.map((inst) => <InstrumentView key={inst.id} inst={inst} cols={cols} asm={asm} />)}
        {asm?.tags.map((t) => <NetTagView key={t.net} tag={t} cols={cols} />)}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.08} minDistance={15} maxDistance={260} enableDamping />
        <CameraRig asm={asm} />
      </Canvas>
      <div className="three-hint">🖱️ Sürükle: döndür · Sağ tık: kaydır · Tekerlek: yakınlaştır · Anahtara tıkla: aç/kapat</div>
      {asm && asm.warnings.length > 0 && <div className="three-warn">{asm.warnings.join(' · ')}</div>}
    </div>
  );
}
