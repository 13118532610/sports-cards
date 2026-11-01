// card.js —— 把 cards.json 渲染成一张卡。窗口里可直接预览，cards.mjs 调 window.render(i) 截图。
// 一卡三样东西：标题（钩子）、主体（抠像/图片/没有）、说明行（补充一句）。多了就别放。
const $=s=>document.querySelector(s);
const el=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};

let CARDS=null, THEME={};

async function boot(){
  CARDS=await fetch('cards.json').then(r=>r.json());
  THEME=(CARDS.theme||{});
  const root=document.documentElement.style;
  for(const [k,v] of Object.entries(THEME)){
    if(k==='bg')root.setProperty('--bg',v);
    if(k==='grid')root.setProperty('--grid',v);
    if(k==='gold')root.setProperty('--gold',v);
    if(k==='ink')root.setProperty('--ink',v);
  }
  await document.fonts.ready;
  const q=new URLSearchParams(location.search).get('card');
  if(q!==null)await render(Number(q));
  return true;
}

// 字号自适应：一行太长就缩小，保证左右各留 90px
// 按"最宽那一行能不能塞进容器"算字号：中文 1 个字宽，西文按 0.55 估，再留 2% 给描边
function fit(text, base, avail, min){
  const longest=Math.max(...String(text).split('\n').map(l=>
    [...l].reduce((n,c)=>n+(c.charCodeAt(0)>127?1:0.55),0)));
  if(!longest)return base;
  return Math.max(min, Math.min(base, Math.floor(avail/longest*0.98)));
}

// 二分找“还能不折行的最大字号”：比一步步缩准，也不会缩过头
async function shrinkToFit(node, prop, min){
  const base = parseFloat(getComputedStyle(node).getPropertyValue(prop)) || 60;
  const lines = (node.textContent||'').split('\n').length;
  // 用“实际行数”判断，不要比像素：描边和行高会让 scrollHeight 多几个像素
  const fits = () => {
    const lh = parseFloat(getComputedStyle(node).lineHeight) || base*1.1;
    return Math.round(node.scrollHeight / lh) <= lines;
  };
  if (fits()) return;                       // 起步就塞得下，不用动
  let lo = min, hi = base;
  for (let i=0;i<12;i++){
    const mid = Math.round((lo+hi)/2);
    node.style.setProperty(prop, mid+'px');
    if (fits()) lo = mid; else hi = mid;
    if (hi-lo<=1) break;
  }
  node.style.setProperty(prop, Math.floor(lo)+'px');
}

// ---------- 贴纸：胶带 / 编号章 / 箭头 ----------
function stickerHTML(st, p, idx){
  const raw = Math.min(1, Math.max(0, (p-0.16)/0.26));
  const pop = 1-Math.pow(1-raw,3);                               // 回弹
  const over = 1 + 0.22*Math.sin(raw*Math.PI);                    // 过冲
  const sc = (0.6 + 0.4*pop) * over;
  const op = Math.min(1, raw*2);
  const wob = st.type==='badge' ? Math.sin(p*Math.PI*3)*2.2 : 0;  // 编号章轻轻晃
  if(st.type==='tape'){
    return `<div class="stk tape" style="left:${st.x??90}px;top:${st.y??96}px;width:${st.w??360}px;height:${st.h??54}px;
      transform:rotate(${st.rot??-6}deg) scaleX(${(0.6+0.4*pop).toFixed(3)});opacity:${(op*0.55).toFixed(3)}"></div>`;
  }
  if(st.type==='badge'){
    const txt = st.text ?? String(idx+1).padStart(2,'0');
    return `<div class="stk badge" style="left:${st.x??880}px;top:${st.y??120}px;
      transform:rotate(${(st.rot??8)+wob}deg) scale(${sc.toFixed(3)});opacity:${op.toFixed(3)}">${txt}</div>`;
  }
  if(st.type==='arrow'){
    return `<div class="stk arrow" style="left:${st.x??700}px;top:${st.y??900}px;opacity:${(op*0.9).toFixed(3)};
      transform:rotate(${st.rot??-12}deg) scale(${(0.8+0.2*pop).toFixed(3)})">
      <svg width="${st.w??160}" height="${st.h??90}" viewBox="0 0 160 90" fill="none">
        <path d="M8 78 C 40 78, 92 62, 132 24" stroke="#F5C400" stroke-width="9" stroke-linecap="round"/>
        <path d="M104 18 L 140 18 L 138 54" stroke="#F5C400" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg></div>`;
  }
  return '';
}

async function render(i, progress){
  const c=CARDS.cards[i]; if(!c)throw new Error('没有第 '+i+' 张卡');
  const card=$('#card');
  card.className=c.kind==='text'?'textonly':'';
  card.innerHTML='';

  const grid=el('div','grid'), vig=el('div','vig'), sweep=el('div','sweep');
  card.append(grid,vig,sweep);

  // 主体
  if(c.kind!=='text' && c.image){
    const wrap=el('div','subject '+(c.kind==='photo'?'photo':'cut'));
    const img=el('img');
    img.src=c.image;
    const L=c.layout||{};
    if(c.kind==='photo'){
      img.style.maxHeight=(L.h||780)+'px';   // 照片卡：等比缩，不裁画面
    }else{
      img.style.height=(L.h||940)+'px';      // 抠像：按高度定，宽高比跟着走
    }
    if(L.y!=null) wrap.style.top=L.y+'px';   // 底边保留，主体永远在安全带里
    if(L.shiftX) img.style.transform=`translateX(${L.shiftX}px)`;
    wrap.appendChild(img);
    card.appendChild(wrap);
  }

  // 标题：先按字数估一个，再按真实宽度收到不折行为止
  const t=el('div','title');
  t.textContent=c.title||'';
  t.style.setProperty('--title-size',fit(c.title||'',THEME.titleSize||78,900,48)+'px');
  card.appendChild(t);
  await shrinkToFit(t,'--title-size',48);

  // 说明行
  if(c.caption){
    const p=el('div','caption');
    p.textContent=c.caption;
    p.style.setProperty('--cap-size',fit(c.caption,THEME.capSize||54,900,36)+'px');
    card.appendChild(p);
    await shrinkToFit(p,'--cap-size',36);
  }

  // 角标（可选，一行）
  if(c.badge){
    const b=el('div','badge');
    b.textContent=c.badge;
    card.appendChild(b);
  }

  // 贴纸
  (c.stickers||[]).forEach(st=>{
    const d=document.createElement('div');
    d.innerHTML=stickerHTML(st, progress==null?1:progress, i);
    if(d.firstElementChild) card.appendChild(d.firstElementChild);
  });

  // ---------- 运动：同一个 progress 永远画同一帧 ----------
  // 每张卡的动作不一样，靠 motion 字段选；没写就按位置轮换，保证一条片里不重样
  const p = progress==null?1:Math.max(0,Math.min(1,progress));
  const MOTION = ['push','pull','panL','panR','punch','float'];
  const mot = c.motion ?? MOTION[(i*3+1) % MOTION.length];
  const ease = x => x<.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2;

  // 背景：整体放大 + 位移，动得看得见（不是几像素的抖）
  const gridEl = card.querySelector('.grid');
  if (gridEl) {
    const gs = 1.02 + 0.20*ease(p);
    const gx = (mot==='panR'? -46 : 34) * ease(p);
    const gy = (mot==='float'? 12*Math.sin(p*Math.PI*2) : -26*ease(p));
    gridEl.style.transform = `translate(${gx.toFixed(1)}px,${gy.toFixed(1)}px) scale(${gs.toFixed(4)})`;
  }

  // 主体：六种走法
  const subj = card.querySelector('.subject img');
  if (subj) {
    let sc = 1, tx = 0, ty = 0;
    const e = ease(p);
    if (mot==='push'){ sc = 1+0.12*e; ty = -18*e; }
    else if (mot==='pull'){ sc = 1.12-0.10*e; ty = 14*e; }
    else if (mot==='panL'){ sc = 1.16; tx = 42*e; }    // 放大要盖过位移，不然照片会露边
    else if (mot==='panR'){ sc = 1.16; tx = -42*e; }
    else if (mot==='punch'){
      const k = Math.min(1, p/0.34);            // 前 1/3 冲进来，后面缓过来
      sc = 1 + 0.16*ease(k) - 0.06*ease(Math.max(0,(p-0.34)/0.66));
      ty = -22*ease(k);
    }
    else { sc = 1.04 + 0.02*Math.sin(p*Math.PI); ty = 10*Math.sin(p*Math.PI*2); }
    subj.style.transform = `scale(${sc.toFixed(4)}) translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`;
  }

  // 标题：第一张才做入场，后面三选一
  const STYLE = ['rise','pop','blur'];
  const ts = c.titleStyle ?? STYLE[i % STYLE.length];
  const te = card.querySelector('.title');
  if (te) {
    if (i!==0) { te.style.opacity='1'; te.style.transform='none'; }
    else {
      const k = Math.min(1, p/0.30), e2 = ease(k);
      if (ts==='pop'){
        const over = 1 + 0.10*Math.sin(Math.min(1,k)*Math.PI);
        te.style.transform = `scale(${(0.86 + 0.14*e2*over).toFixed(4)})`;
      } else if (ts==='blur'){
        te.style.transform = `translateY(${((1-e2)*10).toFixed(1)}px)`;
        te.style.filter = `blur(${((1-e2)*14).toFixed(1)}px)`;
      } else {
        te.style.transform = `translateY(${((1-e2)*30).toFixed(1)}px)`;
      }
      te.style.opacity = Math.min(1, k*1.6).toFixed(3);
    }
  }

  // 扫光：一道光慢慢扫过去，纯字卡全靠它撑住"在动"
  const sw = card.querySelector('.sweep');
  if (sw){
    const x = (-60 + 220*ease(p)).toFixed(1);
    sw.style.transform = `translateX(${x}%) rotate(0.001deg)`;
    sw.style.opacity = (0.10 + 0.05*Math.sin(p*Math.PI)).toFixed(3);
  }

  // 标题：入场之后还在缓慢推近，不钉死
  if (te && i!==0){
    te.style.transform = `translateY(${(-8*p).toFixed(1)}px) scale(${(1+0.03*p).toFixed(4)})`;
  }

  // 说明行：延迟一点淡入，跟卡通一档
  const ce = card.querySelector('.caption');
  if (ce) {
    const k = i===0 ? Math.min(1, Math.max(0,(p-0.10)/0.28)) : 1;
    ce.style.opacity = k.toFixed(3);
    ce.style.transform = k===1?'none':`translateY(${((1-k)*16).toFixed(1)}px)`;
  }

  // 等图片解码完再交回去，不然截图会截到空白
  await Promise.all([...card.querySelectorAll('img')].map(im=>
    im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r;})));
  await Promise.all([...card.querySelectorAll('img')].map(im=>im.decode().catch(()=>{})));
  await document.fonts.ready;
  return {index:i,id:c.id||null,title:c.title||''};
}

window.render=render;
window.cardCount=()=>CARDS?CARDS.cards.length:0;
window.ready=boot();
