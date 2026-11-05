import { describe, expect, it } from 'vitest';
import { parseSSE, stripThink } from './providers';

describe('Tepecan Bulut SSE ayrıştırıcı', () => {
  it('parçalı gelen satırları birleştirir, [DONE] ve boş satırları atlar', () => {
    const buf = { rest: '' };
    const out: string[] = [];
    for (const c of ['data: {"respo', 'nse":"Mer"}\n\ndata: {"response":"haba"}\n', '\ndata: [DONE]\n\n']) out.push(...parseSSE(buf, c));
    expect(out.join('')).toBe('Merhaba');
  });
  it('OpenAI biçimini de anlar', () => {
    const out = [...parseSSE({ rest: '' }, 'data: {"choices":[{"delta":{"content":"Selam"}}]}\n')];
    expect(out).toEqual(['Selam']);
  });
});

describe('Yeni nesil model çıktısı', () => {
  it('düşünme (reasoning) parçalarını göstermez, yalnızca cevabı akıtır', () => {
    const lines =
      'data: {"choices":[{"delta":{"reasoning_content":"Önce düşüneyim"}}]}\n' +
      'data: {"choices":[{"delta":{"content":null}}]}\n' +
      'data: {"choices":[{"delta":{"content":"Diyot"}}]}\n' +
      'data: {"choices":[{"delta":{"content":" iletir."}}],"usage":{"total_tokens":12}}\n' +
      'data: [DONE]\n';
    expect([...parseSSE({ rest: '' }, lines)].join('')).toBe('Diyot iletir.');
  });
  it('<think> bloklarını ayıklar (akış sürerken kapanmamış blok da gizlenir)', () => {
    expect(stripThink('<think>hmm\nşöyle</think>\n\nCevap: 0,7 V')).toBe('Cevap: 0,7 V');
    expect(stripThink('<think>daha düşünüyor')).toBe('');
    expect(stripThink('Normal cevap')).toBe('Normal cevap');
  });
});
