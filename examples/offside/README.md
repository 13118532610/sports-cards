# 示例：越位到底怎么看（7 张卡 / 32 秒）

一套规则讲解型的示例：钩子 → 三条件 → 常见误解 → 例外 → 现状 → 结论。

- `script.json` —— 7 句话，一卡一句
- `cards.json` —— 7 张卡：2 张抠像、1 张照片卡、4 张纯字卡
- `assets/src/` —— 原图（Wikimedia Commons，可商用）
- `assets/cut/` —— 抠好的透明 PNG

图片版权见 `CREDITS.md`。

```bash
cd examples/offside   # 三个模板文件已经在目录里了
node ../../scripts/cards.mjs --dir . --out out/cards
python ../../scripts/voice.py script.json
node ../../scripts/video.mjs --dir .
```
