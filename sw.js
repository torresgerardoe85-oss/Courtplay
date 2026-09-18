const CACHE='courtplay-v15';
const ASSETS=['./','./index.html','./manifest.json','./courtplay.css?v=15','./courtplay-engine.js?v=15','./courtplay-state.js?v=15','./courtplay-render.js?v=15','./courtplay-editor.js?v=15','./courtplay-timeline.js?v=15','./courtplay-export.js?v=15'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html'))))});
