(function(){
  'use strict';
  const button=document.getElementById('libraryBtn');
  const base='./plays/';

  function ensurePanel(){
    let wrap=document.getElementById('courtplayLibraryPanel');
    if(wrap)return wrap;
    wrap=document.createElement('div');wrap.id='courtplayLibraryPanel';wrap.className='libraryOverlay';
    const panel=document.createElement('div');panel.className='libraryPanel';
    const head=document.createElement('div');head.className='libraryHead';
    const title=document.createElement('div');title.innerHTML='<strong>Biblioteca CourtPlay</strong><small>Jugadas creadas directamente para abrirse dentro de la app.</small>';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.className='libraryClose';
    close.addEventListener('click',()=>wrap.remove());
    head.append(title,close);
    const list=document.createElement('div');list.id='courtplayLibraryList';list.className='libraryList';
    panel.append(head,list);wrap.append(panel);document.body.append(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
    return wrap;
  }
  function loading(message){
    const wrap=ensurePanel(),list=wrap.querySelector('#courtplayLibraryList');
    list.innerHTML='';const p=document.createElement('p');p.className='libraryMessage';p.textContent=message;list.append(p);
    return list;
  }
  async function loadPlay(slug,{closePanel=true}={}){
    try{
      setStatus('Cargando jugada de CourtPlay…');
      const res=await fetch(base+encodeURIComponent(slug)+'.json?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('play not found');
      const raw=await res.json();
      const loaded=typeof migrate==='function'?(migrate(raw)||raw):raw;
      if(!loaded||!Array.isArray(loaded.frames)||!loaded.frames.length)throw new Error('invalid play');
      data=loaded;data.version=2;
      CourtPlayEngine.reflow(data.frames,0);
      current=0;selectedLine=-1;selectedPlayer=null;
      playNameEl.value=data.name||slug;
      render();
      setStatus('Jugada cargada. Puedes editarla y luego tocar Guardar.');
      if(closePanel)document.getElementById('courtplayLibraryPanel')?.remove();
      return true;
    }catch(e){
      setStatus('No pude cargar esa jugada de la Biblioteca.');
      return false;
    }
  }
  async function openLibrary(){
    const list=loading('Cargando biblioteca…');
    try{
      const res=await fetch(base+'index.json?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('index');
      const payload=await res.json(),plays=Array.isArray(payload)?payload:(payload.plays||[]);
      list.innerHTML='';
      if(!plays.length){
        const p=document.createElement('p');p.className='libraryMessage';p.textContent='Todavía no hay jugadas publicadas. Cuando me pidas un patrón, podré crearlo y añadirlo aquí.';list.append(p);return;
      }
      plays.forEach(item=>{
        const row=document.createElement('div');row.className='libraryRow';
        const info=document.createElement('div');info.innerHTML='<strong></strong><small></small>';
        info.querySelector('strong').textContent=item.name||item.slug;
        info.querySelector('small').textContent=item.description||'CourtPlay';
        const load=document.createElement('button');load.type='button';load.textContent='Abrir';
        load.addEventListener('click',()=>loadPlay(item.slug));
        row.append(info,load);list.append(row);
      });
    }catch(e){
      list.innerHTML='<p class="libraryMessage">No pude abrir la biblioteca ahora mismo. La app sigue funcionando normalmente.</p>';
    }
  }

  button?.addEventListener('click',openLibrary);
  const slug=new URLSearchParams(location.search).get('play');
  if(slug)loadPlay(slug,{closePanel:false});
  window.CourtPlayLibrary={loadPlay,openLibrary};
})();