import { api, ApiError } from './api.js';

// Fallback lists if /api/categories can't be reached; the server is the source of truth.
let CATS = {
  expense: ['淡村采购','一次性用品','烧烤冻品进货','烧烤雪花牛肉','煤气','植物油','白切酱油花生油','半成品鱼片','饮料','大米','配料','鸭头鸭脚','员工菜','人工','房租','水电','其他'],
  income: ['营业额','其他收入'],
};
let entryType = 'expense'; // 当前记账类型：expense 支出 / income 收入
const WD = ['周日','周一','周二','周三','周四','周五','周六'];
const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

let entries = [];
let saving = false;
let isOwner = true; // 老板看利润/收入；员工只看经营开支
let editingCats = false; // 类别管理"编辑"模式（仅老板）
let currentUser = null; // { username, role }
let editingId = null; // 非空 = 正在编辑该 id；否则为新增
let oneTime = false; // 当前这笔是否「一次性支出」（装修/大件，不计入月利润；仅老板可设）

// ----- formatting helpers -----
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => round2(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const todayStr = () => fmtDate(new Date());
const isIncome = (e) => e.type === 'income';
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
const curCats = () => CATS[entryType];

function buildCatSheet(){
  const grid=document.getElementById('catSheetGrid');
  let html=curCats().map((c,i)=>`<button class="sheet-cat" data-i="${i}" type="button"><span class="del-x">✕</span>${c}</button>`).join('');
  if(isOwner) html+='<button class="sheet-cat addtile" type="button" data-add="1">＋ 添加</button>';
  grid.innerHTML=html;
  grid.classList.toggle('editing', editingCats);
  grid.querySelectorAll('.sheet-cat').forEach(b=>{
    b.onclick=()=>{
      if(b.dataset.add){ openCatAdd(); return; }
      const name=curCats()[+b.dataset.i];
      if(editingCats){ delCat(name); return; }
      selectedCat=name; syncCatBtn(); closeCatSheet();
    };
  });
  syncCatBtn();
}
function syncCatBtn(){
  document.getElementById('catBtnText').textContent=selectedCat||'请选择类别';
  document.getElementById('catBtn').classList.toggle('chosen',!!selectedCat);
  document.querySelectorAll('#catSheetGrid .sheet-cat').forEach(b=>b.classList.toggle('on',curCats()[+b.dataset.i]===selectedCat));
}
function setEntryType(t){
  if(t===entryType) return;
  entryType=t;
  document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  selectedCat = (t==='income') ? (CATS.income[0]||null) : null; // 收入默认选第一个(营业额)
  oneTime=false; syncOneTimeUI(); // 切换类型时重置「一次性」（收入没有这个概念）
  buildCatSheet();
}
// 「一次性」开关只在 老板 + 支出 时出现；其余情况隐藏。同步勾选状态与高亮。
function syncOneTimeUI(){
  const row=document.getElementById('oneTimeRow'), chk=document.getElementById('oneTimeChk');
  const show = isOwner && entryType==='expense';
  if(row){ row.classList.toggle('hidden', !show); row.classList.toggle('on', show && oneTime); }
  if(chk) chk.checked = oneTime;
}
function openCatSheet(){ document.getElementById('catSheet').classList.remove('hidden'); }
function closeCatSheet(){
  document.getElementById('catSheet').classList.add('hidden');
  if(editingCats){ editingCats=false; const e=document.getElementById('catEdit'); if(e) e.textContent='编辑'; document.getElementById('catSheetGrid').classList.remove('editing'); }
  closeCatAdd();
}

// ----- 类别管理（仅老板）-----
function toggleCatEdit(){
  editingCats=!editingCats;
  const e=document.getElementById('catEdit'); if(e) e.textContent=editingCats?'完成':'编辑';
  document.getElementById('catSheetGrid').classList.toggle('editing', editingCats);
  closeCatAdd();
}
function openCatAdd(){ document.getElementById('catAdd').classList.remove('hidden'); document.getElementById('catNewName').focus(); }
function closeCatAdd(){ const a=document.getElementById('catAdd'); if(a) a.classList.add('hidden'); const n=document.getElementById('catNewName'); if(n) n.value=''; }
async function saveCatAdd(){
  const name=document.getElementById('catNewName').value.trim();
  if(!name){ toast('请输入类别名称'); return; }
  try{
    const lists=await api.categories.add(entryType, name);
    if(lists){ CATS.expense=lists.expense||CATS.expense; CATS.income=lists.income||CATS.income; }
    selectedCat=name; closeCatAdd(); buildCatSheet(); closeCatSheet();
    toast('已添加「'+name+'」');
  }catch(e){ if(!handleAuthErr(e)) toast(e.message||'添加失败'); }
}
async function delCat(name){
  if(!confirm('删除「'+name+'」？已记的账不受影响')) return;
  try{
    const lists=await api.categories.remove(entryType, name);
    if(lists){ CATS.expense=lists.expense||[]; CATS.income=lists.income||[]; }
    if(selectedCat===name) selectedCat=null;
    buildCatSheet();
  }catch(e){ if(!handleAuthErr(e)) toast(e.message||'删除失败'); }
}
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
    const payload={type:entryType,date:curDate,cat:selectedCat,amt:round2(amt),oneTime:(entryType==='expense'&&oneTime)};
    if(editingId){
      const { entry }=await api.entries.update(editingId, payload);
      const i=entries.findIndex(x=>x.id===editingId); if(i>=0) entries[i]=entry;
      resetRecordState(); renderHeader(); toast('已修改'); switchView('totals');
    } else {
      const { entry }=await api.entries.create(payload);
      entries.push(entry);
      const tip=entryType==='income'?'已记收入：':(entry.oneTime?'已记一次性支出：':'已记支出：');
      toast(tip+entry.cat+' ¥'+fmt(entry.amt));
      amtStr=''; selectedCat=(entryType==='income')?'营业额':null; oneTime=false; syncOneTimeUI(); syncCatBtn(); renderAmt(); renderHeader();
    }
  }catch(e){ if(!handleAuthErr(e)) toast(e.message||'保存失败'); }
  finally{ saving=false; btn.disabled=false; }
}
function renderDate(){ document.getElementById('dateInput').value=curDate; document.getElementById('todayTag').style.display=(curDate===todayStr())?'inline-block':'none'; }
// 顶部「今天」显示当天支出，作为花了多少的快速一瞥
function renderHeader(){ const t=entries.filter(e=>e.date===todayStr()&&!isIncome(e)).reduce((s,e)=>s+e.amt,0); document.getElementById('todayTotal').textContent=fmt(t); }

// ----- 编辑已记的账（复用记账界面当编辑器）-----
function setEditMode(on){
  document.getElementById('saveBtn').textContent = on ? '保存修改' : '记一笔';
  const c=document.getElementById('cancelEdit'); if(c) c.classList.toggle('hidden', !on);
}
function resetRecordState(){
  editingId=null; setEditMode(false);
  entryType='expense';
  document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t==='expense'));
  selectedCat=null; amtStr=''; oneTime=false;
  buildCatSheet(); renderAmt(); syncOneTimeUI();
}
function editEntry(id){
  const e=entries.find(x=>x.id===id); if(!e) return;
  editingId=id; entryType=e.type; oneTime=!!e.oneTime;
  document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===entryType));
  selectedCat=e.cat; curDate=e.date; amtStr=String(e.amt);
  buildCatSheet(); syncCatBtn(); renderAmt(); renderDate(); syncOneTimeUI(); setEditMode(true);
  switchView('record');
}

// ----- totals / 利润 -----
function setGran(g){ gran=g; document.querySelectorAll('#granSeg button').forEach(b=>b.classList.toggle('on',b.dataset.g===g)); document.getElementById('main').scrollTop=0; renderTotals(); }
function shiftPeriod(step){
  if(gran==='day'){ const d=new Date(viewDay+'T00:00:00'); d.setDate(d.getDate()+step); viewDay=fmtDate(d); }
  else if(gran==='month'){ let [y,m]=viewMonth.split('-').map(Number); m+=step; if(m<1){m=12;y--;} if(m>12){m=1;y++;} viewMonth=y+'-'+pad2(m); }
  else{ viewYear=String(Number(viewYear)+step); }
  renderTotals();
}
function resetPeriod(){ const t=todayStr(); if(gran==='day') viewDay=t; else if(gran==='month') viewMonth=t.slice(0,7); else viewYear=t.slice(0,4); renderTotals(); }

// 支出构成（只统计支出）
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
  return items.map(e=>{
    const tag = e.oneTime ? '<span class="otag">一次性</span>' : '';
    return `<div class="entry${isIncome(e)?' income':''}${e.oneTime?' onetime':''}" data-id="${e.id}"><span class="ec">${e.cat}${tag}</span><span class="ea num">${isIncome(e)?'+':''}¥${fmt(e.amt)}</span><button class="del" data-id="${e.id}" aria-label="删除">${TRASH}</button></div>`;
  }).join('');
}
function periodRow(key,label,o){
  if(isOwner){
    const net=round2(o.inc-o.exp); // 净利 = 收 − 日常支出（不含一次性）
    const oneNote = o.one>0 ? ` · <span class="one">一次性 ¥${fmt(o.one)}</span>` : '';
    return `<div class="drillrow" data-${key.k}="${key.v}"><div class="dl"><div class="dd">${label}</div><div class="io"><span class="in">收 ¥${fmt(o.inc)}</span> · 支 ¥${fmt(o.exp)}${oneNote}</div></div><div class="dv num">¥${fmt(net)}</div><div class="ch">›</div></div>`;
  }
  return `<div class="drillrow" data-${key.k}="${key.v}"><div class="dl"><div class="dd">${label}</div></div><div class="dv num">¥${fmt(o.exp)}</div><div class="ch">›</div></div>`;
}
// 聚合：一次性支出单独累到 o.one，不进 o.exp（保证净利与月利润口径一致）
function bucket(m,k,e){ const o=m[k]=m[k]||{inc:0,exp:0,one:0}; if(isIncome(e))o.inc+=e.amt; else if(e.oneTime)o.one+=e.amt; else o.exp+=e.amt; return m; }
function dayDrill(list){
  const m={}; list.forEach(e=>bucket(m,e.date,e));
  return Object.keys(m).sort().reverse().map(d=>periodRow({k:'day',v:d},`${mdShort(d)} ${weekday(d)}`,m[d])).join('');
}
function monthDrill(list){
  const m={}; list.forEach(e=>bucket(m,e.date.slice(0,7),e));
  return Object.keys(m).sort().map(k=>periodRow({k:'month',v:k},`${parseInt(k.split('-')[1])}月`,m[k])).join('');
}

function renderTotals(){
  const today=todayStr(); let label='',tag='',list=[],per='';
  if(gran==='day'){ list=entries.filter(e=>e.date===viewDay); label=ymdLabel(viewDay); if(viewDay===today)tag='今天'; per='当日'; }
  else if(gran==='month'){ list=entries.filter(e=>e.date.slice(0,7)===viewMonth); const p=viewMonth.split('-'); label=p[0]+'年'+parseInt(p[1])+'月'; if(viewMonth===today.slice(0,7))tag='本月'; per='本月'; }
  else{ list=entries.filter(e=>e.date.slice(0,4)===viewYear); label=viewYear+'年'; if(viewYear===today.slice(0,4))tag='今年'; per='本年'; }

  // 一次性支出（装修/大件）不计入经营利润，单独统计
  const opExp=list.filter(e=>!isIncome(e)&&!e.oneTime); // 日常支出（计入利润）
  const oneTimeExp=list.filter(e=>!isIncome(e)&&e.oneTime).reduce((s,e)=>s+e.amt,0);
  const income=list.filter(isIncome).reduce((s,e)=>s+e.amt,0);
  const expense=opExp.reduce((s,e)=>s+e.amt,0);
  document.getElementById('perTxt').innerHTML=label+(tag?` <span class="curtag">${tag}</span>`:'');

  const sub=document.querySelector('.bigtotal .profitsub');
  if(isOwner){
    const profit=round2(income-expense); // 利润 = 收入 − 日常支出（不含一次性）
    const margin= income>0 ? Math.round(profit/income*1000)/10 : null;
    document.getElementById('totLab').textContent=per+'利润';
    document.getElementById('perProfit').textContent=fmt(profit);
    document.getElementById('perIncome').textContent=fmt(income);
    document.getElementById('perExpense').textContent=fmt(expense);
    document.getElementById('perMargin').textContent= margin==null ? '—' : margin+'%';
    const otWrap=document.getElementById('perOneTimeWrap');
    if(otWrap){ otWrap.classList.toggle('hidden', !(oneTimeExp>0)); document.getElementById('perOneTime').textContent=fmt(oneTimeExp); }
    if(sub) sub.style.display='';
    // 说明利润怎么算 + 一次性不计入（让用户不用自己反推）
    const cap=document.getElementById('profitCap');
    if(cap){ cap.textContent='利润 = 收入 − 日常支出'+(oneTimeExp>0?'（一次性投入不计入）':''); cap.classList.remove('hidden'); }
  } else {
    document.getElementById('totLab').textContent=per+'支出';
    document.getElementById('perProfit').textContent=fmt(expense);
    if(sub) sub.style.display='none';
    const cap=document.getElementById('profitCap');
    if(cap) cap.classList.add('hidden');
  }

  const body=document.getElementById('totalsBody');
  if(list.length===0){ const w=gran==='day'?'这天':(gran==='month'?'这个月':'这一年'); const hint=isOwner?'记一笔收入和支出，就能看到利润。':''; body.innerHTML=`<div class="empty">${w}还没有记账。${hint?'<br>'+hint:''}</div>`; return; }

  let html='';
  if(gran==='day'){ html+=dayEntries(list); }
  else if(gran==='month'){ if(opExp.length) html+=catCard(opExp,'支出构成'); html+='<div class="seclabel" style="margin-top:2px;">按天（点开看明细）</div>'+dayDrill(list); }
  else{ html+='<div class="seclabel" style="margin-top:2px;">按月（点开看明细）</div>'+monthDrill(list); if(opExp.length) html+=catCard(opExp,'全年支出构成'); }
  body.innerHTML=html;

  if(gran==='day'){
    body.querySelectorAll('.entry').forEach(row=>{ row.onclick=()=>editEntry(Number(row.dataset.id)); });
    body.querySelectorAll('.del').forEach(b=>{ b.onclick=(ev)=>{ ev.stopPropagation(); delEntry(Number(b.dataset.id)); }; });
  } else body.querySelectorAll('.drillrow').forEach(b=>b.onclick=()=>{ if(b.dataset.day) drillDay(b.dataset.day); else drillMonth(b.dataset.month); });
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
    const { entry }=await api.entries.create({type:removed.type,date:removed.date,cat:removed.cat,amt:removed.amt,oneTime:removed.oneTime});
    entries.push(entry); renderTotals(); renderHeader();
  }catch(e){ if(!handleAuthErr(e)) toast('撤销失败'); }
}

function switchView(v){
  if(v!=='record' && editingId) resetRecordState(); // 离开编辑器视为取消修改
  const rec=v==='record';
  document.getElementById('viewRecord').classList.toggle('hidden',!rec);
  document.getElementById('viewTotals').classList.toggle('hidden',rec);
  document.getElementById('tabRecord').classList.toggle('on',rec);
  document.getElementById('tabTotals').classList.toggle('on',!rec);
  document.getElementById('main').scrollTop=0;
  if(!rec){ renderTotals(); refresh(); } // 先显示缓存(秒开)，再后台拉最新
}

function openAcct(){ document.getElementById('acctMenu').classList.remove('hidden'); }
function closeAcct(){ document.getElementById('acctMenu').classList.add('hidden'); }
async function doLogout(){
  if(!confirm('确定退出登录？')) return;
  try{ await api.auth.logout(); }catch{ /* clear client state regardless */ }
  location.replace('/login.html');
}

// 重新拉取账目（切到账目页 / App 重新回到前台时调用，解决多设备看旧账）
async function refresh(){
  try{
    const { entries:list }=await api.entries.list();
    entries=list;
    renderHeader();
    if(!document.getElementById('viewTotals').classList.contains('hidden')) renderTotals();
  }catch(e){ handleAuthErr(e); }
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
  document.getElementById('cancelEdit').onclick=()=>switchView('totals');
  document.getElementById('oneTimeChk').onchange=e=>{ oneTime=e.target.checked; syncOneTimeUI(); };
  document.getElementById('dateInput').onchange=e=>{ curDate=e.target.value||todayStr(); renderDate(); };
  document.querySelectorAll('#typeSeg button').forEach(b=>b.onclick=()=>setEntryType(b.dataset.t));
  document.querySelectorAll('#granSeg button').forEach(b=>b.onclick=()=>setGran(b.dataset.g));
  document.getElementById('prevP').onclick=()=>shiftPeriod(-1);
  document.getElementById('nextP').onclick=()=>shiftPeriod(1);
  document.getElementById('perTxt').onclick=resetPeriod;
  document.getElementById('tabRecord').onclick=()=>switchView('record');
  document.getElementById('tabTotals').onclick=()=>switchView('totals');
  document.getElementById('acctBtn').onclick=openAcct;
  document.getElementById('acctMenu').onclick=e=>{ if(e.target.id==='acctMenu') closeAcct(); };
  document.getElementById('logoutBtn').onclick=doLogout;
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') refresh(); });
  document.getElementById('catBtn').onclick=openCatSheet;
  document.getElementById('catSheetClose').onclick=closeCatSheet;
  document.getElementById('catSheet').onclick=e=>{ if(e.target.id==='catSheet') closeCatSheet(); };
  const catEdit=document.getElementById('catEdit'); if(catEdit) catEdit.onclick=toggleCatEdit;
  document.getElementById('catAddSave').onclick=saveCatAdd;
  document.getElementById('catAddCancel').onclick=closeCatAdd;
  document.getElementById('catNewName').addEventListener('keydown', e=>{ if(e.key==='Enter') saveCatAdd(); });
}

function applyRoleUI(){
  // 员工没有「收入/支出」切换、也不能管理类别
  const seg=document.getElementById('typeSeg');
  if(seg) seg.style.display = isOwner ? '' : 'none';
  const edit=document.getElementById('catEdit');
  if(edit) edit.classList.toggle('hidden', !isOwner);
  if(!isOwner) entryType='expense';
  syncOneTimeUI(); // 员工 / 收入 时隐藏「一次性」开关
}

async function init(){
  // me() 作为登录守卫 + 拿到角色
  try{
    const { user }=await api.auth.me();
    currentUser = user;
    isOwner = user.role !== 'staff';
  }catch(e){
    if(handleAuthErr(e)) return;
    toast('加载失败，请刷新页面');
    return;
  }
  applyRoleUI();
  document.getElementById('acctName').textContent=(isOwner?'老板':'员工')+' · '+(currentUser.username||'');

  try{
    const { entries:list }=await api.entries.list();
    entries=list;
  }catch(e){
    if(handleAuthErr(e)) return;
    toast('账目加载失败，请刷新');
    return;
  }

  try{
    const { expense, income }=await api.categories.list();
    if(Array.isArray(expense)&&expense.length) CATS.expense=expense;
    CATS.income=Array.isArray(income)?income:[];
  }catch{ /* keep fallback */ }

  buildCatSheet(); buildPad();
  syncCatBtn(); renderAmt(); renderDate(); renderHeader();
  bindEvents();
}

init();
