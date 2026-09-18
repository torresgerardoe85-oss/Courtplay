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
function syncActionSources(key=null){(frame().lines||[]).forEach(l=>{if(!l.sourceKey||(key&&l.sourceKey!==key))return;const src=frame().players.find(p=>p.key===l.sourceKey);if(src&&pathPoints(l)[0]){l.points[0].x=src.x;l.points[0].y=src.y;recenterCurve(l);}})}
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
  return{type,sourceKey,targetKey:null,manualCurve:false,points:[{x:start.x,y:start.y},mid,end]};
}
function createActionFromSelectedPlayer(type){
  const pl=frame().players.find(p=>p.key===selectedPlayer);
  if(!pl){setStatus('Primero selecciona un jugador.');return;}
  const action=makeAction(type,{x:pl.x,y:pl.y},pl.key);
  frame().lines.push(action);selectedLine=frame().lines.length-1;tool='select';
  document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));
  setStatus(`${actionName(type)} creado desde jugador ${pl.label}. Verde = final. Naranja = curva. Azul = inicio.`);
  render();
}
function createActionFromSelectedAction(type){
  const prev=frame().lines[selectedLine];
  if(!prev)return;
  const pts=pathPoints(prev),last=pts[pts.length-1],source=prev.targetKey||prev.sourceKey||selectedPlayer||null;
  const action=makeAction(type,{x:last.x,y:last.y},source);
  frame().lines.push(action);selectedLine=frame().lines.length-1;selectedPlayer=source;tool='select';
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
  if(target){l.targetKey=target.key;return target;}
  l.targetKey=null;return null;
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
    if(isStart){l.sourceKey=null;selectedPlayer=null;recenterCurve(l);}
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
  draft=null;drag=null;render();
}
canvas.addEventListener('pointerup',finishPointer);
canvas.addEventListener('pointercancel',()=>finishPointer(null));

lineTypeEl.addEventListener('change',()=>{if(selectedLine>=0){
  const l=frame().lines[selectedLine];l.type=lineTypeEl.value;
  if(!['pass','handoff'].includes(l.type))l.targetKey=null;
  else applyBallTransfer(l);
  render();
}});
addPointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const pts=pathPoints(frame().lines[selectedLine]);let best=0,bestLen=-1;for(let i=0;i<pts.length-1;i++){const d=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);if(d>bestLen){best=i;bestLen=d}}pts.splice(best+1,0,{x:(pts[best].x+pts[best+1].x)/2,y:(pts[best].y+pts[best+1].y)/2});frame().lines[selectedLine].manualCurve=true;render();});
removePointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const pts=pathPoints(frame().lines[selectedLine]);if(pts.length<=2){setStatus('Una trayectoria necesita al menos inicio y final.');return}pts.splice(Math.max(1,pts.length-2),1);render();});
reverseLineBtn.addEventListener('click',()=>{if(selectedLine>=0){const l=frame().lines[selectedLine];l.points.reverse();l.sourceKey=null;l.targetKey=null;selectedPlayer=null;setStatus('Trayectoria invertida. Ya no está anclada a un jugador.');render();}});
deleteLineBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1;render();}});
deleteObjectBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1}else if(selectedPlayer){const key=selectedPlayer,i=frame().players.findIndex(x=>x.key===key);if(i>=0){if(frame().ball.owner===key)frame().ball.owner=null;frame().players.splice(i,1);frame().lines=frame().lines.filter(l=>l.sourceKey!==key);}selectedPlayer=null}render();});

addBtn.addEventListener('click',()=>{commit();const f=copy(frame());f.caption='';data.frames.splice(current+1,0,f);current++;selectedLine=-1;selectedPlayer=null;render();});
duplicateBtn.addEventListener('click',()=>{commit();const f=copy(frame());data.frames.splice(current+1,0,f);current++;selectedLine=-1;render();});
prevBtn.addEventListener('click',()=>{commit();if(current>0)current--;selectedLine=-1;render();});nextBtn.addEventListener('click',()=>{commit();if(current<data.frames.length-1)current++;selectedLine=-1;render();});
deleteBtn.addEventListener('click',()=>{if(data.frames.length<=1)return;data.frames.splice(current,1);current=Math.min(current,data.frames.length-1);selectedLine=-1;render();});

