// video.mjs —— 图卡 + 配音 → 一条 1080×1440 的竖版 mp4
//   node video.mjs --dir film                      # 读 film/timeline.json + film/cards.json + film/out/cards/*.png
//   node video.mjs --dir film --music bgm.mp3      # 加一条底乐（自动压到人声下面）
//   node video.mjs --dir film --no-audio           # 只要画面（默片预览）
// 卡片顺序 = timeline.json 的顺序；一张卡的时长 = 这句话的长度 + gap，最后一张再加 tail。
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const has = k => process.argv.includes(k);

const dir = path.resolve(arg('--dir') ?? '.');
const outDir = path.join(dir, 'out');
const fps = Number(arg('--fps') ?? 30);
const W = 1080, H = 1440;
const cardsDir = path.resolve(arg('--cards') ?? path.join(outDir, 'cards'));
const music = arg('--music');

const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('close', c => c === 0 ? res() : rej(new Error(cmd + ' 退出码 ' + c)));
});

const T = JSON.parse(await fs.readFile(path.join(dir, 'timeline.json'), 'utf8'));
const C = JSON.parse(await fs.readFile(path.join(dir, 'cards.json'), 'utf8'));
if (C.cards.length < T.lines.length) throw new Error(`cards.json 有 ${C.cards.length} 张卡，timeline.json 有 ${T.lines.length} 句，对不上`);

await fs.mkdir(outDir, { recursive: true });

// 1) 每张卡停多久
const segs = T.lines.map((l, i) => {
  const last = i === T.lines.length - 1;
  const dur = l.dur + (l.gap || 0) + (last ? (T.tail || 0) : 0) + (i === 0 ? (T.pre || 0) : 0);
  const id = C.cards[i].id ?? String(i + 1).padStart(2, '0');
  return { i, id, file: path.join(cardsDir, id + '.png'), dur: +dur.toFixed(3) };
});
for (const s of segs) await fs.access(s.file).catch(() => { throw new Error('缺图卡：' + s.file); });

const list = path.join(outDir, 'concat.txt');
await fs.writeFile(list, segs.map(s => `file '${s.file}'\nduration ${s.dur}`).join('\n') + `\nfile '${segs.at(-1).file}'\n`);

// 2) 配音铺到时间线上
const silent = path.join(outDir, 'silent.wav');
let audio = null;
if (!has('--no-audio')) {
  const parts = [];
  const filters = [];
  let n = 0;
  for (const l of T.lines) {
    const f = path.resolve(dir, l.file);
    const delay = Math.round((l.start + (l.i === 0 ? 0 : 0)) * 1000 / 1000 * 1000);
    parts.push('-i', f);
    filters.push(`[${n}:a]aresample=48000,adelay=${delay}|${delay}[a${n}]`);
    n++;
  }
  const mixIn = Array.from({ length: n }, (_, i) => `[a${i}]`).join('');
  let filter = `${filters.join(';')};${mixIn}amix=inputs=${n}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  const args = ['-y', ...parts, '-filter_complex', filter, '-map', '[a]', '-t', String(T.duration), silent];
  await run('ffmpeg', args);
  audio = silent;
  if (music) {
    const withMusic = path.join(outDir, 'mix.wav');
    await run('ffmpeg', ['-y', '-i', silent, '-i', path.resolve(music), '-filter_complex',
      `[1:a]volume=0.16,aloop=loop=-1:size=2e9[m];[0:a][m]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
      '-map', '[a]', '-t', String(T.duration), withMusic]);
    audio = withMusic;
  }
}

// 3) 画面 + 声音
const out = path.join(outDir, arg('--name') ?? `vertical_${H}.mp4`);
const vf = `scale=${W}:${H}:flags=lanczos,setsar=1,fps=${fps},format=yuv420p`;
const args = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
if (audio) args.push('-i', audio);
args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-movflags', '+faststart');
if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
args.push(out);
await run('ffmpeg', args);

const probe = await new Promise(res => {
  const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', out]);
  let s = ''; p.stdout.on('data', d => s += d); p.on('close', () => res(s.trim()));
});
console.log(`\n成片 → ${out}\n${probe}`);
console.log(`卡 ${segs.length} 张，` + segs.map(s => `${s.id}:${s.dur.toFixed(1)}s`).join('  '));
