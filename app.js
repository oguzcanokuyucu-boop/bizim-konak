const $ = s => document.querySelector(s);
const fmt = n => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

let DB = JSON.parse(localStorage.getItem('bk-db')||'null') || {
  settings:{business:'Bizim Konak',openingCash:0,owner:'Oğuzcan'},
  tx:[], receivables:[]
};
const save = () => localStorage.setItem('bk-db',JSON.stringify(DB));
const toast = m => { const t=$('#toast'); if(!t)return; t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); };

function dateTR(d=new Date()){
  return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',weekday:'long'}).format(d);
}
function shortDateTR(iso){
  const d=new Date(iso+'T12:00:00');
  return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',weekday:'short'}).format(d);
}
function monthKey(d){ return (d||todayISO()).slice(0,7); }
function currentMonthName(){
  return new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date()).toLocaleUpperCase('tr-TR');
}
function totals(filter=()=>true){
  const arr=DB.tx.filter(filter);
  const inc=arr.filter(x=>x.kind==='income').reduce((a,x)=>a+Number(x.amount||0),0);
  const exp=arr.filter(x=>x.kind==='expense').reduce((a,x)=>a+Number(x.amount||0),0);
  return {inc,exp,profit:inc-exp};
}
function dayBreakdown(date){
  const arr=DB.tx.filter(x=>x.date===date);
  const cash=arr.filter(x=>x.kind==='income'&&x.payment==='cash').reduce((a,x)=>a+Number(x.amount||0),0);
  const pos=arr.filter(x=>x.kind==='income'&&x.payment==='card').reduce((a,x)=>a+Number(x.amount||0),0);
  const staff=arr.filter(x=>x.kind==='expense'&&x.category==='Personel').reduce((a,x)=>a+Number(x.amount||0),0);
  const other=arr.filter(x=>x.kind==='expense'&&x.category!=='Personel').reduce((a,x)=>a+Number(x.amount||0),0);
  const expense=staff+other;
  return {cash,pos,staff,other,expense,turnover:cash+pos,profit:cash+pos-expense};
}
function monthDays(key=monthKey()){
  const dates=[...new Set(DB.tx.filter(x=>monthKey(x.date)===key).map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
  return dates.map(date=>({date,...dayBreakdown(date)}));
}
function monthTotals(key=monthKey()){
  const days=monthDays(key);
  return days.reduce((a,d)=>({cash:a.cash+d.cash,pos:a.pos+d.pos,expense:a.expense+d.expense,profit:a.profit+d.profit}),{cash:0,pos:0,expense:0,profit:0});
}

function renderNav(active){
  return `<nav class="nav">
    <button class="${active==='home'?'active':''}" onclick="go('home')"><span class="nicon">⌂</span>Ana Sayfa</button>
    <button class="${active==='day'?'active':''}" onclick="go('day')"><span class="nicon">▣</span>Gün Ekle</button>
    <button class="${active==='reports'?'active':''}" onclick="go('reports')"><span class="nicon">▥</span>Raporlar</button>
    <button class="${active==='receivables'?'active':''}" onclick="go('receivables')"><span class="nicon">♙</span>Veresiye</button>
    <button class="${active==='settings'?'active':''}" onclick="go('settings')"><span class="nicon">⚙︎</span>Ayarlar</button>
  </nav>`;
}

function home(){
  const mon=monthTotals();
  const days=monthDays();
  return `<div class="topbar">
    <div class="brand">
      <div class="logoMark">☕</div>
      <div><h1>${DB.settings.business}</h1><small>ÇAY EVİ</small></div>
      <button class="logoMark cardIcon" aria-label="Oyun simgesi" onclick="toast('Bizim Konak')">🂡</button>
    </div>
    <div class="dateRow"><b>☀️ Günaydın, ${DB.settings.owner||'Oğuzcan'}</b><button class="dateButton" onclick="go('days')">📅 ${dateTR()}</button></div>
  </div>
  <main class="page">
    <div class="cards twoMetrics">
      <div class="card metric cashMetric"><div class="label">TOPLAM NAKİT</div><div class="value">${fmt(mon.cash)}</div></div>
      <div class="card metric posMetric"><div class="label">TOPLAM POS</div><div class="value">${fmt(mon.pos)}</div></div>
    </div>

    <div class="monthHeading"><div><span>AYLIK KAYITLAR</span><b>${currentMonthName()}</b></div><button onclick="go('days')">Tüm Günler ›</button></div>
    <div class="tableCard">
      <div class="monthTable head"><span>Tarih</span><span>Nakit</span><span>POS</span><span>Gider</span><span>Kâr</span></div>
      ${days.length?days.map(d=>`<button class="monthTable data" onclick="editDay('${d.date}')">
        <span class="dayDate">${shortDateTR(d.date)}</span><span class="green">${fmt(d.cash)}</span><span class="blue">${fmt(d.pos)}</span><span class="red">${fmt(d.expense)}</span><span class="green">${fmt(d.profit)}</span>
      </button>`).join(''):'<div class="empty">Bu ay henüz günlük kayıt yok. Alt menüden “Gün Ekle” ile başlayabilirsin.</div>'}
    </div>
  </main>${renderNav('home')}`;
}

function dayForm(date=todayISO(), editing=false){
  const d=editing?dayBreakdown(date):{cash:0,pos:0,staff:0,other:0};
  return `<header class="headerGreen"><button onclick="${editing?"go('days')":"go('home')"}">‹</button><h2>${editing?'Gün Düzenle':'Gün Ekle'}</h2><span class="saveGlyph">▣</span></header>
  <main class="page"><div class="formCard">
    <div class="field"><label>Tarih</label><input id="dayDate" type="date" value="${date}" ${editing?'disabled':''}></div>
    <div class="field"><label>Nakit Satış</label><input id="dayCash" type="number" inputmode="decimal" min="0" step="0.01" value="${d.cash||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>POS Satış</label><input id="dayPos" type="number" inputmode="decimal" min="0" step="0.01" value="${d.pos||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>Personel</label><input id="dayStaff" type="number" inputmode="decimal" min="0" step="0.01" value="${d.staff||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>Diğer Giderler</label><input id="dayExpense" type="number" inputmode="decimal" min="0" step="0.01" value="${d.other||''}" placeholder="0,00 TL"></div>
    <div class="summaryGrid">
      <div class="miniSummary"><span>TOPLAM SATIŞ</span><b id="dayTurnover" class="green">${fmt(0)}</b></div>
      <div class="miniSummary"><span>TOPLAM GİDER</span><b id="dayTotalExpense" class="red">${fmt(0)}</b></div>
    </div>
    <div class="netSummary"><span>NET KÂR</span><b id="dayNet">${fmt(0)}</b></div>
    ${editing?'<div class="editNote">Bu kayıt kaydedildiğinde seçili günün gelir ve giderleri 4 kalem halinde güncellenir.</div>':''}
    <button class="primary" onclick="saveDay(${editing?'true':'false'})">${editing?'Değişiklikleri Kaydet':'Günü Kaydet'}</button>
  </div></main>${renderNav('day')}`;
}
function dayNumber(id){ return Math.max(0,Number($(id)?.value||0)); }
function updateDayPreview(){
  const turnover=dayNumber('#dayCash')+dayNumber('#dayPos');
  const expense=dayNumber('#dayStaff')+dayNumber('#dayExpense');
  if($('#dayTurnover')) $('#dayTurnover').textContent=fmt(turnover);
  if($('#dayTotalExpense')) $('#dayTotalExpense').textContent=fmt(expense);
  if($('#dayNet')) $('#dayNet').textContent=fmt(turnover-expense);
}
function bindDayPreview(){ ['#dayCash','#dayPos','#dayStaff','#dayExpense'].forEach(id=>$(id)?.addEventListener('input',updateDayPreview)); updateDayPreview(); }
function writeDay(date,cash,pos,staff,expense){
  DB.tx=DB.tx.filter(x=>x.date!==date);
  const created=new Date().toISOString(),dayId=uid();
  if(cash>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'income',category:'Nakit Satış',amount:cash,payment:'cash',date,note:'Günlük kayıt',created});
  if(pos>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'income',category:'POS Satış',amount:pos,payment:'card',date,note:'Günlük kayıt',created});
  if(staff>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'expense',category:'Personel',amount:staff,payment:'cash',date,note:'Günlük kayıt',created});
  if(expense>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'expense',category:'Diğer Giderler',amount:expense,payment:'cash',date,note:'Günlük kayıt',created});
}
function saveDay(editing=false){
  const date=$('#dayDate').value||todayISO();
  const cash=dayNumber('#dayCash'),pos=dayNumber('#dayPos'),staff=dayNumber('#dayStaff'),expense=dayNumber('#dayExpense');
  if(cash+pos+staff+expense<=0){ toast('En az bir tutar gir'); return; }
  if(!editing && DB.tx.some(x=>x.date===date) && !confirm('Bu tarih için kayıt var. Var olan gün kaydı değiştirilsin mi?')) return;
  writeDay(date,cash,pos,staff,expense); save(); toast(editing?'Gün güncellendi':'Gün kaydedildi'); go('home');
}
function editDay(date){ $('#app').innerHTML=dayForm(date,true); bindDayPreview(); window.scrollTo(0,0); }

function daysPage(){
  const dates=[...new Set(DB.tx.map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Günlük Kayıtlar</h2><span style="width:24px"></span></header>
  <main class="page"><div class="subtleText">Düzenlemek istediğin güne dokun.</div>
    <div class="sectionTitle">TÜM GÜNLER</div>
    <div class="list">${dates.length?dates.map(date=>{const d=dayBreakdown(date);return `<button class="dayListRow" onclick="editDay('${date}')"><div><b>${dateTR(new Date(date+'T12:00:00'))}</b><small>Nakit ${fmt(d.cash)} · POS ${fmt(d.pos)} · Gider ${fmt(d.expense)}</small></div><span>${fmt(d.profit)} ›</span></button>`}).join(''):'<div class="empty">Henüz kayıt yok.</div>'}</div>
  </main>${renderNav('')}`;
}

function reports(){
  const m=monthTotals();
  const days=[...monthDays()].reverse();
  const turnover=m.cash+m.pos;
  const cashPct=turnover?Math.round(m.cash/turnover*100):0;
  const posPct=turnover?100-cashPct:0;
  const maxProfit=Math.max(1,...days.map(d=>Math.max(0,d.profit)));
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Raporlar</h2><span style="width:24px"></span></header>
  <main class="page reportPage">
    <div class="periodTabs"><button>Günlük</button><button class="active">Aylık</button><button>Yıllık</button></div>
    <div class="reportMonth">${currentMonthName()}</div>
    <div class="reportCards">
      <div class="reportMetric"><span>TOPLAM NAKİT</span><b class="green">${fmt(m.cash)}</b></div>
      <div class="reportMetric"><span>TOPLAM POS</span><b class="blue">${fmt(m.pos)}</b></div>
      <div class="reportMetric"><span>TOPLAM KÂR</span><b class="green">${fmt(m.profit)}</b></div>
    </div>
    <div class="card reportBlock"><h3>Nakit / POS Dağılımı</h3>
      <div class="donutWrap"><div class="donut" style="--cash:${cashPct*3.6}deg"></div><div class="legend"><div><i class="cashDot"></i><span>Nakit</span><b>${cashPct}% · ${fmt(m.cash)}</b></div><div><i class="posDot"></i><span>POS</span><b>${posPct}% · ${fmt(m.pos)}</b></div></div></div>
    </div>
    <div class="card reportBlock"><h3>Günlere Göre Kâr</h3>
      ${days.length?`<div class="profitChart">${days.map(d=>`<div class="profitCol"><div class="profitBar" style="height:${Math.max(4,(Math.max(0,d.profit)/maxProfit)*100)}%"></div><span>${d.date.slice(8)}</span></div>`).join('')}</div>`:'<div class="empty">Grafik için günlük kayıt gerekiyor.</div>'}
    </div>
    <div class="card reportBlock"><div class="statline"><span>Toplam Satış</span><b>${fmt(turnover)}</b></div><div class="statline"><span>Toplam Gider</span><b class="red">${fmt(m.expense)}</b></div><div class="statline"><span>Kâr Marjı</span><b>%${turnover?((m.profit/turnover)*100).toFixed(1):'0.0'}</b></div></div>
  </main>${renderNav('reports')}`;
}

function receivables(){
  const total=DB.receivables.filter(r=>!r.paid).reduce((a,r)=>a+Number(r.amount||0),0);
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Veresiye Defteri</h2><button onclick="addReceivable()">＋</button></header>
  <main class="page"><div class="card"><div class="statline"><span>Toplam Açık Veresiye</span><b>${fmt(total)}</b></div></div>
    <div class="sectionTitle">MÜŞTERİ KAYITLARI</div>
    <div class="list">${DB.receivables.length?DB.receivables.map(r=>`<div class="receivableRow"><div class="avatar">${(r.name||'?').trim().charAt(0).toLocaleUpperCase('tr-TR')}</div><div class="recText"><b>${r.name}</b><strong class="${r.paid?'green':'red'}">${fmt(r.amount)}</strong><small>${r.note||'Açıklama yok'} · ${r.date}</small></div><div class="recActions"><button onclick="toggleRec('${r.id}')">${r.paid?'↶':'✓'}</button><button class="trash" onclick="deleteRec('${r.id}')">🗑</button></div></div>`).join(''):'<div class="empty">Veresiye kaydı yok.</div>'}</div>
  </main>${renderNav('receivables')}`;
}
function addReceivable(){
  const name=prompt('Müşteri adı'); if(!name)return;
  const amount=Number(prompt('Tutar (TL)')); if(!amount)return;
  const note=prompt('Açıklama (isteğe bağlı)')||'';
  DB.receivables.unshift({id:uid(),name,amount,note,date:todayISO(),paid:false}); save(); go('receivables');
}
function toggleRec(id){ const r=DB.receivables.find(x=>x.id===id); if(r){r.paid=!r.paid;save();go('receivables');} }
function deleteRec(id){ const r=DB.receivables.find(x=>x.id===id); if(!r)return; if(confirm(`${r.name} veresiye kaydı silinsin mi?`)){DB.receivables=DB.receivables.filter(x=>x.id!==id);save();toast('Veresiye silindi');go('receivables');} }

function settings(){
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Ayarlar</h2><span style="width:24px"></span></header>
  <main class="page">
    <div class="card" style="text-align:center"><img src="icon-192.png" style="width:74px;border-radius:20px"><h2 style="font-family:Georgia,serif;color:#1f5a3a;margin-bottom:4px">${DB.settings.business}</h2><span class="pill">ÇAY EVİ</span></div>
    <div class="sectionTitle">UYGULAMA</div><div class="list">
      <button class="settingsBtn" onclick="editBusiness()">İş Yeri Bilgileri <span>›</span></button>
      <button class="settingsBtn" onclick="exportCSV()">Verileri CSV Olarak Dışa Aktar <span>›</span></button>
      <button class="settingsBtn" onclick="backupJSON()">Tam Yedek Al <span>›</span></button>
      <button class="settingsBtn" onclick="clearAll()">Tüm Verileri Temizle <span>›</span></button>
    </div>
  </main>${renderNav('settings')}`;
}
function editBusiness(){ let b=prompt('İşletme adı',DB.settings.business); if(b){DB.settings.business=b;let o=prompt('Karşılama adı',DB.settings.owner||'');if(o!==null)DB.settings.owner=o;save();go('settings');} }
function download(name,text,type='text/plain'){ const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove(); }
function exportCSV(){
  const rows=[['Tarih','Tür','Kategori','Tutar','Ödeme','Açıklama'],...DB.tx.map(x=>[x.date,x.kind==='income'?'Gelir':'Gider',x.category,x.amount,x.payment==='cash'?'Nakit':'POS',x.note||''])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
  download('bizim-konak-islemler.csv','\ufeff'+csv,'text/csv;charset=utf-8'); toast('CSV hazırlandı');
}
function backupJSON(){ download('bizim-konak-yedek.json',JSON.stringify(DB,null,2),'application/json'); toast('Yedek hazırlandı'); }
function clearAll(){ if(confirm('Tüm günlük ve veresiye kayıtları silinsin mi?')){DB.tx=[];DB.receivables=[];save();go('settings');} }

function go(page){
  const app=$('#app');
  if(page==='day'){app.innerHTML=dayForm();bindDayPreview();}
  else if(page==='days')app.innerHTML=daysPage();
  else if(page==='reports')app.innerHTML=reports();
  else if(page==='receivables')app.innerHTML=receivables();
  else if(page==='settings')app.innerHTML=settings();
  else app.innerHTML=home();
  window.scrollTo(0,0);
}

go('home');
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
