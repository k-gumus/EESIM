import { describe, expect, it } from 'vitest';
import { parseSSE } from './providers';

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
