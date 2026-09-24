import { createCalc } from './calc';
import { createDaily } from './daily';
import { createFuView } from './fuView';
import { h } from './dom';
import { createPractice, type View } from './practice';
import { openSponsor, sponsorEnabled } from './sponsor';
import { createStatsView } from './statsView';

type Route = 'practice' | 'fu' | 'daily' | 'calc' | 'stats';

const NAV: [Route, string, string][] = [
  ['practice', '何切', '#'],
  ['fu', '符数', '#fu'],
  ['daily', '每日', '#daily'],
  ['calc', '计算', '#calc'],
  ['stats', '统计', '#stats'],
];

function currentRoute(): Route {
  if (location.hash === '#daily') return 'daily';
  if (location.hash === '#stats') return 'stats';
  if (location.hash === '#fu') return 'fu';
  if (location.hash.startsWith('#calc')) return 'calc';
  return 'practice';
}

export function mountApp(root: HTMLElement) {
  const views: Record<Route, View> = {
    practice: createPractice(),
    fu: createFuView(),
    daily: createDaily(),
    calc: createCalc(),
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
      sponsorEnabled ? h('button', { class: 'footer-sponsor', onclick: openSponsor }, '赞助作者') : null,
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
