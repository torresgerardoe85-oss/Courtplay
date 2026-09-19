(function(){
  'use strict';
  const palette=['#172033','#2563eb','#38bdf8','#16a34a','#166534','#facc15','#f97316','#ef4444','#ec4899','#7c3aed','#6b7280'];
  const selected=new Set();
  let lastPhase=-1;

  function actionTitle(l){
    const src=l.sourceKey&&frame().players.find(p=>p.key===l.sourceKey);
    const tgt=l.targetKey&&frame().players.find(p=>p.key===l.targetKey);
    const s=src?(src.team==='defense'?'x':'')+src.label:'?';
    const t=tgt?' → '+(tgt.team==='defense'?'x':'')+tgt.label:'';
    return `${actionName(l.type)} · ${s}${t}`;
  }
  function syncControls(){
    const l=selectedLine>=0&&frame().lines[selectedLine];
    document.querySelectorAll('#actionColorPalette .actionColor').forEach(btn=>{
      btn.classList.toggle('active',!!l&&l.color===btn.dataset.color);
    });
  }
  function toggleOptionAt(index){
    const l=(frame().lines||[])[index];
    if(!l)return;
    l.isOption=!l.isOption;
    selectedLine=index;selectedPlayer=l.sourceKey||null;
    reflowPhasesAfter(current);render();
    setStatus(l.isOption?'Opción activada. Se mostrará y luego volverá al estado anterior.':'Opción desactivada.');
  }
  function toggleSameTimeAt(index){
    const lines=frame().lines||[],l=lines[index];
    if(!l)return;
    if(l.simultaneousGroup){
      const gid=l.simultaneousGroup;
      lines.forEach(a=>{if(a.simultaneousGroup===gid)a.simultaneousGroup=null;});
      selected.clear();selectedLine=index;selectedPlayer=l.sourceKey||null;
      reflowPhasesAfter(current);render();setStatus('Grupo “Misma vez” separado.');
      return;
    }
    let ids=[...selected].filter(i=>lines[i]);
    if(!ids.includes(index))ids.push(index);
    ids=[...new Set(ids)].sort((a,b)=>a-b);
    if(ids.length<2){
      setStatus('Marca con ☑ otra acción y toca el reloj para ejecutarlas a la misma vez.');
      return;
    }
    const gid='g_'+Date.now().toString(36);
    ids.forEach(i=>lines[i].simultaneousGroup=gid);
    selected.clear();selectedLine=index;selectedPlayer=l.sourceKey||null;
    reflowPhasesAfter(current);render();setStatus('Acciones agrupadas para ejecutarse a la misma vez.');
  }

  function renderTimeline(){
    if(lastPhase!==current){selected.clear();lastPhase=current;}
    const list=document.getElementById('actionTimelineList');
    if(!list)return;
    list.innerHTML='';
    if(!(frame().lines||[]).length)selected.clear();
    (frame().lines||[]).forEach((l,i)=>{
      CourtPlayEngine.normalizeAction(l);
      const row=document.createElement('div');
      row.className='actionRow'+(selectedLine===i?' active':'')+(l.isOption?' option':'');
      const check=document.createElement('input');
      check.type='checkbox';check.className='actionCheck';check.checked=selected.has(i);
      check.addEventListener('click',e=>e.stopPropagation());
      check.addEventListener('change',()=>{check.checked?selected.add(i):selected.delete(i);});
      const order=document.createElement('span');order.className='actionOrder';order.textContent=String(i+1);
      const dot=document.createElement('span');dot.className='actionDot';dot.style.background=l.color||'#172033';
      const label=document.createElement('button');label.type='button';label.className='actionLabel';
      label.innerHTML=`<strong>${actionTitle(l)}</strong><small>${l.isOption?'Opción':''}${l.simultaneousGroup?(l.isOption?' · ':'')+'Misma vez':''}</small>`;
      label.addEventListener('click',()=>{selectedLine=i;selectedPlayer=l.sourceKey||null;render();});
      const reorder=document.createElement('div');reorder.className='actionReorder';
      const stateTools=document.createElement('div');stateTools.className='actionStateTools';
      const same=document.createElement('button');same.type='button';same.className='actionStateBtn sameTimeIcon'+(l.simultaneousGroup?' active':'');same.title=l.simultaneousGroup?'Separar de “Misma vez”':'Misma vez';same.setAttribute('aria-label',same.title);same.textContent='◷';
      const option=document.createElement('button');option.type='button';option.className='actionStateBtn optionIcon'+(l.isOption?' active':'');option.title=l.isOption?'Quitar opción':'Marcar como opción';option.setAttribute('aria-label',option.title);
      option.innerHTML='<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10h8c5 0 5-6 10-6h5M10 10c5 0 5 6 10 6h5"/><path d="M22 1l4 3-4 3M22 13l4 3-4 3"/></svg>';
      same.addEventListener('click',e=>{e.stopPropagation();toggleSameTimeAt(i);});
      option.addEventListener('click',e=>{e.stopPropagation();toggleOptionAt(i);});
      stateTools.append(same,option);
      const moveTools=document.createElement('div');moveTools.className='actionMoveTools';
      const up=document.createElement('button');up.type='button';up.className='actionMoveBtn';up.textContent='↑';up.title='Mover antes';up.setAttribute('aria-label','Mover acción antes');
      const down=document.createElement('button');down.type='button';down.className='actionMoveBtn';down.textContent='↓';down.title='Mover después';down.setAttribute('aria-label','Mover acción después');
      const blocks=sequenceBlocks(),bi=blocks.findIndex(b=>b.includes(i));
      up.disabled=bi<=0;down.disabled=bi<0||bi>=blocks.length-1;
      up.addEventListener('click',e=>{e.stopPropagation();moveActionBlock(i,-1);});
      down.addEventListener('click',e=>{e.stopPropagation();moveActionBlock(i,1);});
      moveTools.append(up,down);reorder.append(stateTools,moveTools);
      row.append(check,order,dot,label,reorder);list.appendChild(row);
    });
    syncControls();
  }
  function selectedIndexes(){
    if(selected.size)return [...selected].filter(i=>frame().lines[i]).sort((a,b)=>a-b);
    return selectedLine>=0?[selectedLine]:[];
  }
  function sequenceBlocks(){
    const lines=frame().lines||[],blocks=[],seen=new Set();
    for(let i=0;i<lines.length;i++){
      const gid=lines[i].simultaneousGroup;
      if(gid){
        if(seen.has(gid))continue;
        seen.add(gid);
        const idx=[];for(let j=0;j<lines.length;j++)if(lines[j].simultaneousGroup===gid)idx.push(j);
        blocks.push(idx);
      }else blocks.push([i]);
    }
    return blocks;
  }
  function moveActionBlock(index,delta){
    const lines=frame().lines||[];
    if(!lines[index])return;
    const activeAction=lines[index],selectedActions=[...selected].map(i=>lines[i]).filter(Boolean);
    const blocks=sequenceBlocks(),bi=blocks.findIndex(b=>b.includes(index)),ni=bi+delta;
    if(bi<0||ni<0||ni>=blocks.length)return;
    const order=blocks.map(b=>b.map(i=>lines[i]));
    [order[bi],order[ni]]=[order[ni],order[bi]];
    frame().lines=order.flat();
    selectedLine=frame().lines.indexOf(activeAction);
    selected.clear();
    selectedActions.forEach(a=>{const i=frame().lines.indexOf(a);if(i>=0)selected.add(i);});
    reflowPhasesAfter(current);
    render();
    setStatus(delta<0?'Acción movida hacia arriba en la secuencia.':'Acción movida hacia abajo en la secuencia.');
  }

  function groupSameTime(){
    const ids=selectedIndexes();
    if(ids.length<2){setStatus('Selecciona al menos dos acciones para ejecutarlas a la misma vez.');return;}
    const id='g_'+Date.now().toString(36);
    ids.forEach(i=>frame().lines[i].simultaneousGroup=id);
    selected.clear();reflowPhasesAfter(current);render();setStatus('Acciones agrupadas para ejecutarse a la misma vez.');
  }
  function ungroup(){
    const ids=selectedIndexes();
    if(!ids.length)return;
    ids.forEach(i=>frame().lines[i].simultaneousGroup=null);
    selected.clear();reflowPhasesAfter(current);render();setStatus('Acciones separadas.');
  }
  function toggleOption(){
    if(selectedLine<0||!frame().lines[selectedLine]){setStatus('Selecciona una acción primero.');return;}
    const l=frame().lines[selectedLine];l.isOption=!l.isOption;
    reflowPhasesAfter(current);render();
    setStatus(l.isOption?'Acción marcada como opción. En animación volverá al estado anterior después de mostrarla.':'La acción vuelve a ser parte obligatoria de la secuencia.');
  }
  function setColor(color){
    if(selectedLine<0||!frame().lines[selectedLine]){setStatus('Selecciona una acción primero.');return;}
    frame().lines[selectedLine].color=color;render();
  }

  const list=document.getElementById('actionTimelineList');
  if(!list)return;
  document.addEventListener('courtplay:phase-cleared',()=>{selected.clear();lastPhase=current;});
  const pal=document.getElementById('actionColorPalette');
  palette.forEach(color=>{
    const b=document.createElement('button');b.type='button';b.className='actionColor';b.dataset.color=color;b.style.background=color;b.setAttribute('aria-label','Color de acción');
    b.addEventListener('click',()=>setColor(color));pal.appendChild(b);
  });

  const baseRender=render;
  render=function(){baseRender();renderTimeline();};
  renderTimeline();
})();