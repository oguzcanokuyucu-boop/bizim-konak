const $ = s=>document.querySelector(s);
const fmt=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(n||0));
const todayISO=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

let DB=JSON.parse(localStorage.getItem('bk-db')||'null')||{
  settings:{business:'Bizim Konak',openingCash:0,owner:'Oğuzcan'},
  tx:[], receivables:[]
};
const save=()=>localStorage.setItem('bk-db',JSON.stringify(DB));
const toast=m=>{let t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function dateTR(d=new Date()){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',weekday:'long'}).format(d)}
function monthKey(d){return (d||todayISO()).slice(0,7)}
function totals(filter=()=>true){
  const arr=DB.tx.filter(filter), inc=arr.filter(x=>x.kind==='income').reduce((a,x)=>a+x.amount,0), exp=arr.filter(x=>x.kind==='expense').reduce((a,x)=>a+x.amount,0);
  return {inc,exp,profit:inc-exp}
}
function cashTotal(){
  return Number(DB.settings.openingCash||0)+DB.tx.reduce((a,x)=>a + (x.payment==='cash'?(x.kind==='income'?x.amount:-x.amount):0),0)
}
function renderNav(active){
return `<nav class="nav">
<button class="${active==='home'?'active':''}" onclick="go('home')"><span class="nicon">⌂</span>Ana Sayfa</button>
<button class="${active==='income'?'active':''}" onclick="go('income')"><span class="nicon">⊕</span>Gelir</button>
<button class="${active==='expense'?'active':''}" onclick="go('expense')"><span class="nicon">⊖</span>Gider</button>
<button class="${active==='reports'?'active':''}" onclick="go('reports')"><span class="nicon">▥</span>Raporlar</button>
<button class="${active==='settings'?'active':''}" onclick="go('settings')"><span class="nicon">⚙︎</span>Ayarlar</button>
</nav>`}
function home(){
 const t=todayISO(), day=totals(x=>x.date===t), mon=totals(x=>monthKey(x.date)===monthKey());
 const recent=[...DB.tx].sort((a,b)=>(b.created||'').localeCompare(a.created||'')).slice(0,6);
 return `<div class="topbar">
  <div class="brand"><div class="logoMark">☕</div><div><h1>${DB.settings.business}</h1><small>ÇAY EVİ</small></div><div class="logoMark">♢</div></div>
  <div class="dateRow"><b>☀️ Günaydın, ${DB.settings.owner||'Oğuzcan'}</b><span>📅 ${dateTR()}</span></div>
 </div>
 <main class="page">
  <div class="cards">
   <div class="card metric income"><div class="label">BUGÜNKÜ GELİR</div><div class="value">${fmt(day.inc)}</div></div>
   <div class="card metric expense"><div class="label">BUGÜNKÜ GİDER</div><div class="value">${fmt(day.exp)}</div></div>
   <div class="card metric profit"><div class="label">NET KAZANÇ</div><div class="value">${fmt(day.profit)}</div></div>
   <div class="card metric cash"><div class="label">KASADAKİ NAKİT</div><div class="value">${fmt(cashTotal())}</div></div>
  </div>
  <div class="sectionTitle">BU AY</div>
  <div class="card"><div class="statline"><span>Toplam Ciro</span><b class="pos">${fmt(mon.inc)}</b></div><div class="statline"><span>Toplam Gider</span><b class="neg">${fmt(mon.exp)}</b></div><div class="statline"><span>Net Kâr</span><b>${fmt(mon.profit)}</b></div></div>
  <div class="sectionTitle">KISA YOL</div>
  <div class="quick">
   <button onclick="go('day')"><span class="ico">📅</span><span>Gün Ekle</span></button>
   <button onclick="go('expense')"><span class="ico">➖</span><span>Gider Ekle</span></button>
   <button onclick="go('reports')"><span class="ico">📊</span><span>Raporlar</span></button>
   <button onclick="go('receivables')"><span class="ico">👥</span><span>Veresiye</span></button>
  </div>
  <div class="sectionTitle">SON İŞLEMLER</div>
  <div class="list">${recent.length?recent.map(txRow).join(''):'<div class="empty">Henüz işlem yok. İlk geliri veya gideri ekleyebilirsin.</div>'}</div>
 </main>${renderNav('home')}`
}
function txRow(x){
 return `<div class="row"><div class="rowIcon">${x.kind==='income'?'↗️':'↘️'}</div><div class="rowText"><b>${x.category}</b><small>${x.payment==='card'?'Kart':'Nakit'}${x.note?' · '+x.note:''}</small></div><div class="rowAmount ${x.kind==='income'?'pos':'neg'}">${x.kind==='income'?'+':'-'}${fmt(x.amount)}<small>${x.date}</small></div></div>`
}
const incomeCats=['Çay Satışı','Kahvaltı','Meşrubat','Nakit Gelir','Kartla Tahsilat','Diğer Gelir'];
const expenseCats=['Market / Malzeme','Elektrik','Su','Doğalgaz','Kira','Personel','Muhasebe','İnternet','Firma / Tedarikçi','Diğer Gider'];
function form(kind){
 const inc=kind==='income', cats=inc?incomeCats:expenseCats;
 return `<header class="headerGreen" style="${inc?'':'background:#ae3030'}"><button onclick="go('home')">‹</button><h2>${inc?'Gelir':'Gider'} Ekle</h2><span style="width:24px"></span></header>
 <main class="page"><div class="formCard">
  <div class="field"><label>${inc?'Gelir':'Gider'} Türü</label><select id="cat">${cats.map(c=>`<option>${c}</option>`).join('')}</select></div>
  <div class="field"><label>Tutar</label><input id="amount" type="number" inputmode="decimal" placeholder="0,00 TL"></div>
  <div class="field"><label>Ödeme Türü</label><div class="seg"><button id="cashBtn" class="active" onclick="setPay('cash')">Nakit</button><button id="cardBtn" onclick="setPay('card')">Kart</button></div></div>
  <div class="field"><label>Tarih</label><input id="date" type="date" value="${todayISO()}"></div>
  <div class="field"><label>Açıklama (isteğe bağlı)</label><textarea id="note" placeholder="Açıklama yazın..."></textarea></div>
  <button class="primary ${inc?'':'danger'}" onclick="addTx('${kind}')">Kaydet</button>
 </div></main>${renderNav(kind)}`
}

function dayForm(){
 return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Gün Ekle</h2><span style="width:24px"></span></header>
 <main class="page"><div class="formCard">
  <div class="field"><label>Tarih</label><input id="dayDate" type="date" value="${todayISO()}"></div>
  <div class="field"><label>Nakit Satış</label><input id="dayCash" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
  <div class="field"><label>POS Satış</label><input id="dayPos" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
  <div class="field"><label>Personel</label><input id="dayStaff" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
  <div class="field"><label>Diğer Giderler</label><input id="dayExpense" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00 TL"></div>
  <div class="card" style="margin:4px 0 16px;box-shadow:none">
   <div class="statline"><span>Günlük Ciro</span><b id="dayTurnover" class="pos">${fmt(0)}</b></div>
   <div class="statline"><span>Toplam Gider</span><b id="dayTotalExpense" class="neg">${fmt(0)}</b></div>
   <div class="statline"><span>Net Kazanç</span><b id="dayNet">${fmt(0)}</b></div>
  </div>
  <button class="primary" onclick="saveDay()">Günü Kaydet</button>
 </div></main>${renderNav('')}`
}
function dayNumber(id){return Math.max(0,Number($(id)?.value||0))}
function updateDayPreview(){
 const turnover=dayNumber('#dayCash')+dayNumber('#dayPos');
 const expense=dayNumber('#dayStaff')+dayNumber('#dayExpense');
 if($('#dayTurnover'))$('#dayTurnover').textContent=fmt(turnover);
 if($('#dayTotalExpense'))$('#dayTotalExpense').textContent=fmt(expense);
 if($('#dayNet'))$('#dayNet').textContent=fmt(turnover-expense);
}
function bindDayPreview(){['#dayCash','#dayPos','#dayStaff','#dayExpense'].forEach(id=>$(id)?.addEventListener('input',updateDayPreview));updateDayPreview()}
function saveDay(){
 const date=$('#dayDate').value||todayISO();
 const cash=dayNumber('#dayCash'), pos=dayNumber('#dayPos'), staff=dayNumber('#dayStaff'), expense=dayNumber('#dayExpense');
 if(cash+pos+staff+expense<=0){toast('En az bir tutar gir');return}
 const existing=DB.tx.filter(x=>x.source==='day'&&x.date===date);
 if(existing.length&&!confirm('Bu tarih için Gün Ekle kaydı var. Eski kaydı değiştirilsin mi?'))return;
 if(existing.length)DB.tx=DB.tx.filter(x=>!(x.source==='day'&&x.date===date));
 const created=new Date().toISOString(), dayId=uid();
 if(cash>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'income',category:'Nakit Satış',amount:cash,payment:'cash',date,note:'Günlük kayıt',created});
 if(pos>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'income',category:'POS Satış',amount:pos,payment:'card',date,note:'Günlük kayıt',created});
 if(staff>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'expense',category:'Personel',amount:staff,payment:'cash',date,note:'Günlük kayıt',created});
 if(expense>0)DB.tx.push({id:uid(),dayId,source:'day',kind:'expense',category:'Diğer Giderler',amount:expense,payment:'cash',date,note:'Günlük kayıt',created});
 save();toast('Gün kaydedildi');go('home')
}

let payment='cash';
function setPay(p){payment=p;$('#cashBtn').classList.toggle('active',p==='cash');$('#cardBtn').classList.toggle('active',p==='card')}
function addTx(kind){
 const amount=Number($('#amount').value); if(!amount||amount<=0){toast('Tutar gir');return}
 DB.tx.push({id:uid(),kind,category:$('#cat').value,amount,payment,date:$('#date').value||todayISO(),note:$('#note').value.trim(),created:new Date().toISOString()}); save(); toast('Kaydedildi'); go('home')
}
function reports(){
 const key=monthKey(), arr=DB.tx.filter(x=>monthKey(x.date)===key), t=totals(x=>monthKey(x.date)===key);
 const cash=arr.filter(x=>x.kind==='income'&&x.payment==='cash').reduce((a,x)=>a+x.amount,0);
 const card=arr.filter(x=>x.kind==='income'&&x.payment==='card').reduce((a,x)=>a+x.amount,0);
 const cats={};arr.filter(x=>x.kind==='expense').forEach(x=>cats[x.category]=(cats[x.category]||0)+x.amount);
 const days=[...Array(7)].map((_,i)=>{let d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10)});
 const vals=days.map(d=>totals(x=>x.date===d)); const max=Math.max(1,...vals.flatMap(v=>[v.inc,v.exp]));
 return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Raporlar</h2><span style="width:24px"></span></header>
 <main class="page">
 <div class="tabs"><button>Günlük</button><button>Haftalık</button><button class="active">Aylık</button><button>Yıllık</button></div>
 <div class="card reportStats">
   <div class="statline"><span>Toplam Ciro</span><b class="pos">${fmt(t.inc)}</b></div>
   <div class="statline"><span>POS / Kart</span><b>${fmt(card)}</b></div>
   <div class="statline"><span>Nakit</span><b>${fmt(cash)}</b></div>
   <div class="statline"><span>Toplam Gider</span><b class="neg">${fmt(t.exp)}</b></div>
   <div class="statline"><span>Net Kâr</span><b>${fmt(t.profit)}</b></div>
   <div class="statline"><span>Kâr Marjı</span><b>%${t.inc?((t.profit/t.inc)*100).toFixed(1):'0.0'}</b></div>
 </div>
 <div class="sectionTitle">SON 7 GÜN GRAFİĞİ</div><div class="card"><div class="chart">${vals.map(v=>`<div class="barGroup"><div class="bar" style="height:${v.inc/max*100}%"></div><div class="bar exp" style="height:${v.exp/max*100}%"></div></div>`).join('')}</div><div class="chartLabels">${days.map(d=>`<span>${d.slice(8)}</span>`).join('')}</div></div>
 <div class="sectionTitle">GİDER DAĞILIMI</div><div class="list">${Object.keys(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="row"><div class="rowText"><b>${k}</b></div><div class="rowAmount neg">${fmt(v)}</div></div>`).join(''):'<div class="empty">Bu ay gider kaydı yok.</div>'}</div>
 </main>${renderNav('reports')}`
}
function receivables(){
 const total=DB.receivables.filter(r=>!r.paid).reduce((a,r)=>a+r.amount,0);
 return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Veresiye</h2><button onclick="addReceivable()">＋</button></header>
 <main class="page"><div class="card"><div class="statline"><span>Toplam Açık Veresiye</span><b>${fmt(total)}</b></div></div>
 <div class="sectionTitle">KAYITLAR</div><div class="list">${DB.receivables.length?DB.receivables.map(r=>`<div class="row"><div class="rowText"><b>${r.name}</b><small>${r.note||''} · ${r.date}</small></div><div class="rowAmount ${r.paid?'':'neg'}">${fmt(r.amount)}<small><button onclick="toggleRec('${r.id}')" style="border:0;background:none;color:#1f5a3a">${r.paid?'Geri Aç':'Ödendi'}</button></small></div></div>`).join(''):'<div class="empty">Veresiye kaydı yok.</div>'}</div></main>${renderNav('')}`
}
function addReceivable(){
 const name=prompt('Müşteri adı'); if(!name)return; const amount=Number(prompt('Tutar (TL)')); if(!amount)return; const note=prompt('Açıklama (isteğe bağlı)')||'';
 DB.receivables.unshift({id:uid(),name,amount,note,date:todayISO(),paid:false});save();go('receivables')
}
function toggleRec(id){let r=DB.receivables.find(x=>x.id===id);if(r){r.paid=!r.paid;save();go('receivables')}}
function settings(){
 return `<header class="headerGreen"><button onclick="go('home')">‹</button><h2>Ayarlar</h2><span style="width:24px"></span></header>
 <main class="page">
 <div class="card" style="text-align:center"><img src="icon-192.png" style="width:74px;border-radius:20px"><h2 style="font-family:Georgia,serif;color:#1f5a3a;margin-bottom:4px">${DB.settings.business}</h2><span class="pill">ÇAY EVİ</span></div>
 <div class="sectionTitle">UYGULAMA</div><div class="list">
 <button class="settingsBtn" onclick="editBusiness()">İş Yeri Bilgileri <span>›</span></button>
 <button class="settingsBtn" onclick="editOpening()">Başlangıç Kasa Bakiyesi <span>${fmt(DB.settings.openingCash)}</span></button>
 <button class="settingsBtn" onclick="exportCSV()">Verileri CSV Olarak Dışa Aktar <span>›</span></button>
 <button class="settingsBtn" onclick="backupJSON()">Tam Yedek Al <span>›</span></button>
 <button class="settingsBtn" onclick="clearAll()">Tüm Verileri Temizle <span>›</span></button>
 </div></main>${renderNav('settings')}`
}
function editBusiness(){let b=prompt('İşletme adı',DB.settings.business);if(b){DB.settings.business=b;let o=prompt('Karşılama adı',DB.settings.owner||'');if(o!==null)DB.settings.owner=o;save();go('settings')}}
function editOpening(){let v=Number(prompt('Başlangıç kasa bakiyesi (TL)',DB.settings.openingCash||0));if(!isNaN(v)){DB.settings.openingCash=v;save();go('settings')}}
function download(name,text,type='text/plain'){
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove()
}
function exportCSV(){
 const rows=[['Tarih','Tür','Kategori','Tutar','Ödeme','Açıklama'],...DB.tx.map(x=>[x.date,x.kind==='income'?'Gelir':'Gider',x.category,x.amount,x.payment==='cash'?'Nakit':'Kart',x.note||''])];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
 download('bizim-konak-islemler.csv','\ufeff'+csv,'text/csv;charset=utf-8');toast('CSV hazırlandı')
}
function backupJSON(){download('bizim-konak-yedek.json',JSON.stringify(DB,null,2),'application/json');toast('Yedek hazırlandı')}
function clearAll(){if(confirm('Tüm gelir, gider ve veresiye kayıtları silinsin mi?')){DB.tx=[];DB.receivables=[];save();go('settings')}}
function go(page){payment='cash'; const app=$('#app'); if(page==='day'){app.innerHTML=dayForm();bindDayPreview()} else if(page==='income'||page==='expense')app.innerHTML=form(page); else if(page==='reports')app.innerHTML=reports(); else if(page==='settings')app.innerHTML=settings(); else if(page==='receivables')app.innerHTML=receivables(); else app.innerHTML=home(); window.scrollTo(0,0)}
go('home');
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));