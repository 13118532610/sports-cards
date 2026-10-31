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

async function render(i){
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
    if(L.y!=null){ wrap.style.top=L.y+'px'; wrap.style.bottom='auto'; }
    if(L.shiftX) img.style.transform=`translateX(${L.shiftX}px)`;
    wrap.appendChild(img);
    card.appendChild(wrap);
  }

  // 标题
  const t=el('div','title');
  t.textContent=c.title||'';
  t.style.setProperty('--title-size',fit(c.title||'',THEME.titleSize||78,900,48)+'px');
  card.appendChild(t);

  // 说明行
  if(c.caption){
    const p=el('div','caption');
    p.textContent=c.caption;
    p.style.setProperty('--cap-size',fit(c.caption,THEME.capSize||54,900,36)+'px');
    card.appendChild(p);
  }

  // 角标（可选，一行）
  if(c.badge){
    const b=el('div','badge');
    b.textContent=c.badge;
    card.appendChild(b);
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
