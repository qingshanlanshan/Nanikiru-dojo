import { describe, expect, it } from 'vitest';
import { decompose } from './blocks';
import { explain } from './explain';
import { DEFAULT_OPTIONS, generateProblem, problemFromHand } from './generator';
import { mulberry32 } from './rng';
import { shantenStandard } from './shanten';
import { emptyCounts, formatHand, parseHand, tileCount } from './tiles';

describe('decompose', () => {
  it('uses every tile exactly once and matches shanten', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(rng, { ...DEFAULT_OPTIONS, shanten: ((i % 3) + 1) as 1 | 2 | 3 });
      const d = decompose(p.hand);
      const back = emptyCounts();
      for (const b of d.blocks) for (const t of b.tiles) back[t]++;
      expect(back, formatHand(p.hand)).toEqual(p.hand);
      const value = 2 * d.mentsu + Math.min(d.taatsu, 4 - d.mentsu) + (d.head ? 1 : 0);
      expect(8 - value).toBe(shantenStandard(p.hand));
    }
  });
});

describe('explain', () => {
  it('worked example: cutting the only pair', () => {
    const p = problemFromHand(parseHand('23479m566p133789s'));
    const e = explain(p, 20); // 3s
    expect(e.blocks[e.blocks.length - 1]).toMatchObject({ kind: 'cut', tiles: [18] }); // 1s
    expect(e.reason).toContain('1索 是多出来的牌');
    expect(e.mineNote).toContain('拆了「33索 雀头」');
  });

  it('names the weakest taatsu when there are too many blocks', () => {
    const p = problemFromHand(parseHand('1245m125688p3479s'));
    expect(explain(p, 3).reason).toContain('拆最弱的边张 12万');
  });

  it('is well-formed for any wrong answer', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 150; i++) {
      const p = generateProblem(rng, { ...DEFAULT_OPTIONS, shanten: ((i % 3) + 1) as 1 | 2 | 3 });
      for (const r of p.analysis.discards) {
        const e = explain(p, r.discard);
        expect(e.reason.length).toBeGreaterThan(0);
        const shown = e.blocks.reduce((n, b) => n + b.tiles.length, 0);
        expect(shown).toBe(tileCount(p.hand));
        const [bi, ti] = e.mineAt;
        expect(e.blocks[bi].tiles[ti]).toBe(r.discard);
        expect(e.mineNote === null).toBe(p.best.includes(r.discard));
      }
    }
  });
});
