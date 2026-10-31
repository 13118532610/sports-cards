# -*- coding: utf-8 -*-
"""配音 + 时间线：script.json → voice/<id>.mp3 + timeline.json（每句多长、卡和卡之间停多久）

  python voice.py film/script.json
  python voice.py film/script.json --redo        # 全部重做
  python voice.py film/script.json --voice zh-CN-YunxiNeural --rate -8%

script.json：
{
  "voice": "zh-CN-YunxiNeural",     # edge-tts 音色
  "rate": "-8%",                    # 整体语速；体育解说可以 +5% 到 +12%
  "pre": 0.4,                       # 开头留白
  "tail": 0.8,                      # 结尾留白
  "lines": [
    {"id":"c01","text":"扬眉吐气！C罗进球后模仿边裁举旗嘲讽。","gap":0.45},
    {"id":"c02","text":"沙特联赛第十二轮，利雅得胜利五比三。","gap":0.35}
  ]
}
一张卡 = 一句。gap 是这句话说完到下一张卡出现的停顿。

已经有正式配音的：把每句存成 voice/<id>.final.wav（或 .mp3），重跑就会自动换上，
不用改 script.json —— 换了以后时长变了，cards.json 里的顺序不用动，视频会自动按新时长排。
"""
import asyncio, json, subprocess, sys
from pathlib import Path

SP = Path(sys.argv[1]).resolve()
D = SP.parent
S = json.loads(SP.read_text('utf-8'))
REDO = '--redo' in sys.argv
opt = lambda k, v: (sys.argv[sys.argv.index(k) + 1] if k in sys.argv else v)
VOICE = opt('--voice', S.get('voice', 'zh-CN-YunxiNeural'))
RATE = opt('--rate', S.get('rate', '+0%'))
PRE = float(S.get('pre', 0.4))
TAIL = float(S.get('tail', 0.8))

VO = D / 'voice'
VO.mkdir(exist_ok=True)


def dur(f):
    return float(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).strip())


async def synth(text, out):
    import edge_tts
    await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(out))


def final_for(i):
    for ext in ('.final.wav', '.final.mp3'):
        p = VO / (i + ext)
        if p.exists():
            return p
    return None


lines, t = [], PRE
for ln in S['lines']:
    pid, text = ln['id'], ln['text']
    fin = final_for(pid)
    if fin:
        src = fin
    else:
        src = VO / f'{pid}.mp3'
        if REDO or not src.exists():
            print('配音', pid, '…', flush=True)
            asyncio.run(synth(text, src))
    d = dur(src)
    lines.append({'id': pid, 'text': text, 'file': str(src.relative_to(D)), 'dur': round(d, 3),
                  'start': round(t, 3), 'end': round(t + d, 3), 'gap': float(ln.get('gap', 0.35))})
    t += d + float(ln.get('gap', 0.35))

total = round(t + TAIL, 3)
T = {'voice': VOICE, 'rate': RATE, 'pre': PRE, 'tail': TAIL, 'duration': total, 'lines': lines}
(D / 'timeline.json').write_text(json.dumps(T, ensure_ascii=False, indent=1), 'utf-8')

print(f'\n{len(lines)} 句，总长 {total:.1f} 秒')
for l in lines:
    print(f"  {l['id']:5s} {l['start']:6.2f}–{l['end']:6.2f}  {l['text'][:38]}")
