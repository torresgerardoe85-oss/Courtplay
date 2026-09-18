const canvas=document.getElementById('court'),ctx=canvas.getContext('2d');
const phaseList=document.getElementById('phaseList'),captionEl=document.getElementById('caption'),secondsEl=document.getElementById('seconds'),playNameEl=document.getElementById('playName'),statusEl=document.getElementById('status');
const inspector=document.getElementById('inspector'),inspectorEmpty=document.getElementById('inspectorEmpty'),lineTypeEl=document.getElementById('lineType'),selectionSummary=document.getElementById('selectionSummary');
const playBtn=document.getElementById('playBtn'),pngBtn=document.getElementById('pngBtn'),videoBtn=document.getElementById('videoBtn'),saveBtn=document.getElementById('saveBtn');
const prevBtn=document.getElementById('prevBtn'),nextBtn=document.getElementById('nextBtn'),addBtn=document.getElementById('addBtn'),duplicateBtn=document.getElementById('duplicateBtn'),deleteBtn=document.getElementById('deleteBtn');
const selectBtn=document.getElementById('selectBtn'),deleteObjectBtn=document.getElementById('deleteObjectBtn'),giveBallBtn=document.getElementById('giveBallBtn');
const addPointBtn=document.getElementById('addPointBtn'),removePointBtn=document.getElementById('removePointBtn'),reverseLineBtn=document.getElementById('reverseLineBtn'),deleteLineBtn=document.getElementById('deleteLineBtn');
const W=1000,H=860,PLAYER_R=29;
let tool='select',current=0,selectedLine=-1,selectedPlayer=null,drag=null,draft=null,playing=false,pendingToken=null,assignBall=false;

function starterPhase(){return{players:[
  {key:'o1',label:'1',team:'offense',x:500,y:755},{key:'o2',label:'2',team:'offense',x:220,y:620},{key:'o3',label:'3',team:'offense',x:780,y:620},{key:'o4',label:'4',team:'offense',x:325,y:330},{key:'o5',label:'5',team:'offense',x:675,y:330}
],ball:{x:534,y:755,owner:'o1'},lines:[],caption:'',seconds:2.4}}
let data={version:2,name:'Mi primera jugada',frames:[starterPhase()]};
const frame=()=>data.frames[current],copy=v=>JSON.parse(JSON.stringify(v)),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function setStatus(t){statusEl.textContent=t}

function migrate(raw){
  if(!raw||!Array.isArray(raw.frames))return null;
  raw.version=2;
  raw.frames.forEach(f=>{
    f.players=(f.players||[]).map((p,i)=>({key:p.key||`o${p.id||i+1}`,label:String(p.label||p.id||i+1),team:p.team||'offense',x:p.x,y:p.y}));
    f.lines=(f.lines||[]).map(l=>{
      if(Array.isArray(l.points)){if(typeof l.manualCurve!=='boolean')l.manualCurve=true;return l;}
      const cx=Number.isFinite(l.cx)?l.cx:(l.x1+l.x2)/2,cy=Number.isFinite(l.cy)?l.cy:(l.y1+l.y2)/2;
      return{type:l.type==='move'?'move':l.type||'move',sourceKey:l.sourceKey||null,manualCurve:true,points:[{x:l.x1,y:l.y1},{x:cx,y:cy},{x:l.x2,y:l.y2}]};
    });
    if(!f.ball)f.ball={x:535,y:755,owner:null};
  });
  return raw;
}
try{
  const saved=localStorage.getItem('courtplay_v2')||localStorage.getItem('courtplay_v1');
  if(saved){const parsed=migrate(JSON.parse(saved));if(parsed)data=parsed;}
}catch(e){}
playNameEl.value=data.name||'Mi primera jugada';

function drawCourt(c=ctx,width=W,height=H){
  const sx=width/W,sy=height/H;c.save();c.scale(sx,sy);
  c.fillStyle='#dfb36d';c.fillRect(0,0,W,H);
  for(let i=0;i<22;i++){c.fillStyle=i%2?'rgba(255,255,255,.04)':'rgba(92,55,20,.025)';c.fillRect(i*(W/22),0,W/22,H);}
  const left=36,right=W-36,top=30,bottom=H-30,cx=500,hoopY=112,laneL=365,laneR=635,ftY=270,threeR=388,cornerL=128,cornerR=872;
  c.strokeStyle='rgba(255,255,255,.98)';c.lineWidth=5;c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  c.strokeRect(left,top,right-left,bottom-top);
  c.beginPath();c.moveTo(425,72);c.lineTo(575,72);c.stroke();
  c.beginPath();c.arc(cx,hoopY,15,0,Math.PI*2);c.stroke();
  c.strokeRect(laneL,top,laneR-laneL,ftY-top);
  c.beginPath();c.arc(cx,ftY,88,0,Math.PI);c.stroke();
  c.save();c.setLineDash([13,12]);c.beginPath();c.arc(cx,ftY,88,Math.PI,Math.PI*2);c.stroke();c.restore();
  c.beginPath();c.arc(cx,hoopY,62,0,Math.PI);c.stroke();
  const dx=cornerR-cx,dy=Math.sqrt(Math.max(0,threeR*threeR-dx*dx)),joinY=hoopY+dy;
  const aR=Math.atan2(joinY-hoopY,cornerR-cx),aL=Math.atan2(joinY-hoopY,cornerL-cx);
  c.beginPath();c.moveTo(cornerL,top);c.lineTo(cornerL,joinY);c.moveTo(cornerR,top);c.lineTo(cornerR,joinY);c.stroke();
  c.beginPath();c.arc(cx,hoopY,threeR,aR,aL);c.stroke();
  [148,190,232].forEach(y=>{c.beginPath();c.moveTo(laneL-17,y);c.lineTo(laneL,y);c.moveTo(laneR,y);c.lineTo(laneR+17,y);c.stroke();});
  c.restore();
}
function pathPoints(l){if(!Array.isArray(l.points)||l.points.length<2)l.points=[{x:300,y:300},{x:500,y:300}];return l.points}
function catmullPoint(points,t){
  const n=points.length;if(n===2)return{x:points[0].x+(points[1].x-points[0].x)*t,y:points[0].y+(points[1].y-points[0].y)*t};
  const scaled=t*(n-1),i=Math.min(n-2,Math.floor(scaled)),u=scaled-i;
  const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(n-1,i+2)];
  const u2=u*u,u3=u2*u;
  return{x:.5*((2*p1.x)+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u2+(-p0.x+3*p1.x-3*p2.x+p3.x)*u3),y:.5*((2*p1.y)+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u2+(-p0.y+3*p1.y-3*p2.y+p3.y)*u3)};
}
function tangent(points,t){const a=catmullPoint(points,clamp(t-.01,0,1)),b=catmullPoint(points,clamp(t+.01,0,1));return{x:b.x-a.x,y:b.y-a.y}}
function strokeSmooth(c,pts){c.beginPath();const steps=Math.max(28,(pts.length-1)*22);for(let i=0;i<=steps;i++){const p=catmullPoint(pts,i/steps);if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y)}c.stroke()}
function arrow(c,pts,size=18){const b=catmullPoint(pts,1),a=catmullPoint(pts,.965),ang=Math.atan2(b.y-a.y,b.x-a.x);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-size*Math.cos(ang-.45),b.y-size*Math.sin(ang-.45));c.moveTo(b.x,b.y);c.lineTo(b.x-size*Math.cos(ang+.45),b.y-size*Math.sin(ang+.45));c.stroke()}
function drawDribble(c,pts){const steps=Math.max(42,(pts.length-1)*30),amp=8,waves=Math.max(7,pts.length*4);c.beginPath();for(let i=0;i<=steps;i++){const t=i/steps,p=catmullPoint(pts,t),tan=tangent(pts,t),len=Math.hypot(tan.x,tan.y)||1,nx=-tan.y/len,ny=tan.x/len,off=Math.sin(t*Math.PI*2*waves)*amp,x=p.x+nx*off,y=p.y+ny*off;if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.stroke();arrow(c,pts,17)}
