function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)}}
function hitPlayer(p){for(let i=frame().players.length-1;i>=0;i--){const pl=frame().players[i];if(Math.hypot(pl.x-p.x,pl.y-p.y)<=PLAYER_R+10)return pl}return null}
function distSeg(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=px-a.x,wy=py-a.y,d=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/d,0,1),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(px-x,py-y)}
function hitLine(p){for(let i=frame().lines.length-1;i>=0;i--){const pts=pathPoints(frame().lines[i]);let prev=catmullPoint(pts,0);for(let s=1;s<=50;s++){const cur=catmullPoint(pts,s/50);if(distSeg(p.x,p.y,prev,cur)<18)return i;prev=cur}}return-1}
function hitHandle(p,l){const pts=pathPoints(l);for(let i=0;i<pts.length;i++)if(Math.hypot(p.x-pts[i].x,p.y-pts[i].y)<=22)return i;return-1}
function hitBall(p){return Math.hypot(frame().ball.x-p.x,frame().ball.y-p.y)<=25}
function syncBallOwner(){if(!frame().ball.owner)return;const owner=frame().players.find(p=>p.key===frame().ball.owner);if(owner){frame().ball.x=owner.x+34;frame().ball.y=owner.y+4}else frame().ball.owner=null}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);const p=point(e);
  if(tool==='token'&&pendingToken){const key=(pendingToken.team==='defense'?'d':'o')+pendingToken.label.toLowerCase();let pl=frame().players.find(x=>x.key===key);if(pl){pl.x=p.x;pl.y=p.y}else frame().players.push({key,label:pendingToken.label,team:pendingToken.team,x:p.x,y:p.y});pendingToken=null;document.querySelectorAll('.tokenBtn').forEach(x=>x.classList.remove('active'));setTool('select');return;}
  if(tool==='ballAssign'){const pl=hitPlayer(p);if(pl){frame().ball.owner=pl.key;syncBallOwner();setStatus(`Balón asignado a ${pl.team==='defense'?'x':''}${pl.label}.`);setTool('select')}return;}
  if(tool==='select'){
    if(selectedLine>=0&&frame().lines[selectedLine]){const hi=hitHandle(p,frame().lines[selectedLine]);if(hi>=0){drag={type:'handle',line:selectedLine,point:hi};return;}}
    const pl=hitPlayer(p);if(pl){selectedLine=-1;selectedPlayer=pl.key;drag={type:'player',key:pl.key,dx:p.x-pl.x,dy:p.y-pl.y};render();return;}
    if(hitBall(p)){selectedLine=-1;selectedPlayer=null;drag={type:'ball',dx:p.x-frame().ball.x,dy:p.y-frame().ball.y};frame().ball.owner=null;return;}
    const li=hitLine(p);selectedLine=li;selectedPlayer=null;render();return;
  }
  if(['move','dribble','pass','screen','handoff','shot'].includes(tool)){draft={points:[{x:p.x,y:p.y},{x:p.x,y:p.y}]};}
});
canvas.addEventListener('pointermove',e=>{if(!drag&&!draft)return;e.preventDefault();const p=point(e);
  if(draft){draft.points[draft.points.length-1]={x:clamp(p.x,20,W-20),y:clamp(p.y,20,H-20)};}
  else if(drag?.type==='handle'){const pt=frame().lines[drag.line].points[drag.point];pt.x=clamp(p.x,20,W-20);pt.y=clamp(p.y,20,H-20);}
  else if(drag?.type==='player'){const pl=frame().players.find(x=>x.key===drag.key);if(pl){pl.x=clamp(p.x-drag.dx,30,W-30);pl.y=clamp(p.y-drag.dy,30,H-30);syncBallOwner();}}
  else if(drag?.type==='ball'){frame().ball.x=clamp(p.x-drag.dx,16,W-16);frame().ball.y=clamp(p.y-drag.dy,16,H-16);}
  ctx.clearRect(0,0,W,H);drawScene();
});
function finishPointer(){if(draft){const a=draft.points[0],b=draft.points[draft.points.length-1];if(Math.hypot(a.x-b.x,a.y-b.y)>22){frame().lines.push({type:tool,points:[a,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},b]});selectedLine=frame().lines.length-1;tool='select';document.querySelectorAll('.tool').forEach(b=>b.classList.remove('active'));}draft=null;}drag=null;render();}
canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);

lineTypeEl.addEventListener('change',()=>{if(selectedLine>=0){frame().lines[selectedLine].type=lineTypeEl.value;render();}});
addPointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const pts=pathPoints(frame().lines[selectedLine]);let best=0,bestLen=-1;for(let i=0;i<pts.length-1;i++){const d=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);if(d>bestLen){best=i;bestLen=d}}pts.splice(best+1,0,{x:(pts[best].x+pts[best+1].x)/2,y:(pts[best].y+pts[best+1].y)/2});render();});
removePointBtn.addEventListener('click',()=>{if(selectedLine<0)return;const pts=pathPoints(frame().lines[selectedLine]);if(pts.length<=2){setStatus('Una trayectoria necesita al menos inicio y final.');return}pts.splice(Math.max(1,pts.length-2),1);render();});
reverseLineBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines[selectedLine].points.reverse();render();}});
deleteLineBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1;render();}});
deleteObjectBtn.addEventListener('click',()=>{if(selectedLine>=0){frame().lines.splice(selectedLine,1);selectedLine=-1}else if(selectedPlayer){const i=frame().players.findIndex(x=>x.key===selectedPlayer);if(i>=0){if(frame().ball.owner===selectedPlayer)frame().ball.owner=null;frame().players.splice(i,1)}selectedPlayer=null}render();});

addBtn.addEventListener('click',()=>{commit();const f=copy(frame());f.caption='';data.frames.splice(current+1,0,f);current++;selectedLine=-1;selectedPlayer=null;render();});
duplicateBtn.addEventListener('click',()=>{commit();const f=copy(frame());data.frames.splice(current+1,0,f);current++;selectedLine=-1;render();});
prevBtn.addEventListener('click',()=>{commit();if(current>0)current--;selectedLine=-1;render();});nextBtn.addEventListener('click',()=>{commit();if(current<data.frames.length-1)current++;selectedLine=-1;render();});
deleteBtn.addEventListener('click',()=>{if(data.frames.length<=1)return;data.frames.splice(current,1);current=Math.min(current,data.frames.length-1);selectedLine=-1;render();});

