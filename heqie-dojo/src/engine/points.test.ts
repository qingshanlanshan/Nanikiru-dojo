import { describe, expect, it } from 'vitest';
import { generateScoreCase, isPossible, payment, type ScoreCase } from './points';
import { mulberry32 } from './rng';

const c = (han: number, fu: number, dealer = false, tsumo = false): ScoreCase => ({ han, fu, dealer, tsumo });

describe('payment: standard table', () => {
  it.each([
    // han, fu, dealer, ron
    [1, 30, false, 1000],
    [1, 30, true, 1500],
    [2, 25, false, 1600],
    [3, 40, false, 5200],
    [3, 40, true, 7700],
    [4, 30, false, 7700], // no 切上满贯
    [4, 30, true, 11600],
    [3, 70, false, 8000], // 2240 > 2000 -> 满贯
    [1, 110, false, 3600],
    [2, 110, false, 7100],
    [5, 0, false, 8000],
    [6, 0, false, 12000],
    [8, 0, false, 16000],
    [11, 0, false, 24000],
    [13, 0, false, 32000],
    [13, 0, true, 48000],
  ])('%i番%i符 dealer=%s ron = %i', (han, fu, dealer, ron) => {
    expect(payment(c(han, fu, dealer)).ron).toBe(ron);
  });

  it('tsumo splits', () => {
    expect(payment(c(1, 30, false, true))).toMatchObject({ ko: 300, oya: 500, total: 1100 });
    expect(payment(c(1, 30, true, true))).toMatchObject({ all: 500, total: 1500 });
    expect(payment(c(2, 20, false, true))).toMatchObject({ ko: 400, oya: 700 });
    expect(payment(c(2, 20, true, true))).toMatchObject({ all: 700 });
    expect(payment(c(3, 40, false, true))).toMatchObject({ ko: 1300, oya: 2600 });
    expect(payment(c(4, 30, false, true))).toMatchObject({ ko: 2000, oya: 3900 });
    expect(payment(c(5, 0, false, true))).toMatchObject({ ko: 2000, oya: 4000, total: 8000 });
    expect(payment(c(5, 0, true, true))).toMatchObject({ all: 4000, total: 12000 });
  });
});

describe('isPossible / generator', () => {
  it('rules out impossible combinations', () => {
    expect(isPossible(c(1, 20, false, true))).toBe(false); // 平和自摸 is already 2番
    expect(isPossible(c(2, 20, false, false))).toBe(false); // 20符 ron can't happen
    expect(isPossible(c(2, 25, false, true))).toBe(false); // 七对子自摸 is 3番
    expect(isPossible(c(2, 25, false, false))).toBe(true);
  });

  it('only generates possible cases, with some limit hands', () => {
    const rng = mulberry32(8);
    let limits = 0;
    for (let i = 0; i < 1000; i++) {
      const s = generateScoreCase(rng);
      expect(isPossible(s)).toBe(true);
      if (s.han >= 5) limits++;
    }
    expect(limits).toBeGreaterThan(150);
    expect(limits).toBeLessThan(350);
  });
});
