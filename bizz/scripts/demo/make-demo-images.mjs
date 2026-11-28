// Generates the illustrative visuals of the demo posts: two 800x1000 JPEG per archetype
// (pastel background + line icon), named a<id>-1.jpg and a<id>-2.jpg.
// Dev tool. Usage: node scripts/demo/make-demo-images.mjs <outDir>
//   needs `playwright` and `lucide-static` resolvable (PW_MODULE and LUCIDE_DIR env vars override the lookup).
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');
const iconDir = process.env.LUCIDE_DIR ?? join(here, '../../node_modules/lucide-static/icons');
const out = process.argv[2];
mkdirSync(out, { recursive: true });

const archetypes = JSON.parse(readFileSync(join(here, 'archetypes.json'), 'utf8'));
const schemes = [
  ['#FFE6CC', '#FF8A0A'], ['#DCE8F8', '#12498F'], ['#FADDE8', '#C2246C'], ['#DDF3E6', '#13854A'], ['#E9E1FA', '#6A3FC4'], ['#F4EBDD', '#8A5A1E'],
];
const page = (icon, [bg, fg], variant) => `
<body style="margin:0;width:800px;height:1000px;background:${bg};display:grid;place-items:center;overflow:hidden">
  <div style="position:absolute;width:${variant ? 760 : 620}px;height:${variant ? 760 : 620}px;border-radius:${variant ? '50%' : '120px'};background:rgba(255,255,255,.55);transform:rotate(${variant ? 0 : -8}deg)"></div>
  <div style="position:relative;width:${variant ? 300 : 360}px;height:${variant ? 300 : 360}px;color:${fg}">${icon.replace(/width="24"/, 'width="100%"').replace(/height="24"/, 'height="100%"').replace(/stroke-width="2"/, 'stroke-width="1.4"')}</div>
</body>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 800, height: 1000 } });
for (const a of archetypes) {
  const svg = readFileSync(join(iconDir, `${a.icon}.svg`), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const variant of [0, 1]) {
    await tab.setContent(page(svg, schemes[(a.id + variant * 3) % schemes.length], variant));
    await tab.screenshot({ path: join(out, `a${String(a.id).padStart(2, '0')}-${variant + 1}.jpg`), type: 'jpeg', quality: 82 });
  }
}
await browser.close();
console.log(`${archetypes.length * 2} images in ${out}`);
