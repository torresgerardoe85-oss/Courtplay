function save(){commit();localStorage.setItem('courtplay_v2',JSON.stringify(data));setStatus('Guardado en este dispositivo.');}saveBtn.addEventListener('click',save);
function wrapText(c,text,x,y,maxW,lineH,maxLines=3){const words=(text||'').split(/\s+/);let line='',lines=[];for(const w of words){const test=line?line+' '+w:w;if(c.measureText(test).width>maxW&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);lines.slice(0,maxLines).forEach((ln,i)=>c.fillText(ln,x,y+i*lineH));}
function compose(f,title,idx,total,out){const c=out.getContext('2d');c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);c.fillStyle='#fff';c.font='800 38px system-ui';c.textAlign='left';c.fillText(title,52,58);c.fillStyle='#b9cae1';c.font='600 22px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-52,58);c.save();c.translate(70,100);c.scale(1.14,1.14);drawScene(f,c,{hideHandles:true});c.restore();c.fillStyle='#fff';c.globalAlpha=.07;c.fillRect(55,865,out.width-110,180);c.globalAlpha=1;c.fillStyle='#f47a20';c.font='800 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,80,905);c.fillStyle='#fff';c.font='500 27px system-ui';wrapText(c,f.caption||'Sin explicación',80,950,out.width-160,36,3);}
function composeAnimation(scene,title,idx,total,out,activeAction,progress){
  const c=out.getContext('2d');c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);
  c.fillStyle='#fff';c.font='800 38px system-ui';c.textAlign='left';c.fillText(title,52,58);
  c.fillStyle='#b9cae1';c.font='600 22px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-52,58);
  c.save();c.translate(70,100);c.scale(1.14,1.14);drawAnimationScene(scene,c,activeAction,progress);c.restore();
  c.fillStyle='#fff';c.globalAlpha=.07;c.fillRect(55,865,out.width-110,180);c.globalAlpha=1;
  c.fillStyle='#f47a20';c.font='800 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,80,905);
  c.fillStyle='#fff';c.font='500 27px system-ui';wrapText(c,(data.frames[idx]&&data.frames[idx].caption)||'Sin explicación',80,950,out.width-160,36,3);
}
pngBtn.addEventListener('click',()=>{commit();const out=document.createElement('canvas');out.width=1280;out.height=1080;compose(frame(),data.name,current,data.frames.length,out);const a=document.createElement('a');a.download=(data.name||'jugada').replace(/[^\w-]+/g,'_')+`_fase_${current+1}.png`;a.href=out.toDataURL('image/png');a.click();setStatus('PNG creado.');});
function playerByKey(scene,key){return(scene.players||[]).find(p=>p.key===key)||null}
function syncSceneBall(scene){
  if(!scene.ball)return scene;
  if(scene.ball.owner){
    const owner=playerByKey(scene,scene.ball.owner);
    if(owner){scene.ball.x=owner.x+34;scene.ball.y=owner.y+4;}
  }
  return scene;
}
function actionForCurrentState(raw,scene){
  const l=copy(raw),pts=pathPoints(l),src=playerByKey(scene,l.sourceKey);
  if(src&&pts.length){
    const dx=src.x-pts[0].x,dy=src.y-pts[0].y;
    l.points=pts.map(p=>({x:p.x+dx,y:p.y+dy}));
  }
  if(['pass','handoff'].includes(l.type)&&l.targetKey){
    const tgt=playerByKey(scene,l.targetKey);
    if(tgt&&l.points.length){
      const end=l.points[l.points.length-1];end.x=tgt.x;end.y=tgt.y;
      if(!l.manualCurve&&l.points.length>=3){
        l.points[1].x=(l.points[0].x+end.x)/2;l.points[1].y=(l.points[0].y+end.y)/2;
      }
    }
  }
  return l;
}
function applyCompletedAction(scene,l){
  if(!l)return scene;
  const pts=pathPoints(l),end=catmullPoint(pts,1),src=playerByKey(scene,l.sourceKey);
  if(src&&['move','dribble','screen','handoff'].includes(l.type)){src.x=end.x;src.y=end.y;}
  if(l.type==='dribble'&&src){scene.ball.owner=src.key;}
  if(['pass','handoff'].includes(l.type)){
    const tgt=playerByKey(scene,l.targetKey);
    if(tgt)scene.ball.owner=tgt.key;
    else{scene.ball.owner=null;scene.ball.x=end.x;scene.ball.y=end.y;}
  }
  return syncSceneBall(scene);
}
function sceneDuringAction(base,l,t){
  const scene=copy(base),pts=pathPoints(l),src=playerByKey(scene,l.sourceKey),p=catmullPoint(pts,clamp(t,0,1));
  if(src&&['move','dribble','screen','handoff'].includes(l.type)){src.x=p.x;src.y=p.y;}
  if(l.type==='dribble'&&src){
    scene.ball.owner=src.key;syncSceneBall(scene);
  }else if(l.type==='pass'){
    scene.ball.owner=null;scene.ball.x=p.x;scene.ball.y=p.y;
    if(t>=.995&&l.targetKey){scene.ball.owner=l.targetKey;syncSceneBall(scene);}
  }else if(l.type==='handoff'){
    if(t<.68&&src){scene.ball.owner=src.key;syncSceneBall(scene);}
    else if(l.targetKey){scene.ball.owner=l.targetKey;syncSceneBall(scene);}
  }else syncSceneBall(scene);
  return scene;
}
function mergePhaseStart(phase,runningState){
  const base=copy(phase);
  if(runningState){
    base.players=copy(runningState.players||[]);
    base.ball=copy(runningState.ball||base.ball);
  }
  return syncSceneBall(base);
}
async function playOnePhase(phase,phaseIndex,runningState,target,exportMode){
  const actions=(phase.lines||[]),total=Math.max(900,(phase.seconds||2.4)*1000);
  let base=mergePhaseStart(phase,runningState);
  if(!actions.length){
    const start=performance.now();
    while(performance.now()-start<total&&(exportMode||playing)){
      const scene=copy(base);
      if(exportMode)target(scene,phaseIndex,null,0);
      else{ctx.clearRect(0,0,W,H);drawAnimationScene(scene,ctx,null,0);}
      await new Promise(requestAnimationFrame);
    }
    return base;
  }
  const per=Math.max(700,total/actions.length);
  for(let ai=0;ai<actions.length&&(exportMode||playing);ai++){
    const action=actionForCurrentState(actions[ai],base),start=performance.now();
    while(performance.now()-start<per&&(exportMode||playing)){
      const t=clamp((performance.now()-start)/per,0,1),scene=sceneDuringAction(base,action,t);
      if(exportMode)target(scene,phaseIndex,action,t);
      else{ctx.clearRect(0,0,W,H);drawAnimationScene(scene,ctx,action,t);}
      await new Promise(requestAnimationFrame);
    }
    base=applyCompletedAction(base,action);
  }
  return base;
}
async function animateCanvas(target,exportMode=false){
  if(playing&&!exportMode)return;
  const original=current;
  let runningState=null;
  if(!exportMode){playing=true;playBtn.textContent='■ Detener';setStatus('Reproduciendo animación…');}
  for(let i=0;i<data.frames.length&&(exportMode||playing);i++){
    runningState=await playOnePhase(data.frames[i],i,runningState,target,exportMode);
  }
  if(!exportMode){playing=false;current=original;playBtn.textContent='▶ Animación';setStatus('Animación terminada.');render();}
}
playBtn.addEventListener('click',()=>{if(playing){playing=false;playBtn.textContent='▶ Animación'}else{commit();animateCanvas(null,false)}});
videoBtn.addEventListener('click',async()=>{commit();if(!window.MediaRecorder){setStatus('Este navegador no permite exportar video.');return}const out=document.createElement('canvas');out.width=1280;out.height=1080;if(!out.captureStream){setStatus('Safari no permite grabar el canvas en este dispositivo.');return}const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm'],mime=types.find(x=>MediaRecorder.isTypeSupported?.(x))||'';let rec;try{rec=new MediaRecorder(out.captureStream(30),mime?{mimeType:mime,videoBitsPerSecond:6000000}:undefined)}catch(e){setStatus('No pude iniciar el exportador de video.');return}const chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};rec.onstop=()=>{const type=rec.mimeType||mime||'video/webm',ext=type.includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(data.name||'jugada').replace(/[^\w-]+/g,'_')+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setStatus(`Video ${ext.toUpperCase()} creado.`)};rec.start(250);setStatus('Creando video…');await animateCanvas((scene,i,activeAction,progress)=>composeAnimation(scene,data.name,i,data.frames.length,out,activeAction,progress),true);rec.stop();});

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
