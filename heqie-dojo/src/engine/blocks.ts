import { isHonor, type Counts } from './tiles';

// Splits a hand into the blocks a player would see (sets, taatsu, pair, loose tiles).
// Same search space as the shanten decomposition, but it keeps the actual blocks and
// breaks ties by shape quality so the view matches how people read hands.

export type BlockKind = 'shuntsu' | 'koutsu' | 'head' | 'pair' | 'ryanmen' | 'kanchan' | 'penchan' | 'single';

export interface Block {
  kind: BlockKind;
  tiles: number[];
}

export interface Decomposition {
  blocks: Block[];
  mentsu: number;
  /** Taatsu including non-head pairs (can exceed what the hand can use). */
  taatsu: number;
  head: boolean;
}

const TAATSU_KINDS: BlockKind[] = ['pair', 'ryanmen', 'kanchan', 'penchan'];
const QUALITY: Partial<Record<BlockKind, number>> = { ryanmen: 3, pair: 2, kanchan: 1, penchan: 0.9 };

interface Entry {
  m: number;
  t: number;
  h: number;
  q: number;
  blocks: Block[];
}

type EntryMap = Map<string, Entry>;

const keyOf = (m: number, t: number, h: number) => `${m},${t},${h}`;

function put(map: EntryMap, e: Entry) {
  const k = keyOf(e.m, e.t, e.h);
  const cur = map.get(k);
  if (!cur || e.q > cur.q) map.set(k, e);
}

function suitEntries(c: number[], base: number, honor: boolean): EntryMap {
  const out: EntryMap = new Map();
  const rec = (m: number, t: number, h: number, q: number, blocks: Block[]) => {
    const i = c.findIndex((n) => n > 0);
    if (i < 0) return put(out, { m, t, h, q, blocks: blocks.slice() });
    const at = (...offs: number[]) => offs.map((o) => base + i + o);
    const take = (offs: number[], kind: BlockKind, dm: number, dt: number, dh: number) => {
      for (const o of offs) c[i + o]--;
      blocks.push({ kind, tiles: at(...offs) });
      rec(m + dm, t + dt, h + dh, q + (QUALITY[kind] ?? 0), blocks);
      blocks.pop();
      for (const o of offs) c[i + o]++;
    };
    take([0], 'single', 0, 0, 0);
    if (c[i] >= 3) take([0, 0, 0], 'koutsu', 1, 0, 0);
    if (c[i] >= 2) {
      take([0, 0], 'pair', 0, 1, 0);
      if (h === 0) take([0, 0], 'head', 0, 0, 1);
    }
    if (!honor) {
      const n1 = i <= 7 && c[i + 1] > 0;
      const n2 = i <= 6 && c[i + 2] > 0;
      if (n1 && n2) take([0, 1, 2], 'shuntsu', 1, 0, 0);
      if (n1) take([0, 1], i === 0 || i === 7 ? 'penchan' : 'ryanmen', 0, 1, 0);
      if (n2) take([0, 2], 'kanchan', 0, 1, 0);
    }
  };
  rec(0, 0, 0, 0, []);
  return out;
}

function combine(a: EntryMap, b: EntryMap): EntryMap {
  const out: EntryMap = new Map();
  for (const x of a.values()) {
    for (const y of b.values()) {
      if (x.h + y.h > 1) continue;
      put(out, { m: x.m + y.m, t: x.t + y.t, h: x.h + y.h, q: x.q + y.q, blocks: [...x.blocks, ...y.blocks] });
    }
  }
  return out;
}

const value = (e: Entry) => 2 * e.m + Math.min(e.t, 4 - e.m) + e.h;

export function decompose(hand: Counts): Decomposition {
  let acc = suitEntries(hand.slice(0, 9), 0, false);
  acc = combine(acc, suitEntries(hand.slice(9, 18), 9, false));
  acc = combine(acc, suitEntries(hand.slice(18, 27), 18, false));
  acc = combine(acc, suitEntries(hand.slice(27, 34), 27, true));
  let best: Entry | null = null;
  for (const e of acc.values()) {
    if (
      !best ||
      value(e) > value(best) ||
      (value(e) === value(best) && (e.h > best.h || (e.h === best.h && (e.q > best.q || (e.q === best.q && e.t > best.t)))))
    )
      best = e;
  }
  const b = best!;
  const blocks = b.blocks.slice().sort((x, y) => x.tiles[0] - y.tiles[0]);
  return { blocks, mentsu: b.m, taatsu: b.t, head: b.h === 1 };
}

export function isTaatsu(b: Block): boolean {
  return TAATSU_KINDS.includes(b.kind);
}

/** Tiles that turn this taatsu into a set (the block on its own, ignoring the rest). */
export function taatsuWaits(b: Block): number[] {
  const [a, c] = b.tiles;
  switch (b.kind) {
    case 'pair':
      return [a];
    case 'kanchan':
      return [a + 1];
    case 'penchan':
      return a % 9 === 0 ? [a + 2] : [a - 1];
    case 'ryanmen':
      return [a - 1, c + 1];
    default:
      return [];
  }
}

/** Tile types that would form a pair or taatsu with a loose tile. */
export function connections(t: number): number {
  if (isHonor(t)) return 1;
  const r = t % 9;
  let n = 0;
  for (let d = -2; d <= 2; d++) if (r + d >= 0 && r + d <= 8) n++;
  return n;
}
