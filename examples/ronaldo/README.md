# 示例：C 罗举旗嘲讽（6 张卡 / 26 秒）

一套完整的示例，展示"钩子 → 事实 → 转折 → 结论"怎么排成 6 张卡。

- `script.json` —— 6 句话，一卡一句
- `cards.json` —— 6 张卡：2 张抠像、1 张照片卡、2 张纯字卡
- `assets/src/` —— 取帧得到的原图（`frames.py --at`）
- `assets/cut/` —— 抠好的透明 PNG（`cutout.py`）
- `out/cards/` —— 6 张 1080×1440 PNG
- `out/01_C罗举旗_1080x1440.mp4` —— 合成好的竖版视频

> **素材不随仓库提供。** 比赛画面来自转播方，球员肖像归本人及俱乐部，不能跟着 MIT 一起发。
> 自己跑这份示例时，把图放进 `assets/src/`，再按下面三步走。

```bash
cd examples/ronaldo

python ../../scripts/cutout.py assets/src/ronaldo.png assets/cut/ronaldo.png
node  ../../scripts/cards.mjs --dir . --out out/cards
python ../../scripts/voice.py script.json
node  ../../scripts/video.mjs --dir .
```

字体（标题用的重黑体）不放仓库，自己下载后放进 `fonts/`，文件名和 `card.css` 里的 `@font-face` 对上。
