# -*- coding: utf-8 -*-
"""抠主体：一张照片 → 透明 PNG（自动裁到人，去掉零碎和转播台的比分牌）。

  python cutout.py 照片.jpg 输出目录/名字.png
  python cutout.py 图片目录/ 输出目录/            # 整个目录批处理
  选项：
    --model isnet-general-use   抠图模型（默认 isnet-general-use；人像可试 birefnet-portrait）
    --pad 24                    裁切时四周留的像素
    --max-h 1200                输出高度上限（图卡里再按 layout.h 缩放）
    --min-area 0.02             小于最大连通块这个比例的碎块丢掉
    --drop 0,0,300,200          手动框掉一块（可重复），坐标用原图像素，比如比分牌
    --keep-largest              只留最大的一块（人物被拆成几块时会切掉胳膊，慎用）
  输出：透明 PNG + 同名 .json（原图尺寸、裁切框、主体占比），cards.json 里的 layout 可以照它填。

注意：
  - 转播画面右下角的比分牌、台标、字幕条，rembg 会把它们当主体留下来；换一帧、或者用 --drop 框掉。
  - 抠完要自己看一眼边缘：头发、手臂和背景同色时会被吃掉一圈。
"""
import json, os, sys, glob
import numpy as np
from PIL import Image

try:
    from rembg import remove, new_session
except ImportError:
    sys.exit('要 rembg：python3 -m pip install --user rembg onnxruntime')

a = sys.argv[1:]
if not a: sys.exit(__doc__)
src, dst = a[0], a[1] if len(a) > 1 and not a[1].startswith('--') else None
opt = lambda k, v: (float(a[a.index(k) + 1]) if k in a else v)
MODEL = a[a.index('--model') + 1] if '--model' in a else 'isnet-general-use'
PAD, MAXH, MINA = int(opt('--pad', 24)), int(opt('--max-h', 1200)), opt('--min-area', .02)
KEEP_LARGEST = '--keep-largest' in a
DROPS = []
for i, x in enumerate(a):
    if x == '--drop':
        DROPS.append(tuple(int(v) for v in a[i + 1].split(',')))

session = new_session(MODEL)


def cut_one(inp, outp):
    im = Image.open(inp).convert('RGB')
    W, H = im.size
    cut = remove(im, session=session).convert('RGBA')
    al = np.array(cut)[:, :, 3]

    # 手动框掉指定区域
    for (x0, y0, x1, y1) in DROPS:
        al[y0:y1, x0:x1] = 0

    # 连通域：丢碎块，主角是最大的那块
    import cv2
    m = (al > 60).astype(np.uint8)
    k, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if k > 1:
        areas = st[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        keep = np.zeros(k, bool)
        for j in range(1, k):
            if areas[j - 1] >= big * MINA and (not KEEP_LARGEST or areas[j - 1] == big):
                keep[j] = True
        al = np.where(keep[lab], al, 0)
    cut.putalpha(Image.fromarray(al))

    # 自动裁到主体
    ys, xs = np.where(al > 8)
    if len(xs) == 0:
        raise SystemExit(f'{inp}: 抠完是空的，换个 --model 或看原图')
    x0, x1 = int(max(0, xs.min() - PAD)), int(min(W, xs.max() + PAD + 1))
    y0, y1 = int(max(0, ys.min() - PAD)), int(min(H, ys.max() + PAD + 1))
    cut = cut.crop((x0, y0, x1, y1))

    # 高度上限
    if cut.height > MAXH:
        s = MAXH / cut.height
        cut = cut.resize((max(1, round(cut.width * s)), MAXH), Image.LANCZOS)

    os.makedirs(os.path.dirname(os.path.abspath(outp)) or '.', exist_ok=True)
    cut.save(outp)
    meta = {'src': os.path.basename(inp), 'src_w': int(W), 'src_h': int(H),
            'crop': [x0, y0, x1 - x0, y1 - y0], 'w': int(cut.width), 'h': int(cut.height),
            'subject_ratio': round((x1 - x0) * (y1 - y0) / float(W * H), 3)}
    json.dump(meta, open(os.path.splitext(outp)[0] + '.json', 'w'),
              ensure_ascii=False, indent=1)
    print(f'{os.path.basename(inp)} → {outp}  {cut.width}×{cut.height}  '
          f'（原图 {W}×{H}，主体占 {meta["subject_ratio"]*100:.0f}%）')


if os.path.isdir(src):
    files = [f for f in glob.glob(os.path.join(src, '*'))
             if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if not dst:
        sys.exit('批处理要给输出目录：python cutout.py 图片目录/ 输出目录/')
    for f in sorted(files):
        cut_one(f, os.path.join(dst, os.path.splitext(os.path.basename(f))[0] + '.png'))
else:
    if not dst:
        sys.exit('要给输出文件：python cutout.py 照片.jpg out/xx.png')
    cut_one(src, dst)
