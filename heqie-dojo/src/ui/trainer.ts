import type { DiscardResult } from '../engine/analyze';
import { explain, type Explanation } from '../engine/explain';
import { DEFAULT_OPTIONS, generateProblem, problemFromHand, type Problem } from '../engine/generator';
import { formatHand, parseHand, tileCount, tileName, toTiles } from '../engine/tiles';
import { h, tileImg } from './dom';
import { load, save } from './storage';

type Level = 1 | 2 | 3;
const LEVEL_NAMES: Record<number, string> = { 0: '听牌', 1: '一向听', 2: '二向听', 3: '三向听' };

interface State {
  level: Level;
  problem: Problem;
  /** Tiles in display order (sorted). */
  tiles: number[];
  cursor: number;
  /** Only show the cursor once the keyboard is used. */
  keyboard: boolean;
  answer: number | null;
  /** Position of the tapped tile, so only that copy is marked. */
  answerIdx: number;
  session: { total: number; correct: number; streak: number };
}

function generate(level: Level): Problem {
  return generateProblem(Math.random, { ...DEFAULT_OPTIONS, shanten: level });
}

/** A hand from `#h=...`, if the link carries a valid one. */
function problemFromHash(): Problem | null {
  const m = location.hash.match(/^#h=([0-9mpsz]+)$/);
  if (!m) return null;
  try {
    const hand = parseHand(m[1]);
    if (tileCount(hand) !== 14) return null;
    const p = problemFromHand(hand);
    return p.analysis.shanten >= 0 ? p : null;
  } catch {
    return null;
  }
}

function setHash(p: Problem) {
  history.replaceState(null, '', `#h=${formatHand(p.hand)}`);
}

export function mountTrainer(root: HTMLElement) {
  const saved = load<Level>('level', 1);
  const level: Level = [1, 2, 3].includes(saved) ? saved : 1;
  const linked = problemFromHash();
  const first = linked ?? generate(level);
  const linkedLevel = linked?.analysis.shanten;
  const state: State = {
    level: linkedLevel === 1 || linkedLevel === 2 || linkedLevel === 3 ? linkedLevel : level,
    problem: first,
    tiles: toTiles(first.hand),
    cursor: 0,
    keyboard: false,
    answer: null,
    answerIdx: -1,
    session: { total: 0, correct: 0, streak: 0 },
  };

  // Generating a 3-shanten problem can take ~100ms, so the next one is built while the
  // player is thinking.
  let prefetched: { level: Level; problem: Problem } | null = null;
  const prefetch = () => {
    prefetched = null;
    const lv = state.level;
    setTimeout(() => {
      if (state.level === lv) prefetched = { level: lv, problem: generate(lv) };
    }, 300);
  };

  const next = () => {
    const p = prefetched?.level === state.level ? prefetched.problem : generate(state.level);
    state.problem = p;
    state.tiles = toTiles(p.hand);
    state.cursor = 0;
    state.answer = null;
    setHash(p);
    render();
    prefetch();
  };

  const setLevel = (lv: Level) => {
    if (lv === state.level && state.answer === null) return;
    state.level = lv;
    save('level', lv);
    prefetched = null;
    next();
  };

  const discard = (t: number, idx: number) => {
    if (state.answer !== null) return;
    state.answer = t;
    state.answerIdx = idx;
    const ok = state.problem.best.includes(t);
    const s = state.session;
    s.total++;
    if (ok) s.correct++, s.streak++;
    else s.streak = 0;
    render();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (state.answer === null) {
      if (e.key === 'ArrowLeft') state.cursor = Math.max(0, state.cursor - 1);
      else if (e.key === 'ArrowRight') state.cursor = Math.min(state.tiles.length - 1, state.cursor + 1);
      else if (e.key === 'Enter' || e.key === ' ') return e.preventDefault(), discard(state.tiles[state.cursor], state.cursor);
      else return;
      e.preventDefault();
      state.keyboard = true;
      render();
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'n') {
      e.preventDefault();
      next();
    }
  };
  document.addEventListener('keydown', onKey);

  function render() {
    const { problem, answer, session } = state;
    const shownLevel = problem.analysis.shanten;

    const levels = h(
      'div',
      { class: 'levels', role: 'tablist' },
      ...([1, 2, 3] as Level[]).map((lv) =>
        h(
          'button',
          { class: 'level', role: 'tab', 'aria-selected': String(lv === state.level), onclick: () => setLevel(lv) },
          LEVEL_NAMES[lv],
        ),
      ),
    );

    const hand = h(
      'div',
      { class: 'hand', role: 'group', 'aria-label': '手牌' },
      ...state.tiles.map((t, i) => {
        const cls = ['tile-btn'];
        if (answer !== null) {
          if (problem.best.includes(t) && state.tiles.indexOf(t) === i) cls.push('is-best');
          if (i === state.answerIdx && !problem.best.includes(t)) cls.push('is-wrong');
        } else if (state.keyboard && i === state.cursor) cls.push('is-cursor');
        const btn = h(
          'button',
          { class: cls.join(' '), 'aria-label': `打${tileName(t)}`, disabled: answer !== null, onclick: () => discard(t, i) },
          tileImg(t),
        );
        btn.addEventListener('mouseenter', () => {
          if (state.answer === null) state.cursor = i;
        });
        return btn;
      }),
    );

    const stats = h(
      'div',
      { class: 'session' },
      session.total ? `本次 ${session.correct}/${session.total}` : '',
      session.streak >= 2 ? h('span', { class: 'streak' }, ` · 连对 ${session.streak}`) : '',
    );

    root.replaceChildren(
      h(
        'header',
        { class: 'top' },
        h('h1', {}, '何切道场'),
        stats,
      ),
      h(
        'main',
        {},
        levels,
        h(
          'section',
          { class: 'table' },
          h('p', { class: 'prompt' }, `${LEVEL_NAMES[shownLevel] ?? `${shownLevel}向听`} · 切哪张？`),
          hand,
        ),
        answer === null ? h('p', { class: 'hint' }, '只看进张数（纯牌效），不考虑役、宝牌与安全度。') : renderResult(problem, answer, next),
      ),
      h(
        'footer',
        {},
        h('span', {}, '牌图 CC0 · '),
        h('a', { href: 'https://github.com/FluffyStuff/riichi-mahjong-tiles', target: '_blank', rel: 'noopener' }, 'FluffyStuff'),
      ),
    );
    if (answer !== null) (root.querySelector('.next') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  setHash(state.problem);
  render();
  prefetch();
}

function renderResult(p: Problem, answer: number, next: () => void): HTMLElement {
  const { analysis, best } = p;
  const mine = analysis.discards.find((d) => d.discard === answer)!;
  const ok = best.includes(answer);
  const top = analysis.discards[0];

  let verdict: string;
  if (ok) verdict = best.length > 1 ? `正确！（${best.map(tileName).join('、')} 同为最优）` : '正确！';
  else if (mine.shanten > analysis.shanten) verdict = `打${tileName(answer)} 会退向听`;
  else verdict = `打${tileName(answer)} ${mine.ukeire}枚，最优 打${tileName(top.discard)} ${top.ukeire}枚（少 ${top.ukeire - mine.ukeire} 枚）`;

  const ex = explain(p, answer);

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
    'section',
    { class: `result ${ok ? 'ok' : 'ng'}`, 'aria-live': 'polite' },
    h('p', { class: 'verdict' }, verdict),
    ok ? null : renderBlocks(ex),
    h('p', { class: 'reason' }, h('span', { class: 'reason-tag' }, '思路'), ex.reason),
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
    h('button', { class: 'next', onclick: next }, '下一题 →'),
  );
}

/** The hand after the best discard, split into blocks, with the cut tile and the player's tile marked. */
function renderBlocks(ex: Explanation): HTMLElement {
  return h(
    'div',
    { class: 'blocks-card' },
    h(
      'div',
      { class: 'blocks' },
      ...ex.blocks.map((b, bi) =>
        h(
          'div',
          { class: `block block-${b.kind}` },
          h(
            'div',
            { class: 'block-tiles' },
            ...b.tiles.map((t, ti) => {
              const el = tileImg(t, 'tile tile-sm');
              if (bi === ex.mineAt[0] && ti === ex.mineAt[1]) el.classList.add('is-mine');
              return el;
            }),
          ),
          h('div', { class: 'block-label' }, b.label),
        ),
      ),
    ),
    ex.mineNote ? h('p', { class: 'mine-note' }, ex.mineNote) : null,
  );
}
