// Deney kataloğu: etkileşimli şablonlar + listede yer alan (yakında eklenecek) deneyler
import { TEMPLATES, type Template } from './index';
import { TOPICS, type TopicId } from './topics';
import { PLANNED } from './planned';

export interface CatalogEntry {
  id: string;
  title: string;
  subtitle: string;
  topic: TopicId;
  level: Template['level'];
  keywords: string[];
  template?: Template;
}

export const CATALOG: CatalogEntry[] = [
  ...TEMPLATES.map((t) => ({ id: t.id, title: t.title, subtitle: t.subtitle, topic: t.topic, level: t.level, keywords: t.keywords ?? [], template: t })),
  ...PLANNED.filter((p) => !TEMPLATES.some((t) => t.id === p.id)),
];

/** Türkçe karakterleri sadeleştirerek arama için normalleştir */
export const norm = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function searchCatalog(q: string, limit = 12): CatalogEntry[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = CATALOG.map((e) => {
    const topic = TOPICS.find((t) => t.id === e.topic)?.title ?? '';
    const hayTitle = norm(e.title);
    const hay = norm([e.title, e.subtitle, topic, ...e.keywords].join(' '));
    let score = 0;
    for (const w of words) {
      if (hayTitle.startsWith(w)) score += 6;
      else if (hayTitle.includes(w)) score += 4;
      else if (hay.includes(w)) score += 1;
      else return { e, score: -1 };
    }
    if (e.template) score += 0.5;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}

export const entriesOfTopic = (topic: TopicId) => CATALOG.filter((e) => e.topic === topic);
