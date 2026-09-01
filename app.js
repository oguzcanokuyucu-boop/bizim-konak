const $ = s => document.querySelector(s);
const fmt = n => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

let DB = JSON.parse(localStorage.getItem('bk-db')||'null') || {
  settings:{business:'Bizim Konak',openingCash:0,owner:'Oğuzcan'},
  tx:[], receivables:[], bankPos:[]
};
DB.tx=Array.isArray(DB.tx)?DB.tx:[];
DB.receivables=Array.isArray(DB.receivables)?DB.receivables:[];
DB.bankPos=Array.isArray(DB.bankPos)?DB.bankPos:[];
DB.settings=DB.settings||{business:'Bizim Konak',openingCash:0,owner:'Oğuzcan'};
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
function monthNameFromKey(key=monthKey()){
  const [y,m]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1)).toLocaleUpperCase('tr-TR');
}
function currentMonthName(){ return monthNameFromKey(monthKey()); }
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
  const staff=arr.filter(x=>x.kind==='expense'&&x.category==='Personel'&&x.source!=='extra-expense').reduce((a,x)=>a+Number(x.amount||0),0);
  const dailyOther=arr.filter(x=>x.kind==='expense'&&x.source!=='extra-expense'&&x.category!=='Personel').reduce((a,x)=>a+Number(x.amount||0),0);
  const extraExpense=arr.filter(x=>x.kind==='expense'&&x.source==='extra-expense').reduce((a,x)=>a+Number(x.amount||0),0);
  const other=dailyOther+extraExpense;
  const expense=staff+other;
  return {cash,pos,staff,dailyOther,extraExpense,other,expense,turnover:cash+pos,profit:cash+pos-expense};
}
function monthDays(key=monthKey()){
  const dates=[...new Set(DB.tx.filter(x=>monthKey(x.date)===key).map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
  return dates.map(date=>({date,...dayBreakdown(date)}));
}
function monthTotals(key=monthKey()){
  const days=monthDays(key);
  return days.reduce((a,d)=>({cash:a.cash+d.cash,pos:a.pos+d.pos,expense:a.expense+d.expense,profit:a.profit+d.profit}),{cash:0,pos:0,expense:0,profit:0});
}
function cashBoxBalance(key=monthKey(), throughDate=null){
  const rows=DB.tx.filter(x=>monthKey(x.date)===key && (!throughDate || x.date<=throughDate));
  const cashSales=rows.filter(x=>x.kind==='income'&&x.payment==='cash').reduce((a,x)=>a+Number(x.amount||0),0);
  const staffPaid=rows.filter(x=>x.kind==='expense'&&x.category==='Personel'&&x.source!=='extra-expense').reduce((a,x)=>a+Number(x.amount||0),0);
  const extraCash=rows.filter(x=>x.kind==='expense'&&x.source==='extra-expense'&&x.payment==='cash').reduce((a,x)=>a+Number(x.amount||0),0);
  return cashSales-staffPaid-extraCash;
}
function dayCashAdded(date){
  const d=dayBreakdown(date);
  const extraCash=DB.tx.filter(x=>x.date===date&&x.kind==='expense'&&x.source==='extra-expense'&&x.payment==='cash').reduce((a,x)=>a+Number(x.amount||0),0);
  return d.cash-d.staff-extraCash;
}
function monthDaysWithCashBox(key=monthKey()){
  return monthDays(key).map(d=>({...d,cashAdded:dayCashAdded(d.date),cashBox:cashBoxBalance(key,d.date)}));
}
function bankPosForMonth(key=monthKey()){
  return DB.bankPos.filter(x=>monthKey(x.date)===key).sort((a,b)=>b.date.localeCompare(a.date));
}
function bankPosTotal(key=monthKey()){
  return bankPosForMonth(key).reduce((a,x)=>a+Number(x.amount||0),0);
}
function posReconciliation(key=monthKey()){
  const sold=monthTotals(key).pos;
  const deposited=bankPosTotal(key);
  const diff=sold-deposited;
  const pct=sold?Math.abs(diff)/sold*100:0;
  let status='Kayıt Bekleniyor', cls='neutral';
  if(sold>0){
    if(pct<=5){ status='Normal / Komisyon Toleransı'; cls='ok'; }
    else { status='Kontrol Et'; cls='warn'; }
  }
  return {sold,deposited,diff,pct,status,cls};
}

function renderNav(active){
  return `<nav class="nav">
    <button class="${active==='home'?'active':''}" onclick="go('home')"><span class="nicon">⌂</span>Ana Sayfa</button>
    <button class="${active==='day'?'active':''}" onclick="go('day')"><span class="nicon">▣</span>Gün Ekle</button>
    <button class="${active==='expense'?'active':''}" onclick="go('expense')"><span class="nicon">−₺</span>Gider Ekle</button>
    <button class="${active==='reports'?'active':''}" onclick="go('reports')"><span class="nicon">▥</span>Raporlar</button>
    <button class="${active==='receivables'?'active':''}" onclick="go('receivables')"><span class="nicon">♙</span>Veresiye</button>
    <button class="${active==='settings'?'active':''}" onclick="go('settings')"><span class="nicon">⚙︎</span>Ayarlar</button>
  </nav>`;
}

function home(){
  const mon=monthTotals();
  const days=monthDaysWithCashBox();
  const cashBox=cashBoxBalance();
  return `<div class="topbar">
    <div class="brand">
      <div class="logoMark">☕</div>
      <div><h1>${DB.settings.business}</h1><small>OKEY SALONU</small></div>
      <button class="logoMark cardIcon" aria-label="Oyun simgesi" onclick="toast('Bizim Konak')">🂡</button>
    </div>
    <div class="dateRow"><b>☀️ Günaydın, ${DB.settings.owner||'Oğuzcan'}</b><button class="dateButton" onclick="go('days')">📅 ${dateTR()}</button></div>
  </div>
  <main class="page">
    <div class="homeSummary">
      <div class="card metric profitHero"><div class="label">TOPLAM KAZANÇ</div><div class="value">${fmt(mon.profit)}</div><small>Toplam ciro − tüm giderler</small></div>
      <div class="cards cashPosRow">
        <div class="card metric cashBoxMetric"><div class="label">KASA NAKİT</div><div class="value">${fmt(cashBox)}</div><small>Birikimli kasa nakdi</small></div>
        <div class="card metric posMetric"><div class="label">KASA POS</div><div class="value">${fmt(mon.pos)}</div><small>Ay boyunca biriken POS</small></div>
      </div>
      <div class="cards totalsRow">
        <div class="card metric expenseMetric"><div class="label">GİDERLER</div><div class="value">${fmt(mon.expense)}</div><small>Personel + günlük + ek giderler</small></div>
        <div class="card metric turnoverMetric"><div class="label">TOPLAM CİRO</div><div class="value">${fmt(mon.cash+mon.pos)}</div><small>Nakit + POS satışları</small></div>
      </div>
    </div>

    <div class="monthHeading"><div><span>AYLIK KAYITLAR</span><b>${currentMonthName()}</b></div><button onclick="go('days')">Tüm Günler ›</button></div>
    <div class="tableCard">
      <div class="monthTable head sixCols"><span>Tarih</span><span>Nakit</span><span>POS</span><span>Gider</span><span>Kâr</span><span>Kasa</span></div>
      ${days.length?days.map(d=>`<button class="monthTable data sixCols" onclick="editDay('${d.date}')">
        <span class="dayDate">${shortDateTR(d.date)}</span><span class="green">${fmt(d.cash)}</span><span class="blue">${fmt(d.pos)}</span><span class="red">${fmt(d.expense)}</span><span class="green">${fmt(d.profit)}</span><span class="cashBoxValue">${fmt(d.cashBox)}</span>
      </button>`).join(''):'<div class="empty">Bu ay henüz günlük kayıt yok. Alt menüden “Gün Ekle” ile başlayabilirsin.</div>'}
    </div>
  </main>${renderNav('home')}`;
}

function dayForm(date=todayISO(), editing=false){
  const d=editing?dayBreakdown(date):{cash:0,pos:0,staff:0,dailyOther:0};
  return `<header class="headerGreen"><button onclick="${editing?"go('days')":"go('home')"}">‹</button><h2>${editing?'Gün Düzenle':'Gün Ekle'}</h2><span class="saveGlyph">▣</span></header>
  <main class="page"><div class="formCard">
    <div class="field"><label>Tarih</label><input id="dayDate" type="date" value="${date}" ${editing?'disabled':''}></div>
    <div class="field"><label>Nakit Satış</label><input id="dayCash" type="number" inputmode="decimal" min="0" step="0.01" value="${d.cash||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>POS Satış</label><input id="dayPos" type="number" inputmode="decimal" min="0" step="0.01" value="${d.pos||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>Personel</label><input id="dayStaff" type="number" inputmode="decimal" min="0" step="0.01" value="${d.staff||''}" placeholder="0,00 TL"></div>
    <div class="field"><label>Diğer Giderler</label><input id="dayExpense" type="number" inputmode="decimal" min="0" step="0.01" value="${d.dailyOther||''}" placeholder="0,00 TL"></div>
    <div class="summaryGrid">
      <div class="miniSummary"><span>TOPLAM SATIŞ</span><b id="dayTurnover" class="green">${fmt(0)}</b></div>
      <div class="miniSummary"><span>TOPLAM GİDER</span><b id="dayTotalExpense" class="red">${fmt(0)}</b></div>
    </div>
    <div class="netSummary"><span>NET KÂR</span><b id="dayNet">${fmt(0)}</b></div>
    <div class="cashPreview"><span>BU GÜN KASAYA EKLENECEK</span><b id="dayCashAdded">${fmt(0)}</b><small>Nakit satış − personel</small></div>
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
  if($('#dayCashAdded')) $('#dayCashAdded').textContent=fmt(dayNumber('#dayCash')-dayNumber('#dayStaff'));
}
function bindDayPreview(){ ['#dayCash','#dayPos','#dayStaff','#dayExpense'].forEach(id=>$(id)?.addEventListener('input',updateDayPreview)); updateDayPreview(); }
function writeDay(date,cash,pos,staff,expense){
  DB.tx=DB.tx.filter(x=>!(x.date===date&&x.source!=='extra-expense'));
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
function deleteDay(date){
  const count=DB.tx.filter(x=>x.date===date).length;
  if(!count){ toast('Bu güne ait kayıt bulunamadı'); return; }
  if(!confirm(`${date} tarihindeki TÜM kayıtlar silinsin mi?\n\nSatış, personel ve o güne eklenen diğer giderler de silinecek.`)) return;
  DB.tx=DB.tx.filter(x=>x.date!==date);
  save();
  toast('Gün tamamen silindi');
  go('days');
}

function daysPage(){
  const dates=[...new Set(DB.tx.map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Günlük Kayıtlar</h2><span style="width:24px"></span></header>
  <main class="page"><div class="subtleText">Düzenlemek için satıra dokun. Sil butonu o tarihteki tüm satış ve gider kayıtlarını kaldırır.</div>
    <div class="sectionTitle">TÜM GÜNLER</div>
    <div class="list">${dates.length?dates.map(date=>{const d=dayBreakdown(date);return `<div class="dayListRowWrap"><button class="dayListRow" onclick="editDay('${date}')"><div><b>${dateTR(new Date(date+'T12:00:00'))}</b><small>Nakit ${fmt(d.cash)} · POS ${fmt(d.pos)} · Gider ${fmt(d.expense)} · Kasa ${fmt(cashBoxBalance(monthKey(date),date))}</small></div><span>${fmt(d.profit)} ›</span></button><button class="dayDeleteBtn" onclick="deleteDay('${date}')">Sil</button></div>`}).join(''):'<div class="empty">Henüz kayıt yok.</div>'}</div>
  </main>${renderNav('')}`;
}

function extraExpensesForMonth(key=monthKey()){
  return DB.tx.filter(x=>x.kind==='expense'&&x.source==='extra-expense'&&monthKey(x.date)===key).sort((a,b)=>b.date.localeCompare(a.date));
}
function extraExpenseTotal(key=monthKey()){
  return extraExpensesForMonth(key).reduce((a,x)=>a+Number(x.amount||0),0);
}
function expenseCategoryTotals(key=monthKey()){
  const map={};
  extraExpensesForMonth(key).forEach(x=>{ map[x.category]=(map[x.category]||0)+Number(x.amount||0); });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function expensePage(){
  const rows=extraExpensesForMonth();
  const total=extraExpenseTotal();
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Gider Ekle</h2><span style="width:24px"></span></header>
  <main class="page">
    <div class="formCard expenseFormCard">
      <div class="field"><label>Tarih</label><input id="expenseDate" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Gider Türü</label><select id="expenseCategory"><option>Kira</option><option>Firma Ödemesi</option><option>Elektrik</option><option>Su</option><option>İnternet</option><option>Muhasebe</option><option>Vergi</option><option>Mal Alımı</option><option>Bakım / Tamir</option><option>Diğer</option></select></div>
      <div class="field"><label>Tutar</label><input id="expenseAmount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
      <div class="field"><label>Nereden Ödendi?</label><select id="expensePayment"><option value="cash">Nakit / Kasadan</option><option value="bank">Banka</option></select></div>
      <div class="field"><label>Açıklama (isteğe bağlı)</label><input id="expenseNote" type="text" placeholder="Örn. Ağustos kira ödemesi"></div>
      <div class="expenseInfo">Her gider kârdan düşer. “Nakit / Kasadan” seçersen aynı zamanda Kasada Kalan Nakit tutarından da düşer. Banka seçersen kasa etkilenmez.</div>
      <button class="primary expensePrimary" onclick="saveExtraExpense()">Gideri Kaydet</button>
    </div>
    <div class="expenseMonthSummary"><span>BU AY EKLENEN EK GİDER</span><b>${fmt(total)}</b></div>
    <div class="sectionTitle">BU AYIN GİDERLERİ</div>
    <div class="list">${rows.length?rows.map(x=>`<div class="expenseRow"><div><b>${x.category}</b><small>${shortDateTR(x.date)} · ${x.payment==='cash'?'Nakit':'Banka'}${x.note?` · ${x.note}`:''}</small></div><strong>${fmt(x.amount)}</strong><button class="expenseDelete" onclick="deleteExtraExpense('${x.id}')">Sil</button></div>`).join(''):'<div class="empty">Bu ay ayrıca eklenmiş gider yok.</div>'}</div>
  </main>${renderNav('expense')}`;
}
function saveExtraExpense(){
  const date=$('#expenseDate').value||todayISO();
  const category=$('#expenseCategory').value||'Diğer';
  const amount=Math.max(0,Number($('#expenseAmount').value||0));
  const payment=$('#expensePayment').value||'bank';
  const note=$('#expenseNote').value.trim();
  if(amount<=0){ toast('Gider tutarını gir'); return; }
  DB.tx.push({id:uid(),source:'extra-expense',kind:'expense',category,amount,payment,date,note,created:new Date().toISOString()});
  save(); toast('Gider kaydedildi ve kârdan düşüldü'); go('expense');
}
function deleteExtraExpense(id){
  const row=DB.tx.find(x=>x.id===id&&x.source==='extra-expense'); if(!row)return;
  if(!confirm(`${row.category} · ${fmt(row.amount)} gideri silinsin mi?`)) return;
  DB.tx=DB.tx.filter(x=>x.id!==id); save(); toast('Gider silindi'); go('expense');
}

function reports(){
  const m=monthTotals();
  const days=[...monthDays()].reverse();
  const turnover=m.cash+m.pos;
  const cashPct=turnover?Math.round(m.cash/turnover*100):0;
  const posPct=turnover?100-cashPct:0;
  const maxProfit=Math.max(1,...days.map(d=>Math.max(0,d.profit)));
  const rec=posReconciliation();
  return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Raporlar</h2><span style="width:24px"></span></header>
  <main class="page reportPage">
    <div class="periodTabs"><button>Günlük</button><button class="active">Aylık</button><button>Yıllık</button></div>
    <div class="reportMonth">${currentMonthName()}</div>
    <div class="reportCards fourReportCards">
      <div class="reportMetric"><span>TOPLAM NAKİT</span><b class="green">${fmt(m.cash)}</b></div>
      <div class="reportMetric"><span>TOPLAM POS</span><b class="blue">${fmt(m.pos)}</b></div>
      <div class="reportMetric"><span>KASADA KALAN</span><b class="cashBoxValue">${fmt(cashBoxBalance())}</b></div>
      <div class="reportMetric"><span>TOPLAM KÂR</span><b class="green">${fmt(m.profit)}</b></div>
    </div>
    <div class="card reportBlock posQuickBlock">
      <div class="reportTitleRow"><div><h3>POS Mutabakatı</h3><small>Yazılan POS ile bankaya yatan POS'u karşılaştır.</small></div><button class="smallPrimary" onclick="go('pos')">Aç ›</button></div>
      <div class="posQuickGrid"><div><span>Yazılan</span><b>${fmt(rec.sold)}</b></div><div><span>Yatan</span><b>${fmt(rec.deposited)}</b></div><div><span>Fark</span><b class="${rec.cls==='warn'?'red':rec.cls==='ok'?'green':''}">${fmt(rec.diff)}</b></div></div>
      <div class="statusPill ${rec.cls}">${rec.status}${rec.sold?` · %${rec.pct.toFixed(2)}`:''}</div>
    </div>
    <div class="card reportBlock"><h3>Nakit / POS Dağılımı</h3>
      <div class="donutWrap"><div class="donut" style="--cash:${cashPct*3.6}deg"></div><div class="legend"><div><i class="cashDot"></i><span>Nakit</span><b>${cashPct}% · ${fmt(m.cash)}</b></div><div><i class="posDot"></i><span>POS</span><b>${posPct}% · ${fmt(m.pos)}</b></div></div></div>
    </div>
    <div class="card reportBlock"><h3>Günlere Göre Kâr</h3>
      ${days.length?`<div class="profitChart">${days.map(d=>`<div class="profitCol"><div class="profitBar" style="height:${Math.max(4,(Math.max(0,d.profit)/maxProfit)*100)}%"></div><span>${d.date.slice(8)}</span></div>`).join('')}</div>`:'<div class="empty">Grafik için günlük kayıt gerekiyor.</div>'}
    </div>
    <div class="card reportBlock"><div class="reportTitleRow"><div><h3>Ek Giderler</h3><small>Kira, firma, fatura ve diğer giderler.</small></div><button class="smallPrimary expenseMiniButton" onclick="go('expense')">Ekle +</button></div>${expenseCategoryTotals().length?expenseCategoryTotals().map(([name,amount])=>`<div class="statline"><span>${name}</span><b class="red">${fmt(amount)}</b></div>`).join(''):'<div class="empty">Bu ay ek gider yok.</div>'}</div>
    <div class="card reportBlock"><div class="statline"><span>Toplam Satış</span><b>${fmt(turnover)}</b></div><div class="statline"><span>Toplam Gider</span><b class="red">${fmt(m.expense)}</b></div><div class="statline"><span>Ek Giderler</span><b class="red">${fmt(extraExpenseTotal())}</b></div><div class="statline"><span>Kasada Kalan Nakit</span><b class="cashBoxValue">${fmt(cashBoxBalance())}</b></div><div class="statline"><span>Net Kâr</span><b class="${m.profit>=0?'green':'red'}">${fmt(m.profit)}</b></div><div class="statline"><span>Kâr Marjı</span><b>%${turnover?((m.profit/turnover)*100).toFixed(1):'0.0'}</b></div></div>
  </main>${renderNav('reports')}`;
}

function posPage(key=monthKey()){
  const rec=posReconciliation(key);
  const deposits=bankPosForMonth(key);
  const diffLabel=rec.diff>=0?'Eksik / Bekleyen':'Fazla Yatan';
  return `<header class="headerGreen"><button onclick="go('reports')">‹</button><h2>POS Mutabakatı</h2><button onclick="go('posadd')">＋</button></header>
  <main class="page">
    <div class="field monthPicker"><label>Karşılaştırılacak Ay</label><input id="posMonth" type="month" value="${key}" onchange="openPosMonth(this.value)"></div>
    <div class="card posHero">
      <div class="posHeroHead"><div><span>AYLIK MUTABAKAT</span><b>${monthNameFromKey(key)}</b></div><div class="statusPill ${rec.cls}">${rec.status}</div></div>
      <div class="posCompareGrid"><div><span>YAZILAN POS</span><b class="blue">${fmt(rec.sold)}</b></div><div><span>BANKAYA YATAN</span><b class="green">${fmt(rec.deposited)}</b></div></div>
      <div class="posDifference"><span>${diffLabel}</span><b class="${rec.cls==='warn'?'red':rec.cls==='ok'?'green':''}">${fmt(Math.abs(rec.diff))}</b><small>${rec.sold?`Fark oranı %${rec.pct.toFixed(2)} · %5'e kadar normal kabul edilir.`:'Önce günlük POS kaydı gir.'}</small></div>
    </div>
    <button class="primary posAddMain" onclick="go('posadd')">＋ Yatan POS Ekle</button>
    <div class="posInfo">Hafta sonu veya 24 saat gecikmeli yatışlar olabilir. Sistem günlük birebir eşleştirme yapmaz; seçtiğin ayın toplamını karşılaştırır.</div>
    <div class="sectionTitle">BANKAYA YATAN POS KAYITLARI</div>
    <div class="list">${deposits.length?deposits.map(x=>`<div class="depositRow"><div><b>${dateTR(new Date(x.date+'T12:00:00'))}</b><small>${x.note||'POS yatışı'}</small></div><strong>${fmt(x.amount)}</strong><button class="depositDelete" onclick="deletePosDeposit('${x.id}','${key}')">Sil</button></div>`).join(''):'<div class="empty">Bu ay için bankaya yatan POS kaydı yok.</div>'}</div>
  </main>${renderNav('reports')}`;
}
function openPosMonth(key){ $('#app').innerHTML=posPage(key||monthKey()); window.scrollTo(0,0); }
function posDepositForm(){
  return `<header class="headerGreen"><button onclick="go('pos')">‹</button><h2>Yatan POS Ekle</h2><span style="width:24px"></span></header>
  <main class="page"><div class="formCard">
    <div class="field"><label>Bankaya Yatış Tarihi</label><input id="posDepositDate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>Yatan Tutar</label><input id="posDepositAmount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
    <div class="field"><label>Açıklama (isteğe bağlı)</label><input id="posDepositNote" type="text" placeholder="Örn. hafta sonu toplu POS yatışı"></div>
    <div class="posInfo">Bu kayıt günlük satıştan ayrıdır. Banka hesabına gerçekten geçen tutarı yaz.</div>
    <button class="primary" onclick="savePosDeposit()">Yatan POS'u Kaydet</button>
  </div></main>${renderNav('reports')}`;
}
function savePosDeposit(){
  const date=$('#posDepositDate').value||todayISO();
  const amount=Math.max(0,Number($('#posDepositAmount').value||0));
  const note=$('#posDepositNote').value.trim();
  if(amount<=0){ toast('Yatan POS tutarını gir'); return; }
  DB.bankPos.unshift({id:uid(),date,amount,note,created:new Date().toISOString()});
  save(); toast('Yatan POS kaydedildi'); openPosMonth(monthKey(date));
}
function deletePosDeposit(id,key=monthKey()){
  const row=DB.bankPos.find(x=>x.id===id); if(!row)return;
  if(!confirm(`${row.date} tarihli ${fmt(row.amount)} POS yatışı silinsin mi?`)) return;
  DB.bankPos=DB.bankPos.filter(x=>x.id!==id); save(); toast('POS yatışı silindi'); openPosMonth(key);
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
    <div class="card" style="text-align:center"><img src="icon-192.png" style="width:74px;border-radius:20px"><h2 style="font-family:Georgia,serif;color:#1f5a3a;margin-bottom:4px">${DB.settings.business}</h2><span class="pill">OKEY SALONU</span></div>
    <div class="sectionTitle">FİNANS</div><div class="list"><button class="settingsBtn" onclick="go('expense')">Gider Ekle <span>›</span></button><button class="settingsBtn" onclick="go('pos')">POS Mutabakatı <span>›</span></button><div class="settingsInfo">POS komisyon toleransı: %5</div></div><div class="sectionTitle">UYGULAMA</div><div class="list">
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
  const txRows=DB.tx.map(x=>[x.date,x.kind==='income'?'Gelir':'Gider',x.category,x.amount,x.payment==='cash'?'Nakit':x.payment==='card'?'POS':x.payment==='bank'?'Banka':'Diğer',x.note||'']);
  const bankRows=DB.bankPos.map(x=>[x.date,'Banka','Yatan POS',x.amount,'Banka',x.note||'']);
  const rows=[['Tarih','Tür','Kategori','Tutar','Ödeme','Açıklama'],...txRows,...bankRows].sort((a,b)=>a[0]==='Tarih'?-1:b[0]==='Tarih'?1:String(b[0]).localeCompare(String(a[0])));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
  download('bizim-konak-islemler.csv','\ufeff'+csv,'text/csv;charset=utf-8'); toast('CSV hazırlandı');
}
function backupJSON(){ download('bizim-konak-yedek.json',JSON.stringify(DB,null,2),'application/json'); toast('Yedek hazırlandı'); }
function clearAll(){ if(confirm('Tüm günlük, ek gider, veresiye ve POS yatış kayıtları silinsin mi?')){DB.tx=[];DB.receivables=[];DB.bankPos=[];save();go('settings');} }

function go(page){
  const app=$('#app');
  if(page==='day'){app.innerHTML=dayForm();bindDayPreview();}
  else if(page==='days')app.innerHTML=daysPage();
  else if(page==='expense')app.innerHTML=expensePage();
  else if(page==='reports')app.innerHTML=reports();
  else if(page==='pos')app.innerHTML=posPage();
  else if(page==='posadd')app.innerHTML=posDepositForm();
  else if(page==='receivables')app.innerHTML=receivables();
  else if(page==='settings')app.innerHTML=settings();
  else app.innerHTML=home();
  window.scrollTo(0,0);
}

go('home');
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js?v=8').then(reg=>reg.update()).catch(()=>{}));
