const CACHE='courtplay-v43';
const ASSETS=[
  './',
  './index.html',
  './v2.html',
  './manifest-v43.json',
  './courtplay-icon-192-v43.png',
  './courtplay-icon-512-v43.png',
  './apple-touch-icon-v43.png',
  './courtplay.css?v=43',
  './courtplay-engine.js?v=43',
  './courtplay-state.js?v=43',
  './courtplay-render.js?v=43',
  './courtplay-editor.js?v=43',
  './courtplay-timeline.js?v=43',
  './courtplay-cloud.js?v=43',
  './courtplay-library.js?v=43',
  './courtplay-export.js?v=43',
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

async function updateCache(request,response){
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
      const cache=await caches.open(CACHE);
      const shell=url.pathname.endsWith('/v2.html')?'./v2.html':'./index.html';
      const cached=await cache.match(shell,{ignoreSearch:true});
      const network=fetch(e.request)
        .then(async r=>{await updateCache(e.request,r);return r;})
        .catch(()=>null);
      if(cached){
        e.waitUntil(network);
        return cached;
      }
      return (await network)||new Response('CourtPlay no disponible sin conexión.',{status:503});
    })());
    return;
  }

  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(e.request,{ignoreSearch:true});
    const network=fetch(e.request)
      .then(async r=>{await updateCache(e.request,r);return r;})
      .catch(()=>null);

    if(cached){
      e.waitUntil(network);
      return cached;
    }
    return (await network)||new Response('',{status:503,statusText:'Offline'});
  })());
});
