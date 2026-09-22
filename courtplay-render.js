function drawAction(c,l,alpha=1){const pts=pathPoints(l);c.save();c.globalAlpha=alpha;const actionColor=l.color||(l.type==='shot'?'#df6813':'#172033');c.strokeStyle=actionColor;c.fillStyle=actionColor;c.lineWidth=6;c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  if(l.type==='pass')c.setLineDash([16,11]);
  if(l.type==='dribble'){drawDribble(c,pts);c.restore();return;}
  if(l.type==='handoff'){
    drawDribble(c,pts);
    const hp=catmullPoint(pts,.68);
    c.save();
    c.fillStyle='rgba(255,255,255,.96)';c.strokeStyle=actionColor;c.lineWidth=4;
    c.beginPath();c.arc(hp.x,hp.y,22,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle=actionColor;c.textAlign='center';c.textBaseline='middle';c.font='900 30px system-ui';
    c.fillText('H',hp.x,hp.y+1);
    c.restore();
    c.restore();return;
  }
  strokeSmooth(c,pts);
  const end=catmullPoint(pts,1),tan=tangent(pts,1),ang=Math.atan2(tan.y,tan.x),perp=Number.isFinite(l.screenAngle)?(l.screenAngle*Math.PI/180):(ang+Math.PI/2);
  if(l.type==='screen'){
    const cap=23;c.beginPath();c.moveTo(end.x-cap*Math.cos(perp),end.y-cap*Math.sin(perp));c.lineTo(end.x+cap*Math.cos(perp),end.y+cap*Math.sin(perp));c.stroke();
  }else if(l.type==='shot'){
    c.beginPath();c.arc(end.x,end.y,13,0,Math.PI*2);c.stroke();
  }else arrow(c,pts,18);
  c.restore();
}
function drawHandles(c,l){const pts=pathPoints(l);c.save();c.strokeStyle='rgba(8,45,114,.45)';c.lineWidth=2;c.setLineDash([6,7]);c.beginPath();pts.forEach((p,i)=>{if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y)});c.stroke();c.setLineDash([]);pts.forEach((p,i)=>{c.beginPath();const isStart=i===0,isEnd=i===pts.length-1;c.fillStyle=isStart?'#0b56bd':(isEnd?'#22c55e':'#f47a20');c.strokeStyle='#fff';c.lineWidth=4;c.arc(p.x,p.y,isEnd?15:(isStart?10:12),0,Math.PI*2);c.fill();c.stroke();});c.restore()}
function drawPlayer(c,p,scale=1){const r=PLAYER_R*scale;if(selectedPlayer===p.key&&scale===1){c.beginPath();c.strokeStyle='#0b56bd';c.lineWidth=7;c.arc(p.x,p.y,r+9,0,Math.PI*2);c.stroke();}c.beginPath();c.fillStyle=p.team==='defense'?'#d92c2c':'#fff';c.strokeStyle=p.team==='defense'?'#fff':'#0c1827';c.lineWidth=4*scale;c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=p.team==='defense'?'#fff':'#0c1827';c.font=`900 ${24*scale}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.team==='defense'?'x'+p.label:p.label,p.x,p.y+1)}
function drawBall(c,b){c.beginPath();c.fillStyle='#f47a20';c.strokeStyle='#7c2d12';c.lineWidth=2.5;c.arc(b.x,b.y,14,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.moveTo(b.x-13,b.y);c.lineTo(b.x+13,b.y);c.stroke();c.beginPath();c.arc(b.x,b.y,8,-Math.PI/2,Math.PI/2);c.stroke()}
function drawScene(f=frame(),c=ctx,opts={}){drawCourt(c);(f.lines||[]).forEach((l,i)=>drawAction(c,l));if(!opts.hideHandles&&tool==='select'&&selectedLine>=0&&f.lines[selectedLine])drawHandles(c,f.lines[selectedLine]);(f.players||[]).forEach(p=>drawPlayer(c,p));drawBall(c,f.ball);if(draft)drawAction(c,{type:tool,points:draft.points},.65)}
function render(){data.name=playNameEl.value.trim()||'Jugada sin nombre';ctx.clearRect(0,0,W,H);drawScene();captionEl.value=frame().caption||'';secondsEl.value=frame().seconds||2.4;renderPhases();updateInspector();updateNav();}
function renderPhases(){phaseList.innerHTML='';data.frames.forEach((f,i)=>{const card=document.createElement('button');card.className='phaseCard'+(i===current?' active':'');card.type='button';const mini=document.createElement('canvas');mini.width=220;mini.height=190;mini.className='phaseCanvas';const meta=document.createElement('div');meta.className='phaseMeta';meta.innerHTML=`<strong>Fase ${i+1}</strong><small>${(f.caption||'Sin explicación').slice(0,22)}</small>`;card.append(mini,meta);card.addEventListener('click',()=>{commit();CourtPlayEngine.reflow(data.frames,0);current=i;selectedLine=-1;selectedPlayer=null;render()});phaseList.appendChild(card);drawMini(mini,f);});}
function drawMini(mini,f){const c=mini.getContext('2d'),sx=mini.width/W,sy=mini.height/H;c.clearRect(0,0,mini.width,mini.height);drawCourt(c,mini.width,mini.height);c.save();c.scale(sx,sy);(f.lines||[]).forEach(l=>drawAction(c,l));(f.players||[]).forEach(p=>drawPlayer(c,p,.7));drawBall(c,f.ball);c.restore();}
function updateNav(){prevBtn.disabled=current===0;nextBtn.disabled=current===data.frames.length-1;deleteBtn.disabled=data.frames.length===1;}
function updateInspector(){const has=selectedLine>=0&&frame().lines[selectedLine];inspector.classList.toggle('hidden',!has);inspectorEmpty.style.display=has?'none':'block';if(has){const l=frame().lines[selectedLine],src=l.sourceKey&&frame().players.find(p=>p.key===l.sourceKey),tgt=l.targetKey&&frame().players.find(p=>p.key===l.targetKey);lineTypeEl.value=l.type||'move';if(selectionSummary)selectionSummary.textContent=`${actionName(l.type)}${src?' · '+(src.team==='defense'?'x':'')+src.label:''}${tgt?' → '+(tgt.team==='defense'?'x':'')+tgt.label:''}`;}else if(selectedPlayer){const p=frame().players.find(x=>x.key===selectedPlayer);inspectorEmpty.textContent=p?`Jugador ${p.team==='defense'?'x':''}${p.label} seleccionado. Elige Pase, Corte, Drible, Screen, Handoff o Tiro.`:'Selecciona un jugador.';}else inspectorEmpty.textContent='Selecciona un jugador o una acción anterior. Puedes encadenar una nueva acción desde donde termina la anterior.';}
function actionName(type){return({move:'Corte',pass:'Pase',dribble:'Drible',screen:'Screen',handoff:'Handoff',shot:'Tiro'})[type]||'Movimiento';}
function commit(){if(!data.frames[current])return;frame().caption=captionEl.value;frame().seconds=clamp(parseFloat(secondsEl.value)||2.4,.5,8);data.name=playNameEl.value.trim()||'Jugada sin nombre';}
captionEl.addEventListener('input',()=>{frame().caption=captionEl.value;renderPhases()});secondsEl.addEventListener('input',()=>frame().seconds=clamp(parseFloat(secondsEl.value)||2.4,.5,8));playNameEl.addEventListener('input',()=>data.name=playNameEl.value);

function setTool(next){tool=next;pendingToken=null;assignBall=false;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===next));document.getElementById('selectBtn').classList.toggle('active',next==='select');render();}
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{const type=b.dataset.tool;if(selectedLine>=0&&frame().lines[selectedLine]){createActionFromSelectedAction(type);return;}if(!selectedPlayer){setStatus('Selecciona un jugador o una acción anterior.');setTool('select');return;}createActionFromSelectedPlayer(type);}));selectBtn.addEventListener('click',()=>setTool('select'));

function buildTokenGrids(){const off=document.getElementById('offenseGrid'),def=document.getElementById('defenseGrid');off.innerHTML='';def.innerHTML='';['1','2','3','4','5','6','C'].forEach(label=>{const b=document.createElement('button');b.type='button';b.className='tokenBtn';b.textContent=label;b.addEventListener('click',()=>chooseToken('offense',label,b));off.appendChild(b)});['1','2','3','4','5','6'].forEach(label=>{const b=document.createElement('button');b.type='button';b.className='tokenBtn def';b.textContent='x'+label;b.addEventListener('click',()=>chooseToken('defense',label,b));def.appendChild(b)});}
function chooseToken(team,label,button){document.querySelectorAll('.tokenBtn').forEach(x=>x.classList.remove('active'));button.classList.add('active');pendingToken={team,label};assignBall=false;tool='token';selectedLine=-1;selectedPlayer=null;setStatus(`Toca la cancha para colocar ${team==='defense'?'x':''}${label}.`);render();}
buildTokenGrids();
giveBallBtn.addEventListener('click',()=>{tool='ballAssign';assignBall=true;pendingToken=null;selectedLine=-1;selectedPlayer=null;document.querySelectorAll('.tokenBtn').forEach(x=>x.classList.remove('active'));setStatus('Toca un jugador para darle el balón.');render();});



function drawAnimationPlayer(c,p,hasBall=false){
  c.save();
  c.textAlign='center';c.textBaseline='middle';
  c.font='800 34px system-ui';
  c.fillStyle='#172033';c.strokeStyle='#172033';
  const label=p.team==='defense'?'x'+p.label:String(p.label);
  if(hasBall){
    c.lineWidth=4;c.beginPath();c.arc(p.x,p.y,34,0,Math.PI*2);c.stroke();
  }
  c.fillText(label,p.x,p.y+1);
  c.restore();
}
function partialPathPoints(pts,t){
  const count=Math.max(2,Math.ceil(32*clamp(t,0,1)));
  const out=[];
  for(let i=0;i<=count;i++)out.push(catmullPoint(pts,(i/count)*clamp(t,0,1)));
  return out;
}
function drawActionProgress(c,l,t){
  const pts=pathPoints(l),tt=clamp(t,0,1);
  if(tt<=0)return;
  c.save();const actionColor=l.color||(l.type==='shot'?'#df6813':'#172033');c.strokeStyle=actionColor;c.fillStyle=actionColor;c.lineWidth=6;c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  if(l.type==='screen'){
    if(tt>.58){
      const end=catmullPoint(pts,1),tan=tangent(pts,1),a=Number.isFinite(l.screenAngle)?(l.screenAngle*Math.PI/180):(Math.atan2(tan.y,tan.x)+Math.PI/2),cap=27;
      c.beginPath();c.moveTo(end.x-cap*Math.cos(a),end.y-cap*Math.sin(a));c.lineTo(end.x+cap*Math.cos(a),end.y+cap*Math.sin(a));c.stroke();
    }
    c.restore();return;
  }
  if(l.type==='dribble'||l.type==='handoff'){
    const steps=Math.max(10,Math.ceil(45*tt)),amp=8,waves=Math.max(7,pts.length*4);
    c.beginPath();
    for(let i=0;i<=steps;i++){
      const u=(i/steps)*tt,p=catmullPoint(pts,u),tan=tangent(pts,u),len=Math.hypot(tan.x,tan.y)||1,nx=-tan.y/len,ny=tan.x/len,off=Math.sin(u*Math.PI*2*waves)*amp;
      const x=p.x+nx*off,y=p.y+ny*off;
      if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.stroke();
    if(tt>.08){const a=catmullPoint(pts,Math.max(0,tt-.05)),b=catmullPoint(pts,tt);arrow(c,[a,b],17);}
    if(l.type==='handoff'&&tt>.35){
      const hp=catmullPoint(pts,.72);
      c.save();
      c.fillStyle='rgba(255,255,255,.96)';c.strokeStyle=actionColor;c.lineWidth=4;
      c.beginPath();c.arc(hp.x,hp.y,24,0,Math.PI*2);c.fill();c.stroke();
      c.fillStyle=actionColor;c.textAlign='center';c.textBaseline='middle';c.font='900 32px system-ui';c.fillText('H',hp.x,hp.y+1);
      c.restore();
    }
    c.restore();return;
  }
  if(l.type==='pass')c.setLineDash([16,11]);
  const pp=partialPathPoints(pts,tt);
  c.beginPath();pp.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
  if(l.type!=='shot'&&tt>.12)arrow(c,pp,18);
  if(l.type==='shot'&&tt>.92){const end=catmullPoint(pts,1);c.beginPath();c.arc(end.x,end.y,13,0,Math.PI*2);c.stroke();}
  c.restore();
}
function drawAnimationScene(scene,c=ctx,activeAction=null,progress=0){
  drawCourt(c);
  if(activeAction)drawActionProgress(c,activeAction,progress);
  const owner=scene.ball&&scene.ball.owner;
  (scene.players||[]).forEach(p=>drawAnimationPlayer(c,p,p.key===owner));
  if(scene.ball)drawBall(c,scene.ball);
}
