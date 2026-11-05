// Deney kataloğu konu başlıkları (ders kodu yerine konuya göre sınıflandırma)
export type TopicId =
  | 'dc'
  | 'transient'
  | 'ac'
  | 'filters'
  | 'diode'
  | 'bjt'
  | 'mosfet'
  | 'opamp'
  | 'osc'
  | 'power'
  | 'digital'
  | 'measure';

export interface Topic {
  id: TopicId;
  title: string;
  icon: string;
  desc: string;
}

export const TOPICS: Topic[] = [
  { id: 'dc', title: 'DC Devre Analizi', icon: '⚡', desc: 'Ohm, Kirchhoff, Thevenin/Norton, süperpozisyon, köprüler, bağımlı kaynaklar' },
  { id: 'transient', title: 'Geçici Rejim', icon: '⏱', desc: 'RC, RL ve RLC devrelerinin zaman yanıtı, zaman sabiti, sönüm' },
  { id: 'ac', title: 'AC Devreler ve Rezonans', icon: '∿', desc: 'Fazörler, empedans, faz farkı, rezonans, trafo' },
  { id: 'filters', title: 'Filtreler', icon: '≋', desc: 'Pasif ve aktif alçak/yüksek/bant geçiren filtreler' },
  { id: 'diode', title: 'Diyot Devreleri', icon: '▷|', desc: 'Doğrultucular, kırpıcı, kenetleyici, katlayıcı, zener, LED' },
  { id: 'bjt', title: 'BJT Transistörler', icon: 'Q', desc: 'Polarma, anahtarlama, yükselteçler, akım aynası, multivibratör' },
  { id: 'mosfet', title: 'MOSFET ve CMOS', icon: 'M', desc: 'MOSFET anahtar, ortak kaynak yükselteci, CMOS evirici' },
  { id: 'opamp', title: 'İşlemsel Kuvvetlendiriciler', icon: '▷', desc: 'Eviren/evirmeyen, toplayıcı, fark, integral/türev, karşılaştırıcı' },
  { id: 'osc', title: 'Osilatörler ve Zamanlayıcılar', icon: '◷', desc: '555, Wien köprüsü, gevşemeli osilatör, astable multivibratör' },
  { id: 'power', title: 'Güç Kaynakları ve Güç Elektroniği', icon: '🔋', desc: 'Lineer regülatör, buck/boost dönüştürücü, PWM' },
  { id: 'digital', title: 'Dijital Elektronik', icon: '01', desc: 'Mantık kapıları, pull-up/pull-down, flip-flop, sayıcı' },
  { id: 'measure', title: 'Ölçme, Sensörler ve Arayüz', icon: '◎', desc: 'Ölçü aletleri, Wheatstone, LDR/NTC sensör devreleri' },
];

export const topicById = (id: string | null | undefined) => TOPICS.find((t) => t.id === id);
