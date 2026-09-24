import type { DiscardResult } from '../engine/analyze';
import { explain, type ViewBlock } from '../engine/explain';
import type { Problem } from '../engine/generator';
import { tileName } from '../engine/tiles';
import { h, tileImg } from './dom';

export const LEVEL_NAMES: Record<number, string> = { 0: '听牌', 1: '一向听', 2: '二向听', 3: '三向听' };

export const levelName = (s: number) => LEVEL_NAMES[s] ?? `${s}向听`;

export interface HandState {
  tiles: number[];
  answer: number | null;
  /** Position of the tapped tile, so only that copy is marked. */
  answerIdx: number;
  /** Keyboard cursor position, or -1 to hide it. */
  cursor: number;
}

export function renderHand(p: Problem, s: HandState, onDiscard: (t: number, idx: number) => void, onHover?: (idx: number) => void) {
  return h(
    'div',
    { class: 'hand', role: 'group', 'aria-label': '手牌' },
    ...s.tiles.map((t, i) => {
      const cls = ['tile-btn'];
      if (s.answer !== null) {
        if (p.best.includes(t) && s.tiles.indexOf(t) === i) cls.push('is-best');
        if (i === s.answerIdx && !p.best.includes(t)) cls.push('is-wrong');
      } else if (i === s.cursor) cls.push('is-cursor');
      const btn = h(
        'button',
        { class: cls.join(' '), 'aria-label': `打${tileName(t)}`, disabled: s.answer !== null, onclick: () => onDiscard(t, i) },
        tileImg(t),
      );
      if (onHover) btn.addEventListener('mouseenter', () => onHover(i));
      return btn;
    }),
  );
}

/** Verdict, block view (when wrong), reason and the per-discard table. `actions` go at the bottom. */
export function renderResult(p: Problem, answer: number, ...actions: HTMLElement[]): HTMLElement {
  const { analysis, best } = p;
  const mine = analysis.discards.find((d) => d.discard === answer)!;
  const ok = best.includes(answer);
  const top = analysis.discards[0];

  let verdict: string;
  if (ok) verdict = best.length > 1 ? `正确！（${best.map(tileName).join('、')} 同为最优）` : '正确！';
  else if (mine.shanten > analysis.shanten) verdict = `打${tileName(answer)} 会退向听`;
  else verdict = `打${tileName(answer)} ${mine.ukeire}枚，最优 打${tileName(top.discard)} ${top.ukeire}枚（少 ${top.ukeire - mine.ukeire} 枚）`;

  const ex = explain(p, answer);
  return h(
    'section',
    { class: `result ${ok ? 'ok' : 'ng'}`, 'aria-live': 'polite' },
    h('p', { class: 'verdict' }, verdict),
    ok ? null : renderBlocks(ex.blocks, ex.mineAt, ex.mineNote),
    h('p', { class: 'reason' }, h('span', { class: 'reason-tag' }, '思路'), ex.reason),
    h('div', { class: 'actions' }, ...actions),
    renderDiscardTable(p, answer),
  );
}

/** Every discard that keeps the shanten, best first; the rest folded away. */
export function renderDiscardTable(p: Problem, answer: number | null): HTMLElement {
  const { analysis, best } = p;
  const keep = analysis.discards.filter((d) => d.shanten === analysis.shanten);
  const back = analysis.discards.filter((d) => d.shanten > analysis.shanten);
  const row = (d: DiscardResult) => {
    const cls = ['row'];
    if (best.includes(d.discard)) cls.push('is-best');
    if (d.discard === answer) cls.push('is-mine');
    return h(
      'tr',
      { class: cls.join(' ') },
      h('td', { class: 'c-tile' }, tileImg(d.discard, 'tile tile-sm')),
      h('td', { class: 'c-count' }, h('b', {}, String(d.ukeire)), '枚', h('small', {}, `${d.waits.length}种`)),
      h('td', { class: 'c-waits' }, ...d.waits.map((w) => tileImg(w, 'tile tile-xs'))),
    );
  };
  return h(
    'div',
    {},
    h(
      'table',
      { class: 'discards' },
      h('thead', {}, h('tr', {}, h('th', {}, '打'), h('th', {}, '进张'), h('th', {}, '有效牌'))),
      h('tbody', {}, ...keep.map(row)),
    ),
    back.length
      ? h(
          'details',
          { class: 'back' },
          h('summary', {}, `其余 ${back.length} 种切法会退向听`),
          h('table', { class: 'discards' }, h('tbody', {}, ...back.map(row))),
        )
      : null,
  );
}

/** The hand after the best discard, split into blocks, with the cut tile and the player's tile marked. */
export function renderBlocks(blocks: ViewBlock[], mark: [number, number] | null = null, note: string | null = null): HTMLElement {
  return h(
    'div',
    { class: 'blocks-card' },
    h(
      'div',
      { class: 'blocks' },
      ...blocks.map((b, bi) =>
        h(
          'div',
          { class: `block block-${b.kind}` },
          h(
            'div',
            { class: 'block-tiles' },
            ...b.tiles.map((t, ti) => {
              const el = tileImg(t, 'tile tile-sm');
              if (mark && bi === mark[0] && ti === mark[1]) el.classList.add('is-mine');
              return el;
            }),
          ),
          h('div', { class: 'block-label' }, b.label),
        ),
      ),
    ),
    note ? h('p', { class: 'mine-note' }, note) : null,
  );
}
