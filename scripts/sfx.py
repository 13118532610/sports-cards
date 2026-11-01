# -*- coding: utf-8 -*-
"""合成一套音效库：不依赖外部素材，numpy 现场生成，但每条都不一样。

  python sfx.py 输出目录

生成：
  whoosh_1.wav  高→低，0.30s   快切、硬转场
  whoosh_2.wav  低→高，0.40s   滑入、推进
  whoosh_3.wav  双峰，0.46s    转场叠转场、连续快切
  impact_1.wav  硬撞击 0.45s   大标题落定、数字出现
  impact_2.wav  闷撞击 0.85s   章节开头、结论
  pop_1.wav     短弹 0.08s     贴纸弹出
  pop_2.wav     上滑弹 0.11s   贴纸弹出（交替用）
  tick.wav      极短点击 0.03s  文字出现
  riser.wav     上扬 0.75s     开场、揭晓

为什么不是一条：同一条片里每个转场都用同一个声音，三下之后观众就出戏了。
"""
import os, sys, wave
import numpy as np

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)


def save(name, x, peak=0.9):
    x = np.asarray(x, float)
    x = x / (np.max(np.abs(x)) or 1) * peak
    x = np.tanh(x * 1.2) / np.tanh(1.2)
    st = np.stack([x, np.roll(x, 9)], axis=1)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767 * .98).astype('<i2').tobytes())
    print(f'{name:12s} {len(x)/SR:.2f}s')


def sweep_noise(dur, f0, f1, curve=1.0):
    """噪声过移动低通，听起来像风/空气划过；f0→f1 控制亮度走向。"""
    n = int(dur * SR)
    noise = rng.normal(0, 1, n)
    y = np.zeros(n); lp = 0.0
    for i in range(n):
        k = (i / n) ** curve
        cut = f0 + (f1 - f0) * k
        lp += cut * (noise[i] - lp)
        y[i] = lp
    # 加一个固定高通去掉低频轰鸣，但不要差分（差分会把高频全抬起来，三条听起来就一样了）
    hp = 0.0
    out = np.zeros(n)
    for i in range(n):
        hp += 0.02 * (y[i] - hp)
        out[i] = y[i] - hp
    return out


def env(n, a, d):
    t = np.arange(n) / SR
    return np.clip(t / a, 0, 1) * np.exp(-t / d)


# —— whoosh 三种 ——
for name, (dur, f0, f1, a, d, tilt) in {
    'whoosh_1.wav': (0.28, .30, .02, .012, .09, .55),   # 亮、短、收得快
    'whoosh_2.wav': (0.42, .015, .12, .080, .18, .04),  # 暗、长、铺得开
    'whoosh_3.wav': (0.46, .06, .42, .020, .13, .18),   # 中间、双峰
}.items():
    n = int(dur * SR)
    y = sweep_noise(dur, f0, f1)
    lp2 = 0.0
    for i in range(n):                                  # 再压一档亮度，三条才分得开
        lp2 += tilt * (y[i] - lp2); y[i] = lp2
    y *= env(n, a, d)
    if name == 'whoosh_3.wav':
        half = n // 2
        y[half:] *= np.linspace(0.35, 1.0, n - half) ** 2
    save(name, y)

# —— 撞击两种 ——
n = int(0.45 * SR); t = np.arange(n) / SR
save('impact_1.wav', np.sin(2*np.pi*64*t)*np.exp(-t/0.11) + np.sin(2*np.pi*41*t)*np.exp(-t/0.18)*0.7
     + rng.normal(0, 1, n)*np.exp(-t/0.006)*0.6)

n = int(0.85 * SR); t = np.arange(n) / SR
save('impact_2.wav', np.sin(2*np.pi*48*t)*np.exp(-t/0.30) + np.sin(2*np.pi*31*t)*np.exp(-t/0.42)*0.8
     + rng.normal(0, 1, n)*np.exp(-t/0.003)*0.25, peak=0.8)

# —— 弹跳两种 ——
n = int(0.08 * SR); t = np.arange(n)/SR
save('pop_1.wav', np.sin(2*np.pi*1250*t)*np.exp(-t/0.022), peak=0.65)

n = int(0.11 * SR); t = np.arange(n)/SR
f = 780 * np.exp(t*7)                      # 上滑
ph = 2*np.pi*np.cumsum(f)/SR
save('pop_2.wav', np.sin(ph)*np.exp(-t/0.030), peak=0.65)

# —— 点击 ——
n = int(0.03 * SR); t = np.arange(n)/SR
save('tick.wav', (np.sin(2*np.pi*3100*t)*0.7 + rng.normal(0,1,n)*0.5)*np.exp(-t/0.004), peak=0.5)

# —— 上扬 ——
n = int(0.75 * SR); t = np.arange(n)/SR
y = sweep_noise(0.75, .05, .65, curve=1.6) * np.linspace(0.1, 1.0, n)**1.6
y += np.sin(2*np.pi*np.cumsum(180*np.exp(t*2.2))/SR) * 0.35 * np.linspace(0, 1, n)**2
save('riser.wav', y, peak=0.7)
