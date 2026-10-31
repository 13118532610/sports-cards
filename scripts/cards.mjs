// cards.mjs —— cards.json → 一张张 1080×1440 的 PNG。
//   node cards.mjs --dir film --out out/cards                 # 全部卡
//   node cards.mjs --dir film --out out/cards --only c01,c03  # 只出几张
//   node cards.mjs --dir film --scale 2                       # 2160×2880（导出用）
//   node cards.mjs --dir film --list                          # 只列卡，不出图
// 页面要求：index.html 暴露 window.ready（Promise）、window.render(i)（画完并等图片解码）、window.cardCount()。
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const has = k => process.argv.includes(k);

function loadPlaywright() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cands = [process.env.PLAYWRIGHT_FROM, path.join(process.cwd(), 'package.json'), fileURLToPath(import.meta.url)];
  for (const t of cands.filter(Boolean)) { try { return createRequire(t)('playwright'); } catch {} }
  try { return createRequire(path.join(here, '..', 'package.json'))('playwright'); } catch {}
  throw new Error('找不到 playwright：在本目录 npm i playwright，或设 PLAYWRIGHT_FROM 指向装了它的 package.json');
}

const dir = path.resolve(arg('--dir') ?? '.');
const out = path.resolve(arg('--out') ?? path.join(dir, 'out', 'cards'));
const scale = Number(arg('--scale') ?? 1);
const only = arg('--only') ? new Set(arg('--only').split(',').map(s => s.trim())) : null;
const W = 1080, H = 1440;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  try {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
    const buf = await fs.readFile(p.endsWith('/') ? path.join(p, 'index.html') : p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' }).end(buf);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 卡里引用的图片和字体要能解析到：默认在 card 目录下找
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('requestfailed', r => errors.push('请求失败 ' + r.url()));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => window.ready);
const n = await page.evaluate(() => window.cardCount());
if (!n) { console.error('cards.json 里一张卡都没有'); await browser.close(); server.close(); process.exit(1); }
if (has('--list')) {
  const cards = JSON.parse(await fs.readFile(path.join(dir, 'cards.json'), 'utf8')).cards;
  cards.forEach((c, i) => console.log(String(i).padStart(2, '0'), c.id ?? '', (c.kind ?? 'cut') + ' |', (c.title || '').replace(/\n/g, ' / ')));
  await browser.close(); server.close(); process.exit(0);
}

await fs.mkdir(out, { recursive: true });
const cards = JSON.parse(await fs.readFile(path.join(dir, 'cards.json'), 'utf8')).cards;
const done = [];
for (let i = 0; i < n; i++) {
  const meta = cards[i];
  if (only && !(only.has(meta.id) || only.has(String(i)))) continue;
  const info = await page.evaluate(i => window.render(i), i);
  const name = (meta.id ?? String(i + 1).padStart(2, '0')) + '.png';
  const file = path.join(out, name);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
  done.push(name);
  console.log('卡', String(i).padStart(2, '0'), '→', name, '|', (meta.title || '').replace(/\n/g, ' / '));
}

if (errors.length) console.error('\n页面报错（先修再看图）：\n ' + [...new Set(errors)].join('\n '));
await browser.close();
server.close();
console.log(`\n出了 ${done.length} 张 → ${out}（${W * scale}×${H * scale}）`);
