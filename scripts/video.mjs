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
let total = acc;
// 配音已经结束就别再挂着空画面：留 0.45 秒收尾
if (!has('--no-audio')) {
  const voiceEnd = Math.max(...T.lines.slice(0, n).map((l, i) => Math.max(0, l.start - i * TR) + l.dur));
  total = Math.min(total, voiceEnd + 0.45);
}

// 转场库：动作和声音成对，按种子轮换——换一条片，组合就不一样
const TRANS = [
  ['slideleft',  'whoosh_1'], ['smoothleft', 'whoosh_2'],
  ['slideup',    'whoosh_3'], ['circleopen', 'whoosh_2'],
  ['wiperight',  'whoosh_1'], ['pixelize',   'whoosh_3'],
  ['radial',     'whoosh_2'], ['fadeblack',  'whoosh_2'],
];
const SEED = (() => {
  const t = (C.theme && C.theme.seed) || dir;
  let h = 0; for (const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
})();
const cuts = [];
const vf = [];
let last = '[0:v]';
const WHOOSH = ['whoosh_1', 'whoosh_2', 'whoosh_3'];
for (let i = 1; i < clips.length; i++) {
  const pick = TRANS[(SEED + i * 3) % TRANS.length];
  // 声音单独轮换，别跟着转场类型走（否则同一种 whoosh 会连着出现好几次）
  cuts.push([pick[0], WHOOSH[(SEED + i) % WHOOSH.length]]);
  const out = `[v${i}]`;
  vf.push(`${last}[${i}:v]xfade=transition=${pick[0]}:duration=${TR}:offset=${(starts[i]).toFixed(3)}${out}`);
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
    const P = f => path.join(sfx, f);
    addAudio(P('riser.wav'), 0.02, 0.28);                                  // 开场一口气
    addAudio(P('impact_1.wav'), 0.30, 0.60);                               // 标题落定
    cuts.forEach(([, snd], k) => addAudio(P(snd + '.wav'), Math.max(0, starts[k + 1] - 0.12), 0.5));
    C.cards.slice(0, n).forEach((card, i) => {
      const t0 = starts[i];
      // 纯字卡：给一下轻点击，把注意力拉回字
      if (card.kind === 'text') addAudio(P('tick.wav'), t0 + 0.05, 0.35);
      // 有贴纸：弹一下，两个 pop 交替
      if ((card.stickers || []).length) addAudio(P(i % 2 ? 'pop_2.wav' : 'pop_1.wav'), t0 + 0.20, 0.32);
      // 最后一张（结论）：闷撞击
      if (i === n - 1) addAudio(P('impact_2.wav'), t0 + 0.25, 0.45);
    });
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
