import { FU_CHOICES, generateFuProblem, windName, type FuProblem, type MeldKind } from '../engine/fu';
import { tileName, toTiles } from '../engine/tiles';
import { h, tileImg } from './dom';
import type { View } from './practice';
import { recordDrill } from './stats';

const MELD_LABEL: Record<MeldKind, string> = { chi: '吃', pon: '碰', minkan: '明杠', ankan: '暗杠' };

export function createFuView(): View {
  const el = h('div', { class: 'view fu' });
  let problem: FuProblem = generateFuProblem(Math.random);
  let answer: number | null = null;
  const session = { total: 0, correct: 0, streak: 0 };

  const next = () => {
    problem = generateFuProblem(Math.random);
    answer = null;
    render();
  };

  const choose = (v: number) => {
    if (answer !== null) return;
    answer = v;
    const ok = v === problem.fu.total;
    session.total++;
    if (ok) session.correct++, session.streak++;
    else session.streak = 0;
    recordDrill('fu', ok);
    document.dispatchEvent(new Event('heqie:answered'));
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (el.hidden || !el.isConnected || answer === null || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'n') {
      e.preventDefault();
      next();
    }
  });

  function renderHand() {
    const { hand } = problem;
    const closed = toTiles(hand.closed);
    closed.splice(closed.indexOf(hand.win), 1);
    return h(
      'div',
      { class: 'fu-hand' },
      h(
        'div',
        { class: 'fu-row' },
        h('div', { class: 'fu-group' }, h('div', { class: 'block-tiles' }, ...closed.map((t) => tileImg(t))), h('div', { class: 'fu-cap' }, '手牌')),
        h(
          'div',
          { class: 'fu-group fu-win' },
          h('div', { class: 'block-tiles' }, tileImg(hand.win)),
          h('div', { class: 'fu-cap' }, hand.tsumo ? '自摸' : '荣和'),
        ),
      ),
      hand.melds.length
        ? h(
            'div',
            { class: 'fu-row fu-melds' },
            ...hand.melds.map((m) =>
              h('div', { class: 'fu-group' }, h('div', { class: 'block-tiles' }, ...m.tiles.map((t) => tileImg(t))), h('div', { class: 'fu-cap' }, MELD_LABEL[m.kind])),
            ),
          )
        : null,
    );
  }

  function renderResult() {
    const { fu } = problem;
    const ok = answer === fu.total;
    const sum = fu.items.reduce((s, x) => s + x.fu, 0);
    return h(
      'section',
      { class: `result ${ok ? 'ok' : 'ng'}`, 'aria-live': 'polite' },
      h('p', { class: 'verdict' }, ok ? `正确！${fu.total} 符` : `你选了 ${answer} 符，正确是 ${fu.total} 符`),
      h(
        'table',
        { class: 'fu-table' },
        h('tbody', {}, ...fu.items.map((x) => h('tr', {}, h('td', {}, x.label), h('td', { class: 'fu-num' }, `+${x.fu}`)))),
        h(
          'tfoot',
          {},
          h(
            'tr',
            {},
            h('td', {}, fu.note ?? (sum === fu.total ? '合计' : `合计 ${sum}，个位进位`)),
            h('td', { class: 'fu-num' }, `${fu.total} 符`),
          ),
        ),
      ),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary next', onclick: next }, '下一题 →')),
    );
  }

  function render() {
    const { hand } = problem;
    const context = `${windName(hand.roundWind)}场 · 自风 ${windName(hand.seatWind)} · ${hand.tsumo ? '自摸' : '荣和'} ${tileName(hand.win)}`;
    el.replaceChildren(
      h(
        'div',
        { class: 'daily-head' },
        h('h2', {}, '符数练习'),
        h('span', { class: 'muted small' }, session.total ? `本次 ${session.correct}/${session.total}${session.streak >= 2 ? ` · 连对 ${session.streak}` : ''}` : '连风雀头按 4 符（雀魂/天凤）'),
      ),
      h('section', { class: 'table' }, h('div', { class: 'prompt' }, h('span', {}, context), h('span', {}, '几符？')), renderHand()),
      h(
        'div',
        { class: 'fu-choices', role: 'group', 'aria-label': '选择符数' },
        ...FU_CHOICES.map((v) => {
          const cls = ['btn', 'fu-choice'];
          if (answer !== null && v === problem.fu.total) cls.push('is-best');
          if (answer === v && v !== problem.fu.total) cls.push('is-wrong');
          return h('button', { class: cls.join(' '), disabled: answer !== null, onclick: () => choose(v) }, String(v));
        }),
      ),
      answer === null ? h('p', { class: 'hint' }, '只算符，不算番。门清荣和时默认已立直，副露手保证有役。') : renderResult(),
    );
    if (answer !== null) (el.querySelector('.next') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  return { el, show: render };
}
