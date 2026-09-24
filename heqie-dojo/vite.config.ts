import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Writes dist/sw.js with a precache list of every built file and a content-hash version. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'heqie-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = files.filter((f) => !['sw.js', '_headers', 'index.html'].includes(f) && !f.endsWith('.txt')).sort();
      const hash = createHash('sha256');
      for (const f of [...precache, 'index.html']) hash.update(f).update(readFileSync(join(outDir, f)));
      const template = readFileSync('sw/sw.template.js', 'utf8');
      const sw = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(['./', ...precache]));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
});
