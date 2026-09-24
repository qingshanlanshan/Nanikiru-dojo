import { connections, decompose, isTaatsu, taatsuWaits, type Block, type BlockKind } from './blocks';
import type { Problem } from './generator';
import { isHonor, tileName, type Counts } from './tiles';

// Turns a problem into something a player can follow: the hand split into blocks, and a
// one-line reason for the best discard. A principle is only stated when it is verified to
// hold for this hand; otherwise the reason falls back to plain numbers.

export type ViewKind = BlockKind | 'complex' | 'cut';

export interface ViewBlock {
  kind: ViewKind;
  tiles: number[];
  label: string;
}

export interface Explanation {
  /** The hand after the best discard, split into blocks, plus the cut tile as its own block. */
  blocks: ViewBlock[];
  /** Index into `blocks` (and into that block's tiles) of the best discard. */
  bestAt: [number, number];
  /** Same for the player's discard. */
  mineAt: [number, number];
  reason: string;
  /** Where the player's discard sat, when it was wrong. */
  mineNote: string | null;
}

export const KIND_LABEL: Record<ViewKind, string> = {
  shuntsu: '顺子',
  koutsu: '刻子',
  head: '雀头',
  pair: '对子',
  ryanmen: '两面',
  kanchan: '嵌张',
  penchan: '边张',
  single: '浮牌',
  complex: '复合形',
  cut: '切这张',
};

const SUIT_NAME = ['万', '筒', '索'];

/** "56筒", "东东". */
export function blockText(tiles: number[]): string {
  if (isHonor(tiles[0])) return tiles.map(tileName).join('');
  return tiles.map((t) => (t % 9) + 1).join('') + SUIT_NAME[Math.floor(tiles[0] / 9)];
}

const left = (hand: Counts, t: number) => 4 - hand[t];

/** Fold loose tiles into a neighbouring taatsu/pair of the same suit, e.g. 56筒 + 6筒 -> 566筒. */
function mergeLoose(blocks: Block[]): ViewBlock[] {
  const view: ViewBlock[] = blocks.map((b) => ({ kind: b.kind, tiles: b.tiles.slice(), label: KIND_LABEL[b.kind] }));
  for (let i = view.length - 1; i >= 0; i--) {
    const s = view[i];
    if (s.kind !== 'single' || isHonor(s.tiles[0])) continue;
    const t = s.tiles[0];
    const host = view.find(
      (b) =>
        (isTaatsu(b as Block) || b.kind === 'head') &&
        Math.floor(b.tiles[0] / 9) === Math.floor(t / 9) &&
        b.tiles.some((x) => Math.abs(x - t) <= 2),
    );
    if (!host) continue;
    host.tiles = [...host.tiles, t].sort((a, b) => a - b);
    host.label = `${KIND_LABEL.complex}（${KIND_LABEL[host.kind]}+${tileName(t)}）`;
    host.kind = 'complex';
    view.splice(i, 1);
  }
  return view.sort((a, b) => a.tiles[0] - b.tiles[0]);
}

/** Prefer the weakest role when a tile type appears in several blocks. */
const ROLE_ORDER: ViewKind[] = ['single', 'complex', 'kanchan', 'penchan', 'pair', 'ryanmen', 'head', 'koutsu', 'shuntsu'];

function locate(view: ViewBlock[], t: number): [number, number] {
  let best: [number, number] = [-1, -1];
  let rank = Infinity;
  view.forEach((b, i) => {
    const j = b.tiles.indexOf(t);
    const r = ROLE_ORDER.indexOf(b.kind);
    if (j >= 0 && r < rank) (best = [i, j]), (rank = r);
  });
  return best;
}

export function explain(p: Problem, answer: number): Explanation {
  const { hand, analysis } = p;
  const B = p.best.includes(answer) ? answer : p.best[0];
  const after = hand.slice();
  after[B]--;
  // The 14-tile hand often has several equally good splits; the split of the hand *after*
  // the best discard is the target shape, so that's what the view shows.
  const d13 = decompose(after);
  const n13 = d13.mentsu + d13.taatsu + (d13.head ? 1 : 0);
  const loose13 = d13.blocks.filter((b) => b.kind === 'single');

  const bestRes = analysis.discards.find((r) => r.discard === B)!;
  const runnerUp = analysis.discards.find((r) => r.shanten === analysis.shanten && !p.best.includes(r.discard));

  let reason: string | null = null;

  // 1. Too many blocks and B sits in the weakest taatsu (judged on the full 14-tile hand).
  const d14 = decompose(hand);
  const n14 = d14.mentsu + d14.taatsu + (d14.head ? 1 : 0);
  const bBlock = d14.blocks
    .filter((b) => b.tiles.includes(B))
    .sort((x, y) => ROLE_ORDER.indexOf(x.kind) - ROLE_ORDER.indexOf(y.kind))[0];
  if (isTaatsu(bBlock) && n14 > 5) {
    const accept = (b: Block) => taatsuWaits(b).reduce((s, w) => s + left(hand, w), 0);
    const others = d14.blocks.filter((b) => isTaatsu(b) && b !== bBlock);
    if (others.every((b) => accept(bBlock) <= accept(b))) {
      const waits = taatsuWaits(bBlock).map(tileName).join('、');
      reason =
        `共 ${n14} 块，比和牌需要的 5 块多，` +
        `拆最弱的${KIND_LABEL[bBlock.kind]} ${blockText(bBlock.tiles)}（只等 ${waits}，${accept(bBlock)} 枚）。`;
    }
  }
  // 2. Without B the hand still has 5+ blocks: B is surplus.
  if (!reason && n13 >= 5) {
    const comp = `${d13.mentsu}面子 + ${d13.taatsu}搭子${d13.head ? ' + 雀头' : ''}`;
    reason = `切掉 ${tileName(B)} 后仍有 ${n13} 块（${comp}），和牌只需 5 块，${tileName(B)} 是多出来的牌。`;
  }
  // 3. Not enough blocks yet: keep the loose tiles that connect best.
  if (!reason && loose13.every((b) => connections(B) <= connections(b.tiles[0]))) {
    reason = `搭子还不到 5 块，要留能连成搭子的牌；${tileName(B)} 能连的牌最少（${connections(B)} 种），先切它。`;
  }
  if (!reason) {
    reason = runnerUp
      ? `打${tileName(B)} 进张最多（${bestRes.ukeire} 枚），比次优的打${tileName(runnerUp.discard)} 多 ${bestRes.ukeire - runnerUp.ukeire} 枚。`
      : `打${tileName(B)} 进张最多（${bestRes.ukeire} 枚）。`;
  }

  const view = mergeLoose(d13.blocks);
  view.push({ kind: 'cut', tiles: [B], label: KIND_LABEL.cut });
  const bestAt: [number, number] = [view.length - 1, 0];
  const mineAt = p.best.includes(answer) ? bestAt : locate(view, answer);

  let mineNote: string | null = null;
  if (!p.best.includes(answer)) {
    const mb = view[mineAt[0]];
    const mine = analysis.discards.find((r) => r.discard === answer)!;
    const where =
      mb.kind === 'single' ? `你切的 ${tileName(answer)} 是浮牌` : `你切的 ${tileName(answer)} 拆了「${blockText(mb.tiles)} ${mb.label}」`;
    mineNote =
      mine.shanten > analysis.shanten
        ? `${where}，会退向听。`
        : `${where}，进张 ${mine.ukeire} 枚，少 ${bestRes.ukeire - mine.ukeire} 枚。`;
  }

  return { blocks: view, bestAt, mineAt, reason, mineNote };
}
