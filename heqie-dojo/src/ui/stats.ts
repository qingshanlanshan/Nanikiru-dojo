import { load, save } from './storage';

// All progress lives in this browser only (localStorage). Nothing is sent anywhere.

export interface Mistake {
  /** Hand in mpsz notation. */
  h: string;
  /** Player's discard and one best discard (tile indices). */
  a: number;
  b: number;
  /** Timestamp (ms). */
  t: number;
}

export interface DailyRecord {
  h: string;
  a: number;
  ok: boolean;
}

export interface Stats {
  levels: Record<string, { n: number; c: number }>;
  mistakes: Mistake[];
  daily: Record<string, DailyRecord>;
}

const KEY = 'stats';
const MAX_MISTAKES = 50;

export function getStats(): Stats {
  const s = load<Partial<Stats>>(KEY, {});
  return {
    levels: s.levels && typeof s.levels === 'object' ? s.levels : {},
    mistakes: Array.isArray(s.mistakes) ? s.mistakes : [],
    daily: s.daily && typeof s.daily === 'object' ? s.daily : {},
  };
}

function addMistake(s: Stats, m: Mistake) {
  s.mistakes = [m, ...s.mistakes.filter((x) => x.h !== m.h)].slice(0, MAX_MISTAKES);
}

export function recordPractice(level: number, hand: string, answer: number, best: number, ok: boolean) {
  const s = getStats();
  const lv = (s.levels[level] ??= { n: 0, c: 0 });
  lv.n++;
  if (ok) lv.c++;
  if (!ok) addMistake(s, { h: hand, a: answer, b: best, t: Date.now() });
  save(KEY, s);
}

export function recordDaily(date: string, hand: string, answer: number, best: number, ok: boolean) {
  const s = getStats();
  if (s.daily[date]) return;
  s.daily[date] = { h: hand, a: answer, ok };
  if (!ok) addMistake(s, { h: hand, a: answer, b: best, t: Date.now() });
  save(KEY, s);
}

export function clearStats() {
  save(KEY, { levels: {}, mistakes: [], daily: {} });
}

/** Consecutive days with a daily answer, counting back from today (or yesterday if today isn't done yet). */
export function dailyStreak(s: Stats, today: string): number {
  let d = s.daily[today] ? today : shiftDate(today, -1);
  let n = 0;
  while (s.daily[d]) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

export function shiftDate(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
