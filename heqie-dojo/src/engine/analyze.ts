import { shanten, type Forms } from './shanten';
import { NUM_TILES, type Counts } from './tiles';

export interface DiscardResult {
  discard: number;
  /** Shanten of the 13-tile hand after discarding. */
  shanten: number;
  /** Total remaining copies of all accepting tiles. */
  ukeire: number;
  /** Tile types that lower shanten when drawn. */
  waits: number[];
}

export interface Analysis {
  /** Shanten of the 14-tile hand (i.e. after the best discard). */
  shanten: number;
  /** Every distinct discard, best first: lowest shanten, then highest ukeire. */
  discards: DiscardResult[];
  /** Max ukeire among discards that keep the minimum shanten. */
  bestUkeire: number;
}

/**
 * Ukeire of a 13-tile hand. `visible` holds the tiles you can see (usually the 14-tile
 * hand before discarding, so the discarded tile counts as gone), and is used for the
 * remaining-copy count.
 */
export function ukeire(hand13: Counts, visible: Counts, forms: Forms, base = shanten(hand13, forms)) {
  const waits: number[] = [];
  let total = 0;
  for (let t = 0; t < NUM_TILES; t++) {
    const left = 4 - visible[t];
    if (left <= 0) continue;
    hand13[t]++;
    if (shanten(hand13, forms) < base) {
      waits.push(t);
      total += left;
    }
    hand13[t]--;
  }
  return { waits, total };
}

export function analyzeDiscards(hand14: Counts, forms: Forms = 'standard'): Analysis {
  const hand = hand14.slice();
  const discards: DiscardResult[] = [];
  for (let d = 0; d < NUM_TILES; d++) {
    if (!hand[d]) continue;
    hand[d]--;
    const s = shanten(hand, forms);
    const { waits, total } = ukeire(hand, hand14, forms, s);
    discards.push({ discard: d, shanten: s, ukeire: total, waits });
    hand[d]++;
  }
  discards.sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire || a.discard - b.discard);
  const best = discards[0];
  return { shanten: best.shanten, discards, bestUkeire: best.ukeire };
}

/** Discards that are optimal under pure tile efficiency (ties are all correct). */
export function bestDiscards(a: Analysis): number[] {
  return a.discards
    .filter((d) => d.shanten === a.shanten && d.ukeire === a.bestUkeire)
    .map((d) => d.discard);
}
