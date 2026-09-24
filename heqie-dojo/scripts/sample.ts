// Print sample problems and timing: npx vite-node scripts/sample.ts
import { DEFAULT_OPTIONS, generateProblem } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';
import { formatHand, tileCode } from '../src/engine/tiles';

for (const s of [1, 2, 3] as const) {
  const rng = mulberry32(2026 + s);
  const t0 = performance.now();
  const N = 30;
  const ps = Array.from({ length: N }, () => generateProblem(rng, { ...DEFAULT_OPTIONS, shanten: s }));
  const ms = (performance.now() - t0) / N;
  console.log(`\n== ${s}-shanten: ${ms.toFixed(1)} ms/problem ==`);
  for (const p of ps.slice(0, 3)) {
    const top = p.analysis.discards.filter((d) => d.shanten === s).slice(0, 4);
    console.log(
      formatHand(p.hand).padEnd(22),
      top.map((d) => `打${tileCode(d.discard)} ${d.ukeire}枚`).join(' | '),
    );
  }
}
