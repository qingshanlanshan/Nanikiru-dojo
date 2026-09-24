import { parseHand, tileName, toTiles } from '../engine/tiles';
import { todayKey } from './daily';
import { h, tileImg } from './dom';
import type { View } from './practice';
import { levelName } from './problemView';
import { openSponsor, sponsorEnabled } from './sponsor';
import { clearStats, dailyStreak, getStats } from './stats';

export function createStatsView(): View {
  const el = h('div', { class: 'view stats' });

  function render() {
    const s = getStats();
    const levels = [1, 2, 3].map((lv) => ({ lv, ...(s.levels[lv] ?? { n: 0, c: 0 }) }));
    const n = levels.reduce((a, b) => a + b.n, 0);
    const c = levels.reduce((a, b) => a + b.c, 0);
    const pct = (c: number, n: number) => (n ? `${Math.round((100 * c) / n)}%` : '—');
    const dailyDays = Object.keys(s.daily).length;

    const tile = (value: string, label: string) =>
      h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label));

    el.replaceChildren(
      h(
        'div',
        { class: 'stat-row' },
        tile(String(n), '练习题数'),
        tile(pct(c, n), '正确率'),
        tile(String(dailyStreak(s, todayKey())), '每日连续'),
      ),
      h(
        'table',
        { class: 'level-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '难度'), h('th', {}, '题数'), h('th', {}, '正确率'))),
        h(
          'tbody',
          {},
          ...levels.map((l) => h('tr', {}, h('td', {}, levelName(l.lv)), h('td', {}, String(l.n)), h('td', {}, pct(l.c, l.n)))),
          h('tr', {}, h('td', {}, '符数'), h('td', {}, String(s.levels.fu?.n ?? 0)), h('td', {}, pct(s.levels.fu?.c ?? 0, s.levels.fu?.n ?? 0))),
          h('tr', {}, h('td', {}, '今日一题'), h('td', {}, String(dailyDays)), h('td', {}, pct(Object.values(s.daily).filter((d) => d.ok).length, dailyDays))),
        ),
      ),
      h('h3', {}, `错题本（${s.mistakes.length}）`),
      s.mistakes.length
        ? h(
            'ul',
            { class: 'mistakes' },
            ...s.mistakes.slice(0, 30).map((m) => {
              let tiles: number[];
              try {
                tiles = toTiles(parseHand(m.h));
              } catch {
                return null as unknown as HTMLElement;
              }
              return h(
                'li',
                {},
                h('a', { href: `#h=${m.h}`, class: 'mistake' },
                  h('div', { class: 'mistake-hand' }, ...tiles.map((t) => tileImg(t, 'tile tile-xs'))),
                  h('div', { class: 'mistake-meta' }, `你切 ${tileName(m.a)} · 最优 ${tileName(m.b)} · 点击重做`),
                ),
              );
            }).filter(Boolean),
          )
        : h('p', { class: 'hint' }, '还没有错题。答错的题会自动收进这里。'),
      sponsorEnabled && n >= 20
        ? h(
            'div',
            { class: 'sponsor-card' },
            h('span', {}, `已经练了 ${n} 题。觉得有用的话，可以请作者喝杯奶茶。`),
            h('button', { class: 'btn', onclick: openSponsor }, '赞助'),
          )
        : '',
      h('p', { class: 'hint small' }, '记录只保存在本机浏览器，不上传任何数据。'),
      h('button', {
        class: 'btn btn-quiet',
        onclick: () => {
          if (confirm('清除所有练习记录和错题？')) {
            clearStats();
            render();
          }
        },
      }, '清除记录'),
    );
  }

  return { el, show: render };
}
