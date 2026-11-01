// render.mjs —— 逐帧渲染：cards.json + timeline.json → 每张卡一段带运动的 mp4
//   node render.mjs --dir film                    # 全部卡，出到 film/out/clips/
//   node render.mjs --dir film --only c03         # 只渲一张
//   node render.mjs --dir film --fps 30 --crf 18
// 为什么逐帧：背景在漂、主体在推、标题在进，静态 PNG 表达不了。同一个 progress 永远画同一帧。
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const dir = path.resolve(arg('--dir') ?? '.');
const outDir = path.resolve(arg('--out') ?? path.join(dir, 'out', 'clips'));
const fps = Number(arg('--fps') ?? 30);
const crf = arg('--crf') ?? '18';
const only = arg('--only') ? new Set(arg('--only').split(',').map(s => s.trim())) : null;
const W = 1080, H = 1440;

function loadPlaywright() {
  for (const t of [process.env.PLAYWRIGHT_FROM, path.join(process.cwd(), 'package.json'), fileURLToPath(import.meta.url)]) {
    try { return createRequire(t)('playwright'); } catch {}
  }
  throw new Error('找不到 playwright：npm i playwright，或设 PLAYWRIGHT_FROM');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
    const buf = await fs.readFile(p);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] ?? 'application/octet-stream' }).end(buf);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const T = JSON.parse(await fs.readFile(path.join(dir, 'timeline.json'), 'utf8'));
const C = JSON.parse(await fs.readFile(path.join(dir, 'cards.json'), 'utf8'));
const n = Math.min(T.lines.length, C.cards.length);
if (C.cards.length !== T.lines.length) console.warn(`注意：卡 ${C.cards.length} 张 / 句 ${T.lines.length} 条，只渲前 ${n} 张`);

await fs.mkdir(outDir, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('requestfailed', r => errs.push('请求失败 ' + r.url()));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => window.ready);

function encoder(file) {
  const p = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-r', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  return { stdin: p.stdin, done };
}

const t0 = Date.now();
let total = 0;
for (let i = 0; i < n; i++) {
  const card = C.cards[i];
  const id = card.id ?? String(i + 1).padStart(2, '0');
  if (only && !only.has(id)) continue;
  const line = T.lines[i];
  const dur = line.dur + (line.gap || 0) + (i === 0 ? (T.pre || 0) : 0) + (i === n - 1 ? (T.tail || 0) : 0);
  const frames = Math.max(2, Math.round(dur * fps));
  const file = path.join(outDir, id + '.mp4');
  const enc = encoder(file);
  for (let f = 0; f < frames; f++) {
    const p = frames === 1 ? 1 : f / (frames - 1);
    await page.evaluate(([i, p]) => window.render(i, p), [i, p]);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
  }
  enc.stdin.end();
  await enc.done;
  total += frames;
  console.log(`卡 ${id}  ${dur.toFixed(2)}s  ${frames} 帧 → ${path.relative(dir, file)}`);
}

if (errs.length) console.error('\n页面报错：\n ' + [...new Set(errs)].join('\n '));
await browser.close();
server.close();
console.log(`\n渲了 ${total} 帧，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(dir, outDir)}`);
