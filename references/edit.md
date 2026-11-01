# 配音与合成

图卡是主角，声音只是让卡一张一张过去。**别让配音抢戏。**

## 配音

```bash
python scripts/voice.py 片子目录/script.json
python scripts/voice.py 片子目录/script.json --redo                 # 全部重做
python scripts/voice.py 片子目录/script.json --voice zh-CN-YunjianNeural --rate +6%
```

- 一卡一句，`script.json` 的 `lines` 顺序 = `cards.json` 的 `cards` 顺序。
- 体育解说比财经快：`rate` 用 `+5%` 到 `+12%`，太慢会显得没劲。
- 音色：`zh-CN-YunjianNeural`（男声，偏解说）适合赛事；`zh-CN-XiaoxiaoNeural` 偏资讯。
- `gap` 是这句话说完到下一张卡的停顿：`0.3–0.5` 秒。转折卡前面给 `0.5`，让观众想一下。
- 开头 `pre` 0.3–0.4 秒；结尾 `tail` 0.8–1.0 秒（最后一张卡要留够，别一说完就黑）。

**换正式配音**：把每句存成 `voice/<id>.final.wav`（或 `.mp3`），重跑 `voice.py` 就会自动换上，时长变了视频会自动重排——`cards.json` 一个字都不用改。

## 卡时长

一张卡停多久 = 这句话多长 + `gap`。

- 一句话 3 秒 + gap 0.35 ≈ 3.4 秒一张，一套 6 张约 20 秒。这是这套风格的舒服节奏。
- 一张卡超过 6 秒，观众会以为卡住了：要么话太多（改写），要么图太闷（换图）。
- 纯字卡可以短一点（2.5–3.5 秒），它是节奏的呼吸。

## 合成

```bash
node scripts/video.mjs --dir 片子目录
node scripts/video.mjs --dir 片子目录 --music bgm.mp3     # 加底乐（自动压到 0.16，再整体 -14 LUFS）
node scripts/video.mjs --dir 片子目录 --no-audio          # 只出画面，给客户改配音用
```

输出 1080×1440、30fps、H.264 + AAC。参数：

| 项 | 值 | 为什么 |
|---|---|---|
| 帧率 | 30 | 竖版平台通吃；图卡没有真运动，30 足够 |
| 编码 | libx264 `-crf 19` | 图卡是大面积纯色 + 文字，压缩太狠会在网格线上出块 |
| 像素格式 | `yuv420p` | 不然部分手机黑屏 |
| 音频 | AAC 192k，`-14 LUFS` | 平台统一响度；太响会被压，太轻没人听 |
| `+faststart` | 开 | 网页端边下边播 |

## 底乐

- 有就用，没有不要硬凑。图卡 + 人声本来就能看完。
- 选的曲子**不要有人声、不要有强节拍**，否则和说话打架。
- 加进去之后**自己听一遍**：人声清楚吗？在哪一句被盖住了？

## 交付前的三个数

1. `ffprobe` 能打开、时长对得上（`duration` ≈ `timeline.json` 的 `duration`）。
2. 响度 `-14 LUFS` 上下（`ffmpeg -i out.mp4 -af ebur128 -f null -`）。
3. 抽 6 帧（每卡一帧）看过，没有黑帧、没有半张卡。


## 转场与音效：一条片里不能重复

`video.mjs` 里有两张表，靠 `theme.seed` 轮换。**换一条片，抽到的组合就不一样**——但如果种子不变，两条片会长得一样。

| 转场 | 听感 | 配的音效 |
|---|---|---|
| `slideleft` / `wiperight` | 快切、干脆 | whoosh_1（亮、0.28s） |
| `smoothleft` / `radial` / `fadeblack` | 滑、稳 | whoosh_2（暗、0.42s） |
| `slideup` / `pixelize` | 有颗粒感、狠 | whoosh_3（双峰、0.46s） |
| `circleopen` | 圆开、轻 | whoosh_2 |

音效库（`sfx.py` 现场合成，不用外部素材）：

| 文件 | 用途 | 谱质心 |
|---|---|---|
| `whoosh_1/2/3` | 转场，按种子轮换 | 5.4k / 1.4k / 3.4k Hz |
| `impact_1` | 大标题落定 | 372 Hz |
| `impact_2` | 结论、收尾 | 68 Hz |
| `pop_1` / `pop_2` | 贴纸弹出（交替） | 1.3k / 1.1k Hz |
| `tick` | 纯字卡出现 | 11k Hz |
| `riser` | 开场一口气 | 8.3k Hz |

**检查方法**：在每个转场处切 0.3 秒，算谱质心。六个转场的质心如果都一样，就是音效没换。
