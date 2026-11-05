// Geçici rejim, AC devreler ve filtreler
import { B, quiz, run, type Template } from './lib';

// ───────────── Geçici rejim ─────────────
const rcCharge: Template = (() => {
  const b = new B();
  b.add('clock', 'CLK1', 100, 140, 0, { freq: 100, duty: 0.5, V: 5 }).gnd('CLK1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['CLK1.p', 'R1.a']);
  b.add('capacitor', 'C1', 320, 100, 90, { C: 1e-6 }).gnd('C1.b', 340, 180).w(['R1.b', 'C1.a']);
  b.label('VIN', 180, -20, 'R1.a').label('VC', 340, 0, 'C1.a');
  b.scope(480, 0, 'VIN', 'VC', { timeDiv: 1e-3, ch1Div: 2, ch2Div: 2, ch1Pos: 1, ch2Pos: -3, trig: 2.5 });
  return {
    id: 'rc-charge', topic: 'transient', level: 'Temel', mood: 'info', xp: 70,
    title: 'RC Şarj–Deşarj ve Zaman Sabiti',
    subtitle: 'Kare dalgayla kondansatörün dolup boşalması, τ = RC',
    keywords: ['rc', 'zaman sabiti', 'tau', 'şarj', 'deşarj', 'kondansatör'],
    doc: b.doc('RC Şarj–Deşarj'),
    steps: [
      run('**▶ Başlat**. CH1 kare dalga girişi, CH2 kondansatör gerilimini gösterir.'),
      { id: 'q1', title: 'Zaman sabiti', text: 'R = 1 kΩ, C = 1 µF', check: quiz('τ = RC kaçtır?', ['1 ms', '1 µs', '10 ms', '0,1 ms'], 'τ = 1000 Ω · 1 µF = 1 ms. Osiloskopta 1 bölme = 1 ms.'), xp: 15 },
      { id: 'q2', title: 't = τ anında', text: 'Şarj eğrisi v(t) = 5·(1 − e^(−t/τ))', check: quiz('Şarj başladıktan τ sonra VC kaç volt olur?', ['≈ 3,16 V', '≈ 2,5 V', '≈ 5 V', '≈ 1,84 V'], '1 − e^(−1) ≈ 0,632 → 0,632·5 ≈ 3,16 V. 5τ sonra %99’a ulaşır.'), xp: 15 },
      { id: 's1', title: 'C’yi büyüt', text: '**C1**’i **4,7 µF** yap.', check: { kind: 'param', comp: 'C1', param: 'C', op: '>=', value: 4.7e-6 }, success: 'τ = 4,7 ms; yarım periyot (5 ms) ≈ 1τ → kondansatör artık tam dolamıyor, çıkış üçgene benziyor.' },
    ],
    theory: 'Bir RC devresine basamak gerilim uygulanınca kondansatör üstel olarak dolar: v_C(t) = V·(1 − e^(−t/RC)). τ = RC sürede son değerin %63,2’sine, 5τ’da %99,3’üne ulaşılır. Boşalma: v_C(t) = V·e^(−t/RC).',
  };
})();

const rlcStep: Template = (() => {
  const b = new B();
  b.add('clock', 'CLK1', 100, 140, 0, { freq: 100, duty: 0.5, V: 5 }).gnd('CLK1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 20 }).w(['CLK1.p', 'R1.a']);
  b.add('inductor', 'L1', 300, 60, 0, { L: 10e-3 }).w(['R1.b', 'L1.a']);
  b.add('capacitor', 'C1', 420, 100, 90, { C: 1e-6 }).gnd('C1.b', 440, 180).w(['L1.b', 'C1.a']);
  b.label('VIN', 180, -20, 'R1.a').label('VC', 440, 0, 'C1.a');
  b.scope(580, 0, 'VIN', 'VC', { timeDiv: 0.5e-3, ch1Div: 5, ch2Div: 2, ch1Pos: 1.5, ch2Pos: -3, trig: 2.5 });
  return {
    id: 'rlc-step', topic: 'transient', level: 'Orta', mood: 'surprised', xp: 90,
    title: 'Seri RLC Basamak Yanıtı ve Sönüm',
    subtitle: 'Az, kritik ve aşırı sönümlü yanıtları gözle',
    keywords: ['rlc', 'sönüm', 'damping', 'aşma', 'overshoot', 'ikinci dereceden'],
    doc: b.doc('RLC Basamak Yanıtı'),
    steps: [
      run('**▶ Başlat**. CH2’de kondansatör geriliminin salınarak 5 V’a oturduğunu gör.'),
      { id: 'q1', title: 'Doğal frekans', text: 'L = 10 mH, C = 1 µF', check: quiz('Sönümsüz doğal frekans f₀ = 1/(2π√LC) yaklaşık kaçtır?', ['1,59 kHz', '159 Hz', '15,9 kHz', '10 kHz'], '√(10m·1µ) = 100 µs → ω₀ = 10⁴ rad/s → f₀ ≈ 1,59 kHz.'), xp: 15 },
      { id: 'q2', title: 'Sönüm oranı', text: 'ζ = (R/2)·√(C/L)', check: quiz('R = 20 Ω için ζ kaçtır ve yanıt nasıldır?', ['0,1 — az sönümlü (salınımlı)', '1 — kritik sönümlü', '2 — aşırı sönümlü', '0 — sönümsüz'], 'ζ = 10·√(1µ/10m) = 0,1 < 1 → %73 aşma ile salınım.'), xp: 15 },
      { id: 's1', title: 'Kritik sönüm', text: '**R1**’i ζ = 1 yapacak değere ayarla: R = 2√(L/C).', check: { kind: 'param', comp: 'R1', param: 'R', op: '>=', value: 200 }, success: 'R = 200 Ω: salınım olmadan en hızlı oturma. Daha büyük R aşırı sönümlü ve yavaş olur.' },
    ],
    theory: 'Seri RLC’nin karakteristik denklemi s² + (R/L)s + 1/(LC) = 0. ω₀ = 1/√(LC), ζ = (R/2)√(C/L). ζ < 1 az sönümlü (aşma = e^(−πζ/√(1−ζ²))), ζ = 1 kritik, ζ > 1 aşırı sönümlü.',
  };
})();

const rcDiffInt: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { wave: 'square', amp: 2.5, freq: 1000 }).gnd('VG1.n', 120, 220);
  b.add('capacitor', 'C1', 180, 60, 0, { C: 10e-9 }).w(['VG1.p', 'C1.a']);
  b.add('resistor', 'R1', 240, 100, 90, { R: 10e3 }).gnd('R1.b', 260, 180).w(['C1.b', 'R1.a']);
  b.add('resistor', 'R2', 180, 240, 0, { R: 10e3 }).w(['VG1.p', 'R2.a']);
  b.add('capacitor', 'C2', 300, 280, 90, { C: 1e-6, useIc: true, ic: 0 }).gnd('C2.b', 320, 360).w(['R2.b', 'C2.a']);
  b.label('VD', 320, 60, 'C1.b').label('VI', 380, 240, 'R2.b');
  b.scope(500, 20, 'VD', 'VI', { timeDiv: 0.2e-3, ch1Div: 2, ch2Div: 0.05, ch1Pos: 1.5, ch2Pos: -1, trig: 0 });
  return {
    id: 'rc-diff-int', topic: 'transient', level: 'Orta', mood: 'point', xp: 80,
    title: 'RC Türev ve İntegral Alıcı',
    subtitle: 'Aynı kare dalga: küçük τ ile sivri darbeler, büyük τ ile üçgen',
    keywords: ['türev', 'integral', 'rc', 'kare dalga', 'üçgen'],
    doc: b.doc('RC Türev ve İntegral Alıcı'),
    steps: [
      run('**▶ Başlat**. CH1: türev (C seri, R paralel), CH2: integral (R seri, C paralel).'),
      { id: 'q1', title: 'Hangisi hangisi?', text: 'Kare dalganın integrali nedir?', check: quiz('Hangi çıkış üçgen dalgaya benzer?', ['VI (integral alıcı)', 'VD (türev alıcı)', 'İkisi de', 'Hiçbiri'], 'Sabit gerilimin integrali doğrusal artar → kare dalga integrali üçgen. Türevi ise kenarlarda darbe.'), xp: 15 },
      { id: 'q2', title: 'Koşul', text: 'τ₁ = R1·C1 = 0,1 ms, τ₂ = R2·C2 = 10 ms, T = 1 ms', check: quiz('RC devresi ne zaman iyi bir integral alıcıdır?', ['τ ≫ T (yavaş devre)', 'τ ≪ T', 'τ = T', 'Hiçbir zaman'], 'τ ≫ T iken kondansatör gerilimi küçük kalır, akım ≈ v_in/R olur ve v_C ≈ (1/RC)∫v_in dt. Türev alıcı için τ ≪ T gerekir.'), xp: 15 },
    ],
    theory: 'C seri–R paralel bağlantıda v_R = RC·dv_in/dt (τ ≪ T iken). R seri–C paralel bağlantıda v_C = (1/RC)∫v_in dt (τ ≫ T iken). Pasif türev/integral alıcıların genliği zayıftır; op-amp ile ideale yaklaştırılır.',
  };
})();

// ───────────── AC devreler ─────────────
const rcPhase: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { amp: 5, freq: 1000 }).gnd('VG1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['VG1.p', 'R1.a']);
  b.add('capacitor', 'C1', 320, 100, 90, { C: 159e-9 }).gnd('C1.b', 340, 180).w(['R1.b', 'C1.a']);
  b.label('VIN', 180, -20, 'R1.a').label('VOUT', 340, 0, 'C1.a');
  b.scope(480, 0, 'VIN', 'VOUT', { timeDiv: 0.1e-3, ch1Div: 2, ch2Div: 2, trig: 0 });
  return {
    id: 'rc-phase', topic: 'ac', level: 'Temel', mood: 'info', xp: 70,
    title: 'RC Devresinde Genlik ve Faz Farkı',
    subtitle: 'Kesim frekansında genlik %70,7, faz −45°',
    keywords: ['faz', 'fazör', 'empedans', 'rc', 'kesim frekansı'],
    doc: b.doc('RC Faz Farkı'),
    steps: [
      run('**▶ Başlat**. İki sinüsün tepeleri arasındaki zaman farkına bak (1 bölme = 0,1 ms).'),
      { id: 'q1', title: 'Genlik', text: 'f = 1 kHz, X_C = 1/(2πfC) ≈ 1 kΩ = R', check: quiz('Çıkış genliği yaklaşık kaçtır?', ['3,54 V', '5 V', '2,5 V', '1 V'], '|H| = 1/√(1+(ωRC)²) = 1/√2 → 5·0,707 ≈ 3,54 V.'), xp: 15 },
      { id: 'q2', title: 'Faz', text: 'Tepeler arasındaki gecikme T/8 = 125 µs.', check: quiz('Çıkışın fazı girişe göre nedir?', ['−45° (geride)', '+45° (önde)', '−90°', '0°'], 'φ = −arctan(ωRC) = −45°. 125 µs / 1000 µs · 360° = 45°.'), xp: 15 },
      { id: 's1', title: 'Yüksek frekans', text: '**VG1**’in frekansını **10 kHz** yap (Zaman/böl.’ü 20 µs’ye indir).', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 10000 }, success: 'Genlik ≈ 0,5 V’a düştü, faz −84°’ye yaklaştı: kapasitör yüksek frekansta kısa devre gibi.' },
    ],
    theory: 'Sinüzoidal sürekli rejimde R ve C empedansları Z_R = R, Z_C = 1/(jωC). Gerilim bölücü H(jω) = 1/(1 + jωRC). |H| = 1/√(1+(ωRC)²), ∠H = −arctan(ωRC). ω = 1/RC’de |H| = 0,707 (−3 dB) ve faz −45°.',
  };
})();

const seriesResonance: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { amp: 5, freq: 1000 }).gnd('VG1.n', 120, 220);
  b.add('inductor', 'L1', 180, 60, 0, { L: 10e-3 }).w(['VG1.p', 'L1.a']);
  b.add('capacitor', 'C1', 300, 60, 0, { C: 1e-6 }).w(['L1.b', 'C1.a']);
  b.add('resistor', 'R1', 420, 100, 90, { R: 10 }).gnd('R1.b', 440, 180).w(['C1.b', 'R1.a']);
  b.label('VIN', 180, -20, 'L1.a').label('VR', 440, 0, 'R1.a');
  b.scope(560, 0, 'VIN', 'VR', { timeDiv: 0.2e-3, ch1Div: 5, ch2Div: 2, trig: 0 });
  return {
    id: 'series-resonance', topic: 'ac', level: 'Orta', mood: 'surprised', xp: 90,
    title: 'Seri RLC Rezonansı',
    subtitle: 'X_L = X_C olduğunda akım tepe yapar; kalite faktörü Q',
    keywords: ['rezonans', 'rlc', 'kalite faktörü', 'q', 'bant genişliği'],
    doc: b.doc('Seri RLC Rezonansı'),
    steps: [
      run('**▶ Başlat**. CH2 = R üzerindeki gerilim = akım × 10 Ω.'),
      { id: 'q1', title: 'Rezonans frekansı', text: 'L = 10 mH, C = 1 µF', check: quiz('Rezonans frekansı yaklaşık kaçtır?', ['1,59 kHz', '1 kHz', '159 Hz', '10 kHz'], 'f₀ = 1/(2π√LC) ≈ 1592 Hz. Bu frekansta X_L = X_C ≈ 100 Ω ve birbirini götürür.'), xp: 15 },
      { id: 'm1', title: 'Rezonansa getir', text: '**VG1**’in frekansını rezonansa ayarla; VR’nin tepe değeri 4,5 V’u geçmeli.', check: { kind: 'measure', net: 'VR', stat: 'max', op: '>=', value: 4.5 }, hint: 'Frekansı 1592 Hz yap', success: 'Rezonansta empedans yalnızca R = 10 Ω: akım 0,5 A’e çıktı!' },
      { id: 'q2', title: 'Kalite faktörü', text: 'Q = (1/R)·√(L/C)', check: quiz('Bu devrenin Q değeri kaçtır?', ['10', '1', '100', '0,1'], 'Q = 0,1·√(10m/1µ) = 0,1·100 = 10. Rezonansta L ve C üzerinde kaynak geriliminin Q katı (50 V tepe!) oluşur.'), xp: 15 },
    ],
    theory: 'Seri RLC empedansı Z = R + j(ωL − 1/ωC). ω₀ = 1/√(LC)’de sanal kısım sıfırdır, akım maksimum ve kaynakla aynı fazdadır. Q = ω₀L/R; bant genişliği BW = f₀/Q. Rezonansta V_L = V_C = Q·V_kaynak.',
  };
})();

const transformer: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 120, 0, { amp: 311, freq: 50 }).gnd('VG1.n', 40, 200);
  b.add('xfmr', 'T1', 120, 120, 0, { n: 10 }).w(['VG1.p', 'T1.p1'], ['T1.p2', 'VG1.n']);
  b.add('resistor', 'RL', 260, 140, 90, { R: 100 }).w(['T1.s1', 'RL.a'], ['RL.b', 'T1.s2']).gnd('T1.s2', 200, 200);
  b.add('multimeter', 'DMM1', 340, 20, 0, { mode: 'ACV' }).w(['DMM1.pos', 'RL.a']).gnd('DMM1.com', 420, 120);
  b.add('multimeter', 'DMM2', 0, -120, 0, { mode: 'ACV' }).w(['DMM2.pos', 'VG1.p']).gnd('DMM2.com', 80, -20);
  return {
    id: 'transformer-ratio', topic: 'ac', level: 'Temel', mood: 'info', xp: 70,
    title: 'Transformatör Dönüştürme Oranı',
    subtitle: 'Şebekeden düşük gerilim: gerilim ve akım oranları',
    keywords: ['trafo', 'transformatör', 'sarım oranı', 'rms', 'şebeke'],
    doc: b.doc('Transformatör'),
    steps: [
      run('**▶ Başlat**. DMM2 primeri, DMM1 sekonderi RMS olarak ölçer.'),
      { id: 'q1', title: 'Sekonder gerilimi', text: 'Şebeke 220 V RMS (311 V tepe), oran 10:1', check: quiz('Sekonder RMS gerilimi kaçtır?', ['22 V', '31,1 V', '220 V', '2,2 V'], 'V_s = V_p/n = 220/10 = 22 V RMS.'), xp: 15 },
      { id: 'q2', title: 'Primer akımı', text: 'Sekonder akımı = 22 V / 100 Ω = 0,22 A', check: quiz('Primer akımı yaklaşık kaçtır? (ideal trafo)', ['22 mA', '0,22 A', '2,2 A', '2,2 mA'], 'Güç korunur: V_p·I_p = V_s·I_s → I_p = I_s/n = 22 mA.'), xp: 15 },
      { id: 's1', title: 'Oranı değiştir', text: '**T1**’in oranını **20** yap.', check: { kind: 'param', comp: 'T1', param: 'n', op: '>=', value: 20 }, success: 'Sekonder 11 V RMS. Sarım oranı = gerilim oranı.' },
    ],
    theory: 'İdeal trafoda V_p/V_s = N_p/N_s = n ve I_s/I_p = n (güç korunumu). Sekonderdeki yük primerden n²·R_L olarak görünür (empedans dönüştürme). Primer ve sekonder galvanik olarak yalıtılmıştır.',
  };
})();

// ───────────── Filtreler ─────────────
const lowpass: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { amp: 1, freq: 500 }).gnd('VG1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['VG1.p', 'R1.a']);
  b.add('capacitor', 'C1', 320, 100, 90, { C: 100e-9 }).gnd('C1.b', 340, 180).w(['R1.b', 'C1.a']);
  b.label('VIN', 180, -20, 'R1.a').label('VOUT', 340, 0, 'C1.a');
  b.scope(480, 0, 'VIN', 'VOUT', { timeDiv: 0.5e-3, ch1Div: 0.5, ch2Div: 0.5, trig: 0 });
  return {
    id: 'rc-lowpass', topic: 'filters', level: 'Temel', mood: 'info', xp: 70,
    title: 'RC Alçak Geçiren Filtre',
    subtitle: 'f_c = 1/(2πRC); kesimin üstünde −20 dB/dekad',
    keywords: ['alçak geçiren', 'low pass', 'filtre', 'kesim', 'desibel'],
    doc: b.doc('RC Alçak Geçiren'),
    steps: [
      run('**▶ Başlat**. 500 Hz’de çıkış girişe çok yakın.'),
      { id: 'q1', title: 'Kesim frekansı', text: 'R = 1 kΩ, C = 100 nF', check: quiz('f_c kaçtır?', ['1,59 kHz', '159 Hz', '15,9 kHz', '10 kHz'], 'f_c = 1/(2π·1k·100n) ≈ 1592 Hz.'), xp: 15 },
      { id: 's1', title: 'Kesimde', text: '**VG1** frekansını **1592 Hz** yap ve CH2 Maks değerine bak.', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 1500 }, success: 'Çıkış ≈ 0,707 V: −3 dB noktası.' },
      { id: 's2', title: 'On kat üstü', text: 'Frekansı **15,9 kHz** yap (Zaman/böl. → 20 µs).', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 15000 }, success: 'Çıkış ≈ 0,1 V: bir dekad üstte 10 kat (−20 dB) zayıflama.' },
    ],
    theory: 'H(jω) = 1/(1 + jω/ω_c), ω_c = 1/RC. f ≪ f_c’de kazanç ≈ 1; f_c’de −3 dB ve −45°; f ≫ f_c’de kazanç −20 dB/dekad düşer ve faz −90°’ye yaklaşır. Ses sistemlerinde tiz kesme, ADC öncesinde örtüşme (aliasing) önleme filtresi olarak kullanılır.',
  };
})();

const highpass: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { amp: 1, freq: 1592 }).gnd('VG1.n', 120, 220);
  b.add('capacitor', 'C1', 180, 60, 0, { C: 100e-9 }).w(['VG1.p', 'C1.a']);
  b.add('resistor', 'R1', 320, 100, 90, { R: 1000 }).gnd('R1.b', 340, 180).w(['C1.b', 'R1.a']);
  b.label('VIN', 180, -20, 'C1.a').label('VOUT', 340, 0, 'R1.a');
  b.scope(480, 0, 'VIN', 'VOUT', { timeDiv: 0.1e-3, ch1Div: 0.5, ch2Div: 0.5, trig: 0 });
  return {
    id: 'rc-highpass', topic: 'filters', level: 'Temel', mood: 'point', xp: 70,
    title: 'RC Yüksek Geçiren Filtre',
    subtitle: 'DC’yi ve düşük frekansları engelle, faz önde',
    keywords: ['yüksek geçiren', 'high pass', 'kuplaj', 'filtre'],
    doc: b.doc('RC Yüksek Geçiren'),
    steps: [
      run('**▶ Başlat**. f = f_c = 1592 Hz’de çıkış 0,707 V.'),
      { id: 'q1', title: 'Faz', text: 'Hangi sinyal önce tepe yapıyor?', check: quiz('Yüksek geçirenin kesimde fazı nedir?', ['+45° (çıkış önde)', '−45°', '0°', '+90°'], 'H = jω/ω_c / (1 + jω/ω_c) → f_c’de ∠H = +45°.'), xp: 15 },
      { id: 's1', title: 'Düşük frekans', text: 'Frekansı **159 Hz** yap (Zaman/böl. → 1 ms).', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '<=', value: 200 }, success: 'Çıkış ≈ 0,1 V. Bu yüzden yükselteç katları arasında kuplaj kondansatörü DC’yi engeller.' },
    ],
    theory: 'H(jω) = (jωRC)/(1 + jωRC). DC’de kazanç 0, yüksek frekansta 1. Kuplaj kondansatörleri katlar arası DC polarmayı ayırırken alt kesim frekansı oluşturur.',
  };
})();

const sallenKey: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 140, 0, { amp: 1, freq: 200 }).gnd('VG1.n', 60, 220);
  b.add('resistor', 'R1', 100, 60, 0, { R: 10e3 }).w(['VG1.p', 'R1.a']);
  b.add('resistor', 'R2', 220, 60, 0, { R: 10e3 }).w(['R1.b', 'R2.a']);
  b.add('opamp', 'U1', 380, 60, 0, { model: 'TL081', A0: 2e5, GBW: 3e6, SR: 13, Vos: 3e-3 });
  b.add('capacitor', 'C2', 320, 120, 90, { C: 10e-9 }).gnd('C2.b', 340, 200);
  b.w(['R2.b', 'U1.p'], ['U1.p', 'C2.a'], ['U1.o', 'U1.n']);
  b.add('capacitor', 'C1', 240, -60, 0, { C: 22e-9 }).w(['R1.b', 'C1.a'], ['C1.b', 'U1.o']);
  b.label('VIN', 100, -20, 'R1.a').label('VOUT', 500, 80, 'U1.o');
  b.scope(620, 0, 'VIN', 'VOUT', { timeDiv: 1e-3, ch1Div: 0.5, ch2Div: 0.5, trig: 0 });
  return {
    id: 'sallen-key', topic: 'filters', level: 'İleri', mood: 'success', xp: 100,
    title: 'Aktif Alçak Geçiren Filtre (Sallen–Key)',
    subtitle: 'İkinci dereceden, −40 dB/dekad, op-amp tamponlu',
    keywords: ['sallen key', 'aktif filtre', 'butterworth', 'ikinci derece', 'op-amp'],
    doc: b.doc('Sallen–Key Alçak Geçiren'),
    steps: [
      run('**▶ Başlat**. 200 Hz’de kazanç ≈ 1.'),
      { id: 'q1', title: 'Kesim frekansı', text: 'f_c = 1/(2π·R·√(C1·C2))', check: quiz('Kesim frekansı yaklaşık kaçtır?', ['≈ 1,07 kHz', '≈ 1,59 kHz', '≈ 723 Hz', '≈ 10 kHz'], '√(22n·10n) ≈ 14,8 nF → f_c = 1/(2π·10k·14,8n) ≈ 1,07 kHz. Q = √(C1C2)/(2C2) ≈ 0,74 (Butterworth’a yakın).'), xp: 15 },
      { id: 's1', title: 'Bir dekad üstü', text: 'Frekansı **10,7 kHz** yap (Zaman/böl. → 0,1 ms).', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 10000 }, success: 'Çıkış ≈ 0,01 V: ikinci dereceden filtre bir dekadda 100 kat (−40 dB) zayıflatır. Pasif RC’de bu 10 kattı.' },
    ],
    theory: 'Birim kazançlı Sallen–Key alçak geçiren: H(s) = ω₀²/(s² + (ω₀/Q)s + ω₀²), ω₀ = 1/(R√(C1C2)), Q = √(C1C2)/(2C2) (R1 = R2). Op-amp tampon olduğundan yük filtreyi bozmaz; sinyal işlemede, anti-aliasing’te yaygındır.',
  };
})();

export const TRANSIENT_TEMPLATES: Template[] = [rcCharge, rlcStep, rcDiffInt];
export const AC_TEMPLATES: Template[] = [rcPhase, seriesResonance, transformer];
export const FILTER_TEMPLATES: Template[] = [lowpass, highpass, sallenKey];
