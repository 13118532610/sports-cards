# sports-cards

把一段体育文案，做成一整套竖版图卡（1080×1440），再直接配成一条竖版短片。

深灰网格底、黄字黑边的重标题、抠出来的人或一张照片卡、白色说明行。
一句文案一张卡，四到八张讲完一件事。

> 这是给 AI 用的 skill：把它放进 Claude Code / 任意支持 skill 的 Agent，说「用 sports-cards 做一套图，讲 C 罗举旗嘲讽这件事」，它会读 `SKILL.md`，按里面的判断和流程一张一张做出来。

## 长什么样

```
┌──────────────────────────┐  1080 × 1440
│   扬眉吐气！C罗进球后模仿   │  ← 标题：黄字 #F5C400，7px 黑描边 + 硬投影
│        边裁举旗嘲讽        │
│                          │
│        （抠像 / 照片卡）    │  ← 主体：安全带 330–1220
│                          │
│          扬眉吐气          │  ← 说明行：白字黑边
└──────────────────────────┘
   深灰 #292929 + 196px 网格
```

三种卡：**抠像**（单个动作）、**照片卡**（比分牌、官方图，等比缩放不裁）、**纯字卡**（转折和结论）。
参数全部量自参考片，写在 `references/style.md` 里。

## 怎么用

```bash
# 1. 拷底座
cp -R starter my-film && cd my-film
# 再把它需要的两个脚本放进来
cp ../scripts/cards.mjs ../scripts/voice.py ../scripts/video.mjs .

# 2. 图片：自己放到 assets/src/，抠像走 cutout.py
python ../scripts/cutout.py assets/src/ronaldo.png assets/cut/ronaldo.png

# 3. 写 cards.json（每卡一条：id / kind / image / title / caption）
node cards.mjs --dir . --out out/cards          # → 一张张 PNG

# 4. 写 script.json（一卡一句），出配音和时间线
python voice.py script.json

# 5. 合成竖版视频
node video.mjs --dir .
```

只想要图，做到第 3 步就停。

## 装环境

```bash
# Node + Playwright（出图用真浏览器，字体和描边才准）
npm i playwright && npx playwright install chromium

# Python
python3 -m pip install --user rembg onnxruntime edge-tts Pillow numpy opencv-python
python3 -c "from rembg import new_session; new_session('isnet-general-use')"   # 下抠像模型

# ffmpeg / ffprobe 放进 PATH
```

字体：标题用重黑体（阿里妈妈数黑体、思源黑体 Heavy、苹方 Heavy 都行），
放进片子目录的 `fonts/`，和 `card.css` 里的 `@font-face` 对上。仓库不带字体。

## 里面有什么

| 目录 | 内容 |
|---|---|
| `SKILL.md` | AI 读的入口：流程、铁律、数据格式 |
| `references/thinking.md` | 一张卡凭什么让人往下滑 |
| `references/style.md` | 网格、色值、字号、描边、安全区（全是量出来的数） |
| `references/writing.md` | 标题钩子、说明行、卡序 |
| `references/sourcing.md` | 图从哪来、怎么挑、怎么抠、版权 |
| `references/edit.md` | 配音、卡时长、合成参数 |
| `references/review.md` | 交付前自检清单 |
| `references/lessons.md` | 18 条实战踩坑 |
| `scripts/frames.py` | 从比赛视频取帧 + 带时间码的联系表 |
| `scripts/cutout.py` | 抠主体（rembg），自动裁人、丢碎块、可框掉比分牌 |
| `scripts/cards.mjs` | `cards.json` → 1080×1440 PNG |
| `scripts/voice.py` | 逐句配音 + `timeline.json` |
| `scripts/video.mjs` | 图卡 + 配音 → 竖版 mp4 |
| `starter/` | 卡片底座：`index.html` / `card.css` / `card.js` |
| `examples/ronaldo/` | 一套 6 张卡的完整示例（素材不随仓库提供） |

## 三条设计原则

1. **一卡一件事**，且必须比上一张多一个信息；两张说同一件事，删一张。
2. **图是证据，不是配图**：能说「5:3」，就必须有一张带 5:3 的图。
3. **每张卡都能单独发**：单看像一张海报，连起来像一个故事。

详细理由在 `references/thinking.md`。

## 素材与版权

这类内容一定会用到比赛画面、球员照片、官方海报。做评论、解读、资讯，风险相对低；直接搬运原图当自己的，风险高。

- 只用必要的那一张，不整段搬运；
- 发布时在简介写清来源（比赛、转播方、官方渠道）；
- 不拿真实球员、俱乐部的名字给自己的账号/作品起名；
- 商用（带货、广告）单独确认授权——这个仓库不解决授权问题。

## License

代码和文档 MIT，见 `LICENSE`。示例里的第三方画面、球员肖像、俱乐部队徽不在 MIT 范围内，归各自所有者。
