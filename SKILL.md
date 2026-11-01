---
name: sports-cards
description: 竖版体育图卡与短视频（1080×1440、3:4）：一句文案一张卡，深灰网格底 + 黄字黑边重标题 + 抠像/照片卡 + 白色说明行；给一段文案就能出整套图，也能直接配成竖版视频。教的是每张卡凭什么成立（信息增量、标题钩子、卡与卡的承接）、风格参数（网格/色值/字号/描边/安全区）、抠像和照片卡的判断，以及一套工具（取帧、抠主体、渲染 PNG、配音、合成视频、联系我们看）。用户说"sports-cards""做一套体育图卡""把这段文案做成图""竖版赛事解读""C罗/球员/比赛配图"时用；要做横版长视频或真人出镜的片子，不要用这个。
---

# 体育图卡（sports-cards）

**一句文案一张卡。标题是钩子，图是证据，说明行补一句。三样东西各占一头，谁也不压谁。**

## 这份 skill 是什么

- **是**：一套判断标准（这一卡凭什么让人往下滑）、一套风格参数（量出来的网格、色值、字号、描边、安全区）、一套配图规则（什么该抠像、什么该用照片卡、什么干脆放纯字），和一套能跑的工具。
- **不是模板**。没有"第 1 卡必须是大字、第 2 卡必须是图"这种顺序。每套图的卡序从它自己的文案里长出来。
- **能复用的只有底座**：`starter/` 的网格、标题、说明行、主体层，和 `scripts/` 的几个工具。具体的字和图，每条都现写。

## 铁律：每张卡过三关

1. **认得出**：屏上是谁、在干什么？（静音看一眼，说不出就重想）
2. **看得懂**：标题和说明是不是在说同一件事的两面，而不是互相重复？
3. **接得上**：这张卡和上一张之间，观众带走的是什么？

三关分开过。图画得再好看，补不了后两关。

## 流程：每一站停下来给用户看

| 站 | 做什么 | 给用户看什么 |
|---|---|---|
| 0 选题 | 这件事的"一句话结论"是什么，值不值得做成一套 | 结论 + 3 个标题方向（每个一两句） |
| 1 拆卡 | 文案拆成 4–8 张卡，一张一句话；定每卡是"钩子/事实/转折/结论"里的哪种 | 卡序表：标题 + 说明 + 配什么图 |
| 2 配图 | 每卡一张主体图：抠像 / 照片卡 / 纯字；抠完看边缘 | 联系表（可选） |
| 3 出图 | `cards.mjs` 出 PNG，逐张看 | 整套 PNG |
| 4 配音 | `voice.py` 出配音和时间线；一句话一张卡 | — |
| 5 成片 | `video.mjs` 合成竖版 mp4 | 成片 |
| 6 自检 | 见 `references/review.md` | 抽帧图 + 改了什么 |

**不要一口气出完。**第 1 站就要给用户看卡序表——卡序错了，后面全白做。

## 一张卡长什么样

```
┌──────────────────────────┐  1080×1440
│      标题（黄字黑边）      │  top 120，两行以内
│                          │
│     主体（抠像/照片卡）    │  top 330 → bottom 220
│                          │
│        说明行（白字）      │  bottom 96
│      角标（可选，一行）    │  bottom 36
└──────────────────────────┘
```

参数、色值、字号见 `references/style.md`；标题和说明怎么写见 `references/writing.md`。

## 读哪份

| 在做什么 | 读 |
|---|---|
| 想这一卡放什么、凭什么接下一卡 | `references/thinking.md` |
| 画面长什么样：网格、字号、描边、安全区、抠像、照片卡 | `references/style.md` |
| 标题怎么写、说明行怎么写、卡序怎么排 | `references/writing.md` |
| 图从哪来、怎么挑、怎么抠、版权注意什么 | `references/sourcing.md` |
| 配音、卡时长、合成参数 | `references/edit.md` |
| 交付前自检 | `references/review.md` |
| 实践中踩过的坑 | `references/lessons.md` |

## 工具（scripts/）

| 脚本 | 干什么 |
|---|---|
| `frames.py` | 从比赛视频取帧（指定秒数或每隔 N 秒），出图 + 带时间码的联系表 |
| `cutout.py` | 抠主体：rembg → 透明 PNG，自动裁到人、丢掉碎块、可手动框掉比分牌 |
| `cards.mjs` | `cards.json` → 一张张 1080×1440 PNG（静帧预览、单张发图用） |
| `render.mjs` | `cards.json` + `timeline.json` → 每张卡一段带运动的 mp4（网格漂移、主体推近、标题进场、贴纸弹出） |
| `sfx.py` | 现场合成三条音效：whoosh（转场）/ impact（标题落定）/ pop（贴纸弹出），不依赖外部素材 |
| `voice.py` | `script.json` → 每句配音 + `timeline.json`（每句多长、卡停多久） |
| `video.mjs` | 逐帧片段 + 配音 + 音效 → 1080×1440 mp4；转场（slideleft/wipeleft）自动压时间轴并前移配音；`--music` 加底乐 |

依赖：ffmpeg、Python（rembg、onnxruntime、Pillow、numpy、opencv-python、edge-tts）、Node + Playwright（Chromium）。
装法见 `README.md`。

## 一套图怎么搭

1. 把 `starter/` 拷成片子目录（`index.html`、`card.css`、`card.js`），字体放进 `fonts/`。
2. 图放 `assets/src/`（原图），抠好的放 `assets/cut/`（`cutout.py` 输出）。
3. 写 `cards.json`：每卡 `id / kind / image / title / caption`，可加 `layout` 和 `badge`。
4. `node scripts/cards.mjs --dir 片子目录` → `out/cards/*.png`（静帧）；
   `node scripts/render.mjs --dir 片子目录` → `out/clips/*.mp4`（带运动，做视频用这个）。
5. 写 `script.json`（一卡一句，和卡序一一对应），`python scripts/voice.py 片子目录/script.json`。
6. `python scripts/sfx.py 片子目录/sfx` → 三条音效；`node scripts/video.mjs --dir 片子目录` → `out/*.mp4`。

`cards.json` 的结构：

```json
{
  "theme": {"bg":"#292929","grid":"#3a3a3a","gold":"#F5C400","ink":"#131313"},
  "cards": [
    {"id":"c01","kind":"cutout","image":"assets/cut/ronaldo.png",
     "title":"扬眉吐气！C罗进球后模仿\n边裁举旗嘲讽","caption":"扬眉吐气",
     "layout":{"h":980,"y":330}},
    {"id":"c02","kind":"photo","image":"assets/photo_53.png",
     "title":"沙特联赛第 12 轮\n利雅得胜利 5:3","caption":"利雅得胜利大胜对手",
     "layout":{"h":780}},
    {"id":"c03","kind":"text","title":"他两次进球\n都被吹了越位","caption":"两次都白庆祝"}
  ]
}
```

`kind` 三选一：`cutout`（抠像，按高度定）、`photo`（照片卡，等比缩不裁）、`text`（纯字）。

`stickers` 可选，三种：`badge`（编号章，建议放右下 908,1222）、`arrow`（手绘箭头，指证据）、`tape`（纸带，标题后面）。
`badge` 不要放标题区，会压字。

## 一定要做到的

- 标题和说明**不重复**：标题说事，说明补一刀。
- 一张卡只讲一件事。讲两件的，拆成两张。
- 抠像边缘逐张看过：头发、手臂、浅色球衣最容易吃掉一圈。
- 出图后按原尺寸看一遍，不要只看缩略图（缩略图看不出描边糊、字压图）。
- 交付写清楚：出了几张、每张说什么、哪几张你没把握。
