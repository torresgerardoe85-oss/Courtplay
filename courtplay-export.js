function save(){commit();localStorage.setItem('courtplay_v2',JSON.stringify(data));setStatus('Guardado en este dispositivo.');}saveBtn.addEventListener('click',save);
function wrapText(c,text,x,y,maxW,lineH,maxLines=3){const words=(text||'').split(/\s+/);let line='',lines=[];for(const w of words){const test=line?line+' '+w:w;if(c.measureText(test).width>maxW&&line){lines.push(line);line=w}else line=test}if(line)lines.push(line);lines.slice(0,maxLines).forEach((ln,i)=>c.fillText(ln,x,y+i*lineH));}
function compose(f,title,idx,total,out){const c=out.getContext('2d');c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);c.fillStyle='#fff';c.font='800 38px system-ui';c.textAlign='left';c.fillText(title,52,58);c.fillStyle='#b9cae1';c.font='600 22px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-52,58);c.save();c.translate(70,100);c.scale(1.14,1.14);drawScene(f,c,{hideHandles:true});c.restore();c.fillStyle='#fff';c.globalAlpha=.07;c.fillRect(55,865,out.width-110,180);c.globalAlpha=1;c.fillStyle='#f47a20';c.font='800 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,80,905);c.fillStyle='#fff';c.font='500 27px system-ui';wrapText(c,f.caption||'Sin explicación',80,950,out.width-160,36,3);}
function composeAnimation(scene,title,idx,total,out,activeAction,progress){
  const c=out.getContext('2d');c.fillStyle='#061c45';c.fillRect(0,0,out.width,out.height);
  c.fillStyle='#fff';c.font='800 38px system-ui';c.textAlign='left';c.fillText(title,52,58);
  c.fillStyle='#b9cae1';c.font='600 22px system-ui';c.textAlign='right';c.fillText(`Fase ${idx+1} / ${total}`,out.width-52,58);
  c.save();c.translate(70,100);c.scale(1.14,1.14);drawAnimationStep(scene,Array.isArray(activeAction)?activeAction:(activeAction?[activeAction]:[]),progress,c);c.restore();
  c.fillStyle='#fff';c.globalAlpha=.07;c.fillRect(55,865,out.width-110,180);c.globalAlpha=1;
  c.fillStyle='#f47a20';c.font='800 22px system-ui';c.textAlign='left';c.fillText(`FASE ${idx+1}`,80,905);
  c.fillStyle='#fff';c.font='500 27px system-ui';wrapText(c,(data.frames[idx]&&data.frames[idx].caption)||'Sin explicación',80,950,out.width-160,36,3);
}
pngBtn.addEventListener('click',()=>{commit();const out=document.createElement('canvas');out.width=1280;out.height=1080;compose(frame(),data.name,current,data.frames.length,out);const a=document.createElement('a');a.download=(data.name||'jugada').replace(/[^\w-]+/g,'_')+`_fase_${current+1}.png`;a.href=out.toDataURL('image/png');a.click();setStatus('PNG creado.');});
function playerByKey(scene,key){return(scene.players||[]).find(p=>p.key===key)||null}
function syncSceneBall(scene){return CourtPlayEngine.syncBall(scene)}
function actionForCurrentState(raw,scene){return CourtPlayEngine.prepareAction(raw,scene,{mutate:false,infer:true})}
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
    if(src&&['move','dribble','screen','handoff'].includes(l.type)){src.x=p.x;src.y=p.y;}
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
  let base=runningState?copy(runningState):{players:copy(phase.players||[]),ball:copy(phase.ball||{x:535,y:755,owner:null})};
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
    for(const a of prepared){
      if(!a.isOption)base=applyCompletedAction(base,a);
    }
    syncSceneBall(base);
  }
  return base;
}
async function animateCanvas(target,exportMode=false){
  if(playing&&!exportMode)return;
  CourtPlayEngine.reflow(data.frames,0);
  const original=current;let runningState=null;
  if(!exportMode){playing=true;playBtn.textContent='■ Detener';setStatus('Reproduciendo animación…');}
  for(let i=0;i<data.frames.length&&(exportMode||playing);i++)runningState=await playOnePhase(data.frames[i],i,runningState,target,exportMode);
  if(!exportMode){playing=false;current=original;playBtn.textContent='▶ Animación';setStatus('Animación terminada.');render();}
}
playBtn.addEventListener('click',()=>{if(playing){playing=false;playBtn.textContent='▶ Animación'}else{commit();animateCanvas(null,false)}});
videoBtn.addEventListener('click',async()=>{commit();if(!window.MediaRecorder){setStatus('Este navegador no permite exportar video.');return}const out=document.createElement('canvas');out.width=1280;out.height=1080;if(!out.captureStream){setStatus('Safari no permite grabar el canvas en este dispositivo.');return}const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm'],mime=types.find(x=>MediaRecorder.isTypeSupported?.(x))||'';let rec;try{rec=new MediaRecorder(out.captureStream(30),mime?{mimeType:mime,videoBitsPerSecond:6000000}:undefined)}catch(e){setStatus('No pude iniciar el exportador de video.');return}const chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};rec.onstop=()=>{const type=rec.mimeType||mime||'video/webm',ext=type.includes('mp4')?'mp4':'webm',blob=new Blob(chunks,{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(data.name||'jugada').replace(/[^\w-]+/g,'_')+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);setStatus(`Video ${ext.toUpperCase()} creado.`)};rec.start(250);setStatus('Creando video…');await animateCanvas((scene,i,activeActions,progress)=>composeAnimation(scene,data.name,i,data.frames.length,out,activeActions,progress),true);rec.stop();});

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();


/* CourtPlay engine animation bindings */
actionForCurrentState=function(raw,scene){
  return CourtPlayEngine.prepareAction(raw,scene,{mutate:false,infer:true});
};
applyCompletedAction=function(scene,l){
  return CourtPlayEngine.applyAction(scene,l,{mutate:true});
};
