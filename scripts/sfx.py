# -*- coding: utf-8 -*-
"""合成音效：不依赖任何外部素材，用 numpy 现场生成三条就够用。

  python sfx.py 输出目录          # 生成 whoosh.wav / impact.wav / pop.wav

  whoosh  0.32s 过滤噪声扫频，用在卡与卡之间
  impact  0.45s 低频撞击 + 一点噪声，用在大标题落定
  pop     0.10s 短促点击，用在贴纸弹出
"""
import os, sys, wave
import numpy as np

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def save(name, x, peak=0.9):
    x = np.asarray(x, dtype=np.float64)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    # 轻微软化，避免削波
    x = np.tanh(x * 1.2) / np.tanh(1.2)
    stereo = np.stack([x, np.roll(x, 12)], axis=1)          # 右声道错 0.25ms，听起来更宽
    pcm = (stereo * 32767 * 0.98).astype('<i2')
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'{name:12s} {len(x)/SR:.2f}s')


def env(n, a=0.01, d=0.3):
    t = np.arange(n) / SR
    at = np.clip(t / a, 0, 1)
    de = np.exp(-t / d)
    return at * de


# whoosh：噪声过"移动的低通 + 高通"，听起来像划过空气
n = int(0.32 * SR)
noise = rng.normal(0, 1, n)
# 简化的带通：一阶低通 + 一阶高通，中心频率随时间上移
y = np.zeros(n)
lp = 0.0
for i in range(n):
    cut = 0.06 + 0.5 * (i / n)             # 越来越亮
    lp += cut * (noise[i] - lp)
    y[i] = lp
y = np.diff(y, prepend=y[0])               # 去直流、加高频
save('whoosh.wav', y * env(n, a=0.02, d=0.13))

# impact：60Hz 正弦 + 短噪声，快速衰减
n = int(0.45 * SR)
t = np.arange(n) / SR
body = np.sin(2 * np.pi * 62 * t) * np.exp(-t / 0.12)
sub = np.sin(2 * np.pi * 38 * t) * np.exp(-t / 0.20) * 0.6
click = rng.normal(0, 1, n) * np.exp(-t / 0.008) * 0.5
save('impact.wav', body + sub + click)

# pop：一个很短的 1.2kHz 正弦，带一点下滑
n = int(0.10 * SR)
t = np.arange(n) / SR
f = 1200 * np.exp(-t / 0.05)
ph = 2 * np.pi * np.cumsum(f) / SR
save('pop.wav', np.sin(ph) * np.exp(-t / 0.03), peak=0.7)
