// 点数 from 番 + 符 (雀魂/天凤 rules: no 切上满贯, 累计役满 at 13番). Honba/riichi sticks ignored.

export interface ScoreCase {
  han: number;
  fu: number;
  dealer: boolean;
  tsumo: boolean;
}

export interface Payment {
  /** Basic points (基本点) after limits. */
  base: number;
  /** Limit name when capped (满贯, 跳满…), else null. */
  limit: string | null;
  /** Ron: what the discarder pays. */
  ron: number | null;
  /** Non-dealer tsumo: each non-dealer pays `ko`, the dealer pays `oya`. */
  ko: number | null;
  oya: number | null;
  /** Dealer tsumo: each player pays. */
  all: number | null;
  /** Total the winner receives. */
  total: number;
}

const ceil100 = (n: number) => Math.ceil(n / 100) * 100;

export function limitFor(han: number): { name: string; base: number } | null {
  if (han >= 13) return { name: '役满（累计役满）', base: 8000 };
  if (han >= 11) return { name: '三倍满', base: 6000 };
  if (han >= 8) return { name: '倍满', base: 4000 };
  if (han >= 6) return { name: '跳满', base: 3000 };
  if (han >= 5) return { name: '满贯', base: 2000 };
  return null;
}

export function payment(c: ScoreCase): Payment {
  const lim = limitFor(c.han);
  let base: number;
  let limit: string | null = null;
  if (lim) {
    base = lim.base;
    limit = lim.name;
  } else {
    base = c.fu * 2 ** (c.han + 2);
    if (base > 2000) {
      base = 2000;
      limit = '满贯';
    }
  }
  if (!c.tsumo) {
    const ron = ceil100(base * (c.dealer ? 6 : 4));
    return { base, limit, ron, ko: null, oya: null, all: null, total: ron };
  }
  if (c.dealer) {
    const all = ceil100(base * 2);
    return { base, limit, ron: null, ko: null, oya: null, all, total: all * 3 };
  }
  const ko = ceil100(base);
  const oya = ceil100(base * 2);
  return { base, limit, ron: null, ko, oya, all: null, total: ko * 2 + oya };
}

/** Whether a 番/符 combination can occur (e.g. 20符 is 平和自摸 only, 25符 is 七对子). */
export function isPossible(c: ScoreCase): boolean {
  if (c.han >= 5) return true;
  if (c.fu === 20) return c.tsumo && c.han >= 2;
  if (c.fu === 25) return c.han >= (c.tsumo ? 3 : 2);
  return c.fu >= 30 && c.fu <= 110 && c.fu % 10 === 0;
}

const FUS = [20, 25, 30, 30, 30, 40, 40, 40, 50, 50, 60, 70, 80, 90, 100, 110];
const LIMIT_HANS = [5, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13];

export function generateScoreCase(rng: () => number): ScoreCase {
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  for (;;) {
    const limit = rng() < 0.25;
    const c: ScoreCase = {
      han: limit ? pick(LIMIT_HANS) : 1 + Math.floor(rng() * 4),
      fu: limit ? 0 : pick(FUS),
      dealer: rng() < 0.35,
      tsumo: rng() < 0.4,
    };
    if (isPossible(c)) return c;
  }
}

/** Human-readable steps, e.g. ["基本点 = 40符 × 2^(3+2) = 1280", "子家付 1280 → 1300", …]. */
export function derivation(c: ScoreCase, p: Payment): string[] {
  const steps: string[] = [];
  const lim = limitFor(c.han);
  if (lim) {
    steps.push(`${c.han}番 = ${lim.name}，基本点 ${lim.base}（不看符）`);
  } else {
    const raw = c.fu * 2 ** (c.han + 2);
    steps.push(`基本点 = ${c.fu}符 × 2^(${c.han}+2) = ${raw}`);
    if (p.limit) steps.push(`超过 2000，按满贯：基本点 2000`);
  }
  const b = p.base;
  const up = (x: number) => (ceil100(x) === x ? `${x}` : `${x} → ${ceil100(x)}`);
  if (p.ron !== null) steps.push(`${c.dealer ? '亲家荣和：基本点 × 6' : '子家荣和：基本点 × 4'} = ${up(b * (c.dealer ? 6 : 4))}`);
  if (p.all !== null) steps.push(`亲家自摸，每家付 基本点 × 2 = ${up(b * 2)}`);
  if (p.ko !== null) {
    steps.push(`子家付 基本点 × 1 = ${up(b)}`);
    steps.push(`亲家付 基本点 × 2 = ${up(b * 2)}`);
  }
  steps.push(`共收 ${p.total} 点`);
  return steps;
}
