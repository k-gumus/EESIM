// Diyot, BJT ve MOSFET deneyleri (ek)
import { B, D4001, D4148, quiz, run, type Template } from './lib';

// ───────────── Diyot ─────────────
const centerTap: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 120, 0, { amp: 311, freq: 50 }).gnd('VG1.n', 40, 200);
  b.add('xfmr_ct', 'T1', 120, 120, 0, { n: 10 }).w(['VG1.p', 'T1.p1'], ['T1.p2', 'VG1.n']);
  b.add('diode', 'D1', 240, 100, 0, D4001).add('diode', 'D2', 240, 180, 0, D4001);
  b.w(['T1.s1', 'D1.a'], ['T1.s2', 'D2.a']);
  b.add('resistor', 'RL', 360, 140, 90, { R: 1000 }).gnd('RL.b', 380, 220).w(['D1.k', 'RL.a'], ['D2.k', 'RL.a']);
  b.gnd('T1.ct', 200, 160);
  b.label('VIN', 20, 20, 'VG1.p').label('VOUT', 380, 40, 'RL.a');
  b.scope(500, 0, 'VIN', 'VOUT', { timeDiv: 5e-3, ch1Div: 200, ch2Div: 10, ch1Pos: 2, ch2Pos: -3.4, trig: 0 });
  return {
    id: 'center-tap', topic: 'diode', level: 'Temel', mood: 'success', xp: 80,
    title: 'Orta Uçlu Tam Dalga Doğrultucu',
    subtitle: 'İki diyot + orta uçlu trafo; köprüyle karşılaştır',
    keywords: ['orta uç', 'center tap', 'tam dalga', 'doğrultucu'],
    doc: b.doc('Orta Uçlu Tam Dalga Doğrultucu'),
    steps: [
      run('**▶ Başlat**. Her yarım sargı 15,6 V tepe verir.'),
      { id: 'q1', title: 'İletimdeki diyot', text: 'Akım noktalarını izle.', check: quiz('Her alternansta kaç diyot iletir?', ['1', '2', '4', '0'], 'Pozitif alternansta D1, negatifte D2 iletir; akım yolunda tek diyot vardır.'), xp: 15 },
      { id: 'q2', title: 'Tepe çıkış', text: 'Yarım sargı tepe gerilimi 311/20 ≈ 15,6 V.', check: quiz('Çıkış tepe değeri yaklaşık kaçtır?', ['≈ 14,9 V', '≈ 31,1 V', '≈ 13,9 V', '≈ 15,6 V'], 'V_out = 15,6 − 0,7 ≈ 14,9 V. Köprüde iki diyot düşümü olur ama tüm sargı kullanılır. Orta uçlu devrede diyotların ters gerilimi (PIV) 2V_p’dir.'), xp: 15 },
    ],
    theory: 'Orta uçlu trafonun iki yarısı ters fazlı gerilim üretir; her alternansta bir diyot iletir. V_p,out = V_p,yarım − V_D. Avantajı tek diyot düşümü; dezavantajı orta uçlu (daha büyük) trafo ve diyot başına PIV = 2V_p.',
  };
})();

const doubler: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { amp: 10, freq: 1000 }).gnd('VG1.n', 120, 220);
  b.add('capacitor', 'C1', 180, 60, 0, { C: 10e-6 }).w(['VG1.p', 'C1.a']);
  b.add('diode', 'D1', 240, 100, 270, D4148).gnd('D1.a', 260, 180).w(['C1.b', 'D1.k']);
  b.add('diode', 'D2', 300, 60, 0, D4148).w(['C1.b', 'D2.a']);
  b.add('capacitor', 'C2', 400, 100, 90, { C: 10e-6 }).gnd('C2.b', 420, 180).w(['D2.k', 'C2.a']);
  b.add('resistor', 'RL', 480, 100, 90, { R: 100e3 }).gnd('RL.b', 500, 180).w(['C2.a', 'RL.a']);
  b.label('VIN', 180, -20, 'C1.a').label('VOUT', 420, 0, 'C2.a');
  b.scope(600, 0, 'VIN', 'VOUT', { timeDiv: 2e-3, ch1Div: 10, ch2Div: 5, ch1Pos: 1.5, ch2Pos: -3.5, trig: 0 });
  return {
    id: 'voltage-doubler', topic: 'diode', level: 'Orta', mood: 'surprised', xp: 80,
    title: 'Gerilim Katlayıcı (Villard–Greinacher)',
    subtitle: 'Kenetleyici + tepe dedektörü = 2·V_p DC',
    keywords: ['katlayıcı', 'doubler', 'greinacher', 'yüksek gerilim'],
    doc: b.doc('Gerilim Katlayıcı'),
    steps: [
      run('**▶ Başlat**. C2’nin birkaç periyotta dolduğunu izle.'),
      { id: 'q1', title: 'Çıkış', text: 'İlk kat (C1+D1) kenetleyici, ikinci kat (D2+C2) tepe dedektörü.', check: quiz('Çıkış DC gerilimi yaklaşık kaçtır? (V_p = 10 V)', ['≈ 18,8 V', '≈ 10 V', '≈ 9,3 V', '≈ 20 V'], 'Kenetleyici tepeyi 2V_p − V_D’ye taşır, tepe dedektörü bunu tutar: 2·10 − 2·0,6 ≈ 18,8 V.'), xp: 15 },
      { id: 's1', title: 'Yükle', text: '**RL**’yi **10 kΩ** yap. Çıkış ve dalgalanma ne oldu?', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 10e3 }, success: 'Katlayıcılar yüksek gerilim/düşük akım içindir; yük arttıkça çıkış düşer ve dalgalanır.' },
    ],
    theory: 'Yarım dalga gerilim katlayıcı bir pozitif kenetleyici (C1, D1) ve ardından bir tepe dedektöründen (D2, C2) oluşur. Yüksüz çıkış 2V_p − 2V_D’dir. Cockcroft–Walton merdiveni bu katları zincirleyerek çok yüksek DC gerilim üretir (CRT, iyon jeneratörü, fotokopi).',
  };
})();

const diodeIV: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 100, 140, 0, { wave: 'triangle', amp: 2, freq: 100 }).gnd('VG1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 100 }).w(['VG1.p', 'R1.a']);
  b.add('diode', 'D1', 240, 100, 90, D4148).w(['R1.b', 'D1.a']);
  b.add('resistor', 'RS', 240, 200, 90, { R: 10 }).gnd('RS.b', 260, 280).w(['D1.k', 'RS.a']);
  b.label('VD', 300, 60, 'D1.a').label('VI', 300, 180, 'RS.a');
  b.scope(460, 0, 'VD', 'VI', { timeDiv: 2e-3, ch1Div: 0.5, ch2Div: 0.02, ch1Pos: 0, ch2Pos: -3, trig: 0, xy: true });
  return {
    id: 'diode-iv', topic: 'diode', level: 'Orta', mood: 'point', xp: 80,
    title: 'Diyot I–V Karakteristiği (XY Modu)',
    subtitle: 'Osiloskopla Shockley eğrisini çiz; silisyum vs Schottky',
    keywords: ['karakteristik', 'iv eğrisi', 'shockley', 'xy', 'schottky', 'eşik'],
    doc: b.doc('Diyot I–V Karakteristiği'),
    steps: [
      run('**▶ Başlat**. Osiloskop XY modunda: X = diyot gerilimi (0,5 V/böl.), Y = 10 Ω üzerindeki gerilim → akım (2 mA/böl.).'),
      { id: 'q1', title: 'Diz gerilimi', text: 'Eğrinin dikleştiği noktaya bak.', check: quiz('1N4148 yaklaşık kaç voltta belirgin şekilde iletmeye başlar?', ['≈ 0,6–0,7 V', '≈ 0,2 V', '≈ 1,5 V', '≈ 0 V'], 'Silisyum pn ekleminde akım üstel artar: I = I_S(e^(V/nV_T) − 1). Birkaç mA için ≈ 0,6–0,7 V gerekir.'), xp: 15 },
      { id: 's1', title: 'Schottky', text: '**D1**’i seç, modelini **1N5819 (Schottky)** yap.', check: { kind: 'param', comp: 'D1', param: 'model', op: '==', value: '1N5819' }, success: 'Diz ≈ 0,3 V’a kaydı. Schottky (metal–yarı iletken) eklemin bariyeri düşüktür; anahtarlamalı güç kaynaklarında kayıpları azaltır ama ters sızıntısı büyüktür.' },
    ],
    theory: 'Shockley denklemi: I_D = I_S·(e^(V_D/(nV_T)) − 1), V_T ≈ 25,9 mV. Akım her ~60·n mV’ta 10 kat artar, bu yüzden pratikte sabit bir “iletim gerilimi” görülür. Ters yönde yalnızca I_S kadar sızıntı vardır (kırılmaya kadar).',
  };
})();

// ───────────── BJT ─────────────
const bjtSwitch: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 100, 40, 0, { V: 9 }).gnd('V1.n', 120, 120);
  b.add('resistor', 'RC', 220, 40, 90, { R: 330 }).w(['V1.p', 'RC.a']);
  b.add('led', 'LED1', 220, 140, 90, { color: 'green' }).w(['RC.b', 'LED1.a']);
  b.add('npn', 'Q1', 200, 240, 0, { model: 'genel', beta: 100 }).w(['LED1.k', 'Q1.c']).gnd('Q1.e', 240, 320);
  b.add('logicin', 'IN1', 20, 260, 0, { on: false });
  b.add('resistor', 'RB', 100, 260, 0, { R: 10e3 }).w(['IN1.y', 'RB.a'], ['RB.b', 'Q1.b']);
  return {
    id: 'bjt-switch', topic: 'bjt', level: 'Temel', mood: 'hello', xp: 70,
    title: 'Transistörle LED Anahtarlama',
    subtitle: 'Küçük taban akımıyla büyük yükü sür; doyum koşulu',
    keywords: ['anahtar', 'doyum', 'saturation', 'led sürme', 'npn'],
    doc: b.doc('Transistör Anahtar'),
    steps: [
      run('**▶ Başlat**. IN1 = 0 iken transistör kesimde, LED sönük.'),
      { id: 's1', title: 'Tabanı sür', text: '**IN1**’e çift tıklayıp **1** yap (5 V).', check: { kind: 'param', comp: 'IN1', param: 'on', op: '==', value: true }, success: 'LED yandı. Q1’i seç: bölge “doyum”, V_CE ≈ 0,1 V.' },
      { id: 'q1', title: 'Doyum koşulu', text: 'I_B = (5 − 0,75)/10k ≈ 0,43 mA, I_C,sat ≈ (9 − 2,1)/330 ≈ 21 mA', check: quiz('Transistör neden doyumdadır?', ['β·I_B (43 mA) > I_C,sat (21 mA)', 'V_BE > 0,7 V', 'I_B > I_C', 'LED yeşil olduğu için'], 'Taban akımı, kolektörün çekebileceğinden fazlasını “isterse” transistör doyuma girer ve anahtar gibi davranır. Tasarımda β·I_B ≈ 2–5·I_C,sat seçilir.'), xp: 15 },
      { id: 's2', title: 'Taban akımını kıs', text: '**RB**’yi **100 kΩ** yap.', check: { kind: 'param', comp: 'RB', param: 'R', op: '>=', value: 100e3 }, success: 'I_B ≈ 43 µA → I_C ≈ 4,3 mA: transistör aktif bölgede, LED sönükleşti. Anahtar olarak kullanırken bu ara bölge ısınmaya yol açar.' },
    ],
    theory: 'BJT anahtar olarak kesim (I_B = 0) ve doyum (V_CE ≈ 0,1–0,2 V) arasında çalıştırılır. Doyum için I_B > I_C,sat/β gerekir. Mikrodenetleyici pinleri birkaç mA verebildiğinden röle, motor, LED şeridi gibi yükler transistörle sürülür.',
  };
})();

const ceAmp: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, 0, 0, { V: 12 }).gnd('VCC.n', 40, 80);
  b.add('resistor', 'R1', 200, 0, 90, { R: 47e3 }).add('resistor', 'R2', 200, 160, 90, { R: 10e3 }).gnd('R2.b', 220, 240);
  b.add('resistor', 'RC', 320, -40, 90, { R: 4700 });
  b.add('npn', 'Q1', 300, 80, 0, { model: 'genel', beta: 100 });
  b.add('resistor', 'RE', 320, 200, 90, { R: 1000 }).gnd('RE.b', 340, 280);
  b.add('switch', 'S1', 400, 180, 90, { closed: true }).add('capacitor', 'CE', 400, 280, 90, { C: 100e-6 }).gnd('CE.b', 420, 360);
  b.w(['VCC.p', 'R1.a'], ['R1.a', 'RC.a'], ['R1.b', 'R2.a'], ['R1.b', 'Q1.b'], ['RC.b', 'Q1.c'], ['Q1.e', 'RE.a'], ['Q1.e', 'S1.a'], ['S1.b', 'CE.a']);
  b.add('vac', 'VG1', 20, 160, 0, { amp: 0.01, freq: 1000 }).gnd('VG1.n', 40, 240);
  b.add('capacitor', 'CIN', 100, 100, 0, { C: 10e-6 }).w(['VG1.p', 'CIN.a'], ['CIN.b', 'R1.b']);
  b.add('capacitor', 'COUT', 380, 20, 0, { C: 10e-6 }).w(['Q1.c', 'COUT.a']);
  b.add('resistor', 'RL', 500, 60, 90, { R: 10e3 }).gnd('RL.b', 520, 140).w(['COUT.b', 'RL.a']);
  b.label('VIN', 100, 40, 'CIN.a').label('VOUT', 560, 40, 'RL.a');
  b.scope(640, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 0.01, ch2Div: 1, ch1Pos: 2, ch2Pos: -2, trig: 0 });
  return {
    id: 'ce-amp', topic: 'bjt', level: 'İleri', mood: 'success', xp: 110,
    title: 'Ortak Emetör Yükselteç',
    subtitle: 'Küçük işaret kazancı, emetör baypas kondansatörünün etkisi',
    keywords: ['ortak emetör', 'yükselteç', 'kazanç', 'küçük işaret', 'gm', 'baypas'],
    doc: b.doc('Ortak Emetör Yükselteç'),
    steps: [
      run('**▶ Başlat**. Giriş 10 mV tepe (CH1: 10 mV/böl.), çıkış CH2: 1 V/böl.'),
      { id: 'q1', title: 'Kazanç', text: 'I_C ≈ 1,33 mA → g_m = I_C/V_T ≈ 51 mS. R_C‖R_L ≈ 3,2 kΩ', check: quiz('Gerilim kazancı (baypas açık) yaklaşık kaçtır?', ['≈ −165', '≈ −3,2', '≈ −10', '≈ +165'], 'A_v = −g_m·(R_C‖R_L) ≈ −0,051·3200 ≈ −165. Eksi işaret: çıkış girişe göre 180° ters.'), xp: 20 },
      { id: 's1', title: 'Baypası kaldır', text: '**S1**’i aç: C_E artık R_E’yi AC’de kısa devre etmiyor.', check: { kind: 'switch', comp: 'S1', closed: false } },
      { id: 'q2', title: 'Geri beslemeli kazanç', text: 'CH2’de çıkış genliği küçüldü.', check: quiz('Yeni kazanç yaklaşık kaçtır?', ['≈ −3,1', '≈ −165', '≈ −1', '≈ −50'], 'A_v ≈ −(R_C‖R_L)/(r_e + R_E) ≈ −3200/1019 ≈ −3,1. Kazanç düştü ama β’dan ve sıcaklıktan bağımsız, daha doğrusal oldu (negatif geri besleme).'), xp: 20 },
    ],
    theory: 'Gerilim bölücüyle polarlanan BJT aktif bölgede g_m = I_C/V_T, r_π = β/g_m küçük işaret modeliyle çalışır. Baypaslı ortak emetör kazancı A_v = −g_m(R_C‖R_L). R_E baypas edilmezse A_v ≈ −(R_C‖R_L)/(r_e + R_E). Kuplaj kondansatörleri DC polarmayı korurken AC’yi geçirir.',
  };
})();

const mirror: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, 0, 0, { V: 10 }).gnd('VCC.n', 40, 80);
  b.add('resistor', 'RREF', 180, 0, 90, { R: 10e3 });
  b.add('npn', 'Q1', 160, 120, 0, { model: 'genel', beta: 100 }).gnd('Q1.e', 200, 200);
  b.add('npn', 'Q2', 320, 120, 0, { model: 'genel', beta: 100 }).gnd('Q2.e', 360, 200);
  b.add('resistor', 'RL', 340, -40, 90, { R: 4700 });
  b.w(['VCC.p', 'RREF.a'], ['VCC.p', 'RL.a'], ['RREF.b', 'Q1.c'], ['Q1.c', 'Q1.b'], ['Q1.b', 'Q2.b'], ['RL.b', 'Q2.c']);
  b.label('VOUT', 400, 60, 'Q2.c');
  return {
    id: 'current-mirror', topic: 'bjt', level: 'Orta', mood: 'point', xp: 80,
    title: 'BJT Akım Aynası',
    subtitle: 'Referans akımı kopyala; yükten bağımsız akım kaynağı',
    keywords: ['akım aynası', 'current mirror', 'akım kaynağı', 'analog ic'],
    doc: b.doc('Akım Aynası'),
    steps: [
      run('**▶ Başlat**. **Değer Okuma** ile RREF ve RL akımlarını karşılaştır.'),
      { id: 'q1', title: 'Referans akım', text: 'Q1 diyot bağlı (B–C kısa).', check: quiz('I_REF yaklaşık kaçtır?', ['≈ 0,93 mA', '≈ 1 mA', '≈ 0,5 mA', '≈ 9,3 mA'], 'I_REF = (10 − 0,7)/10 kΩ ≈ 0,93 mA. Q2 aynı V_BE’yi gördüğü için aynı kolektör akımını çeker: I_OUT ≈ I_REF·β/(β+2).'), xp: 15 },
      { id: 's1', title: 'Yükü değiştir', text: '**RL**’yi **1 kΩ** yap. Akım değişti mi?', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 1000 }, success: 'Akım hemen hemen aynı: ayna ideal bir akım kaynağı gibi davranıyor.' },
      { id: 's2', title: 'Uyum sınırı', text: '**RL**’yi **15 kΩ** yap.', check: { kind: 'param', comp: 'RL', param: 'R', op: '>=', value: 15e3 }, success: '0,92 mA·15k = 13,8 V > 10 V: Q2 doyuma girdi, akım düştü. Ayna yalnızca Q2 aktif bölgedeyken (uyum aralığında) çalışır.' },
    ],
    theory: 'Eşleşmiş iki transistörde V_BE eşitse kolektör akımları eşittir (I_C = I_S·e^(V_BE/V_T)). Diyot bağlı Q1, I_REF’i bir V_BE’ye çevirir; Q2 bunu tekrar akıma çevirir. Entegre devrelerde polarma, aktif yük ve diferansiyel katlarda temel yapıdır.',
  };
})();

// ───────────── MOSFET ─────────────
const mosPwm: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 0, 0, { V: 12 }).gnd('V1.n', 40, 80);
  b.add('lamp', 'LMP1', 200, 0, 90, { Vnom: 12, Pnom: 5 }).w(['V1.p', 'LMP1.a']);
  b.add('nmos', 'M1', 180, 120, 0, { model: 'IRF540', Vth: 3.5, K: 3, lambda: 0.005 }).w(['LMP1.b', 'M1.d']).gnd('M1.s', 220, 200);
  b.add('clock', 'CLK1', 20, 160, 0, { freq: 1000, duty: 0.5, V: 10 }).gnd('CLK1.n', 40, 240);
  b.add('resistor', 'RG', 80, 140, 0, { R: 100 }).w(['CLK1.p', 'RG.a'], ['RG.b', 'M1.g']);
  b.label('VG', 120, 60, 'RG.b').label('VD', 280, 100, 'M1.d');
  b.scope(380, 0, 'VG', 'VD', { timeDiv: 0.2e-3, ch1Div: 5, ch2Div: 5, ch1Pos: 1, ch2Pos: -3, trig: 5 });
  return {
    id: 'mosfet-pwm', topic: 'mosfet', level: 'Temel', mood: 'success', xp: 80,
    title: 'MOSFET ile PWM Parlaklık Kontrolü',
    subtitle: 'Güç MOSFET’i anahtar; doluluk oranıyla ortalama güç',
    keywords: ['pwm', 'mosfet', 'anahtar', 'doluluk', 'duty', 'lamba', 'motor'],
    doc: b.doc('MOSFET PWM'),
    steps: [
      run('**▶ Başlat**. Lamba %50 doluluk oranıyla yanıyor.'),
      { id: 'q1', title: 'Ortalama güç', text: 'Lamba 12 V / 5 W.', check: quiz('%50 PWM’de lambanın ortalama gücü kaçtır?', ['2,5 W', '5 W', '1,25 W', '0 W'], 'Anahtar ya tam açık ya kapalı: P_ort = D·P_tam = 0,5·5 = 2,5 W.'), xp: 15 },
      { id: 's1', title: 'Kıs', text: '**CLK1**’in doluluk oranını **%20**’ye indir.', check: { kind: 'param', comp: 'CLK1', param: 'duty', op: '<=', value: 0.2 }, success: 'Lamba ~1 W ile kısık yanıyor; MOSFET üzerindeki kayıp ise hâlâ çok küçük.' },
      { id: 'q2', title: 'Neden PWM?', text: 'Seri dirençle kısmakla karşılaştır.', check: quiz('PWM’in reosta ile kısmaya göre üstünlüğü nedir?', ['Anahtar ya tam açık ya kapalı olduğundan çok az ısı kaybı', 'Daha yüksek gerilim üretir', 'Lambanın direncini değiştirir', 'Akımı sabitler'], 'Açıkken V_DS ≈ I·R_DS(on) küçük, kapalıyken I ≈ 0: P = V·I her iki durumda da küçük. Reostada ise fark gerilim × akım ısıya gider.'), xp: 15 },
    ],
    theory: 'MOSFET gerilimle sürülür: V_GS > V_th iken kanal oluşur, triyot bölgesinde R_DS(on) ≈ 1/(k·(V_GS − V_th)). PWM’de ortalama güç doluluk oranıyla orantılıdır; frekans yük zaman sabitinden çok yüksek seçilir (LED, motor, ısıtıcı kontrolü).',
  };
})();

const cmosInv: Template = (() => {
  const b = new B();
  b.add('vdc', 'VDD', 20, 0, 0, { V: 5 }).gnd('VDD.n', 40, 80);
  b.add('pmos', 'MP', 180, 40, 0, { model: 'genel', Vth: 1, K: 2e-3 });
  b.add('nmos', 'MN', 180, 160, 0, { model: 'genel', Vth: 1, K: 2e-3 }).gnd('MN.s', 220, 240);
  b.w(['VDD.p', 'MP.s'], ['MP.d', 'MN.d'], ['MP.g', 'MN.g']);
  b.add('vac', 'VG1', 40, 200, 0, { wave: 'triangle', amp: 2.5, offset: 2.5, freq: 100 }).gnd('VG1.n', 60, 280).w(['VG1.p', 'MN.g']);
  b.label('VIN', -80, 180, 'VG1.p').label('VOUT', 280, 120, 'MP.d');
  b.scope(400, 0, 'VIN', 'VOUT', { timeDiv: 2e-3, ch1Div: 1, ch2Div: 1, ch1Pos: -2.5, ch2Pos: -2.5, trig: 2.5, xy: true });
  return {
    id: 'cmos-inverter', topic: 'mosfet', level: 'Orta', mood: 'info', xp: 80,
    title: 'CMOS Evirici ve Transfer Eğrisi',
    subtitle: 'NMOS + PMOS = dijital mantığın temeli',
    keywords: ['cmos', 'evirici', 'inverter', 'vtc', 'pmos', 'nmos'],
    doc: b.doc('CMOS Evirici'),
    steps: [
      run('**▶ Başlat**. XY modunda V_OUT – V_IN transfer eğrisi (VTC) çizilir.'),
      { id: 'q1', title: 'Eşik', text: 'Eğrinin dikleştiği giriş gerilimine bak.', check: quiz('Eşleşmiş NMOS/PMOS için anahtarlama eşiği nerededir?', ['V_DD/2 = 2,5 V', '1 V', '4 V', '0,7 V'], 'k_n = k_p ve |V_th| eşitse simetri gereği V_M = V_DD/2.'), xp: 15 },
      { id: 'q2', title: 'Statik güç', text: 'Giriş 0 ya da 5 V’ta iken hangi transistör açık?', check: quiz('Giriş sabit 0 V iken evirici ne kadar güç harcar?', ['≈ 0 (biri hep kapalı)', 'V_DD²/R', 'Çok yüksek', 'Girişe bağlı değil'], 'Giriş 0 → PMOS açık, NMOS kapalı: V_DD’den toprağa yol yok. CMOS yalnızca geçiş anında güç harcar; milyarlarca transistörlü işlemciler bu sayede mümkündür.'), xp: 15 },
    ],
    theory: 'CMOS evirici: PMOS çıkışı V_DD’ye, NMOS toprağa çeker. Girişler kapı olduğundan DC akım çekmez; statik güç ≈ 0. Dinamik güç P = C·V_DD²·f. Transfer eğrisinin dikliği (kazanç) gürültü paylarını belirler.',
  };
})();

export const DIODE_TEMPLATES: Template[] = [centerTap, doubler, diodeIV];
export const BJT_TEMPLATES: Template[] = [bjtSwitch, ceAmp, mirror];
export const MOSFET_TEMPLATES: Template[] = [mosPwm, cmosInv];
