import type { Counts } from './tiles';

// Standard-form shanten via per-suit decomposition.
// Each suit is reduced to a Pareto set of (mentsu, taatsu, head) options, memoized by
// the suit's base-5 key; suits are then merged and scored with 8 - 2m - t - h, m + t <= 4.

type Opt = [m: number, t: number, h: number];

const POW5 = [1, 5, 25, 125, 625, 3125, 15625, 78125, 390625];
const memo = [new Map<number, Opt[]>(), new Map<number, Opt[]>()];

function prune(opts: Opt[]): Opt[] {
  const out: Opt[] = [];
  for (const o of opts) {
    if (out.some((p) => p[2] === o[2] && p[0] >= o[0] && p[1] >= o[1])) continue;
    for (let i = out.length - 1; i >= 0; i--) {
      const p = out[i];
      if (p[2] === o[2] && o[0] >= p[0] && o[1] >= p[1]) out.splice(i, 1);
    }
    out.push(o);
  }
  return out;
}

function digit(key: number, i: number): number {
  return Math.floor(key / POW5[i]) % 5;
}

function suitOpts(key: number, honor: boolean): Opt[] {
  if (key === 0) return [[0, 0, 0]];
  const cache = memo[honor ? 1 : 0];
  const hit = cache.get(key);
  if (hit) return hit;

  let i = 0;
  while (digit(key, i) === 0) i++;
  const n = digit(key, i);
  const res: Opt[] = [];
  const add = (rest: number, dm: number, dt: number, dh: number) => {
    for (const [m, t, h] of suitOpts(rest, honor)) {
      if (h + dh <= 1) res.push([m + dm, t + dt, h + dh]);
    }
  };

  add(key - POW5[i], 0, 0, 0); // isolated
  if (n >= 3) add(key - 3 * POW5[i], 1, 0, 0);
  if (n >= 2) {
    add(key - 2 * POW5[i], 0, 1, 0);
    add(key - 2 * POW5[i], 0, 0, 1);
  }
  if (!honor) {
    const n1 = i <= 7 ? digit(key, i + 1) : 0;
    const n2 = i <= 6 ? digit(key, i + 2) : 0;
    if (n1 && n2) add(key - POW5[i] - POW5[i + 1] - POW5[i + 2], 1, 0, 0);
    if (n1) add(key - POW5[i] - POW5[i + 1], 0, 1, 0);
    if (n2) add(key - POW5[i] - POW5[i + 2], 0, 1, 0);
  }

  const out = prune(res);
  cache.set(key, out);
  return out;
}

function merge(a: Opt[], b: Opt[]): Opt[] {
  const res: Opt[] = [];
  for (const x of a) {
    for (const y of b) {
      if (x[2] + y[2] <= 1) res.push([x[0] + y[0], x[1] + y[1], x[2] + y[2]]);
    }
  }
  return prune(res);
}

function suitKey(c: Counts, start: number, len: number): number {
  let k = 0;
  for (let i = 0; i < len; i++) k += c[start + i] * POW5[i];
  return k;
}

export function shantenStandard(c: Counts): number {
  let opts = suitOpts(suitKey(c, 0, 9), false);
  opts = merge(opts, suitOpts(suitKey(c, 9, 9), false));
  opts = merge(opts, suitOpts(suitKey(c, 18, 9), false));
  opts = merge(opts, suitOpts(suitKey(c, 27, 7), true));
  let best = 8;
  for (const [m, t, h] of opts) {
    const s = 8 - 2 * m - Math.min(t, 4 - m) - h;
    if (s < best) best = s;
  }
  return best;
}

export function shantenChiitoi(c: Counts): number {
  let pairs = 0;
  let kinds = 0;
  for (const n of c) {
    if (n > 0) kinds++;
    if (n >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

const YAOCHU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export function shantenKokushi(c: Counts): number {
  let kinds = 0;
  let pair = 0;
  for (const t of YAOCHU) {
    if (c[t] > 0) kinds++;
    if (c[t] >= 2) pair = 1;
  }
  return 13 - kinds - pair;
}

export type Forms = 'standard' | 'all';

/** Shanten of a 13- or 14-tile closed hand. -1 means a complete hand. */
export function shanten(c: Counts, forms: Forms = 'all'): number {
  const s = shantenStandard(c);
  if (forms === 'standard') return s;
  return Math.min(s, shantenChiitoi(c), shantenKokushi(c));
}
