import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const s = require('@tailwindcss/node');

function getFiles(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(fullPath));
      } else if (/\.(tsx|ts|jsx|js|html)$/.test(fullPath)) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

export async function compileTailwindCss() {
  const t0 = performance.now();
  const sourcePath = path.resolve('src/app/globals.source.css');
  const targetPath = path.resolve('src/app/globals.css');

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source CSS not found at ${sourcePath}`);
    return;
  }

  const rawCss = fs.readFileSync(sourcePath, 'utf8');
  const files = getFiles(path.resolve('src'));
  const candidateRegex = /[a-zA-Z0-9_\-:[\]/%.#]+/g;
  const candidates = new Set();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(candidateRegex) || [];
      for (const m of matches) candidates.add(m);
    } catch (e) {}
  }

  const compiler = await s.compile(rawCss, {
    from: sourcePath,
    base: process.cwd(),
    onDependency: () => {}
  });

  const output = compiler.build([...candidates]);
  fs.writeFileSync(targetPath, output, 'utf8');
  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`[TailwindV4] Generated ${targetPath} (${output.length.toLocaleString()} bytes, ${candidates.size} candidates in ${elapsed}ms)`);
}

// Check if running as script directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  compileTailwindCss()
    .then(() => {
      if (process.argv.includes('--watch')) {
        console.log('[TailwindV4] Watching src/ for CSS candidate updates...');
        let timeout = null;
        fs.watch(path.resolve('src'), { recursive: true }, (eventType, filename) => {
          if (filename && (filename.endsWith('.css') || filename.endsWith('.tsx') || filename.endsWith('.ts'))) {
            if (filename.includes('globals.css')) return; // ignore output file
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              compileTailwindCss().catch(console.error);
            }, 100);
          }
        });
      }
    })
    .catch((err) => {
      console.error('[TailwindV4] Build failed:', err);
      process.exit(1);
    });
}
