const pdfBtn=document.getElementById('pdfBtn');

function safeFileName(name){
  return (name||'CourtPlay').trim().replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'CourtPlay';
}
function ensureToast(){
  let el=document.getElementById('courtplayToast');
  if(!el){
    el=document.createElement('div');el.id='courtplayToast';el.className='courtplayToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el);
  }
  return el;
}
let toastTimer=null;
function showToast(message,type='ok',hold=2600){
  const el=ensureToast();el.textContent=message;el.className='courtplayToast show '+type;
  if(toastTimer)clearTimeout(toastTimer);
  if(hold>0)toastTimer=setTimeout(()=>el.classList.remove('show'),hold);
  setStatus(message);
}
function showReadyFile(blob,filename,label){
  let panel=document.getElementById('exportReadyPanel');
  if(panel)panel.remove();
  const url=URL.createObjectURL(blob);
  panel=document.createElement('div');panel.id='exportReadyPanel';panel.className='exportReadyPanel';
  const title=document.createElement('strong');title.textContent=label+' listo';
  const text=document.createElement('span');text.textContent='Toca abajo para abrirlo y luego usa Compartir/Guardar en tu dispositivo.';
  const link=document.createElement('a');link.href=url;link.download=filename;link.target='_blank';link.rel='noopener';link.textContent='Abrir / Guardar '+label;
  const close=document.createElement('button');close.type='button';close.textContent='Cerrar';
  const cleanup=()=>{URL.revokeObjectURL(url);panel.remove();};
  close.addEventListener('click',cleanup);
  panel.append(title,text,link,close);document.body.appendChild(panel);
  showToast(label+' creado.','ok');
}
function dataURLToBlob(dataURL){
  const parts=dataURL.split(','),mime=(parts[0].match(/:(.*?);/)||[])[1]||'application/octet-stream';
  const bin=atob(parts[1]),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}
async function shareFileIfPossible(blob,filename,title){
  try{
    if(typeof File==='undefined'||!navigator.share||!navigator.canShare)return false;
    const file=new File([blob],filename,{type:blob.type});
    if(!navigator.canShare({files:[file]}))return false;
    await navigator.share({files:[file],title});
    return true;
  }catch(e){
    if(e&&e.name==='AbortError')return true;
    return false;
  }
}
function save(){
  try{
    commit();CourtPlayEngine.reflow(data.frames,0);data.savedAt=new Date().toISOString();
    const payload=JSON.stringify(data);
    localStorage.setItem('courtplay_v2',payload);
    const verify=localStorage.getItem('courtplay_v2');
    if(!verify||JSON.parse(verify).frames.length!==data.frames.length)throw new Error('verification failed');
    const oldText=saveBtn.textContent;saveBtn.textContent='✓ Guardado';
    showToast('Jugada guardada en este dispositivo.','ok');
    setTimeout(()=>saveBtn.textContent=oldText,1800);
  }catch(e){
    showToast('No se pudo guardar la jugada.','error',4000);
  }
}
window.CourtPlaySaveToDevice=save;
saveBtn.addEventListener('click',()=>{
  if(window.CourtPlayLibrary&&typeof window.CourtPlayLibrary.openSaveMenu==='function'){
    window.CourtPlayLibrary.openSaveMenu();
  }else save();
});

function wrapText(c,text,x,y,maxW,lineH,maxLines=3){
  const words=(text||'').split(/\s+/);let line='',lines=[];
  for(const w of words){const test=line?line+' '+w:w;if(c.measureText(test).width>maxW&&line){lines.push(line);line=w}else line=test}
  if(line)lines.push(line);lines.slice(0,maxLines).forEach((ln,i)=>c.fillText(ln,x,y+i*lineH));
}
function compose(f,title,idx,total,out){
  const c=out.getContext('2d');c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);
  c.fillStyle='#fff';c.font='800 38px system-ui';c.textAlign='left';c.fillText(title,52,58);
  c.fillStyle='#b9cae1';c.font='600 22px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-52,58);
  c.save();c.translate(140,92);c.scale(1,1);drawScene(f,c,{hideHandles:true});c.restore();
  c.fillStyle='#fff';c.globalAlpha=.07;c.fillRect(55,980,out.width-110,165);c.globalAlpha=1;
  c.fillStyle='#f47a20';c.font='800 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,80,1020);
  c.fillStyle='#fff';c.font='500 27px system-ui';wrapText(c,f.caption||'Sin explicación',80,1062,out.width-160,36,3);
}
function makePhaseCanvas(f,idx){
  const out=document.createElement('canvas');out.width=1280;out.height=1180;
  compose(f,data.name,idx,data.frames.length,out);return out;
}
function makeAllPhasesCanvas(){
  const width=1280,headerH=110,sectionH=900,totalH=headerH+Math.max(1,data.frames.length)*sectionH;
  const out=document.createElement('canvas');out.width=width;out.height=totalH;
  const c=out.getContext('2d');
  c.fillStyle='#061c45';c.fillRect(0,0,width,totalH);
  c.fillStyle='#fff';c.font='800 42px system-ui';c.textAlign='left';c.fillText(data.name||'CourtPlay',54,66);
  data.frames.forEach((f,i)=>{
    const y=headerH+i*sectionH;
    c.fillStyle='#f47a20';c.font='900 24px system-ui';c.textAlign='left';c.fillText(`FASE ${i+1}`,54,y+38);
    c.save();c.translate(140,y+58);c.scale(1,0.78);drawScene(f,c,{hideHandles:true});c.restore();
    c.fillStyle='rgba(255,255,255,.08)';c.fillRect(54,y+760,width-108,110);
    c.fillStyle='#fff';c.font='500 23px system-ui';c.textAlign='left';
    wrapText(c,f.caption||'Sin explicación',76,y+798,width-152,31,2);
  });
  return out;
}
function bytesFromDataURL(dataURL){
  const b64=dataURL.split(',')[1],bin=atob(b64),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
}
function concatBytes(parts){
  const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let off=0;
  for(const p of parts){out.set(p,off);off+=p.length}return out;
}
function buildPdf(jpegs){
  const enc=new TextEncoder(),objects=[],pageW=842,pageH=595,margin=18;
  const pageIds=jpegs.map((_,i)=>3+i*3);
  objects[1]=enc.encode('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2]=enc.encode(`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${jpegs.length} >>`);
  jpegs.forEach((img,i)=>{
    const pageId=3+i*3,contentId=pageId+1,imageId=pageId+2;
    const availW=pageW-margin*2,availH=pageH-margin*2,ratio=img.width/img.height;
    let dw=availW,dh=dw/ratio;if(dh>availH){dh=availH;dw=dh*ratio}
    const x=(pageW-dw)/2,y=(pageH-dh)/2;
    const stream=`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    objects[pageId]=enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId]=enc.encode(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const head=enc.encode(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
    const foot=enc.encode('\nendstream');
    objects[imageId]=concatBytes([head,img.bytes,foot]);
  });
  const header=enc.encode('%PDF-1.4\n'),parts=[header],offsets=[0],count=objects.length-1;let offset=header.length;
  for(let i=1;i<=count;i++){
    const a=enc.encode(`${i} 0 obj\n`),b=objects[i],c=enc.encode('\nendobj\n');
    offsets[i]=offset;parts.push(a,b,c);offset+=a.length+b.length+c.length;
  }
  const xrefOffset=offset;
  let xref=`xref\n0 ${count+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=count;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  xref+=`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(enc.encode(xref));return new Blob(parts,{type:'application/pdf'});
}
function composeAnimation(scene,title,idx,total,out,activeAction,progress){
  const c=out.getContext('2d');
  c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);

  // Header outside the court
  c.fillStyle='#fff';c.font='800 34px system-ui';c.textAlign='left';c.fillText(title,44,48);
  c.fillStyle='#b9cae1';c.font='700 21px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-44,48);

  // Court: 1000x860, unscaled, fully separated from explanation
  c.save();c.translate(140,70);
  drawAnimationStep(scene,Array.isArray(activeAction)?activeAction:(activeAction?[activeAction]:[]),progress,c);
  c.restore();

  // Explanation band OUTSIDE the court
  const boxY=955,boxH=185;
  c.fillStyle='rgba(255,255,255,.09)';c.fillRect(44,boxY,out.width-88,boxH);
  c.fillStyle='#f47a20';c.font='900 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,70,boxY+38);
  c.fillStyle='#fff';c.font='500 26px system-ui';
  wrapText(c,(data.frames[idx]&&data.frames[idx].caption)||'Sin explicación',70,boxY+82,out.width-140,36,3);
}

pngBtn.addEventListener('click',async()=>{
  try{
    commit();CourtPlayEngine.reflow(data.frames,0);showToast('Preparando PNG con todas las fases…','working',0);
    const out=makeAllPhasesCanvas(),blob=dataURLToBlob(out.toDataURL('image/png'));
    const name=safeFileName(data.name)+'_todas_las_fases.png';
    if(!(await shareFileIfPossible(blob,name,'CourtPlay — Todas las fases')))showReadyFile(blob,name,'PNG');
    else showToast('PNG con todas las fases listo para guardar o compartir.','ok');
  }catch(e){showToast('No se pudo crear el PNG.','error',4000)}
});

pdfBtn?.addEventListener('click',async()=>{
  try{
    commit();CourtPlayEngine.reflow(data.frames,0);showToast('Creando PDF del playbook…','working',0);
    const jpegs=data.frames.map((f,i)=>{const c=makePhaseCanvas(f,i);return{width:c.width,height:c.height,bytes:bytesFromDataURL(c.toDataURL('image/jpeg',.9))}});
    const blob=buildPdf(jpegs),name=safeFileName(data.name)+'.pdf';
    if(!(await shareFileIfPossible(blob,name,'CourtPlay — '+data.name)))showReadyFile(blob,name,'PDF');
    else showToast('PDF listo para guardar o compartir.','ok');
  }catch(e){showToast('No se pudo crear el PDF.','error',4500)}
});

function playerByKey(scene,key){return(scene.players||[]).find(p=>p.key===key)||null}
function syncSceneBall(scene){return CourtPlayEngine.syncBall(scene)}
function actionForCurrentState(raw,scene){
  const action=CourtPlayEngine.clone(raw);
  CourtPlayEngine.normalizeAction(action);
  return action;
}
function applyCompletedAction(scene,l){return CourtPlayEngine.applyAction(scene,l,{mutate:true})}

function phaseSteps(phase){
  const actions=phase.lines||[],steps=[],seen=new Set();
  for(let i=0;i<actions.length;i++){
    const a=actions[i];
    if(a.simultaneousGroup){
      if(seen.has(a.simultaneousGroup))continue;
      seen.add(a.simultaneousGroup);
      steps.push(actions.filter(x=>x.simultaneousGroup===a.simultaneousGroup));
    }else steps.push([a]);
  }
  return steps;
}
function sceneDuringActions(base,rawActions,t){
  const scene=copy(base);
  const actions=rawActions.map(a=>actionForCurrentState(a,base));
  let ballHandled=false;
  for(const l of actions){
    const pts=pathPoints(l),src=playerByKey(scene,l.sourceKey),p=catmullPoint(pts,clamp(t,0,1));
    if(src&&['move','dribble','screen','handoff'].includes(l.type)){src.x=clamp(p.x,30,W-30);src.y=clamp(p.y,30,H-30);}
  }
  if(t>=.72){
    for(const l of actions){
      if(l.type==='handoff')CourtPlayEngine.ensureHandoffSeparation(scene,l,76);
    }
  }
  for(const l of actions){
    const pts=pathPoints(l),src=playerByKey(scene,l.sourceKey),p=catmullPoint(pts,clamp(t,0,1));
    if(l.type==='dribble'&&src&&!ballHandled){
      scene.ball.owner=src.key;syncSceneBall(scene);ballHandled=true;
    }else if(l.type==='pass'&&!ballHandled){
      scene.ball.owner=null;scene.ball.x=p.x;scene.ball.y=p.y;
      if(t>=.995&&l.targetKey){scene.ball.owner=l.targetKey;syncSceneBall(scene);}
      ballHandled=true;
    }else if(l.type==='handoff'&&!ballHandled){
      if(t<.68&&src){scene.ball.owner=src.key;syncSceneBall(scene);}
      else if(l.targetKey){scene.ball.owner=l.targetKey;syncSceneBall(scene);}
      ballHandled=true;
    }else if(l.type==='shot'&&!ballHandled){
      scene.ball.owner=null;scene.ball.x=p.x;scene.ball.y=p.y;ballHandled=true;
    }
  }
  if(!ballHandled)syncSceneBall(scene);
  return {scene,actions};
}
function drawAnimationStep(scene,actions,t,c=ctx){
  drawCourt(c);
  actions.forEach(a=>drawActionProgress(c,a,t));
  const owner=scene.ball&&scene.ball.owner;
  (scene.players||[]).forEach(p=>drawAnimationPlayer(c,p,p.key===owner));
  if(scene.ball)drawBall(c,scene.ball);
}
async function playOnePhase(phase,phaseIndex,runningState,target,exportMode){
  // Every phase starts from its own saved snapshot. runningState is intentionally
  // ignored for positioning; it is kept only for backwards-compatible call shape.
  let base={players:copy(phase.players||[]),ball:copy(phase.ball||{x:535,y:755,owner:null})};
  syncSceneBall(base);
  const steps=phaseSteps(phase),total=Math.max(900,(phase.seconds||2.4)*1000);
  if(!steps.length){
    const start=performance.now();
    while(performance.now()-start<total&&(exportMode||playing)){
      const scene=copy(base);
      if(exportMode)target(scene,phaseIndex,[],0);else{ctx.clearRect(0,0,W,H);drawAnimationStep(scene,[],0,ctx);}
      await new Promise(requestAnimationFrame);
    }
    return base;
  }
  const per=Math.max(700,total/steps.length);
  for(const rawStep of steps){
    if(!(exportMode||playing))break;
    const snapshot=copy(base),prepared=rawStep.map(a=>actionForCurrentState(a,base)),start=performance.now();
    while(performance.now()-start<per&&(exportMode||playing)){
      const t=clamp((performance.now()-start)/per,0,1),pack=sceneDuringActions(snapshot,prepared,t);
      if(exportMode)target(pack.scene,phaseIndex,pack.actions,t);
      else{ctx.clearRect(0,0,W,H);drawAnimationStep(pack.scene,pack.actions,t,ctx);}
      await new Promise(requestAnimationFrame);
    }
    // Optional actions are demonstrations only. They return to the pre-option state.
    const completedHandoffs=[];
    for(const a of prepared){
      if(!a.isOption){
        base=applyCompletedAction(base,a);
        if(a.type==='handoff')completedHandoffs.push(a);
      }
    }
    for(const a of completedHandoffs)CourtPlayEngine.ensureHandoffSeparation(base,a,76);
    syncSceneBall(base);
    if(prepared.some(a=>a.type==='shot'&&!a.isOption)){
      base.terminalShot=true;
      break;
    }
  }
  return base;
}
async function animateCanvas(target,exportMode=false){
  if(playing&&!exportMode)return;
  CourtPlayEngine.reflow(data.frames,0);
  const original=current;let phaseEnd=null;
  if(!exportMode){playing=true;playBtn.textContent='■ Detener';setStatus('Reproduciendo animación por fases…');}
  for(let i=0;i<data.frames.length&&(exportMode||playing);i++){
    phaseEnd=await playOnePhase(data.frames[i],i,null,target,exportMode);
    if(phaseEnd&&phaseEnd.terminalShot)break;
  }
  if(!exportMode){playing=false;current=original;playBtn.textContent='▶ Animación';setStatus('Animación terminada.');render();}
}
playBtn.addEventListener('click',()=>{if(playing){playing=false;playBtn.textContent='▶ Animación'}else{commit();animateCanvas(null,false)}});
videoBtn.addEventListener('click',async()=>{
  try{
    commit();CourtPlayEngine.reflow(data.frames,0);
    if(!window.MediaRecorder){showToast('Este navegador no permite crear video aquí.','error',5000);return}
    const out=document.createElement('canvas');out.width=1280;out.height=1160;
    if(!out.captureStream){showToast('Este dispositivo no permite grabar la animación desde Safari/Chrome.','error',5000);return}
    const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm'];
    const mime=types.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
    const stream=out.captureStream(30);let rec;
    try{rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6000000}:{videoBitsPerSecond:6000000})}
    catch(e){showToast('No pude iniciar el exportador de video en este navegador.','error',5000);return}
    const chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    rec.onerror=()=>showToast('Ocurrió un error creando el video.','error',5000);
    rec.onstop=()=>{
      if(!chunks.length){showToast('El navegador no produjo el archivo de video.','error',5000);return}
      const type=rec.mimeType||mime||'video/webm',ext=type.includes('mp4')?'mp4':'webm';
      const blob=new Blob(chunks,{type}),name=safeFileName(data.name)+'.'+ext;
      showReadyFile(blob,name,'Video '+ext.toUpperCase());
    };
    rec.start(250);showToast('Creando video… no cierres CourtPlay.','working',0);
    await animateCanvas((scene,i,activeActions,progress)=>composeAnimation(scene,data.name,i,data.frames.length,out,activeActions,progress),true);
    try{rec.requestData()}catch(e){}
    setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},200);
  }catch(e){showToast('No se pudo crear el video.','error',5000)}
});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();


/* CourtPlay engine animation bindings */
actionForCurrentState=function(raw,scene){
  const action=CourtPlayEngine.clone(raw);
  CourtPlayEngine.normalizeAction(action);
  return action;
};
applyCompletedAction=function(scene,l){
  return CourtPlayEngine.applyAction(scene,l,{mutate:true});
};
