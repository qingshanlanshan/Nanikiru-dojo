// Tile indices: 0-8 = 1-9m, 9-17 = 1-9p, 18-26 = 1-9s, 27-33 = 东南西北白发中 (1-7z).
// A hand is a Counts array of length 34. Red fives are not modelled.

export type Counts = number[];

export const NUM_TILES = 34;
const SUITS = ['m', 'p', 's', 'z'] as const;
const HONOR_NAMES = ['东', '南', '西', '北', '白', '发', '中'];
const SUIT_NAMES = { m: '万', p: '筒', s: '索' } as const;

export function emptyCounts(): Counts {
  return new Array(NUM_TILES).fill(0);
}

export function isHonor(t: number): boolean {
  return t >= 27;
}

export function isTerminalOrHonor(t: number): boolean {
  return t >= 27 || t % 9 === 0 || t % 9 === 8;
}

/** Parse mpsz notation, e.g. "123m456p789s1122z". "0" is accepted as a (non-red) 5. */
export function parseHand(s: string): Counts {
  const c = emptyCounts();
  let pending: number[] = [];
  for (const ch of s.replace(/\s+/g, '')) {
    if (ch >= '0' && ch <= '9') {
      pending.push(ch === '0' ? 5 : Number(ch));
      continue;
    }
    const suit = SUITS.indexOf(ch as (typeof SUITS)[number]);
    if (suit < 0) throw new Error(`bad tile notation: ${s}`);
    for (const n of pending) {
      if (suit === 3 && n > 7) throw new Error(`bad honor: ${n}z`);
      c[suit * 9 + n - 1]++;
    }
    pending = [];
  }
  if (pending.length) throw new Error(`missing suit letter: ${s}`);
  if (c.some((n) => n > 4)) throw new Error(`more than 4 copies: ${s}`);
  return c;
}

export function formatHand(c: Counts): string {
  let out = '';
  for (let suit = 0; suit < 4; suit++) {
    let digits = '';
    for (let i = 0; i < (suit === 3 ? 7 : 9); i++) digits += String(i + 1).repeat(c[suit * 9 + i]);
    if (digits) out += digits + SUITS[suit];
  }
  return out;
}

export function tileCode(t: number): string {
  return `${(t % 9) + 1}${SUITS[Math.floor(t / 9)]}`;
}

export function tileName(t: number): string {
  if (isHonor(t)) return HONOR_NAMES[t - 27];
  const suit = SUITS[Math.floor(t / 9)] as 'm' | 'p' | 's';
  return `${(t % 9) + 1}${SUIT_NAMES[suit]}`;
}

export function tileCount(c: Counts): number {
  return c.reduce((a, b) => a + b, 0);
}

/** Expand counts into a sorted tile list. */
export function toTiles(c: Counts): number[] {
  const out: number[] = [];
  c.forEach((n, t) => {
    for (let i = 0; i < n; i++) out.push(t);
  });
  return out;
}
