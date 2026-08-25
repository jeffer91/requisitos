/* =========================================================
Nombre completo: carga.divisiones.popup.js
Ruta o ubicación: /Carga/carga.divisiones.popup.js
Función o funciones:
- Administrar divisiones y carreras mediante ConCarga.
- Mostrar únicamente carreras que realmente tienen estudiantes en el período seleccionado.
- Identificar carreras por código o nombre normalizado, nunca por ID de estudiante.
- Impedir carreras duplicadas entre divisiones y nombres de división ambiguos.
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var state = {
    period:null,
    periods:[],
    careers:[],
    divisions:[],
    selectedDivisionId:"",
    draggedCareerId:"",
    dirty:false,
    busy:false
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }
  function connector(){ return window.ConCarga || window.BDLocalCarga || null; }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){} }
  function storageGet(name, fallback){ try{ var raw = localStorage.getItem(name); return raw ? JSON.parse(raw) : fallback; }catch(error){ return fallback; } }
  function storageSet(name, value){ try{ localStorage.setItem(name, JSON.stringify(value)); return true; }catch(error){ return false; } }
  function canon(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }
  function ensure(){
    var con = connector();
    if(!con){ return Promise.reject(new Error("ConCarga no está cargado.")); }
    return Promise.resolve(typeof con.ready === "function" ? con.ready() : true).then(function(result){
      if(result && result.ok === false){ throw new Error(result.error || "ConCarga no está listo."); }
      if(typeof con.listStudents !== "function" || typeof con.saveDivisions !== "function"){
        throw new Error("ConCarga no tiene activa la API de divisiones.");
      }
      return con;
    });
  }
  function normalizePeriod(period){
    period = period || {};
    var id = canon(period.periodoCanonicoId || period.periodoId || period.id || period.value || "");
    if(!id){ return null; }
    var label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || period.nombre || id);
    return Object.assign({}, period, {
      id:id,
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
      periodoLabel:label,
      periodoCanonicoLabel:label,
      divisiones:Array.isArray(period.divisiones) ? period.divisiones : [],
      carrerasDetectadas:Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : []
    });
  }
  function isStudentRow(item){
    return !!(item && (item.idEstudiantePeriodo || item.studentId || item.numeroIdentificacion || item.cedula || item.identificacion));
  }
  function normalizeCareer(item){
    var con = connector();
    if(con && typeof con.normalizeCareer === "function"){
      try{ return con.normalizeCareer(item); }catch(error){}
    }
    if(!item){ return null; }
    if(typeof item === "string"){ item = { nombre:item }; }
    var name = text(item.nombre || item.nombreCarrera || item.NombreCarrera || item.carrera || item.Carrera || item._carrera || item.label || "");
    var code = text(item.codigo || item.codigoCarrera || item.CodigoCarrera || "");
    var id = key(code || name);
    if(!id && !isStudentRow(item)){ id = key(item.id || ""); }
    if(!id || (!name && !code)){ return null; }
    return { id:id, codigo:code, nombre:name || code, total:Number(item.total || item.estudiantes || 0) || 0 };
  }
  function uniqueCareers(list){
    var map = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(item){
      var current = normalizeCareer(item);
      if(!current){ return; }
      if(!map[current.id]){ map[current.id] = current; }
      else{
        map[current.id] = Object.assign({}, map[current.id], current, {
          total:Math.max(Number(map[current.id].total || 0), Number(current.total || 0))
        });
      }
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }
  function careersFromStudents(rows){
    var counts = Object.create(null);
    var careers = [];
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var current = normalizeCareer(row);
      if(!current){ return; }
      counts[current.id] = (counts[current.id] || 0) + 1;
      careers.push(current);
    });
    return uniqueCareers(careers).map(function(item){
      return Object.assign({}, item, { total:counts[item.id] || 0 });
    });
  }
  function normalizeDivision(item){
    if(!item){ return null; }
    if(typeof item === "string"){ item = { nombre:item }; }
    var name = text(item.nombre || item.label || item.name || item.id || "");
    var id = key(item.id || name);
    if(!id || !name){ return null; }
    return {
      id:id,
      nombre:name,
      carreras:uniqueCareers(item.carreras || item.careers || []),
      createdAt:item.createdAt || now(),
      updatedAt:item.updatedAt || now()
    };
  }
  function sanitizeDivisions(list, allowedCareers){
    var con = connector();
    if(con && typeof con.sanitizeDivisions === "function"){
      try{ return con.sanitizeDivisions(list || [], allowedCareers || []); }catch(error){}
    }
    var allowed = Object.create(null);
    uniqueCareers(allowedCareers || []).forEach(function(item){ allowed[item.id] = item; });
    var divisions = Object.create(null);
    var order = [];
    (Array.isArray(list) ? list : []).forEach(function(item){
      var division = normalizeDivision(item);
      if(!division){ return; }
      if(!divisions[division.id]){
        divisions[division.id] = Object.assign({}, division, { carreras:[] });
        order.push(division.id);
      }
      divisions[division.id].carreras = uniqueCareers([].concat(divisions[division.id].carreras || [], division.carreras || []));
    });
    var owned = Object.create(null);
    return order.map(function(id){
      var division = divisions[id];
      var careers = [];
      (division.carreras || []).forEach(function(item){
        var current = normalizeCareer(item);
        if(!current || !allowed[current.id] || owned[current.id]){ return; }
        owned[current.id] = id;
        careers.push(allowed[current.id]);
      });
      return Object.assign({}, division, { carreras:uniqueCareers(careers) });
    });
  }
  function selectedDivision(){ return state.divisions.filter(function(item){ return item.id === state.selectedDivisionId; })[0] || null; }
  function assignedMap(){
    var map = Object.create(null);
    state.divisions.forEach(function(division){
      (division.carreras || []).forEach(function(current){ if(!map[current.id]){ map[current.id] = division.id; } });
    });
    return map;
  }
  function showMessage(type, message){
    var box = document.getElementById("cargaMessageBox");
    if(!box){ return; }
    box.className = "carga-message is-" + (type || "success");
    box.textContent = message || "";
    box.classList.remove("carga-hidden");
    clearTimeout(box.__timer);
    box.__timer = setTimeout(function(){ box.classList.add("carga-hidden"); }, 5000);
  }
  function ensurePopup(){
    var node = document.getElementById("cargaDivisionesPopupV3");
    if(node){ return node; }
    node = document.createElement("div");
    node.id = "cargaDivisionesPopupV3";
    node.className = "cdp-overlay";
    node.innerHTML = '<section class="cdp-dialog" role="dialog" aria-modal="true" aria-labelledby="cdpTitle"><header class="cdp-head"><div><h2 id="cdpTitle">Divisiones</h2><small id="cdpSubtitle">Selecciona un período.</small></div><button type="button" class="cdp-close" data-cdp-exit>×</button></header><div class="cdp-body"><div class="cdp-toolbar"><label><span>Período</span><select id="cdpPeriod"></select></label><label><span>División seleccionada</span><select id="cdpDivision"></select></label><label><span>Nombre</span><input id="cdpDivisionName" maxlength="80" placeholder="Nombre de división"></label><button type="button" class="carga-btn carga-btn-primary" id="cdpCreate">Crear</button><button type="button" class="carga-btn" id="cdpRename">Editar</button><button type="button" class="carga-btn carga-btn-danger-soft" id="cdpDelete">Borrar</button></div><div class="cdp-grid"><section class="cdp-panel" id="cdpAvailablePanel"><h3>Carreras disponibles</h3><small>Solo carreras con estudiantes registrados en este período.</small><div class="cdp-list" id="cdpAvailable"></div></section><section class="cdp-panel" id="cdpAssignedPanel"><h3 id="cdpAssignedTitle">Carreras de la división</h3><small>Arrastra aquí, retira o mueve una carrera directamente.</small><div class="cdp-list" id="cdpAssigned"></div></section></div></div><footer class="cdp-foot"><button type="button" class="carga-btn" data-cdp-exit>Salir</button><button type="button" class="carga-btn carga-btn-primary" id="cdpSave">Guardar cambios</button></footer></section>';
    document.body.appendChild(node);
    bindEvents(node);
    return node;
  }
  function option(select, value, label){ var item = document.createElement("option"); item.value = value; item.textContent = label; select.appendChild(item); }
  function renderPeriodSelect(){
    var select = document.getElementById("cdpPeriod");
    if(!select){ return; }
    select.replaceChildren();
    option(select, "", "Seleccione...");
    state.periods.forEach(function(period){ option(select, period.id, period.label); });
    select.value = state.period ? state.period.id : "";
  }
  function renderDivisionSelect(){
    var select = document.getElementById("cdpDivision");
    if(!select){ return; }
    select.replaceChildren();
    option(select, "", "Seleccione...");
    state.divisions.forEach(function(division){ option(select, division.id, division.nombre); });
    select.value = state.selectedDivisionId;
    var selected = selectedDivision();
    document.getElementById("cdpDivisionName").value = selected ? selected.nombre : "";
    document.getElementById("cdpAssignedTitle").textContent = selected ? "Carreras de " + selected.nombre : "Carreras de la división";
  }
  function emptyNode(message){ var node = document.createElement("div"); node.className = "cdp-empty"; node.textContent = message; return node; }
  function careerNode(current, assigned){
    var article = document.createElement("article");
    article.className = "cdp-career";
    article.draggable = true;
    article.dataset.careerId = current.id;
    var info = document.createElement("div");
    var strong = document.createElement("strong");
    var small = document.createElement("small");
    strong.textContent = current.nombre;
    small.textContent = current.total ? current.total + " estudiantes" : current.codigo || "";
    info.append(strong, small);
    article.appendChild(info);
    if(assigned){
      var actions = document.createElement("div");
      actions.className = "cdp-career-actions";
      var select = document.createElement("select");
      select.dataset.moveCareer = current.id;
      option(select, "", "Mover a...");
      state.divisions.filter(function(division){ return division.id !== state.selectedDivisionId; }).forEach(function(division){ option(select, division.id, division.nombre); });
      var button = document.createElement("button");
      button.type = "button";
      button.dataset.removeCareer = current.id;
      button.textContent = "Retirar";
      actions.append(select, button);
      article.appendChild(actions);
    }else{
      var chip = document.createElement("span");
      chip.className = "carga-chip";
      chip.textContent = "Arrastrar";
      article.appendChild(chip);
    }
    return article;
  }
  function renderCareers(){
    var assigned = assignedMap();
    var selected = selectedDivision();
    var available = state.careers.filter(function(current){ return !assigned[current.id]; });
    var availableBox = document.getElementById("cdpAvailable");
    var assignedBox = document.getElementById("cdpAssigned");
    availableBox.replaceChildren();
    assignedBox.replaceChildren();
    if(available.length){ available.forEach(function(current){ availableBox.appendChild(careerNode(current, false)); }); }
    else{ availableBox.appendChild(emptyNode(state.careers.length ? "Todas las carreras ya tienen división." : "No hay carreras registradas en este período.")); }
    if(selected && selected.carreras.length){ selected.carreras.forEach(function(current){ assignedBox.appendChild(careerNode(current, true)); }); }
    else{ assignedBox.appendChild(emptyNode("Selecciona una división o arrastra carreras aquí.")); }
  }
  function render(){
    renderPeriodSelect();
    renderDivisionSelect();
    renderCareers();
    var subtitle = document.getElementById("cdpSubtitle");
    if(subtitle){
      subtitle.textContent = state.period
        ? state.period.label + " · " + state.careers.length + " carrera" + (state.careers.length === 1 ? "" : "s")
        : "Selecciona un período.";
    }
  }
  function loadPeriods(){
    return ensure().then(function(con){ return typeof con.getPeriods === "function" ? con.getPeriods() : []; }).then(function(rows){
      state.periods = (Array.isArray(rows) ? rows : []).map(normalizePeriod).filter(Boolean).sort(function(a, b){ return b.id.localeCompare(a.id); });
      storageSet(LS_PERIODOS, state.periods);
      return state.periods;
    });
  }
  function loadPeriod(period){
    period = normalizePeriod(period);
    if(!period){ return Promise.reject(new Error("Selecciona un período.")); }
    state.busy = true;
    state.period = period;
    state.selectedDivisionId = "";
    return ensure().then(function(con){
      return Promise.all([
        con.listStudents({ periodoId:period.id, matricula:"" }),
        typeof con.listDivisions === "function" ? con.listDivisions(period.id) : []
      ]);
    }).then(function(values){
      var students = (Array.isArray(values[0]) ? values[0] : []).filter(function(row){
        return canon(row && (row.periodoId || row.periodId || row.periodoCanonicoId || row.ultimoPeriodoId || "")) === period.id;
      });
      state.careers = careersFromStudents(students);
      state.divisions = sanitizeDivisions(values[1] || period.divisiones || [], state.careers);
      state.selectedDivisionId = state.divisions[0] ? state.divisions[0].id : "";
      state.dirty = false;
      state.busy = false;
      render();
      return period;
    }).catch(function(error){ state.busy = false; throw error; });
  }
  function uniqueDivisionId(name){
    var base = key(name) || "division";
    var id = base;
    var index = 2;
    while(state.divisions.some(function(division){ return division.id === id; })){
      id = base + String(index);
      index += 1;
    }
    return id;
  }
  function divisionNameExists(name, exceptId){
    var wanted = key(name);
    return state.divisions.some(function(division){ return division.id !== exceptId && key(division.nombre) === wanted; });
  }
  function createDivision(){
    var input = document.getElementById("cdpDivisionName");
    var name = text(input.value);
    if(!name){ showMessage("warning", "Escribe el nombre de la división."); return; }
    if(divisionNameExists(name, "")){ showMessage("warning", "Ya existe una división con ese nombre."); return; }
    var division = { id:uniqueDivisionId(name), nombre:name, carreras:[], createdAt:now(), updatedAt:now() };
    state.divisions.push(division);
    state.selectedDivisionId = division.id;
    state.dirty = true;
    render();
  }
  function renameDivision(){
    var division = selectedDivision();
    var name = text(document.getElementById("cdpDivisionName").value);
    if(!division){ showMessage("warning", "Selecciona una división."); return; }
    if(!name){ showMessage("warning", "Escribe un nombre."); return; }
    if(divisionNameExists(name, division.id)){ showMessage("warning", "Ya existe una división con ese nombre."); return; }
    division.nombre = name;
    division.updatedAt = now();
    state.dirty = true;
    render();
  }
  function deleteDivision(){
    var division = selectedDivision();
    if(!division){ showMessage("warning", "Selecciona una división."); return; }
    if(!confirm('¿Borrar la división "' + division.nombre + '"? Las carreras quedarán sin división.')){ return; }
    state.divisions = state.divisions.filter(function(item){ return item.id !== division.id; });
    state.selectedDivisionId = state.divisions[0] ? state.divisions[0].id : "";
    state.dirty = true;
    render();
  }
  function findCareer(id){ return state.careers.filter(function(current){ return current.id === id; })[0] || null; }
  function removeEverywhere(id){ state.divisions.forEach(function(division){ division.carreras = (division.carreras || []).filter(function(current){ return current.id !== id; }); }); }
  function assign(id, divisionId){
    var current = findCareer(id);
    var division = state.divisions.filter(function(item){ return item.id === divisionId; })[0];
    if(!current || !division){ return; }
    removeEverywhere(id);
    division.carreras = uniqueCareers([].concat(division.carreras || [], [current]));
    division.updatedAt = now();
    state.dirty = true;
    render();
  }
  function remove(id){ removeEverywhere(id); state.dirty = true; render(); }
  function saveLocal(period){
    var store = storageGet(LS_DIVISIONES, {});
    store[period.id] = { periodoId:period.id, divisiones:state.divisions, updatedAt:now() };
    storageSet(LS_DIVISIONES, store);
    var periods = state.periods.map(function(item){
      return item.id === period.id
        ? Object.assign({}, item, period, { divisiones:state.divisions, carrerasDetectadas:state.careers, updatedAt:now() })
        : item;
    });
    storageSet(LS_PERIODOS, periods);
  }
  function saveAll(){
    if(!state.period || state.busy){ return Promise.resolve(null); }
    state.busy = true;
    var period = Object.assign({}, state.period, {
      divisiones:sanitizeDivisions(state.divisions, state.careers),
      carrerasDetectadas:state.careers,
      updatedAt:now()
    });
    return ensure().then(function(con){ return con.saveDivisions(period, period.divisiones, state.careers); }).then(function(result){
      state.divisions = period.divisiones;
      saveLocal(period);
      state.dirty = false;
      showMessage("success", "Divisiones guardadas. Estudiantes actualizados: " + Number(result && result.updated || 0) + ".");
      emit("carga:divisions-saved", {
        periodoId:period.id,
        divisiones:state.divisions.length,
        carreras:state.careers.length,
        updated:Number(result && result.updated || 0),
        source:"ConCarga"
      });
      close(true);
      return result;
    }).catch(function(error){
      showMessage("error", error.message || String(error));
      throw error;
    }).finally(function(){ state.busy = false; });
  }
  function open(period){
    var node = ensurePopup();
    node.classList.add("is-open");
    return loadPeriods().then(function(){
      period = normalizePeriod(period) || state.periods[0] || null;
      if(!period){ render(); showMessage("warning", "Primero crea un período."); return null; }
      return loadPeriod(period);
    }).catch(function(error){ showMessage("error", error.message || String(error)); return null; });
  }
  function close(force){
    if(state.dirty && !force && !confirm("Hay cambios sin guardar. ¿Salir de todos modos?")){ return; }
    var node = document.getElementById("cargaDivisionesPopupV3");
    if(node){ node.classList.remove("is-open"); }
    state.dirty = false;
  }
  function bindDrop(panel, onDrop){
    panel.addEventListener("dragover", function(event){ event.preventDefault(); panel.classList.add("is-over"); });
    panel.addEventListener("dragleave", function(){ panel.classList.remove("is-over"); });
    panel.addEventListener("drop", function(event){
      event.preventDefault();
      panel.classList.remove("is-over");
      var id = "";
      try{ id = event.dataTransfer.getData("text/plain"); }catch(error){}
      onDrop(id || state.draggedCareerId);
    });
  }
  function bindEvents(node){
    node.addEventListener("click", function(event){
      if(event.target === node || event.target.closest("[data-cdp-exit]")){ close(false); return; }
      var removeButton = event.target.closest("[data-remove-career]");
      if(removeButton){ remove(removeButton.getAttribute("data-remove-career")); }
    });
    node.addEventListener("dragstart", function(event){
      var item = event.target.closest("[data-career-id]");
      if(!item){ return; }
      state.draggedCareerId = item.getAttribute("data-career-id");
      try{ event.dataTransfer.setData("text/plain", state.draggedCareerId); }catch(error){}
    });
    document.getElementById("cdpPeriod").addEventListener("change", function(){
      var id = this.value;
      var period = state.periods.filter(function(item){ return item.id === id; })[0];
      if(period){ loadPeriod(period); }
    });
    document.getElementById("cdpDivision").addEventListener("change", function(){ state.selectedDivisionId = this.value; renderDivisionSelect(); renderCareers(); });
    document.getElementById("cdpCreate").addEventListener("click", createDivision);
    document.getElementById("cdpRename").addEventListener("click", renameDivision);
    document.getElementById("cdpDelete").addEventListener("click", deleteDivision);
    document.getElementById("cdpSave").addEventListener("click", saveAll);
    document.getElementById("cdpAssigned").addEventListener("change", function(event){
      var select = event.target.closest("[data-move-career]");
      if(select && select.value){ assign(select.getAttribute("data-move-career"), select.value); }
    });
    bindDrop(document.getElementById("cdpAssignedPanel"), function(id){
      if(!state.selectedDivisionId){ showMessage("warning", "Selecciona una división."); return; }
      assign(id, state.selectedDivisionId);
    });
    bindDrop(document.getElementById("cdpAvailablePanel"), remove);
    document.addEventListener("keydown", function(event){ if(event.key === "Escape" && node.classList.contains("is-open")){ close(false); } });
  }

  window.CargaDivisionesPopup = {
    version:"4.0.0-period-strict",
    open:open,
    close:close,
    save:saveAll,
    reload:function(){ return state.period ? loadPeriod(state.period) : Promise.resolve(null); },
    helpers:{ normalizeCareer:normalizeCareer, isStudentRow:isStudentRow, careersFromStudents:careersFromStudents, sanitizeDivisions:sanitizeDivisions }
  };
})(window, document);
