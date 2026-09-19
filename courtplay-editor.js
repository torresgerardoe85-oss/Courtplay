function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}}
function hitPlayer(p){for(let i=frame().players.length-1;i>=0;i--){const pl=frame().players[i];if(Math.hypot(pl.x-p.x,pl.y-p.y)<=PLAYER_R+10)return pl}return null}
function hitReceiver(p,sourceKey=null){
  let best=null,bestD=Infinity;
  for(let i=frame().players.length-1;i>=0;i--){
    const pl=frame().players[i];
    if(sourceKey&&pl.key===sourceKey)continue;
    const d=Math.hypot(pl.x-p.x,pl.y-p.y);
    if(d<64&&d<bestD){best=pl;bestD=d;}
  }
  return best;
}
function distSeg(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=px-a.x,wy=py-a.y,d=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/d,0,1),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(px-x,py-y)}
function hitLine(p){for(let i=frame().lines.length-1;i>=0;i--){const pts=pathPoints(frame().lines[i]);let prev=catmullPoint(pts,0);for(let s=1;s<=50;s++){const cur=catmullPoint(pts,s/50);if(distSeg(p.x,p.y,prev,cur)<18)return i;prev=cur}}return-1}
function hitHandle(p,l){const pts=pathPoints(l);for(let i=0;i<pts.length;i++){if(Math.hypot(p.x-pts[i].x,p.y-pts[i].y)<=26)return i;}return-1}
function hitBall(p){return Math.hypot(frame().ball.x-p.x,frame().ball.y-p.y)<=25}
function syncBallOwner(){if(!frame().ball.owner)return;const owner=frame().players.find(p=>p.key===frame().ball.owner);if(owner){frame().ball.x=owner.x+34;frame().ball.y=owner.y+4}else frame().ball.owner=null}
function recenterCurve(l){
  if(!l||l.manualCurve||!Array.isArray(l.points)||l.points.length<3)return;
  const a=l.points[0],b=l.points[l.points.length-1],m=l.points[1];
  m.x=(a.x+b.x)/2;m.y=(a.y+b.y)/2;
}
function syncActionSources(key=null){(frame().lines||[]).forEach(l=>{if(!l.sourceKey||(key&&l.sourceKey!==key))return;const src=frame().players.find(p=>p.key===l.sourceKey),pts=pathPoints(l);if(src&&pts[0]){pts[0].x=src.x;pts[0].y=src.y;CourtPlayEngine.invalidateLocalGeometry(l);recenterCurve(l);CourtPlayEngine.captureLocalGeometry(l);}})}
function defaultActionEnd(start,type){
  const dirX=start.x<W/2?1:-1;
  let end={x:clamp(start.x+dirX*115,45,W-45),y:clamp(start.y-105,45,H-45)};
  if(type==='screen')end={x:clamp(start.x+dirX*80,45,W-45),y:clamp(start.y-80,45,H-45)};
  if(type==='handoff')end={x:clamp(start.x+dirX*95,45,W-45),y:start.y};
  if(type==='shot')end={x:500,y:112};
  return end;
}
function makeAction(type,start,sourceKey=null){
  const end=defaultActionEnd(start,type),mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
  return{type,sourceKey,targetKey:null,sourceDetached:false,manualCurve:false,isOption:false,simultaneousGroup:null,color:'#172033',points:[{x:start.x,y:start.y},mid,end]};
}
function createActionFromSelectedPlayer(type){
  const pl=frame().players.find(p=>p.key===selectedPlayer);
  if(!pl){setStatus('Primero selecciona un jugador.');return;}
  const action=makeAction(type,{x:pl.x,y:pl.y},pl.key);
  frame().lines.push(action);selectedLine=frame().lines.length-1;tool='select';reflowPhasesAfter(current);
  document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));
  setStatus(`${actionName(type)} creado desde jugador ${pl.label}. Verde = final. Naranja = curva. Azul = inicio.`);
  render();
}
function createActionFromSelectedAction(type){
  const prev=frame().lines[selectedLine];
  if(!prev)return;
  const pts=pathPoints(prev),last=pts[pts.length-1],source=prev.targetKey||prev.sourceKey||selectedPlayer||null;
  const action=makeAction(type,{x:last.x,y:last.y},source);
  frame().lines.push(action);selectedLine=frame().lines.length-1;selectedPlayer=source;tool='select';reflowPhasesAfter(current);
  document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));
  setStatus(`${actionName(type)} comienza donde terminó la acción anterior.`);
  render();
}
function applyBallTransfer(l){
  if(!l||!['pass','handoff'].includes(l.type))return;
  const pts=pathPoints(l),end=pts[pts.length-1];
  const target=l.targetKey&&frame().players.find(p=>p.key===l.targetKey);
  if(target){
    frame().ball.owner=target.key;
    frame().ball.x=target.x+34;frame().ball.y=target.y+4;
    selectedPlayer=target.key;
    setStatus(`${actionName(l.type)} completado: ${target.team==='defense'?'x':''}${target.label} recibe el balón.`);
  }else{
    frame().ball.owner=null;
    frame().ball.x=end.x;frame().ball.y=end.y;
    setStatus(`${actionName(l.type)} termina en ese punto; mueve la punta sobre un jugador para asignar receptor.`);
  }
}
function updateTransferTarget(l,p){
  if(!l||!['pass','handoff'].includes(l.type))return null;
  const target=hitReceiver(p,l.sourceKey);
  if(target){l.targetKey=target.key;CourtPlayEngine.invalidateLocalGeometry(l);return target;}
  l.targetKey=null;CourtPlayEngine.invalidateLocalGeometry(l);return null;
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);const p=point(e);
  if(tool==='token'&&pendingToken){const key=(pendingToken.team==='defense'?'d':'o')+pendingToken.label.toLowerCase();let pl=frame().players.find(x=>x.key===key);if(pl){pl.x=p.x;pl.y=p.y}else{pl={key,label:pendingToken.label,team:pendingToken.team,x:p.x,y:p.y};frame().players.push(pl);}pendingToken=null;selectedPlayer=key;document.querySelectorAll('.tokenBtn').forEach(x=>x.classList.remove('active'));setTool('select');return;}
  if(tool==='ballAssign'){const pl=hitPlayer(p);if(pl){frame().ball.owner=pl.key;selectedPlayer=pl.key;syncBallOwner();setStatus(`Balón asignado a ${pl.team==='defense'?'x':''}${pl.label}.`);setTool('select')}return;}
  if(tool==='select'){
    if(selectedLine>=0&&frame().lines[selectedLine]){const hi=hitHandle(p,frame().lines[selectedLine]);if(hi>=0){drag={type:'handle',line:selectedLine,point:hi};return;}}
    const pl=hitPlayer(p);if(pl){selectedLine=-1;selectedPlayer=pl.key;drag={type:'player',key:pl.key,dx:p.x-pl.x,dy:p.y-pl.y};render();return;}
    if(hitBall(p)){selectedLine=-1;selectedPlayer=null;drag={type:'ball',dx:p.x-frame().ball.x,dy:p.y-frame().ball.y};frame().ball.owner=null;return;}
    const li=hitLine(p);selectedLine=li;selectedPlayer=li>=0?(frame().lines[li].sourceKey||null):null;render();return;
  }
});
canvas.addEventListener('pointermove',e=>{if(!drag&&!draft)return;e.preventDefault();const p=point(e);
  if(draft){draft.points[draft.points.length-1]={x:clamp(p.x,20,W-20),y:clamp(p.y,20,H-20)};}
  else if(drag?.type==='handle'){
    const l=frame().lines[drag.line],pt=l.points[drag.point];
    let x=clamp(p.x,20,W-20),y=clamp(p.y,20,H-20);
    const isStart=drag.point===0,isEnd=drag.point===l.points.length-1,isCurve=drag.point>0&&!isEnd;
    if(isEnd){
      let target=null;
      if(['pass','handoff'].includes(l.type)) target=updateTransferTarget(l,p);
      else target=hitReceiver(p,l.sourceKey)||hitPlayer(p);
      if(target&&target.key!==l.sourceKey){x=target.x;y=target.y;drag.targetKey=target.key;}
      else drag.targetKey=null;
    }
    pt.x=x;pt.y=y;
    CourtPlayEngine.invalidateLocalGeometry(l);
    if(isStart){l.sourceKey=null;l.sourceDetached=true;selectedPlayer=null;recenterCurve(l);}
    else if(isCurve){l.manualCurve=true;}
    else if(isEnd){recenterCurve(l);}
  }
  else if(drag?.type==='player'){const pl=frame().players.find(x=>x.key===drag.key);if(pl){pl.x=clamp(p.x-drag.dx,30,W-30);pl.y=clamp(p.y-drag.dy,30,H-30);syncBallOwner();syncActionSources(pl.key);}}
  else if(drag?.type==='ball'){frame().ball.x=clamp(p.x-drag.dx,16,W-16);frame().ball.y=clamp(p.y-drag.dy,16,H-16);}
  ctx.clearRect(0,0,W,H);drawScene();
});
function finishPointer(e){
  if(drag?.type==='handle'){
    const l=frame().lines[drag.line];
    if(l&&drag.point===l.points.length-1&&['pass','handoff'].includes(l.type)){
      if(e){
        const release=point(e),target=updateTransferTarget(l,release);
        if(target){
          const end=l.points[l.points.length-1];
          end.x=target.x;end.y=target.y;drag.targetKey=target.key;
          recenterCurve(l);
        }
      }
      if(drag.targetKey)l.targetKey=drag.targetKey;
      applyBallTransfer(l);
    }
  }
  draft=null;drag=null;reflowPhasesAfter(current);render();
}
canvas.addEventListener('pointerup',finishPointer);
canvas.addEventListener('pointercancel',()=>finishPointer(null));

lineTypeEl.addEventListener('change',()=>{if(selectedLine>=0){
  const l=frame().lines[selectedLine];l.type=lineTypeEl.value;
  if(!['pass','handoff'].includes(l.type))l.targetKey=null;
  else applyBallTransfer(l);
  reflowPhasesAfter(current);render();
}});
addPointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const l=frame().lines[selectedLine],pts=pathPoints(l);let best=0,bestLen=-1;for(let i=0;i<pts.length-1;i++){const d=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);if(d>bestLen){best=i;bestLen=d}}pts.splice(best+1,0,{x:(pts[best].x+pts[best+1].x)/2,y:(pts[best].y+pts[best+1].y)/2});l.manualCurve=true;CourtPlayEngine.invalidateLocalGeometry(l);reflowPhasesAfter(current);render();});
removePointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const l=frame().lines[selectedLine],pts=pathPoints(l);if(pts.length<=2){setStatus('Una trayectoria necesita al menos inicio y final.');return}pts.splice(Math.max(1,pts.length-2),1);CourtPlayEngine.invalidateLocalGeometry(l);reflowPhasesAfter(current);render();});
reverseLineBtn.addEventListener('click',()=>{if(selectedLine>=0){const l=frame().lines[selectedLine];l.points.reverse();l.sourceKey=null;l.targetKey=null;l.sourceDetached=true;CourtPlayEngine.invalidateLocalGeometry(l);selectedPlayer=null;setStatus('Trayectoria invertida. Ya no está anclada a un jugador.');reflowPhasesAfter(current);render();}});
deleteLineBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1;reflowPhasesAfter(current);render();}});
deleteObjectBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1}else if(selectedPlayer){const key=selectedPlayer,i=frame().players.findIndex(x=>x.key===key);if(i>=0){if(frame().ball.owner===key)frame().ball.owner=null;frame().players.splice(i,1);frame().lines=frame().lines.filter(l=>l.sourceKey!==key);}selectedPlayer=null}reflowPhasesAfter(current);render();});

function resolvePhaseEndState(phase){
  const out=copy(phase);
  out.players=copy(phase.players||[]);
  out.ball=copy(phase.ball||{x:535,y:755,owner:null});
  const byKey=key=>out.players.find(p=>p.key===key)||null;
  (phase.lines||[]).forEach(raw=>{
    const l=copy(raw),pts=pathPoints(l),end=pts[pts.length-1],src=byKey(l.sourceKey);
    if(src&&['move','dribble','screen','handoff'].includes(l.type)){
      src.x=end.x;src.y=end.y;
    }
    if(l.type==='dribble'&&src){
      out.ball.owner=src.key;out.ball.x=src.x+34;out.ball.y=src.y+4;
    }else if(['pass','handoff'].includes(l.type)){
      const tgt=byKey(l.targetKey);
      if(tgt){out.ball.owner=tgt.key;out.ball.x=tgt.x+34;out.ball.y=tgt.y+4;}
      else{out.ball.owner=null;out.ball.x=end.x;out.ball.y=end.y;}
    }
  });
  if(out.ball.owner){
    const owner=byKey(out.ball.owner);
    if(owner){out.ball.x=owner.x+34;out.ball.y=owner.y+4;}
  }
  return out;
}
function applyActionToResolvedState(state,l){
  const pts=pathPoints(l),end=pts[pts.length-1];
  const src=(state.players||[]).find(p=>p.key===l.sourceKey)||null;
  if(src&&['move','dribble','screen','handoff'].includes(l.type)){src.x=end.x;src.y=end.y;}
  if(l.type==='dribble'&&src){
    state.ball.owner=src.key;state.ball.x=src.x+34;state.ball.y=src.y+4;
  }else if(['pass','handoff'].includes(l.type)){
    const tgt=(state.players||[]).find(p=>p.key===l.targetKey)||null;
    if(tgt){state.ball.owner=tgt.key;state.ball.x=tgt.x+34;state.ball.y=tgt.y+4;}
    else{state.ball.owner=null;state.ball.x=end.x;state.ball.y=end.y;}
  }
  if(state.ball.owner){
    const owner=(state.players||[]).find(p=>p.key===state.ball.owner)||null;
    if(owner){state.ball.x=owner.x+34;state.ball.y=owner.y+4;}
  }
  return state;
}
function alignPhaseActionsToStart(phase){
  let running={players:copy(phase.players||[]),ball:copy(phase.ball||{x:535,y:755,owner:null})};
  (phase.lines||[]).forEach(l=>{
    const pts=pathPoints(l);
    const src=l.sourceKey&&(running.players||[]).find(p=>p.key===l.sourceKey);
    if(src&&pts.length){
      const dx=src.x-pts[0].x,dy=src.y-pts[0].y;
      if(Math.abs(dx)>.01||Math.abs(dy)>.01){
        l.points=pts.map(p=>({x:p.x+dx,y:p.y+dy}));
      }
    }
    if(['pass','handoff'].includes(l.type)&&l.targetKey){
      const tgt=(running.players||[]).find(p=>p.key===l.targetKey);
      if(tgt&&l.points.length){
        const end=l.points[l.points.length-1];
        end.x=tgt.x;end.y=tgt.y;
      }
    }
    if(!l.manualCurve&&l.points.length>=3){
      const a=l.points[0],b=l.points[l.points.length-1];
      l.points[1].x=(a.x+b.x)/2;l.points[1].y=(a.y+b.y)/2;
    }
    running=applyActionToResolvedState(running,l);
  });
  return running;
}
function lineSignature(l){
  const pts=(l.points||[]).map(p=>[Math.round(p.x),Math.round(p.y)]);
  return JSON.stringify([l.type||'',l.sourceKey||'',l.targetKey||'',pts]);
}
function cleanLegacyCopiedLines(index){
  if(index<=0||index>=data.frames.length)return;
  const phase=data.frames[index],prev=data.frames[index-1];
  if(phase.phaseOwnershipVersion>=14)return;
  const prevSet=new Set((prev.lines||[]).map(lineSignature));
  if(prevSet.size&&(phase.lines||[]).length){
    phase.lines=(phase.lines||[]).filter(l=>!prevSet.has(lineSignature(l)));
  }
  phase.phaseOwnershipVersion=14;
}
function reflowPhasesAfter(index){
  if(data.frames.length<2)return;
  const start=Math.max(0,index);
  let running=resolvePhaseEndState(data.frames[start]);
  for(let i=start+1;i<data.frames.length;i++){
    const phase=data.frames[i];
    cleanLegacyCopiedLines(i);
    phase.players=copy(running.players||[]);
    phase.ball=copy(running.ball||{x:535,y:755,owner:null});
    phase.inheritsFromPrevious=true;
    phase.phaseOwnershipVersion=14;
    // Only this phase's own actions remain here. Previous phase patterns never carry over.
    running=alignPhaseActionsToStart(phase);
  }
}
function refreshPhaseStart(index){
  if(index<=0||index>=data.frames.length)return;
  reflowPhasesAfter(0);
}

function makeNextPhaseFromCurrent(){
  const end=resolvePhaseEndState(frame());
  return{
    players:copy(end.players),
    ball:copy(end.ball),
    lines:[],
    caption:'',
    seconds:frame().seconds||2.4,
    inheritsFromPrevious:true,
    phaseOwnershipVersion:14
  };
}
addBtn.addEventListener('click',()=>{commit();const f=makeNextPhaseFromCurrent();f.lines=[];data.frames.splice(current+1,0,f);current++;selectedLine=-1;selectedPlayer=null;setStatus('Nueva fase creada desde el resultado final de la fase anterior.');reflowPhasesAfter(current);render();});
duplicateBtn.addEventListener('click',()=>{commit();const f=CourtPlayEngine.duplicatePhaseForContinuation(frame());data.frames.splice(current+1,0,f);current++;selectedLine=-1;selectedPlayer=null;CourtPlayEngine.reflow(data.frames,current);setStatus('Fase duplicada desde el estado final real de la anterior.');render();});
prevBtn.addEventListener('click',()=>{commit();reflowPhasesAfter(0);if(current>0)current--;selectedLine=-1;selectedPlayer=null;render();});nextBtn.addEventListener('click',()=>{commit();reflowPhasesAfter(0);if(current<data.frames.length-1)current++;selectedLine=-1;selectedPlayer=null;render();});
deleteBtn.addEventListener('click',()=>{if(data.frames.length<=1)return;data.frames.splice(current,1);current=Math.min(current,data.frames.length-1);selectedLine=-1;reflowPhasesAfter(Math.max(0,current-1));render();});
document.getElementById('clearPhaseBtn')?.addEventListener('click',()=>{
  if(!confirm('¿Limpiar esta fase? Se borrarán sus movimientos y explicación.'))return;
  frame().lines=[];
  frame().caption='';
  selectedLine=-1;selectedPlayer=null;tool='select';
  reflowPhasesAfter(current);
  setStatus('Fase limpia. Las demás fases se conservaron y fueron recalculadas.');
  render();
});
document.getElementById('newPlayBtn')?.addEventListener('click',()=>{
  if(!confirm('¿Crear una jugada nueva? Los cambios no guardados de la jugada actual se perderán.'))return;
  data={version:2,name:'Nueva jugada',frames:[starterPhase()]};
  current=0;selectedLine=-1;selectedPlayer=null;drag=null;draft=null;pendingToken=null;assignBall=false;tool='select';
  playNameEl.value='Nueva jugada';
  try{localStorage.removeItem('courtplay_v2');}catch(err){}
  document.querySelectorAll('.tool,.tokenBtn').forEach(x=>x.classList.remove('active'));
  document.getElementById('selectBtn')?.classList.add('active');
  setStatus('Nueva jugada lista. Tu Biblioteca no fue modificada.');
  render();
});


if(data.frames.length>1){reflowPhasesAfter(0); /* state-only chain repair; phase patterns stay local */}


/* CourtPlay canonical sequence engine bindings */
resolvePhaseEndState=function(phase){
  return CourtPlayEngine.resolvePhase(phase,{mutateActions:true});
};
applyActionToResolvedState=function(state,l){
  return CourtPlayEngine.applyAction(state,l,{mutate:true});
};
alignPhaseActionsToStart=function(phase){
  return CourtPlayEngine.resolvePhase(phase,{mutateActions:true});
};
reflowPhasesAfter=function(index){
  return CourtPlayEngine.reflow(data.frames,index);
};
makeNextPhaseFromCurrent=function(){
  return CourtPlayEngine.nextPhaseFrom(frame());
};
applyBallTransfer=function(l){
  if(!l||!['pass','handoff'].includes(l.type))return;
  const target=l.targetKey&&frame().players.find(p=>p.key===l.targetKey);
  if(target){
    selectedPlayer=target.key;
    setStatus(`${actionName(l.type)}: receptor ${target.team==='defense'?'x':''}${target.label}. La posesión cambiará al ejecutar la acción.`);
  }else{
    setStatus(`${actionName(l.type)} sin receptor. Lleva la punta verde cerca del jugador que recibe.`);
  }
};
CourtPlayEngine.reflow(data.frames,0);
