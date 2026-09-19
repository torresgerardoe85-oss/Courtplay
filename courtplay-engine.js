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
  function handoffGiverEnd(src,tgt,pts){
    const gap=82;
    const authoredStart=(pts&&pts.length)?pts[0]:null;
    const from=authoredStart||src||null;
    let dx=from?from.x-tgt.x:0,dy=from?from.y-tgt.y:0;
    let len=Math.hypot(dx,dy);
    if(len<1){
      dx=tgt.x<W/2?-1:1;dy=0;len=1;
    }
    return{
      x:clamp(tgt.x+(dx/len)*gap,COURT_BOUNDS.minX,COURT_BOUNDS.maxX),
      y:clamp(tgt.y+(dy/len)*gap,COURT_BOUNDS.minY,COURT_BOUNDS.maxY)
    };
  }
  function ensureHandoffSeparation(state,action,minGap=76){
    if(!state||!action||action.type!=='handoff')return state;
    const src=player(state,action.sourceKey),tgt=player(state,action.targetKey);
    if(!src||!tgt)return state;
    const d=Math.hypot(src.x-tgt.x,src.y-tgt.y);
    if(d>=minGap)return state;
    const sep=handoffGiverEnd(null,tgt,points(action));
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
          const giverEnd=handoffGiverEnd(src,tgt,pts);
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

    if(src&&movingTypes.has(action.type)){
      src.x=end.x;src.y=end.y;
    }
    if(action.type==='dribble'&&src){
      state.ball.owner=src.key;
    }else if(transferTypes.has(action.type)){
      const tgt=player(state,action.targetKey);
      if(tgt){
        if(action.type==='handoff'&&src){
          const sep=handoffGiverEnd(null,tgt,pts);
          src.x=sep.x;src.y=sep.y;
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
    const state={players:clone(phase.players||[]),ball:clone(phase.ball||{x:535,y:755,owner:null})};
    syncBall(state);
    for(const raw of phase.lines||[]){
      const action=prepareAction(raw,state,{mutate:mutateActions,infer:true});
      if(!action.isOption)applyAction(state,action,{mutate:true});
      if(state.terminalShot)break;
    }
    return state;
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
    clone,points,captureLocalGeometry,invalidateLocalGeometry,normalizeAction,nearestPlayer,syncBall,recenterStraight,fitActionToCourt,handoffGiverEnd,ensureHandoffSeparation,
    prepareAction,applyAction,bindLegacyPhase,resolvePhase,reflow,nextPhaseFrom,duplicatePhaseForContinuation
  };
})(typeof window!=='undefined'?window:globalThis);
