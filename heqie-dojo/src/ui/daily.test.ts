import { describe, expect, it } from 'vitest';
import { formatHand } from '../engine/tiles';
import { dailyNumber, dailyProblem, DAILY_EPOCH } from './daily';
import { dailyStreak, shiftDate, type Stats } from './stats';

describe('daily', () => {
  it('same date -> same hand; different dates differ', () => {
    const a = formatHand(dailyProblem('2026-10-01').hand);
    expect(formatHand(dailyProblem('2026-10-01').hand)).toBe(a);
    expect(formatHand(dailyProblem('2026-10-02').hand)).not.toBe(a);
  });

  it('numbers days from the epoch', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber(shiftDate(DAILY_EPOCH, 30))).toBe(31);
  });

  it('streak counts back from today, or from yesterday if today is not done', () => {
    const rec = { h: '', a: 0, ok: true };
    const s: Stats = { levels: {}, mistakes: [], daily: { '2026-09-28': rec, '2026-09-29': rec, '2026-09-30': rec, '2026-09-26': rec } };
    expect(dailyStreak(s, '2026-09-30')).toBe(3);
    expect(dailyStreak(s, '2026-10-01')).toBe(3);
    expect(dailyStreak(s, '2026-10-02')).toBe(0);
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
