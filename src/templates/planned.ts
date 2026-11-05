// Katalogda listelenen, etkileşimli sürümü henüz hazırlanmamış deneyler.
// Bir mühendislik öğrencisinin lisans boyunca ve sahada karşılaştığı devreler; konu başlığına göre.
import type { CatalogEntry } from './catalog';
import type { TopicId } from './topics';

type P = [id: string, title: string, subtitle: string, level: CatalogEntry['level'], keywords: string];

const G: Record<TopicId, P[]> = {
  dc: [
    ['norton', 'Norton Eşdeğeri ve Kaynak Dönüşümü', 'Akım kaynağı ∥ direnç ↔ gerilim kaynağı + seri direnç', 'Temel', 'norton kaynak dönüşümü eşdeğer'],
    ['nodal-mesh', 'Düğüm Gerilimleri ve Çevre Akımları Yöntemi', 'Çok kaynaklı devreyi sistematik çöz, simülasyonla doğrula', 'Orta', 'düğüm çevre nodal mesh analiz'],
    ['wye-delta', 'Yıldız–Üçgen (Y–Δ) Dönüşümü', 'Köprü devrelerinde eşdeğer direnç', 'Orta', 'yıldız üçgen y delta dönüşüm'],
    ['meter-loading', 'Ölçü Aletinin Devreyi Yüklemesi', 'Voltmetrenin iç direnci ölçümü nasıl bozar?', 'Temel', 'voltmetre iç direnç yükleme ölçüm hatası'],
  ],
  transient: [
    ['rl-transient', 'RL Devresinde Akımın Yükselişi', 'τ = L/R ve bobinin akım değişimine direnci', 'Temel', 'rl bobin zaman sabiti geçici'],
    ['inductive-kick', 'Bobin Geri Tepmesi ve Serbest Geçiş Diyodu', 'Röle bobinini kesince oluşan yüksek gerilim', 'Orta', 'flyback geri tepme röle diyot bobin'],
    ['rlc-parallel', 'Paralel RLC Basamak Yanıtı', 'Aşırı, kritik ve az sönümlü durumlar', 'Orta', 'paralel rlc sönüm'],
  ],
  ac: [
    ['parallel-resonance', 'Paralel Rezonans (Tank Devresi)', 'Rezonansta empedans en büyük', 'Orta', 'paralel rezonans tank lc'],
    ['power-factor', 'Güç Faktörü ve Düzeltilmesi', 'Endüktif yüke kondansatör ekleyerek cos φ’yi yükselt', 'Orta', 'güç faktörü cos phi reaktif güç kompanzasyon'],
    ['three-phase', 'Üç Fazlı Sistemler: Yıldız ve Üçgen', 'Faz ve hat gerilimleri, √3 ilişkisi', 'İleri', 'üç faz trifaze yıldız üçgen'],
    ['max-power-ac', 'AC’de Maksimum Güç Aktarımı', 'Eşlenik empedans uyumu', 'İleri', 'empedans uyumu eşlenik maksimum güç'],
    ['phasor', 'Fazörler ile AC Devre Çözümü', 'Gerilim ve akımın genlik–faz gösterimi', 'Temel', 'fazör karmaşık sayı empedans'],
  ],
  filters: [
    ['notch', 'Çentik (Notch) Filtre — Twin-T', '50 Hz şebeke gürültüsünü bastır', 'İleri', 'çentik notch twin-t 50 hz'],
    ['band-pass', 'RLC Bant Geçiren Filtre', 'Merkez frekans ve bant genişliği', 'Orta', 'bant geçiren band pass'],
    ['active-hpf', 'Aktif Yüksek Geçiren Filtre', 'Op-amp ile kazançlı HPF', 'Orta', 'aktif yüksek geçiren op-amp filtre'],
    ['bode', 'Bode Diyagramı Çıkarma', 'Frekans taraması ile genlik/faz eğrisi', 'Orta', 'bode frekans yanıtı dB'],
    ['rc-ladder', 'Çok Kademeli RC Filtre', 'Kademe sayısı ve eğim (dB/dekad)', 'Orta', 'ikinci derece kademe eğim'],
  ],
  diode: [
    ['reverse-polarity', 'Ters Polarite Koruması', 'Seri diyot ve P-MOSFET ile', 'Temel', 'ters polarite koruma'],
    ['schottky-vs-si', 'Schottky ve Silisyum Diyot Karşılaştırması', 'İletim düşümü, verim ve ters akım', 'Temel', 'schottky silisyum düşüm'],
    ['peak-detector', 'Tepe Dedektörü', 'AM demodülasyonunun temeli', 'Orta', 'tepe dedektörü zarf demodülasyon'],
    ['led-series-parallel', 'LED’leri Seri ve Paralel Bağlama', 'Neden her LED’e ayrı direnç?', 'Isınma', 'led seri paralel akım paylaşımı'],
    ['diode-logic', 'Diyot Mantığı (DL) ile VE/VEYA', 'Transistörsüz kapılar', 'Temel', 'diyot mantığı and or'],
  ],
  bjt: [
    ['emitter-follower', 'Emetör İzleyici (Ortak Kolektör)', 'Gerilim kazancı ≈ 1, akım kazancı β', 'Temel', 'emetör izleyici ortak kolektör buffer'],
    ['darlington', 'Darlington Çifti', 'β₁·β₂ ile büyük akımları sür', 'Orta', 'darlington yüksek kazanç'],
    ['diff-pair', 'Diferansiyel Çift', 'Op-amp’ın giriş katı', 'İleri', 'diferansiyel çift fark kuvvetlendirici'],
    ['ic-vce', 'BJT Çıkış Karakteristiği (I_C–V_CE)', 'Aktif, doyum ve kesim bölgeleri', 'Orta', 'karakteristik eğri ic vce'],
    ['push-pull', 'B Sınıfı Push-Pull Çıkış Katı', 'Geçiş (crossover) bozulması ve giderilmesi', 'İleri', 'push pull b sınıfı crossover güç kuvvetlendirici'],
    ['relay-driver', 'Transistörle Röle Sürme', 'Mikrodenetleyiciden 220 V yükü kontrol et', 'Temel', 'röle sürme transistör'],
  ],
  mosfet: [
    ['common-source', 'Ortak Kaynaklı MOSFET Kuvvetlendirici', 'g_m ve kazanç', 'İleri', 'ortak kaynak cs mosfet kuvvetlendirici'],
    ['id-vgs', 'MOSFET Transfer Karakteristiği (I_D–V_GS)', 'Eşik gerilimi ve kare yasası', 'Orta', 'id vgs eşik transfer karakteristiği'],
    ['h-bridge', 'H-Köprüsü ile DC Motor Yön Kontrolü', 'Dört anahtar, iki yön', 'İleri', 'h köprüsü motor sürücü yön'],
    ['load-switch', 'P-MOSFET Yük Anahtarı', 'Yüksek taraf anahtarlama', 'Temel', 'yük anahtarı high side'],
    ['cmos-nand', 'CMOS NAND Kapısı', 'Transistör seviyesinde mantık', 'Orta', 'cmos nand transistör seviyesi'],
  ],
  opamp: [
    ['difference-amp', 'Fark Kuvvetlendiricisi', 'İki girişin farkını yükselt', 'Orta', 'fark kuvvetlendirici differential'],
    ['differentiator', 'Op-amp Türev Alıcı', 'Üçgenden kare dalga', 'Orta', 'türev alıcı differentiator'],
    ['precision-rectifier', 'Hassas Doğrultucu (Süper Diyot)', 'Milivolt seviyesindeki sinyalleri doğrult', 'İleri', 'hassas doğrultucu süper diyot'],
    ['instrumentation-amp', 'Enstrümantasyon Kuvvetlendiricisi', 'Üç op-amp ile yüksek CMRR', 'İleri', 'enstrümantasyon ina cmrr'],
    ['transimpedance', 'Transempedans Kuvvetlendirici', 'Fotodiyot akımını gerilime çevir', 'İleri', 'transempedans fotodiyot tia'],
    ['comparator-window', 'Pencere Karşılaştırıcı', 'Gerilim belirli aralıkta mı?', 'Orta', 'pencere karşılaştırıcı window'],
  ],
  osc: [
    ['wien', 'Wien Köprüsü Osilatörü', 'Saf sinüs üretimi ve genlik kararlılığı', 'İleri', 'wien köprüsü sinüs osilatör'],
    ['rc-phase-shift', 'RC Faz Kaydırmalı Osilatör', 'Üç RC katı, 180° faz', 'İleri', 'faz kaydırmalı osilatör'],
    ['colpitts', 'Colpitts LC Osilatörü', 'Radyo frekansında sinüs', 'İleri', 'colpitts lc osilatör rf'],
    ['555-pwm', '555 ile PWM Üreteci', 'Ayarlanabilir doluluk oranı', 'Orta', '555 pwm doluluk'],
    ['vco', 'Gerilim Kontrollü Osilatör (VCO)', 'Gerilimle frekans ayarı', 'İleri', 'vco gerilim kontrollü osilatör'],
  ],
  power: [
    ['zener-follower', 'Zener + Emetör İzleyici Regülatör', 'Ayrık elemanlarla doğrusal regülatör', 'Orta', 'zener emetör izleyici regülatör seri geçiş'],
    ['buck-boost', 'Buck-Boost Dönüştürücü', 'Ters polariteli, düşür/yükselt', 'İleri', 'buck boost inverting'],
    ['battery-charger', 'Akım Sınırlamalı Akü Şarj Devresi', 'Sabit akım / sabit gerilim', 'İleri', 'akü şarj cc cv'],
    ['solar-mppt', 'Güneş Paneli ve MPPT', 'Maksimum güç noktasını izleme', 'İleri', 'güneş paneli mppt fotovoltaik'],
    ['lm317', 'LM317 Ayarlı Regülatör', 'İki dirençle çıkış gerilimi', 'Temel', 'lm317 ayarlı regülatör'],
    ['current-limit', 'Transistörlü Akım Sınırlama', 'Kısa devreye karşı koruma', 'Orta', 'akım sınırlama koruma'],
  ],
  digital: [
    ['full-adder', 'Tam Toplayıcı ve 4 Bitlik Toplama', 'Eldeli toplama zinciri', 'Orta', 'tam toplayıcı full adder 4 bit'],
    ['mux', 'Çoklayıcı (MUX) ve Kod Çözücü', 'Veri seçme ve adresleme', 'Orta', 'çoklayıcı multiplexer decoder kod çözücü'],
    ['shift-register', 'Kaydırmalı Yazmaç (Shift Register)', 'Seri–paralel dönüşüm, LED yürüyen ışık', 'Orta', 'kaydırmalı yazmaç shift register'],
    ['debounce', 'Buton Arkı (Debounce) Giderme', 'RC + Schmitt ile temiz dijital sinyal', 'Orta', 'debounce ark sıçrama buton'],
    ['jk-counter', 'JK Flip-Flop ile Senkron Sayıcı', 'Durum diyagramından devreye', 'İleri', 'jk senkron sayıcı durum makinesi'],
    ['seven-seg', '7 Segment Gösterge Sürme', 'BCD’den 7 segmente kod çözme', 'Orta', '7 segment bcd gösterge'],
  ],
  measure: [
    ['meter-internal', 'Ampermetre ve Voltmetre İç Direnci', 'Doğru ölçüm için bağlantı yöntemleri', 'Temel', 'ampermetre voltmetre iç direnç'],
    ['strain-gauge', 'Gerinim Ölçer (Strain Gauge) Köprüsü', 'Ağırlık ve kuvvet ölçümü', 'İleri', 'gerinim ölçer strain gauge yük hücresi'],
    ['thermocouple', 'Termokupl Sinyal Koşullandırma', 'µV seviyesinden okunabilir sinyale', 'İleri', 'termokupl soğuk uç kompanzasyon'],
    ['adc-basics', 'ADC Temelleri: Örnekleme ve Kuantalama', 'Çözünürlük, Nyquist ve örtüşme', 'Orta', 'adc örnekleme nyquist kuantalama'],
    ['dac-r2r', 'R-2R Merdiven DAC', 'Dirençlerle sayısaldan analoğa', 'Orta', 'dac r-2r merdiven'],
  ],
};

export const PLANNED: CatalogEntry[] = (Object.keys(G) as TopicId[]).flatMap((topic) =>
  G[topic].map(([id, title, subtitle, level, kw]) => ({ id, title, subtitle, topic, level, keywords: kw.split(' ') })),
);
