import { DEFAULT_OPTIONS, GENERATOR_VERSION, generateProblem, problemFromHand, type Problem } from '../engine/generator';
import { rngFromString } from '../engine/rng';
import { formatHand, parseHand, toTiles } from '../engine/tiles';
import { h } from './dom';
import type { View } from './practice';
import { levelName, renderHand, renderResult, type HandState } from './problemView';
import { openShare } from './share';
import { dailyStreak, getStats, recordDaily } from './stats';

/** Day #1. Change before launch if you want numbering to start on launch day. */
export const DAILY_EPOCH = '2026-09-24';

/** Today's date in UTC+8 (China / Singapore), so the problem flips at local midnight. */
export function todayKey(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export function dailyNumber(date: string): number {
  return Math.round((Date.parse(date) - Date.parse(DAILY_EPOCH)) / 86_400_000) + 1;
}

export function dailyProblem(date: string): Problem {
  // Slightly harder than default practice: top choices are closer together.
  return generateProblem(rngFromString(`daily-v${GENERATOR_VERSION}-${date}`), {
    ...DEFAULT_OPTIONS,
    shanten: 1,
    minCloseness: 0.7,
  });
}

export function createDaily(): View {
  const el = h('div', { class: 'view' });
  let date = '';
  let problem: Problem;
  let hs: HandState;

  const discard = (t: number, idx: number) => {
    if (hs.answer !== null) return;
    hs.answer = t;
    hs.answerIdx = idx;
    recordDaily(date, formatHand(problem.hand), t, problem.best[0], problem.best.includes(t));
    document.dispatchEvent(new Event('heqie:answered'));
    render();
  };

  const share = () => {
    const ok = problem.best.includes(hs.answer!);
    openShare({
      title: `今日一题 · 第 ${dailyNumber(date)} 期`,
      date,
      level: levelName(problem.analysis.shanten),
      tiles: hs.tiles,
      ok,
      streak: dailyStreak(getStats(), date),
      url: `${location.origin}${location.pathname}#daily`,
    });
  };

  function render() {
    const streak = dailyStreak(getStats(), date);
    const nodes = [
      h(
        'div',
        { class: 'daily-head' },
        h('h2', {}, `今日一题 · 第 ${dailyNumber(date)} 期`),
        h('span', { class: 'muted' }, date),
      ),
      h(
        'section',
        { class: 'table' },
        h('div', { class: 'prompt' }, h('span', {}, `${levelName(problem.analysis.shanten)} · 切哪张？`), hs.answer === null ? h('span', { class: 'session' }, '只有一次机会') : null),
        renderHand(problem, hs, discard),
      ),
      hs.answer === null
        ? h('p', { class: 'hint' }, '每天 0 点（北京/新加坡时间）更新，所有人同一题。纯牌效，只看进张数。')
        : renderResult(
            problem,
            hs.answer,
            h('button', { class: 'btn btn-primary', onclick: share }, '生成分享图'),
            h('a', { class: 'btn', href: '#' }, '去练习 →'),
          ),
      hs.answer !== null && streak > 0 ? h('p', { class: 'hint center' }, `已连续打卡 ${streak} 天，明天见。`) : null,
    ];
    el.replaceChildren(...nodes.filter((n): n is HTMLElement => n !== null));
  }

  return {
    el,
    show() {
      const today = todayKey();
      if (today !== date || !problem) {
        date = today;
        const rec = getStats().daily[date];
        problem = rec ? problemFromHand(parseHand(rec.h)) : dailyProblem(date);
        const tiles = toTiles(problem.hand);
        hs = rec
          ? { tiles, answer: rec.a, answerIdx: tiles.indexOf(rec.a), cursor: -1 }
          : { tiles, answer: null, answerIdx: -1, cursor: -1 };
      }
      render();
    },
  };
}
