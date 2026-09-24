import { emptyCounts, isHonor, isTerminalOrHonor, NUM_TILES, type Counts } from './tiles';

// 符 calculation (雀魂/天凤 rules: 连风 pair = 4符) and a generator of winning hands whose
// 符 is unambiguous, i.e. every way of reading the hand gives the same 符.

export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan';

export interface Meld {
  kind: MeldKind;
  /** Tile indices; 3 for chi/pon, 4 for kan. */
  tiles: number[];
}

export interface WinHand {
  /** Concealed tiles, including the winning tile. */
  closed: Counts;
  melds: Meld[];
  win: number;
  tsumo: boolean;
  /** 27 = 东 … 30 = 北 */
  roundWind: number;
  seatWind: number;
}

export interface FuItem {
  label: string;
  fu: number;
}

export interface FuResult {
  items: FuItem[];
  /** Sum before rounding (or the fixed value for special cases). */
  raw: number;
  total: number;
  /** Explanation for fixed-value cases (平和自摸, 七对子, 副露平和形). */
  note: string | null;
  pinfu: boolean;
}

type Wait = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki';
type Block = { kind: 'shuntsu' | 'koutsu'; t: number };

const WAIT_LABEL: Record<Wait, string> = {
  ryanmen: '两面',
  kanchan: '嵌张',
  penchan: '边张',
  shanpon: '双碰',
  tanki: '单骑',
};

const WIND_NAMES = ['东', '南', '西', '北'];
export const windName = (t: number) => WIND_NAMES[t - 27];
const SUIT = ['万', '筒', '索'];
const tname = (t: number) => (isHonor(t) ? ['东', '南', '西', '北', '白', '发', '中'][t - 27] : `${(t % 9) + 1}${SUIT[Math.floor(t / 9)]}`);

export const isMenzen = (h: WinHand) => h.melds.every((m) => m.kind === 'ankan');

/** All ways to split `c` into mentsu + one pair. */
function decompositions(c: Counts): { pair: number; blocks: Block[] }[] {
  const out: { pair: number; blocks: Block[] }[] = [];
  const rec = (blocks: Block[], pair: number) => {
    const i = c.findIndex((n) => n > 0);
    if (i < 0) return void out.push({ pair, blocks: blocks.slice() });
    if (c[i] >= 3) {
      c[i] -= 3;
      blocks.push({ kind: 'koutsu', t: i });
      rec(blocks, pair);
      blocks.pop();
      c[i] += 3;
    }
    if (!isHonor(i) && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      blocks.push({ kind: 'shuntsu', t: i });
      rec(blocks, pair);
      blocks.pop();
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
  };
  for (let p = 0; p < NUM_TILES; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    rec([], p);
    c[p] += 2;
  }
  return out;
}

export function isChiitoi(h: WinHand): boolean {
  return h.melds.length === 0 && h.closed.filter((n) => n === 2).length === 7;
}

const koutsuFu = (t: number, open: boolean, kan: boolean) => (isTerminalOrHonor(t) ? 4 : 2) * (open ? 1 : 2) * (kan ? 4 : 1);

function pairFu(h: WinHand, p: number): FuItem[] {
  if (p >= 31) return [{ label: `雀头 ${tname(p)}（三元牌）`, fu: 2 }];
  const round = p === h.roundWind;
  const seat = p === h.seatWind;
  if (round && seat) return [{ label: `雀头 ${tname(p)}（连风牌）`, fu: 4 }];
  if (round) return [{ label: `雀头 ${tname(p)}（场风）`, fu: 2 }];
  if (seat) return [{ label: `雀头 ${tname(p)}（自风）`, fu: 2 }];
  return [];
}

const roundUp = (n: number) => Math.ceil(n / 10) * 10;

function fuFor(h: WinHand, pair: number, blocks: Block[], waitIdx: number, wait: Wait): FuResult {
  const menzen = isMenzen(h);
  const yakuhaiPair = pair >= 31 || pair === h.roundWind || pair === h.seatWind;
  const pinfu = menzen && h.melds.length === 0 && blocks.every((b) => b.kind === 'shuntsu') && !yakuhaiPair && wait === 'ryanmen';
  if (pinfu) {
    return h.tsumo
      ? { items: [{ label: '底符', fu: 20 }], raw: 20, total: 20, note: '平和自摸固定 20 符（不加自摸符）', pinfu }
      : { items: [{ label: '底符', fu: 20 }, { label: '门清荣和', fu: 10 }], raw: 30, total: 30, note: '平和荣和固定 30 符', pinfu };
  }

  const items: FuItem[] = [{ label: '底符', fu: 20 }];
  if (menzen && !h.tsumo) items.push({ label: '门清荣和', fu: 10 });
  if (h.tsumo) items.push({ label: '自摸', fu: 2 });
  blocks.forEach((b, i) => {
    if (b.kind !== 'koutsu') return;
    // A triplet completed by ron counts as open.
    const open = !h.tsumo && i === waitIdx && wait === 'shanpon';
    const kind = isTerminalOrHonor(b.t) ? '幺九' : '中张';
    items.push({ label: `${open ? '明刻' : '暗刻'} ${tname(b.t)}${open ? '（荣和成刻算明刻）' : ''} · ${kind}`, fu: koutsuFu(b.t, open, false) });
  });
  for (const m of h.melds) {
    if (m.kind === 'chi') continue;
    const t = m.tiles[0];
    const kind = isTerminalOrHonor(t) ? '幺九' : '中张';
    const label = { pon: '明刻', minkan: '明杠', ankan: '暗杠' }[m.kind];
    items.push({ label: `${label} ${tname(t)} · ${kind}`, fu: koutsuFu(t, m.kind !== 'ankan', m.kind !== 'pon') });
  }
  items.push(...pairFu(h, pair));
  if (wait === 'kanchan' || wait === 'penchan' || wait === 'tanki') items.push({ label: `听牌：${WAIT_LABEL[wait]}`, fu: 2 });

  const raw = items.reduce((s, x) => s + x.fu, 0);
  if (!menzen && raw === 20) {
    return { items, raw, total: 30, note: '副露且没有任何加符（副露平和形），荣和按 30 符计', pinfu };
  }
  return { items, raw, total: roundUp(raw), note: null, pinfu };
}

/** Every reading of the hand (decomposition x which block the winning tile completed). */
export function readings(h: WinHand): FuResult[] {
  const out: FuResult[] = [];
  // 两杯口 shapes are also seven pairs: both readings are returned, so it counts as ambiguous.
  if (isChiitoi(h)) {
    out.push({ items: [{ label: '七对子', fu: 25 }], raw: 25, total: 25, note: '七对子固定 25 符（不进位）', pinfu: false });
  }
  const c = h.closed.slice();
  for (const d of decompositions(c)) {
    if (d.pair === h.win) out.push(fuFor(h, d.pair, d.blocks, -1, 'tanki'));
    d.blocks.forEach((b, i) => {
      if (b.kind === 'koutsu') {
        if (b.t === h.win) out.push(fuFor(h, d.pair, d.blocks, i, 'shanpon'));
        return;
      }
      const pos = h.win - b.t;
      if (pos < 0 || pos > 2) return;
      const r = b.t % 9;
      const wait: Wait = pos === 1 ? 'kanchan' : (pos === 2 && r === 0) || (pos === 0 && r === 6) ? 'penchan' : 'ryanmen';
      out.push(fuFor(h, d.pair, d.blocks, i, wait));
    });
  }
  return out;
}

/** The 符 if every reading agrees, else null (ambiguous: the answer would depend on 役). */
export function uniqueFu(h: WinHand): FuResult | null {
  const rs = readings(h);
  if (!rs.length) return null;
  const first = rs[0];
  return rs.every((r) => r.total === first.total && r.pinfu === first.pinfu) ? first : null;
}

/** Tiles of the whole hand (closed + melds). */
export function allTiles(h: WinHand): Counts {
  const c = h.closed.slice();
  for (const m of h.melds) for (const t of m.tiles) c[t]++;
  return c;
}

/** Open hands need a 役 we can see from the shape alone; closed hands can always riichi. */
export function hasYaku(h: WinHand): boolean {
  if (isMenzen(h)) return true;
  const all = allTiles(h);
  const tiles = all.flatMap((n, t) => Array<number>(n).fill(t));
  if (tiles.every((t) => !isTerminalOrHonor(t))) return true; // 断幺九
  const yakuhai = (t: number) => t >= 31 || t === h.roundWind || t === h.seatWind;
  if (h.melds.some((m) => m.kind !== 'chi' && yakuhai(m.tiles[0]))) return true;
  if (h.closed.some((n, t) => n >= 3 && yakuhai(t))) return true;
  const suits = new Set(tiles.filter((t) => !isHonor(t)).map((t) => Math.floor(t / 9)));
  if (suits.size <= 1) return true; // 混一色 / 清一色 / 字一色
  const d = decompositions(h.closed.slice());
  if (h.melds.every((m) => m.kind !== 'chi') && d.some((x) => x.blocks.every((b) => b.kind === 'koutsu'))) return true; // 对对和
  return false;
}

// ---------------------------------------------------------------- generator

type Rng = () => number;
const pick = <T>(rng: Rng, xs: T[]) => xs[Math.floor(rng() * xs.length)];

export const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

export interface FuProblem {
  hand: WinHand;
  fu: FuResult;
}

const winds = (rng: Rng) => ({ roundWind: pick(rng, [27, 27, 28]), seatWind: 27 + Math.floor(rng() * 4) });

function tryChiitoi(rng: Rng): WinHand {
  const kinds = new Set<number>();
  while (kinds.size < 7) kinds.add(Math.floor(rng() * NUM_TILES));
  const closed = emptyCounts();
  for (const t of kinds) closed[t] = 2;
  return { closed, melds: [], win: pick(rng, [...kinds]), tsumo: rng() < 0.4, ...winds(rng) };
}

function tryGenerate(rng: Rng): WinHand | null {
  const r0 = rng();
  if (r0 < 0.06) return tryChiitoi(rng);
  // 平和 shapes (closed, all sequences, number pair) are the key 20/30符 cases; make them common.
  const pinfuShape = r0 < 0.18;
  const used = emptyCounts();
  const take = (ts: number[]) => {
    for (const t of ts) used[t]++;
    return ts.every((t) => used[t] <= 4);
  };
  type M = { kind: 'shuntsu' | 'koutsu' | 'kan'; tiles: number[] };
  const ms: M[] = [];
  for (let i = 0; i < 4; i++) {
    const r = pinfuShape ? 0 : rng();
    if (r < 0.5) {
      const s = Math.floor(rng() * 3) * 9 + Math.floor(rng() * 7);
      ms.push({ kind: 'shuntsu', tiles: [s, s + 1, s + 2] });
    } else {
      const t = Math.floor(rng() * NUM_TILES);
      ms.push(r < 0.9 ? { kind: 'koutsu', tiles: [t, t, t] } : { kind: 'kan', tiles: [t, t, t, t] });
    }
    if (!take(ms[i].tiles)) return null;
  }
  const pair = Math.floor(rng() * (pinfuShape ? 27 : NUM_TILES));
  if (!take([pair, pair])) return null;

  // Decide which sets are called; kans that stay concealed are 暗杠.
  const openCount = pinfuShape ? 0 : pick(rng, [0, 0, 0, 0, 0, 1, 1, 2, 2, 3]);
  const order = [0, 1, 2, 3].sort(() => rng() - 0.5);
  const openIdx = new Set(order.slice(0, openCount));
  const melds: Meld[] = [];
  const closed = emptyCounts();
  ms.forEach((m, i) => {
    if (m.kind === 'kan') melds.push({ kind: openIdx.has(i) ? 'minkan' : 'ankan', tiles: m.tiles });
    else if (openIdx.has(i)) melds.push({ kind: m.kind === 'shuntsu' ? 'chi' : 'pon', tiles: m.tiles });
    else for (const t of m.tiles) closed[t]++;
  });
  closed[pair] += 2;

  const closedTiles = closed.flatMap((n, t) => Array<number>(n).fill(t));
  return { closed, melds, win: pick(rng, closedTiles), tsumo: rng() < 0.4, ...winds(rng) };
}

export function generateFuProblem(rng: Rng, maxTries = 50_000): FuProblem {
  for (let i = 0; i < maxTries; i++) {
    const hand = tryGenerate(rng);
    if (!hand || !hasYaku(hand)) continue;
    const fu = uniqueFu(hand);
    if (!fu || fu.total > 110) continue;
    // Plain 30符 hands are the most common; thin them so practice covers more cases.
    if (fu.total === 30 && !fu.note && rng() < 0.5) continue;
    return { hand, fu };
  }
  throw new Error('generateFuProblem: no hand found');
}
