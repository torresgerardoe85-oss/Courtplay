const CACHE='courtplay-v26';
const ASSETS=['./','./index.html','./manifest.json','./courtplay.css?v=26','./courtplay-engine.js?v=26','./courtplay-state.js?v=26','./courtplay-render.js?v=26','./courtplay-editor.js?v=26','./courtplay-timeline.js?v=26','./courtplay-library.js?v=26','./courtplay-export.js?v=26','./plays/index.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html'))))});
