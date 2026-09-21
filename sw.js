const CACHE='courtplay-v36';
const ASSETS=['./','./index.html','./manifest.json','./courtplay.css?v=36','./courtplay-engine.js?v=36','./courtplay-state.js?v=36','./courtplay-render.js?v=36','./courtplay-editor.js?v=36','./courtplay-timeline.js?v=36','./courtplay-cloud.js?v=36','./courtplay-library.js?v=36','./courtplay-export.js?v=36','./plays/index.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return r;
    }).catch(async()=>{
      const hit=await caches.match(e.request);
      if(hit)return hit;
      const url=new URL(e.request.url);
      if(url.origin===self.location.origin&&e.request.mode==='navigate'){
        return caches.match('./index.html');
      }
      return new Response('',{status:503,statusText:'Offline'});
    })
  );
});
