import { h } from './dom';
import { createFuView } from './fuView';
import { createPointsView } from './pointsView';
import type { View } from './practice';

// 算分 tab: 符数 and 点数 drills behind one switch (#fu / #pts).

export function createScoreView(): View {
  const fu = createFuView();
  const pts = createPointsView();
  const tabs: [string, string, View][] = [
    ['#fu', '符数', fu],
    ['#pts', '点数', pts],
  ];
  const buttons = tabs.map(([hash, label]) =>
    h('button', { class: 'level', role: 'tab', onclick: () => (location.hash = hash) }, label),
  );
  const el = h('div', { class: 'view' }, h('div', { class: 'levels', role: 'tablist' }, ...buttons), fu.el, pts.el);

  return {
    el,
    show() {
      const active = location.hash === '#pts' ? 1 : 0;
      tabs.forEach(([, , v], i) => {
        v.el.hidden = i !== active;
        buttons[i].setAttribute('aria-selected', String(i === active));
      });
      tabs[active][2].show();
    },
  };
}
