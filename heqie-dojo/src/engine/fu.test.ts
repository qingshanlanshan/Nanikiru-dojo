import { describe, expect, it } from 'vitest';
import { FU_CHOICES, generateFuProblem, hasYaku, readings, uniqueFu, type Meld, type MeldKind, type WinHand } from './fu';
import { mulberry32 } from './rng';
import { parseHand, toTiles } from './tiles';

const E = 27;
const S = 28;

function hand(closed: string, win: string, opts: { tsumo?: boolean; melds?: [MeldKind, string][]; round?: number; seat?: number } = {}): WinHand {
  const melds: Meld[] = (opts.melds ?? []).map(([kind, s]) => ({ kind, tiles: toTiles(parseHand(s)) }));
  return {
    closed: parseHand(closed),
    melds,
    win: toTiles(parseHand(win))[0],
    tsumo: !!opts.tsumo,
    roundWind: opts.round ?? E,
    seatWind: opts.seat ?? S,
  };
}

const fu = (h: WinHand) => uniqueFu(h)?.total;

describe('fu: fixed values', () => {
  it('平和 ron 30, tsumo 20', () => {
    // 234m 567p 345s 67s+8s, pair 55p, 8s completes 678s as a ryanmen (67s waiting 5s/8s)
    const h = hand('234m55567p345678s', '8s');
    expect(fu(h)).toBe(30);
    expect(uniqueFu(h)?.pinfu).toBe(true);
    expect(fu({ ...h, tsumo: true })).toBe(20);
  });

  it('七对子 25', () => {
    expect(fu(hand('1122m3344p5566s77z', '7z'))).toBe(25);
  });

  it('open hand with no extra 符 on ron is 30', () => {
    // chi 234m, closed 567p 345s 67s+5s, pair 88s: tanyao, ryanmen
    const h = hand('567p34556788s', '5s', { melds: [['chi', '234m']] });
    expect(fu(h)).toBe(30);
    expect(uniqueFu(h)?.note).toContain('副露平和形');
  });
});

describe('fu: components', () => {
  it('门清荣和 + 幺九暗刻 + 嵌张 = 40', () => {
    // 999s ankou (8), 13m waiting 2m (kanchan 2), 456p 678p, pair 55s: 20+10+8+2 = 40
    expect(fu(hand('123m456678p55999s', '2m'))).toBe(40);
  });

  it('ron completing a triplet makes it open (双碰)', () => {
    // 55m + 77p shanpon, ron 7p: 777p is 明刻 中张 2 -> 20+10+2 = 32 -> 40
    const h = hand('234m55m777p345678s', '7p');
    const r = uniqueFu(h)!;
    expect(r.items.some((i) => i.label.includes('荣和成刻算明刻') && i.fu === 2)).toBe(true);
    expect(r.total).toBe(40);
    // Same hand by tsumo: 暗刻 4 + 自摸 2 -> 26 -> 30
    expect(fu({ ...h, tsumo: true })).toBe(30);
  });

  it('连风 pair is 4符 (雀魂/天凤 rule)', () => {
    // East round, East seat, pair 东东, tanki on 东 -> 20+10+4+2 = 36 -> 40
    const h = hand('234m456p678s345s11z', '1z', { round: E, seat: E });
    const r = uniqueFu(h)!;
    expect(r.items.find((i) => i.label.includes('连风'))?.fu).toBe(4);
    expect(r.total).toBe(40);
  });

  it('kans: 暗杠 幺九 32, 明杠 中张 8', () => {
    // ankan 东 (32), minkan 5p (8), pon 中 (4); closed 23s+4s (ryanmen) and pair 88m.
    // Open hand, ron: 20 + 32 + 8 + 4 = 64 -> 70
    const h = hand('234s88m', '4s', { melds: [['ankan', '1111z'], ['minkan', '5555p'], ['pon', '777z']] });
    expect(hasYaku(h)).toBe(true);
    expect(fu(h)).toBe(70);
  });

  it('flags hands whose readings disagree as ambiguous', () => {
    // 56777m winning on 7m: 567m 两面 (平和, 30) or 77m 单骑 (40) — depends on 役, so skipped.
    const h = hand('234m456p678s56777m', '7m');
    expect(readings(h).length).toBeGreaterThan(1);
    expect(uniqueFu(h)).toBeNull();
  });
});

describe('fu generator', () => {
  it('produces unambiguous, legal, in-range problems', () => {
    const rng = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const p = generateFuProblem(rng);
      expect(FU_CHOICES).toContain(p.fu.total);
      expect(hasYaku(p.hand)).toBe(true);
      expect(uniqueFu(p.hand)?.total).toBe(p.fu.total);
      const closedCount = p.hand.closed.reduce((a, b) => a + b, 0);
      expect(closedCount).toBe(14 - 3 * p.hand.melds.length);
      expect(p.hand.closed[p.hand.win]).toBeGreaterThan(0);
      seen.add(p.fu.total);
    }
    // Covers the interesting values, not just 30/40.
    for (const v of [20, 25, 30, 40, 50]) expect(seen).toContain(v);
  });
});
