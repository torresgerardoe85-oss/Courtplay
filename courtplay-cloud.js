(function(){
  'use strict';

  const SUPABASE_URL='https://fsimcxwegeyxcekhlexq.supabase.co';
  const SUPABASE_KEY='sb_publishable_DtWZpI45a_PwqGCLKHMUYA_1gCHxwij';
  const TABLE='courtplay_plays';
  const LOCAL_KEY='courtplay_my_library_v1';

  let client=null,session=null,ready=false;

  function init(){
    if(client)return client;
    if(!window.supabase||typeof window.supabase.createClient!=='function')return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    client.auth.onAuthStateChange((_event,next)=>{
      session=next;
      document.dispatchEvent(new CustomEvent('courtplay:cloud-auth-changed'));
    });
    return client;
  }

  async function ensureReady(){
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
    return data;
  }

  async function signUp(email,password){
    await ensureReady();
    const {data,error}=await client.auth.signUp({email,password});
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
    const now=new Date().toISOString();
    const libraryId=play.libraryId||('lib_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7));
    play.libraryId=libraryId;
    play.savedAt=now;
    const row={
      user_id:u.id,
      library_id:libraryId,
      name:play.name||'Jugada sin nombre',
      play:JSON.parse(JSON.stringify(play)),
      updated_at:now
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
    if(!isSignedIn())return {uploaded:0};
    const local=readLocal();
    const remote=await listPlays();
    const byId=new Map(remote.map(x=>[x.library_id,x]));
    let uploaded=0;
    for(const item of local){
      if(!item||!item.id||!item.play)continue;
      const r=byId.get(item.id);
      const localTime=Date.parse(item.updatedAt||item.play.savedAt||0)||0;
      const remoteTime=r?(Date.parse(r.updated_at||0)||0):0;
      if(!r||localTime>remoteTime){
        const p=JSON.parse(JSON.stringify(item.play));
        p.libraryId=item.id;
        if(item.name)p.name=item.name;
        await savePlay(p);
        uploaded++;
      }
    }
    return {uploaded};
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
      const strong=document.createElement('strong');strong.textContent='☁ Mi Biblioteca está sincronizada';
      const small=document.createElement('small');small.textContent=user().email||'Cuenta CourtPlay';
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
            status.textContent='Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.';
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
    ensureReady,user,isSignedIn,signIn,signUp,signOut,listPlays,savePlay,deletePlay,syncLocalToCloud,renderAuth,friendlyError
  };
  ensureReady().then(()=>document.dispatchEvent(new CustomEvent('courtplay:cloud-ready'))).catch(()=>{});
})();