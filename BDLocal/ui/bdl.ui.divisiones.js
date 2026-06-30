(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIDivisiones."); }

  var state = { periodoId:"", config:{ divisiones:[] }, carreras:[], selected:"", selectedCarreras:[] };

  function keyList(list){ return Array.isArray(list) ? list : []; }
  function divs(){ return state.config.divisiones || []; }
  function selectedDiv(){ return divs().filter(function(d){ return d.nombre === state.selected; })[0] || null; }
  function assignedMap(ignoreSelected){
    var map = {};
    divs().forEach(function(d){
      if(ignoreSelected && d.nombre === state.selected){ return; }
      keyList(d.carreras).forEach(function(k){ map[k] = d.nombre; });
    });
    return map;
  }

  function ajustarModalVisual(){
    var modal = H.one('#bdlDivModal');
    var card = H.one('#bdlDivModal .bdl-modal-card');
    var body = H.one('#bdlDivModal .bdl-modal-body');
    var layout = H.one('#bdlDivModal .bdl-div-layout');
    var lists = [H.one('#bdlDivList'), H.one('#bdlDivAvailable'), H.one('#bdlDivAssigned')];
    if(modal){ modal.style.overflow = 'hidden'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; }
    if(card){ card.style.width = 'min(980px, calc(100vw - 28px))'; card.style.maxHeight = 'calc(100vh - 28px)'; card.style.display = 'flex'; card.style.flexDirection = 'column'; }
    if(body){ body.style.overflow = 'auto'; body.style.maxHeight = 'calc(100vh - 155px)'; body.style.minHeight = '0'; }
    if(layout){ layout.style.gridTemplateColumns = window.innerWidth < 980 ? '1fr' : '220px minmax(220px, 1fr) minmax(220px, 1fr)'; layout.style.gap = '10px'; }
    lists.forEach(function(el){ if(el){ el.style.maxHeight = window.innerWidth < 980 ? '230px' : '46vh'; el.style.overflow = 'auto'; el.style.minHeight = '150px'; } });
  }

  function renderDivisiones(){
    var box = H.one('#bdlDivList');
    if(!box){ return; }
    if(!divs().length){ box.innerHTML = '<div class="bdl-empty">Cree una división para empezar.</div>'; return; }
    box.innerHTML = divs().map(function(d){
      return '<button type="button" class="bdl-div-item '+(d.nombre===state.selected?'active':'')+'" data-div="'+H.esc(d.nombre)+'"><strong>'+H.esc(d.nombre)+'</strong><span>'+keyList(d.carreras).length+' carreras</span></button>';
    }).join("");
    Array.prototype.slice.call(box.querySelectorAll('[data-div]')).forEach(function(btn){
      btn.addEventListener('click', function(){ select(btn.getAttribute('data-div')); });
    });
  }

  function renderCarreras(){
    var avail = H.one('#bdlDivAvailable');
    var assigned = H.one('#bdlDivAssigned');
    var current = selectedDiv();
    var selectedKeys = current ? keyList(current.carreras) : [];
    var occupied = assignedMap(true);
    if(H.one('#bdlDivName')){ H.one('#bdlDivName').value = state.selected || ''; }
    if(avail){
      var available = state.carreras.filter(function(c){ return selectedKeys.indexOf(c.key) < 0 && !occupied[c.key]; });
      avail.innerHTML = available.length ? available.map(card).join('') : '<div class="bdl-empty">No hay carreras disponibles.</div>';
    }
    if(assigned){
      var assignedRows = state.carreras.filter(function(c){ return selectedKeys.indexOf(c.key) >= 0; });
      assigned.innerHTML = assignedRows.length ? assignedRows.map(card).join('') : '<div class="bdl-empty">No hay carreras asignadas.</div>';
    }
    bindCards();
    renderDivisiones();
    ajustarModalVisual();
  }

  function card(c){
    return '<button type="button" draggable="true" class="bdl-career-card" data-career="'+H.esc(c.key)+'"><strong>'+H.esc(c.nombre)+'</strong><span>'+H.esc(c.codigo || '')+'</span></button>';
  }

  function bindCards(){
    Array.prototype.slice.call(document.querySelectorAll('[data-career]')).forEach(function(el){
      el.addEventListener('click', function(){ toggleCareer(el.getAttribute('data-career')); });
      el.addEventListener('dragstart', function(event){ event.dataTransfer.setData('text/plain', el.getAttribute('data-career')); });
    });
  }

  function toggleCareer(key){
    if(!state.selected){ H.notify('Primero cree o seleccione una división.', 'error'); return; }
    var current = selectedDiv();
    if(!current){ return; }
    current.carreras = keyList(current.carreras);
    var idx = current.carreras.indexOf(key);
    var occupied = assignedMap(true);
    if(idx >= 0){ current.carreras.splice(idx, 1); }
    else if(!occupied[key]){ current.carreras.push(key); }
    else { H.notify('Esa carrera ya pertenece a otra división.', 'error'); }
    renderCarreras();
  }

  function createOrSelect(){
    var name = H.val('#bdlDivName').trim();
    if(!name){ H.notify('Ingrese el nombre de la división.', 'error'); return; }
    var current = selectedDiv();
    if(current){ current.nombre = name; state.selected = name; }
    else if(!divs().some(function(d){ return d.nombre === name; })){ divs().push({ nombre:name, carreras:[] }); state.selected = name; }
    else { state.selected = name; }
    renderCarreras();
  }

  function select(name){ state.selected = name || ''; renderCarreras(); }

  function removeSelected(){
    if(!state.selected){ H.notify('Seleccione una división.', 'error'); return; }
    state.config.divisiones = divs().filter(function(d){ return d.nombre !== state.selected; });
    state.selected = '';
    renderCarreras();
  }

  function save(){
    if(!state.periodoId){ H.notify('Seleccione un período.', 'error'); return; }
    if(!window.BDLRepoDivisiones){ H.notify('Repositorio de divisiones no disponible.', 'error'); return; }
    H.notify('Guardando divisiones...');
    return window.BDLRepoDivisiones.saveConfig(state.periodoId, state.config).then(function(saved){
      return window.BDLRepoDivisiones.aplicarConfiguracion(state.periodoId, saved);
    }).then(function(result){
      close();
      var tasks = [];
      if(window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(state.periodoId)); }
      return Promise.all(tasks).then(function(){ H.notify('Divisiones guardadas. Registros actualizados: ' + (result.updated || 0)); });
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function open(){
    var modal = H.one('#bdlDivModal');
    var periodo = H.val('#bdlPeriodoSelect');
    if(!periodo){ H.notify('Seleccione un período antes de crear divisiones.', 'error'); return; }
    if(!window.BDLRepoDivisiones){ H.notify('Repositorio de divisiones no disponible.', 'error'); return; }
    state.periodoId = periodo;
    state.selected = '';
    if(H.one('#bdlDivPeriodo')){ H.one('#bdlDivPeriodo').textContent = periodo; }
    Promise.all([window.BDLRepoDivisiones.getConfig(periodo), window.BDLRepoDivisiones.carrerasPorPeriodo(periodo)]).then(function(parts){
      state.config = parts[0] || { periodoId:periodo, divisiones:[] };
      state.config.divisiones = state.config.divisiones || [];
      state.carreras = parts[1] || [];
      if(modal){ modal.classList.add('open'); }
      ajustarModalVisual();
      renderCarreras();
    }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  function close(){ var modal = H.one('#bdlDivModal'); if(modal){ modal.classList.remove('open'); } }
  function setupDrop(){
    ['#bdlDivAvailable','#bdlDivAssigned'].forEach(function(sel){
      var box = H.one(sel);
      if(!box){ return; }
      box.addEventListener('dragover', function(e){ e.preventDefault(); });
      box.addEventListener('drop', function(e){ e.preventDefault(); toggleCareer(e.dataTransfer.getData('text/plain')); });
    });
  }

  window.addEventListener('resize', ajustarModalVisual);
  window.addEventListener('DOMContentLoaded', setupDrop);
  window.BDLUIDivisiones = { open:open, close:close, save:save, createOrSelect:createOrSelect, removeSelected:removeSelected, toggleCareer:toggleCareer };
})(window);
