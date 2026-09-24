import { describe, expect, it } from 'vitest';
import { analyzeDiscards, bestDiscards, ukeire } from './analyze';
import { DEFAULT_OPTIONS, evaluateCandidate, generateProblem, isIsolated } from './generator';
import { mulberry32, rngFromString, type Rng } from './rng';
import { shanten, shantenChiitoi, shantenKokushi, shantenStandard } from './shanten';
import { emptyCounts, formatHand, isHonor, NUM_TILES, parseHand, tileCount, type Counts } from './tiles';

// ---- Brute-force reference, written from the definition rather than the algorithm ----

function allMentsu(c: Counts): boolean {
  const i = c.findIndex((n) => n > 0);
  if (i < 0) return true;
  if (c[i] >= 3) {
    c[i] -= 3;
    const ok = allMentsu(c);
    c[i] += 3;
    if (ok) return true;
  }
  if (!isHonor(i) && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
    c[i]--, c[i + 1]--, c[i + 2]--;
    const ok = allMentsu(c);
    c[i]++, c[i + 1]++, c[i + 2]++;
    if (ok) return true;
  }
  return false;
}

function isCompleteStandard(c: Counts): boolean {
  for (let t = 0; t < NUM_TILES; t++) {
    if (c[t] < 2) continue;
    c[t] -= 2;
    const ok = allMentsu(c);
    c[t] += 2;
    if (ok) return true;
  }
  return false;
}

function refTenpai(h13: Counts): boolean {
  for (let t = 0; t < NUM_TILES; t++) {
    if (h13[t] >= 4) continue;
    h13[t]++;
    const ok = isCompleteStandard(h13);
    h13[t]--;
    if (ok) return true;
  }
  return false;
}

/** Best and worst shanten reachable in one draw + discard, using the fast function. */
function oneStep(h13: Counts): { min: number } {
  let min = Infinity;
  for (let t = 0; t < NUM_TILES; t++) {
    if (h13[t] >= 4) continue;
    h13[t]++;
    for (let d = 0; d < NUM_TILES; d++) {
      if (!h13[d]) continue;
      h13[d]--;
      min = Math.min(min, shantenStandard(h13));
      h13[d]++;
    }
    h13[t]--;
  }
  return { min };
}

function randomHand(rng: Rng, n: number): Counts {
  const wall = Array.from({ length: 136 }, (_, i) => i >> 2);
  const c = emptyCounts();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (wall.length - i));
    [wall[i], wall[j]] = [wall[j], wall[i]];
    c[wall[i]]++;
  }
  return c;
}

/** A complete hand with k tiles swapped out: gives plenty of low-shanten 13-tile hands. */
function nearHand(rng: Rng, k: number): Counts {
  for (;;) {
    const c = emptyCounts();
    const add = (t: number) => c[t]++;
    for (let m = 0; m < 4; m++) {
      const suit = Math.floor(rng() * 3);
      if (rng() < 0.3) {
        const t = Math.floor(rng() * 34);
        c[t] += 3;
      } else {
        const r = Math.floor(rng() * 7);
        add(suit * 9 + r), add(suit * 9 + r + 1), add(suit * 9 + r + 2);
      }
    }
    c[Math.floor(rng() * 34)] += 2;
    // drop to 13 then swap k tiles
    const tiles = c.flatMap((n, t) => Array(n).fill(t) as number[]);
    if (tiles.length !== 14) continue;
    c[tiles[Math.floor(rng() * 14)]]--;
    for (let i = 0; i < k; i++) {
      const held = c.flatMap((n, t) => Array(n).fill(t) as number[]);
      c[held[Math.floor(rng() * held.length)]]--;
      c[Math.floor(rng() * 34)]++;
    }
    if (c.every((n) => n >= 0 && n <= 4) && tileCount(c) === 13) return c;
  }
}

// ---- Tests ----

describe('tiles', () => {
  it('round-trips mpsz notation', () => {
    expect(formatHand(parseHand('123m456p789s1122z'))).toBe('123m456p789s1122z');
    expect(formatHand(parseHand('505m'))).toBe('555m');
    expect(() => parseHand('11111m')).toThrow();
    expect(() => parseHand('8z')).toThrow();
  });
});

describe('shanten: fixed cases', () => {
  it.each([
    ['123m456p789s11222z', -1],
    ['123m456p789s1122z', 0],
    ['1112345678999m', 0],
    ['19m19p19s1234567z', 8],
    ['147m258p369s1234z', 8],
  ])('standard %s = %i', (h, s) => {
    expect(shantenStandard(parseHand(h))).toBe(s);
  });

  it('chiitoi and kokushi', () => {
    expect(shantenChiitoi(parseHand('1122m3344p5566s77z'))).toBe(-1);
    expect(shantenChiitoi(parseHand('1122m3344p5566s7z'))).toBe(0);
    // 4 of a kind counts as one pair only
    expect(shantenChiitoi(parseHand('1111m3344p5566s7z'))).toBe(2);
    expect(shantenKokushi(parseHand('19m19p19s1234567z'))).toBe(0);
    expect(shantenKokushi(parseHand('119m19p19s1234567z'))).toBe(-1);
    expect(shanten(parseHand('19m19p19s1234567z'))).toBe(0);
  });
});

describe('shanten: agrees with the definition', () => {
  const rng = mulberry32(12345);
  // Hands holding all 4 of a tile can "wait" on a 5th copy; the fast algorithm ignores that
  // and the generator rejects such hands, so they're excluded here.
  const hands = [
    ...Array.from({ length: 1500 }, () => nearHand(rng, Math.floor(rng() * 3))),
    ...Array.from({ length: 500 }, () => randomHand(rng, 13)),
  ].filter((h) => h.every((n) => n < 4));

  it('tenpai <=> shanten 0', () => {
    for (const h of hands) {
      const s = shantenStandard(h);
      expect(s === 0, formatHand(h)).toBe(refTenpai(h));
    }
  });

  it('satisfies the recurrence s(h) = 1 + min over one draw+discard', () => {
    // Together with the tenpai check this pins shanten down exactly by induction.
    for (const h of hands) {
      const s = shantenStandard(h);
      if (s <= 0) continue;
      expect(oneStep(h).min, formatHand(h)).toBe(s - 1);
    }
  });
});

describe('ukeire', () => {
  it('nine gates waits on all nine, 23 tiles left', () => {
    const h = parseHand('1112345678999m');
    const u = ukeire(h, h, 'standard');
    expect(u.waits.length).toBe(9);
    expect(u.total).toBe(1 + 7 * 3 + 1);
  });

  it('ryanmen 23m waits 1m/4m = 8', () => {
    const h = parseHand('23m456p789s11122z');
    expect(ukeire(h, h, 'standard').total).toBe(8);
  });

  it('counts the discarded tile as visible', () => {
    // 234m456p789s111z22z is complete; cutting 4m leaves 23m waiting on 1m (4 left) + 4m (3 left).
    const a = analyzeDiscards(parseHand('234m456p789s111z22z'));
    const cut4m = a.discards.find((d) => d.discard === 3)!;
    expect(cut4m.shanten).toBe(0);
    expect(cut4m.ukeire).toBe(7);
  });

  it('ranks discards: shanten first, then ukeire', () => {
    const a = analyzeDiscards(parseHand('23m456p789s111z22z9s'));
    for (let i = 1; i < a.discards.length; i++) {
      const p = a.discards[i - 1];
      const q = a.discards[i];
      expect(p.shanten < q.shanten || (p.shanten === q.shanten && p.ukeire >= q.ukeire)).toBe(true);
    }
    expect(bestDiscards(a)).toContain(26);
  });
});

describe('generator', () => {
  it('isIsolated', () => {
    const h = parseHand('13m9m5p1z');
    expect(isIsolated(h, 0)).toBe(false);
    expect(isIsolated(h, 8)).toBe(true);
    expect(isIsolated(h, 13)).toBe(true);
    expect(isIsolated(h, 27)).toBe(true);
  });

  it.each([1, 2, 3] as const)('produces valid %i-shanten problems', (s) => {
    const rng = mulberry32(s * 999);
    for (let i = 0; i < 5; i++) {
      const p = generateProblem(rng, { ...DEFAULT_OPTIONS, shanten: s });
      expect(tileCount(p.hand)).toBe(14);
      expect(p.analysis.shanten).toBe(s);
      expect(p.best.length).toBeGreaterThan(0);
      expect(p.best.length).toBeLessThanOrEqual(DEFAULT_OPTIONS.maxBest);
      expect(p.closeness).toBeGreaterThanOrEqual(DEFAULT_OPTIONS.minCloseness);
      expect(p.closeness).toBeLessThanOrEqual(DEFAULT_OPTIONS.maxCloseness);
      expect(evaluateCandidate(p.hand, { ...DEFAULT_OPTIONS, shanten: s })).not.toBeNull();
    }
  });

  it('1-shanten ukeire matches the definition (incl. drawing a 4th copy)', () => {
    const rng = mulberry32(777);
    for (let i = 0; i < 40; i++) {
      const p = generateProblem(rng);
      for (const r of p.analysis.discards) {
        if (r.shanten !== 1) continue;
        const h13 = p.hand.slice();
        h13[r.discard]--;
        const truth: number[] = [];
        for (let w = 0; w < NUM_TILES; w++) {
          if (p.hand[w] >= 4) continue;
          h13[w]++;
          let reaches = false;
          for (let d = 0; d < NUM_TILES && !reaches; d++) {
            if (!h13[d]) continue;
            h13[d]--;
            reaches = refTenpai(h13);
            h13[d]++;
          }
          h13[w]--;
          if (reaches) truth.push(w);
        }
        expect(r.waits, formatHand(p.hand)).toEqual(truth);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateProblem(rngFromString('daily-2026-09-24'));
    const b = generateProblem(rngFromString('daily-2026-09-24'));
    expect(formatHand(a.hand)).toBe(formatHand(b.hand));
  });
});
