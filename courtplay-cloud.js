(function(){
  'use strict';

  const SUPABASE_URL='https://fsimcxwegeyxcekhlexq.supabase.co';
  const SUPABASE_KEY='sb_publishable_DtWZpI45a_PwqGCLKHMUYA_1gCHxwij';
  const TABLE='courtplay_plays';
  const LOCAL_KEY='courtplay_my_library_v1';
  const OUTBOX_KEY='courtplay_cloud_outbox_v1';

  let client=null,session=null,ready=false,flushing=false,sdkPromise=null;

  function ensureSdk(){
    if(window.supabase&&typeof window.supabase.createClient==='function')return Promise.resolve(true);
    if(navigator.onLine===false)return Promise.resolve(false);
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise(resolve=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0?courtplay-retry='+Date.now();
      script.async=true;
      script.onload=()=>resolve(!!(window.supabase&&typeof window.supabase.createClient==='function'));
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    }).finally(()=>{sdkPromise=null;});
    return sdkPromise;
  }

  function init(){
    if(client)return client;
    if(!window.supabase||typeof window.supabase.createClient!=='function')return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((_event,next)=>{
      session=next;
      document.dispatchEvent(new CustomEvent('courtplay:cloud-auth-changed'));
      if(session&&navigator.onLine!==false){
        setTimeout(()=>flushOutbox({reason:'auth-change'}).catch(()=>{}),0);
      }
    });
    return client;
  }

  async function ensureReady(){
    if(!(window.supabase&&typeof window.supabase.createClient==='function')){
      const loaded=await ensureSdk();
      if(!loaded)return false;
    }
    const c=init();
    if(!c)return false;
    if(!ready){
      const {data}=await c.auth.getSession();
      session=data.session||null;
      ready=true;
    }
    return true;
  }

  function user(){return session&&session.user?session.user:null}
  function isSignedIn(){return !!user()}

  async function signIn(email,password){
    await ensureReady();
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error)throw error;
    session=data.session||null;
    await syncLocalToCloud();
    await flushOutbox({reason:'signin'});
    return data;
  }

  async function signUp(email,password){
    await ensureReady();
    const redirectTo='https://torresgerardoe85-oss.github.io/Courtplay/v2.html?v=42';
    const {data,error}=await client.auth.signUp({
      email,
      password,
      options:{emailRedirectTo:redirectTo}
    });
    if(error)throw error;
    session=data.session||null;
    if(session)await syncLocalToCloud();
    return data;
  }

  async function signOut(){
    await ensureReady();
    const {error}=await client.auth.signOut();
    if(error)throw error;
    session=null;
  }

  function readLocal(){
    try{
      const parsed=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(e){return[]}
  }
  function writeLocal(items){
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify((items||[]).slice(0,100)));}catch(e){}
  }
  function readOutbox(){
    try{
      const raw=JSON.parse(localStorage.getItem(OUTBOX_KEY)||'{}');
      return{
        upserts:Array.isArray(raw.upserts)?raw.upserts:[],
        deletes:Array.isArray(raw.deletes)?raw.deletes:[]
      };
    }catch(e){return{upserts:[],deletes:[]}}
  }
  function writeOutbox(box){
    try{
      localStorage.setItem(OUTBOX_KEY,JSON.stringify({
        upserts:[...new Set(box.upserts||[])],
        deletes:[...new Set(box.deletes||[])]
      }));
    }catch(e){}
    document.dispatchEvent(new CustomEvent('courtplay:cloud-queue-changed'));
  }
  function queueUpsert(libraryId){
    if(!libraryId)return;
    const box=readOutbox();
    box.deletes=box.deletes.filter(id=>id!==libraryId);
    if(!box.upserts.includes(libraryId))box.upserts.push(libraryId);
    writeOutbox(box);
  }
  function queueDelete(libraryId){
    if(!libraryId)return;
    const box=readOutbox();
    box.upserts=box.upserts.filter(id=>id!==libraryId);
    if(!box.deletes.includes(libraryId))box.deletes.push(libraryId);
    writeOutbox(box);
  }
  function pendingCount(){
    const box=readOutbox();
    return box.upserts.length+box.deletes.length;
  }

  async function listPlays(){
    await ensureReady();
    if(!isSignedIn())return [];
    const {data,error}=await client.from(TABLE)
      .select('library_id,name,play,created_at,updated_at')
      .order('updated_at',{ascending:false});
    if(error)throw error;
    return data||[];
  }

  async function savePlay(play){
    await ensureReady();
    const u=user();
    if(!u)throw new Error('AUTH_REQUIRED');
    const libraryId=play.libraryId||('lib_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7));
    const stamp=play.savedAt||new Date().toISOString();
    play.libraryId=libraryId;
    play.savedAt=stamp;
    const row={
      user_id:u.id,
      library_id:libraryId,
      name:play.name||'Jugada sin nombre',
      play:JSON.parse(JSON.stringify(play)),
      updated_at:stamp
    };
    const {error}=await client.from(TABLE).upsert(row,{onConflict:'user_id,library_id'});
    if(error)throw error;
    return libraryId;
  }

  async function deletePlay(libraryId){
    await ensureReady();
    if(!isSignedIn())throw new Error('AUTH_REQUIRED');
    const {error}=await client.from(TABLE).delete().eq('library_id',libraryId);
    if(error)throw error;
  }

  async function syncLocalToCloud(){
    await ensureReady();
    if(!isSignedIn()||navigator.onLine===false)return {uploaded:0,pulled:0};
    let local=readLocal();
    const remote=await listPlays();
    const byRemote=new Map(remote.map(x=>[x.library_id,x]));
    const byLocal=new Map(local.map(x=>[x.id,x]));
    let uploaded=0,pulled=0;

    for(const item of local){
      if(!item||!item.id||!item.play)continue;
      const r=byRemote.get(item.id);
      const localTime=Date.parse(item.updatedAt||item.play.savedAt||0)||0;
      const remoteTime=r?(Date.parse(r.updated_at||0)||0):0;
      if(!r||localTime>remoteTime){
        const p=JSON.parse(JSON.stringify(item.play));
        p.libraryId=item.id;
        if(item.name)p.name=item.name;
        await savePlay(p);
        uploaded++;
      }else if(r&&remoteTime>localTime){
        item.name=r.name||item.name;
        item.updatedAt=r.updated_at;
        item.play=JSON.parse(JSON.stringify(r.play));
        item.play.libraryId=item.id;
        pulled++;
      }
    }

    for(const r of remote){
      if(byLocal.has(r.library_id))continue;
      local.unshift({
        id:r.library_id,
        name:r.name||'Jugada',
        updatedAt:r.updated_at,
        play:JSON.parse(JSON.stringify(r.play))
      });
      pulled++;
    }
    writeLocal(local);
    return {uploaded,pulled};
  }

  async function flushOutbox({reason='auto'}={}){
    if(flushing)return {busy:true,pending:pendingCount()};
    await ensureReady();
    if(!isSignedIn()||navigator.onLine===false)return {offline:true,pending:pendingCount()};
    flushing=true;
    document.dispatchEvent(new CustomEvent('courtplay:cloud-sync-start',{detail:{reason}}));
    let uploaded=0,deleted=0,pulled=0,error=null;
    try{
      let box=readOutbox();
      const local=readLocal();

      for(const id of [...box.deletes]){
        try{
          await deletePlay(id);
          box.deletes=box.deletes.filter(x=>x!==id);
          writeOutbox(box);
          deleted++;
        }catch(e){error=e;break;}
      }

      if(!error){
        const remote=await listPlays();
        const byRemote=new Map(remote.map(x=>[x.library_id,x]));
        for(const id of [...box.upserts]){
          const item=local.find(x=>x.id===id);
          if(!item||!item.play){
            box.upserts=box.upserts.filter(x=>x!==id);
            writeOutbox(box);
            continue;
          }
          const r=byRemote.get(id);
          const localTime=Date.parse(item.updatedAt||item.play.savedAt||0)||0;
          const remoteTime=r?(Date.parse(r.updated_at||0)||0):0;
          if(r&&remoteTime>localTime){
            const items=readLocal(),at=items.findIndex(x=>x.id===id);
            if(at>=0){
              items[at]={
                id,
                name:r.name||items[at].name,
                updatedAt:r.updated_at,
                play:JSON.parse(JSON.stringify(r.play))
              };
              items[at].play.libraryId=id;
              writeLocal(items);
              pulled++;
            }
          }else{
            const p=JSON.parse(JSON.stringify(item.play));
            p.libraryId=id;
            p.savedAt=item.updatedAt||p.savedAt||new Date().toISOString();
            if(item.name)p.name=item.name;
            await savePlay(p);
            uploaded++;
          }
          box=readOutbox();
          box.upserts=box.upserts.filter(x=>x!==id);
          writeOutbox(box);
        }
      }

      if(!error){
        const merged=await syncLocalToCloud();
        uploaded+=merged.uploaded||0;
        pulled+=merged.pulled||0;
      }
      return {uploaded,deleted,pulled,pending:pendingCount(),error};
    }catch(e){
      error=e;
      return {uploaded,deleted,pulled,pending:pendingCount(),error:e};
    }finally{
      flushing=false;
      document.dispatchEvent(new CustomEvent('courtplay:cloud-sync-end',{detail:{uploaded,deleted,pulled,pending:pendingCount(),error}}));
    }
  }

  function installAutoSync(){
    window.addEventListener('online',()=>flushOutbox({reason:'online'}).catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'&&navigator.onLine!==false)flushOutbox({reason:'resume'}).catch(()=>{});
    });
    window.addEventListener('pageshow',()=>{
      if(navigator.onLine!==false)flushOutbox({reason:'pageshow'}).catch(()=>{});
    });
    setInterval(()=>{
      if(document.visibilityState==='visible'&&navigator.onLine!==false&&pendingCount()>0){
        flushOutbox({reason:'interval'}).catch(()=>{});
      }
    },30000);
  }

  function friendlyError(error){
    const msg=String((error&&error.message)||error||'');
    if(msg.includes('Invalid login credentials'))return 'Correo o contraseña incorrectos.';
    if(msg.includes('Email not confirmed'))return 'Confirma tu correo antes de iniciar sesión.';
    if(msg.includes('already registered'))return 'Ese correo ya tiene una cuenta. Usa Iniciar sesión.';
    if(msg.includes('Password should be'))return 'La contraseña debe tener al menos 6 caracteres.';
    return msg||'Ocurrió un error conectando con CourtPlay Cloud.';
  }

  async function renderAuth(container,onChanged){
    await ensureReady();
    container.innerHTML='';
    const box=document.createElement('div');box.className='cloudAuthBox';
    if(isSignedIn()){
      const info=document.createElement('div');info.className='cloudAuthInfo';
      const strong=document.createElement('strong');
      const pending=pendingCount(),offline=navigator.onLine===false;
      if(offline)strong.textContent='☁ Sin conexión · guardando en este dispositivo';
      else if(pending)strong.textContent='☁ '+pending+' cambio'+(pending===1?'':'s')+' pendiente'+(pending===1?'':'s')+' de sincronizar';
      else strong.textContent='☁ Mi Biblioteca está sincronizada';
      const small=document.createElement('small');
      small.textContent=(user().email||'Cuenta CourtPlay')+(offline?' · Se sincronizará al volver el internet':'');
      info.append(strong,small);
      const logout=document.createElement('button');logout.type='button';logout.className='cloudAuthSecondary';logout.textContent='Cerrar sesión';
      logout.addEventListener('click',async()=>{
        try{await signOut();if(onChanged)onChanged();}catch(e){alert(friendlyError(e));}
      });
      box.append(info,logout);
    }else{
      const title=document.createElement('strong');title.textContent='☁ Sincroniza Mi Biblioteca';
      const note=document.createElement('small');note.textContent='Usa la misma cuenta en iPad, PC y teléfono.';
      const email=document.createElement('input');email.type='email';email.placeholder='Correo electrónico';email.autocomplete='email';
      const password=document.createElement('input');password.type='password';password.placeholder='Contraseña';password.autocomplete='current-password';
      const buttons=document.createElement('div');buttons.className='cloudAuthButtons';
      const login=document.createElement('button');login.type='button';login.className='cloudAuthPrimary';login.textContent='Iniciar sesión';
      const signup=document.createElement('button');signup.type='button';signup.className='cloudAuthSecondary';signup.textContent='Crear cuenta';
      const status=document.createElement('div');status.className='cloudAuthStatus';
      async function run(mode){
        const em=email.value.trim(),pw=password.value;
        if(!em||!pw){status.textContent='Escribe correo y contraseña.';return;}
        login.disabled=signup.disabled=true;status.textContent='Conectando…';
        try{
          const result=mode==='login'?await signIn(em,pw):await signUp(em,pw);
          if(mode==='signup'&&!result.session){
            status.textContent='Cuenta creada. Revisa tu correo para confirmar. Después vuelve a CourtPlay e inicia sesión.';
          }else{
            status.textContent='Biblioteca sincronizada.';
            if(onChanged)onChanged();
          }
        }catch(e){status.textContent=friendlyError(e);}
        finally{login.disabled=signup.disabled=false;}
      }
      login.addEventListener('click',()=>run('login'));
      signup.addEventListener('click',()=>run('signup'));
      buttons.append(login,signup);
      box.append(title,note,email,password,buttons,status);
    }
    container.append(box);
  }

  window.CourtPlayCloud={
    ensureReady,user,isSignedIn,signIn,signUp,signOut,listPlays,savePlay,deletePlay,syncLocalToCloud,
    queueUpsert,queueDelete,pendingCount,flushOutbox,renderAuth,friendlyError
  };
  installAutoSync();
  ensureReady().then(async()=>{
    document.dispatchEvent(new CustomEvent('courtplay:cloud-ready'));
    if(isSignedIn()&&navigator.onLine!==false)await flushOutbox({reason:'startup'});
  }).catch(()=>{});
})();