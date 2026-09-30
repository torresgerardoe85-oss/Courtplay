(function(global){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const transferTypes=new Set(['pass','handoff']);
  const movingTypes=new Set(['move','dribble','screen','handoff']);
  const COURT_BOUNDS={minX:30,maxX:970,minY:30,maxY:830};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  function points(action){
    if(!Array.isArray(action.points)||action.points.length<2){
      action.points=[{x:300,y:300},{x:500,y:300}];
    }
    return action.points;
  }
  function captureLocalGeometry(action){
    const pts=points(action),start=pts[0];
    action.localPoints=pts.map(p=>({x:p.x-start.x,y:p.y-start.y}));
    return action;
  }
  function invalidateLocalGeometry(action){
    if(action)delete action.localPoints;
    return action;
  }
  function normalizeAction(action){
    points(action);
    if(!Array.isArray(action.localPoints)||action.localPoints.length!==action.points.length)captureLocalGeometry(action);
    if(typeof action.sourceDetached!=='boolean')action.sourceDetached=false;
    if(typeof action.targetKey==='undefined')action.targetKey=null;
    if(typeof action.sourceKey==='undefined')action.sourceKey=null;
    if(typeof action.manualCurve!=='boolean')action.manualCurve=true;
    if(typeof action.isOption!=='boolean')action.isOption=false;
    if(typeof action.simultaneousGroup==='undefined')action.simultaneousGroup=null;
    if(typeof action.color!=='string'||!action.color)action.color='#172033';
    if(action.type==='handoff'){
      if(!Number.isFinite(action.handoffTransferAt))action.handoffTransferAt=.62;
      action.handoffTransferAt=clamp(action.handoffTransferAt,.48,.78);
      if(!Number.isFinite(action.handoffExitDistance))action.handoffExitDistance=108;
      action.handoffExitDistance=clamp(action.handoffExitDistance,72,180);
      if(!Number.isFinite(action.handoffVersion))action.handoffVersion=2;
    }
    return action;
  }
  function player(state,key){return key&&(state.players||[]).find(p=>p.key===key)||null}
  function nearestPlayer(players,pt,excludeKey=null,maxDistance=125){
    let best=null,bestD=maxDistance;
    for(const p of players||[]){
      if(excludeKey&&p.key===excludeKey)continue;
      const d=Math.hypot(p.x-pt.x,p.y-pt.y);
      if(d<=bestD){best=p;bestD=d;}
    }
    return best;
  }
  function syncBall(state){
    if(!state.ball)state.ball={x:535,y:755,owner:null};
    if(state.ball.owner){
      const owner=player(state,state.ball.owner);
      if(owner){state.ball.x=owner.x+34;state.ball.y=owner.y+4;}
      else state.ball.owner=null;
    }
    return state;
  }
  function recenterStraight(action){
    const pts=points(action);
    if(action.manualCurve||pts.length!==3)return;
    pts[1].x=(pts[0].x+pts[2].x)/2;
    pts[1].y=(pts[0].y+pts[2].y)/2;
  }
  function fitActionToCourt(action){
    const pts=points(action);
    for(const p of pts){
      p.x=clamp(p.x,COURT_BOUNDS.minX,COURT_BOUNDS.maxX);
      p.y=clamp(p.y,COURT_BOUNDS.minY,COURT_BOUNDS.maxY);
    }
    return action;
  }
  function handoffTransferAt(action){
    return clamp(Number(action&&action.handoffTransferAt)||.62,.48,.78);
  }
  function handoffExitVector(tgt,exitSpec=null){
    if(!tgt||!exitSpec)return null;
    let dx,dy;
    if(Number.isFinite(exitSpec.x)&&Number.isFinite(exitSpec.y)){
      dx=exitSpec.x-tgt.x;dy=exitSpec.y-tgt.y;
    }else if(Number.isFinite(exitSpec.dx)&&Number.isFinite(exitSpec.dy)){
      dx=exitSpec.dx;dy=exitSpec.dy;
    }else return null;
    const len=Math.hypot(dx,dy);
    if(len<1)return null;
    return{dx,dy,vx:dx/len,vy:dy/len,len};
  }
  function fallbackHandoffExit(src,tgt,pts){
    if(!tgt)return null;
    const authoredStart=(pts&&pts.length)?pts[0]:null;
    const from=authoredStart||src||null;
    let dx=from?from.x-tgt.x:0,dy=from?from.y-tgt.y:0;
    let len=Math.hypot(dx,dy);
    if(len<1){dx=tgt.x<500?1:-1;dy=-.15;len=Math.hypot(dx,dy);}
    return{dx:dx/len*108,dy:dy/len*108};
  }
  function handoffGiverEnd(src,tgt,pts,receiverExit=null){
    const gap=82;
    const authoredStart=(pts&&pts.length)?pts[0]:null;
    const from=authoredStart||src||null;
    const ev=handoffExitVector(tgt,receiverExit);

    // Keep the giver beside the receiver's lane. The receiver then travels
    // through the exchange instead of being teleported back to its old spot.
    if(ev){
      const n1={x:-ev.vy,y:ev.vx},n2={x:ev.vy,y:-ev.vx};
      const fx=from?from.x-tgt.x:0,fy=from?from.y-tgt.y:0;
      const d1=fx*n1.x+fy*n1.y,d2=fx*n2.x+fy*n2.y;
      const n=d1>=d2?n1:n2;
      return{
        x:clamp(tgt.x+n.x*gap,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
        y:clamp(tgt.y+n.y*gap,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
      };
    }

    let dx=from?from.x-tgt.x:0,dy=from?from.y-tgt.y:0;
    let len=Math.hypot(dx,dy);
    if(len<1){dx=tgt.x<500?-1:1;dy=0;len=1;}
    return{
      x:clamp(tgt.x+(dx/len)*gap,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
      y:clamp(tgt.y+(dy/len)*gap,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
    };
  }

  function handoffReceiverEnd(tgt,receiverExit=null,distance=108){
    if(!tgt||!receiverExit)return null;
    if(Number.isFinite(receiverExit.x)&&Number.isFinite(receiverExit.y)){
      return{
        x:clamp(receiverExit.x,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
        y:clamp(receiverExit.y,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
      };
    }
    const ev=handoffExitVector(tgt,receiverExit);
    if(!ev)return null;
    return{
      x:clamp(tgt.x+ev.vx*distance,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
      y:clamp(tgt.y+ev.vy*distance,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
    };
  }
  function handoffReceiverContact(tgt,giverEnd,receiverExit=null){
    if(!tgt||!giverEnd)return null;
    let dx=tgt.x-giverEnd.x,dy=tgt.y-giverEnd.y,len=Math.hypot(dx,dy);
    if(len<1){
      const ev=handoffExitVector(tgt,receiverExit);
      if(!ev)return{x:tgt.x,y:tgt.y};
      dx=-ev.vx;dy=-ev.vy;len=1;
    }
    const gap=62;
    return{
      x:clamp(giverEnd.x+(dx/len)*gap,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
      y:clamp(giverEnd.y+(dy/len)*gap,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
    };
  }
  function handoffGeometry(state,action){
    if(!state||!action||action.type!=='handoff')return null;
    const src=player(state,action.sourceKey),tgt=player(state,action.targetKey);
    if(!src||!tgt)return null;
    const pts=points(action);
    const autoFallback=fallbackHandoffExit(src,tgt,pts);
    const exitSpec=action.handoffExitPoint||action.handoffReceiverExit||autoFallback;
    const giverEnd=handoffGiverEnd(src,tgt,pts,exitSpec);
    const receiverContact=handoffReceiverContact(tgt,giverEnd,exitSpec);
    const receiverEnd=handoffReceiverEnd(tgt,exitSpec,Number(action.handoffExitDistance)||108);
    return{
      sourceStart:{x:src.x,y:src.y},
      receiverStart:{x:tgt.x,y:tgt.y},
      giverEnd,
      receiverContact,
      receiverEnd,
      transferAt:handoffTransferAt(action),
      exitSpec
    };
  }

  function inferHandoffExit(phase,handoffAction){
    if(!phase||!handoffAction||handoffAction.type!=='handoff'||!handoffAction.targetKey)return null;
    const lines=phase.lines||[],index=lines.indexOf(handoffAction);
    let best=null;
    for(let i=0;i<lines.length;i++){
      const candidate=lines[i];
      if(!candidate||candidate===handoffAction||candidate.sourceKey!==handoffAction.targetKey)continue;
      if(!['dribble','move','shot','handoff'].includes(candidate.type))continue;
      const cpts=points(candidate);
      if(cpts.length<2)continue;
      const receiverStart=player(phase,handoffAction.targetKey);
      const origin=receiverStart||cpts[0];
      let dx=cpts[1].x-origin.x,dy=cpts[1].y-origin.y;
      if(Math.hypot(dx,dy)<8&&cpts.length>2){
        dx=cpts[cpts.length-1].x-origin.x;
        dy=cpts[cpts.length-1].y-origin.y;
      }
      if(Math.hypot(dx,dy)<8)continue;
      let score=Math.abs(i-index)*20;
      if(i>index)score-=50;
      if(candidate.type==='dribble')score-=35;
      if(handoffAction.simultaneousGroup&&candidate.simultaneousGroup===handoffAction.simultaneousGroup)score-=25;
      if(!best||score<best.score)best={score,dx,dy};
    }
    return best?{dx:best.dx,dy:best.dy}:null;
  }

  function applyAutoHandoffGeometry(phase){
    if(!phase||!Array.isArray(phase.lines))return phase;
    for(const action of phase.lines){
      if(!action||action.type!=='handoff')continue;
      normalizeAction(action);
      const tgt=player(phase,action.targetKey),src=player(phase,action.sourceKey);
      if(action.handoffExitPoint&&tgt&&Number.isFinite(action.handoffExitPoint.x)&&Number.isFinite(action.handoffExitPoint.y)){
        action.handoffReceiverExit={
          dx:action.handoffExitPoint.x-tgt.x,
          dy:action.handoffExitPoint.y-tgt.y
        };
        action.handoffGeometryAuto=false;
      }else if(!action.handoffReceiverExit||action.handoffGeometryAuto){
        const inferred=inferHandoffExit(phase,action);
        const exit=inferred||fallbackHandoffExit(src,tgt,points(action));
        if(exit){
          action.handoffReceiverExit={dx:exit.dx,dy:exit.dy};
          action.handoffGeometryAuto=true;
        }
      }
      action.handoffVersion=2;
    }
    return phase;
  }
  function ensureHandoffSeparation(state,action,minGap=76){
    if(!state||!action||action.type!=='handoff')return state;
    const src=player(state,action.sourceKey),tgt=player(state,action.targetKey);
    if(!src||!tgt)return state;
    const d=Math.hypot(src.x-tgt.x,src.y-tgt.y);
    if(d>=minGap)return state;
    const sep=handoffGiverEnd(null,tgt,points(action),action.handoffExitPoint||action.handoffReceiverExit||null);
    src.x=sep.x;src.y=sep.y;
    return state;
  }
  function prepareAction(raw,state,{mutate=false,infer=true}={}){
    const action=mutate?raw:clone(raw);
    normalizeAction(action);
    let pts=points(action);
    let src=player(state,action.sourceKey);

    if(!src&&infer&&!action.sourceDetached){
      src=nearestPlayer(state.players,pts[0],null,145);
      if(src)action.sourceKey=src.key;
    }
    if(src&&!action.sourceDetached){
      // CourtPlay actions are anchored to court locations, not repeated movement vectors.
      // Reflow may correct the start to the player's real inherited position, but it must
      // never translate the destination/control points the user drew.
      pts[0].x=src.x;
      pts[0].y=src.y;
    }

    if(transferTypes.has(action.type)){
      let tgt=player(state,action.targetKey);
      if(!tgt&&infer){
        tgt=nearestPlayer(state.players,pts[pts.length-1],action.sourceKey,115);
        if(tgt)action.targetKey=tgt.key;
      }
      if(tgt){
        const end=pts[pts.length-1];
        if(action.type==='handoff'){
          const giverEnd=handoffGiverEnd(src,tgt,pts,action.handoffExitPoint||action.handoffReceiverExit||null);
          end.x=giverEnd.x;end.y=giverEnd.y;
        }else{
          end.x=tgt.x;end.y=tgt.y;
        }
      }
    }
    if(action.type==='shot'){
      const end=pts[pts.length-1];
      end.x=500;end.y=112;
    }
    recenterStraight(action);
    fitActionToCourt(action);
    captureLocalGeometry(action);
    return action;
  }
  function applyAction(input,raw,{mutate=false}={}){
    const state=mutate?input:clone(input);
    const action=normalizeAction(raw);
    const pts=points(action),end=pts[pts.length-1],src=player(state,action.sourceKey);
    const handoffGeom=action.type==='handoff'?handoffGeometry(state,action):null;

    if(src&&movingTypes.has(action.type)){
      src.x=end.x;src.y=end.y;
    }
    if(action.type==='dribble'&&src){
      state.ball.owner=src.key;
    }else if(transferTypes.has(action.type)){
      const tgt=player(state,action.targetKey);
      if(tgt){
        if(action.type==='handoff'&&src&&handoffGeom){
          src.x=handoffGeom.giverEnd.x;src.y=handoffGeom.giverEnd.y;
          if(handoffGeom.receiverEnd){
            tgt.x=handoffGeom.receiverEnd.x;tgt.y=handoffGeom.receiverEnd.y;
          }
          ensureHandoffSeparation(state,action);
        }
        state.ball.owner=tgt.key;
      }else{
        state.ball.owner=null;
        state.ball.x=end.x;state.ball.y=end.y;
      }
    }else if(action.type==='shot'){
      state.ball.owner=null;
      state.ball.x=end.x;state.ball.y=end.y;
      if(!action.isOption)state.terminalShot=true;
    }
    return syncBall(state);
  }
  function normalizeScreenAngle(deg){
    let a=Number(deg)||0;
    a=((a%180)+180)%180;
    return a;
  }
  function nearestPathDirection(action,point){
    const pts=points(action);
    let best=null;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
      if(len2<1)continue;
      const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/len2,0,1);
      const q={x:a.x+t*dx,y:a.y+t*dy};
      const distance=Math.hypot(point.x-q.x,point.y-q.y);
      if(!best||distance<best.distance)best={distance,dx,dy,index:i,t};
    }
    return best;
  }
  function inferScreenAngle(phase,screenAction){
    if(!phase||!screenAction||screenAction.type!=='screen')return null;
    if(screenAction.screenAngleLocked&&Number.isFinite(screenAction.screenAngle))return normalizeScreenAngle(screenAction.screenAngle);
    const spts=points(screenAction),spot=spts[spts.length-1];
    const lines=phase.lines||[];
    const screenIndex=lines.indexOf(screenAction);
    let best=null;
    for(let i=0;i<lines.length;i++){
      const candidate=lines[i];
      if(!candidate||candidate===screenAction||candidate.sourceKey===screenAction.sourceKey)continue;
      if(!['dribble','move','handoff'].includes(candidate.type))continue;
      const near=nearestPathDirection(candidate,spot);
      if(!near||near.distance>230)continue;

      let score=near.distance;
      if(candidate.type==='dribble')score-=95;
      else if(candidate.type==='handoff')score-=35;
      if(screenAction.simultaneousGroup&&candidate.simultaneousGroup===screenAction.simultaneousGroup)score-=85;
      if(Math.abs(i-screenIndex)<=1)score-=30;
      if(phase.ball&&phase.ball.owner&&candidate.sourceKey===phase.ball.owner)score-=35;

      if(!best||score<best.score)best={score,candidate,near};
    }
    if(!best)return null;
    const movementAngle=Math.atan2(best.near.dy,best.near.dx)*180/Math.PI;
    return normalizeScreenAngle(movementAngle+90);
  }
  function applyAutoScreenAngles(phase){
    if(!phase||!Array.isArray(phase.lines))return phase;
    for(const action of phase.lines){
      if(!action||action.type!=='screen')continue;
      const inferred=inferScreenAngle(phase,action);
      if(Number.isFinite(inferred)){
        action.screenAngle=inferred;
        action.screenAngleAuto=true;
      }else if(action.screenAngleAuto){
        delete action.screenAngle;
        delete action.screenAngleAuto;
      }
    }
    return phase;
  }

  function bindLegacyPhase(phase){
    if(!phase)return phase;
    const state={players:clone(phase.players||[]),ball:clone(phase.ball||{x:535,y:755,owner:null})};
    for(const raw of phase.lines||[]){
      normalizeAction(raw);
      const prepared=prepareAction(raw,state,{mutate:true,infer:true});
      if(!prepared.isOption)applyAction(state,prepared,{mutate:true});
      if(state.terminalShot)break;
    }
    return phase;
  }
  function resolvePhase(phase,{mutateActions=true}={}){
    if(mutateActions){
      applyAutoScreenAngles(phase);
      applyAutoHandoffGeometry(phase);
    }
    const state={players:clone(phase.players||[]),ball:clone(phase.ball||{x:535,y:755,owner:null})};
    syncBall(state);
    const applied=[];
    for(const raw of phase.lines||[]){
      const action=prepareAction(raw,state,{mutate:mutateActions,infer:true});
      if(!action.isOption){applyAction(state,action,{mutate:true});applied.push(action);}
      if(state.terminalShot)break;
    }
    for(const action of applied){
      if(action.type==='handoff')ensureHandoffSeparation(state,action);
    }
    return syncBall(state);
  }
  function inferInitialPossession(phase){
    if(!phase||!phase.ball||phase.ball.owner)return;
    const first=(phase.lines||[]).find(l=>['pass','handoff','dribble','shot'].includes(l.type)&&l.sourceKey);
    if(first){
      const src=(phase.players||[]).find(p=>p.key===first.sourceKey);
      if(src){
        phase.ball.owner=src.key;
        phase.ball.x=src.x+34;phase.ball.y=src.y+4;
      }
    }
  }
  function reflow(frames,fromIndex=0){
    if(!Array.isArray(frames)||!frames.length)return null;
    const start=Math.max(0,Math.min(fromIndex,frames.length-1));
    if(start===0)inferInitialPossession(frames[0]);

    // PHASE SNAPSHOT MODEL (v26):
    // Every phase owns its saved starting players + ball.
    // A previous phase may seed a NEW phase once, but reflow must never overwrite
    // an existing phase's saved start state after the user has edited it.
    let endState=null;
    for(let i=start;i<frames.length;i++){
      const phase=frames[i];
      phase.phaseStartVersion=26;
      endState=resolvePhase(phase,{mutateActions:true});
    }
    return endState;
  }
  function nextPhaseFrom(phase){
    const end=resolvePhase(phase,{mutateActions:true});
    return{
      players:clone(end.players||[]),
      ball:clone(end.ball||{x:535,y:755,owner:null}),
      lines:[],
      caption:'',
      seconds:phase.seconds||2.4,
      inheritsFromPrevious:true,
      phaseStartVersion:26,
      phaseOwnershipVersion:26
    };
  }
  function duplicatePhaseForContinuation(phase){
    const end=resolvePhase(phase,{mutateActions:false});
    const next={
      players:clone(end.players||[]),
      ball:clone(end.ball||{x:535,y:755,owner:null}),
      lines:clone(phase.lines||[]),
      caption:phase.caption||'',
      seconds:phase.seconds||2.4,
      inheritsFromPrevious:true,
      phaseStartVersion:26,
      phaseOwnershipVersion:26
    };
    resolvePhase(next,{mutateActions:true});
    return next;
  }

  global.CourtPlayEngine={
    clone,points,captureLocalGeometry,invalidateLocalGeometry,normalizeAction,nearestPlayer,syncBall,recenterStraight,fitActionToCourt,
    handoffTransferAt,handoffExitVector,fallbackHandoffExit,handoffGiverEnd,handoffReceiverEnd,handoffReceiverContact,handoffGeometry,ensureHandoffSeparation,
    inferScreenAngle,applyAutoScreenAngles,inferHandoffExit,applyAutoHandoffGeometry,prepareAction,applyAction,bindLegacyPhase,resolvePhase,reflow,nextPhaseFrom,duplicatePhaseForContinuation
  };
})(typeof window!=='undefined'?window:globalThis);
