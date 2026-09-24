import { analyzeDiscards, bestDiscards, ukeire } from '../engine/analyze';
import { blockView, explain } from '../engine/explain';
import type { Problem } from '../engine/generator';
import { shanten, shantenChiitoi, shantenKokushi, shantenStandard, type Forms } from '../engine/shanten';
import { emptyCounts, formatHand, parseHand, tileName, toTiles, type Counts } from '../engine/tiles';
import { h, tileImg } from './dom';
import type { View } from './practice';
import { levelName, renderBlocks, renderDiscardTable } from './problemView';
import { load, save } from './storage';

// 牌理计算器: enter a closed 13- or 14-tile hand, get shanten, ukeire and the best discard.

const MAX = 14;
const PALETTE: [string, number, number][] = [
  ['万', 0, 9],
  ['筒', 9, 9],
  ['索', 18, 9],
  ['字', 27, 7],
];

function handFromHash(): number[] | null {
  const m = location.hash.match(/^#calc=([0-9mpsz]*)$/);
  if (!m) return null;
  try {
    const c = parseHand(m[1]);
    const tiles = toTiles(c);
    return tiles.length <= MAX ? tiles : null;
  } catch {
    return null;
  }
}

const countsOf = (tiles: number[]): Counts => {
  const c = emptyCounts();
  for (const t of tiles) c[t]++;
  return c;
};

/** Standard form decides the shanten, so the block view means something. */
const standardRelevant = (c: Counts, forms: Forms) => {
  if (forms === 'standard') return true;
  const s = shantenStandard(c);
  return s < shantenChiitoi(c) && s < shantenKokushi(c);
};

export function createCalc(): View {
  const el = h('div', { class: 'view calc' });
  // Entry order, so 退格 removes the last tile added.
  let tiles: number[] = [];
  let forms: Forms = load<Forms>('calcForms', 'all') === 'standard' ? 'standard' : 'all';
  let textError = '';

  const counts = () => countsOf(tiles);
  const setHash = () => history.replaceState(null, '', `#calc=${formatHand(counts())}`);
  const update = () => {
    setHash();
    render();
  };

  const add = (t: number) => {
    if (tiles.length >= MAX || counts()[t] >= 4) return;
    tiles.push(t);
    textError = '';
    update();
  };
  const removeAt = (t: number) => {
    const i = tiles.lastIndexOf(t);
    if (i >= 0) tiles.splice(i, 1);
    update();
  };

  const onText = (value: string) => {
    const v = value.trim();
    if (!v) {
      tiles = [];
      textError = '';
      return update();
    }
    // Mid-typing ("123m45"): wait for the suit letter instead of flashing an error.
    if (/[0-9]$/.test(v)) {
      textError = '';
      return;
    }
    try {
      const c = parseHand(v);
      const next = toTiles(c);
      if (next.length > MAX) throw new Error();
      tiles = next;
      textError = '';
    } catch {
      textError = '格式：数字 + m/p/s/z，例如 123m456p789s1122z（最多 14 张，每种最多 4 张）';
    }
    setHash();
    renderResultOnly();
  };

  const input = h('input', {
    class: 'calc-input',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: '输入手牌，如 123m456p789s1122z',
    'aria-label': '手牌（mpsz 格式）',
  });
  input.addEventListener('input', () => onText(input.value));

  const handBox = h('div', { class: 'calc-hand' });
  const paletteBox = h('div', { class: 'palette' });
  const resultBox = h('div', { class: 'calc-result', 'aria-live': 'polite' });
  const errorBox = h('p', { class: 'calc-error' });

  function renderHand() {
    const c = counts();
    const sorted = toTiles(c);
    handBox.replaceChildren(
      ...sorted.map((t) => h('button', { class: 'tile-btn', 'aria-label': `移除${tileName(t)}`, onclick: () => removeAt(t) }, tileImg(t))),
      ...Array.from({ length: MAX - sorted.length }, () => h('span', { class: 'tile tile-empty', 'aria-hidden': 'true' })),
    );
    paletteBox.replaceChildren(
      ...PALETTE.map(([name, start, n]) =>
        h(
          'div',
          { class: 'palette-row', role: 'group', 'aria-label': name },
          ...Array.from({ length: n }, (_, i) => {
            const t = start + i;
            return h(
              'button',
              { class: 'tile-btn', 'aria-label': `加入${tileName(t)}`, disabled: c[t] >= 4 || sorted.length >= MAX, onclick: () => add(t) },
              tileImg(t),
            );
          }),
        ),
      ),
    );
  }

  function renderResultOnly() {
    errorBox.textContent = textError;
    renderHand();
    resultBox.replaceChildren(...analysisNodes(counts(), forms));
  }

  function render() {
    input.value = formatHand(counts());
    renderResultOnly();
  }

  el.append(
    h('div', { class: 'calc-head' }, h('h2', {}, '牌理计算器'), h('span', { class: 'muted small' }, '门清手牌 13 或 14 张')),
    h('section', { class: 'table calc-table' }, handBox),
    h(
      'div',
      { class: 'calc-controls' },
      input,
      errorBox,
      h(
        'div',
        { class: 'calc-buttons' },
        h('button', { class: 'btn', onclick: () => (tiles.pop(), update()) }, '退格'),
        h('button', { class: 'btn', onclick: () => ((tiles = []), update()) }, '清空'),
        (() => {
          const cb = h('input', { type: 'checkbox', checked: forms === 'all' });
          cb.addEventListener('change', () => {
            forms = cb.checked ? 'all' : 'standard';
            save('calcForms', forms);
            render();
          });
          return h('label', { class: 'calc-toggle' }, cb, '含七对子·国士');
        })(),
      ),
      paletteBox,
    ),
    resultBox,
  );

  return {
    el,
    show() {
      const linked = handFromHash();
      if (linked) tiles = linked;
      update();
    },
  };
}

function formsLine(c: Counts): HTMLElement {
  return h(
    'p',
    { class: 'muted small forms-line' },
    `一般形 ${fmt(shantenStandard(c))} · 七对子 ${fmt(shantenChiitoi(c))} · 国士 ${fmt(shantenKokushi(c))}`,
  );
}

const fmt = (s: number) => (s < 0 ? '和了' : s === 0 ? '听牌' : `${s}向听`);

function analysisNodes(c: Counts, forms: Forms): HTMLElement[] {
  const n = c.reduce((a, b) => a + b, 0);
  if (n !== 13 && n !== 14) {
    return [h('p', { class: 'hint' }, n < 13 ? `还差 ${13 - n} 张（13 张看进张，14 张看切哪张）。` : '')];
  }
  const s = shanten(c, forms);
  if (n === 14 && s < 0) return [h('p', { class: 'calc-title ok-text' }, '和了！'), formsLine(c)];

  if (n === 13) {
    const u = ukeire(c.slice(), c, forms, s);
    const title = s === 0 ? `听牌 · 等 ${u.waits.map(tileName).join('、')}（${u.total} 枚）` : `${levelName(s)} · 进张 ${u.total} 枚（${u.waits.length} 种）`;
    return [
      h('p', { class: 'calc-title' }, title),
      formsLine(c),
      h(
        'div',
        { class: 'waits' },
        ...u.waits.map((w) => h('div', { class: 'wait' }, tileImg(w, 'tile tile-sm'), h('span', {}, `${4 - c[w]}枚`))),
      ),
      standardRelevant(c, forms) ? renderBlocks(blockView(c)) : h('p', { class: 'hint' }, '此手按七对子/国士计算。'),
    ];
  }

  // 14 tiles: which one to cut.
  const analysis = analyzeDiscards(c, forms);
  const best = bestDiscards(analysis);
  const p: Problem = { hand: c, analysis, best, closeness: 0 };
  const top = analysis.discards[0];
  const title =
    `${levelName(analysis.shanten)} · 最优 打${best.map(tileName).join(' / ')}` + `（${top.ukeire} 枚）`;
  const nodes: HTMLElement[] = [h('p', { class: 'calc-title' }, title), formsLine(c)];
  if (standardRelevant(c, forms)) {
    const ex = explain(p, best[0]);
    nodes.push(renderBlocks(ex.blocks), h('p', { class: 'reason' }, h('span', { class: 'reason-tag' }, '思路'), ex.reason));
  } else {
    nodes.push(h('p', { class: 'hint' }, '此手按七对子/国士计算，不显示搭子拆解。'));
  }
  nodes.push(renderDiscardTable(p, null));
  return nodes;
}
