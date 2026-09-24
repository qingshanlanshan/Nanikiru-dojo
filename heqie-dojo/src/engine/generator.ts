import { analyzeDiscards, bestDiscards, type Analysis } from './analyze';
import type { Rng } from './rng';
import { shantenChiitoi, shantenKokushi, shantenStandard } from './shanten';
import { emptyCounts, isHonor, NUM_TILES, type Counts } from './tiles';

// Bump when generation logic changes: daily problems depend on it.
export const GENERATOR_VERSION = 1;

export interface GenOptions {
  /** Target shanten of the 14-tile hand. */
  shanten: 1 | 2 | 3;
  /**
   * Minimum ratio of the runner-up discard's ukeire to the best one. Higher means the
   * top choices are closer, i.e. harder. 0.6 is a reasonable default.
   */
  minCloseness: number;
  /**
   * Maximum runner-up ratio. Pure ukeire can't justify a 1-tile edge (e.g. 31 vs 30 at
   * 2-shanten, where shape potential dominates), so near-ties are rejected as ambiguous.
   */
  maxCloseness: number;
  /** Max number of equally-correct discards; more than this is too forgiving. */
  maxBest: number;
}

export interface Problem {
  hand: Counts;
  analysis: Analysis;
  best: number[];
  /** Runner-up ukeire / best ukeire, in [0, 1). */
  closeness: number;
}

export const DEFAULT_OPTIONS: GenOptions = { shanten: 1, minCloseness: 0.6, maxCloseness: 0.9, maxBest: 2 };

const WALL = Array.from({ length: NUM_TILES * 4 }, (_, i) => i >> 2);

/** Draw 14 tiles from a full 136-tile wall (partial Fisher-Yates). */
function drawHand(rng: Rng): Counts {
  const wall = WALL.slice();
  const c = emptyCounts();
  for (let i = 0; i < 14; i++) {
    const j = i + Math.floor(rng() * (wall.length - i));
    [wall[i], wall[j]] = [wall[j], wall[i]];
    c[wall[i]]++;
  }
  return c;
}

/** A single tile with no neighbour within two ranks: discarding it is the "obvious" answer. */
export function isIsolated(c: Counts, t: number): boolean {
  if (c[t] !== 1) return false;
  if (isHonor(t)) return true;
  const r = t % 9;
  for (let d = -2; d <= 2; d++) {
    if (d !== 0 && r + d >= 0 && r + d <= 8 && c[t + d] > 0) return false;
  }
  return true;
}

/** Returns null if the hand isn't a good problem under `opts`. */
export function evaluateCandidate(hand: Counts, opts: GenOptions): Problem | null {
  // With all 4 copies in hand, shanten can count a wait on a nonexistent 5th tile.
  if (hand.some((n) => n >= 4)) return null;
  const s = shantenStandard(hand);
  if (s !== opts.shanten) return null;
  // Keep problems about standard form: 七对子/国士 must not be as close.
  if (shantenChiitoi(hand) <= s || shantenKokushi(hand) <= s) return null;

  const analysis = analyzeDiscards(hand, 'standard');
  const best = bestDiscards(analysis);
  if (best.length > opts.maxBest) return null;
  if (best.some((t) => isIsolated(hand, t))) return null;

  const runnerUp = analysis.discards.find((d) => d.shanten === s && d.ukeire < analysis.bestUkeire);
  if (!runnerUp) return null;
  const closeness = runnerUp.ukeire / analysis.bestUkeire;
  if (closeness < opts.minCloseness || closeness > opts.maxCloseness) return null;

  return { hand, analysis, best, closeness };
}

export function generateProblem(rng: Rng, opts: GenOptions = DEFAULT_OPTIONS, maxTries = 200_000): Problem {
  for (let i = 0; i < maxTries; i++) {
    const p = evaluateCandidate(drawHand(rng), opts);
    if (p) return p;
  }
  throw new Error('generateProblem: no hand found; options too strict?');
}
