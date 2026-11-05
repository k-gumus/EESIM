import { describe, expect, it } from 'vitest';
import { mergeProgress } from './sync';

describe('ilerleme birleştirme', () => {
  it('XP en büyüğü, adımlar birleşim, tamamlananlar birleşim', () => {
    const local = { xp: 50, streak: 1, lastDay: '2026-11-05', done: { a: ['run', 'q1'] }, completed: { a: true } };
    const server = { xp: 120, streak: 4, lastDay: '2026-11-04', done: { a: ['q2'], b: ['run'] }, completed: { b: true } };
    const m = mergeProgress(local, server);
    expect(m.xp).toBe(120);
    expect(m.done.a.sort()).toEqual(['q1', 'q2', 'run']);
    expect(m.done.b).toEqual(['run']);
    expect(m.completed).toEqual({ a: true, b: true });
    expect(m.lastDay).toBe('2026-11-05');
    expect(m.streak).toBe(1);
  });
  it('sunucuda kayıt yoksa yereli aynen kullan', () => {
    const local = { xp: 5, streak: 1, lastDay: null, done: {}, completed: {} };
    expect(mergeProgress(local, null)).toBe(local);
  });
});
