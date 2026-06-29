/* =========================================================
Nombre completo: baselocal.divisiones.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.divisiones.js
Función o funciones:
- Mostrar modal Divisiones en Base Local.
- Separar dos procesos: crear división y adjuntar carreras.
- Crear divisiones vacías por período sin exigir carreras.
- Cargar carreras disponibles y carreras asignadas a la división seleccionada.
- Permitir arrastrar carreras para agregar o quitar de una división existente.
- Guardar divisiones: ["Nombre"] en estudiantes activos y retirados solo al adjuntar carreras.
- Mostrar mensaje: División [nombre] del período [período] creada.
- Evitar que el modal se congele por sincronización Firebase pesada.
- Sincronizar Firebase en segundo plano después de guardar localmente.
Con qué se conecta:
- services/bl-divisiones.service.js
- baselocal.core.js
- baselocal.divisiones-api.patch.js
- baselocal.firebase.js
- baselocal.connector.js
- baselocal.app.js
========================================================= */
(function(window, document){
  "use strict";

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}

  var state = {periodId:"", divisions:[], selectedDivision:"", available:[], selected:[], saving:false, lastResult:null, draggingCareer:""};

  function getSelectedPeriod(){
    var selector = el("bl-filter-period");
    var value = selector ? text(selector.value) : "";
    if(value){return value;}
    return state.periodId || "";
  }

  function periodLabel(periodId){
    var periods = window.BaseLocalAPI && typeof window.BaseLocalAPI.getPeriods === "function" ? window.BaseLocalAPI.getPeriods() : [];
    var found = periods.find(function(period){
      var id = text(period.id || period.periodoId || period.label || period.periodoLabel);
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        try{return window.BLPeriodosCanon.samePeriod(id, periodId);}catch(error){}
      }
      return id === text(periodId);
    });
    return found ? text(found.label || found.periodoLabel || found.id) : text(periodId);
  }

  function status(message, type){
    var box = el("bl-status");
    if(box){box.textContent = message;box.className = "bl-status " + (type || "bl-status-info");}
  }

  function setModalOpen(open){
    var modal = el("bl-division-modal");
    if(!modal){return;}
    modal.classList.toggle("is-open", !!open);
    modal.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function updateNewButtonLabel(){
    var btn = el("bl-division-new");
    if(!btn){return;}
    if(state.selectedDivision){
      btn.innerHTML = "<span>＋</span>Nueva";
      btn.title = "Preparar una nueva división";
      return;
    }
    btn.innerHTML = "<span>＋</span>Crear división";
    btn.title = "Crear solo la división. Las carreras se adjuntan después.";
  }

  function setBusy(on){
    state.saving = !!on;
    var save = el("bl-division-save");
    var cancel = el("bl-division-cancel");
    var close = el("bl-division-close");
    var del = el("bl-division-delete");
    var edit = el("bl-division-edit");
    var newBtn = el("bl-division-new");
    var existing = el("bl-division-existing");
    var name = el("bl-division-name");
    if(save){save.disabled = !!on;save.textContent = on ? "Guardando..." : "💾 Guardar carreras";}
    if(cancel){cancel.disabled = !!on;}
    if(close){close.disabled = !!on;}
    if(del){del.disabled = !!on || !state.selectedDivision;}
    if(edit){edit.disabled = !!on || !state.selectedDivision;}
    if(newBtn){newBtn.disabled = !!on;}
    if(existing){existing.disabled = !!on;}
    if(name){name.disabled = !!on;}
    updateNewButtonLabel();
  }

  function uniqueSorted(values){
    var seen = {};
    var out = [];
    (values || []).forEach(function(value){
      var clean = text(value);
      var key = norm(clean);
      if(!clean || seen[key]){return;}
      seen[key] = true;
      out.push(clean);
    });
    return out.sort(function(a,b){return a.localeCompare(b,"es");});
  }

  function removeValue(list, value){
    var key = norm(value);
    return (list || []).filter(function(item){return norm(item) !== key;});
  }

  function addValue(list, value){
    var out = removeValue(list, value);
    if(text(value)){out.push(text(value));}
    return uniqueSorted(out);
  }

  function emitChange(kind, payload){
    var detail = Object.assign({source:"baselocal.divisiones", at:new Date().toISOString()}, payload || {});
    [kind, "requisitos:bl:changed", "requisitos:bl:snapshot-changed"].forEach(function(name){
      try{window.dispatchEvent(new CustomEvent(name, {detail:detail}));}catch(error){}
    });
    try{
      if(window.parent && window.parent !== window){
        window.parent.postMessage({type:"requisitos:bl:snapshot-changed", payload:detail}, "*");
      }
    }catch(error){}
    try{window.localStorage.setItem("REQ_BL_SIGNAL_V1", JSON.stringify(Object.assign({id:"division-" + Date.now()}, detail)));}catch(error){}
  }

  function refreshBaseLocalView(result){
    try{if(window.BaseLocalAPI && typeof window.BaseLocalAPI.clearSnapshotCache === "function"){window.BaseLocalAPI.clearSnapshotCache();}}catch(error){}
    try{if(window.BaseLocalApp && typeof window.BaseLocalApp.scheduleRender === "function"){window.BaseLocalApp.scheduleRender("division-updated");}}catch(error){}
    emitChange("requisitos:bl:division-created", result || {});
  }

  function syncDivisionInBackground(result){
    setTimeout(function(){
      if(!window.BaseLocalFirebase || typeof window.BaseLocalFirebase.push !== "function"){
        status("Cambios de división guardados localmente. Firebase queda pendiente porque el conector no está disponible.", "bl-status-warn");
        return;
      }
      if(window.navigator && window.navigator.onLine === false){
        status("Cambios de división guardados localmente. Firebase se sincronizará cuando haya internet.", "bl-status-warn");
        return;
      }
      window.BaseLocalFirebase.push()
        .then(function(summary){
          var base = result && result.message ? result.message : "Cambios de división guardados.";
          status(base + " Sincronización Firebase finalizada.", "bl-status-ok");
          refreshBaseLocalView(Object.assign({}, result || {}, {firebase:summary || null}));
        })
        .catch(function(error){
          console.warn("[BaseLocal Divisiones Firebase background]", error);
          var base = result && result.message ? result.message : "Cambios de división guardados localmente.";
          status(base + " Firebase quedó pendiente: " + (error.message || String(error)), "bl-status-warn");
        });
    }, 300);
  }

  function loadDivisionState(periodId, selectedDivision){
    state.periodId = periodId;
    state.divisions = window.BaseLocalAPI && typeof window.BaseLocalAPI.getDivisions === "function" ? window.BaseLocalAPI.getDivisions(periodId) : [];
    state.selectedDivision = text(selectedDivision || "");

    var available = window.BaseLocalAPI && typeof window.BaseLocalAPI.getAvailableDivisionCareers === "function" ? window.BaseLocalAPI.getAvailableDivisionCareers(periodId) : [];
    var selected = [];

    if(state.selectedDivision && window.BaseLocalAPI && typeof window.BaseLocalAPI.getDivisionDetail === "function"){
      var detail = window.BaseLocalAPI.getDivisionDetail(periodId, state.selectedDivision);
      selected = detail && Array.isArray(detail.carreras) ? detail.carreras : [];
    }

    state.selected = uniqueSorted(selected);
    state.available = uniqueSorted(available).filter(function(career){return !state.selected.some(function(sel){return norm(sel) === norm(career);});});
  }

  function renderDivisionSelector(){
    var selector = el("bl-division-existing");
    var name = el("bl-division-name");
    var del = el("bl-division-delete");
    var edit = el("bl-division-edit");
    if(selector){
      selector.innerHTML = '<option value="">Nueva división</option>' + state.divisions.map(function(division){return '<option value="' + esc(division) + '">' + esc(division) + '</option>';}).join("");
      selector.value = state.selectedDivision;
    }
    if(name){name.value = state.selectedDivision || text(name.value);}
    if(del){del.disabled = !state.selectedDivision || state.saving;}
    if(edit){edit.disabled = !state.selectedDivision || state.saving;}
    updateNewButtonLabel();
  }

  function careerCard(career, fromZone){
    var targetHint = fromZone === "available" ? "Agregar a la división" : "Quitar de la división";
    return '<button type="button" class="bl-career-chip" draggable="true" data-zone="' + esc(fromZone) + '" data-career="' + esc(career) + '">' + esc(career) + '<small>' + esc(targetHint) + '</small></button>';
  }

  function bucket(title, zone, rows, emptyText){
    return '<section class="bl-division-bucket"><h3>' + esc(title) + '</h3><div class="bl-division-dropzone" data-dropzone="' + esc(zone) + '">' + (rows.length ? rows.map(function(career){return careerCard(career, zone);}).join("") : '<div class="bl-empty-drop">' + esc(emptyText) + '</div>') + '</div></section>';
  }

  function renderCareers(){
    var wrap = el("bl-division-careers");
    var help = el("bl-division-help");
    if(!wrap){return;}
    if(help){
      if(state.selectedDivision){
        help.textContent = "Proceso 2: adjuntar carreras a " + state.selectedDivision + ". Mueve carreras y presiona Guardar carreras.";
      }else{
        help.textContent = "Proceso 1: crea la división del período. Escribe el nombre y presiona Crear división. Las carreras se adjuntan después.";
      }
    }
    wrap.innerHTML = bucket("Carreras disponibles", "available", state.available, "No hay carreras libres.") + bucket("Carreras en esta división", "selected", state.selected, state.selectedDivision ? "Arrastra aquí las carreras." : "Primero crea o selecciona una división.");
    updateNewButtonLabel();
  }

  function renderAll(){
    renderDivisionSelector();
    renderCareers();
    setBusy(state.saving);
  }

  function moveCareer(career, targetZone){
    if(!state.selectedDivision){
      status("Primero crea o selecciona una división. Después adjunta carreras.", "bl-status-warn");
      return;
    }
    career = text(career);
    if(!career){return;}
    if(targetZone === "selected"){
      state.available = removeValue(state.available, career);
      state.selected = addValue(state.selected, career);
    }else{
      state.selected = removeValue(state.selected, career);
      state.available = addValue(state.available, career);
    }
    renderCareers();
  }

  function focusNameForEdit(){
    var name = el("bl-division-name");
    if(!state.selectedDivision){
      status("Estás creando una división nueva. Escribe el nombre y presiona Crear división.", "bl-status-warn");
      if(name){name.focus();}
      return;
    }
    if(name){name.focus();name.select();}
  }

  function prepareNewDivision(){
    var name = el("bl-division-name");
    loadDivisionState(state.periodId || getSelectedPeriod(), "");
    if(name){name.value = "";name.focus();}
    renderAll();
    status("Proceso 1: escribe el nombre de la nueva división y presiona Crear división.", "bl-status-info");
  }

  function selectDivision(name){
    loadDivisionState(state.periodId || getSelectedPeriod(), name);
    var input = el("bl-division-name");
    if(input){input.value = name;}
    renderAll();
  }

  async function createDivisionOnly(){
    if(state.saving){return;}
    var name = text(el("bl-division-name") && el("bl-division-name").value);
    var periodId = state.periodId || getSelectedPeriod();
    if(!periodId){status("Selecciona un período.", "bl-status-warn");return;}
    if(!name){status("Escribe el nombre de la división.", "bl-status-warn");var input=el("bl-division-name");if(input){input.focus();}return;}

    try{
      if(!window.BaseLocalAPI || typeof window.BaseLocalAPI.createDivision !== "function"){
        throw new Error("La API para crear divisiones no está disponible.");
      }
      setBusy(true);
      var result = window.BaseLocalAPI.createDivision(periodId, name);
      state.lastResult = result;
      setBusy(false);
      refreshBaseLocalView(result);
      selectDivision(name);
      status(result.message || ("División " + name + " del período " + periodLabel(periodId) + " creada."), result.alreadyExists ? "bl-status-warn" : "bl-status-ok");
      syncDivisionInBackground(result);
    }catch(error){
      console.error("[BaseLocal Divisiones create]", error);
      status("No se pudo crear la división: " + (error.message || String(error)), "bl-status-warn");
      setBusy(false);
    }
  }

  function handleNewButton(){
    if(state.selectedDivision){
      prepareNewDivision();
      return;
    }
    createDivisionOnly();
  }

  function openModal(){
    var periodId = getSelectedPeriod();
    if(!periodId){
      status("Selecciona primero un período para crear o editar divisiones.", "bl-status-warn");
      return;
    }
    var periodBox = el("bl-division-period-label");
    var name = el("bl-division-name");
    if(periodBox){periodBox.textContent = periodLabel(periodId);}
    if(name){name.value = "";}
    loadDivisionState(periodId, "");
    renderAll();
    setModalOpen(true);
    status("Proceso 1: crea la división del período " + periodLabel(periodId) + ". Luego adjunta carreras.", "bl-status-info");
    setTimeout(function(){if(name){name.focus();}}, 60);
  }

  function closeModal(){
    if(state.saving){return;}
    setModalOpen(false);
  }

  async function saveDivision(){
    if(state.saving){return;}
    var name = text(el("bl-division-name") && el("bl-division-name").value) || state.selectedDivision;
    var periodId = state.periodId || getSelectedPeriod();
    var careers = state.selected.slice();

    if(!periodId){status("Selecciona un período.", "bl-status-warn");return;}
    if(!state.selectedDivision){status("Primero crea o selecciona una división. Después adjunta carreras.", "bl-status-warn");return;}
    if(!name){status("Escribe el nombre de la división.", "bl-status-warn");return;}

    try{
      if(!window.BaseLocalAPI || typeof window.BaseLocalAPI.replaceDivisionToCareers !== "function"){
        throw new Error("La API de edición de divisiones no está disponible.");
      }
      setBusy(true);
      var result = window.BaseLocalAPI.replaceDivisionToCareers(periodId, state.selectedDivision, name, careers);
      state.lastResult = result;
      setBusy(false);
      setModalOpen(false);
      refreshBaseLocalView(result);
      var msg = result.message || ("Carreras actualizadas en la división " + name + " del período " + periodLabel(periodId) + ".");
      status(msg + " Estudiantes actualizados: " + (result.updated || 0) + ". Firebase se sincroniza en segundo plano.", "bl-status-ok");
      syncDivisionInBackground(result);
    }catch(error){
      console.error("[BaseLocal Divisiones]", error);
      status("No se pudo guardar las carreras de la división: " + (error.message || String(error)), "bl-status-warn");
      setBusy(false);
    }
  }

  async function deleteSelectedDivision(){
    if(state.saving){return;}
    var periodId = state.periodId || getSelectedPeriod();
    var division = state.selectedDivision;
    if(!periodId || !division){status("Selecciona una división para borrar.", "bl-status-warn");return;}
    if(!window.confirm("¿Borrar la división " + division + "? Las carreras quedarán sin división.")){return;}

    try{
      if(!window.BaseLocalAPI || typeof window.BaseLocalAPI.deleteDivision !== "function"){
        throw new Error("La API para borrar divisiones no está disponible.");
      }
      setBusy(true);
      var result = window.BaseLocalAPI.deleteDivision(periodId, division);
      state.lastResult = result;
      setBusy(false);
      setModalOpen(false);
      refreshBaseLocalView(result);
      status("División borrada del período " + periodLabel(periodId) + ": " + division + ". Estudiantes actualizados: " + (result.updated || 0) + ". Firebase se sincroniza en segundo plano.", "bl-status-ok");
      syncDivisionInBackground(result);
    }catch(error){
      console.error("[BaseLocal Divisiones delete]", error);
      status("No se pudo borrar la división: " + (error.message || String(error)), "bl-status-warn");
      setBusy(false);
    }
  }

  function bind(){
    if(el("bl-btn-create-division")){el("bl-btn-create-division").addEventListener("click", openModal);}
    if(el("bl-division-cancel")){el("bl-division-cancel").addEventListener("click", closeModal);}
    if(el("bl-division-close")){el("bl-division-close").addEventListener("click", closeModal);}
    if(el("bl-division-save")){el("bl-division-save").addEventListener("click", saveDivision);}
    if(el("bl-division-delete")){el("bl-division-delete").addEventListener("click", deleteSelectedDivision);}
    if(el("bl-division-edit")){el("bl-division-edit").addEventListener("click", focusNameForEdit);}
    if(el("bl-division-new")){el("bl-division-new").addEventListener("click", handleNewButton);}
    if(el("bl-division-existing")){
      el("bl-division-existing").addEventListener("change", function(event){
        loadDivisionState(state.periodId || getSelectedPeriod(), event.target.value);
        renderAll();
      });
    }
    if(el("bl-division-modal")){
      el("bl-division-modal").addEventListener("click", function(event){if(event.target === el("bl-division-modal")){closeModal();}});
      el("bl-division-modal").addEventListener("dragstart", function(event){
        var card = event.target && event.target.closest ? event.target.closest(".bl-career-chip") : null;
        if(!card){return;}
        state.draggingCareer = card.getAttribute("data-career") || "";
        if(event.dataTransfer){event.dataTransfer.setData("text/plain", state.draggingCareer);event.dataTransfer.effectAllowed = "move";}
      });
      el("bl-division-modal").addEventListener("dragover", function(event){
        var zone = event.target && event.target.closest ? event.target.closest("[data-dropzone]") : null;
        if(!zone){return;}
        event.preventDefault();
        zone.classList.add("is-over");
        if(event.dataTransfer){event.dataTransfer.dropEffect = "move";}
      });
      el("bl-division-modal").addEventListener("dragleave", function(event){
        var zone = event.target && event.target.closest ? event.target.closest("[data-dropzone]") : null;
        if(zone){zone.classList.remove("is-over");}
      });
      el("bl-division-modal").addEventListener("drop", function(event){
        var zone = event.target && event.target.closest ? event.target.closest("[data-dropzone]") : null;
        if(!zone){return;}
        event.preventDefault();
        zone.classList.remove("is-over");
        var career = event.dataTransfer ? event.dataTransfer.getData("text/plain") : state.draggingCareer;
        moveCareer(career, zone.getAttribute("data-dropzone"));
      });
      el("bl-division-modal").addEventListener("click", function(event){
        var card = event.target && event.target.closest ? event.target.closest(".bl-career-chip") : null;
        if(!card){return;}
        var zone = card.getAttribute("data-zone");
        moveCareer(card.getAttribute("data-career"), zone === "available" ? "selected" : "available");
      });
    }
    document.addEventListener("keydown", function(event){if(event.key === "Escape" && el("bl-division-modal") && el("bl-division-modal").classList.contains("is-open")){closeModal();}});
  }

  window.BaseLocalDivisionesUI = {
    open:openModal,
    close:closeModal,
    create:createDivisionOnly,
    save:saveDivision,
    renderCareers:renderCareers,
    lastResult:function(){return state.lastResult;},
    getState:function(){return Object.assign({}, state);}
  };

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", bind);}else{bind();}
})(window, document);
