const CACHE='courtplay-v49';
const ASSETS=[
  './',
  './index.html?v=49',
  './v2.html?v=49',
  './manifest-v43.json',
  './courtplay-icon-192-v43.png',
  './courtplay-icon-512-v43.png',
  './apple-touch-icon-v43.png',
  './courtplay.css?v=49',
  './courtplay-engine.js?v=49',
  './courtplay-state.js?v=49',
  './courtplay-render.js?v=49',
  './courtplay-editor.js?v=49',
  './courtplay-timeline.js?v=49',
  './courtplay-cloud.js?v=49',
  './courtplay-library.js?v=49',
  './courtplay-export.js?v=49',
  './plays/index.json'
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function put(request,response){
  try{
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
  }catch(e){}
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  if(url.origin!==self.location.origin){
    e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503,statusText:'Offline'})));
    return;
  }

  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(e.request,{cache:'no-store'});
        await put(e.request,fresh);
        return fresh;
      }catch(err){
        const cache=await caches.open(CACHE);
        return (await cache.match(e.request)) ||
               (await cache.match('./index.html?v=49')) ||
               new Response('CourtPlay no disponible sin conexión.',{status:503});
      }
    })());
    return;
  }

  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(e.request);
    if(cached)return cached;
    try{
      const fresh=await fetch(e.request);
      await put(e.request,fresh);
      return fresh;
    }catch(err){
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});
