/* =========================================================
Nombre completo: carga.divisiones.popup.js
Ruta o ubicación: /Requisitos/Carga/carga.divisiones.popup.js
Función o funciones:
- Agregar botón visible Divisiones junto al selector de período.
- Abrir popup rápido para crear, editar o borrar divisiones por período.
- Leer divisiones solo desde configuración rápida: localStorage, período y BLDivisionesService.
- Evitar escanear estudiantes al abrir el modal.
- Asignar carreras a la división seleccionada con arrastrar y soltar o botón alternativo.
- Guardar estructura de divisiones por período.
- Actualizar estudiantes solo cuando el usuario presiona Guardar cambios.
Con qué se conecta:
- carga.html
- carga.css
- carga.ui.js
- BL2Core
- BLDivisionesService
- localStorage carga.periodos.local
- localStorage carga.periodos.divisiones
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_DIVISIONES = "carga.periodos.divisiones";

  var state = {
    period:null,
    careers:[],
    divisions:[],
    selectedDivisionId:"",
    originalAssigned:{},
    draggedCareerId:""
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }

  function esc(value){
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeParse(value, fallback){
    try{ var parsed = JSON.parse(value || ""); return parsed == null ? fallback : parsed; }
    catch(error){ return fallback; }
  }

  function storageGet(name, fallback){
    try{ return safeParse(window.localStorage.getItem(name), fallback); }
    catch(error){ return fallback; }
  }

  function storageSet(name, value){
    try{ window.localStorage.setItem(name, JSON.stringify(value)); }catch(error){}
  }

  function parentValue(name){
    try{ if(window.parent && window.parent !== window){ return window.parent[name]; } }catch(error){}
    return null;
  }

  function api(name){ return window[name] || parentValue(name) || null; }
  function core(){ return api("BL2Core"); }
  function divisionService(){ return api("BLDivisionesService"); }

  function showMessage(type, message){
    var box = document.getElementById("cargaMessageBox");
    if(box){
      box.className = "carga-message is-" + (type || "success");
      box.textContent = message || "";
      box.classList.remove("carga-hidden");
    }
  }

  function dispatch(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }
    return value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    if(!a || !b){ return false; }
    return a === b || key(a) === key(b);
  }

  function selectedPeriodFromDom(){
    var select = document.getElementById("cargaPeriodoSelect");
    var raw = text(select ? select.value : "") || text(window.localStorage.getItem(LS_PERIODO));
    var id = canonicalPeriodId(raw);
    if(!id){ return null; }

    var label = "";
    if(select && select.selectedOptions && select.selectedOptions[0]){ label = text(select.selectedOptions[0].textContent); }
    label = label || text(window.localStorage.getItem(LS_PERIODO_LABEL)) || id;

    return {
      id:id,
      periodoId:id,
      periodoCanonicoId:id,
      label:label,
      periodoLabel:label,
      periodoCanonicoLabel:label,
      carrerasDetectadas:[],
      divisiones:[]
    };
  }

  function normalizeCareer(item){
    if(!item){ return null; }
    if(typeof item === "string"){ return { id:key(item), codigo:"", nombre:text(item) }; }
    var nombre = text(item.nombre || item.NombreCarrera || item.nombreCarrera || item.label || item.carrera || item.Carrera || "");
    var codigo = text(item.codigo || item.CodigoCarrera || item.codigoCarrera || "");
    var id = text(item.id || codigo || key(nombre));
    if(!id && !nombre){ return null; }
    return { id:id || key(nombre), codigo:codigo, nombre:nombre || codigo || id };
  }

  function uniqueCareers(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      var career = normalizeCareer(item);
      if(career && career.id){ map[career.id] = career; }
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" });
    });
  }

  function normalizeDivision(div){
    if(!div){ return null; }
    if(typeof div === "string"){ return { id:key(div), nombre:text(div), carreras:[], createdAt:nowISO(), updatedAt:nowISO() }; }
    var name = text(div.nombre || div.label || div.name || div.id || "");
    var id = text(div.id || key(name));
    if(!id && !name){ return null; }
    return {
      id:id || key(name),
      nombre:name || id,
      carreras:uniqueCareers(div.carreras || []),
      createdAt:div.createdAt || div.creadoEn || nowISO(),
      updatedAt:div.updatedAt || div.actualizadoEn || nowISO()
    };
  }

  function mergeDivisions(){
    var map = {};
    Array.prototype.slice.call(arguments).forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(item){
        var div = normalizeDivision(item);
        if(!div){ return; }
        if(!map[div.id]){ map[div.id] = div; return; }
        map[div.id] = Object.assign({}, map[div.id], div, {
          carreras:uniqueCareers([].concat(map[div.id].carreras || [], div.carreras || [])),
          updatedAt:div.updatedAt || map[div.id].updatedAt || nowISO()
        });
      });
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" });
    });
  }

  function localPeriods(){
    var rows = storageGet(LS_PERIODOS, []);
    return Array.isArray(rows) ? rows : [];
  }

  function divisionsStore(){
    var raw = storageGet(LS_DIVISIONES, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function divisionsFromStore(periodId){
    var store = divisionsStore();
    var item = store[periodId] || store[canonicalPeriodId(periodId)] || null;
    if(Array.isArray(item)){ return item; }
    if(item && Array.isArray(item.divisiones)){ return item.divisiones; }
    if(item && Array.isArray(item.items)){ return item.items; }
    if(item && Array.isArray(item.rows)){ return item.rows; }
    return [];
  }

  function divisionsFromLocalPeriods(periodId){
    var list = [];
    localPeriods().forEach(function(period){
      var id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.id || period.value || "");
      if(samePeriod(id, periodId) && Array.isArray(period.divisiones)){ list = list.concat(period.divisiones); }
    });
    return list;
  }

  function divisionsFromService(periodId){
    var service = divisionService();
    if(service && typeof service.divisionsForPeriod === "function"){
      try{ return service.divisionsForPeriod(periodId) || []; }catch(error){}
    }
    return [];
  }

  function careersFromService(periodId){
    var service = divisionService();
    if(service && typeof service.careersForPeriod === "function"){
      try{ return service.careersForPeriod(periodId) || []; }catch(error){}
    }
    return [];
  }

  function saveDivisionsStore(periodId, divisions){
    var store = divisionsStore();
    periodId = canonicalPeriodId(periodId);
    store[periodId] = Object.assign({}, store[periodId] || {}, { periodoId:periodId, divisiones:divisions, updatedAt:nowISO() });
    storageSet(LS_DIVISIONES, store);
  }

  function updateLocalPeriod(period){
    if(!period || !period.id){ return; }
    var periods = localPeriods();
    var found = false;
    periods = periods.map(function(item){
      var id = canonicalPeriodId(item.periodoCanonicoId || item.periodoId || item.id || item.value || "");
      if(samePeriod(id, period.id)){ found = true; return Object.assign({}, item, period, { updatedAt:nowISO() }); }
      return item;
    });
    if(!found){ periods.unshift(Object.assign({}, period, { updatedAt:nowISO() })); }
    storageSet(LS_PERIODOS, periods);
  }

  function assignedMap(divisions){
    var map = {};
    (divisions || []).forEach(function(div){
      (div.carreras || []).forEach(function(career){ if(career && career.id){ map[career.id] = div.id; } });
    });
    return map;
  }

  function assignedNameMap(divisions){
    var map = {};
    (divisions || []).forEach(function(div){
      (div.carreras || []).forEach(function(career){ if(career && career.id){ map[career.id] = div.nombre; } });
    });
    return map;
  }

  function careerFromStudent(row){ return normalizeCareer(row || {}); }
  function careerIdFromStudent(row){ var c = careerFromStudent(row || {}); return c ? c.id : ""; }

  function periodFromLocalOrCore(selected){
    var found = localPeriods().filter(function(item){
      var id = canonicalPeriodId(item.periodoCanonicoId || item.periodoId || item.id || item.value || "");
      return samePeriod(id, selected.id);
    })[0];

    if(found){ return Promise.resolve(Object.assign({}, selected, found)); }

    var c = core();
    if(c && typeof c.getPeriods === "function"){
      return c.getPeriods().then(function(periods){
        var item = (periods || []).filter(function(row){
          var id = canonicalPeriodId(row.periodoCanonicoId || row.periodoId || row.id || row.value || "");
          return samePeriod(id, selected.id);
        })[0];
        return Object.assign({}, selected, item || {});
      }).catch(function(){ return selected; });
    }

    return Promise.resolve(selected);
  }

  function loadPeriodWithData(){
    var selected = selectedPeriodFromDom();
    if(!selected){ return Promise.reject(new Error("Selecciona un período antes de administrar divisiones.")); }

    return periodFromLocalOrCore(selected).then(function(period){
      period.id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.id || selected.id);
      period.periodoId = period.id;
      period.periodoCanonicoId = period.id;
      period.label = text(period.periodoCanonicoLabel || period.periodoLabel || period.label || selected.label || period.id);
      period.periodoLabel = period.label;
      period.periodoCanonicoLabel = period.label;

      var divisions = mergeDivisions(divisionsFromStore(period.id), period.divisiones || [], divisionsFromLocalPeriods(period.id), divisionsFromService(period.id));
      var careers = uniqueCareers([].concat(period.carrerasDetectadas || [], careersFromService(period.id), divisions.reduce(function(out, div){ return out.concat(div.carreras || []); }, [])));

      period.divisiones = divisions;
      period.carrerasDetectadas = careers;
      return period;
    });
  }

  function ensureButton(){
    if(document.getElementById("cargaBtnDivisionesPeriodo")){ return; }
    var select = document.getElementById("cargaPeriodoSelect");
    if(!select){ return; }
    var field = select.closest ? select.closest(".carga-field") : select.parentNode;
    if(!field || !field.parentNode){ return; }
    var row = document.createElement("div");
    row.className = "carga-period-select-actions";
    row.innerHTML = '<button type="button" class="carga-btn carga-btn-secondary" id="cargaBtnDivisionesPeriodo">Divisiones</button><small>Crear, editar, borrar y asignar carreras a divisiones del período seleccionado.</small>';
    field.parentNode.insertBefore(row, field.nextSibling);
    document.getElementById("cargaBtnDivisionesPeriodo").addEventListener("click", openPopup);
  }

  function injectStyles(){
    if(document.getElementById("carga-divisiones-popup-styles")){ return; }
    var style = document.createElement("style");
    style.id = "carga-divisiones-popup-styles";
    style.textContent = [
      ".carga-period-select-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #edf2f7}",
      ".carga-period-select-actions small{color:#64748b;font-size:11px;font-weight:800}",
      ".cdp-overlay{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.46);backdrop-filter:blur(2px)}",
      ".cdp-overlay.is-open{display:flex}",
      ".cdp-modal{width:min(1080px,96vw);max-height:92vh;overflow:hidden;background:#fff;border:1px solid #dbe3ef;border-radius:22px;box-shadow:0 30px 90px rgba(15,23,42,.30);display:grid;grid-template-rows:auto 1fr auto}",
      ".cdp-head{display:flex;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid #e2e8f0;background:#f8fbff}",
      ".cdp-head p{margin:0 0 4px;color:#1d4ed8;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.10em}.cdp-head h2{margin:0;font-size:21px;letter-spacing:-.03em;color:#172033}.cdp-head small{display:block;margin-top:3px;color:#64748b;font-weight:800}",
      ".cdp-close{width:38px;height:38px;border:1px solid #dbe3ef;border-radius:999px;background:#fff;color:#172033;font-size:24px;line-height:1;cursor:pointer}",
      ".cdp-body{overflow:auto;padding:16px 18px;display:grid;gap:14px;background:#fff}.cdp-panel{border:1px solid #dbe3ef;border-radius:17px;background:#fff;padding:12px;min-width:0}.cdp-manage{background:#f8fafc}",
      ".cdp-title{font-size:14px;font-weight:950;color:#172033;margin-bottom:9px;display:flex;justify-content:space-between;gap:10px;align-items:center}.cdp-title span{color:#64748b;font-size:11px;font-weight:850}",
      ".cdp-manage-grid{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:end}.cdp-field{display:grid;gap:5px}.cdp-field label{font-size:11px;font-weight:950;color:#334155}.cdp-field input,.cdp-field select{min-height:38px;border:1px solid #dbe3ef;border-radius:12px;padding:8px 11px;outline:none;background:#fff}",
      ".cdp-selector-row{display:grid;grid-template-columns:minmax(260px,420px) 1fr;gap:12px;margin-top:12px;align-items:end}.cdp-selected-note{border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;border-radius:13px;padding:9px 11px;font-size:12px;font-weight:850}",
      ".cdp-assign{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(340px,1.1fr);gap:14px;align-items:start}.cdp-careers{display:grid;gap:8px;max-height:360px;overflow:auto;padding-right:3px}",
      ".cdp-career{display:flex;align-items:flex-start;gap:8px;border:1px solid #dbe3ef;border-radius:13px;background:#f8fafc;padding:9px;cursor:grab;user-select:none}.cdp-career input{margin-top:2px}.cdp-career strong{display:block;font-size:12px;color:#172033;line-height:1.25}.cdp-career small{display:block;color:#64748b;font-weight:800;font-size:10px;margin-top:2px}",
      ".cdp-fallback{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #edf2f7}.cdp-drop{border:1.5px dashed #93c5fd;border-radius:16px;background:#f8fbff;padding:12px;min-height:135px;transition:.15s ease}.cdp-drop.is-over{background:#eff6ff;border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(147,197,253,.28)}",
      ".cdp-drop-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.cdp-tags{display:flex;gap:6px;flex-wrap:wrap}.cdp-tag{display:inline-flex;align-items:center;gap:5px;border:1px solid #dbe3ef;border-radius:999px;background:#fff;padding:5px 8px;font-size:11px;font-weight:900;color:#334155;max-width:100%}.cdp-tag button{border:0;background:#fee2e2;color:#b91c1c;border-radius:999px;width:18px;height:18px;line-height:1;font-weight:900;cursor:pointer}",
      ".cdp-divisions-summary{display:grid;gap:8px}.cdp-summary-item{border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc;padding:9px}.cdp-summary-item strong{display:block;font-size:12px}.cdp-summary-item small{display:block;color:#64748b;font-weight:850;margin-top:3px}.cdp-empty{border:1px dashed #cbd5e1;border-radius:13px;padding:12px;text-align:center;color:#64748b;background:#f8fafc;font-weight:850;font-size:12px}",
      ".cdp-foot{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:13px 18px;border-top:1px solid #e2e8f0;background:#fff}.cdp-note{color:#64748b;font-size:11px;font-weight:850;line-height:1.35}",
      "@media(max-width:860px){.cdp-manage-grid,.cdp-selector-row,.cdp-assign{grid-template-columns:1fr}.cdp-modal{width:98vw}.cdp-foot{display:grid}.cdp-fallback{justify-content:stretch}.cdp-fallback button{width:100%}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensurePopup(){
    if(document.getElementById("cargaDivisionesPopupV2")){ return; }
    var node = document.createElement("div");
    node.id = "cargaDivisionesPopupV2";
    node.className = "cdp-overlay";
    node.innerHTML = '<section class="cdp-modal" role="dialog" aria-modal="true" aria-labelledby="cdpTitle"><header class="cdp-head"><div><p>Divisiones por período</p><h2 id="cdpTitle">Administrar divisiones</h2><small id="cdpPeriod">—</small></div><button type="button" class="cdp-close" data-cdp-close aria-label="Cerrar">×</button></header><div class="cdp-body"><section class="cdp-panel cdp-manage"><div class="cdp-title">Crear, editar o borrar divisiones <span id="cdpDivisionCount">0 divisiones</span></div><div class="cdp-manage-grid"><div class="cdp-field"><label for="cdpDivisionName">Nombre de división</label><input id="cdpDivisionName" type="text" placeholder="Superior, Nivel 1, Nivel 2..." autocomplete="off"></div><button type="button" class="carga-btn carga-btn-primary" id="cdpSaveDivisionName">Crear / actualizar</button><button type="button" class="carga-btn carga-btn-light" id="cdpClearDivisionName">Nuevo</button><button type="button" class="carga-btn carga-btn-light" id="cdpDeleteDivision">Borrar seleccionada</button></div><div class="cdp-selector-row"><div class="cdp-field"><label for="cdpDivisionSelector">División seleccionada</label><select id="cdpDivisionSelector"><option value="">Crea una división primero</option></select></div><div class="cdp-selected-note" id="cdpSelectedNote">Elige una división para recibir carreras.</div></div></section><section class="cdp-assign"><article class="cdp-panel"><div class="cdp-title">Carreras del período <span id="cdpCareerCount">0 carreras</span></div><div id="cdpCareers" class="cdp-careers"></div><div class="cdp-fallback"><button type="button" class="carga-btn carga-btn-secondary" id="cdpAssignSelected">Asignar seleccionadas a la división elegida</button></div></article><article class="cdp-panel"><div class="cdp-title">Destino seleccionado <span>arrastra carreras aquí</span></div><div id="cdpSelectedDrop" class="cdp-drop"></div></article></section><section class="cdp-panel"><div class="cdp-title">Resumen de divisiones guardadas <span>del período seleccionado</span></div><div id="cdpDivisionsSummary" class="cdp-divisions-summary"></div></section></div><footer class="cdp-foot"><div class="cdp-note">El modal lee divisiones configuradas. No escanea estudiantes al abrir.</div><div class="carga-actions"><button type="button" class="carga-btn carga-btn-light" data-cdp-close>Cerrar</button><button type="button" class="carga-btn carga-btn-primary" id="cdpSaveAll">Guardar cambios</button></div></footer></section>';
    document.body.appendChild(node);
    bindPopupEvents(node);
  }

  function bindPopupEvents(node){
    node.addEventListener("click", function(event){ if(event.target === node || event.target.closest("[data-cdp-close]")){ closePopup(); } });
    document.getElementById("cdpSaveDivisionName").addEventListener("click", saveDivisionName);
    document.getElementById("cdpClearDivisionName").addEventListener("click", clearDivisionEditor);
    document.getElementById("cdpDeleteDivision").addEventListener("click", deleteSelectedDivision);
    document.getElementById("cdpAssignSelected").addEventListener("click", assignSelected);
    document.getElementById("cdpSaveAll").addEventListener("click", saveAll);
    document.getElementById("cdpDivisionSelector").addEventListener("change", function(event){ state.selectedDivisionId = text(event.target.value); fillEditorFromSelected(); renderPopup(false); });
    document.getElementById("cdpDivisionName").addEventListener("keydown", function(event){ if(event.key === "Enter"){ event.preventDefault(); saveDivisionName(); } });
    document.getElementById("cdpCareers").addEventListener("dragstart", function(event){ var item = event.target.closest(".cdp-career"); if(!item){ return; } state.draggedCareerId = item.getAttribute("data-career-id") || ""; try{ event.dataTransfer.setData("text/plain", state.draggedCareerId); }catch(error){} });
    var drop = document.getElementById("cdpSelectedDrop");
    drop.addEventListener("dragover", function(event){ event.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", function(){ drop.classList.remove("is-over"); });
    drop.addEventListener("drop", function(event){ event.preventDefault(); drop.classList.remove("is-over"); var careerId = ""; try{ careerId = event.dataTransfer.getData("text/plain"); }catch(error){} assignCareerToSelected(careerId || state.draggedCareerId); });
    drop.addEventListener("click", function(event){ var remove = event.target.closest("button[data-cdp-remove-career]"); if(remove){ removeCareerFromDivisions(remove.getAttribute("data-cdp-remove-career")); } });
  }

  function selectedDivision(){ return state.divisions.filter(function(div){ return div.id === state.selectedDivisionId; })[0] || null; }
  function fillEditorFromSelected(){ var input = document.getElementById("cdpDivisionName"); var div = selectedDivision(); if(input){ input.value = div ? div.nombre : ""; } }
  function clearDivisionEditor(){ state.selectedDivisionId = ""; var input = document.getElementById("cdpDivisionName"); if(input){ input.value = ""; input.focus(); } renderPopup(false); }

  function openPopup(){
    loadPeriodWithData().then(function(period){
      state.period = period;
      state.careers = uniqueCareers(period.carrerasDetectadas || []);
      state.divisions = mergeDivisions(period.divisiones || []);
      state.originalAssigned = assignedMap(state.divisions);
      if(state.selectedDivisionId && !selectedDivision()){ state.selectedDivisionId = ""; }
      if(!state.selectedDivisionId && state.divisions[0]){ state.selectedDivisionId = state.divisions[0].id; }
      renderPopup(true);
      document.getElementById("cargaDivisionesPopupV2").classList.add("is-open");
    }).catch(function(error){ showMessage("warning", error.message || "No se pudo abrir divisiones."); });
  }

  function closePopup(){ var node = document.getElementById("cargaDivisionesPopupV2"); if(node){ node.classList.remove("is-open"); } }

  function saveDivisionName(){
    var input = document.getElementById("cdpDivisionName");
    var name = text(input ? input.value : "");
    if(!name){ showMessage("warning", "Escribe el nombre de la división."); return; }
    var existing = selectedDivision();
    var nameKey = key(name);
    if(state.divisions.some(function(div){ return div.id !== (existing && existing.id) && key(div.nombre) === nameKey; })){ showMessage("warning", "Ya existe una división con ese nombre."); return; }
    if(existing){ state.divisions = state.divisions.map(function(div){ return div.id === existing.id ? Object.assign({}, div, { nombre:name, updatedAt:nowISO() }) : div; }); }
    else{ state.selectedDivisionId = nameKey || ("division_" + Date.now()); state.divisions.push({ id:state.selectedDivisionId, nombre:name, carreras:[], createdAt:nowISO(), updatedAt:nowISO() }); }
    saveFast();
    renderPopup(true);
  }

  function deleteSelectedDivision(){
    var div = selectedDivision();
    if(!div){ showMessage("warning", "Selecciona una división para borrar."); return; }
    if(!window.confirm("¿Borrar la división " + div.nombre + "? Las carreras quedarán sin división hasta asignarlas de nuevo.")){ return; }
    state.divisions = state.divisions.filter(function(item){ return item.id !== div.id; });
    state.selectedDivisionId = state.divisions[0] ? state.divisions[0].id : "";
    saveFast();
    renderPopup(true);
  }

  function saveFast(){
    if(!state.period){ return; }
    saveDivisionsStore(state.period.id, state.divisions);
    updateLocalPeriod(Object.assign({}, state.period, { divisiones:state.divisions, carrerasDetectadas:state.careers, updatedAt:nowISO() }));
  }

  function careerById(careerId){ return state.careers.filter(function(career){ return career.id === careerId; })[0] || null; }
  function assignCareerToSelected(careerId){ var target = selectedDivision(); if(!target){ showMessage("warning", "Primero elige una división en el selector."); return; } assignCareerToDivision(careerId, target.id); }

  function assignCareerToDivision(careerId, divisionId){
    careerId = text(careerId); divisionId = text(divisionId);
    if(!careerId || !divisionId){ return; }
    var career = careerById(careerId);
    if(!career){ return; }
    state.divisions = state.divisions.map(function(div){
      var current = Array.isArray(div.carreras) ? div.carreras : [];
      current = current.filter(function(item){ return item.id !== careerId; });
      if(div.id === divisionId){ current = uniqueCareers(current.concat([career])); }
      return Object.assign({}, div, { carreras:current, updatedAt:nowISO() });
    });
    saveFast();
    renderPopup(false);
  }

  function removeCareerFromDivisions(careerId){
    careerId = text(careerId);
    state.divisions = state.divisions.map(function(div){ return Object.assign({}, div, { carreras:(div.carreras || []).filter(function(career){ return career.id !== careerId; }), updatedAt:nowISO() }); });
    saveFast();
    renderPopup(false);
  }

  function selectedCareerIds(){ return Array.prototype.map.call(document.querySelectorAll("#cdpCareers input[type='checkbox']:checked"), function(input){ return input.value; }).filter(Boolean); }
  function assignSelected(){ var target = selectedDivision(); var ids = selectedCareerIds(); if(!target){ showMessage("warning", "Primero elige una división en el selector."); return; } if(!ids.length){ showMessage("warning", "Selecciona una o más carreras."); return; } ids.forEach(function(id){ assignCareerToDivision(id, target.id); }); }

  function renderPopup(fillInput){
    ensurePopup();
    var period = state.period || {};
    var currentAssigned = assignedMap(state.divisions);
    var divNameById = {};
    state.divisions.forEach(function(div){ divNameById[div.id] = div.nombre; });
    if(state.selectedDivisionId && !selectedDivision()){ state.selectedDivisionId = state.divisions[0] ? state.divisions[0].id : ""; }
    var selected = selectedDivision();
    document.getElementById("cdpPeriod").textContent = (period.periodoCanonicoLabel || period.periodoLabel || period.label || period.id || "—") + " · " + (period.id || "");
    document.getElementById("cdpDivisionCount").textContent = state.divisions.length + " división" + (state.divisions.length === 1 ? "" : "es");
    document.getElementById("cdpCareerCount").textContent = state.careers.length + " carrera" + (state.careers.length === 1 ? "" : "s");
    var selector = document.getElementById("cdpDivisionSelector");
    selector.innerHTML = state.divisions.length ? state.divisions.map(function(div){ return '<option value="' + esc(div.id) + '">' + esc(div.nombre) + '</option>'; }).join("") : '<option value="">Crea una división primero</option>';
    selector.value = state.selectedDivisionId || "";
    if(fillInput){ fillEditorFromSelected(); }
    document.getElementById("cdpSelectedNote").textContent = selected ? "División activa: " + selected.nombre + "." : "Crea o elige una división para recibir carreras.";
    renderCareers(currentAssigned, divNameById);
    renderSelectedDrop(selected);
    renderDivisionsSummary();
  }

  function renderCareers(currentAssigned, divNameById){
    var box = document.getElementById("cdpCareers");
    if(!state.careers.length){ box.innerHTML = '<div class="cdp-empty">No hay carreras detectadas para este período. Sube el Excel o guarda carreras del período primero.</div>'; return; }
    box.innerHTML = state.careers.map(function(career){
      var owner = currentAssigned[career.id];
      return '<label class="cdp-career" draggable="true" data-career-id="' + esc(career.id) + '"><input type="checkbox" value="' + esc(career.id) + '"><span><strong>' + esc(career.nombre) + '</strong><small>' + esc(career.codigo || career.id) + (owner ? ' · En ' + esc(divNameById[owner] || owner) : ' · Sin división') + '</small></span></label>';
    }).join("");
  }

  function renderSelectedDrop(selected){
    var box = document.getElementById("cdpSelectedDrop");
    if(!selected){ box.innerHTML = '<div class="cdp-empty">Elige una división en el selector para poder arrastrar carreras aquí.</div>'; return; }
    var careers = selected.carreras || [];
    var careersHtml = careers.length ? careers.map(function(career){ return '<span class="cdp-tag">' + esc(career.nombre || career.id) + '<button type="button" data-cdp-remove-career="' + esc(career.id) + '" title="Quitar">×</button></span>'; }).join("") : '<div class="cdp-empty">Suelta aquí las carreras para ' + esc(selected.nombre) + '.</div>';
    box.innerHTML = '<div class="cdp-drop-head"><strong>' + esc(selected.nombre) + '</strong><span>' + careers.length + ' carrera' + (careers.length === 1 ? '' : 's') + '</span></div><div class="cdp-tags">' + careersHtml + '</div>';
  }

  function renderDivisionsSummary(){
    var box = document.getElementById("cdpDivisionsSummary");
    if(!state.divisions.length){ box.innerHTML = '<div class="cdp-empty">No hay divisiones configuradas para este período.</div>'; return; }
    box.innerHTML = state.divisions.map(function(div){ var careers = div.carreras || []; var names = careers.length ? careers.map(function(career){ return career.nombre || career.id; }).join(', ') : 'Sin carreras asignadas'; return '<article class="cdp-summary-item"><strong>' + esc(div.nombre) + '</strong><small>' + esc(names) + '</small></article>'; }).join("");
  }

  function savePeriodToCore(period){
    updateLocalPeriod(period);
    var c = core();
    if(c && typeof c.savePeriod === "function"){ return c.savePeriod(period).catch(function(){ return period; }); }
    return Promise.resolve(period);
  }

  function updateStudentsByDivisions(period){
    var c = core();
    if(!c || typeof c.getStudents !== "function" || typeof c.updateStudent !== "function"){ return Promise.resolve({ updated:0, skipped:true, message:"BL2Core no disponible para actualizar estudiantes." }); }
    var currentByCareer = assignedNameMap(state.divisions);
    var originalByCareer = state.originalAssigned || {};
    return c.getStudents({ periodoId:period.id, matricula:"" }).then(function(students){
      students = Array.isArray(students) ? students : [];
      var updated = 0;
      var chain = Promise.resolve();
      students.forEach(function(student){
        var careerId = careerIdFromStudent(student);
        if(!careerId){ return; }
        var hasCurrent = Object.prototype.hasOwnProperty.call(currentByCareer, careerId);
        var hadOriginal = Object.prototype.hasOwnProperty.call(originalByCareer, careerId);
        var desired = hasCurrent ? currentByCareer[careerId] : (hadOriginal ? "" : null);
        if(desired === null){ return; }
        var currentDivision = text(student.division || student.Division || student._division || "");
        if(currentDivision === desired){ return; }
        chain = chain.then(function(){ return c.updateStudent(student.id, { division:desired, divisiones:desired ? [desired] : [], divisionActualizadaEn:nowISO(), ultimaEdicionLocal:nowISO(), updatedAt:nowISO() }, { action:"division_period_career_update" }).then(function(){ updated += 1; }); });
      });
      return chain.then(function(){ return { updated:updated, total:students.length }; });
    });
  }

  function saveAll(){
    if(!state.period || !state.period.id){ return; }
    var period = Object.assign({}, state.period, { divisiones:state.divisions, carrerasDetectadas:state.careers, updatedAt:nowISO() });
    showMessage("warning", "Guardando divisiones y actualizando estudiantes del período...");
    saveDivisionsStore(period.id, state.divisions);
    savePeriodToCore(period).then(function(){ return updateStudentsByDivisions(period); }).then(function(result){
      dispatch("bdlocal:changes-created", { source:"CargaDivisionesPopup", periodoId:period.id, periodoLabel:period.periodoCanonicoLabel || period.periodoLabel || period.label, total:result.updated || 0 });
      dispatch("bdlocal:sync-requested", { source:"CargaDivisionesPopup", reason:"period_divisions_saved", periodoId:period.id, periodoLabel:period.periodoCanonicoLabel || period.periodoLabel || period.label, pending:result.updated || 0, lowCost:true, idleOnly:true, batchSize:50 });
      closePopup();
      showMessage("success", "Divisiones guardadas. Estudiantes actualizados: " + (result.updated || 0) + ".");
    }).catch(function(error){ showMessage("error", "No se pudo guardar divisiones: " + (error.message || String(error))); });
  }

  function updateButtonState(){ var button = document.getElementById("cargaBtnDivisionesPeriodo"); if(button){ button.disabled = !selectedPeriodFromDom(); } }

  function boot(){
    injectStyles();
    ensureButton();
    ensurePopup();
    updateButtonState();
    var select = document.getElementById("cargaPeriodoSelect");
    if(select){ select.addEventListener("change", updateButtonState); }
    window.addEventListener("storage", updateButtonState);
    window.addEventListener("bl2:period-change", updateButtonState);
    window.CargaDivisionesPopup = { open:openPopup, close:closePopup, save:saveAll, reload:function(){ if(!state.period){ return; } loadPeriodWithData().then(function(period){ state.period = period; state.careers = uniqueCareers(period.carrerasDetectadas || []); state.divisions = mergeDivisions(period.divisiones || []); if(state.selectedDivisionId && !selectedDivision()){ state.selectedDivisionId = state.divisions[0] ? state.divisions[0].id : ""; } renderPopup(true); }); } };
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window, document);
