import { NUM_TILES, tileCode, tileName } from '../engine/tiles';

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | false | null | undefined;

/** Tiny hyperscript helper: h('div', { class: 'x', onclick: fn }, child...). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

const BASE = import.meta.env.BASE_URL;
const faceUrl = (t: number) => `${BASE}tiles/${tileCode(t)}.svg`;

/** Warm the image cache so re-renders never flash blank tiles. */
export function preloadTiles() {
  for (let t = 0; t < NUM_TILES; t++) new Image().src = faceUrl(t);
}

// Face and tile body are two background layers: backgrounds repaint from cache without
// the blank frame a freshly created <img> can show.
export function tileImg(t: number, cls = 'tile'): HTMLElement {
  const el = h('span', { class: cls, role: 'img', 'aria-label': tileName(t), title: tileName(t) });
  el.style.setProperty('--face', `url("${faceUrl(t)}")`);
  return el;
}
