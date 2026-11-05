// Deney havuzu (v0.2.1) — BJT, MOSFET, güç
import { B, quiz, run, type Template } from './lib';

const NPN = { model: 'genel', beta: 100 };
const PNP = { model: 'genel', beta: 100 };

// ───────────── BJT ─────────────
const emitterFollower: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, -20, 0, { V: 12 }).gnd('VCC.n', 40, 60);
  b.add('resistor', 'R1', 200, -40, 90, { R: 10e3 }).add('resistor', 'R2', 200, 100, 90, { R: 10e3 }).gnd('R2.b', 220, 180);
  b.add('npn', 'Q1', 260, 20, 0, NPN);
  b.add('resistor', 'RE', 280, 140, 90, { R: 1000 }).gnd('RE.b', 300, 220);
  b.w(['VCC.p', 'R1.a'], ['VCC.p', 'Q1.c'], ['R1.b', 'R2.a'], ['R1.b', 'Q1.b'], ['Q1.e', 'RE.a']);
  b.add('vac', 'VG1', 20, 140, 0, { amp: 1, freq: 1000 }).gnd('VG1.n', 40, 220);
  b.add('capacitor', 'CIN', 100, 40, 0, { C: 10e-6 }).w(['VG1.p', 'CIN.a'], ['CIN.b', 'Q1.b']);
  b.add('capacitor', 'COUT', 360, 80, 0, { C: 100e-6 }).w(['Q1.e', 'COUT.a']);
  b.add('resistor', 'RL', 480, 120, 90, { R: 1000 }).gnd('RL.b', 500, 200).w(['COUT.b', 'RL.a']);
  b.label('VIN', 100, -20, 'CIN.a').label('VOUT', 540, 60, 'RL.a');
  b.scope(620, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 0.5, ch2Div: 0.5, ch1Pos: 1.5, ch2Pos: -1.5, trig: 0 });
  return {
    id: 'emitter-follower', topic: 'bjt', level: 'Temel', mood: 'point', xp: 80,
    title: 'Emetör İzleyici (Ortak Kolektör)',
    subtitle: 'Gerilim kazancı ≈ 1, ama yükü rahatça sürer',
    keywords: ['emetör izleyici', 'ortak kolektör', 'buffer', 'tampon', 'empedans dönüştürücü'],
    doc: b.doc('Emetör İzleyici'),
    steps: [
      run('**▶ Başlat**. Giriş 1 V tepe; çıkış emetörden alınıyor.'),
      { id: 'q1', title: 'Kazanç', text: 'CH1 ile CH2’yi karşılaştır.', check: quiz('Gerilim kazancı ve faz nedir?', ['≈ 0,98, aynı faz', '≈ −10, ters faz', '≈ 100, aynı faz', '≈ 0,5, ters faz'], 'Emetör, tabanı ≈ 0,7 V aşağıdan izler: A_v = R′/(r_e + R′) ≈ 500/(500 + 4,7) ≈ 0,99. Faz değişmez.'), xp: 15 },
      { id: 'q2', title: 'Ne işe yarar?', text: 'Kazanç 1 ise neden kullanılır?', check: quiz('Emetör izleyicinin asıl faydası nedir?', ['Giriş direnci yüksek, çıkış direnci düşük: zayıf kaynağı ağır yükten yalıtır', 'Gerilimi yükseltir', 'Fazı çevirir', 'Gürültüyü yok eder'], 'Giriş direnci ≈ β·(RE‖RL) (burada R1‖R2 ile sınırlı), çıkış direnci ≈ r_e + R_kaynak/β: birkaç ohm. Akım kazancı ≈ β.'), xp: 15 },
      { id: 's1', title: 'Ağır yük', text: '**RL**’yi **100 Ω** yap.', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 100 }, success: 'Çıkış hâlâ girişe yakın. Ama negatif tepede kırpılma olabilir: RE, yük akımını çekebilecek kadar küçük olmalı (I_E ≈ 5,3 mA → 0,53 V tepe).' },
    ],
    theory: 'Ortak kolektör (emetör izleyici) bağlantısında çıkış emetörden alınır: V_E = V_B − 0,7 V. Gerilim kazancı 1’e yakın, akım kazancı β+1’dir. Tampon (buffer), seviye kaydırıcı, push-pull çıkış katı ve regülatörlerde seri geçiş elemanı olarak kullanılır.',
  };
})();

const darlington: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, -20, 0, { V: 12 }).gnd('VCC.n', 40, 60);
  b.add('logicin', 'IN1', 20, 180);
  // Tek transistör
  b.add('lamp', 'LMP1', 200, -40, 90, { Vnom: 12, Pnom: 3 }).add('npn', 'Q1', 180, 100, 0, NPN).gnd('Q1.e', 220, 180);
  b.add('resistor', 'RB1', 100, 120, 0, { R: 100e3 });
  b.w(['VCC.p', 'LMP1.a'], ['LMP1.b', 'Q1.c'], ['IN1.y', 'RB1.a'], ['RB1.b', 'Q1.b']);
  // Darlington
  b.add('lamp', 'LMP2', 540, -40, 90, { Vnom: 12, Pnom: 3 }).add('npn', 'Q2', 420, 220, 0, NPN).add('npn', 'Q3', 520, 300, 0, NPN).gnd('Q3.e', 560, 380);
  b.add('resistor', 'RB2', 300, 240, 0, { R: 100e3 });
  b.w(['VCC.p', 'LMP2.a'], ['LMP2.b', 'Q2.c'], ['LMP2.b', 'Q3.c'], ['Q2.e', 'Q3.b'], ['IN1.y', 'RB2.a'], ['RB2.b', 'Q2.b']);
  b.label('VC1', 260, 40, 'Q1.c').label('VC2', 620, 40, 'Q3.c');
  return {
    id: 'darlington', topic: 'bjt', level: 'Orta', mood: 'success', xp: 80,
    title: 'Darlington Çifti',
    subtitle: 'β₁·β₂: mikroamperle amperleri sür',
    keywords: ['darlington', 'yüksek kazanç', 'akım kazancı', 'lamba sürme', 'tip120', 'uln2003'],
    doc: b.doc('Darlington Çifti'),
    steps: [
      run('**▶ Başlat**. İki lamba da 12 V / 3 W (≈ 0,25 A). Taban dirençleri 100 kΩ.'),
      { id: 's1', title: 'Girişi aç', text: '**IN1**’i **1** yap (çift tıkla).', check: { kind: 'param', comp: 'IN1', param: 'on', op: '==', value: true } },
      { id: 'q1', title: 'Tek transistör', text: 'Soldaki lamba neden sönük?', check: quiz('Tek transistörlü kolun kolektör akımı yaklaşık kaçtır?', ['≈ 4,3 mA (β·I_B)', '≈ 0,42 A', '0', '≈ 43 µA'], 'I_B = (5 − 0,7)/100k ≈ 43 µA → I_C = β·I_B ≈ 4,3 mA. Lambanın ihtiyacı olan 250 mA’in %2’si.'), xp: 15 },
      { id: 'q2', title: 'Darlington', text: 'Sağdaki lamba tam yanıyor.', check: quiz('Darlington’un toplam akım kazancı yaklaşık kaçtır?', ['≈ β² = 10 000', '≈ 2β = 200', '≈ β = 100', '≈ 1'], 'Q2’nin emetör akımı Q3’ün taban akımı olur: β_toplam ≈ β₁·β₂. 43 µA × 10 000 = 430 mA > 250 mA → transistör doyuma girdi, lamba tam yanıyor.'), xp: 15 },
      { id: 'q3', title: 'Bedeli', text: 'VC2’yi Değer Okuma ile oku.', check: quiz('Darlington iletimdeyken V_CE neden ~0,8 V’un altına inemez?', ['Q3’ün V_CE’si = Q2’nin V_CE(sat) + Q3’ün V_BE’si', 'Lamba yüzünden', 'Ölçüm hatası', 'İner, 0,1 V olur'], 'Q2 doyuma girse bile Q3’ün kolektörü tabanından ≈ V_CE,sat yukarıdadır: V_CE ≈ 0,1 + 0,7 V. Daha çok ısınır; güç anahtarlamada MOSFET’ler bu yüzden tercih edilir. Toplam V_BE de ≈ 1,4 V’tur.'), xp: 15 },
    ],
    theory: 'Darlington bağlantısı iki transistörü tek, çok yüksek kazançlı bir transistör gibi kullanır (TIP120, ULN2003 röle sürücüleri). Avantaj: mikrodenetleyici pininden büyük yükler sürülebilir. Dezavantajlar: V_BE ≈ 1,4 V, V_CE(sat) ≈ 0,8–1 V (ısınma), daha yavaş kapanma.',
  };
})();

const diffPair: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, -80, 0, { V: 12 }).gnd('VCC.n', 40, 0);
  b.add('vdc', 'VEE', 20, 260, 0, { V: 12 }).gnd('VEE.p', 40, 220);
  b.add('resistor', 'RC1', 180, -60, 90, { R: 10e3 }).add('resistor', 'RC2', 400, -60, 90, { R: 10e3 });
  b.add('npn', 'Q1', 160, 60, 0, NPN).add('npn', 'Q2', 380, 60, 0, NPN);
  b.add('resistor', 'RT', 280, 180, 90, { R: 10e3 });
  b.w(['VCC.p', 'RC1.a'], ['VCC.p', 'RC2.a'], ['RC1.b', 'Q1.c'], ['RC2.b', 'Q2.c'], ['Q1.e', 'RT.a'], ['Q2.e', 'RT.a'], ['RT.b', 'VEE.n']);
  b.add('vac', 'VG1', 60, 100, 0, { amp: 0.01, freq: 1000 }).gnd('VG1.n', 80, 180).w(['VG1.p', 'Q1.b']);
  b.add('vac', 'VG2', 540, 100, 0, { amp: 0, freq: 1000 }).gnd('VG2.n', 560, 180).w(['VG2.p', 'Q2.b']);
  b.label('VC1', 240, -20, 'Q1.c').label('VC2', 460, -20, 'Q2.c');
  b.scope(640, -60, 'VC1', 'VC2', { timeDiv: 0.2e-3, ch1Div: 0.5, ch2Div: 0.5, ch1Pos: -12, ch2Pos: -12, trig: 6 });
  return {
    id: 'diff-pair', topic: 'bjt', level: 'İleri', mood: 'info', xp: 110,
    title: 'Diferansiyel Çift',
    subtitle: 'Op-amp’ın giriş katı: farkı yükselt, ortak sinyali bastır',
    keywords: ['diferansiyel çift', 'fark kuvvetlendirici', 'cmrr', 'ortak mod', 'long tailed pair'],
    doc: b.doc('Diferansiyel Çift'),
    steps: [
      run('**▶ Başlat**. Q1’e 10 mV sinyal, Q2’nin tabanı 0 V. Kuyruk akımı ≈ (12 − 0,7)/10k ≈ 1,13 mA.'),
      { id: 'q1', title: 'İki çıkış', text: 'CH1 (VC1) ve CH2 (VC2) arasındaki faza bak.', check: quiz('VC1 ve VC2 nasıl değişir?', ['Eşit genlikte, 180° zıt fazlı', 'Aynı fazlı', 'Yalnızca VC1 değişir', 'İkisi de sabit'], 'Kuyruk akımı sabittir: Q1 ne kadar fazla çekerse Q2 o kadar az çeker. Çıkışlar zıt yönde salınır.'), xp: 15 },
      { id: 'q2', title: 'Kazanç', text: 'Her transistör ≈ 0,56 mA → g_m ≈ 22 mS', check: quiz('Tek uçlu (VC1) gerilim kazancı yaklaşık kaçtır?', ['≈ 110', '≈ 1', '≈ 10', '≈ 1000'], 'A_d(tek uç) = g_m·R_C/2 ≈ 0,022·10k/2 ≈ 110 → 10 mV girişte ≈ 1,1 V tepe. Çift uçlu (VC1 − VC2) kazanç bunun iki katı.'), xp: 20 },
      { id: 's1', title: 'Ortak mod', text: 'Aynı sinyali iki girişe ver: **VG2**’nin genliğini **0,01 V** yap.', check: { kind: 'param', comp: 'VG2', param: 'amp', op: '>=', value: 0.01 }, success: 'Çıkışlardaki salınım neredeyse kayboldu: iki giriş birlikte değişince fark sıfır. Ortak mod kazancı ≈ R_C/(2R_T) = 0,5 (220 kat küçük) — bu oran CMRR’dir.' },
    ],
    theory: 'Uzun kuyruklu çift (long-tailed pair) iki girişin farkını kuvvetlendirir, ortak bileşeni (gürültü, sıcaklık kayması, şebeke paraziti) bastırır. A_d = g_m·R_C, A_cm ≈ −R_C/(2R_T); CMRR = A_d/A_cm. Kuyruğa direnç yerine akım kaynağı konunca CMRR binlerce kat artar. Her op-amp’ın girişi bir diferansiyel çifttir.',
  };
})();

const pushPull: Template = (() => {
  const b = new B();
  b.add('vdc', 'VCC', 20, -80, 0, { V: 12 }).gnd('VCC.n', 40, 0);
  b.add('vdc', 'VEE', 20, 260, 0, { V: 12 }).gnd('VEE.p', 40, 220);
  b.add('npn', 'Q1', 220, 0, 0, NPN).add('pnp', 'Q2', 220, 120, 0, PNP);
  b.w(['VCC.p', 'Q1.c'], ['Q2.c', 'VEE.n'], ['Q1.e', 'Q2.e']);
  b.add('vac', 'VG1', 100, 100, 0, { amp: 5, freq: 1000 }).gnd('VG1.n', 120, 180).w(['VG1.p', 'Q1.b'], ['VG1.p', 'Q2.b']);
  b.add('resistor', 'RL', 340, 100, 90, { R: 100 }).gnd('RL.b', 360, 180).w(['Q1.e', 'RL.a']);
  b.label('VIN', 140, 40, 'VG1.p').label('VOUT', 400, 60, 'RL.a');
  b.scope(480, 0, 'VIN', 'VOUT', { timeDiv: 0.2e-3, ch1Div: 2, ch2Div: 2, trig: 0 });
  return {
    id: 'push-pull', topic: 'bjt', level: 'İleri', mood: 'surprised', xp: 100,
    title: 'B Sınıfı Push-Pull Çıkış Katı',
    subtitle: 'NPN iter, PNP çeker — ve geçiş (crossover) bozulması',
    keywords: ['push pull', 'b sınıfı', 'ab sınıfı', 'crossover', 'güç kuvvetlendirici', 'tümleyen'],
    doc: b.doc('Push-Pull Çıkış Katı'),
    steps: [
      run('**▶ Başlat**. Pozitif yarıda Q1 (NPN), negatif yarıda Q2 (PNP) iletir.'),
      { id: 'q1', title: 'Tepe çıkış', text: 'Giriş 5 V tepe.', check: quiz('Çıkış tepe değeri yaklaşık kaçtır?', ['≈ 4,3 V', '5 V', '12 V', '≈ 2,5 V'], 'Her transistör emetör izleyicidir: V_out = V_in − 0,7 V (pozitifte) / + 0,7 V (negatifte).'), xp: 15 },
      { id: 'q2', title: 'Geçiş bozulması', text: 'CH2’de sıfır geçişlerine yakından bak.', check: quiz('Çıkışın sıfır civarında “düz” kalmasının sebebi nedir?', ['|V_in| < 0,6 V iken iki transistör de kesimde', 'Kaynak yetersiz', 'Yük çok küçük', 'Op-amp yok'], 'İki transistörün de V_BE eşiğine ulaşmadığı ±0,6 V bölgesinde çıkış sıfırda kalır: crossover distortion. Seste “cızırtı” olarak duyulur.'), xp: 15 },
      { id: 's1', title: 'Küçük sinyal', text: '**VG1** genliğini **1 V** yap.', check: { kind: 'param', comp: 'VG1', param: 'amp', op: '<=', value: 1 }, success: 'Bozulma oransal olarak çok daha kötü: sinyalin büyük kısmı ölü bölgede. Çözüm AB sınıfı: tabanlar arasına iki diyot (ya da V_BE çarpanı) koyup transistörleri hafifçe iletimde tutmak.' },
    ],
    theory: 'B sınıfı push-pull’da her transistör periyodun yarısında iletir; boşta akım çekmediği için verim %78,5’e kadar çıkar (A sınıfında %25). Bedeli geçiş bozulmasıdır. AB sınıfında küçük bir boşta akım (bias) ölü bölgeyi kaldırır; ses kuvvetlendiricilerinin çoğu böyledir. Op-amp’lı geri besleme de bozulmayı azaltır.',
  };
})();

// ───────────── MOSFET ─────────────
const idVgs: Template = (() => {
  const b = new B();
  b.add('vac', 'VG1', 20, 60, 0, { wave: 'triangle', amp: 2.5, offset: 2.5, freq: 50 }).gnd('VG1.n', 40, 140);
  b.add('vdc', 'VDD', 360, -80, 0, { V: 10 }).gnd('VDD.n', 380, 0);
  b.add('nmos', 'M1', 180, 40, 0, { model: '2N7000', Vth: 2.1, K: 0.1, lambda: 0.01 }).w(['VG1.p', 'M1.g']);
  b.add('resistor', 'RS', 200, 160, 90, { R: 1 }).gnd('RS.b', 220, 240).w(['M1.s', 'RS.a']);
  b.add('resistor', 'RD', 220, -80, 90, { R: 1 }).w(['VDD.p', 'RD.a'], ['RD.b', 'M1.d']);
  b.label('VGS', 100, -20, 'VG1.p').label('VID', 280, 140, 'RS.a');
  b.scope(480, 0, 'VGS', 'VID', { timeDiv: 5e-3, ch1Div: 0.5, ch2Div: 0.2, ch1Pos: -5, ch2Pos: -4, trig: 2.5, xy: true });
  return {
    id: 'id-vgs', topic: 'mosfet', level: 'Orta', mood: 'point', xp: 80,
    title: 'MOSFET Transfer Karakteristiği (I_D–V_GS)',
    subtitle: 'Eşik gerilimi ve kare yasası, osiloskop XY modunda',
    keywords: ['id vgs', 'transfer karakteristiği', 'eşik gerilimi', 'kare yasası', '2n7000', 'xy'],
    doc: b.doc('MOSFET I_D–V_GS'),
    steps: [
      run('**▶ Başlat**. Osiloskop XY modunda: yatay V_GS (0–5 V üçgen), dikey I_D (1 Ω üzerinde, 1 V = 1 A).'),
      { id: 'q1', title: 'Eşik', text: 'Eğrinin yerden kalktığı V_GS’ye bak.', check: quiz('2N7000’in eşik gerilimi yaklaşık kaçtır?', ['≈ 2,1 V', '≈ 0,7 V', '≈ 5 V', '0 V'], 'V_GS < V_th iken kanal yoktur, I_D ≈ 0. Datasheet’te V_GS(th) 0,8–3 V aralığında verilir: lojik seviyeli olmayan MOSFET’lerde 5 V kapı bile sınırda kalabilir.'), xp: 15 },
      { id: 'q2', title: 'Kare yasası', text: 'I_D = ½·K·(V_GS − V_th)²', check: quiz('V_GS − V_th iki katına çıkınca I_D ne olur?', ['4 katına çıkar', '2 katına çıkar', 'Değişmez', 'Yarıya iner'], 'Doyum bölgesinde akım aşırı sürüş geriliminin karesiyle artar: K = 0,1 A/V² → V_GS = 3,1 V’ta 50 mA, 4,1 V’ta 200 mA. (5 V’ta ≈ 0,35 A’de kalır: 1 Ω’luk ölçüm direnci V_GS’yi biraz azaltır.)'), xp: 15 },
      { id: 's1', title: 'Güç MOSFET’i', text: '**M1**’in modelini **IRF540**’a çevir (Özellikler → Model).', check: { kind: 'param', comp: 'M1', param: 'model', op: '==', value: 'IRF540' }, success: 'Eşik 3,5 V’a kaydı ama eğri çok daha dik yükseliyor (K = 3): akımı artık 1 Ω’luk ölçüm direnci sınırlıyor. Büyük kanal genişliği = büyük K = küçük R_DS(on).' },
    ],
    theory: 'n-kanallı zenginleştirme MOSFET’inde V_GS > V_th olunca kapı altında iletken kanal oluşur. Doyum bölgesinde (V_DS > V_GS − V_th) I_D = ½K(V_GS − V_th)²(1 + λV_DS), K = µC_ox·W/L. Geçiş iletkenliği g_m = √(2K·I_D). Bu deneyde V_DS ≈ 10 V olduğundan transistör hep doyumdadır.',
  };
})();

const loadSwitch: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, -40, 0, { V: 12 }).gnd('V1.n', 40, 40);
  b.add('pmos', 'M1', 260, -100, 0, { model: 'IRF9540', Vth: 3.5, K: 2, lambda: 0.005 });
  b.add('resistor', 'RG', 180, -20, 90, { R: 10e3 });
  b.add('npn', 'Q1', 160, 120, 0, NPN).gnd('Q1.e', 200, 200);
  b.add('resistor', 'RB', 60, 140, 0, { R: 10e3 }).add('logicin', 'IN1', -60, 140);
  b.add('lamp', 'LMP1', 340, 40, 90, { Vnom: 12, Pnom: 5 }).gnd('LMP1.b', 360, 120);
  b.w(['V1.p', 'M1.s'], ['V1.p', 'RG.a'], ['RG.b', 'M1.g'], ['RG.b', 'Q1.c'], ['IN1.y', 'RB.a'], ['RB.b', 'Q1.b'], ['M1.d', 'LMP1.a']);
  b.label('VG', 120, 40, 'M1.g').label('VOUT', 400, -20, 'LMP1.a');
  return {
    id: 'load-switch', topic: 'mosfet', level: 'Temel', mood: 'success', xp: 70,
    title: 'P-MOSFET Yük Anahtarı (Yüksek Taraf)',
    subtitle: '5 V lojikle 12 V’luk bir yükün artı ucunu anahtarla',
    keywords: ['yük anahtarı', 'high side', 'p-mosfet', 'seviye kaydırma', 'pmos anahtar'],
    doc: b.doc('P-MOSFET Yük Anahtarı'),
    steps: [
      run('**▶ Başlat**. IN1 = 0: Q1 kesimde, RG kapıyı 12 V’a çekiyor → V_SG = 0, lamba sönük.'),
      { id: 's1', title: 'Aç', text: '**IN1**’i **1** yap.', check: { kind: 'param', comp: 'IN1', param: 'on', op: '==', value: true }, success: 'Q1 kapıyı toprağa çekti: V_SG = 12 V → M1 tam iletimde, lamba yandı.' },
      { id: 'q1', title: 'Neden Q1?', text: 'Kapıyı doğrudan mikrodenetleyiciye bağlasaydık…', check: quiz('Neden 5 V’luk lojik çıkış P-MOSFET’in kapısına doğrudan bağlanmaz?', ['5 V’ta V_SG = 7 V kalır, MOSFET hiç kapanmaz', 'Lojik çıkış yanar', 'MOSFET çok hızlı açılır', 'Fark etmez'], 'P-MOSFET’i kapatmak için kapı kaynak gerilimine (12 V) çekilmeli; 5 V çıkış bunu yapamaz. Q1 bir seviye kaydırıcıdır: 5 V lojiği 0/12 V kapı sinyaline çevirir.'), xp: 15 },
      { id: 'q2', title: 'Neden yüksek taraf?', text: 'Yükün toprağı ortak kalıyor.', check: quiz('Yükü artı taraftan anahtarlamanın avantajı nedir?', ['Yük gövdeye (toprağa) bağlı kalır; araçlarda ve kısa devre korumasında tercih edilir', 'Daha ucuzdur', 'Daha az akım çeker', 'Avantajı yoktur'], 'Alçak taraf anahtarlamada (N-MOSFET) yük kapalıyken bile 12 V’ta durur; otomobilde gövdeye kısa devre tehlikelidir. Yüksek taraf anahtarlama yükü kapalıyken 0 V’ta tutar.'), xp: 15 },
    ],
    theory: 'P-MOSFET kaynak ucu yüksek gerilime bağlanır; kapı kaynaktan |V_th|’den fazla aşağı çekilince iletir. Kapı–kaynak arası direnç (RG) varsayılan durumu “kapalı” yapar. Akım tüketimi düşük, düşümü I·R_DS(on) kadar küçük olduğundan pil ile çalışan cihazlarda güç yolunu açıp kapatmak için yaygındır.',
  };
})();

const hBridge: Template = (() => {
  const b = new B();
  const PM = { model: 'IRF9540', Vth: 3.5, K: 2, lambda: 0.005 };
  const NM = { model: 'IRF540', Vth: 3.5, K: 3, lambda: 0.005 };
  b.add('vdc', 'V1', -80, 80, 0, { V: 12 }).gnd('V1.n', -60, 160);
  b.add('pmos', 'MA1', 80, -40, 0, PM).add('nmos', 'MA2', 80, 160, 0, NM).gnd('MA2.s', 120, 240);
  b.add('pmos', 'MB1', 460, -40, 0, PM).add('nmos', 'MB2', 460, 160, 0, NM).gnd('MB2.s', 500, 240);
  b.add('logicin', 'A', -60, 300, 0, { V: 12 }).add('logicin', 'B', 560, 300, 0, { V: 12 });
  b.w(['V1.p', 'MA1.s'], ['V1.p', 'MB1.s'], ['MA1.d', 'MA2.d'], ['MB1.d', 'MB2.d']);
  b.w(['A.y', 'MA1.g'], ['A.y', 'MA2.g'], ['B.y', 'MB1.g'], ['B.y', 'MB2.g']);
  // Motor: sargı direnci + endüktansı, akım ölçümü
  b.add('multimeter', 'DMM1', 220, -120, 0, { mode: 'DCA' });
  b.add('resistor', 'RM', 220, 80, 0, { R: 10 }).add('inductor', 'LM', 340, 80, 0, { L: 1e-3 });
  b.w(['MA1.d', 'DMM1.pos'], ['DMM1.com', 'RM.a'], ['RM.b', 'LM.a'], ['LM.b', 'MB1.d']);
  b.label('OUTA', 160, 40, 'MA1.d').label('OUTB', 420, 40, 'MB1.d');
  return {
    id: 'h-bridge', topic: 'mosfet', level: 'İleri', mood: 'success', xp: 100,
    title: 'H-Köprüsü ile DC Motor Yön Kontrolü',
    subtitle: 'Dört anahtar, iki yön, bir de fren',
    keywords: ['h köprüsü', 'h bridge', 'motor sürücü', 'yön kontrolü', 'l298', 'dc motor'],
    doc: b.doc('H-Köprüsü'),
    steps: [
      run('**▶ Başlat**. Her yarım köprü bir CMOS evirici gibi: giriş 0 → üst P-MOSFET açık (çıkış 12 V), giriş 1 → alt N-MOSFET açık (çıkış 0 V). Motor = 10 Ω + 1 mH.'),
      { id: 'q1', title: 'A = B = 0', text: 'İki çıkış da 12 V.', check: quiz('A = B = 0 iken motor akımı ne olur?', ['0 — iki uç aynı gerilimde (fren/boşta)', '1,2 A ileri', '1,2 A geri', 'Kısa devre'], 'Motorun iki ucu da 12 V’ta: üzerinde gerilim yok. Dönen bir motorda bu durum uçları kısa devre ederek “dinamik fren” yapar.'), xp: 15 },
      { id: 's1', title: 'İleri', text: '**B**’yi **1** yap.', check: { kind: 'param', comp: 'B', param: 'on', op: '==', value: true }, success: 'OUTA = 12 V, OUTB = 0 V: akım A’dan B’ye ≈ +1,2 A. Motor ileri döner.' },
      { id: 's2', title: 'Geri', text: 'Şimdi **A = 1**, **B = 0** yap.', check: { kind: 'param', comp: 'B', param: 'on', op: '==', value: false }, success: 'Akım ters yönde (DMM1 eksi gösterir): motor geri döner.' },
      { id: 'q2', title: 'Yasak durum', text: 'Bir yarım köprünün iki transistörü…', check: quiz('Aynı taraftaki üst ve alt transistör aynı anda iletirse ne olur?', ['Kaynak doğrudan toprağa kısa devre olur (shoot-through)', 'Motor hızlanır', 'Hiçbir şey', 'Motor durur'], 'Buna “shoot-through” denir ve transistörleri anında yakabilir. Burada kapılar ortak olduğu için imkânsız; gerçek sürücülerde geçişlerde kısa bir “ölü zaman” bırakılır.'), xp: 15 },
    ],
    theory: 'H-köprüsü, motorun her iki ucunu da 0 V ya da V_kaynak’a bağlayabilen dört anahtardan oluşur. Çapraz iki anahtar açıkken akım bir yönde, diğer çapraz çift açıkken ters yönde akar. PWM ile hız da kontrol edilir. L298, DRV8833, TB6612 gibi entegreler bunu hazır sunar; MOSFET’lerin gövde diyotları motorun geri tepme akımına yol verir.',
  };
})();

// ───────────── Güç ─────────────
const zenerFollower: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 0, 0, { V: 12 }).gnd('V1.n', 40, 80);
  b.add('resistor', 'RZ', 160, 0, 90, { R: 1000 }).add('zener', 'DZ', 160, 120, 270, { Vz: 6.2 }).gnd('DZ.a', 180, 200);
  b.add('npn', 'Q1', 240, 40, 0, NPN);
  b.w(['V1.p', 'RZ.a'], ['V1.p', 'Q1.c'], ['RZ.b', 'DZ.k'], ['RZ.b', 'Q1.b']);
  b.add('resistor', 'RL', 360, 120, 90, { R: 100 }).gnd('RL.b', 380, 200).w(['Q1.e', 'RL.a']);
  b.add('multimeter', 'DMM1', 420, -80, 0, { mode: 'DCV' }).w(['DMM1.pos', 'RL.a']).gnd('DMM1.com', 500, 20);
  b.label('VZ', 100, 80, 'DZ.k').label('VOUT', 420, 60, 'RL.a');
  return {
    id: 'zener-follower', topic: 'power', level: 'Orta', mood: 'point', xp: 80,
    title: 'Zener + Emetör İzleyici Regülatör',
    subtitle: 'Ayrık elemanlarla doğrusal regülatör: 7805’in atası',
    keywords: ['zener', 'emetör izleyici', 'seri regülatör', 'doğrusal regülatör', 'seri geçiş'],
    doc: b.doc('Zener + Emetör İzleyici'),
    steps: [
      run('**▶ Başlat**. Zener tabanı 6,2 V’ta tutuyor, transistör yük akımını taşıyor.'),
      { id: 'q1', title: 'Çıkış', text: 'VOUT = V_Z − V_BE', check: quiz('Çıkış gerilimi yaklaşık kaçtır?', ['≈ 5,5 V', '6,2 V', '12 V', '≈ 0,7 V'], 'Emetör tabandan bir V_BE aşağıda: 6,2 − 0,7 ≈ 5,5 V → RL’den ≈ 55 mA.'), xp: 15 },
      { id: 'q2', title: 'Neden transistör?', text: 'Zener’i doğrudan yüke bağlasaydık…', check: quiz('Yalnızca 1 kΩ + zener ile 55 mA verilebilir miydi?', ['Hayır: 1 kΩ en fazla ≈ 5,8 mA verebilir', 'Evet, kolayca', 'Evet ama ısınır', 'Zener akım üretir'], 'RZ’den (12 − 6,2)/1k ≈ 5,8 mA akar. Transistör bu akımı β kat yükseltir: taban yalnızca ≈ 0,55 mA çeker, kalanı zenerde kalır. Zener artık yük değişiminden neredeyse etkilenmez.'), xp: 15 },
      { id: 's1', title: 'Yükü artır', text: '**RL**’yi **47 Ω** yap (≈ 115 mA).', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 47 }, success: 'Çıkış birkaç on mV düştü (V_BE akımla hafifçe artar). Transistörün harcadığı güç: (12 − 5,4)·0,115 ≈ 0,76 W — soğutucu düşünülmeli.' },
    ],
    theory: 'Seri (doğrusal) regülatörün temeli: kararlı bir referans (zener) + akım taşıyan bir seri geçiş elemanı (emetör izleyici). Yük değişince V_BE çok az değiştiğinden çıkış sabit kalır. 78xx entegreleri buna bir hata kuvvetlendiricisi, akım sınırlama ve ısıl koruma ekler.',
  };
})();

const currentLimit: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 20, 0, 0, { V: 12 }).gnd('V1.n', 40, 80);
  b.add('resistor', 'RZ', 160, 0, 90, { R: 1000 }).add('zener', 'DZ', 160, 120, 270, { Vz: 6.2 }).gnd('DZ.a', 180, 200);
  b.add('npn', 'Q1', 240, 40, 0, NPN);
  b.w(['V1.p', 'RZ.a'], ['V1.p', 'Q1.c'], ['RZ.b', 'DZ.k'], ['RZ.b', 'Q1.b']);
  b.add('resistor', 'RS', 320, 120, 0, { R: 6.8 }).w(['Q1.e', 'RS.a']);
  // Akım sınırlama transistörü: RS üzerindeki gerilim 0,65 V'u geçince Q1'in taban akımını çalar
  b.add('npn', 'Q2', 340, 200, 0, NPN).w(['Q2.b', 'RS.a'], ['Q2.e', 'RS.b'], ['Q2.c', 'Q1.b']);
  b.add('multimeter', 'DMM1', 440, -60, 0, { mode: 'DCA' }).w(['RS.b', 'DMM1.pos']);
  b.add('resistor', 'RL', 560, 80, 90, { R: 100 }).gnd('RL.b', 580, 160).w(['DMM1.com', 'RL.a']);
  b.add('switch', 'S1', 640, 80, 90, { closed: false }).gnd('S1.b', 660, 160).w(['DMM1.com', 'S1.a']);
  b.label('VOUT', 620, 20, 'RL.a');
  return {
    id: 'current-limit', topic: 'power', level: 'İleri', mood: 'angry', xp: 100,
    title: 'Transistörlü Akım Sınırlama',
    subtitle: 'Kısa devreye dayanıklı güç kaynağı',
    keywords: ['akım sınırlama', 'kısa devre koruma', 'current limit', 'güç kaynağı', 'şönt'],
    doc: b.doc('Akım Sınırlama'),
    steps: [
      run('**▶ Başlat**. Normal yük (100 Ω): Q2 kesimde, devre bir zener + emetör izleyici regülatör gibi çalışıyor.'),
      { id: 'q1', title: 'Sınır akımı', text: 'Q2, RS üzerindeki gerilim ≈ 0,65–0,75 V olunca iletime geçer.', check: quiz('Akım sınırı yaklaşık kaçtır?', ['≈ 0,1 A', '≈ 1 A', '≈ 5 mA', 'Sınırsız'], 'I_sınır ≈ V_BE(Q2)/RS ≈ 0,7/6,8 ≈ 0,1 A. Kısa devrede Q2 tüm taban akımını çalmak için biraz daha fazla V_BE ister: ≈ 0,11 A.'), xp: 15 },
      { id: 's1', title: 'Kısa devre!', text: '**S1**’i kapat: çıkış toprağa kısa devre.', check: { kind: 'switch', comp: 'S1', closed: true }, success: 'Akım ≈ 0,11 A’de kaldı, hiçbir şey yanmadı. Q2, Q1’in taban akımını “çalarak” çıkışı düşürdü.' },
      { id: 'q2', title: 'Isı', text: 'Kısa devrede kim ısınır?', check: quiz('Kısa devre sırasında Q1 yaklaşık ne kadar güç harcar?', ['≈ 1,3 W', '0 W', '≈ 12 W', '≈ 0,1 W'], 'Q1 üzerinde ≈ 12 − 0,8 ≈ 11,2 V düşer: 11,2 V × 0,11 A ≈ 1,3 W. Sınırlama yangını önler ama ısıyı transistöre taşır; laboratuvar kaynaklarında “foldback” (geri katlamalı) sınırlama bu yüzden kullanılır.'), xp: 15 },
    ],
    theory: 'Akım algılama direnci (RS) üzerindeki gerilim akımla orantılıdır. Q2’nin V_BE’si eşiğe ulaşınca Q2 iletir ve Q1’in taban sürüşünü azaltır: çıkış akımı ≈ 0,65/RS’de sabitlenir. Laboratuvar güç kaynaklarının “CC” (sabit akım) modu ve 78xx’lerin iç koruması bu prensiple çalışır.',
  };
})();

export const POOL_B: Template[] = [emitterFollower, darlington, diffPair, pushPull, idVgs, loadSwitch, hBridge, zenerFollower, currentLimit];
