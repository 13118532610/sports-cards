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
  const pop = Math.min(1, Math.max(0, (p-0.18)/0.22));           // 0.18 之后弹出来
  const sc = 1 + 0.35*(1-pop);
  const op = pop;
  if(st.type==='tape'){
    return `<div class="stk tape" style="left:${st.x??90}px;top:${st.y??96}px;width:${st.w??360}px;height:${st.h??54}px;
      transform:rotate(${st.rot??-6}deg) scaleX(${(0.6+0.4*pop).toFixed(3)});opacity:${(op*0.55).toFixed(3)}"></div>`;
  }
  if(st.type==='badge'){
    const txt = st.text ?? String(idx+1).padStart(2,'0');
    return `<div class="stk badge" style="left:${st.x??880}px;top:${st.y??120}px;
      transform:rotate(${st.rot??8}deg) scale(${sc.toFixed(3)});opacity:${op.toFixed(3)}">${txt}</div>`;
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

  const grid=el('div','grid'), vig=el('div','vig');
  card.append(grid,vig);

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

  // 运动：同一个 progress 永远画同一帧（逐帧渲染靠这个）
  const p = progress==null?1:Math.max(0,Math.min(1,progress));
  const gridEl=card.querySelector('.grid'); if(gridEl) gridEl.style.transform=`translate(${(-p*26).toFixed(1)}px,${(-p*18).toFixed(1)}px)`;
  const subj=card.querySelector('.subject img');
  if(subj) subj.style.transform=`scale(${(1+0.055*p).toFixed(4)}) translateY(${(-p*10).toFixed(1)}px)`;
  // 入场只给第一张：后面的卡已经在转场里滑进来了，再淡入会变成"黑底滑进来"
  const te=card.querySelector('.title');
  if(te){
    const e = i===0 ? 1-Math.pow(1-Math.min(1,p/0.22),3) : 1;
    te.style.opacity=e.toFixed(3);
    te.style.transform=e===1?'none':`translateY(${((1-e)*22).toFixed(1)}px) scale(${(1+(1-e)*0.07).toFixed(4)})`;
  }
  const ce=card.querySelector('.caption');
  if(ce){
    const k = i===0 ? Math.min(1,Math.max(0,(p-0.12)/0.25)) : 1;
    ce.style.opacity=k.toFixed(3);
    ce.style.transform=k===1?'none':`translateY(${((1-k)*14).toFixed(1)}px)`;
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
