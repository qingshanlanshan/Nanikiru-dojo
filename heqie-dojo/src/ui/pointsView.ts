import { derivation, generateScoreCase, isPossible, limitFor, payment, type ScoreCase } from '../engine/points';
import { h } from './dom';
import type { View } from './practice';
import { recordDrill } from './stats';

// 点数练习: given 番/符, seat and ron/tsumo, type the payment.

const fmt = (c: ScoreCase) => (limitFor(c.han) ? `${c.han}番` : `${c.han}番 ${c.fu}符`);

function expected(c: ScoreCase): number[] {
  const p = payment(c);
  if (p.ron !== null) return [p.ron];
  if (p.all !== null) return [p.all];
  return [p.ko!, p.oya!];
}

const answerText = (c: ScoreCase) => {
  const p = payment(c);
  if (p.ron !== null) return `${p.ron}`;
  if (p.all !== null) return `${p.all} ALL（每家）`;
  return `${p.ko} / ${p.oya}`;
};

/** 子家荣和 reference table for 1–4番, the part people actually have to memorize. */
function cheatSheet(): HTMLElement {
  const fus = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  const cell = (han: number, fu: number, dealer: boolean) => {
    const tsumo = fu === 20;
    const c: ScoreCase = { han, fu, dealer, tsumo };
    if (!isPossible(c)) return '—';
    const p = payment(c);
    if (p.limit) return '满贯';
    return tsumo ? (dealer ? `${p.all}∀` : `${p.ko}/${p.oya}`) : String(p.ron);
  };
  const table = (dealer: boolean) =>
    h(
      'table',
      { class: 'cheat' },
      h('thead', {}, h('tr', {}, h('th', {}, '符'), ...[1, 2, 3, 4].map((n) => h('th', {}, `${n}番`)))),
      h('tbody', {}, ...fus.map((fu) => h('tr', {}, h('th', {}, String(fu)), ...[1, 2, 3, 4].map((han) => h('td', {}, cell(han, fu, dealer)))))),
    );
  return h(
    'details',
    { class: 'back cheat-wrap' },
    h('summary', {}, '点数速查表'),
    h('p', { class: 'muted small' }, '荣和点数；20符行是自摸（子/亲，∀ = 每家）。5番以上：满贯 8000 / 跳满 12000 / 倍满 16000 / 三倍满 24000 / 役满 32000（亲家 ×1.5）。'),
    h('div', { class: 'cheat-grid' }, h('div', {}, h('h4', {}, '子家'), table(false)), h('div', {}, h('h4', {}, '亲家'), table(true))),
  );
}

export function createPointsView(): View {
  const el = h('div', { class: 'view points' });
  let c: ScoreCase = generateScoreCase(Math.random);
  let given: number[] | null = null;
  const session = { total: 0, correct: 0, streak: 0 };

  const next = () => {
    c = generateScoreCase(Math.random);
    given = null;
    render();
  };

  const submit = (inputs: HTMLInputElement[]) => {
    if (given !== null) return;
    const vals = inputs.map((i) => Number(i.value.replace(/[^0-9]/g, '')));
    if (vals.some((v) => !v)) {
      inputs.find((i) => !Number(i.value.replace(/[^0-9]/g, '')))?.focus();
      return;
    }
    given = vals;
    const ok = expected(c).every((v, i) => v === vals[i]);
    session.total++;
    if (ok) session.correct++, session.streak++;
    else session.streak = 0;
    recordDrill('pts', ok);
    document.dispatchEvent(new Event('heqie:answered'));
    render();
  };

  document.addEventListener('keydown', (e) => {
    if (el.hidden || !el.isConnected || given === null || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest?.('input')) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'n') {
      e.preventDefault();
      next();
    }
  });

  function renderForm() {
    const p = payment(c);
    const labels = p.ron !== null ? ['荣和点数'] : p.all !== null ? ['每家付'] : ['子家付', '亲家付'];
    const inputs = labels.map((label) =>
      h('input', { class: 'calc-input pts-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': label, placeholder: label }),
    );
    inputs.forEach((inp, i) =>
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        // Otherwise the same keypress reaches the page-level "Enter = next" shortcut and
        // skips the problem right after submitting it.
        e.stopPropagation();
        if (i < inputs.length - 1 && !inp.value) return;
        if (i < inputs.length - 1 && !inputs[i + 1].value) inputs[i + 1].focus();
        else submit(inputs);
      }),
    );
    const form = h(
      'div',
      { class: 'pts-form' },
      ...labels.map((label, i) => h('label', { class: 'pts-field' }, h('span', {}, label), inputs[i])),
      h('button', { class: 'btn btn-primary', onclick: () => submit(inputs) }, '确定'),
    );
    return { form, first: inputs[0] };
  }

  function renderResult() {
    const exp = expected(c);
    const ok = exp.every((v, i) => v === given![i]);
    return h(
      'section',
      { class: `result ${ok ? 'ok' : 'ng'}`, 'aria-live': 'polite' },
      h('p', { class: 'verdict' }, ok ? `正确！${answerText(c)}` : `你填了 ${given!.join(' / ')}，正确是 ${answerText(c)}`),
      h('ol', { class: 'pts-steps' }, ...derivation(c, payment(c)).map((s) => h('li', {}, s))),
      h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary next', onclick: next }, '下一题 →')),
    );
  }

  function render() {
    const who = c.dealer ? '亲家' : '子家';
    const how = c.tsumo ? '自摸' : '荣和';
    const { form, first } = renderForm();
    el.replaceChildren(
      h(
        'div',
        { class: 'daily-head' },
        h('h2', {}, '点数练习'),
        h('span', { class: 'muted small' }, session.total ? `本次 ${session.correct}/${session.total}${session.streak >= 2 ? ` · 连对 ${session.streak}` : ''}` : '无切上满贯（雀魂/天凤）'),
      ),
      h(
        'section',
        { class: 'table pts-card' },
        h('div', { class: 'pts-hanfu' }, fmt(c)),
        h('div', { class: 'pts-who' }, `${who} · ${how}`),
      ),
      given === null ? form : renderResult(),
      h('div', { class: 'pts-more' }, cheatSheet()),
    );
    if (given === null && !el.hidden) first.focus({ preventScroll: true });
    else (el.querySelector('.next') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }

  return { el, show: render };
}
