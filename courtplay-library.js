(function(){
  'use strict';
  const button=document.getElementById('libraryBtn');
  const base='./plays/';
  const LOCAL_KEY='courtplay_my_library_v1';

  const clone=v=>JSON.parse(JSON.stringify(v));

  function readLocal(){
    try{
      const parsed=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(e){return[]}
  }
  function writeLocal(items){
    localStorage.setItem(LOCAL_KEY,JSON.stringify(items.slice(0,100)));
  }
  function makeId(){
    return 'lib_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
  }
  function closeAny(id){
    document.getElementById(id)?.remove();
  }
  function notify(message,type='ok'){
    if(typeof showToast==='function')showToast(message,type,type==='error'?4200:2600);
    else setStatus(message);
  }

  function saveCurrentToMyLibrary(){
    try{
      commit();CourtPlayEngine.reflow(data.frames,0);
      if(!data.libraryId)data.libraryId=makeId();
      data.savedAt=new Date().toISOString();
      const item={
        id:data.libraryId,
        name:data.name||playNameEl.value||'Jugada sin nombre',
        updatedAt:data.savedAt,
        play:clone(data)
      };
      const items=readLocal();
      const at=items.findIndex(x=>x.id===item.id);
      if(at>=0)items.splice(at,1);
      items.unshift(item);writeLocal(items);
      notify('Jugada guardada en Mi Biblioteca.');
      return item.id;
    }catch(e){
      notify('No se pudo guardar en Mi Biblioteca.','error');return null;
    }
  }

  function loadLocalPlay(id){
    const item=readLocal().find(x=>x.id===id);
    if(!item)return false;
    try{
      const raw=clone(item.play);
      const loaded=typeof migrate==='function'?(migrate(raw)||raw):raw;
      data=loaded;data.version=2;data.libraryId=id;
      CourtPlayEngine.reflow(data.frames,0);
      current=0;selectedLine=-1;selectedPlayer=null;
      playNameEl.value=data.name||item.name||'Jugada';
      render();setStatus('Jugada abierta desde Mi Biblioteca.');
      closeAny('courtplayLibraryPanel');
      return true;
    }catch(e){
      notify('No pude abrir esa jugada.','error');return false;
    }
  }

  function deleteLocalPlay(id){
    const items=readLocal(),item=items.find(x=>x.id===id);
    if(!item)return;
    if(!confirm('¿Eliminar "'+(item.name||'esta jugada')+'" de Mi Biblioteca?'))return;
    writeLocal(items.filter(x=>x.id!==id));
    renderLibraryContents();
  }

  function openSaveMenu(){
    closeAny('courtplaySaveMenu');
    const wrap=document.createElement('div');wrap.id='courtplaySaveMenu';wrap.className='saveOverlay';
    const panel=document.createElement('div');panel.className='savePanel';
    const title=document.createElement('strong');title.textContent='Guardar jugada';
    const desc=document.createElement('p');desc.textContent='Elige dónde quieres guardar esta jugada.';
    const device=document.createElement('button');device.type='button';device.className='saveChoice';
    device.innerHTML='<strong>En este dispositivo</strong><small>Guarda la jugada actual para continuar después.</small>';
    const library=document.createElement('button');library.type='button';library.className='saveChoice primary';
    library.innerHTML='<strong>En Mi Biblioteca</strong><small>La añade a tu lista de jugadas dentro de CourtPlay.</small>';
    const exportPlay=document.createElement('button');exportPlay.type='button';exportPlay.className='saveChoice';
    exportPlay.innerHTML='<strong>Exportar jugada (.json)</strong><small>Descarga los datos exactos de esta jugada para compartirlos, respaldarlos o diagnosticar errores.</small>';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='saveCancel';cancel.textContent='Cancelar';

    device.addEventListener('click',()=>{wrap.remove();window.CourtPlaySaveToDevice?.();});
    library.addEventListener('click',()=>{const id=saveCurrentToMyLibrary();if(id)wrap.remove();});
    exportPlay.addEventListener('click',async()=>{
      try{
        commit();
        const payload=clone(data);
        payload.exportedAt=new Date().toISOString();
        payload.courtPlayExportVersion=1;
        const text=JSON.stringify(payload,null,2);
        const blob=new Blob([text],{type:'application/json'});
        const clean=(payload.name||'CourtPlay').trim().replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'CourtPlay';
        const filename=clean+'.courtplay.json';
        wrap.remove();
        if(typeof shareFileIfPossible==='function'&&await shareFileIfPossible(blob,filename,'CourtPlay — '+(payload.name||'Jugada'))){
          notify('Archivo de jugada listo para compartir.');
        }else if(typeof showReadyFile==='function'){
          showReadyFile(blob,filename,'Jugada CourtPlay');
        }else{
          const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
          notify('Archivo de jugada exportado.');
        }
      }catch(e){notify('No pude exportar la jugada.','error');}
    });
    cancel.addEventListener('click',()=>wrap.remove());
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
    panel.append(title,desc,device,library,exportPlay,cancel);wrap.append(panel);document.body.append(wrap);
  }

  function ensurePanel(){
    let wrap=document.getElementById('courtplayLibraryPanel');
    if(wrap)return wrap;
    wrap=document.createElement('div');wrap.id='courtplayLibraryPanel';wrap.className='libraryOverlay';
    const panel=document.createElement('div');panel.className='libraryPanel';

    const head=document.createElement('div');head.className='libraryHead';
    const title=document.createElement('div');
    title.innerHTML='<strong>Biblioteca CourtPlay</strong><small>Tu biblioteca y las jugadas que yo construya para ti.</small>';
    const close=document.createElement('button');close.type='button';close.textContent='×';close.className='libraryClose';
    close.addEventListener('click',()=>wrap.remove());
    head.append(title,close);

    const actions=document.createElement('div');actions.className='libraryTopActions';
    const saveNow=document.createElement('button');saveNow.type='button';saveNow.textContent='＋ Guardar jugada actual';
    saveNow.addEventListener('click',()=>{if(saveCurrentToMyLibrary())renderLibraryContents();});
    const ask=document.createElement('button');ask.type='button';ask.textContent='Cómo pedirme una jugada';
    ask.addEventListener('click',toggleAskHelp);
    actions.append(saveNow,ask);

    const help=document.createElement('div');help.id='courtplayAskHelp';help.className='libraryAskHelp';
    help.hidden=true;
    const h=document.createElement('strong');h.textContent='Pídemela en nuestro chat de CourtPlay';
    const p1=document.createElement('p');p1.textContent='Ejemplo: “Crea en CourtPlay un Spain PnR con opción al roll y al skip para triple.”';
    const p2=document.createElement('p');p2.textContent='También puedes decir: “Haz este patrón en CourtPlay, con 4 fases, explicación por fase y las opciones en colores diferentes.”';
    const p3=document.createElement('p');p3.textContent='Yo la construyo y la publico en la Biblioteca CourtPlay. Luego la abres aquí y puedes editarla.';
    help.append(h,p1,p2,p3);

    const content=document.createElement('div');content.id='courtplayLibraryContents';
    panel.append(head,actions,help,content);wrap.append(panel);document.body.append(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
    return wrap;
  }

  function toggleAskHelp(){
    const help=document.getElementById('courtplayAskHelp');
    if(help)help.hidden=!help.hidden;
  }

  function sectionTitle(text,subtext){
    const box=document.createElement('div');box.className='librarySectionTitle';
    const s=document.createElement('strong');s.textContent=text;box.append(s);
    if(subtext){const small=document.createElement('small');small.textContent=subtext;box.append(small);}
    return box;
  }

  function localRows(container){
    container.append(sectionTitle('Mi Biblioteca','Guardada en este navegador/dispositivo.'));
    const items=readLocal();
    if(!items.length){
      const p=document.createElement('p');p.className='libraryMessage';p.textContent='Aún no has guardado jugadas en Mi Biblioteca.';container.append(p);return;
    }
    items.forEach(item=>{
      const row=document.createElement('div');row.className='libraryRow';
      const info=document.createElement('div');
      const strong=document.createElement('strong');strong.textContent=item.name||'Jugada';
      const small=document.createElement('small');
      small.textContent=item.updatedAt?'Actualizada '+new Date(item.updatedAt).toLocaleString():'Guardada en este dispositivo';
      info.append(strong,small);
      const actions=document.createElement('div');actions.className='libraryRowActions';
      const open=document.createElement('button');open.type='button';open.textContent='Abrir';open.addEventListener('click',()=>loadLocalPlay(item.id));
      const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Eliminar';del.addEventListener('click',()=>deleteLocalPlay(item.id));
      actions.append(open,del);row.append(info,actions);container.append(row);
    });
  }

  async function remoteRows(container){
    container.append(sectionTitle('Biblioteca CourtPlay','Jugadas que yo publique para ti desde nuestro chat.'));
    const loading=document.createElement('p');loading.className='libraryMessage';loading.textContent='Buscando jugadas publicadas…';container.append(loading);
    try{
      const res=await fetch(base+'index.json?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('index');
      const payload=await res.json(),plays=Array.isArray(payload)?payload:(payload.plays||[]);
      loading.remove();
      if(!plays.length){
        const p=document.createElement('p');p.className='libraryMessage';p.textContent='Todavía no te he publicado jugadas. Cuando me pidas una en el chat, aparecerá aquí.';container.append(p);return;
      }
      plays.forEach(item=>{
        const row=document.createElement('div');row.className='libraryRow';
        const info=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=item.name||item.slug;
        const small=document.createElement('small');small.textContent=item.description||'Creada para CourtPlay';
        info.append(strong,small);
        const actions=document.createElement('div');actions.className='libraryRowActions';
        const open=document.createElement('button');open.type='button';open.textContent='Abrir';
        open.addEventListener('click',()=>loadPlay(item.slug));
        actions.append(open);row.append(info,actions);container.append(row);
      });
    }catch(e){
      loading.textContent='No pude consultar las jugadas publicadas ahora mismo.';
    }
  }

  function renderLibraryContents(){
    const wrap=ensurePanel(),content=wrap.querySelector('#courtplayLibraryContents');
    content.innerHTML='';localRows(content);remoteRows(content);
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
      delete data.libraryId;
      CourtPlayEngine.reflow(data.frames,0);
      current=0;selectedLine=-1;selectedPlayer=null;
      playNameEl.value=data.name||slug;
      render();
      setStatus('Jugada cargada. Puedes editarla y guardarla en Mi Biblioteca.');
      if(closePanel)closeAny('courtplayLibraryPanel');
      return true;
    }catch(e){
      notify('No pude cargar esa jugada de CourtPlay.','error');return false;
    }
  }

  function openLibrary(){ensurePanel();renderLibraryContents();}

  button?.addEventListener('click',openLibrary);
  const slug=new URLSearchParams(location.search).get('play');
  if(slug)loadPlay(slug,{closePanel:false});
  window.CourtPlayLibrary={loadPlay,openLibrary,openSaveMenu,saveCurrentToMyLibrary,loadLocalPlay};
})();