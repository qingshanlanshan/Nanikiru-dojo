import { DEFAULT_OPTIONS, generateProblem, problemFromHand, type Problem } from '../engine/generator';
import { formatHand, parseHand, tileCount, toTiles } from '../engine/tiles';
import { h } from './dom';
import { levelName, renderHand, renderResult, type HandState } from './problemView';
import { recordPractice } from './stats';
import { load, save } from './storage';

type Level = 1 | 2 | 3;

export interface View {
  el: HTMLElement;
  show(): void;
}

function generate(level: Level): Problem {
  return generateProblem(Math.random, { ...DEFAULT_OPTIONS, shanten: level });
}

/** A hand from `#h=...`, if the link carries a valid one. */
export function handFromHash(): string | null {
  const m = location.hash.match(/^#h=([0-9mpsz]+)$/);
  if (!m) return null;
  try {
    const hand = parseHand(m[1]);
    if (tileCount(hand) !== 14 || problemFromHand(hand).analysis.shanten < 0) return null;
    return formatHand(hand);
  } catch {
    return null;
  }
}

const asLevel = (s: number): Level | null => (s === 1 || s === 2 || s === 3 ? s : null);

export function createPractice(): View {
  const el = h('div', { class: 'view' });
  const saved = load<number>('level', 1);
  let level: Level = asLevel(saved) ?? 1;
  let problem: Problem = generate(level);
  let hs: HandState = { tiles: toTiles(problem.hand), answer: null, answerIdx: -1, cursor: -1 };
  let cursor = 0;
  const session = { total: 0, correct: 0, streak: 0 };

  // Generating a 3-shanten problem can take ~100ms, so the next one is built while the
  // player is thinking.
  let prefetched: { level: Level; problem: Problem } | null = null;
  const prefetch = () => {
    prefetched = null;
    const lv = level;
    setTimeout(() => {
      if (level === lv) prefetched = { level: lv, problem: generate(lv) };
    }, 300);
  };

  const setHash = () => history.replaceState(null, '', `#h=${formatHand(problem.hand)}`);

  const load_ = (p: Problem) => {
    problem = p;
    hs = { tiles: toTiles(p.hand), answer: null, answerIdx: -1, cursor: -1 };
    cursor = 0;
    setHash();
    render();
  };

  const next = () => {
    load_(prefetched?.level === level ? prefetched.problem : generate(level));
    prefetch();
  };

  const setLevel = (lv: Level) => {
    if (lv === level && hs.answer === null) return;
    level = lv;
    save('level', lv);
    prefetched = null;
    next();
  };

  const discard = (t: number, idx: number) => {
    if (hs.answer !== null) return;
    hs.answer = t;
    hs.answerIdx = idx;
    hs.cursor = -1;
    const ok = problem.best.includes(t);
    session.total++;
    if (ok) session.correct++, session.streak++;
    else session.streak = 0;
    recordPractice(problem.analysis.shanten, formatHand(problem.hand), t, problem.best[0], ok);
    document.dispatchEvent(new Event('heqie:answered'));
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (el.hidden || !el.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest?.('input, textarea, dialog')) return;
    if (hs.answer === null) {
      if (e.key === 'ArrowLeft') cursor = Math.max(0, cursor - 1);
      else if (e.key === 'ArrowRight') cursor = Math.min(hs.tiles.length - 1, cursor + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && hs.cursor >= 0) return e.preventDefault(), discard(hs.tiles[cursor], cursor);
      else return;
      e.preventDefault();
      hs.cursor = cursor;
      render();
    } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'n') {
      e.preventDefault();
      next();
    }
  });

  function render() {
    const levels = h(
      'div',
      { class: 'levels', role: 'tablist' },
      ...([1, 2, 3] as Level[]).map((lv) =>
        h(
          'button',
          { class: 'level', role: 'tab', 'aria-selected': String(lv === level), onclick: () => setLevel(lv) },
          levelName(lv),
        ),
      ),
    );
    const sessionLine = session.total
      ? h(
          'p',
          { class: 'session' },
          `本次 ${session.correct}/${session.total}`,
          session.streak >= 2 ? h('span', { class: 'streak' }, ` · 连对 ${session.streak}`) : '',
        )
      : null;

    el.replaceChildren(
      levels,
      h(
        'section',
        { class: 'table' },
        h('div', { class: 'prompt' }, h('span', {}, `${levelName(problem.analysis.shanten)} · 切哪张？`), sessionLine),
        renderHand(problem, hs, discard, (i) => (cursor = i)),
      ),
      hs.answer === null
        ? h('p', { class: 'hint' }, '只看进张数（纯牌效），不考虑役、宝牌与安全度。')
        : renderResult(problem, hs.answer, h('button', { class: 'btn btn-primary next', onclick: next }, '下一题 →')),
    );
    if (hs.answer !== null) (el.querySelector('.next') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  return {
    el,
    show() {
      const linked = handFromHash();
      if (linked && linked !== formatHand(problem.hand)) {
        const p = problemFromHand(parseHand(linked));
        const lv = asLevel(p.analysis.shanten);
        if (lv) level = lv;
        load_(p);
      } else {
        setHash();
        render();
      }
      if (!prefetched) prefetch();
    },
  };
}
