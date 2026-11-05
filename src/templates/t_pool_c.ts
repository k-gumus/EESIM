// Deney havuzu (v0.2.1) — op-amp, osilatör, dijital, ölçme
import { B, D4148, quiz, run, type Template } from './lib';

const TL081 = { model: 'TL081', A0: 2e5, GBW: 3e6, SR: 13, Vos: 3e-3, Vcc: 15, Vee: -15 };
const TL081_12 = { ...TL081, Vcc: 12, Vee: -12 };
const LM358_5 = { model: 'LM358', A0: 1e5, GBW: 1e6, SR: 0.3, Vos: 2e-3, Vcc: 5, Vee: 0 };

// ───────────── Op-amp ─────────────
const differenceAmp: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 0, 0, { V: 2 }).gnd('V1.n', 40, 80);
  b.add('vdc', 'V2', 20, 160, 0, { V: 2.1 }).gnd('V2.n', 40, 240);
  b.add('resistor', 'R1', 100, -20, 0, { R: 1000 }).add('resistor', 'R3', 100, 140, 0, { R: 1000 });
  b.add('resistor', 'R4', 220, 200, 90, { R: 10e3 }).gnd('R4.b', 240, 280);
  b.add('opamp', 'U1', 280, 20, 0, TL081);
  b.add('resistor', 'R2', 240, -100, 0, { R: 10e3 });
  b.w(['V1.p', 'R1.a'], ['R1.b', 'U1.n'], ['V2.p', 'R3.a'], ['R3.b', 'U1.p'], ['R3.b', 'R4.a'], ['U1.n', 'R2.a'], ['R2.b', 'U1.o']);
  b.add('multimeter', 'DMM1', 440, -60, 0, { mode: 'DCV' }).w(['DMM1.pos', 'U1.o']).gnd('DMM1.com', 520, 40);
  b.label('VOUT', 400, 80, 'U1.o');
  return {
    id: 'difference-amp', topic: 'opamp', level: 'Orta', mood: 'info', xp: 80,
    title: 'Fark Kuvvetlendiricisi',
    subtitle: 'İki gerilimin farkını yükselt, ortak kısmı yok say',
    keywords: ['fark kuvvetlendirici', 'differential amplifier', 'ortak mod', 'cmrr', 'direnç eşleşmesi'],
    doc: b.doc('Fark Kuvvetlendiricisi'),
    steps: [
      run('**▶ Başlat**. V1 = 2,0 V, V2 = 2,1 V. R2/R1 = R4/R3 = 10.'),
      { id: 'q1', title: 'Çıkış', text: 'V_out = (R2/R1)·(V2 − V1)', check: quiz('DMM1 kaç volt gösterir?', ['≈ 1 V', '≈ 21 V', '≈ 20 V', '≈ 0,1 V'], 'Fark 0,1 V × 10 = 1 V. Her iki girişteki 2 V’luk ortak gerilim çıkışa yansımaz.'), xp: 15 },
      { id: 's1', title: 'Ortak mod', text: '**V2**’yi de **2 V** yap.', check: { kind: 'param', comp: 'V2', param: 'V', op: '==', value: 2 }, success: 'Çıkış ≈ 0: girişler eşitken fark kuvvetlendiricisi bir şey görmez.' },
      { id: 's2', title: 'Eşleşme bozulursa', text: '**R4**’ü **11 kΩ** yap (%10 hatalı direnç).', check: { kind: 'param', comp: 'R4', param: 'R', op: '>=', value: 11e3 } },
      { id: 'q2', title: 'Ortak mod hatası', text: 'Girişler hâlâ eşit (2 V).', check: quiz('Çıkış yaklaşık kaç volt oldu?', ['≈ 0,17 V', '0 V', '≈ 2 V', '≈ 20 V'], 'V_out = V2·(R4/(R3+R4))·(1 + R2/R1) − V1·R2/R1 = 2·(11/12)·11 − 20 ≈ 0,17 V. Fark sıfırken çıkış oluştu: CMRR, direnç eşleşmesine bağlıdır. Hassas uygulamalarda %0,1 dirençler ya da enstrümantasyon kuvvetlendiricisi kullanılır.'), xp: 15 },
    ],
    theory: 'Fark kuvvetlendiricisi eviren ve evirmeyen yapıyı birleştirir. R2/R1 = R4/R3 iken V_out = (R2/R1)(V2 − V1). Uygulamalar: akım ölçümünde şönt gerilimi, köprü devreleri, dengeli ses hatları. Giriş dirençleri düşük olduğu için kaynağı yükler; çözüm girişlere tampon eklemek (enstrümantasyon kuvvetlendiricisi).',
  };
})();

const differentiator: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 100, 0, { wave: 'triangle', amp: 1, freq: 1000 }).gnd('VG1.n', 40, 180);
  b.add('resistor', 'RIN', 100, 20, 0, { R: 100 }).add('capacitor', 'C1', 200, 20, 0, { C: 100e-9 });
  b.add('opamp', 'U1', 320, 20, 0, TL081).gnd('U1.p', 320, 80);
  b.add('resistor', 'RF', 280, -80, 0, { R: 1000 });
  b.w(['VG1.p', 'RIN.a'], ['RIN.b', 'C1.a'], ['C1.b', 'U1.n'], ['U1.n', 'RF.a'], ['RF.b', 'U1.o']);
  b.label('VIN', 60, -40, 'VG1.p').label('VOUT', 440, 40, 'U1.o');
  b.scope(520, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 0.5, ch2Div: 0.2, ch1Pos: 2, ch2Pos: -2, trig: 0 });
  return {
    id: 'differentiator', topic: 'opamp', level: 'Orta', mood: 'surprised', xp: 80,
    title: 'Op-amp Türev Alıcı',
    subtitle: 'Üçgen dalganın türevi kare dalgadır',
    keywords: ['türev alıcı', 'differentiator', 'op-amp', 'kare dalga', 'üçgen'],
    doc: b.doc('Op-amp Türev Alıcı'),
    steps: [
      run('**▶ Başlat**. Giriş ±1 V, 1 kHz üçgen.'),
      { id: 'q1', title: 'Çıkış', text: 'V_out = −RF·C·dV_in/dt', check: quiz('Çıkış dalga şekli ve genliği nedir?', ['±0,4 V kare dalga', '±1 V üçgen', '±4 V kare', 'Sinüs'], 'Üçgenin eğimi ±4 V/ms = ±4000 V/s → |V_out| = 1k·100n·4000 = 0,4 V. Eğim sabit olduğundan çıkış sabit; eğim işaret değiştirince çıkış atlar.'), xp: 15 },
      { id: 's1', title: 'Frekans', text: '**VG1**’i **2 kHz** yap.', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 2000 }, success: 'Eğim iki katına çıktı → çıkış ±0,8 V. Türev alıcının kazancı frekansla artar (+20 dB/dekad): yüksek frekanslı gürültüyü de büyütür.' },
      { id: 'q2', title: 'RIN neden var?', text: 'Girişte 100 Ω seri direnç…', check: quiz('Giriş kondansatörüne seri küçük direncin görevi nedir?', ['Yüksek frekans kazancını sınırlar, gürültüyü ve salınımı önler', 'Kazancı artırır', 'DC kaymayı önler', 'Gereksiz'], 'İdeal türev alıcının kazancı frekansla sınırsız artar; op-amp’ın faz kaymasıyla birlikte salınıma yatkındır. RIN, 1/(2π·RIN·C) ≈ 16 kHz üstünde kazancı RF/RIN = 10’da sabitler.'), xp: 15 },
    ],
    theory: 'Kondansatör girişte, direnç geri beslemede: i = C·dv_in/dt = −v_out/RF → v_out = −RF·C·dv_in/dt. Pratikte seri RIN (ve bazen RF’ye paralel küçük C) ile bant sınırlanır. Kenar algılama, hız (konumun türevi) hesaplama ve PID denetleyicinin D terimi için kullanılır.',
  };
})();

const precisionRect: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 100, 0, { amp: 0.5, freq: 100 }).gnd('VG1.n', 40, 180);
  b.add('opamp', 'U1', 180, 20, 0, TL081).w(['VG1.p', 'U1.p']);
  b.add('diode', 'D1', 280, 40, 0, D4148).w(['U1.o', 'D1.a']);
  b.add('resistor', 'RL1', 400, 100, 90, { R: 10e3 }).gnd('RL1.b', 420, 180).w(['D1.k', 'RL1.a'], ['D1.k', 'U1.n']);
  // Karşılaştırma: sıradan diyotlu yarım dalga
  b.add('diode', 'D2', 180, 240, 0, D4148).w(['VG1.p', 'D2.a']);
  b.add('resistor', 'RL2', 300, 300, 90, { R: 10e3 }).gnd('RL2.b', 320, 380).w(['D2.k', 'RL2.a']);
  b.label('VP', 460, 40, 'RL1.a').label('VD', 360, 240, 'RL2.a');
  b.scope(540, 0, 'VP', 'VD', { timeDiv: 2e-3, ch1Div: 0.2, ch2Div: 0.2, ch1Pos: 0, ch2Pos: -3, trig: 0.1 });
  return {
    id: 'precision-rectifier', topic: 'opamp', level: 'İleri', mood: 'point', xp: 90,
    title: 'Hassas Doğrultucu (Süper Diyot)',
    subtitle: '0,6 V’tan küçük sinyalleri de doğrult',
    keywords: ['hassas doğrultucu', 'süper diyot', 'precision rectifier', 'ideal diyot', 'mutlak değer'],
    doc: b.doc('Hassas Doğrultucu'),
    steps: [
      run('**▶ Başlat**. Giriş yalnızca 0,5 V tepe. CH1: op-amp’lı doğrultucu, CH2: sıradan diyot.'),
      { id: 'q1', title: 'Sıradan diyot', text: 'CH2’ye bak.', check: quiz('Sıradan diyotlu doğrultucunun çıkışı nasıl?', ['Küçük ve bozuk (≈ 0,1 V tepe): 0,5 V diyotu tam iletime sokmaya yetmiyor', 'Mükemmel yarım dalga (0,5 V tepe)', 'Tam dalga', 'Ters fazlı'], '1N4148 0,4 V civarında yalnızca ~10 µA geçirir: 10 kΩ üzerinde ≈ 0,12 V’luk, tepesi sivrilmiş bir çıkış. Gerilimin çoğu diyotta kalıyor.'), xp: 15 },
      { id: 'q2', title: 'Süper diyot', text: 'CH1’e bak.', check: quiz('Op-amp’lı devrenin çıkışı nedir?', ['Girişin pozitif yarısı, ≈ 0,5 V tepe (düşümsüz)', '≈ 0 V', '≈ 15 V', 'Girişin negatif yarısı'], 'Geri besleme diyotun katodundan alınır: op-amp çıkışını V_in + V_D’ye yükselterek katodu tam V_in’e eşitler. Diyot düşümü A_0 kadar küçültülmüş olur.'), xp: 15 },
      { id: 's1', title: 'Hız sınırı', text: '**VG1**’i **10 kHz** yap ve zaman/böl.’ü 20 µs’ye indir.', check: { kind: 'param', comp: 'VG1', param: 'freq', op: '>=', value: 10000 }, success: 'Her pozitif yarının başında kısa bir gecikme var: negatif yarıda op-amp çıkışı eksi raya doymuştu ve oradan dönmesi slew rate kadar sürüyor. Daha iyi topolojide (iki diyotlu) op-amp hiç doymaz.' },
    ],
    theory: 'Süper diyotta diyot op-amp’ın geri besleme döngüsü içindedir; döngü kazancı diyot düşümünü A_0 kat bastırır. Ölçü aletlerinde AC→DC dönüşümü, tepe dedektörü ve mutlak değer devrelerinin temelidir.',
  };
})();

const windowComp: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', -100, -100, 0, { V: 5 }).gnd('VCC.n', -80, -20);
  b.add('vac', 'VG1', 20, 100, 0, { wave: 'triangle', amp: 2.5, offset: 2.5, freq: 10 }).gnd('VG1.n', 40, 180);
  // Referanslar: 3 V ve 2 V (bölücü)
  b.add('resistor', 'RA', 120, -120, 90, { R: 2e3 }).add('resistor', 'RB', 120, -20, 90, { R: 1e3 }).add('resistor', 'RC', 120, 60, 90, { R: 2e3 }).gnd('RC.b', 140, 140);
  b.w(['VCC.p', 'RA.a'], ['RA.b', 'RB.a'], ['RB.b', 'RC.a']);
  b.add('opamp', 'U1', 260, -100, 0, LM358_5).add('opamp', 'U2', 260, 60, 0, LM358_5);
  // U1: VIN < 3 V → yüksek (VIN eviren girişte); U2: VIN > 2 V → yüksek
  b.w(['RA.b', 'U1.p'], ['VG1.p', 'U1.n'], ['VG1.p', 'U2.p'], ['RB.b', 'U2.n']);
  b.add('and', 'G1', 400, -20).w(['U1.o', 'G1.a'], ['U2.o', 'G1.b']);
  b.add('logicprobe', 'IN_WIN', 540, 0).w(['G1.y', 'IN_WIN.a']);
  b.label('VIN', 60, 20, 'VG1.p').label('OK', 520, -60, 'G1.y');
  b.scope(620, -40, 'VIN', 'OK', { timeDiv: 20e-3, ch1Div: 1, ch2Div: 5, ch1Pos: -2.5, ch2Pos: -3, trig: 2.5 });
  return {
    id: 'comparator-window', topic: 'opamp', level: 'Orta', mood: 'success', xp: 80,
    title: 'Pencere Karşılaştırıcı',
    subtitle: 'Gerilim 2–3 V aralığında mı?',
    keywords: ['pencere karşılaştırıcı', 'window comparator', 'karşılaştırıcı', 'eşik', 'aralık denetimi'],
    doc: b.doc('Pencere Karşılaştırıcı'),
    steps: [
      run('**▶ Başlat**. 0–5 V üçgen giriş; RA–RB–RC bölücüsü 3 V ve 2 V eşiklerini üretir. Tek beslemeli LM358 + VE kapısı.'),
      { id: 'q1', title: 'Eşikler', text: 'Bölücü: 2k + 1k + 2k, 5 V', check: quiz('Üst ve alt eşikler kaç volttur?', ['3 V ve 2 V', '5 V ve 0 V', '2,5 V ve 1 V', '4 V ve 1 V'], 'RA altı: 5·3k/5k = 3 V; RB altı: 5·2k/5k = 2 V.'), xp: 15 },
      { id: 'q2', title: 'Süre', text: 'OK çıkışı (CH2) periyodun ne kadarında yüksek?', check: quiz('Çıkış periyodun yaklaşık yüzde kaçında 1’dir?', ['%20', '%50', '%40', '%10'], 'Üçgen 0–5 V’u doğrusal tarar; 2–3 V aralığı bu aralığın 1/5’i → %20 (yükselirken ve inerken birer kez).'), xp: 15 },
      { id: 's1', title: 'Pencereyi genişlet', text: '**RB**’yi **3 kΩ** yap.', check: { kind: 'param', comp: 'RB', param: 'R', op: '>=', value: 3e3 }, success: 'Eşikler 3,57 V ve 1,43 V oldu: pencere genişledi, OK daha uzun süre yüksek. Pil gerilimi denetimi, “değer aralıkta” uyarıları bu yapıyla yapılır.' },
    ],
    theory: 'İki karşılaştırıcı, biri üst biri alt eşik için, çıkışları VE’lenince giriş pencere içindeyken 1 verir. Op-amp’lar burada açık çevrim (geri beslemesiz) çalışır. Gerçek tasarımda karşılaştırıcı entegreleri (LM393) ve gürültüye karşı histerezis tercih edilir.',
  };
})();

// ───────────── Osilatörler ─────────────
const wien: Template = (() => {
  const b = new B();
  b.add('opamp', 'U1', 300, 80, 0, TL081_12);
  // Pozitif geri besleme: seri RC → paralel RC
  b.add('resistor', 'RS1', 400, 220, 0, { R: 10e3 }).add('capacitor', 'CS1', 260, 220, 0, { C: 10e-9 });
  b.add('resistor', 'RP1', 200, 220, 90, { R: 10e3 }).gnd('RP1.b', 220, 300);
  b.add('capacitor', 'CP1', 140, 220, 90, { C: 10e-9, useIc: true, ic: 0.2 }).gnd('CP1.b', 160, 300);
  b.w(['U1.o', 'RS1.b'], ['RS1.a', 'CS1.b'], ['CS1.a', 'RP1.a'], ['CS1.a', 'CP1.a'], ['CS1.a', 'U1.p']);
  // Negatif geri besleme: kazanç ≈ 3, diyotlarla genlik kararlılığı
  b.add('resistor', 'RG', 220, 0, 90, { R: 10e3 }).gnd('RG.b', 240, 80);
  b.add('resistor', 'RF1', 260, -60, 0, { R: 18e3 }).add('resistor', 'RF2', 380, -60, 0, { R: 10e3 });
  b.add('diode', 'DF1', 380, -140, 0, D4148).add('diode', 'DF2', 380, -200, 180, D4148);
  b.w(['U1.n', 'RG.a'], ['U1.n', 'RF1.a'], ['RF1.b', 'RF2.a'], ['RF2.b', 'U1.o'], ['RF2.a', 'DF1.a'], ['DF1.k', 'RF2.b'], ['RF2.b', 'DF2.a'], ['DF2.k', 'RF2.a']);
  b.label('OUT', 460, 80, 'U1.o');
  b.scope(540, 0, 'OUT', null, { timeDiv: 0.5e-3, ch1Div: 2, trig: 0 });
  return {
    id: 'wien', topic: 'osc', level: 'İleri', mood: 'success', xp: 110,
    title: 'Wien Köprüsü Osilatörü',
    subtitle: 'Saf sinüs üretimi ve genlik kararlılığı',
    keywords: ['wien', 'wien köprüsü', 'sinüs osilatör', 'barkhausen', 'genlik kararlılığı'],
    doc: b.doc('Wien Köprüsü Osilatörü'),
    steps: [
      run('**▶ Başlat**. Küçük bir başlangıç gerilimi büyüyerek kararlı bir sinüse dönüşür.'),
      { id: 'q1', title: 'Frekans', text: 'R = 10 kΩ, C = 10 nF', check: quiz('Salınım frekansı yaklaşık kaçtır?', ['≈ 1,6 kHz', '≈ 16 kHz', '≈ 160 Hz', '≈ 10 kHz'], 'f₀ = 1/(2πRC) = 1/(2π·10k·10n) ≈ 1,59 kHz. Bu frekansta Wien ağı 0° faz kaydırır ve 1/3 zayıflatır.'), xp: 15 },
      { id: 'q2', title: 'Kazanç koşulu', text: 'Barkhausen: döngü kazancı = 1', check: quiz('Salınım için evirmeyen kazanç en az kaç olmalı?', ['3', '1', '29', '2'], 'Ağ 1/3 zayıflattığı için 1 + RF/RG ≥ 3 gerekir. Küçük genlikte RF = 28k (kazanç 3,8) → büyür; genlik artınca diyotlar RF2’yi kısaltır, kazanç 3’ün altına düşer → genlik kendini sınırlar.'), xp: 15 },
      { id: 's1', title: 'Diyotsuz düşün', text: '**RF1**’i **15 kΩ** yap.', check: { kind: 'param', comp: 'RF1', param: 'R', op: '<=', value: 15e3 }, success: 'Genlik küçüldü: diyotların daha erken devreye girmesi gerekiyor. Kazanç çok düşerse (< 3) salınım söner, çok yüksekse sinüs kırpılır.' },
    ],
    theory: 'Wien köprüsü osilatörü düşük bozulmalı ses frekansı sinüs üretir (HP’nin ilk ürünü HP200A buydu; o zaman genlik kararlılığı için ampul kullanıldı). Pozitif geri besleme frekansı, negatif geri besleme kazancı belirler. Genlik kontrolü için diyot, JFET ya da termistör kullanılır.',
  };
})();

const rcPhaseShift: Template = (() => {
  const b = new B();
  b.add('opamp', 'U1', 460, 60, 0, TL081_12).gnd('U1.p', 460, 120);
  b.add('capacitor', 'C1', 100, 200, 0, { C: 10e-9, useIc: true, ic: 0.5 }).add('resistor', 'R1', 180, 260, 90, { R: 10e3 }).gnd('R1.b', 200, 340);
  b.add('capacitor', 'C2', 220, 200, 0, { C: 10e-9 }).add('resistor', 'R2', 300, 260, 90, { R: 10e3 }).gnd('R2.b', 320, 340);
  b.add('capacitor', 'C3', 340, 200, 0, { C: 10e-9 }).add('resistor', 'R3', 420, 160, 0, { R: 10e3 });
  b.add('resistor', 'RF', 440, -40, 0, { R: 330e3 });
  b.w(['U1.o', 'C1.a'], ['C1.b', 'R1.a'], ['C1.b', 'C2.a'], ['C2.b', 'R2.a'], ['C2.b', 'C3.a'], ['C3.b', 'R3.a'], ['R3.b', 'U1.n'], ['U1.n', 'RF.a'], ['RF.b', 'U1.o']);
  b.label('OUT', 580, 80, 'U1.o');
  b.scope(640, 0, 'OUT', null, { timeDiv: 1e-3, ch1Div: 5, trig: 0 });
  return {
    id: 'rc-phase-shift', topic: 'osc', level: 'İleri', mood: 'point', xp: 100,
    title: 'RC Faz Kaydırmalı Osilatör',
    subtitle: 'Üç RC katı 180°, eviren kuvvetlendirici 180° daha',
    keywords: ['faz kaydırmalı', 'rc osilatör', 'phase shift', 'barkhausen', 'osilatör'],
    doc: b.doc('RC Faz Kaydırmalı Osilatör'),
    steps: [
      run('**▶ Başlat**. Salınım birkaç periyotta büyür ve op-amp’ın raylarında kırpılarak kararlı hâle gelir.'),
      { id: 'q1', title: 'Frekans', text: 'f = 1/(2π·R·C·√6)', check: quiz('Salınım frekansı yaklaşık kaçtır?', ['≈ 650 Hz', '≈ 1,6 kHz', '≈ 65 Hz', '≈ 6,5 kHz'], '1/(2π·10k·10n·2,45) ≈ 650 Hz. Bu frekansta üç RC katı tam 180° faz kaydırır.'), xp: 15 },
      { id: 'q2', title: 'Kazanç', text: 'Üç katın zayıflatması 1/29.', check: quiz('Eviren kuvvetlendiricinin kazancı en az kaç olmalı?', ['29', '3', '1', '180'], '180°’deki ağ kazancı 1/29’dur; döngü kazancı ≥ 1 için RF/R3 ≥ 29 → RF ≥ 290 kΩ. Burada 330 kΩ (kazanç 33) kullanıldı.'), xp: 15 },
      { id: 's1', title: 'Söndür', text: '**RF**’yi **220 kΩ** yap.', check: { kind: 'param', comp: 'RF', param: 'R', op: '<=', value: 220e3 }, success: 'Kazanç 22 < 29: döngü kazancı 1’in altında, salınım söndü. Barkhausen ölçütü işte bu.' },
    ],
    theory: 'Faz kaydırmalı osilatörde eviren kuvvetlendirici 180°, üç kademeli RC ağı da belirli bir frekansta 180° kaydırır; toplam 360° ve döngü kazancı ≥ 1 olunca salınım başlar. Basit ama genlik kararlılığı zayıftır; sinüs kalitesi için Wien köprüsü tercih edilir.',
  };
})();

const pwm555: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, 100, 0, { V: 9 }).gnd('VCC.n', 40, 180);
  b.add('timer555', 'U1', 300, 100).gnd('U1.gnd', 360, 200);
  b.w(['VCC.p', 'U1.vcc'], ['VCC.p', 'U1.reset']);
  b.add('capacitor', 'C2', 280, 220, 90, { C: 10e-9 }).gnd('C2.b', 300, 300).w(['U1.ctrl', 'C2.a']);
  b.add('resistor', 'RA', 460, -60, 90, { R: 1000 }).w(['VCC.p', 'RA.a'], ['RA.b', 'U1.dis']);
  b.add('pot', 'POT1', 480, 40, 0, { R: 100e3, pos: 0.5 }).w(['U1.dis', 'POT1.w']);
  b.add('diode', 'D1', 600, 120, 90, D4148).add('diode', 'D2', 400, 160, 270, D4148);
  b.add('capacitor', 'C1', 200, 200, 90, { C: 10e-9 }).gnd('C1.b', 220, 280);
  b.w(['POT1.a', 'D1.a'], ['D1.k', 'C1.a'], ['POT1.b', 'D2.k'], ['D2.a', 'C1.a'], ['C1.a', 'U1.thr'], ['C1.a', 'U1.trig']);
  b.add('resistor', 'RLED', 560, 220, 0, { R: 470 }).w(['U1.out', 'RLED.a']);
  b.add('led', 'LED1', 680, 260, 90, { color: 'yellow' }).gnd('LED1.k', 700, 340).w(['RLED.b', 'LED1.a']);
  b.label('OUT', 520, 120, 'U1.out');
  b.scope(760, 0, 'OUT', null, { timeDiv: 0.2e-3, ch1Div: 5, ch1Pos: -3, trig: 4 });
  return {
    id: '555-pwm', topic: 'osc', level: 'Orta', mood: 'success', xp: 90,
    title: '555 ile PWM Üreteci',
    subtitle: 'Sabit frekans, potansiyometreyle ayarlanan doluluk oranı',
    keywords: ['555', 'pwm', 'doluluk oranı', 'duty cycle', 'dimmer', 'motor hız'],
    doc: b.doc('555 PWM'),
    steps: [
      run('**▶ Başlat**. C1, RA + potun 1–w kolu + D1 üzerinden dolar; w–3 kolu + D2 üzerinden DIS’e boşalır.'),
      { id: 'q1', title: 'Frekans', text: 'Toplam R ≈ RA + R_pot = 101 kΩ, C = 10 nF', check: quiz('Frekans yaklaşık kaçtır ve pot ile değişir mi?', ['≈ 1,4 kHz, değişmez', '≈ 14 kHz, değişir', '≈ 140 Hz, değişmez', '≈ 1,4 kHz, değişir'], 'Şarj + deşarj direncinin toplamı potun konumundan bağımsızdır: f ≈ 1,44/(101k·10n) ≈ 1,4 kHz (diyot düşümleri biraz düşürür). Yalnızca ikisinin oranı değişir.'), xp: 15 },
      { id: 's1', title: 'Doluluk', text: '**POT1**’i **%20**’ye çek (Özellikler’deki kaydırıcı).', check: { kind: 'param', comp: 'POT1', param: 'pos', op: '<=', value: 0.2 } },
      { id: 'q2', title: 'Sonuç', text: 'Çıkış dalgasına bak.', check: quiz('Doluluk oranı yaklaşık kaç oldu?', ['≈ %20', '≈ %80', '≈ %50', '≈ %100'], 'Şarj yolu RA + potun 1–w kolu (1 + 20 kΩ), deşarj yolu w–3 kolu (80 kΩ): D ≈ 21/101 ≈ %21. Frekans aynı kaldı; LED sönükleşti.'), xp: 15 },
    ],
    theory: 'Klasik 555 astable’ında şarj (R1 + R2) ve deşarj (R2) yolları paylaşıldığından D > %50’dir. Diyotlarla yollar ayrılınca doluluk oranı %5–95 arasında ayarlanabilir, frekans sabit kalır. LED parlaklığı, motor hızı ve ısıtıcı gücü PWM ile kontrol edilir: ortalama güç = D × tam güç.',
  };
})();

// ───────────── Dijital ─────────────
const fullAdder: Template = (() => {
  const b = new B();
  b.add('logicin', 'A', 20, 0).add('logicin', 'B', 20, 120).add('logicin', 'CIN', 20, 240);
  b.add('xor', 'X1', 200, 20).add('xor', 'X2', 380, 100);
  b.add('and', 'A1', 200, 160).add('and', 'A2', 380, 220).add('or', 'O1', 540, 200);
  b.w(['A.y', 'X1.a'], ['B.y', 'X1.b'], ['X1.y', 'X2.a'], ['CIN.y', 'X2.b']);
  b.w(['A.y', 'A1.a'], ['B.y', 'A1.b'], ['X1.y', 'A2.a'], ['CIN.y', 'A2.b'], ['A1.y', 'O1.b'], ['A2.y', 'O1.a']);
  b.add('logicprobe', 'S', 560, 120).add('logicprobe', 'COUT', 680, 220);
  b.w(['X2.y', 'S.a'], ['O1.y', 'COUT.a']);
  return {
    id: 'full-adder', topic: 'digital', level: 'Orta', mood: 'info', xp: 80,
    title: 'Tam Toplayıcı',
    subtitle: 'İki yarım toplayıcı + VEYA: eldeyle birlikte topla',
    keywords: ['tam toplayıcı', 'full adder', 'elde', 'carry', 'alu', 'ripple carry'],
    doc: b.doc('Tam Toplayıcı'),
    steps: [
      run(),
      { id: 's1', title: '1 + 1 + 1', text: '**A**, **B** ve **CIN**’i 1 yap.', check: { kind: 'param', comp: 'CIN', param: 'on', op: '==', value: true } },
      { id: 'q1', title: 'Sonuç', text: 'S ve COUT’a bak (A ve B de 1 olmalı).', check: quiz('1 + 1 + 1 işleminin sonucu (COUT, S) nedir?', ['(1, 1) = ikilik 11 = 3', '(1, 0)', '(0, 1)', '(0, 0)'], 'S = A ⊕ B ⊕ C = 1, COUT = AB + C(A ⊕ B) = 1 → 11₂ = 3.'), xp: 15 },
      { id: 'q2', title: '4 bit', text: 'Dört tam toplayıcıyı zincirlersen…', check: quiz('4 bitlik dalgalı (ripple) toplayıcının en kötü gecikmesi neye bağlıdır?', ['Eldenin dört kattan sırayla geçmesine', 'Yalnızca ilk kata', 'Sıfır', 'Girişlerin sayısına'], 'Her katın COUT’u bir sonrakinin CIN’i: elde zincir boyunca “dalgalanır”. İşlemcilerde bu yüzden carry-lookahead (öngörülü elde) toplayıcılar kullanılır.'), xp: 15 },
    ],
    theory: 'Tam toplayıcı üç biti toplar: S = A ⊕ B ⊕ C_in, C_out = A·B + C_in·(A ⊕ B). n tanesi zincirlenince n bitlik toplayıcı olur. Çıkarma, ikiye tümleyen ile aynı devrede yapılır: A − B = A + B̄ + 1.',
  };
})();

const mux: Template = (() => {
  const b = new B();
  b.add('logicin', 'D0', 20, 0).add('logicin', 'D1', 20, 160).add('logicin', 'SEL', 20, 300);
  b.add('not', 'N1', 140, 280).add('and', 'A0', 280, 0).add('and', 'A1', 280, 160).add('or', 'O1', 440, 80);
  b.w(['SEL.y', 'N1.a'], ['D0.y', 'A0.a'], ['N1.y', 'A0.b'], ['D1.y', 'A1.a'], ['SEL.y', 'A1.b'], ['A0.y', 'O1.a'], ['A1.y', 'O1.b']);
  b.add('logicprobe', 'Y', 580, 100).w(['O1.y', 'Y.a']);
  return {
    id: 'mux', topic: 'digital', level: 'Temel', mood: 'point', xp: 70,
    title: 'Çoklayıcı (2:1 MUX)',
    subtitle: 'Seçme girişiyle iki veriden birini çıkışa aktar',
    keywords: ['çoklayıcı', 'multiplexer', 'mux', 'seçici', 'veri yolu'],
    doc: b.doc('2:1 Çoklayıcı'),
    steps: [
      run(),
      { id: 's1', title: 'Veri', text: '**D1**’i **1** yap (D0 = 0 kalsın).', check: { kind: 'param', comp: 'D1', param: 'on', op: '==', value: true }, success: 'SEL = 0: çıkış D0’ı izliyor → Y = 0.' },
      { id: 's2', title: 'Seç', text: '**SEL**’i **1** yap.', check: { kind: 'param', comp: 'SEL', param: 'on', op: '==', value: true }, success: 'Y = 1: artık D1 çıkışta.' },
      { id: 'q1', title: 'Boolean ifade', text: 'Devreyi oku.', check: quiz('Y’nin ifadesi nedir?', ['Y = D0·S̄ + D1·S', 'Y = D0·D1', 'Y = S', 'Y = D0 ⊕ D1'], 'Her VE kapısı bir veri yolunu açar; S yalnızca birini etkinleştirir. 4:1 MUX iki seçme biti, 8:1 üç seçme biti kullanır.'), xp: 15 },
    ],
    theory: 'Çoklayıcı, n seçme bitiyle 2ⁿ girişten birini çıkışa aktarır. İşlemcilerde yazmaç seçimi, veri yolu paylaşımı ve ALU işlem seçiminde kullanılır; aynı zamanda her mantık fonksiyonu bir MUX ile gerçeklenebilir (FPGA’ların LUT’ları bu fikre dayanır).',
  };
})();

const shiftRegister: Template = (() => {
  const b = new B();
  b.add('clock', 'CLK1', 20, 200, 0, { freq: 2, duty: 0.5, V: 5 }).gnd('CLK1.n', 40, 280);
  b.add('logicin', 'DIN', 20, 20);
  const xs = [140, 300, 460, 620];
  xs.forEach((x, i) => {
    b.add('dff', `FF${i}`, x, 20).add('logicprobe', `Q${i}`, x + 100, -60);
    b.w(['CLK1.p', `FF${i}.clk`], [`FF${i}.q`, `Q${i}.a`]);
    b.w([i === 0 ? 'DIN.y' : `FF${i - 1}.q`, `FF${i}.d`]);
  });
  b.label('CLK', 60, 120, 'CLK1.p');
  return {
    id: 'shift-register', topic: 'digital', level: 'Orta', mood: 'success', xp: 80,
    title: 'Kaydırmalı Yazmaç (Shift Register)',
    subtitle: 'Seri–paralel dönüşüm: bitler saatle sağa kayar',
    keywords: ['kaydırmalı yazmaç', 'shift register', '74hc595', 'seri paralel', 'flip flop'],
    doc: b.doc('Kaydırmalı Yazmaç'),
    steps: [
      run('**▶ Başlat**. Saat 2 Hz; her yükselen kenarda her flip-flop solundakinin değerini alır.'),
      { id: 's1', title: 'Bir bit gönder', text: '**DIN**’i **1** yap, yarım saniye bekle, sonra tekrar **0** yap.', check: { kind: 'param', comp: 'DIN', param: 'on', op: '==', value: true }, success: 'Q0 → Q1 → Q2 → Q3: “1” biti saat kenarlarıyla sağa yürüyor.' },
      { id: 'q1', title: 'Kaç saat?', text: 'Dört bitlik bir sayıyı seri olarak yüklemek…', check: quiz('4 bitlik bir veriyi DIN’den yüklemek kaç saat darbesi alır?', ['4', '1', '2', '16'], 'Her darbede bir bit girer. 74HC595 gibi yazmaçlar bu sayede 3 pinle 8 (zincirle 16, 24…) çıkışı kontrol etmeyi sağlar.'), xp: 15 },
    ],
    theory: 'Kaydırmalı yazmaç zincirleme D flip-flop’lardan oluşur. Seri giriş–paralel çıkış (SIPO) mikrodenetleyicinin az pinle çok LED/röle sürmesini, paralel giriş–seri çıkış (PISO) çok butonu az pinle okumasını sağlar. SPI, UART gibi seri haberleşmelerin donanım temelidir.',
  };
})();

// ───────────── Ölçme ─────────────
const r2r: Template = (() => {
  const b = new B();
  b.add('logicin', 'B2', 20, 0).add('logicin', 'B1', 20, 140).add('logicin', 'B0', 20, 280);
  b.add('resistor', 'R2B', 120, 0, 0, { R: 20e3 }).add('resistor', 'R1B', 120, 140, 0, { R: 20e3 }).add('resistor', 'R0B', 120, 280, 0, { R: 20e3 });
  b.add('resistor', 'RT', 280, 340, 90, { R: 20e3 }).gnd('RT.b', 300, 420);
  b.add('resistor', 'RL01', 300, 200, 90, { R: 10e3 }).add('resistor', 'RL12', 300, 60, 90, { R: 10e3 });
  b.w(['B2.y', 'R2B.a'], ['B1.y', 'R1B.a'], ['B0.y', 'R0B.a']);
  b.w(['R0B.b', 'RT.a'], ['R0B.b', 'RL01.b'], ['RL01.a', 'R1B.b'], ['R1B.b', 'RL12.b'], ['RL12.a', 'R2B.b']);
  b.add('multimeter', 'DMM1', 380, -100, 0, { mode: 'DCV' }).w(['DMM1.pos', 'R2B.b']).gnd('DMM1.com', 460, 0);
  b.label('VOUT', 260, -60, 'R2B.b');
  return {
    id: 'dac-r2r', topic: 'measure', level: 'Orta', mood: 'info', xp: 80,
    title: 'R-2R Merdiven DAC',
    subtitle: 'İki direnç değeriyle sayısaldan analoğa',
    keywords: ['dac', 'r-2r', 'sayısal analog', 'merdiven', 'çözünürlük'],
    doc: b.doc('R-2R DAC'),
    steps: [
      run('**▶ Başlat**. B2 en anlamlı bit (MSB). Bitler 0 ya da 5 V.'),
      { id: 's1', title: 'Sayı: 101', text: '**B2**’yi ve **B0**’ı **1** yap.', check: { kind: 'param', comp: 'B0', param: 'on', op: '==', value: true } },
      { id: 'q1', title: 'Çıkış', text: 'V_out = 5 V × (kod / 8)', check: quiz('101₂ (5) kodunda çıkış kaç volttur?', ['3,125 V', '5 V', '2,5 V', '1,875 V'], 'Her bit bir öncekinin yarı ağırlığında: 5·(1/2 + 0/4 + 1/8) = 3,125 V.'), xp: 15 },
      { id: 'q2', title: 'Çözünürlük', text: '3 bit = 8 seviye', check: quiz('Bu DAC’ın en küçük adımı (1 LSB) kaç volttur?', ['0,625 V', '1 V', '0,3125 V', '5 V'], 'LSB = 5 V / 2³ = 0,625 V. 12 bitlik bir DAC’ta 1,2 mV olur. R-2R’nin üstünlüğü: yalnızca iki direnç değeri gerekir ve eşleşmeleri kolaydır.'), xp: 15 },
    ],
    theory: 'R-2R merdiveninde her düğümden sağa ve aşağıya bakan direnç 2R’dir; bu yüzden her bitin katkısı bir öncekinin tam yarısıdır. Çıkış direnci kodtan bağımsız R’dir; yük bağlanacaksa op-amp tampon eklenir. Ağırlıklı direnç (R, 2R, 4R, 8R…) DAC’ına göre çok daha az farklı değer gerektirir.',
  };
})();

const meterInternal: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 60, 0, { V: 1 }).gnd('V1.n', 40, 140);
  b.add('multimeter', 'DMM1', 80, -120, 0, { mode: 'DCA' }).w(['V1.p', 'DMM1.pos']);
  b.add('resistor', 'RA', 200, -20, 0, { R: 1 }).add('switch', 'S1', 200, -100, 0, { closed: true });
  b.w(['DMM1.com', 'RA.a'], ['DMM1.com', 'S1.a'], ['RA.b', 'S1.b']);
  b.add('resistor', 'R1', 340, 40, 90, { R: 10 }).gnd('R1.b', 360, 120).w(['RA.b', 'R1.a']);
  b.label('VR', 400, -20, 'R1.a');
  return {
    id: 'meter-internal', topic: 'measure', level: 'Temel', mood: 'surprised', xp: 70,
    title: 'Ampermetrenin İç Direnci',
    subtitle: 'Seri bağlanan ölçü aleti küçük dirençli devrelerde akımı değiştirir',
    keywords: ['ampermetre', 'iç direnç', 'şönt', 'ölçüm hatası', 'burden voltage'],
    doc: b.doc('Ampermetrenin İç Direnci'),
    steps: [
      run('**▶ Başlat**. DMM1 ideal ampermetre. RA, gerçek bir ampermetrenin iç direnci (1 Ω şönt + kablolar); S1 kapalıyken kısa devre edilmiş.'),
      { id: 'q1', title: 'İdeal akım', text: 'V1 = 1 V, R1 = 10 Ω', check: quiz('İdeal ampermetre ne gösterir?', ['100 mA', '91 mA', '1 A', '10 mA'], 'I = 1 V / 10 Ω = 100 mA.'), xp: 15 },
      { id: 's1', title: 'Gerçek alet', text: '**S1**’i aç: RA devreye girer.', check: { kind: 'switch', comp: 'S1', closed: false } },
      { id: 'q2', title: 'Hata', text: 'DMM1’i oku.', check: quiz('Şimdi akım kaç oldu?', ['≈ 91 mA (%9 hata)', '100 mA', '≈ 50 mA', '≈ 110 mA'], 'I = 1/(10 + 1) ≈ 91 mA. Ampermetre üzerinde 91 mV düştü (“burden voltage”). Devre direnci küçükse ya da gerilim düşükse bu hata büyür.'), xp: 15 },
    ],
    theory: 'Ampermetre devreye seri bağlanır; idealde 0 Ω’dur. Gerçek aletler akımı küçük bir şönt direnci üzerindeki gerilimle ölçer (mA kademesinde ~1–10 Ω, 10 A kademesinde ~0,01 Ω). Kural: ampermetre direnci, devre direncinden en az 100 kat küçük olmalı. Voltmetrede ise tersine iç direnç çok büyük olmalıdır.',
  };
})();

export const POOL_C: Template[] = [differenceAmp, differentiator, precisionRect, windowComp, wien, rcPhaseShift, pwm555, fullAdder, mux, shiftRegister, r2r, meterInternal];
