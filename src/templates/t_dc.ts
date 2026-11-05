// DC Devre Analizi deneyleri
import { B, quiz, run, type Template } from './lib';

const divider: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 100, 140, 0, { V: 12 }).gnd('V1.n', 120, 220);
  b.add('resistor', 'R1', 240, 60, 90, { R: 10e3 }).add('resistor', 'R2', 240, 180, 90, { R: 10e3 }).gnd('R2.b', 260, 260);
  b.w(['V1.p', 'R1.a'], ['R1.b', 'R2.a']);
  b.add('switch', 'S1', 300, 140, 0, { closed: false }).add('resistor', 'RL', 420, 180, 90, { R: 10e3 }).gnd('RL.b', 440, 260);
  b.w(['R1.b', 'S1.a'], ['S1.b', 'RL.a']);
  b.add('multimeter', 'DMM1', 520, 20, 0, { mode: 'DCV' }).w(['DMM1.pos', 'R1.b']).gnd('DMM1.com', 600, 120);
  b.label('VOUT', 260, -60, 'R1.b');
  return {
    id: 'voltage-divider',
    topic: 'dc',
    title: 'Gerilim Bölücü ve Yükleme Etkisi',
    subtitle: 'İki dirençle gerilim bölme; yük bağlanınca neden düşer?',
    level: 'Isınma',
    mood: 'hello',
    xp: 60,
    keywords: ['bölücü', 'yük', 'divider', 'loading'],
    doc: b.doc('Gerilim Bölücü ve Yükleme Etkisi'),
    steps: [
      run('**▶ Başlat**’a bas. DMM1, R2 üzerindeki gerilimi (VOUT) ölçüyor.'),
      { id: 'q1', title: 'Yüksüz çıkış', text: 'S1 açıkken yük bağlı değil.', check: quiz('VOUT kaç volttur? (V1 = 12 V, R1 = R2 = 10 kΩ)', ['6 V', '12 V', '4 V', '3 V'], 'VOUT = V1·R2/(R1+R2) = 12·10k/20k = 6 V.'), xp: 15 },
      { id: 's1', title: 'Yükü bağla', text: '**S1**’i kapat (çift tıkla). 10 kΩ’luk RL, R2’ye paralel bağlanır.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 'q2', title: 'Yüklü çıkış', text: 'DMM1’in yeni değerine bak.', check: quiz('Yük bağlıyken VOUT yaklaşık kaçtır?', ['4 V', '6 V', '5 V', '2 V'], 'R2‖RL = 5 kΩ olduğundan VOUT = 12·5k/15k = 4 V. Bölücünün çıkış direnci (R1‖R2 = 5 kΩ) yükle bir bölücü oluşturur.'), xp: 15 },
      { id: 's2', title: 'Kural: RL ≫ R', text: '**RL**’yi **100 kΩ** yap. Çıkış 6 V’a ne kadar yaklaştı?', check: { kind: 'param', comp: 'RL', param: 'R', op: '>=', value: 100e3 }, success: 'VOUT ≈ 5,7 V. Yük direnci bölücü dirençlerinin en az ~10 katı olmalı; yoksa referans gerilimi bozulur.' },
    ],
    theory: 'Seri iki dirençte akım aynıdır, gerilim dirençlerle orantılı bölünür: VOUT = VIN·R2/(R1+R2). Çıkışa yük bağlanınca R2’nin yerine R2‖RL geçer ve çıkış düşer. Bölücünün Thevenin eşdeğeri: V_TH = 6 V, R_TH = R1‖R2 = 5 kΩ.',
  };
})();

const kvl: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 100, 140, 0, { V: 12 }).gnd('V1.n', 120, 220);
  b.add('multimeter', 'DMM1', 100, -80, 0, { mode: 'DCA' }).w(['V1.p', 'DMM1.pos']);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['DMM1.com', 'R1.a']);
  b.add('resistor', 'R2', 320, 100, 90, { R: 2000 }).gnd('R2.b', 340, 180);
  b.add('resistor', 'R3', 420, 100, 90, { R: 3000 }).gnd('R3.b', 440, 180);
  b.w(['R1.b', 'R2.a'], ['R2.a', 'R3.a']);
  b.label('VA', 260, -40, 'R1.b');
  return {
    id: 'kvl-kcl',
    topic: 'dc',
    title: 'Kirchhoff Yasaları (KVL ve KCL)',
    subtitle: 'Seri–paralel devrede akım ve gerilim dağılımı',
    level: 'Temel',
    mood: 'info',
    xp: 70,
    keywords: ['kirchhoff', 'akım bölücü', 'seri paralel', 'kcl', 'kvl'],
    doc: b.doc('Kirchhoff Yasaları'),
    steps: [
      run('**▶ Başlat**. **Değer Okuma** açıkken her direncin akımı üzerinde yazar; DMM1 toplam akımı ölçer.'),
      { id: 'q1', title: 'Toplam akım', text: 'Önce eşdeğer direnci bul.', check: quiz('Kaynaktan çekilen toplam akım yaklaşık kaçtır?', ['5,45 mA', '12 mA', '2 mA', '4 mA'], 'R2‖R3 = 2k·3k/5k = 1,2 kΩ → R_eş = 2,2 kΩ → I = 12/2,2k ≈ 5,45 mA.'), xp: 15 },
      { id: 'q2', title: 'Akım bölücü (KCL)', text: 'VA düğümünde akım ikiye ayrılır.', check: quiz('R2’den geçen akım yaklaşık kaçtır?', ['3,27 mA', '2,18 mA', '5,45 mA', '6 mA'], 'I2 = I·R3/(R2+R3) = 5,45·3/5 ≈ 3,27 mA; I3 ≈ 2,18 mA. Toplamları KCL gereği 5,45 mA.'), xp: 15 },
      { id: 'q3', title: 'KVL', text: 'Kapalı çevrede gerilimlerin toplamı sıfırdır.', check: quiz('VA yaklaşık kaç volttur?', ['6,55 V', '5,45 V', '12 V', '4 V'], 'V_R1 = 5,45 mA·1 kΩ = 5,45 V → VA = 12 − 5,45 ≈ 6,55 V. KVL: 12 = V_R1 + VA.'), xp: 15 },
    ],
    theory: 'KCL: bir düğüme giren akımların toplamı çıkanlara eşittir (yük korunumu). KVL: kapalı bir çevre boyunca gerilim düşümlerinin toplamı sıfırdır (enerji korunumu). Paralel kollarda akım, dirençlerle ters orantılı bölünür: I2 = I·R3/(R2+R3).',
  };
})();

const thevenin: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 100, 140, 0, { V: 10 }).gnd('V1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['V1.p', 'R1.a']);
  b.add('resistor', 'R2', 320, 100, 90, { R: 1000 }).gnd('R2.b', 340, 180).w(['R1.b', 'R2.a']);
  b.add('switch', 'S1', 380, 60, 0, { closed: false }).w(['R1.b', 'S1.a']);
  b.add('resistor', 'RL', 480, 100, 90, { R: 1000 }).gnd('RL.b', 500, 180).w(['S1.b', 'RL.a']);
  b.add('multimeter', 'DMM1', 580, 40, 0, { mode: 'DCV' }).w(['DMM1.pos', 'RL.a']).gnd('DMM1.com', 660, 140);
  b.label('VAB', 260, -40, 'R1.b');
  return {
    id: 'thevenin',
    topic: 'dc',
    title: 'Thevenin Eşdeğeri ve Maksimum Güç Aktarımı',
    subtitle: 'Açık devre gerilimi, eşdeğer direnç ve R_L = R_TH koşulu',
    level: 'Temel',
    mood: 'point',
    xp: 80,
    keywords: ['thevenin', 'norton', 'maksimum güç', 'eşdeğer'],
    doc: b.doc('Thevenin Eşdeğeri'),
    steps: [
      run('**▶ Başlat**. S1 açık: A–B uçları boşta.'),
      { id: 'q1', title: 'V_TH', text: 'Açık devre gerilimi = Thevenin gerilimi.', check: quiz('V_TH kaç volttur?', ['5 V', '10 V', '3,33 V', '2,5 V'], 'Uçlar boşta: V_TH = 10·1k/2k = 5 V.'), xp: 15 },
      { id: 'q2', title: 'R_TH', text: 'Gerilim kaynağını kısa devre say, uçlardan bakan direnç.', check: quiz('R_TH kaç ohm’dur?', ['500 Ω', '1 kΩ', '2 kΩ', '250 Ω'], 'Kaynak kısa devre: R1‖R2 = 500 Ω.'), xp: 15 },
      { id: 's1', title: 'Yükü bağla', text: '**S1**’i kapat. RL = 1 kΩ iken VOUT = 3,33 V, P = 11,1 mW.', check: { kind: 'switch', comp: 'S1', closed: true } },
      { id: 's2', title: 'Maksimum güç', text: '**RL**’yi **R_TH** değerine (500 Ω) ayarla.', check: { kind: 'param', comp: 'RL', param: 'R', op: '==', value: 500 }, success: 'VOUT = 2,5 V, P = V²/R = 12,5 mW — bu devrenin verebileceği en büyük güç!' },
      { id: 'q3', title: 'Verim', text: 'Maksimum güçte verim nedir?', check: quiz('R_L = R_TH iken kaynağın verdiği gücün yüzde kaçı yüke gider?', ['%50', '%100', '%25', '%75'], 'Yarısı R_TH üzerinde harcanır. Bu yüzden enerji iletiminde değil, sinyal uyumlamada (anten, ses) tercih edilir.'), xp: 15 },
    ],
    theory: 'Doğrusal her iki uçlu devre, bir V_TH gerilim kaynağı ve seri R_TH direncine indirgenebilir. V_TH açık devre gerilimidir; R_TH bağımsız kaynaklar söndürülerek bulunur. Yüke aktarılan güç P = V_TH²·R_L/(R_TH+R_L)² olup R_L = R_TH’de maksimum (V_TH²/4R_TH) olur.',
  };
})();

const superposition: Template = (() => {
  const b = new B();
  b.add('vdc', 'V1', 100, 140, 0, { V: 10 }).gnd('V1.n', 120, 220);
  b.add('resistor', 'R1', 180, 60, 0, { R: 1000 }).w(['V1.p', 'R1.a']);
  b.add('resistor', 'R3', 240, 100, 90, { R: 1000 }).gnd('R3.b', 260, 180).w(['R1.b', 'R3.a']);
  b.add('resistor', 'R2', 300, 60, 0, { R: 1000 }).w(['R1.b', 'R2.a']);
  b.add('vdc', 'V2', 420, 140, 0, { V: 5 }).gnd('V2.n', 440, 220).w(['R2.b', 'V2.p']);
  b.label('VM', 260, -40, 'R1.b');
  return {
    id: 'superposition',
    topic: 'dc',
    title: 'Süperpozisyon İlkesi',
    subtitle: 'İki kaynağın etkisini ayrı ayrı bulup topla',
    level: 'Temel',
    mood: 'info',
    xp: 70,
    keywords: ['süperpozisyon', 'superposition', 'iki kaynak'],
    doc: b.doc('Süperpozisyon'),
    steps: [
      run('**▶ Başlat**. VM düğümüne bak (Değer Okuma veya VM etiketinin üstüne gel).'),
      { id: 'q1', title: 'İki kaynak birlikte', text: 'Düğüm denklemi: (VM−10)/1k + VM/1k + (VM−5)/1k = 0', check: quiz('VM kaç volttur?', ['5 V', '7,5 V', '3,33 V', '15 V'], '3·VM = 15 → VM = 5 V.'), xp: 15 },
      { id: 's1', title: 'V2’yi söndür', text: '**V2**’yi **0 V** yap (gerilim kaynağını söndürmek = kısa devre).', check: { kind: 'param', comp: 'V2', param: 'V', op: '==', value: 0 }, success: 'Sadece V1’in katkısı: VM = 10·(1k‖1k)/(1k + 1k‖1k) = 3,33 V.' },
      { id: 'q2', title: 'Diğer katkı', text: 'Şimdi V1 = 0, V2 = 5 V olsaydı?', check: quiz('Yalnızca V2 = 5 V varken VM ne olurdu?', ['1,67 V', '5 V', '2,5 V', '0 V'], 'Simetri gereği 5·(1/3) = 1,67 V. Toplam: 3,33 + 1,67 = 5 V — süperpozisyon doğrulandı!'), xp: 15 },
    ],
    theory: 'Doğrusal bir devrede birden çok bağımsız kaynağın oluşturduğu yanıt, her kaynağın tek başına (diğerleri söndürülmüşken) oluşturduğu yanıtların toplamıdır. Söndürme: gerilim kaynağı → kısa devre, akım kaynağı → açık devre. Güç doğrusal olmadığından süperpozisyonla toplanamaz.',
  };
})();

const dependent: Template = (() => {
  const b = new B();
  b.add('vdc', 'VS', 100, 140, 0, { V: 1 }).gnd('VS.n', 120, 220);
  b.add('resistor', 'RS', 180, 60, 0, { R: 1000 }).w(['VS.p', 'RS.a']);
  b.add('resistor', 'RIN', 320, 100, 90, { R: 10e3 }).gnd('RIN.b', 340, 180).w(['RS.b', 'RIN.a']);
  b.add('vcvs', 'E1', 420, 60, 0, { gain: 50 }).w(['RIN.a', 'E1.cp']).gnd('E1.cn', 420, 120).gnd('E1.on', 480, 140);
  b.add('resistor', 'RO', 520, 40, 0, { R: 100 }).w(['E1.op', 'RO.a']);
  b.add('resistor', 'RL', 620, 80, 90, { R: 1000 }).gnd('RL.b', 640, 160).w(['RO.b', 'RL.a']);
  b.label('VIN', 340, -20, 'RIN.a').label('VOUT', 640, -20, 'RL.a');
  return {
    id: 'dependent-source',
    topic: 'dc',
    title: 'Bağımlı Kaynak: Yükselteç Modeli',
    subtitle: 'Giriş direnci, gerilim kontrollü kaynak ve çıkış direnci',
    level: 'Orta',
    mood: 'point',
    xp: 80,
    keywords: ['bağımlı kaynak', 'vcvs', 'yükselteç modeli', 'giriş direnci', 'çıkış direnci'],
    doc: b.doc('Bağımlı Kaynak'),
    steps: [
      run('**▶ Başlat**. E1, girişindeki gerilimin μ = 50 katını üretir.'),
      { id: 'q1', title: 'Girişte kayıp', text: 'RS ve RIN bir gerilim bölücüdür.', check: quiz('VIN kaç volttur?', ['0,909 V', '1 V', '0,5 V', '0,1 V'], 'VIN = 1·10k/11k ≈ 0,909 V.'), xp: 15 },
      { id: 'q2', title: 'Toplam kazanç', text: 'Çıkışta RO ve RL de bir bölücü oluşturur.', check: quiz('VOUT yaklaşık kaç volttur?', ['41,3 V', '50 V', '45,5 V', '25 V'], 'VOUT = 50·0,909·1k/1,1k ≈ 41,3 V. İyi bir gerilim yükselteci için R_IN ≫ R_S ve R_O ≪ R_L olmalı.'), xp: 15 },
      { id: 's1', title: 'Ağır yük', text: '**RL**’yi **100 Ω** yap ve VOUT’a bak.', check: { kind: 'param', comp: 'RL', param: 'R', op: '<=', value: 100 }, success: 'VOUT ≈ 22,7 V’a düştü: çıkış direnci yükle bölüşüyor.' },
    ],
    theory: 'Bağımlı (kontrollü) kaynaklar transistör ve op-amp’ların küçük işaret modellerinin yapı taşıdır. VCVS: V = μ·Vx. Bir yükselteç girişte R_IN, çıkışta R_O ve μ ile modellenir: Av,toplam = μ·R_IN/(R_S+R_IN)·R_L/(R_O+R_L).',
  };
})();

export const DC_TEMPLATES: Template[] = [divider, kvl, thevenin, superposition, dependent];
