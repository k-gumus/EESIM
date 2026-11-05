// Op-amp, osilatör, güç, dijital ve ölçme deneyleri
import { B, D4001, D5819, quiz, run, type Template } from './lib';

const OPA = { model: 'LM741', A0: 2e5, GBW: 1e6, SR: 0.5, Vos: 1e-3, Vcc: 15, Vee: -15 };
const TL081 = { model: 'TL081', A0: 2e5, GBW: 3e6, SR: 13, Vos: 3e-3, Vcc: 15, Vee: -15 };

// ───────────── Op-amp ─────────────
const inverting: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 140, 0, { amp: 0.5, freq: 1000 }).gnd('VG1.n', 60, 220);
  b.add('resistor', 'R1', 100, 60, 0, { R: 1000 }).w(['VG1.p', 'R1.a']);
  b.add('opamp', 'U1', 260, 60, 0, OPA).w(['R1.b', 'U1.n']).gnd('U1.p', 260, 120);
  b.add('resistor', 'R2', 220, -40, 0, { R: 10e3 }).w(['U1.n', 'R2.a'], ['R2.b', 'U1.o']);
  b.label('VIN', 100, -20, 'R1.a').label('VOUT', 380, 80, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 1, ch2Div: 5, ch1Pos: 2, ch2Pos: -1.5, trig: 0 });
  return {
    id: 'opamp-inverting', topic: 'opamp', level: 'Temel', mood: 'info', xp: 70,
    title: 'Eviren Kuvvetlendirici',
    subtitle: 'A_v = −R2/R1; sanal toprak ve doyum',
    keywords: ['eviren', 'inverting', 'op-amp', 'sanal toprak', 'kazanç'],
    doc: b.doc('Eviren Kuvvetlendirici'),
    steps: [
      run('**▶ Başlat**. Giriş 0,5 V tepe (CH1), çıkış CH2.'),
      { id: 'q1', title: 'Kazanç', text: 'R1 = 1 kΩ, R2 = 10 kΩ', check: quiz('Çıkış tepe değeri ve fazı nedir?', ['5 V, 180° ters', '5 V, aynı faz', '0,5 V, ters', '5,5 V, aynı faz'], 'A_v = −R2/R1 = −10 → 0,5 V × 10 = 5 V, ters fazlı.'), xp: 15 },
      { id: 'q2', title: 'Sanal toprak', text: 'U1’i seç: V+ ve V− neredeyse eşit.', check: quiz('Eviren girişin (V−) gerilimi neden ~0 V’tur?', ['Negatif geri besleme V− ≈ V+ = 0 yapar', 'V− toprağa bağlı', 'R1 kısa devre', 'Op-amp girişi akım çekiyor'], 'Açık çevrim kazancı çok büyük (2·10⁵) olduğundan çıkış, V+ − V−’yi ~0 tutacak şekilde ayarlanır: sanal toprak.'), xp: 15 },
      { id: 's1', title: 'Doyum', text: '**R2**’yi **47 kΩ** yap.', check: { kind: 'param', comp: 'R2', param: 'R', op: '>=', value: 47e3 }, success: '0,5·47 = 23,5 V gerekirdi ama besleme ±15 V: çıkış ≈ ±13,5 V’ta kırpıldı (doyum).' },
    ],
    theory: 'İdeal op-amp kuralları: girişler akım çekmez, negatif geri beslemede V+ = V−. Eviren devrede V− = 0 (sanal toprak) → I = V_in/R1 = −V_out/R2 → A_v = −R2/R1. Giriş direnci R1’dir. Çıkış besleme raylarını aşamaz.',
  };
})();

const noninv: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 180, 0, { amp: 0.5, freq: 1000 }).gnd('VG1.n', 60, 260);
  b.add('opamp', 'U1', 260, 60, 0, OPA).w(['VG1.p', 'U1.p']);
  b.add('resistor', 'R1', 180, 100, 90, { R: 1000 }).gnd('R1.b', 200, 180).w(['U1.n', 'R1.a']);
  b.add('resistor', 'R2', 220, -40, 0, { R: 10e3 }).w(['U1.n', 'R2.a'], ['R2.b', 'U1.o']);
  b.add('switch', 'S1', 220, -120, 0, { closed: false }).w(['R2.a', 'S1.a'], ['R2.b', 'S1.b']);
  b.label('VIN', 100, 100, 'U1.p').label('VOUT', 380, 80, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 1, ch2Div: 5, ch1Pos: 2, ch2Pos: -1.5, trig: 0 });
  return {
    id: 'opamp-noninverting', topic: 'opamp', level: 'Temel', mood: 'point', xp: 70,
    title: 'Evirmeyen Kuvvetlendirici ve Gerilim İzleyici',
    subtitle: 'A_v = 1 + R2/R1; tampon (buffer) ile yükü ayır',
    keywords: ['evirmeyen', 'non-inverting', 'izleyici', 'buffer', 'tampon'],
    doc: b.doc('Evirmeyen Kuvvetlendirici'),
    steps: [
      run(),
      { id: 'q1', title: 'Kazanç', text: 'R1 = 1 kΩ, R2 = 10 kΩ', check: quiz('Gerilim kazancı kaçtır?', ['11', '10', '−10', '1'], 'A_v = 1 + R2/R1 = 11 → çıkış 5,5 V tepe, aynı fazda.'), xp: 15 },
      { id: 's1', title: 'İzleyici', text: '**S1**’i kapat: R2 kısa devre olur.', check: { kind: 'switch', comp: 'S1', closed: true }, success: 'A_v = 1: gerilim izleyici. Giriş direnci çok yüksek, çıkış direnci çok düşük → zayıf bir kaynağı yükten yalıtır.' },
    ],
    theory: 'Evirmeyen yapıda giriş V+’ya uygulanır; V− = V_out·R1/(R1+R2) = V_in → A_v = 1 + R2/R1. Giriş direnci op-amp girişi kadar yüksektir. R2 = 0 (veya R1 = ∞) için birim kazançlı izleyici elde edilir.',
  };
})();

const summing: Template = (() => {
  const b = new B();
  b.add('vac', 'V1', 40, 20, 0, { amp: 1, freq: 1000 }).gnd('V1.n', 60, 100);
  b.add('vdc', 'V2', 40, 180, 0, { V: 2 }).gnd('V2.n', 60, 260);
  b.add('resistor', 'R1', 100, 0, 0, { R: 10e3 }).add('resistor', 'R2', 100, 160, 0, { R: 10e3 });
  b.add('opamp', 'U1', 260, 80, 0, OPA).gnd('U1.p', 260, 140);
  b.add('resistor', 'RF', 220, -60, 0, { R: 10e3 });
  b.w(['V1.p', 'R1.a'], ['V2.p', 'R2.a'], ['R1.b', 'U1.n'], ['R2.b', 'U1.n'], ['U1.n', 'RF.a'], ['RF.b', 'U1.o']);
  b.label('VIN', 100, -80, 'R1.a').label('VOUT', 380, 100, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 1, ch2Div: 1, ch1Pos: 2, ch2Pos: 0, trig: 0 });
  return {
    id: 'opamp-summing', topic: 'opamp', level: 'Temel', mood: 'success', xp: 70,
    title: 'Toplayıcı (Ses Mikseri)',
    subtitle: 'V_out = −R_F·(V1/R1 + V2/R2)',
    keywords: ['toplayıcı', 'summing', 'mikser', 'ağırlıklı toplam', 'dac'],
    doc: b.doc('Toplayıcı'),
    steps: [
      run('**▶ Başlat**. V1: 1 V tepe sinüs, V2: 2 V DC.'),
      { id: 'q1', title: 'Çıkış', text: 'Tüm dirençler 10 kΩ.', check: quiz('Çıkış hangi aralıkta salınır?', ['−3 V ile −1 V arası', '1 V ile 3 V arası', '−1 V ile +1 V', '−2 V sabit'], 'V_out = −(v1 + 2) → v1 = ±1 V için −3 … −1 V (ortalama −2 V).'), xp: 15 },
      { id: 's1', title: 'Ağırlık', text: '**R2**’yi **20 kΩ** yap.', check: { kind: 'param', comp: 'R2', param: 'R', op: '>=', value: 20e3 }, success: 'V2’nin ağırlığı yarıya indi: V_out = −(v1 + 1). Dirençleri 2’nin kuvvetleriyle seçersen basit bir DAC elde edersin.' },
    ],
    theory: 'Eviren girişteki sanal toprak sayesinde her giriş bağımsız bir akım (V_i/R_i) üretir; akımlar toplanıp R_F’den geçer: V_out = −R_F·Σ(V_i/R_i). Girişler birbirini etkilemez. Ses mikserleri, ağırlıklı DAC’ler ve ofset ekleme devrelerinde kullanılır.',
  };
})();

const integrator: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 140, 0, { wave: 'square', amp: 1, freq: 1000 }).gnd('VG1.n', 60, 220);
  b.add('resistor', 'R1', 100, 60, 0, { R: 10e3 }).w(['VG1.p', 'R1.a']);
  b.add('opamp', 'U1', 260, 60, 0, TL081).w(['R1.b', 'U1.n']).gnd('U1.p', 260, 120);
  b.add('capacitor', 'C1', 220, -40, 0, { C: 100e-9, useIc: true, ic: 0 }).w(['U1.n', 'C1.a'], ['C1.b', 'U1.o']);
  b.add('resistor', 'RF', 220, -120, 0, { R: 1e6 }).w(['U1.n', 'RF.a'], ['RF.b', 'U1.o']);
  b.label('VIN', 100, -20, 'R1.a').label('VOUT', 380, 80, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 1, ch2Div: 0.2, ch1Pos: 2, ch2Pos: 0, trig: 0 });
  return {
    id: 'opamp-integrator', topic: 'opamp', level: 'Orta', mood: 'point', xp: 80,
    title: 'Op-amp İntegral Alıcı',
    subtitle: 'Kare dalgadan üçgen dalga; R_F’nin görevi',
    keywords: ['integral', 'integratör', 'üçgen', 'op-amp', 'miller'],
    doc: b.doc('Op-amp İntegral Alıcı'),
    steps: [
      run('**▶ Başlat**. Kare dalga girişi (CH1) üçgen çıkışa (CH2) dönüşür.'),
      { id: 'q1', title: 'Eğim', text: 'Girişin yarım periyodu 0,5 ms, |V_in| = 1 V', check: quiz('Çıkış üçgeninin tepeden tepeye değeri yaklaşık kaçtır?', ['0,5 V', '1 V', '5 V', '0,05 V'], 'Eğim = V_in/(RC) = 1/(10k·100n) = 1000 V/s → 0,5 ms’de 0,5 V.'), xp: 15 },
      { id: 'q2', title: 'R_F neden var?', text: 'C1’e paralel 1 MΩ.', check: quiz('Geri besleme kondansatörüne paralel R_F neden konur?', ['DC kazancı sınırlayıp ofset kaynaklı kaymayı (drift) önlemek', 'Frekansı artırmak', 'Giriş direncini düşürmek', 'Gereksiz'], 'İdeal integratörün DC kazancı sonsuzdur; küçük bir giriş ofseti bile çıkışı rayına sürer. R_F DC kazancı −R_F/R1 = −100 ile sınırlar.'), xp: 15 },
    ],
    theory: 'C geri beslemede: i = V_in/R1 = −C·dV_out/dt → V_out = −(1/R1C)∫V_in dt. Pratikte R_F ∥ C ile DC kazanç sınırlanır; devre f ≫ 1/(2πR_F C) için integral alır. Analog bilgisayarlar, PID denetleyiciler, dalga üreteçleri.',
  };
})();

const schmitt: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 140, 0, { amp: 5, freq: 100 }).gnd('VG1.n', 60, 220);
  b.add('opamp', 'U1', 260, 60, 0, OPA).w(['VG1.p', 'U1.n']);
  b.add('resistor', 'R1', 180, 140, 90, { R: 10e3 }).gnd('R1.b', 200, 220).w(['U1.p', 'R1.a']);
  b.add('resistor', 'R2', 260, 240, 0, { R: 100e3 }).w(['U1.p', 'R2.a'], ['R2.b', 'U1.o']);
  b.label('VIN', 140, 20, 'U1.n').label('VOUT', 380, 80, 'U1.o');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 2e-3, ch1Div: 2, ch2Div: 10, ch1Pos: 1.5, ch2Pos: -1.5, trig: 0 });
  return {
    id: 'opamp-schmitt', topic: 'opamp', level: 'Orta', mood: 'surprised', xp: 80,
    title: 'Karşılaştırıcı ve Schmitt Tetikleyici',
    subtitle: 'Pozitif geri beslemeyle histerezis: gürültüye bağışık eşikler',
    keywords: ['schmitt', 'histerezis', 'karşılaştırıcı', 'comparator', 'eşik'],
    doc: b.doc('Schmitt Tetikleyici'),
    steps: [
      run('**▶ Başlat**. Çıkış ±13,5 V arasında atlar; atlama anlarındaki giriş gerilimine bak.'),
      { id: 'q1', title: 'Eşikler', text: 'β = R1/(R1+R2) = 10k/110k', check: quiz('Üst ve alt eşik gerilimleri yaklaşık kaçtır?', ['±1,23 V', '±13,5 V', '0 V', '±5 V'], 'V_eşik = ±V_sat·β = ±13,5·0,091 ≈ ±1,23 V. Giriş +1,23 V’u geçince çıkış −13,5 V’a, −1,23 V’un altına inince +13,5 V’a atlar.'), xp: 15 },
      { id: 's1', title: 'Histerezisi büyüt', text: '**R2**’yi **47 kΩ** yap.', check: { kind: 'param', comp: 'R2', param: 'R', op: '<=', value: 47e3 }, success: 'β = 10/57 → eşikler ±2,4 V. Histerezis genişledi: gürültülü sinyallerde yanlış tetiklemeyi önler.' },
    ],
    theory: 'Pozitif geri beslemeli karşılaştırıcıda eşik çıkışa bağlıdır: V_T± = ±V_sat·R1/(R1+R2). İki eşik arasındaki fark (histerezis) gürültünün çıkışı titretmesini engeller. Termostatlar, buton okuma, dalga şekillendirme.',
  };
})();

// ───────────── Osilatörler ─────────────
function timer555(b: B) {
  b.add('vdc', 'VCC', 40, 100, 0, { V: 9 }).gnd('VCC.n', 60, 180);
  b.add('timer555', 'U1', 300, 100).gnd('U1.gnd', 360, 200);
  b.w(['VCC.p', 'U1.vcc'], ['VCC.p', 'U1.reset']);
  b.add('capacitor', 'C2', 280, 220, 90, { C: 10e-9 }).gnd('C2.b', 300, 300).w(['U1.ctrl', 'C2.a']);
  b.add('resistor', 'RLED', 540, 120, 0, { R: 470 }).w(['U1.out', 'RLED.a']);
  b.add('led', 'LED1', 640, 160, 90, { color: 'red' }).gnd('LED1.k', 660, 240).w(['RLED.b', 'LED1.a']);
}

const astable555: Template = (() => {
  const b = new B();
  timer555(b);
  b.add('resistor', 'R1', 460, 0, 90, { R: 1e3 }).add('resistor', 'R2', 460, 120, 90, { R: 10e3 });
  b.add('capacitor', 'C1', 200, 180, 90, { C: 10e-6 }).gnd('C1.b', 220, 260);
  b.w(['VCC.p', 'R1.a'], ['R1.b', 'U1.dis'], ['U1.dis', 'R2.a'], ['R2.b', 'U1.thr'], ['U1.thr', 'U1.trig'], ['U1.trig', 'C1.a']);
  b.label('VC', 120, 160, 'C1.a').label('OUT', 420, 60, 'U1.out');
  b.scope(720, 0, 'VC', 'OUT', { timeDiv: 50e-3, ch1Div: 2, ch2Div: 5, ch1Pos: 0, ch2Pos: -3, trig: 4 });
  return {
    id: '555-astable', topic: 'osc', level: 'Temel', mood: 'success', xp: 80,
    title: '555 Astable: LED Flaşör',
    subtitle: 'İki direnç + bir kondansatörle kare dalga osilatörü',
    keywords: ['555', 'astable', 'flaşör', 'osilatör', 'zamanlayıcı', 'kare dalga'],
    doc: b.doc('555 Astable'),
    steps: [
      run('**▶ Başlat**. C1, Vcc/3 ile 2Vcc/3 arasında dolup boşalır; LED yanıp söner.'),
      { id: 'q1', title: 'Frekans', text: 'R1 = 1 kΩ, R2 = 10 kΩ, C = 10 µF', check: quiz('Osilasyon frekansı yaklaşık kaçtır?', ['≈ 6,9 Hz', '≈ 69 Hz', '≈ 0,69 Hz', '≈ 14 Hz'], 'f = 1,44/((R1 + 2R2)·C) = 1,44/(21k·10µ) ≈ 6,9 Hz.'), xp: 15 },
      { id: 'q2', title: 'Doluluk', text: 'Şarj R1+R2, deşarj yalnızca R2 üzerinden.', check: quiz('Doluluk oranı (çıkışın yüksek kaldığı oran) yaklaşık nedir?', ['%52', '%50', '%91', '%9'], 'D = (R1+R2)/(R1+2R2) = 11/21 ≈ %52. Klasik 555 astable’ında D > %50 olur.'), xp: 15 },
      { id: 's1', title: 'Hızlandır', text: '**C1**’i **1 µF** yap.', check: { kind: 'param', comp: 'C1', param: 'C', op: '<=', value: 1e-6 }, success: 'f ≈ 69 Hz: göz artık yanıp sönmeyi göremez (kalıcılık ~50 Hz). Zaman/böl.’ü 5 ms’ye indir.' },
    ],
    theory: '555 içinde 3×5 kΩ bölücü, iki karşılaştırıcı (Vcc/3 ve 2Vcc/3) ve bir SR mandal vardır. Kondansatör R1+R2 üzerinden 2Vcc/3’e dolar (t_H = 0,693(R1+R2)C), sonra DIS ile R2 üzerinden Vcc/3’e boşalır (t_L = 0,693R2C).',
  };
})();

const mono555: Template = (() => {
  const b = new B();
  timer555(b);
  b.add('resistor', 'RPU', 220, 20, 90, { R: 10e3 }).w(['VCC.p', 'RPU.a'], ['RPU.b', 'U1.trig']);
  b.add('button', 'BTN1', 220, 160, 90, { kind: 'NO' }).gnd('BTN1.b', 240, 240).w(['U1.trig', 'BTN1.a']);
  b.add('resistor', 'R1', 460, 0, 90, { R: 100e3 }).w(['VCC.p', 'R1.a'], ['R1.b', 'U1.dis'], ['R1.b', 'U1.thr']);
  b.add('capacitor', 'C1', 460, 200, 90, { C: 10e-6 }).gnd('C1.b', 480, 280).w(['R1.b', 'C1.a']);
  b.label('VC', 520, 160, 'C1.a').label('OUT', 420, 60, 'U1.out');
  b.scope(720, 0, 'VC', 'OUT', { timeDiv: 0.2, ch1Div: 2, ch2Div: 5, ch1Pos: 0, ch2Pos: -3, trig: 4 });
  return {
    id: '555-monostable', topic: 'osc', level: 'Temel', mood: 'point', xp: 80,
    title: '555 Monostable: Tek Atımlık Zamanlayıcı',
    subtitle: 'Butona bas → LED T = 1,1·R·C süre yansın',
    keywords: ['555', 'monostable', 'tek atım', 'zamanlayıcı', 'gecikme'],
    doc: b.doc('555 Monostable'),
    steps: [
      run('**▶ Başlat**. TRIG pull-up ile yüksek tutuluyor; çıkış düşük.'),
      { id: 's1', title: 'Tetikle', text: '**BTN1**’e canvas’ta basılı tut (kısa bir an yeter).', check: { kind: 'param', comp: 'BTN1', param: 'pressed', op: '==', value: true }, success: 'TRIG Vcc/3’ün altına indi → çıkış yüksek, C1 dolmaya başladı.' },
      { id: 'q1', title: 'Süre', text: 'R1 = 100 kΩ, C1 = 10 µF', check: quiz('LED ne kadar süre yanar?', ['≈ 1,1 s', '≈ 0,69 s', '≈ 11 s', '≈ 0,1 s'], 'T = 1,1·R·C = 1,1·100k·10µ = 1,1 s. C1, 2Vcc/3’e ulaşınca mandal sıfırlanır.'), xp: 15 },
      { id: 's2', title: 'Uzat', text: '**R1**’i **220 kΩ** yap ve tekrar tetikle.', check: { kind: 'param', comp: 'R1', param: 'R', op: '>=', value: 220e3 }, success: 'T ≈ 2,4 s. Merdiven otomatiği, buton arkı giderme, darbe genişletme…' },
    ],
    theory: 'Monostable modda TRIG’e gelen kısa düşük darbe çıkışı yükseltir ve DIS transistörünü keser; C, R üzerinden dolar. V_C = 2Vcc/3 olunca THR karşılaştırıcısı mandalı sıfırlar: T = RC·ln3 ≈ 1,1RC. TRIG’deki pull-up direnci butonsuz anda girişi tanımlı (yüksek) tutar.',
  };
})();

const bjtAstable: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, 0, 0, { V: 9 }).gnd('VCC.n', 40, 80);
  b.add('resistor', 'RC1', 160, 0, 90, { R: 470 }).add('led', 'LED1', 160, 100, 90, { color: 'red' });
  b.add('npn', 'Q1', 140, 200, 0, { model: 'genel', beta: 100 }).gnd('Q1.e', 180, 280);
  b.add('resistor', 'RC2', 520, 0, 90, { R: 470 }).add('led', 'LED2', 520, 100, 90, { color: 'green' });
  b.add('npn', 'Q2', 500, 200, 0, { model: 'genel', beta: 100 }).gnd('Q2.e', 540, 280);
  b.add('resistor', 'RB1', 80, 100, 90, { R: 47e3 }).add('resistor', 'RB2', 620, 100, 90, { R: 47e3 });
  b.add('capacitor', 'C1', 300, 180, 0, { C: 10e-6, useIc: true, ic: 1 }).add('capacitor', 'C2', 300, 280, 0, { C: 10e-6 });
  b.w(
    ['VCC.p', 'RC1.a'], ['VCC.p', 'RC2.a'], ['VCC.p', 'RB1.a'], ['VCC.p', 'RB2.a'],
    ['RC1.b', 'LED1.a'], ['LED1.k', 'Q1.c'], ['RC2.b', 'LED2.a'], ['LED2.k', 'Q2.c'],
    ['RB1.b', 'Q1.b'], ['RB2.b', 'Q2.b'],
    ['Q1.c', 'C1.a'], ['C1.b', 'Q2.b'], ['Q1.b', 'C2.a'], ['C2.b', 'Q2.c'],
  );
  b.label('VC1', 220, 180, 'Q1.c').label('VB2', 440, 260, 'Q2.b');
  b.scope(720, 0, 'VC1', 'VB2', { timeDiv: 0.2, ch1Div: 5, ch2Div: 5, ch1Pos: 0.5, ch2Pos: -1, trig: 4 });
  return {
    id: 'bjt-astable', topic: 'osc', level: 'Orta', mood: 'hello', xp: 90,
    title: 'Astable Multivibratör (Yanıp Sönen LED’ler)',
    subtitle: 'İki transistör, iki kondansatör: sırayla yanan LED’ler',
    keywords: ['multivibratör', 'astable', 'flip flop', 'yanıp sönen', 'transistör osilatör'],
    doc: b.doc('Astable Multivibratör'),
    steps: [
      run('**▶ Başlat**. LED’ler sırayla yanar. CH2’de Q2 tabanının yaklaşık −6 V’a inip RB2 üzerinden yeniden dolduğunu gör.'),
      { id: 'q1', title: 'Frekans', text: 'Her yarım periyot ≈ 0,69·R_B·C', check: quiz('Yanıp sönme frekansı yaklaşık kaçtır?', ['≈ 1,5 Hz', '≈ 15 Hz', '≈ 0,15 Hz', '≈ 150 Hz'], 'T ≈ 2·0,69·47k·10µ ≈ 0,65 s → f ≈ 1,5 Hz.'), xp: 15 },
      { id: 's1', title: 'Asimetri', text: '**C1**’i **4,7 µF** yap.', check: { kind: 'param', comp: 'C1', param: 'C', op: '<=', value: 4.7e-6 }, success: 'Bir LED daha kısa yanıyor: her yarım periyot kendi R_B·C çiftine bağlıdır.' },
    ],
    theory: 'Bir transistör iletime geçince kolektörü ~0 V’a iner; bu düşüş kondansatör üzerinden diğer transistörün tabanını yaklaşık −Vcc’ye çeker ve keser. Taban, R_B üzerinden 0,7 V’a dolunca transistör iletir ve roller değişir. t ≈ 0,693·R_B·C.',
  };
})();

const relax: Template = (() => {
  const b = new B();
  b.add('opamp', 'U1', 300, 100, 0, OPA);
  b.add('capacitor', 'C1', 200, 140, 90, { C: 100e-9, useIc: true, ic: 0 }).gnd('C1.b', 220, 220).w(['U1.n', 'C1.a']);
  b.add('resistor', 'R', 260, 0, 0, { R: 10e3 }).w(['U1.n', 'R.a'], ['R.b', 'U1.o']);
  b.add('resistor', 'R1', 240, 200, 90, { R: 10e3 }).gnd('R1.b', 260, 280).w(['U1.p', 'R1.a']);
  b.add('resistor', 'R2', 300, 240, 0, { R: 10e3 }).w(['U1.p', 'R2.a'], ['R2.b', 'U1.o']);
  b.label('VC', 120, 100, 'C1.a').label('OUT', 420, 120, 'U1.o');
  b.scope(540, 0, 'VC', 'OUT', { timeDiv: 0.5e-3, ch1Div: 5, ch2Div: 10, ch1Pos: 1, ch2Pos: -1.5, trig: 0 });
  return {
    id: 'opamp-relaxation', topic: 'osc', level: 'Orta', mood: 'surprised', xp: 90,
    title: 'Op-amp Gevşemeli Osilatör',
    subtitle: 'Schmitt tetikleyici + RC = kare dalga üreteci',
    keywords: ['gevşemeli', 'relaxation', 'osilatör', 'kare dalga', 'schmitt'],
    doc: b.doc('Gevşemeli Osilatör'),
    steps: [
      run('**▶ Başlat**. C1, ±β·V_sat eşikleri arasında dolup boşalır.'),
      { id: 'q1', title: 'Frekans', text: 'β = R1/(R1+R2) = 0,5', check: quiz('Frekans yaklaşık kaçtır?', ['≈ 455 Hz', '≈ 1 kHz', '≈ 159 Hz', '≈ 4,5 kHz'], 'T = 2RC·ln((1+β)/(1−β)) = 2·10k·100n·ln3 ≈ 2,2 ms → f ≈ 455 Hz.'), xp: 15 },
      { id: 's1', title: 'Yavaşlat', text: '**R**’yi **22 kΩ** yap.', check: { kind: 'param', comp: 'R', param: 'R', op: '>=', value: 22e3 }, success: 'Frekans R ile ters orantılı düştü (≈ 207 Hz).' },
    ],
    theory: 'Op-amp, eşikleri ±β·V_sat olan bir Schmitt tetikleyicidir. Çıkış R üzerinden C’yi doldurur; V_C eşiği geçince çıkış ters döner. Yarım periyot = RC·ln((1+β)/(1−β)). LM741’in 0,5 V/µs’lik slew rate’i köşeleri yuvarlar.',
  };
})();

// ───────────── Güç ─────────────
const linearPsu: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 120, 0, { amp: 311, freq: 50 }).gnd('VG1.n', 40, 200);
  b.add('xfmr', 'T1', 120, 120, 0, { n: 15 }).w(['VG1.p', 'T1.p1'], ['T1.p2', 'VG1.n']);
  b.add('diode', 'D1', 280, 40, 0, D4001).add('diode', 'D3', 280, 120, 180, D4001);
  b.add('diode', 'D2', 280, 260, 0, D4001).add('diode', 'D4', 280, 340, 180, D4001);
  b.w(['T1.s1', 'D1.a'], ['T1.s1', 'D3.k'], ['T1.s2', 'D2.a'], ['T1.s2', 'D4.k']);
  b.gnd('D3.a', 360, 140).gnd('D4.a', 360, 360);
  b.add('capacitor', 'C1', 440, 100, 90, { C: 1000e-6 }).gnd('C1.b', 460, 180).w(['D1.k', 'C1.a'], ['D2.k', 'C1.a']);
  b.add('reg78', 'U1', 520, 80, 0, { Vout: 5 }).gnd('U1.gnd', 560, 140).w(['C1.a', 'U1.in']);
  b.add('resistor', 'RL', 640, 120, 90, { R: 50 }).gnd('RL.b', 660, 200).w(['U1.out', 'RL.a']);
  b.label('VRAW', 460, 0, 'C1.a').label('VOUT', 660, 20, 'RL.a');
  b.scope(780, 0, 'VRAW', 'VOUT', { timeDiv: 5e-3, ch1Div: 5, ch2Div: 5, ch1Pos: -2, ch2Pos: -3, trig: 10 });
  return {
    id: 'linear-psu', topic: 'power', level: 'Orta', mood: 'success', xp: 100,
    title: 'Doğrusal Güç Kaynağı (5 V)',
    subtitle: 'Trafo → köprü → filtre → 7805: bir adaptörün içi',
    keywords: ['güç kaynağı', 'adaptör', '7805', 'regülatör', 'ripple', 'filtre'],
    doc: b.doc('Doğrusal Güç Kaynağı'),
    steps: [
      run('**▶ Başlat**. CH1 filtre çıkışı (dalgalı DC), CH2 regüle 5 V.'),
      { id: 'q1', title: 'Dalgalanma', text: 'I_yük = 5 V/50 Ω = 0,1 A, C = 1000 µF, tam dalga 100 Hz', check: quiz('Filtre çıkışındaki dalgalanma (V_r) yaklaşık kaçtır?', ['≈ 1 V', '≈ 10 V', '≈ 0,1 V', '≈ 0 V'], 'V_r ≈ I/(2fC) = 0,1/(100·1m) = 1 V. 7805 bunu çıkışta neredeyse tamamen bastırır.'), xp: 15 },
      { id: 'q2', title: 'Isınma', text: 'Filtre çıkışı ≈ 18,5 V ortalama.', check: quiz('7805 üzerinde harcanan güç yaklaşık kaçtır?', ['≈ 1,35 W', '≈ 0,5 W', '≈ 5 W', '≈ 0 W'], 'P = (V_in − V_out)·I ≈ (18,5 − 5)·0,1 ≈ 1,35 W → soğutucu gerekir. Doğrusal regülatörün verimi burada %27!'), xp: 15 },
      { id: 's1', title: 'Yükü artır', text: '**RL**’yi **25 Ω** yap (200 mA).', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 25 }, success: 'Dalgalanma ~2 V’a çıktı ama çıkış hâlâ 5 V: dalganın dibi 7 V’un (5 V + 2 V düşüm) üstünde kaldığı sürece regülasyon sürer.' },
    ],
    theory: 'Klasik doğrusal kaynak: trafo gerilimi düşürüp yalıtır, köprü doğrultur, kondansatör tepe değeri tutar (V_r ≈ I/(2fC)), regülatör sabit çıkış verir. Regülatörün girişi her an V_out + V_düşüm’ün üstünde olmalı. Kayıp P = (V_in − V_out)·I ısı olarak çıkar.',
  };
})();

const buck: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 40, 0, { V: 12 }).gnd('V1.n', 40, 120);
  b.add('pmos', 'M1', 160, 0, 0, { model: 'IRF9540', Vth: 3.5, K: 2, lambda: 0.005 }).w(['V1.p', 'M1.s']);
  b.add('clock', 'CLK1', 60, -140, 0, { freq: 20000, duty: 0.5, V: 12 }).w(['CLK1.p', 'V1.p'], ['CLK1.n', 'M1.g']);
  b.add('diode', 'D1', 180, 100, 270, D5819).gnd('D1.a', 200, 180).w(['M1.d', 'D1.k']);
  b.add('inductor', 'L1', 300, 60, 0, { L: 220e-6 }).w(['M1.d', 'L1.a']);
  b.add('capacitor', 'C1', 420, 100, 90, { C: 100e-6 }).gnd('C1.b', 440, 180).w(['L1.b', 'C1.a']);
  b.add('resistor', 'RL', 500, 100, 90, { R: 10 }).gnd('RL.b', 520, 180).w(['C1.a', 'RL.a']);
  b.label('SW', 280, -20, 'M1.d').label('VOUT', 560, 80, 'RL.a');
  b.scope(660, 0, 'SW', 'VOUT', { timeDiv: 1e-3, ch1Div: 5, ch2Div: 2, ch1Pos: 0.5, ch2Pos: -3.5, trig: 6 });
  return {
    id: 'buck', topic: 'power', level: 'İleri', mood: 'point', xp: 110,
    title: 'Buck (Düşürücü) DC–DC Dönüştürücü',
    subtitle: '12 V → ~6 V, anahtarlamalı ve yüksek verimli',
    keywords: ['buck', 'dc-dc', 'düşürücü', 'anahtarlamalı', 'smps', 'pwm'],
    doc: b.doc('Buck Dönüştürücü'),
    steps: [
      run('**▶ Başlat**. Çıkışın LC filtreyle birkaç ms’de oturduğunu izle (CH2).'),
      { id: 'q1', title: 'Çıkış', text: 'D = 0,5, V_in = 12 V', check: quiz('İdeal buck çıkışı nedir?', ['V_out = D·V_in = 6 V', '12 V', '24 V', '3 V'], 'Endüktörün volt-saniye dengesi: (V_in − V_out)·D·T = V_out·(1−D)·T → V_out = D·V_in. Diyot ve anahtar düşümleri nedeniyle biraz altında kalır.'), xp: 15 },
      { id: 's1', title: 'Doluluk', text: '**CLK1**’in doluluk oranını **%30** yap.', check: { kind: 'param', comp: 'CLK1', param: 'duty', op: '<=', value: 0.3 }, success: 'V_out ≈ 3,6 V. Gerçek kaynaklarda bir geri besleme döngüsü D’yi otomatik ayarlar.' },
      { id: 'q2', title: 'Verim', text: 'Doğrusal regülatörle karşılaştır.', check: quiz('Buck neden doğrusal regülatörden daha verimlidir?', ['Anahtar ya tam açık ya kapalı; enerji L ve C’de depolanıp aktarılır', 'Daha az bileşeni var', 'Trafo kullanır', 'Akımı sınırlar'], 'İdealde kayıpsızdır; pratikte %85–95 verim. Doğrusal regülatörde fark gerilim × akım ısıya gider.'), xp: 15 },
    ],
    theory: 'Buck dönüştürücü: anahtar açıkken endüktör akımı artar ve enerji depolar, kapalıyken serbest geçiş diyodu üzerinden yüke aktarır. Sürekli iletim modunda V_out = D·V_in. LC filtre anahtarlama frekansını süzer; dalgalanma ΔI_L = (V_in − V_out)·D/(f·L).',
  };
})();

const boost: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 40, 0, { V: 5 }).gnd('V1.n', 40, 120);
  b.add('inductor', 'L1', 100, 20, 0, { L: 100e-6 }).w(['V1.p', 'L1.a']);
  b.add('nmos', 'M1', 160, 80, 0, { model: 'IRF540', Vth: 3.5, K: 3, lambda: 0.005 }).w(['L1.b', 'M1.d']).gnd('M1.s', 200, 160);
  b.add('clock', 'CLK1', 60, 160, 0, { freq: 20000, duty: 0.5, V: 10 }).gnd('CLK1.n', 80, 240).w(['CLK1.p', 'M1.g']);
  b.add('diode', 'D1', 240, 20, 0, D5819).w(['L1.b', 'D1.a']);
  b.add('capacitor', 'C1', 340, 60, 90, { C: 100e-6 }).gnd('C1.b', 360, 140).w(['D1.k', 'C1.a']);
  b.add('resistor', 'RL', 420, 60, 90, { R: 22 }).gnd('RL.b', 440, 140).w(['C1.a', 'RL.a']);
  b.label('SW', 260, 120, 'M1.d').label('VOUT', 480, 40, 'RL.a');
  b.scope(560, 0, 'SW', 'VOUT', { timeDiv: 2e-3, ch1Div: 5, ch2Div: 5, ch1Pos: 0.5, ch2Pos: -3.5, trig: 5 });
  return {
    id: 'boost', topic: 'power', level: 'İleri', mood: 'surprised', xp: 110,
    title: 'Boost (Yükseltici) DC–DC Dönüştürücü',
    subtitle: '5 V → ~10 V: endüktörle gerilim yükseltme',
    keywords: ['boost', 'yükseltici', 'dc-dc', 'step up', 'anahtarlamalı'],
    doc: b.doc('Boost Dönüştürücü'),
    steps: [
      run('**▶ Başlat**. Çıkışın 5 V’un üstüne çıkışını izle.'),
      { id: 'q1', title: 'Çıkış', text: 'D = 0,5, V_in = 5 V', check: quiz('İdeal boost çıkışı nedir?', ['V_in/(1 − D) = 10 V', 'D·V_in = 2,5 V', '5 V', '20 V'], 'Anahtar kapalıyken L, V_in ile dolar; açılınca L’nin gerilimi V_in’e eklenip diyottan yüke akar: V_out = V_in/(1−D).'), xp: 15 },
      { id: 's1', title: 'Daha yüksek', text: '**CLK1**’in doluluk oranını **%70** yap.', check: { kind: 'param', comp: 'CLK1', param: 'duty', op: '>=', value: 0.7 }, success: 'V_out ≈ 16 V’a doğru çıkıyor (kayıplar nedeniyle biraz altında). D → 1 iken kayıplar patlar; pratik sınır ~%80–90.' },
    ],
    theory: 'Boost dönüştürücüde anahtar iletimdeyken endüktör akımı V_in/L eğimiyle artar. Anahtar açılınca endüktör akımını sürdürmek için gerilimini ters çevirir ve V_in + V_L diyot üzerinden çıkışa aktarılır. V_out = V_in/(1−D). LED sürücüleri, pil ile çalışan cihazlar, güneş paneli MPPT.',
  };
})();

// ───────────── Dijital ─────────────
const logicGates: Template = (() => {
  const b = new B();
  b.add('logicin', 'A', 20, 60).add('logicin', 'B', 20, 240);
  const gates: [string, string, number][] = [['and', 'G1', 0], ['or', 'G2', 100], ['xor', 'G3', 200], ['nand', 'G4', 300]];
  for (const [t, n, y] of gates) {
    b.add(t as 'and', n, 220, y).add('logicprobe', `P_${n}`, 360, y + 20);
    b.w(['A.y', `${n}.a`], ['B.y', `${n}.b`], [`${n}.y`, `P_${n}.a`]);
  }
  return {
    id: 'logic-gates', topic: 'digital', level: 'Isınma', mood: 'hello', xp: 60,
    title: 'Mantık Kapıları ve Doğruluk Tablosu',
    subtitle: 'AND, OR, XOR, NAND — anahtarlarla dene',
    keywords: ['mantık kapıları', 'and', 'or', 'xor', 'nand', 'doğruluk tablosu', 'boolean'],
    doc: b.doc('Mantık Kapıları'),
    steps: [
      run('**▶ Başlat**. A ve B anahtarlarına çift tıklayarak 0/1 yap; göstergeler (P) çıkışları gösterir.'),
      { id: 's1', title: 'A = 1', text: '**A**’yı **1** yap.', check: { kind: 'param', comp: 'A', param: 'on', op: '==', value: true } },
      { id: 's2', title: 'B = 1', text: '**B**’yi de **1** yap.', check: { kind: 'param', comp: 'B', param: 'on', op: '==', value: true } },
      { id: 'q1', title: 'XOR', text: 'G3 göstergesine bak.', check: quiz('A = 1, B = 1 iken XOR çıkışı nedir?', ['0', '1', 'Belirsiz', '2'], 'XOR yalnızca girişler farklıysa 1’dir: 1 ⊕ 1 = 0. Toplamada “eldesiz toplam” bitidir.'), xp: 15 },
      { id: 'q2', title: 'Evrensel kapı', text: 'NAND’ı düşün.', check: quiz('Neden NAND “evrensel kapı” olarak adlandırılır?', ['Yalnızca NAND kullanarak tüm mantık fonksiyonları kurulabilir', 'En hızlı kapıdır', 'Hiç güç harcamaz', 'Üç girişlidir'], 'NOT = NAND(A,A), AND = NOT(NAND), OR = NAND(¬A,¬B). Bu yüzden CMOS üretiminde temel yapı taşıdır.'), xp: 15 },
    ],
    theory: 'AND: tüm girişler 1 ise 1. OR: en az biri 1 ise 1. XOR: girişler farklıysa 1. NAND/NOR evrenseldir. Pozitif mantıkta 5 V = 1, 0 V = 0. Gerçek kapılarda eşik civarındaki girişler belirsizdir.',
  };
})();

const pullDown: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, 0, 0, { V: 5 }).gnd('VCC.n', 40, 80);
  b.add('button', 'BTN1', 120, 40, 90, { kind: 'NO' }).w(['VCC.p', 'BTN1.a']);
  b.add('not', 'N1', 240, 100).w(['BTN1.b', 'N1.a']);
  b.add('logicprobe', 'P_IN', 160, 140).w(['BTN1.b', 'P_IN.a']);
  b.add('logicprobe', 'P_OUT', 380, 100).w(['N1.y', 'P_OUT.a']);
  b.add('switch', 'S1', 120, 180, 90, { closed: false }).w(['BTN1.b', 'S1.a']);
  b.add('resistor', 'RPD', 120, 280, 90, { R: 10e3 }).gnd('RPD.b', 140, 360).w(['S1.b', 'RPD.a']);
  b.label('IN', 300, 20, 'N1.a');
  return {
    id: 'pullup-pulldown', topic: 'digital', level: 'Isınma', mood: 'surprised', xp: 70,
    title: 'Buton, Pull-Down ve Pull-Up Direnci',
    subtitle: 'Boşta kalan giriş neden tehlikeli? 10 kΩ ile çözüm',
    keywords: ['pull-down', 'pull-up', 'buton', 'boşta giriş', 'floating', 'mikrodenetleyici'],
    doc: b.doc('Pull-Down Direnci'),
    steps: [
      run('**▶ Başlat**. S1 açık: pull-down direnci bağlı değil. P_IN göstergesi **?** gösteriyor.'),
      { id: 'q1', title: 'Neden belirsiz?', text: 'Buton açıkken N1 girişi hiçbir yere bağlı değil.', check: quiz('Buton basılı değilken giriş neden belirsizdir?', ['Giriş boşta (floating); yüksek empedanslı olduğundan gürültü ve kaçak akımla rastgele seviyeye süzülür', 'Buton bozuk', 'VCC düşük', 'Kapı arızalı'], 'CMOS girişi pratikte akım çekmez; bağlantısız kaldığında elektrostatik gürültü ve kaçak akımlar onu 0 ile 1 arasında gezdirir. Gerçek devrede çıkış titrer ve güç tüketimi artar.'), xp: 15 },
      { id: 's1', title: 'Pull-down bağla', text: '**S1**’i kapat: girişi 10 kΩ ile toprağa “çek”.', check: { kind: 'switch', comp: 'S1', closed: true }, success: 'Giriş artık kesin 0: P_IN = 0, çıkış (NOT) = 1.' },
      { id: 's2', title: 'Butona bas', text: '**BTN1**’e basılı tut.', check: { kind: 'param', comp: 'BTN1', param: 'pressed', op: '==', value: true }, success: 'Basınca giriş 5 V (buton, 10 kΩ’dan çok daha güçlü). Bırakınca direnç girişi tekrar 0’a çeker.' },
      { id: 'q2', title: 'Pull-up', text: 'Bunun tersi de mümkün.', check: quiz('Pull-up kullanırsan buton nereye bağlanır ve basınca giriş ne olur?', ['Toprağa; basınca 0 (aktif-düşük)', 'VCC’ye; basınca 1', 'Hiçbir yere', 'Çıkışa'], 'Pull-up girişi VCC’ye çeker, buton toprağa kısa devre eder → basılıyken 0. Mikrodenetleyicilerde dahili pull-up’lar bu yüzden yaygındır.'), xp: 15 },
    ],
    theory: 'Dijital girişler yüksek empedanslıdır; bağlantısız (floating) kaldıklarında seviye tanımsızdır. Pull-down direnci girişi zayıfça 0’a, pull-up direnci 1’e çeker; buton bu zayıf çekişi kolayca yener. Tipik değer 4,7–47 kΩ: küçük değer gürültüye dayanıklı ama basılıyken fazla akım çeker (5 V/10 kΩ = 0,5 mA).',
  };
})();

const halfAdder: Template = (() => {
  const b = new B();
  b.add('logicin', 'A', 20, 40).add('logicin', 'B', 20, 160);
  b.add('xor', 'G1', 220, 20).add('and', 'G2', 220, 140);
  b.add('logicprobe', 'S', 360, 40).add('logicprobe', 'CARRY', 360, 160);
  b.w(['A.y', 'G1.a'], ['B.y', 'G1.b'], ['A.y', 'G2.a'], ['B.y', 'G2.b'], ['G1.y', 'S.a'], ['G2.y', 'CARRY.a']);
  return {
    id: 'half-adder', topic: 'digital', level: 'Temel', mood: 'info', xp: 60,
    title: 'Yarım Toplayıcı',
    subtitle: 'XOR + AND ile iki biti topla',
    keywords: ['toplayıcı', 'half adder', 'xor', 'elde', 'carry', 'aritmetik'],
    doc: b.doc('Yarım Toplayıcı'),
    steps: [
      run(),
      { id: 's1', title: '1 + 1', text: '**A** ve **B**’yi 1 yap.', check: { kind: 'param', comp: 'B', param: 'on', op: '==', value: true } },
      { id: 'q1', title: 'Sonuç', text: 'S ve CARRY göstergelerine bak.', check: quiz('1 + 1 işleminin sonucu (CARRY, S) nedir?', ['(1, 0) = ikilik 10', '(0, 1)', '(1, 1)', '(0, 0)'], 'Toplam S = A ⊕ B = 0, elde C = A·B = 1 → 10₂ = 2. Tam toplayıcı bir de önceki eldeyi ekler; n tanesi zincirlenince n bitlik toplayıcı olur.'), xp: 15 },
    ],
    theory: 'Yarım toplayıcı: S = A ⊕ B, C = A·B. Önceki basamaktan gelen eldeyi de toplamak için iki yarım toplayıcı + OR kapısıyla tam toplayıcı kurulur. İşlemcilerin aritmetik birimi (ALU) bu yapıların gelişmiş hâlleridir.',
  };
})();

const srLatch: Template = (() => {
  const b = new B();
  b.add('logicin', 'R', 20, 40).add('logicin', 'S', 20, 240);
  b.add('nor', 'N1', 220, 40).add('nor', 'N2', 220, 200);
  b.add('logicprobe', 'Q', 380, 60).add('logicprobe', 'QN', 380, 220);
  b.w(['R.y', 'N1.a'], ['N2.y', 'N1.b'], ['S.y', 'N2.b'], ['N1.y', 'N2.a'], ['N1.y', 'Q.a'], ['N2.y', 'QN.a']);
  return {
    id: 'sr-latch', topic: 'digital', level: 'Temel', mood: 'point', xp: 70,
    title: 'SR Mandal (NOR ile 1 Bit Bellek)',
    subtitle: 'Geri besleme = hafıza',
    keywords: ['sr latch', 'mandal', 'bellek', 'nor', 'flip flop', 'set reset'],
    doc: b.doc('SR Mandal'),
    steps: [
      run('**▶ Başlat**. Açılışta Q belirsiz olabilir — gerçek devrelerde de öyledir.'),
      { id: 's1', title: 'Set', text: '**S**’yi 1 yap.', check: { kind: 'param', comp: 'S', param: 'on', op: '==', value: true }, success: 'Q = 1.' },
      { id: 's2', title: 'Hatırla', text: '**S**’yi tekrar 0 yap. Q ne oldu?', check: { kind: 'param', comp: 'S', param: 'on', op: '==', value: false }, success: 'Q hâlâ 1: devre durumunu hatırlıyor!' },
      { id: 's3', title: 'Reset', text: '**R**’yi 1 yap.', check: { kind: 'param', comp: 'R', param: 'on', op: '==', value: true }, success: 'Q = 0.' },
      { id: 'q1', title: 'Yasak durum', text: 'S = R = 1 ne olur?', check: quiz('NOR SR mandalında S = R = 1 neden “yasak”tır?', ['Q = Q̄ = 0 olur; ikisi aynı anda bırakılınca sonuç belirsizdir', 'Devre yanar', 'Q = 1 olur', 'Hiçbir şey değişmez'], 'Her iki NOR da 0 verir (Q ve Q̄ tümler olmaktan çıkar). Girişler aynı anda 0’a dönerse yarış durumu oluşur.'), xp: 15 },
    ],
    theory: 'Çapraz bağlı iki NOR kapısı iki kararlı durumlu (bistable) bir devre oluşturur. S = 1 → Q = 1, R = 1 → Q = 0, S = R = 0 → önceki durum korunur. Flip-flop’lar, yazmaçlar ve SRAM hücreleri bu geri besleme fikrine dayanır.',
  };
})();

const counter: Template = (() => {
  const b = new B();
  b.add('clock', 'CLK1', 20, 100, 0, { freq: 2, duty: 0.5, V: 5 }).gnd('CLK1.n', 40, 180);
  b.add('dff', 'FF1', 160, 60).add('dff', 'FF2', 360, 60);
  b.w(['CLK1.p', 'FF1.clk'], ['FF1.qn', 'FF1.d'], ['FF1.qn', 'FF2.clk'], ['FF2.qn', 'FF2.d']);
  b.add('logicprobe', 'Q0', 240, 0).add('logicprobe', 'Q1', 440, 0);
  b.w(['FF1.q', 'Q0.a'], ['FF2.q', 'Q1.a']);
  b.label('CLK', 40, 0, 'CLK1.p').label('Q1S', 480, 60, 'FF2.q');
  b.scope(600, 0, 'CLK', 'Q1S', { timeDiv: 0.2, ch1Div: 5, ch2Div: 5, ch1Pos: 0.5, ch2Pos: -3, trig: 2.5 });
  return {
    id: 'ripple-counter', topic: 'digital', level: 'Orta', mood: 'success', xp: 80,
    title: 'D Flip-Flop ile 2 Bitlik Sayıcı',
    subtitle: 'Frekans bölücü ve dalgalı (ripple) sayıcı',
    keywords: ['sayıcı', 'counter', 'flip flop', 'frekans bölücü', 'ripple'],
    doc: b.doc('2 Bitlik Sayıcı'),
    steps: [
      run('**▶ Başlat**. Q1 Q0 göstergeleri 00 → 01 → 10 → 11 → 00 sayar.'),
      { id: 'q1', title: '÷2', text: 'FF1’de Q̄ → D bağlı.', check: quiz('Q̄ çıkışı D’ye bağlı bir flip-flop ne yapar?', ['Her saat kenarında durum değiştirir (÷2 frekans bölücü)', 'Hep 1 kalır', 'Saati geciktirir', 'Hiçbir şey'], 'Her yükselen kenarda Q tersine döner → Q’nun frekansı saatin yarısı. İki kat zincirlenince ÷4.'), xp: 15 },
      { id: 'q2', title: 'Frekans', text: 'Saat 2 Hz.', check: quiz('Q1 (en anlamlı bit) kaç Hz’tir?', ['0,5 Hz', '1 Hz', '2 Hz', '4 Hz'], '2 Hz → Q0: 1 Hz → Q1: 0,5 Hz. n bitlik sayıcı saati 2ⁿ’e böler.'), xp: 15 },
    ],
    theory: 'D flip-flop saatin yükselen kenarında D’yi Q’ya kopyalar. Q̄→D geri beslemesi T (toggle) flip-flop yapar. Bir katın çıkışı sonrakinin saati olunca asenkron (dalgalı) sayıcı elde edilir; gecikmeler birikir, bu yüzden hızlı sistemlerde senkron sayıcılar kullanılır.',
  };
})();

// ───────────── Ölçme ve sensörler ─────────────
const wheatstone: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', -80, 60, 0, { V: 5 }).gnd('V1.n', -60, 140);
  b.add('resistor', 'R1', 160, 0, 90, { R: 10e3 }).add('resistor', 'R3', 160, 120, 90, { R: 10e3 }).gnd('R3.b', 180, 200);
  b.add('resistor', 'R2', 320, 0, 90, { R: 10e3 }).add('ntc', 'NTC1', 320, 120, 90, { temp: 25, R25: 10e3, B: 3950 }).gnd('NTC1.b', 340, 200);
  b.w(['V1.p', 'R1.a'], ['V1.p', 'R2.a'], ['R1.b', 'R3.a'], ['R2.b', 'NTC1.a']);
  b.add('multimeter', 'DMM1', 200, -160, 0, { mode: 'DCV' }).w(['DMM1.pos', 'R1.b'], ['DMM1.com', 'R2.b']);
  b.label('VA', 80, 80, 'R1.b').label('VB', 400, 80, 'R2.b');
  return {
    id: 'wheatstone-ntc', topic: 'measure', level: 'Temel', mood: 'info', xp: 70,
    title: 'Wheatstone Köprüsü ile Sıcaklık Ölçümü',
    subtitle: 'Dengeli köprü, NTC ve küçük direnç değişimlerini ölçmek',
    keywords: ['wheatstone', 'köprü', 'ntc', 'sıcaklık', 'sensör', 'termistör'],
    doc: b.doc('Wheatstone Köprüsü'),
    steps: [
      run('**▶ Başlat**. DMM1, VA − VB köprü gerilimini ölçer.'),
      { id: 'q1', title: 'Denge', text: '25 °C’de NTC = 10 kΩ.', check: quiz('Köprü gerilimi kaç volttur?', ['0 V (dengede)', '2,5 V', '5 V', '1,18 V'], 'R1/R3 = R2/R_NTC → VA = VB = 2,5 V. Dengede köprü çıkışı sıfırdır.'), xp: 15 },
      { id: 's1', title: 'Isıt', text: '**NTC1**’i seç, sıcaklığı **50 °C** yap.', check: { kind: 'param', comp: 'NTC1', param: 'temp', op: '>=', value: 50 }, success: 'NTC ≈ 3,6 kΩ’a düştü, VB azaldı.' },
      { id: 'q2', title: 'Okuma', text: 'R_NTC(50 °C) ≈ 3,59 kΩ', check: quiz('50 °C’de köprü gerilimi yaklaşık kaçtır?', ['≈ 1,18 V', '≈ 0 V', '≈ 2,5 V', '≈ −1,18 V'], 'VB = 5·3,59/13,59 ≈ 1,32 V → VA − VB ≈ 2,5 − 1,32 ≈ 1,18 V. Köprü, ortak 2,5 V’u yok edip yalnızca değişimi verir; bir enstrümantasyon kuvvetlendiricisiyle yükseltilir.'), xp: 15 },
    ],
    theory: 'Wheatstone köprüsü iki gerilim bölücünün farkını ölçer: V = V_s·(R3/(R1+R3) − R_x/(R2+R_x)). R1/R3 = R2/R_x’te sıfırdır. Gerinim ölçer (strain gauge), termistör, RTD gibi küçük direnç değişimlerini hassas ölçmenin standart yoludur.',
  };
})();

const nightLight: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 40, 0, { V: 9 }).gnd('V1.n', 40, 120);
  b.add('ldr', 'LDR1', 160, 0, 90, { lux: 100, R10: 20e3, gamma: 0.7 }).add('resistor', 'R1', 160, 120, 90, { R: 10e3 }).gnd('R1.b', 180, 200);
  b.w(['V1.p', 'LDR1.a'], ['LDR1.b', 'R1.a']);
  b.add('pot', 'POT1', 280, 0, 90, { R: 10e3, pos: 0.5 }).gnd('POT1.b', 300, 80).w(['V1.p', 'POT1.a']);
  b.add('opamp', 'U1', 400, 40, 0, { model: 'LM358', A0: 1e5, GBW: 1e6, SR: 0.3, Vos: 2e-3, Vcc: 9, Vee: 0 });
  b.w(['LDR1.b', 'U1.n'], ['POT1.w', 'U1.p']);
  b.add('resistor', 'RLED', 520, 60, 0, { R: 470 }).w(['U1.o', 'RLED.a']);
  b.add('led', 'LED1', 620, 100, 90, { color: 'yellow' }).gnd('LED1.k', 640, 180).w(['RLED.b', 'LED1.a']);
  b.label('VS', 220, 60, 'LDR1.b').label('VREF', 360, 140, 'POT1.w');
  return {
    id: 'ldr-nightlight', topic: 'measure', level: 'Temel', mood: 'point', xp: 80,
    title: 'LDR ile Otomatik Gece Lambası',
    subtitle: 'Işık sensörü + karşılaştırıcı + ayarlanabilir eşik',
    keywords: ['ldr', 'gece lambası', 'ışık sensörü', 'karşılaştırıcı', 'eşik', 'potansiyometre'],
    doc: b.doc('LDR Gece Lambası'),
    steps: [
      run('**▶ Başlat**. 100 lx’te (oda ışığı) LED sönük.'),
      { id: 'q1', title: 'Sensör gerilimi', text: '100 lx’te LDR ≈ 4 kΩ.', check: quiz('VS (LDR–R1 bölücüsü) yaklaşık kaçtır?', ['≈ 6,4 V', '≈ 4,5 V', '≈ 2,1 V', '≈ 9 V'], 'VS = 9·10k/(10k + 4k) ≈ 6,4 V > VREF (4,5 V) → çıkış düşük, LED sönük.'), xp: 15 },
      { id: 's1', title: 'Karart', text: '**LDR1**’i seç, ışığı **5 lx**’in altına indir.', check: { kind: 'param', comp: 'LDR1', param: 'lux', op: '<=', value: 5 }, success: 'LDR ≈ 32 kΩ → VS ≈ 2,1 V < VREF → LED yandı!' },
      { id: 'q2', title: 'Eşik ayarı', text: 'POT1 neyi belirler?', check: quiz('Potansiyometreyi neden kullanıyoruz?', ['Lambanın hangi ışık seviyesinde yanacağını (eşiği) ayarlamak için', 'LED parlaklığı için', 'Besleme gerilimi için', 'LDR’yi korumak için'], 'POT1 karşılaştırıcının referansını belirler. Sokak lambaları ve otomatik farlar aynı prensiple çalışır; gürültüye karşı histerezis (Schmitt) eklenir.'), xp: 15 },
    ],
    theory: 'LDR’nin direnci ışıkla azalır (CdS foto-iletkenlik). Bir gerilim bölücüyle ışık gerilime çevrilir; op-amp karşılaştırıcı bunu ayarlanabilir bir referansla kıyaslar. Tek beslemeli LM358 çıkışı 0…V_cc − 1,5 V arasında salınır.',
  };
})();

const lissajous: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 40, 40, 0, { amp: 2, freq: 1000 }).gnd('VG1.n', 60, 120);
  b.add('vac', 'VG2', 40, 200, 0, { amp: 2, freq: 1000, phase: 90 }).gnd('VG2.n', 60, 280);
  b.label('X', 100, 20, 'VG1.p').label('Y', 100, 180, 'VG2.p');
  b.scope(260, 20, 'X', 'Y', { timeDiv: 0.5e-3, ch1Div: 1, ch2Div: 1, trig: 0, xy: true });
  return {
    id: 'lissajous', topic: 'measure', level: 'Isınma', mood: 'hello', xp: 50,
    title: 'Osiloskop: XY Modu ve Lissajous Eğrileri',
    subtitle: 'Faz ve frekans oranını şekilden oku',
    keywords: ['osiloskop', 'lissajous', 'xy', 'faz', 'frekans oranı'],
    doc: b.doc('Lissajous'),
    steps: [
      run('**▶ Başlat**. Aynı frekans, 90° faz farkı → çember.'),
      { id: 's1', title: 'Faz', text: '**VG2**’nin fazını **0°** yap.', check: { kind: 'param', comp: 'VG2', param: 'phase', op: '==', value: 0 }, success: 'Çember bir doğruya dönüştü: faz farkı 0°. Ara açılarda elips oluşur.' },
      { id: 's2', title: 'Frekans oranı', text: '**VG2** frekansını **2 kHz** yap.', check: { kind: 'param', comp: 'VG2', param: 'freq', op: '==', value: 2000 } },
      { id: 'q1', title: 'Oran', text: 'Şekildeki yatay ve dikey teğet noktalarını say.', check: quiz('Y/X frekans oranı 2 olduğunda şekil neye benzer?', ['8 (yatay sekiz / parabol)', 'Çember', 'Doğru', 'Kare'], 'f_Y/f_X = yatay kenara değen tepe sayısı / dikey kenara değen tepe sayısı. 2:1 oranı “∞” veya parabol şekli verir.'), xp: 15 },
    ],
    theory: 'XY modunda bir sinyal yatay, diğeri dikey sapmayı sürer. Aynı frekanslı iki sinüs faz farkına göre doğru (0°), elips veya çember (90°) çizer. Frekans oranı tam sayı oranıysa kararlı Lissajous figürü oluşur; bu, frekans ölçümünün klasik yöntemidir.',
  };
})();

export const OPAMP_TEMPLATES: Template[] = [inverting, noninv, summing, integrator, schmitt];
export const OSC_TEMPLATES: Template[] = [astable555, mono555, bjtAstable, relax];
export const POWER_TEMPLATES: Template[] = [linearPsu, buck, boost];
export const DIGITAL_TEMPLATES: Template[] = [logicGates, pullDown, halfAdder, srLatch, counter];
export const MEASURE_TEMPLATES: Template[] = [wheatstone, nightLight, lissajous];
