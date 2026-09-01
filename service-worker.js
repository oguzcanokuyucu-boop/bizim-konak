const CACHE='bizim-konak-v9';
const ASSETS=['./','./index.html','./styles.css?v=9','./app.js?v=9','./manifest.json?v=9','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
    if(e.request.method==='GET'){const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
    return r;
  }).catch(()=>caches.match(e.request)));
});
