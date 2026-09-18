(function(){
  'use strict';
  const palette=['#172033','#2563eb','#f2d21c','#ef4444','#2f855a','#7c3aed'];
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
    const optionBtn=document.getElementById('optionActionBtn');
    if(optionBtn){
      optionBtn.disabled=!l;
      optionBtn.classList.toggle('active',!!l?.isOption);
      optionBtn.textContent=l?.isOption?'✓ Opción':'Marcar opción';
    }
    document.querySelectorAll('#actionColorPalette .actionColor').forEach(btn=>{
      btn.classList.toggle('active',!!l&&l.color===btn.dataset.color);
    });
  }
  function renderTimeline(){
    if(lastPhase!==current){selected.clear();lastPhase=current;}
    const list=document.getElementById('actionTimelineList');
    if(!list)return;
    list.innerHTML='';
    (frame().lines||[]).forEach((l,i)=>{
      CourtPlayEngine.normalizeAction(l);
      const row=document.createElement('div');
      row.className='actionRow'+(selectedLine===i?' active':'')+(l.isOption?' option':'');
      const check=document.createElement('input');
      check.type='checkbox';check.className='actionCheck';check.checked=selected.has(i);
      check.addEventListener('click',e=>e.stopPropagation());
      check.addEventListener('change',()=>{check.checked?selected.add(i):selected.delete(i);});
      const dot=document.createElement('span');dot.className='actionDot';dot.style.background=l.color||'#172033';
      const label=document.createElement('button');label.type='button';label.className='actionLabel';
      label.innerHTML=`<strong>${actionTitle(l)}</strong><small>${l.isOption?'Opción':''}${l.simultaneousGroup?(l.isOption?' · ':'')+'Misma vez':''}</small>`;
      label.addEventListener('click',()=>{selectedLine=i;selectedPlayer=l.sourceKey||null;render();});
      row.append(check,dot,label);list.appendChild(row);
    });
    syncControls();
  }
  function selectedIndexes(){
    if(selected.size)return [...selected].filter(i=>frame().lines[i]).sort((a,b)=>a-b);
    return selectedLine>=0?[selectedLine]:[];
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
  document.getElementById('sameTimeBtn')?.addEventListener('click',groupSameTime);
  document.getElementById('ungroupBtn')?.addEventListener('click',ungroup);
  document.getElementById('optionActionBtn')?.addEventListener('click',toggleOption);
  const pal=document.getElementById('actionColorPalette');
  palette.forEach(color=>{
    const b=document.createElement('button');b.type='button';b.className='actionColor';b.dataset.color=color;b.style.background=color;b.setAttribute('aria-label','Color de acción');
    b.addEventListener('click',()=>setColor(color));pal.appendChild(b);
  });

  const baseRender=render;
  render=function(){baseRender();renderTimeline();};
  renderTimeline();
})();