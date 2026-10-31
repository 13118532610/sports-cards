# -*- coding: utf-8 -*-
"""从视频取帧：比赛回放/集锦 → 一张张图，或者一张带时间码的联系表。

  python frames.py 比赛.mp4 --at 12.4,88.2,101.6 --out assets/src/    # 按秒取帧
  python frames.py 比赛.mp4 --sheet 20                               # 每 20 秒一格的联系表（先看全局）
  python frames.py 比赛.mp4 --at 88.2 --sheet 20 --out 出图目录        # 两个一起做

选项：
  --w 1080      输出宽度（默认保持原宽，超过 1080 会缩到 1080）
  --cols 6      联系表每行几格

联系表上的时间码就是 --at 要填的数字。看中哪一格，把时间码抄进 --at。
"""
import os, subprocess, sys, tempfile

args = sys.argv[1:]
if not args:
    sys.exit(__doc__)
src = args[0]
opt = lambda k, v: (args[args.index(k) + 1] if k in args else v)
OUT = opt('--out', None)
AT = opt('--at', None)
SHEET = float(args[args.index('--sheet') + 1]) if '--sheet' in args else None
W = int(opt('--w', 1080))
COLS = int(opt('--cols', 6))


def dur(f):
    return float(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())


def grab(t, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', src,
                    '-frames:v', '1', '-vf', f'scale={W}:-1', out], check=True)


if AT:
    os.makedirs(OUT or '.', exist_ok=True)
    for t in [float(x) for x in AT.split(',') if x.strip()]:
        f = os.path.join(OUT or '.', f'f_{t:07.2f}.png')
        grab(t, f)
        print('取帧', f'{t:7.2f}s →', f)

if SHEET:
    from PIL import Image, ImageDraw
    D = dur(src)
    ts = [i * SHEET for i in range(int(D // SHEET) + 1)]
    sw = min(W, 480)   # 联系表用小图，不然一张表几万像素宽
    tmp = tempfile.mkdtemp()
    ims = []
    for t in ts:
        p = os.path.join(tmp, f'{t:.2f}.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', src,
                        '-frames:v', '1', '-vf', f'scale={sw}:-1', p], check=True)
        ims.append((t, Image.open(p).convert('RGB')))
    if ims:
        w, h = ims[0][1].size
        rows = (len(ims) + COLS - 1) // COLS
        sheet = Image.new('RGB', (w * COLS, h * rows), (12, 12, 12))
        d = ImageDraw.Draw(sheet)
        for i, (t, im) in enumerate(ims):
            x, y = (i % COLS) * w, (i // COLS) * h
            sheet.paste(im, (x, y))
            d.rectangle([x, y, x + 96, y + 26], fill=(0, 0, 0))
            d.text((x + 6, y + 6), f'{t:.1f}s', fill=(255, 220, 80))
        os.makedirs(OUT or '.', exist_ok=True)
        name = os.path.join(OUT or '.', os.path.splitext(os.path.basename(src))[0] + '_表.jpg')
        sheet.save(name, quality=88)
        print('联系表', len(ims), '格 →', name, f'（{sheet.size[0]}×{sheet.size[1]}）')
