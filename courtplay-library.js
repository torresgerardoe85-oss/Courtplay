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

  function saveCurrentToMyLibrary({asNew=false}={}){
    try{
      commit();CourtPlayEngine.reflow(data.frames,0);
      if(asNew||!data.libraryId)data.libraryId=makeId();
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
      if(window.CourtPlayCloud){
        window.CourtPlayCloud.queueUpsert(item.id);
        if(window.CourtPlayCloud.isSignedIn()){
          if(navigator.onLine===false){
            notify('Jugada guardada en este dispositivo. Quedó pendiente y se sincronizará automáticamente cuando vuelva el internet.');
          }else{
            window.CourtPlayCloud.flushOutbox({reason:'save'}).then(result=>{
              if(result&&result.error){
                notify('Jugada guardada localmente. La sincronización se reintentará automáticamente.','error');
              }else{
                notify('Jugada guardada y sincronizada en Mi Biblioteca ☁.');
              }
            }).catch(()=>notify('Jugada guardada localmente. La sincronización se reintentará automáticamente.','error'));
          }
        }else{
          notify('Jugada guardada en este dispositivo. Inicia sesión para sincronizarla.');
        }
      }else{
        notify('Jugada guardada en este dispositivo.');
      }
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

  function openLibrarySaveChoices({onDone=null}={}){
    closeAny('courtplayLibrarySaveChoice');
    if(!data.libraryId){
      const id=saveCurrentToMyLibrary({asNew:true});
      if(id&&onDone)onDone(id);
      return;
    }
    const wrap=document.createElement('div');wrap.id='courtplayLibrarySaveChoice';wrap.className='saveOverlay';
    const panel=document.createElement('div');panel.className='savePanel';
    const title=document.createElement('strong');title.textContent='Guardar en Mi Biblioteca';
    const desc=document.createElement('p');desc.textContent='Esta jugada ya existe en tu biblioteca. ¿Qué quieres hacer?';

    const overwrite=document.createElement('button');overwrite.type='button';overwrite.className='saveChoice primary';
    overwrite.innerHTML='<strong>Guardar encima</strong><small>Actualiza esta misma jugada en todos tus dispositivos.</small>';

    const saveAs=document.createElement('button');saveAs.type='button';saveAs.className='saveChoice';
    saveAs.innerHTML='<strong>Guardar como nueva</strong><small>Crea una copia independiente y conserva la versión original.</small>';

    const cancel=document.createElement('button');cancel.type='button';cancel.className='saveCancel';cancel.textContent='Cancelar';

    overwrite.addEventListener('click',()=>{
      const id=saveCurrentToMyLibrary({asNew:false});
      if(id){wrap.remove();if(onDone)onDone(id);}
    });
    saveAs.addEventListener('click',()=>{
      const id=saveCurrentToMyLibrary({asNew:true});
      if(id){wrap.remove();if(onDone)onDone(id);}
    });
    cancel.addEventListener('click',()=>wrap.remove());
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});

    panel.append(title,desc,overwrite,saveAs,cancel);
    wrap.append(panel);document.body.append(wrap);
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
    library.innerHTML=data.libraryId
      ?'<strong>En Mi Biblioteca</strong><small>Elige si quieres actualizar esta jugada o guardarla como una nueva.</small>'
      :'<strong>En Mi Biblioteca</strong><small>La añade como una jugada nueva dentro de CourtPlay.</small>';
    const exportPlay=document.createElement('button');exportPlay.type='button';exportPlay.className='saveChoice';
    exportPlay.innerHTML='<strong>Exportar jugada (.json)</strong><small>Descarga los datos exactos de esta jugada para compartirlos, respaldarlos o diagnosticar errores.</small>';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='saveCancel';cancel.textContent='Cancelar';

    device.addEventListener('click',()=>{wrap.remove();window.CourtPlaySaveToDevice?.();});
    library.addEventListener('click',()=>{
      wrap.remove();
      openLibrarySaveChoices();
    });
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

    const cloudAuth=document.createElement('div');cloudAuth.id='courtplayCloudAuth';cloudAuth.className='cloudAuthHost';

    const actions=document.createElement('div');actions.className='libraryTopActions';
    const saveNow=document.createElement('button');saveNow.type='button';saveNow.textContent='＋ Guardar jugada actual';
    saveNow.addEventListener('click',()=>openLibrarySaveChoices({onDone:()=>renderLibraryContents()}));
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
    panel.append(head,cloudAuth,actions,help,content);wrap.append(panel);document.body.append(wrap);
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
    container.append(sectionTitle(window.CourtPlayCloud?.isSignedIn()?'Respaldo local':'Mi Biblioteca local',window.CourtPlayCloud?.isSignedIn()?'Copia disponible en este navegador/dispositivo.':'Guardada solo en este navegador/dispositivo hasta que inicies sesión.'));
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

  function loadCloudPlay(item){
    if(!item||!item.play)return false;
    try{
      const raw=clone(item.play);
      const loaded=typeof migrate==='function'?(migrate(raw)||raw):raw;
      data=loaded;data.version=2;data.libraryId=item.library_id||data.libraryId;
      CourtPlayEngine.reflow(data.frames,0);
      current=0;selectedLine=-1;selectedPlayer=null;
      playNameEl.value=data.name||item.name||'Jugada';
      const cached={
        id:data.libraryId,
        name:data.name||item.name||'Jugada',
        updatedAt:item.updated_at||data.savedAt||new Date().toISOString(),
        play:clone(data)
      };
      const locals=readLocal(),at=locals.findIndex(x=>x.id===cached.id);
      if(at>=0)locals.splice(at,1);
      locals.unshift(cached);writeLocal(locals);
      render();setStatus('Jugada abierta desde Mi Biblioteca Cloud y disponible como respaldo local.');
      closeAny('courtplayLibraryPanel');
      return true;
    }catch(e){
      notify('No pude abrir esa jugada de la nube.','error');return false;
    }
  }

  async function deleteCloudPlay(item){
    if(!item||!item.library_id)return;
    if(!confirm('¿Eliminar "'+(item.name||'esta jugada')+'" de Mi Biblioteca en todos tus dispositivos?'))return;
    try{
      const locals=readLocal().filter(x=>x.id!==item.library_id);writeLocal(locals);
      window.CourtPlayCloud.queueDelete(item.library_id);
      if(navigator.onLine===false){
        notify('Eliminación guardada. Se aplicará en la nube cuando vuelva el internet.');
      }else{
        const result=await window.CourtPlayCloud.flushOutbox({reason:'delete'});
        if(result&&result.error)notify('Eliminación pendiente. CourtPlay la reintentará automáticamente.','error');
        else notify('Jugada eliminada de Mi Biblioteca Cloud.');
      }
      renderLibraryContents();
    }catch(e){
      notify('Eliminación pendiente. CourtPlay la reintentará automáticamente.','error');
      renderLibraryContents();
    }
  }

  async function cloudRows(container){
    if(!window.CourtPlayCloud?.isSignedIn())return;
    container.append(sectionTitle('Mi Biblioteca Cloud','Sincronizada entre tus dispositivos.'));
    const loading=document.createElement('p');loading.className='libraryMessage';loading.textContent='Sincronizando jugadas…';container.append(loading);
    try{
      const items=await window.CourtPlayCloud.listPlays();
      loading.remove();
      if(!items.length){
        const p=document.createElement('p');p.className='libraryMessage';p.textContent='Tu biblioteca cloud está vacía. Guarda una jugada y aparecerá aquí en todos tus dispositivos.';container.append(p);return;
      }
      items.forEach(item=>{
        const row=document.createElement('div');row.className='libraryRow';
        const info=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=item.name||'Jugada';
        const small=document.createElement('small');small.textContent=item.updated_at?'Sincronizada '+new Date(item.updated_at).toLocaleString():'Guardada en la nube';
        info.append(strong,small);
        const actions=document.createElement('div');actions.className='libraryRowActions';
        const open=document.createElement('button');open.type='button';open.textContent='Abrir';open.addEventListener('click',()=>loadCloudPlay(item));
        const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Eliminar';del.addEventListener('click',()=>deleteCloudPlay(item));
        actions.append(open,del);row.append(info,actions);container.append(row);
      });
    }catch(e){
      loading.textContent='No pude sincronizar Mi Biblioteca Cloud. Tus copias locales siguen disponibles.';
    }
  }

  async function deleteRemotePublishedPlay(item){
    if(!item||!item.slug)return;
    if(!confirm('¿Eliminar "'+(item.name||item.slug)+'" de Biblioteca CourtPlay?\n\nEsto no borra una copia que hayas guardado en Mi Biblioteca.'))return;
    try{
      if(window.CourtPlayCloud){
        const result=await window.CourtPlayCloud.hideRemotePlay(item.slug);
        if(result&&result.queued){
          notify('Jugada eliminada de este dispositivo. El cambio se sincronizará con tus otros dispositivos cuando CourtPlay Cloud esté conectado.');
        }else{
          notify('Jugada eliminada de Biblioteca CourtPlay en tus dispositivos.');
        }
      }else{
        const key='courtplay_hidden_remote_v1';
        let hidden=[];
        try{hidden=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(hidden))hidden=[];}catch(e){}
        if(!hidden.includes(item.slug))hidden.push(item.slug);
        localStorage.setItem(key,JSON.stringify(hidden));
        notify('Jugada eliminada de Biblioteca CourtPlay en este dispositivo.');
      }
      renderLibraryContents();
    }catch(e){
      notify('No pude eliminar esa jugada ahora mismo.','error');
    }
  }

  async function remoteRows(container){
    container.append(sectionTitle('Biblioteca CourtPlay','Jugadas que yo publique para ti desde nuestro chat.'));
    const loading=document.createElement('p');loading.className='libraryMessage';loading.textContent='Buscando jugadas publicadas…';container.append(loading);
    try{
      const res=await fetch(base+'index.json?ts='+Date.now(),{cache:'no-store'});
      if(!res.ok)throw new Error('index');
      const payload=await res.json(),plays=Array.isArray(payload)?payload:(payload.plays||[]);
      let hidden=[];
      if(window.CourtPlayCloud){
        try{hidden=await window.CourtPlayCloud.listHiddenRemoteSlugs();}catch(e){}
      }else{
        try{
          hidden=JSON.parse(localStorage.getItem('courtplay_hidden_remote_v1')||'[]');
          if(!Array.isArray(hidden))hidden=[];
        }catch(e){hidden=[];}
      }
      const hiddenSet=new Set(hidden);
      const visible=plays.filter(item=>item&&item.slug&&!hiddenSet.has(item.slug));
      loading.remove();
      if(!visible.length){
        const p=document.createElement('p');p.className='libraryMessage';
        p.textContent=plays.length?'No tienes jugadas publicadas pendientes en Biblioteca CourtPlay.':'Todavía no te he publicado jugadas. Cuando me pidas una en el chat, aparecerá aquí.';
        container.append(p);return;
      }
      visible.forEach(item=>{
        const row=document.createElement('div');row.className='libraryRow';
        const info=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=item.name||item.slug;
        const small=document.createElement('small');small.textContent=item.description||'Creada para CourtPlay';
        info.append(strong,small);
        const actions=document.createElement('div');actions.className='libraryRowActions';
        const open=document.createElement('button');open.type='button';open.textContent='Abrir';
        open.addEventListener('click',()=>loadPlay(item.slug));
        const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='Eliminar';
        del.addEventListener('click',()=>deleteRemotePublishedPlay(item));
        actions.append(open,del);row.append(info,actions);container.append(row);
      });
    }catch(e){
      loading.textContent='No pude consultar las jugadas publicadas ahora mismo.';
    }
  }

  function renderLibraryContents(){
    const wrap=ensurePanel(),content=wrap.querySelector('#courtplayLibraryContents'),auth=wrap.querySelector('#courtplayCloudAuth');
    content.innerHTML='';
    if(window.CourtPlayCloud){
      window.CourtPlayCloud.renderAuth(auth,()=>renderLibraryContents()).catch(()=>{});
      cloudRows(content).then(()=>{localRows(content);remoteRows(content);});
    }else{
      if(auth)auth.innerHTML='<div class="libraryMessage">Cloud no disponible; usando almacenamiento local.</div>';
      localRows(content);remoteRows(content);
    }
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

  document.addEventListener('courtplay:cloud-ready',()=>{if(document.getElementById('courtplayLibraryPanel'))renderLibraryContents();});
  document.addEventListener('courtplay:cloud-auth-changed',()=>{if(document.getElementById('courtplayLibraryPanel'))renderLibraryContents();});
  document.addEventListener('courtplay:cloud-queue-changed',()=>{if(document.getElementById('courtplayLibraryPanel'))renderLibraryContents();});
  document.addEventListener('courtplay:cloud-sync-end',e=>{
    if(document.getElementById('courtplayLibraryPanel'))renderLibraryContents();
    const d=e.detail||{};
    if(!d.error&&d.pending===0&&(d.uploaded||d.deleted||d.pulled)){
      setStatus('Mi Biblioteca Cloud está sincronizada.');
    }
  });

  button?.addEventListener('click',openLibrary);
  const slug=new URLSearchParams(location.search).get('play');
  if(slug)loadPlay(slug,{closePanel:false});
  window.CourtPlayLibrary={loadPlay,openLibrary,openSaveMenu,openLibrarySaveChoices,saveCurrentToMyLibrary,loadLocalPlay};
})();