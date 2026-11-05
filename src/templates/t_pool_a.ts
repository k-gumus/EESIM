// Deney havuzu (v0.2.1) — DC, geçici rejim, AC, filtreler, diyot
import { B, D4001, D4148, quiz, run, type Template } from './lib';

// ───────────── DC ─────────────
const norton: Template = (() => {
  const b = new B();
  // Asıl devre: 10 V, R1 = R2 = 1 kΩ (Thevenin deneyindekiyle aynı)
  b.add('vdc', 'V1', 20, 80, 0, { V: 10 }).gnd('V1.n', 40, 160);
  b.add('resistor', 'R1', 100, 0, 0, { R: 1000 }).w(['V1.p', 'R1.a']);
  b.add('resistor', 'R2', 200, 60, 90, { R: 1000 }).gnd('R2.b', 220, 140).w(['R1.b', 'R2.a']);
  b.add('switch', 'S1', 280, 0, 0, { closed: false }).w(['R1.b', 'S1.a']);
  b.add('multimeter', 'DMM1', 340, -140, 0, { mode: 'DCA' }).w(['S1.b', 'DMM1.pos']).gnd('DMM1.com', 420, -40);
  b.label('VA', 220, -60, 'R1.b');
  // Norton eşdeğeri: akım kaynağı ∥ R_N
  b.add('idc', 'IN', 520, 80, 0, { I: 10e-3 }).gnd('IN.n', 540, 160);
  b.add('resistor', 'RN', 620, 80, 90, { R: 500 }).gnd('RN.b', 640, 160).w(['IN.p', 'RN.a']);
  b.label('VB', 680, 20, 'RN.a');
  return {
    id: 'norton', topic: 'dc', level: 'Temel', mood: 'point', xp: 80,
    title: 'Norton Eşdeğeri ve Kaynak Dönüşümü',
    subtitle: 'Kısa devre akımı + eşdeğer direnç = aynı davranış',
    keywords: ['norton', 'kaynak dönüşümü', 'eşdeğer devre', 'kısa devre akımı', 'thevenin'],
    doc: b.doc('Norton Eşdeğeri'),
    steps: [
      run('**▶ Başlat**. Solda asıl devre, sağda onun Norton eşdeğeri var. **Değer Okuma** ile VA ve VB’yi karşılaştır.'),
      { id: 'q1', title: 'Açık devre gerilimi', text: 'S1 açık: A ucu boşta.', check: quiz('VA ve VB kaç volttur?', ['İkisi de 5 V', 'VA = 10 V, VB = 5 V', 'İkisi de 10 V', 'VA = 5 V, VB = 0 V'], 'VA = 10·1k/(1k+1k) = 5 V. Norton tarafında I_N·R_N = 10 mA·500 Ω = 5 V. Eşdeğer devreler uçlardan aynı görünür.'), xp: 15 },
      { id: 's1', title: 'Kısa devre akımı', text: '**S1**’i kapat: A ucu ampermetre üzerinden toprağa kısa devre olur.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 'q2', title: 'I_N', text: 'DMM1’i oku.', check: quiz('Kısa devre akımı (I_N) kaçtır?', ['10 mA', '5 mA', '20 mA', '0 mA'], 'Uç kısa devreyken R2’nin üzerinde gerilim kalmaz; akımın tamamı R1’den gelir: 10 V / 1 kΩ = 10 mA. Bu, Norton kaynağının değeridir.'), xp: 15 },
      { id: 'q3', title: 'R_N', text: 'R_N = V_açık / I_kısa', check: quiz('Norton direnci kaç ohm’dur?', ['500 Ω', '1 kΩ', '2 kΩ', '250 Ω'], 'R_N = 5 V / 10 mA = 500 Ω = R1‖R2 = R_TH. Kaynak dönüşümü: V_TH = I_N·R_N.'), xp: 15 },
    ],
    theory: 'Her doğrusal iki uçlu devre, bir akım kaynağı (I_N = kısa devre akımı) ile ona paralel bir dirençle (R_N = R_TH) temsil edilebilir. Thevenin ve Norton eşdeğerleri birbirine kaynak dönüşümüyle çevrilir: V_TH = I_N·R_N. Laboratuvarda R_N, açık devre gerilimi ile kısa devre akımının oranından ölçülür.',
  };
})();

const meterLoading: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 60, 0, { V: 10 }).gnd('V1.n', 40, 140);
  b.add('resistor', 'R1', 140, 0, 90, { R: 1e6 }).add('resistor', 'R2', 140, 120, 90, { R: 1e6 }).gnd('R2.b', 160, 200);
  b.w(['V1.p', 'R1.a'], ['R1.b', 'R2.a']);
  b.add('switch', 'S1', 220, 60, 0, { closed: false }).w(['R1.b', 'S1.a']);
  b.add('resistor', 'RM', 320, 100, 90, { R: 1e6 }).gnd('RM.b', 340, 180).w(['S1.b', 'RM.a']);
  b.add('multimeter', 'DMM1', 400, -100, 0, { mode: 'DCV' }).w(['DMM1.pos', 'R1.b']).gnd('DMM1.com', 480, 0);
  b.label('VOUT', 240, -20, 'R1.b');
  return {
    id: 'meter-loading', topic: 'dc', level: 'Temel', mood: 'surprised', xp: 70,
    title: 'Ölçü Aletinin Devreyi Yüklemesi',
    subtitle: 'Voltmetrenin iç direnci ölçtüğün gerilimi neden değiştirir?',
    keywords: ['voltmetre', 'iç direnç', 'yükleme', 'ölçüm hatası', 'giriş empedansı'],
    doc: b.doc('Ölçü Aletinin Yüklemesi'),
    steps: [
      run('**▶ Başlat**. DMM1 ideal (sonsuz iç dirençli) bir voltmetre. RM ise gerçek bir ölçü aletinin iç direncini temsil ediyor; S1 açıkken bağlı değil.'),
      { id: 'q1', title: 'İdeal ölçüm', text: 'R1 = R2 = 1 MΩ', check: quiz('İdeal voltmetre VOUT için ne gösterir?', ['5 V', '10 V', '3,33 V', '0 V'], 'Eşit dirençli bölücü: 10/2 = 5 V.'), xp: 15 },
      { id: 's1', title: 'Gerçek aleti bağla', text: '**S1**’i kapat: 1 MΩ iç dirençli (ucuz, analog) bir voltmetre bağladın.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 'q2', title: 'Yüklenmiş ölçüm', text: 'DMM1’e bak.', check: quiz('Şimdi VOUT kaç volt oldu?', ['≈ 3,33 V', '5 V', '≈ 4,76 V', '≈ 2,5 V'], 'R2‖RM = 500 kΩ → VOUT = 10·500k/1,5M ≈ 3,33 V. Ölçü aleti ölçtüğü şeyi değiştirdi: %33 hata!'), xp: 15 },
      { id: 's2', title: 'Daha iyi alet', text: '**RM**’yi **10 MΩ** yap (tipik dijital multimetre).', check: { kind: 'param', comp: 'RM', param: 'R', op: '>=', value: 10e6 }, success: 'VOUT ≈ 4,76 V: hata %5’e indi. Kural: aletin iç direnci, ölçülen noktanın Thevenin direncinden en az 100 kat büyük olmalı.' },
    ],
    theory: 'Voltmetre ölçtüğü iki noktaya paralel bağlanır; iç direnci (R_M) devreye paralel bir yük ekler. Ölçülen nokta yüksek empedanslıysa (burada R_TH = 500 kΩ) hata büyür: V_ölçülen = V_gerçek·R_M/(R_M + R_TH). Dijital multimetreler tipik 10 MΩ, analog aletler kademeye bağlı “Ω/V” değeriyle belirtilir. Osiloskop probu da 1 MΩ (×1) ya da 10 MΩ (×10) yük oluşturur.',
  };
})();

// ───────────── Geçici rejim ─────────────
const rlTransient: Template = (() => {
  const b = new B();
  b.add('clock', 'CLK1', 20, 60, 0, { freq: 100, duty: 0.5, V: 5 }).gnd('CLK1.n', 40, 140);
  b.add('inductor', 'L1', 100, 40, 0, { L: 100e-3 }).w(['CLK1.p', 'L1.a']);
  b.add('resistor', 'R1', 220, 80, 90, { R: 100 }).gnd('R1.b', 240, 160).w(['L1.b', 'R1.a']);
  b.label('VIN', 60, -20, 'CLK1.p').label('VR', 300, 20, 'R1.a');
  b.scope(380, 0, 'VIN', 'VR', { timeDiv: 1e-3, ch1Div: 2, ch2Div: 2, ch1Pos: 0.5, ch2Pos: -2.5, trig: 2.5 });
  return {
    id: 'rl-transient', topic: 'transient', level: 'Temel', mood: 'info', xp: 70,
    title: 'RL Devresinde Akımın Yükselişi',
    subtitle: 'τ = L/R: bobin akımın ani değişimine direnir',
    keywords: ['rl', 'bobin', 'zaman sabiti', 'endüktans', 'geçici'],
    doc: b.doc('RL Geçici Rejim'),
    steps: [
      run('**▶ Başlat**. CH2 = R1 üzerindeki gerilim = akım × 100 Ω. Akım bobin yüzünden yavaşça yükselir.'),
      { id: 'q1', title: 'Zaman sabiti', text: 'L = 100 mH, R = 100 Ω', check: quiz('τ = L/R kaçtır?', ['1 ms', '10 ms', '0,1 ms', '1 s'], 'τ = 0,1 H / 100 Ω = 1 ms. Osiloskopta 1 bölme.'), xp: 15 },
      { id: 'q2', title: 'Son akım', text: '5τ sonra bobin kısa devre gibi davranır.', check: quiz('Akımın ulaştığı son değer kaçtır?', ['50 mA', '5 mA', '500 mA', '0'], 'I = V/R = 5 V/100 Ω = 50 mA (VR = 5 V). τ anında %63’ü olan 31,6 mA’e ulaşır.'), xp: 15 },
      { id: 's1', title: 'Bobini büyüt', text: '**L1**’i **300 mH** yap.', check: { kind: 'param', comp: 'L1', param: 'L', op: '>=', value: 0.3 }, success: 'τ = 3 ms: 5 ms’lik darbe yetmiyor, akım son değerine ulaşamıyor. Röle ve motor bobinleri bu yüzden “yavaş” açılır.' },
    ],
    theory: 'Bobinin gerilimi v = L·di/dt olduğundan akım aniden değişemez. Basamak girişte i(t) = (V/R)(1 − e^(−t/τ)), τ = L/R. Kesildiğinde akım aynı τ ile söner — ama yolu yoksa bobin akımı sürdürmek için çok yüksek gerilim üretir (bkz. “Bobin Geri Tepmesi”). RC’nin ikizidir: RC’de gerilim, RL’de akım süreklidir.',
  };
})();

const inductiveKick: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 0, 0, { V: 12 }).gnd('V1.n', 40, 80);
  b.add('resistor', 'RCOIL', 160, -20, 90, { R: 100 }).add('inductor', 'LCOIL', 160, 80, 90, { L: 100e-3 });
  b.w(['V1.p', 'RCOIL.a'], ['RCOIL.b', 'LCOIL.a']);
  b.add('nmos', 'M1', 140, 200, 0, { model: 'IRF540', Vth: 3.5, K: 3, lambda: 0.005 }).gnd('M1.s', 180, 280).w(['LCOIL.b', 'M1.d']);
  b.add('clock', 'CLK1', 20, 220, 0, { freq: 10, duty: 0.5, V: 10 }).gnd('CLK1.n', 40, 300).w(['CLK1.p', 'M1.g']);
  // MOSFET'in çığ kırılması (avalanche) ~47 V'ta: zener ile modellendi
  b.add('zener', 'DAV', 260, 200, 270, { Vz: 47 }).gnd('DAV.a', 280, 280).w(['M1.d', 'DAV.k']);
  // Serbest geçiş (flyback) diyodu: S1 ile devreye girer
  b.add('diode', 'DFB', 300, 40, 270, D4001).add('switch', 'S1', 300, -60, 90, { closed: false });
  b.w(['M1.d', 'DFB.a'], ['DFB.k', 'S1.b'], ['S1.a', 'V1.p']);
  b.label('VD', 380, 140, 'M1.d');
  b.scope(460, 0, 'VD', null, { timeDiv: 10e-3, ch1Div: 10, ch1Pos: -3, trig: 20 });
  return {
    id: 'inductive-kick', topic: 'transient', level: 'Orta', mood: 'angry', xp: 90,
    title: 'Bobin Geri Tepmesi ve Serbest Geçiş Diyodu',
    subtitle: 'Röle bobinini kesince oluşan gerilim darbesi',
    keywords: ['flyback', 'geri tepme', 'röle', 'diyot', 'bobin', 'serbest geçiş', 'endüktif yük'],
    doc: b.doc('Bobin Geri Tepmesi'),
    steps: [
      run('**▶ Başlat**. M1 bir röle bobinini (100 mH + 100 Ω) 10 Hz ile açıp kapatıyor. CH1 drain gerilimi.'),
      { id: 'q1', title: 'Darbe', text: 'M1 kapandığı anda VD’ye bak.', check: quiz('Anahtar açılınca drain gerilimi neden 12 V’u çok aşar?', ['Bobin akımını sürdürmek için v = L·di/dt kadar gerilim üretir', 'Kaynak gerilimi artar', 'MOSFET yükseltir', 'Ölçüm hatası'], 'Akım aniden kesilemez; bobin gerilimini ters çevirip akımı zorla sürdürmeye çalışır. Burada gerilim yalnızca MOSFET’in çığ kırılmasında (~47 V) durdu — her anahtarlamada transistör zorlanıyor.'), xp: 15 },
      { id: 's1', title: 'Diyot ekle', text: '**S1**’i kapat: bobine ters paralel serbest geçiş diyodu bağlanır.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 'q2', title: 'Sınırlanmış darbe', text: 'VD’nin tepe değerine bak.', check: quiz('Diyotla drain gerilimi en fazla kaç volta çıkar?', ['≈ 12,7 V (V_kaynak + V_diyot)', '≈ 47 V', '≈ 0 V', '≈ 24 V'], 'Bobin akımı diyot üzerinden kendi içinde döner; drain, kaynak geriliminin bir diyot düşümü üstüne kenetlenir. Bedeli: akım yavaş söner (röle geç bırakır).'), xp: 15 },
    ],
    theory: 'Endüktif yükler (röle, motor, solenoid) enerji depolar: E = ½LI². Anahtar açıldığında bu enerji bir yere gitmeli; yol yoksa bobin gerilimi transistörü delene kadar yükselir. Ters paralel diyot akıma yol açar ve gerilimi V_kaynak + 0,7 V’a sınırlar. Hızlı bırakma gerekiyorsa diyoda seri bir zener ya da direnç eklenir (daha yüksek ama kontrollü gerilim).',
  };
})();

// ───────────── AC ─────────────
const parallelRes: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 80, 0, { amp: 5, freq: 1000 }).gnd('VG1.n', 40, 160);
  b.add('resistor', 'R1', 100, 0, 0, { R: 1000 }).w(['VG1.p', 'R1.a']);
  b.add('inductor', 'L1', 220, 60, 90, { L: 10e-3 }).gnd('L1.b', 240, 140);
  b.add('capacitor', 'C1', 300, 60, 90, { C: 1e-6 }).gnd('C1.b', 320, 140);
  b.w(['R1.b', 'L1.a'], ['R1.b', 'C1.a']);
  b.label('VIN', 60, -60, 'VG1.p').label('VT', 360, -20, 'C1.a');
  b.scope(440, 0, 'VIN', 'VT', { timeDiv: 0.5e-3, ch1Div: 2, ch2Div: 2, trig: 0 });
  return {
    id: 'parallel-resonance', topic: 'ac', level: 'Orta', mood: 'surprised', xp: 90,
    title: 'Paralel Rezonans (Tank Devresi)',
    subtitle: 'Rezonansta L ∥ C’nin empedansı en büyük olur',
    keywords: ['paralel rezonans', 'tank devresi', 'lc', 'empedans', 'seçicilik'],
    doc: b.doc('Paralel Rezonans'),
    steps: [
      run('**▶ Başlat**. 1 kHz’te tank devresi düşük empedanslı: VT küçük.'),
      { id: 'q1', title: 'Rezonans frekansı', text: 'L = 10 mH, C = 1 µF', check: quiz('Rezonans frekansı yaklaşık kaçtır?', ['1,59 kHz', '159 Hz', '15,9 kHz', '1 kHz'], 'f₀ = 1/(2π√LC) = 1/(2π·100 µs) ≈ 1592 Hz.'), xp: 15 },
      { id: 'm1', title: 'Rezonansa getir', text: '**VG1**’in frekansını rezonansa ayarla; VT’nin tepe değeri 4,5 V’u geçmeli.', check: { kind: 'measure', net: 'VT', stat: 'max', op: '>=', value: 4.5 }, hint: 'Frekansı 1592 Hz yap.' },
      { id: 'q2', title: 'Kaynak akımı', text: 'VT ≈ VIN oldu: R1 üzerinde neredeyse gerilim yok.', check: quiz('Rezonansta kaynaktan çekilen akım nasıldır?', ['En küçük (≈ 0): L ve C akımları birbirini götürür', 'En büyük', 'Sonsuz', 'Değişmez'], 'L ve C’nin akımları eşit büyüklükte ve zıt fazlıdır; enerji aralarında gidip gelir, kaynaktan yalnızca kayıplar kadar akım çekilir. Seri rezonansın tersi!'), xp: 15 },
    ],
    theory: 'Paralel LC’de Y = j(ωC − 1/ωL). ω₀ = 1/√(LC)’de toplam admitans sıfıra gider: empedans (idealde) sonsuz olur. Bu yüzden tank devreleri radyo alıcılarında istenen frekansı seçer, osilatörlerde frekansı belirler. Gerçek bobinin direnci empedansı sonlu tutar ve Q’yu belirler.',
  };
})();

const powerFactor: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 80, 0, { amp: 10, freq: 50 }).gnd('VG1.n', 40, 160);
  b.add('multimeter', 'DMM1', 80, -140, 0, { mode: 'ACA' }).w(['VG1.p', 'DMM1.pos']);
  b.add('resistor', 'RL', 300, 0, 90, { R: 10 }).add('inductor', 'LL', 300, 100, 90, { L: 50e-3 });
  b.w(['DMM1.com', 'RL.a'], ['RL.b', 'LL.a']);
  b.add('switch', 'S1', 380, -60, 0, { closed: false }).add('capacitor', 'CP', 480, 40, 90, { C: 150e-6 });
  b.w(['DMM1.com', 'S1.a'], ['S1.b', 'CP.a']);
  // Akımı osiloskopta görmek için dönüş yoluna 0,1 Ω şönt
  b.add('resistor', 'RS', 380, 200, 90, { R: 0.1 }).gnd('RS.b', 400, 280).w(['LL.b', 'RS.a'], ['CP.b', 'RS.a']);
  b.label('VIN', 60, -180, 'VG1.p').label('VI', 440, 180, 'RS.a');
  b.scope(560, 0, 'VIN', 'VI', { timeDiv: 5e-3, ch1Div: 5, ch2Div: 0.02, trig: 0 });
  return {
    id: 'power-factor', topic: 'ac', level: 'Orta', mood: 'point', xp: 90,
    title: 'Güç Faktörü ve Düzeltilmesi',
    subtitle: 'Endüktif yüke kondansatör ekleyerek cos φ’yi yükselt',
    keywords: ['güç faktörü', 'cos phi', 'reaktif güç', 'kompanzasyon', 'endüktif yük'],
    doc: b.doc('Güç Faktörü'),
    steps: [
      run('**▶ Başlat**. Yük: 10 Ω + 50 mH (motor gibi). CH2 = 0,1 Ω şönt üzerindeki gerilim = kaynak akımı × 0,1. DMM1 RMS akımı gösterir.'),
      { id: 'q1', title: 'Güç faktörü', text: 'X_L = 2π·50·0,05 ≈ 15,7 Ω', check: quiz('Yükün güç faktörü (cos φ) yaklaşık kaçtır?', ['≈ 0,54', '≈ 1', '≈ 0,85', '≈ 0,2'], 'Z = √(10² + 15,7²) ≈ 18,6 Ω → cos φ = R/Z ≈ 0,54; akım gerilimden ≈ 57° geride.'), xp: 15 },
      { id: 's1', title: 'Kompanzasyon', text: '**S1**’i kapat: yüke paralel 150 µF bağlanır.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 'q2', title: 'Kaynak akımı', text: 'DMM1’in RMS akımı ne oldu?', check: quiz('Kondansatör eklenince kaynak akımı nasıl değişti?', ['Yaklaşık yarıya indi; yükün gücü aynı kaldı', 'İki katına çıktı', 'Değişmedi', 'Sıfır oldu'], 'Kondansatörün kapasitif akımı bobinin reaktif akımını karşılar; kaynak artık yalnızca gerçek güç için akım verir: ≈ 0,38 A → ≈ 0,2 A (×cos φ). Kablolarda kayıp ve trafo yükü azalır — fabrikalardaki kompanzasyon panolarının görevi.'), xp: 15 },
    ],
    theory: 'Aktif güç P = V·I·cos φ, reaktif güç Q = V·I·sin φ. Endüktif yük akımı geciktirir; şebeke aynı işi yapmak için daha fazla akım taşır. Paralel C, reaktif akımı yerelde karşılar: tam kompanzasyon için C = L/(R² + ω²L²) (burada ≈ 144 µF). Elektrik dağıtım şirketleri düşük cos φ’ye ceza keser.',
  };
})();

// ───────────── Filtreler ─────────────
const bandPass: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 80, 0, { amp: 1, freq: 1592 }).gnd('VG1.n', 40, 160);
  b.add('capacitor', 'C1', 100, 0, 0, { C: 1e-6 }).add('inductor', 'L1', 220, 0, 0, { L: 10e-3 });
  b.add('resistor', 'R1', 340, 60, 90, { R: 100 }).gnd('R1.b', 360, 140);
  b.w(['VG1.p', 'C1.a'], ['C1.b', 'L1.a'], ['L1.b', 'R1.a']);
  b.label('VIN', 60, -60, 'VG1.p').label('VOUT', 420, 0, 'R1.a');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 0.5, ch2Div: 0.5, trig: 0 });
  return {
    id: 'band-pass', topic: 'filters', level: 'Orta', mood: 'info', xp: 80,
    title: 'RLC Bant Geçiren Filtre',
    subtitle: 'Merkez frekans, bant genişliği ve kalite faktörü',
    keywords: ['bant geçiren', 'band pass', 'rlc', 'bant genişliği', 'kalite faktörü', 'q'],
    doc: b.doc('RLC Bant Geçiren Filtre'),
    steps: [
      run('**▶ Başlat**. Giriş merkez frekansta (1592 Hz): çıkış ≈ giriş.'),
      { id: 'q1', title: 'Bant genişliği', text: 'BW = R/(2πL)', check: quiz('Bu filtrenin −3 dB bant genişliği yaklaşık kaçtır?', ['≈ 1,6 kHz', '≈ 160 Hz', '≈ 16 kHz', '≈ 100 Hz'], 'BW = 100/(2π·0,01) ≈ 1,59 kHz → Q = f₀/BW = 1. Geniş bantlı bir filtre.'), xp: 15 },
      { id: 's1', title: 'Kesim noktası', text: '**VG1**’i üst kesim frekansı **2575 Hz**’e ayarla.', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '==', value: 2575 } },
      { id: 'q2', title: '−3 dB', text: 'VOUT’un tepe değerine bak.', check: quiz('Kesim frekansında çıkış genliği yaklaşık kaçtır?', ['≈ 0,71 V', '≈ 1 V', '≈ 0,5 V', '≈ 0,1 V'], '−3 dB = 1/√2 ≈ 0,707. Q = 1 için kesimler f₀·(√(1 + 1/4Q²) ± 1/2Q) ≈ 984 Hz ve 2575 Hz.'), xp: 15 },
      { id: 's2', title: 'Seçiciliği artır', text: '**R1**’i **20 Ω** yap.', check: { kind: 'param', comp: 'R1', param: 'R', op: '<=', value: 20 }, success: 'Q = 5: bant 318 Hz’e daraldı; 2575 Hz’teki çıkış belirgin küçüldü. Radyo alıcısı bu seçicilikle istasyonları ayırır.' },
    ],
    theory: 'Seri RLC’de R üzerindeki gerilim bant geçiren yanıt verir: H(jω) = R / (R + j(ωL − 1/ωC)). Merkez frekans f₀ = 1/(2π√LC), bant genişliği BW = R/(2πL), kalite faktörü Q = f₀/BW = (1/R)√(L/C). Q büyüdükçe filtre daha seçici olur.',
  };
})();

const activeHpf: Template = (() => {
  const b = new B();
  const OPA = { model: 'TL081', A0: 2e5, GBW: 3e6, SR: 13, Vos: 3e-3, Vcc: 15, Vee: -15 };
  b.add('vac', 'VG1', 20, 120, 0, { amp: 1, freq: 10000 }).gnd('VG1.n', 40, 200);
  b.add('capacitor', 'C1', 100, 60, 0, { C: 100e-9 }).w(['VG1.p', 'C1.a']);
  b.add('resistor', 'R1', 200, 120, 90, { R: 1000 }).gnd('R1.b', 220, 200).w(['C1.b', 'R1.a']);
  b.add('opamp', 'U1', 300, 40, 0, OPA).w(['C1.b', 'U1.p']);
  b.add('resistor', 'RG', 240, -60, 90, { R: 10e3 }).gnd('RG.a', 260, -100);
  b.add('resistor', 'RF', 300, -60, 0, { R: 10e3 }).w(['U1.n', 'RG.b'], ['U1.n', 'RF.a'], ['RF.b', 'U1.o']);
  b.label('VIN', 60, 20, 'VG1.p').label('VOUT', 420, 60, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 50e-6, ch1Div: 1, ch2Div: 1, trig: 0 });
  return {
    id: 'active-hpf', topic: 'filters', level: 'Orta', mood: 'point', xp: 80,
    title: 'Aktif Yüksek Geçiren Filtre',
    subtitle: 'RC filtre + evirmeyen kuvvetlendirici: kazanç ve yüksüz çıkış',
    keywords: ['aktif filtre', 'yüksek geçiren', 'op-amp', 'hpf', 'kesim frekansı'],
    doc: b.doc('Aktif Yüksek Geçiren Filtre'),
    steps: [
      run('**▶ Başlat**. 10 kHz geçirme bandında.'),
      { id: 'q1', title: 'Geçirme bandı kazancı', text: 'RF = RG = 10 kΩ', check: quiz('Yüksek frekansta çıkış genliği kaçtır?', ['≈ 2 V', '≈ 1 V', '≈ 0,5 V', '≈ 10 V'], 'C kısa devre gibi davranır; evirmeyen kazanç 1 + RF/RG = 2 → 2 V.'), xp: 15 },
      { id: 's1', title: 'Kesim frekansı', text: '**VG1**’i **1592 Hz** yap (f_c = 1/(2π·1k·100n)).', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '==', value: 1592 } },
      { id: 'q2', title: '−3 dB', text: 'VOUT’a bak.', check: quiz('Kesim frekansında çıkış genliği kaçtır?', ['≈ 1,41 V', '≈ 2 V', '≈ 1 V', '≈ 0,2 V'], 'Geçirme bandının 1/√2’si: 2·0,707 ≈ 1,41 V; faz +45°.'), xp: 15 },
      { id: 's2', title: 'Durdurma bandı', text: '**VG1**’i **159 Hz** yap.', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '<=', value: 160 }, success: 'Bir dekad aşağıda çıkış ≈ 0,2 V: 20 dB/dekad eğim (birinci derece). Op-amp, filtreyi yükten yalıtır ve kazanç ekler.' },
    ],
    theory: 'Aktif filtrede op-amp (1) filtreyi yükten yalıtır (yüksek giriş, düşük çıkış empedansı), (2) kazanç ekler, (3) bobinsiz yüksek dereceli filtreler kurmayı sağlar. Birinci derece YGF: H = K·jωRC/(1 + jωRC), K = 1 + RF/RG. Op-amp’ın GBW değeri yüksek frekans ucunu sınırlar (aslında bant geçirene dönüşür).',
  };
})();

// ───────────── Diyot ─────────────
const peakDetector: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 80, 0, { amp: 5, freq: 1000 }).gnd('VG1.n', 40, 160);
  b.add('diode', 'D1', 100, 0, 0, D4148).w(['VG1.p', 'D1.a']);
  b.add('capacitor', 'C1', 220, 60, 90, { C: 1e-6 }).gnd('C1.b', 240, 140).w(['D1.k', 'C1.a']);
  b.add('resistor', 'RL', 320, 60, 90, { R: 100e3 }).gnd('RL.b', 340, 140).w(['D1.k', 'RL.a']);
  b.label('VIN', 60, -60, 'VG1.p').label('VOUT', 380, 0, 'RL.a');
  b.scope(460, 0, 'VIN', 'VOUT', { timeDiv: 0.5e-3, ch1Div: 2, ch2Div: 2, trig: 0 });
  return {
    id: 'peak-detector', topic: 'diode', level: 'Temel', mood: 'info', xp: 70,
    title: 'Tepe Dedektörü',
    subtitle: 'Diyot + kondansatör: sinyalin tepe değerini tut',
    keywords: ['tepe dedektörü', 'zarf dedektörü', 'am demodülasyon', 'peak detector'],
    doc: b.doc('Tepe Dedektörü'),
    steps: [
      run('**▶ Başlat**. C1, her tepede dolar ve RL üzerinden yavaşça boşalır.'),
      { id: 'q1', title: 'Çıkış', text: '5 V tepe, 1N4148', check: quiz('VOUT yaklaşık kaç volttur?', ['≈ 4,4 V', '5 V', '≈ 3,5 V', '≈ 2,5 V'], 'Kondansatör tepe değerden bir diyot düşümü eksiğine dolar: 5 − 0,6 ≈ 4,4 V.'), xp: 15 },
      { id: 'q2', title: 'Dalgalanma', text: 'τ = RL·C = 100 ms ≫ T = 1 ms', check: quiz('Periyot başına boşalma (dalgalanma) yaklaşık ne kadardır?', ['≈ 45 mV', '≈ 4,4 V', '≈ 1 V', '0'], 'ΔV ≈ V·T/τ = 4,4·1 ms/100 ms ≈ 44 mV.'), xp: 15 },
      { id: 's1', title: 'Hızlı boşalma', text: '**RL**’yi **1 kΩ** yap.', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 1000 }, success: 'τ = 1 ms ≈ T: çıkış artık tepeyi tutamıyor. AM radyoda τ, taşıyıcı periyodundan büyük ama ses sinyalinin periyodundan küçük seçilir: çıkış sesin “zarfını” izler.' },
    ],
    theory: 'Diyot yalnızca giriş, kondansatör geriliminden yüksekken iletir ve C’yi tepeye kadar doldurur; diğer zamanlarda kesimdedir ve C, RL üzerinden boşalır. τ = RL·C seçimi ölçüm hızı ile dalgalanma arasındaki dengedir. Uygulamalar: AM demodülasyonu (zarf dedektörü), tepe voltmetreleri, doğrultucu filtreleri.',
  };
})();

const reversePolarity: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 60, 0, { V: 9 }).gnd('V1.n', 40, 140);
  b.add('diode', 'D1', 100, -20, 0, D4001).w(['V1.p', 'D1.a']);
  b.add('resistor', 'RL', 220, 40, 90, { R: 100 }).gnd('RL.b', 240, 120).w(['D1.k', 'RL.a']);
  b.add('multimeter', 'DMM1', 300, -120, 0, { mode: 'DCV' }).w(['DMM1.pos', 'RL.a']).gnd('DMM1.com', 380, -20);
  b.label('VL', 260, -60, 'RL.a');
  return {
    id: 'reverse-polarity', topic: 'diode', level: 'Isınma', mood: 'angry', xp: 60,
    title: 'Ters Polarite Koruması',
    subtitle: 'Pil ters takılırsa devre yanmasın',
    keywords: ['ters polarite', 'koruma', 'seri diyot', 'pil ters', 'reverse polarity'],
    doc: b.doc('Ters Polarite Koruması'),
    steps: [
      run('**▶ Başlat**. RL korunan devreyi temsil ediyor.'),
      { id: 'q1', title: 'Normal çalışma', text: 'D1 = 1N4001, RL = 100 Ω', check: quiz('Yük gerilimi yaklaşık kaçtır?', ['≈ 8,2 V', '9 V', '≈ 4,5 V', '0 V'], 'Seri diyot yaklaşık 0,8 V düşürür (≈ 82 mA’de): 9 − 0,8 ≈ 8,2 V.'), xp: 15 },
      { id: 's1', title: 'Pili ters tak', text: '**V1**’i **−9 V** yap.', check: { kind: 'param', comp: 'V1', param: 'V', op: '<=', value: -9 }, success: 'Diyot ters kutuplandı: yük gerilimi ≈ 0. Devre korundu.' },
      { id: 'q2', title: 'Bedeli', text: 'Normal çalışmada diyot ne kadar ısınır?', check: quiz('Seri diyotun normal çalışmadaki kaybı yaklaşık kaçtır?', ['≈ 65 mW (0,8 V × 82 mA)', '0 W', '≈ 0,74 W', '≈ 9 W'], 'P = V_D·I ≈ 0,8·0,082 ≈ 65 mW, üstelik pil geriliminin %9’u boşa gidiyor. Düşük gerilimli cihazlarda Schottky (≈ 0,3 V) ya da “ideal diyot” gibi davranan P-MOSFET tercih edilir.'), xp: 15 },
    ],
    theory: 'Seri diyot en basit korumadır: yanlış kutuplamada akım geçirmez. Dezavantajı iletim düşümüdür. P-MOSFET’li korumada transistör, gövde diyodu üzerinden açılıp kanalı iletime geçirir; düşüm I·R_DS(on) kadardır (mV’lar). Paralel diyot + sigorta ise ters bağlantıda sigortayı attırır.',
  };
})();

const ledSeriesParallel: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 60, 0, { V: 5 }).gnd('V1.n', 40, 140);
  // Yanlış: ortak direnç, paralel farklı renk LED'ler
  b.add('resistor', 'R1', 120, -20, 0, { R: 150 }).w(['V1.p', 'R1.a']);
  b.add('led', 'LED1', 220, 40, 90, { color: 'red' }).gnd('LED1.k', 240, 120);
  b.add('led', 'LED2', 300, 40, 90, { color: 'blue' }).gnd('LED2.k', 320, 120);
  b.w(['R1.b', 'LED1.a'], ['R1.b', 'LED2.a']);
  // Doğru: her LED'e ayrı direnç
  b.add('resistor', 'R2', 420, -20, 90, { R: 150 }).add('led', 'LED3', 420, 80, 90, { color: 'red' }).gnd('LED3.k', 440, 160);
  b.add('resistor', 'R3', 520, -20, 90, { R: 100 }).add('led', 'LED4', 520, 80, 90, { color: 'blue' }).gnd('LED4.k', 540, 160);
  b.w(['V1.p', 'R2.a'], ['R2.b', 'LED3.a'], ['V1.p', 'R3.a'], ['R3.b', 'LED4.a']);
  b.label('VA', 220, -80, 'R1.b');
  return {
    id: 'led-series-parallel', topic: 'diode', level: 'Isınma', mood: 'surprised', xp: 60,
    title: 'LED’leri Seri ve Paralel Bağlama',
    subtitle: 'Neden her LED’e ayrı direnç?',
    keywords: ['led', 'paralel led', 'akım paylaşımı', 'ön direnç', 'led bağlantısı'],
    doc: b.doc('LED Bağlantıları'),
    steps: [
      run('**▶ Başlat**. Solda iki LED tek direnci paylaşıyor, sağda her LED’in kendi direnci var.'),
      { id: 'q1', title: 'Mavi neden sönük?', text: 'LED2’ye bak.', check: quiz('Soldaki mavi LED (LED2) neden yanmıyor?', ['Kırmızı LED ortak düğümü ≈ 1,9 V’a sabitliyor; mavi için 3 V gerekir', 'Mavi LED bozuk', 'Direnç çok büyük', 'Kaynak yetersiz'], 'Paralel elemanların gerilimi eşittir. Eşiği düşük olan LED (kırmızı) tüm akımı çeker ve düğümü kendi gerilimine kenetler.'), xp: 15 },
      { id: 'q2', title: 'Aynı renk olsa?', text: 'İki aynı LED paralel olsa bile…', check: quiz('Aynı renk iki LED’i tek dirençle paralel sürmek neden risklidir?', ['V_F farkları ve sıcaklıkla akım birinde toplanır (ısıl kaçak)', 'Hiç risk yoktur', 'İkisi de söner', 'Gerilim iki katına çıkar'], 'Üretim farkı birkaç on mV olsa bile akım üstel bağlı olduğundan eşit paylaşılmaz; daha çok akım çeken LED ısınır, V_F’si düşer, daha da çok akım çeker.'), xp: 15 },
      { id: 's1', title: 'Doğru hesap', text: 'Mavi LED için R = (5 − 3)/20 mA = 100 Ω. **R1**’i **100 Ω** yap ve soldaki devreye bak.', check: { kind: 'param', comp: 'R1', param: 'R', op: '<=', value: 100 }, success: 'Kırmızı LED aşırı akım çekmeye başladı (≈ 30 mA); mavi hâlâ sönük. Çözüm her zaman: her LED kolu için ayrı direnç ya da seri bağlantı + akım kaynağı.' },
    ],
    theory: 'LED akımı, iletim gerilimini çok az aşan gerilimlerde bile üstel artar; bu yüzden LED’ler gerilimle değil akımla sürülür. Seri bağlantıda akım ortaktır (en güvenli, ama gerilim toplanır). Paralel bağlantıda her kola ayrı direnç gerekir. Güç LED’lerinde direnç yerine sabit akım sürücüsü kullanılır.',
  };
})();

export const POOL_A: Template[] = [norton, meterLoading, rlTransient, inductiveKick, parallelRes, powerFactor, bandPass, activeHpf, peakDetector, reversePolarity, ledSeriesParallel];
