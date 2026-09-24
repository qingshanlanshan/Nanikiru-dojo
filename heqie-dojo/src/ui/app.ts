import { createDaily } from './daily';
import { h } from './dom';
import { createPractice, type View } from './practice';
import { createStatsView } from './statsView';

type Route = 'practice' | 'daily' | 'stats';

const NAV: [Route, string, string][] = [
  ['practice', '练习', '#'],
  ['daily', '今日一题', '#daily'],
  ['stats', '统计', '#stats'],
];

function currentRoute(): Route {
  if (location.hash === '#daily') return 'daily';
  if (location.hash === '#stats') return 'stats';
  return 'practice';
}

export function mountApp(root: HTMLElement) {
  const views: Record<Route, View> = {
    practice: createPractice(),
    daily: createDaily(),
    stats: createStatsView(),
  };
  const links = NAV.map(([route, label, href]) => h('a', { class: 'nav-link', href, 'data-route': route }, label));

  const main = h('main', {}, ...Object.values(views).map((v) => v.el));
  root.replaceChildren(
    h('header', { class: 'top' }, h('a', { class: 'brand', href: '#' }, '何切道场'), h('nav', {}, ...links)),
    main,
    h(
      'footer',
      {},
      h('span', {}, '纯牌效练习 · 不收集任何数据 · 牌图 CC0 '),
      h('a', { href: 'https://github.com/FluffyStuff/riichi-mahjong-tiles', target: '_blank', rel: 'noopener' }, 'FluffyStuff'),
    ),
  );

  const route = () => {
    const r = currentRoute();
    for (const [name, v] of Object.entries(views)) v.el.hidden = name !== r;
    for (const a of links) a.setAttribute('aria-current', String(a.dataset.route === r));
    views[r].show();
  };
  window.addEventListener('hashchange', route);
  route();
}
