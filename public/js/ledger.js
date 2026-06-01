import { api, ApiError } from './api.js';

// Fallback list if /api/categories can't be reached; the server is the source of truth.
let CATS = ['淡村采购','一次性用品','烧烤冻品进货','烧烤雪花牛肉','煤气','植物油','白切酱油花生油','半成品鱼片','饮料','大米','配料','鸭头鸭脚','员工菜'];
const WD = ['周日','周一','周二','周三','周四','周五','周六'];
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

let entries = [];
let saving = false;

// ----- formatting helpers -----
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => round2(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => fmtDate(new Date());
function ymdLabel(s){const p=s.split('-');return p[0]+'年'+parseInt(p[1])+'月'+parseInt(p[2])+'日';}
function mdShort(s){const p=s.split('-');return parseInt(p[1])+'月'+parseInt(p[2])+'日';}
function weekday(s){return WD[new Date(s+'T00:00:00').getDay()];}

let selectedCat = null, amtStr = '', curDate = todayStr();
let gran = 'month', viewDay = todayStr(), viewMonth = todayStr().slice(0,7), viewYear = todayStr().slice(0,4);

// Redirect to login on auth failure; returns true if it handled the error.
function handleAuthErr(err) {
  if (err instanceof ApiError && err.status === 401) {
    location.replace('/login.html');
    return true;
  }
  return false;
}

// ----- record -----
function buildCatSheet(){
  const grid=document.getElementById('catSheetGrid');
  grid.innerHTML=CATS.map((c,i)=>`<button class="sheet-cat" data-i="${i}" type="button">${c}</button>`).join('');
  grid.querySelectorAll('.sheet-cat').forEach(b=>{ b.onclick=()=>{ selectedCat=CATS[+b.dataset.i]; syncCatBtn(); closeCatSheet(); }; });
}
function syncCatBtn(){
  document.getElementById('catBtnText').textContent=selectedCat||'请选择类别';
  document.getElementById('catBtn').classList.toggle('chosen',!!selectedCat);
  document.querySelectorAll('#catSheetGrid .sheet-cat').forEach(b=>b.classList.toggle('on',CATS[+b.dataset.i]===selectedCat));
}
function openCatSheet(){ document.getElementById('catSheet').classList.remove('hidden'); }
function closeCatSheet(){ document.getElementById('catSheet').classList.add('hidden'); }
function buildPad(){
  const keys=['1','2','3','4','5','6','7','8','9','.','0','del'];
  document.getElementById('pad').innerHTML=keys.map(k=>k==='del'?`<button class="key del" data-k="del" aria-label="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H8l-6 8 6 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><path d="m15 9-6 6M9 9l6 6"/></svg></button>`:`<button class="key" data-k="${k}">${k}</button>`).join('');
  document.querySelectorAll('#pad .key').forEach(b=>b.onclick=()=>pressKey(b.dataset.k));
}
function pressKey(k){
  if(k==='del'){ amtStr=amtStr.slice(0,-1); }
  else if(k==='.'){ if(!amtStr.includes('.')) amtStr=amtStr===''?'0.':amtStr+'.'; }
  else{ if(amtStr.includes('.')&&amtStr.split('.')[1].length>=2) return; amtStr=(amtStr==='0')?k:amtStr+k; if(amtStr.replace('.','').length>9) amtStr=amtStr.slice(0,-1); }
  renderAmt();
}
function renderAmt(){ const el=document.getElementById('amtVal'); el.textContent=amtStr===''?'0':amtStr; el.classList.toggle('zero',amtStr===''||parseFloat(amtStr)===0); }

async function doSave(){
  if(saving) return;
  const amt=parseFloat(amtStr||'0');
  if(!selectedCat){ toast('请先选一个类别'); return; }
  if(!(amt>0)){ toast('请先填金额'); return; }
  saving=true; const btn=document.getElementById('saveBtn'); btn.disabled=true;
  try{
    const { entry }=await api.entries.create({date:curDate,cat:selectedCat,amt:round2(amt)});
    entries.push(entry);
    toast('已记：'+entry.cat+' ¥'+fmt(entry.amt));
    amtStr=''; selectedCat=null; syncCatBtn(); renderAmt(); renderHeader();
  }catch(e){ if(!handleAuthErr(e)) toast(e.message||'保存失败'); }
  finally{ saving=false; btn.disabled=false; }
}
function renderDate(){ document.getElementById('dateInput').value=curDate; document.getElementById('todayTag').style.display=(curDate===todayStr())?'inline-block':'none'; }
function renderHeader(){ const t=entries.filter(e=>e.date===todayStr()).reduce((s,e)=>s+e.amt,0); document.getElementById('todayTotal').textContent=fmt(t); }

// ----- totals -----
function setGran(g){ gran=g; document.querySelectorAll('#granSeg button').forEach(b=>b.classList.toggle('on',b.dataset.g===g)); document.getElementById('main').scrollTop=0; renderTotals(); }
function shiftPeriod(step){
  if(gran==='day'){ const d=new Date(viewDay+'T00:00:00'); d.setDate(d.getDate()+step); viewDay=fmtDate(d); }
  else if(gran==='month'){ let [y,m]=viewMonth.split('-').map(Number); m+=step; if(m<1){m=12;y--;} if(m>12){m=1;y++;} viewMonth=y+'-'+pad2(m); }
  else{ viewYear=String(Number(viewYear)+step); }
  renderTotals();
}
function resetPeriod(){ const t=todayStr(); if(gran==='day') viewDay=t; else if(gran==='month') viewMonth=t.slice(0,7); else viewYear=t.slice(0,4); renderTotals(); }

function catCard(list,title){
  const m={}; list.forEach(e=>m[e.cat]=(m[e.cat]||0)+e.amt);
  const arr=Object.keys(m).map(c=>({c,v:m[c]})).sort((a,b)=>b.v-a.v);
  const max=arr[0].v||1;
  let h=`<div class="card"><div class="ttl">${title}</div>`;
  arr.forEach(o=>{ h+=`<div class="catrow"><div class="line"><span class="nm">${o.c}</span><span class="am num">¥${fmt(o.v)}</span></div><div class="bar"><i style="width:${Math.max(4,o.v/max*100)}%"></i></div></div>`; });
  return h+'</div>';
}
function dayEntries(list){
  const items=list.slice().sort((a,b)=>a.id<b.id?1:-1);
  return items.map(e=>`<div class="entry"><span class="ec">${e.cat}</span><span class="ea num">¥${fmt(e.amt)}</span><button class="del" data-id="${e.id}" aria-label="删除">${TRASH}</button></div>`).join('');
}
function dayDrill(list){
  const m={}; list.forEach(e=>{ const o=m[e.date]=m[e.date]||{t:0,n:0}; o.t+=e.amt; o.n++; });
  return Object.keys(m).sort().reverse().map(d=>`<div class="drillrow" data-day="${d}"><div class="dl"><div class="dd">${mdShort(d)} ${weekday(d)}</div><div class="dc">${m[d].n}笔</div></div><div class="dv num">¥${fmt(m[d].t)}</div><div class="ch">›</div></div>`).join('');
}
function monthDrill(list){
  const m={}; list.forEach(e=>{ const k=e.date.slice(0,7); const o=m[k]=m[k]||{t:0,n:0}; o.t+=e.amt; o.n++; });
  return Object.keys(m).sort().map(k=>`<div class="drillrow" data-month="${k}"><div class="dl"><div class="dd">${parseInt(k.split('-')[1])}月</div><div class="dc">${m[k].n}笔</div></div><div class="dv num">¥${fmt(m[k].t)}</div><div class="ch">›</div></div>`).join('');
}
function renderTotals(){
  const today=todayStr(); let label='',tag='',list=[];
  if(gran==='day'){ list=entries.filter(e=>e.date===viewDay); label=ymdLabel(viewDay); if(viewDay===today)tag='今天'; document.getElementById('totLab').textContent='当日总开支'; }
  else if(gran==='month'){ list=entries.filter(e=>e.date.slice(0,7)===viewMonth); const p=viewMonth.split('-'); label=p[0]+'年'+parseInt(p[1])+'月'; if(viewMonth===today.slice(0,7))tag='本月'; document.getElementById('totLab').textContent='本月总开支'; }
  else{ list=entries.filter(e=>e.date.slice(0,4)===viewYear); label=viewYear+'年'; if(viewYear===today.slice(0,4))tag='今年'; document.getElementById('totLab').textContent='本年总开支'; }
  const total=list.reduce((s,e)=>s+e.amt,0);
  document.getElementById('perTxt').innerHTML=label+(tag?` <span class="curtag">${tag}</span>`:'');
  document.getElementById('perTotal').textContent=fmt(total);

  const body=document.getElementById('totalsBody');
  if(list.length===0){ const w=gran==='day'?'这天':(gran==='month'?'这个月':'这一年'); body.innerHTML=`<div class="empty">${w}还没有记账。</div>`; return; }

  let html='';
  if(gran==='day'){ html+=dayEntries(list); }
  else if(gran==='month'){ html+=catCard(list,'按类别'); html+='<div class="seclabel" style="margin-top:2px;">按天（点开看明细）</div>'+dayDrill(list); }
  else{ html+='<div class="seclabel" style="margin-top:2px;">按月（点开看明细）</div>'+monthDrill(list)+catCard(list,'全年各类'); }
  body.innerHTML=html;

  if(gran==='day') body.querySelectorAll('.del').forEach(b=>b.onclick=()=>delEntry(Number(b.dataset.id)));
  else body.querySelectorAll('.drillrow').forEach(b=>b.onclick=()=>{ if(b.dataset.day) drillDay(b.dataset.day); else drillMonth(b.dataset.month); });
}
function drillDay(d){ viewDay=d; setGran('day'); }
function drillMonth(k){ viewMonth=k; setGran('month'); }

async function delEntry(id){
  const i=entries.findIndex(e=>e.id===id); if(i<0) return;
  const removed=entries[i];
  try{
    await api.entries.remove(id);
    entries.splice(i,1); renderTotals(); renderHeader();
    toast('已删除一笔','撤销',()=>undoDelete(removed));
  }catch(e){ if(!handleAuthErr(e)) toast(e.message||'删除失败'); }
}
async function undoDelete(removed){
  try{
    const { entry }=await api.entries.create({date:removed.date,cat:removed.cat,amt:removed.amt});
    entries.push(entry); renderTotals(); renderHeader();
  }catch(e){ if(!handleAuthErr(e)) toast('撤销失败'); }
}

function switchView(v){
  const rec=v==='record';
  document.getElementById('viewRecord').classList.toggle('hidden',!rec);
  document.getElementById('viewTotals').classList.toggle('hidden',rec);
  document.getElementById('tabRecord').classList.toggle('on',rec);
  document.getElementById('tabTotals').classList.toggle('on',!rec);
  document.getElementById('main').scrollTop=0;
  if(!rec) renderTotals();
}

async function doLogout(){
  try{ await api.auth.logout(); }catch{ /* clear client state regardless */ }
  location.replace('/login.html');
}

let toastT;
function toast(msg,actLabel,actFn){
  const el=document.getElementById('toast');
  el.innerHTML=`<span>${msg}</span>`+(actLabel?`<button class="tundo">${actLabel}</button>`:'');
  el.classList.add('show');
  if(actLabel) el.querySelector('.tundo').onclick=()=>{ actFn(); el.classList.remove('show'); clearTimeout(toastT); };
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),actLabel?3800:1700);
}

function bindEvents(){
  document.getElementById('saveBtn').onclick=doSave;
  document.getElementById('dateInput').onchange=e=>{ curDate=e.target.value||todayStr(); renderDate(); };
  document.querySelectorAll('#granSeg button').forEach(b=>b.onclick=()=>setGran(b.dataset.g));
  document.getElementById('prevP').onclick=()=>shiftPeriod(-1);
  document.getElementById('nextP').onclick=()=>shiftPeriod(1);
  document.getElementById('perTxt').onclick=resetPeriod;
  document.getElementById('tabRecord').onclick=()=>switchView('record');
  document.getElementById('tabTotals').onclick=()=>switchView('totals');
  document.getElementById('logoutBtn').onclick=doLogout;
  document.getElementById('catBtn').onclick=openCatSheet;
  document.getElementById('catSheetClose').onclick=closeCatSheet;
  document.getElementById('catSheet').onclick=e=>{ if(e.target.id==='catSheet') closeCatSheet(); };
}

async function init(){
  // Loading entries doubles as the auth guard: 401 -> redirect to login.
  try{
    const { entries:list }=await api.entries.list();
    entries=list;
  }catch(e){
    if(handleAuthErr(e)) return;
    toast('账目加载失败，请刷新');
    return;
  }

  try{ const { categories }=await api.categories.list(); if(Array.isArray(categories)&&categories.length) CATS=categories; }catch{ /* keep fallback */ }

  buildCatSheet(); buildPad();
  syncCatBtn(); renderAmt(); renderDate(); renderHeader();
  bindEvents();
}

init();
