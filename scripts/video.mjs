// video.mjs —— 逐帧片段 + 配音 + 音效 → 一条竖版成片
//   node video.mjs --dir film                     # 读 out/clips/*.mp4 + timeline.json + sfx/
//   node video.mjs --dir film --transition 0.24 --music bgm.mp3
//   node video.mjs --dir film --no-audio
// 转场会把时间线压短（每接一次少 transition 秒），配音和音效的位置跟着一起前移，保证对得上。
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const has = k => process.argv.includes(k);
const dir = path.resolve(arg('--dir') ?? '.');
const outDir = path.join(dir, 'out');
const clipsDir = path.resolve(arg('--clips') ?? path.join(outDir, 'clips'));
const TR = Number(arg('--transition') ?? 0.24);
const music = arg('--music');
const W = 1080, H = 1440, FPS = 30;

const run = (cmd, args, opts = {}) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
  p.on('close', c => c === 0 ? res() : rej(new Error(cmd + ' 退出码 ' + c)));
});
const probe = f => new Promise(res => {
  const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]);
  let s = ''; p.stdout.on('data', d => s += d); p.on('close', () => res(parseFloat(s.trim())));
});

const T = JSON.parse(await fs.readFile(path.join(dir, 'timeline.json'), 'utf8'));
const C = JSON.parse(await fs.readFile(path.join(dir, 'cards.json'), 'utf8'));
const n = Math.min(T.lines.length, C.cards.length);

// 片段
const clips = [];
for (let i = 0; i < n; i++) {
  const id = C.cards[i].id ?? String(i + 1).padStart(2, '0');
  const f = path.join(clipsDir, id + '.mp4');
  await fs.access(f).catch(() => { throw new Error('缺片段：' + f + '（先跑 render.mjs）'); });
  clips.push({ file: f, dur: await probe(f) });
}

// 转场后的时间轴
const starts = [];
let acc = 0;
clips.forEach((c, i) => { starts.push(acc); acc += c.dur - (i < clips.length - 1 ? TR : 0); });
const total = acc;

// 画面：xfade 串起来，转场交替用
const vf = [];
let last = '[0:v]';
for (let i = 1; i < clips.length; i++) {
  const tr = i % 2 ? 'slideleft' : 'wipeleft';
  const out = `[v${i}]`;
  vf.push(`${last}[${i}:v]xfade=transition=${tr}:duration=${TR}:offset=${(starts[i]).toFixed(3)}${out}`);
  last = out;
}
const filterV = (vf.length ? vf.join(';') + ';' : '') + `${last}null[vout]`;

// 声音：配音按转场后的时间落位，再加 whoosh / impact / pop
const aIn = [];
const aFilters = [];
let ai = clips.length, audioCount = 0;
const addAudio = (file, at, gain = 1) => {
  aIn.push('-i', file);
  const ms = Math.max(0, Math.round(at * 1000));
  aFilters.push(`[${ai}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain},adelay=${ms}|${ms}[a${ai}]`);
  ai++; audioCount++;
};

if (!has('--no-audio')) {
  // voice.py 给的是绝对时刻；前 i 次转场各压掉 TR 秒，位置跟着前移
  T.lines.slice(0, n).forEach((l, i) => {
    addAudio(path.resolve(dir, l.file), Math.max(0, l.start - i * TR));
  });

  const sfx = path.join(dir, 'sfx');
  const hasSfx = await fs.access(sfx).then(() => true).catch(() => false);
  if (hasSfx) {
    addAudio(path.join(sfx, 'impact.wav'), 0.32, 0.55);                     // 开头落标题
    for (let i = 1; i < clips.length; i++) addAudio(path.join(sfx, 'whoosh.wav'), Math.max(0, starts[i] - 0.10), 0.45);
    clips.forEach((c, i) => addAudio(path.join(sfx, 'pop.wav'), starts[i] + 0.18, 0.35));
  }
  aFilters.push(`${Array.from({length: audioCount}, (_, k) => `[a${clips.length + k}]`).join('')}amix=inputs=${audioCount}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
}

const out = path.join(outDir, arg('--name') ?? 'vertical.mp4');
const args = ['-y'];
clips.forEach(c => args.push('-i', c.file));
args.push(...aIn);

if (has('--no-audio')) {
  args.push('-filter_complex', `${filterV}[vout]`, '-map', '[vout]');
} else {
  args.push('-filter_complex', `${filterV};${aFilters.join(';')}`, '-map', '[vout]', '-map', '[aout]');
}
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart');
if (!has('--no-audio')) args.push('-c:a', 'aac', '-b:a', '192k');
args.push('-t', total.toFixed(3), out);

await run('ffmpeg', args);

// 有底乐就再叠一层（压在人声下面）
if (music && !has('--no-audio')) {
  const withMusic = out.replace(/\.mp4$/, '_music.mp4');
  await run('ffmpeg', ['-y', '-i', out, '-i', path.resolve(music), '-filter_complex',
    '[1:a]volume=0.16,aloop=loop=-1:size=2e9[m];[0:a][m]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), withMusic]);
  console.log('（带底乐）', withMusic);
}

console.log(`\n成片 → ${out}\n时长 ${total.toFixed(2)}s，${clips.length} 张卡，转场 ${TR}s × ${clips.length - 1}`);
