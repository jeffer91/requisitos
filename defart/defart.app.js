/* =========================================================
Nombre completo: defart.app.js
Ruta o ubicación: /Requisitos/defart/defart.app.js
Función o funciones:
- Controlar la pantalla Defensas sin encabezado grande y con filtros compactos en 2 filas.
- Manejar filtros por período, división, carrera, estado, sede y búsqueda con actualización automática.
- Editar N-ART y N-DEF directamente en la tabla.
- Mostrar cálculo N-FIN en vivo antes de guardar.
- Guardar todos los cambios con botón flotante.
- Guardar una sola fila con botón de ícono visible solo cuando esa fila tenga cambios.
- Descargar Excel visible.
Con qué se conecta:
- defart.core.js
- defart.export.js
- defart.table.js
========================================================= */
(function(window, document){
  "use strict";

  var state = {
    periodId:"",
    division:"",
    career:"",
    status:"",
    sede:"",
    search:"",
    sortKey:"_nombre",
    sortDir:"asc",
    data:null,
    changes:{},
    rowFeedback:{},
    filterTimer:null,
    rendering:false,
    saving:false
  };

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }
  function hasOwn(obj, key){ return Object.prototype.hasOwnProperty.call(obj || {}, key); }
  function cssEscape(value){
    value = text(value);
    if(window.CSS && typeof window.CSS.escape === "function"){ return window.CSS.escape(value); }
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function saveState(message){
    var box = el("def-save-state");
    if(box){ box.textContent = message || "Listo"; }
  }
  function setProgress(percent, message){
    var bar = el("def-progress-bar");
    var txt = el("def-progress-text");
    if(bar){ bar.style.width = Math.max(0, Math.min(100, percent || 0)) + "%"; }
    if(txt){ txt.textContent = message || ""; }
  }
  function esc(value){
    return text(value)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
  function option(value, label, selected){
    return '<option value="'+esc(value)+'" '+(selected ? "selected" : "")+'>'+esc(label)+'</option>';
  }
  function noteToText(value){
    if(window.DefartTable && typeof window.DefartTable.noteText === "function"){
      return window.DefartTable.noteText(value);
    }
    if(window.DefartCore && typeof window.DefartCore.noteToText === "function"){
      return window.DefartCore.noteToText(value);
    }
    return value == null ? "" : String(value);
  }
  function noteKey(value){
    var raw = text(value).replace(",", ".");
    if(raw === ""){ return ""; }
    var num = Number(raw);
    if(!Number.isFinite(num)){ return raw; }
    return String(Math.round(num * 100) / 100);
  }
  function sameNote(a, b){ return noteKey(a) === noteKey(b); }
  function kpi(id, value){
    var box = el(id);
    if(box){ box.textContent = value || 0; }
  }
  function renderKpis(data){
    var k = data && data.kpis ? data.kpis : {};
    kpi("def-kpi-total", k.total);
    kpi("def-kpi-sin-req", k["Sin requisitos"]);
    kpi("def-kpi-pend-art", k["Pendiente Art"]);
    kpi("def-kpi-sup-art", k["Supletorio Art"]);
    kpi("def-kpi-pend-def", k["Pendiente Def"]);
    kpi("def-kpi-sup-def", k["Supletorio Def"]);
    kpi("def-kpi-completo", k["Completo"]);
  }
  function fillFilters(data){
    data = data || {};
    var periodo = el("def-filter-periodo");
    var division = el("def-filter-division");
    var carrera = el("def-filter-carrera");
    var sede = el("def-filter-sede");

    if(periodo){
      periodo.innerHTML = option("", "Todos", !state.periodId) + (data.periodList || []).map(function(item){
        return option(item.id, item.label || item.id, state.periodId === item.id);
      }).join("");
      periodo.value = state.periodId;
    }

    if(division){
      division.innerHTML = option("", "Todas", !state.division) + (data.divisionList || []).map(function(item){
        return option(item, item, state.division === item);
      }).join("");
      if(state.division && !(data.divisionList || []).some(function(x){ return x === state.division; })){
        state.division = "";
        division.value = "";
      }else{
        division.value = state.division;
      }
    }

    if(carrera){
      carrera.innerHTML = option("", "Todas", !state.career) + (data.careerList || []).map(function(item){
        return option(item, item, state.career === item);
      }).join("");
      if(state.career && !(data.careerList || []).some(function(x){ return x === state.career; })){
        state.career = "";
        carrera.value = "";
      }else{
        carrera.value = state.career;
      }
    }

    if(sede){
      sede.innerHTML = option("", "Todas", !state.sede) + (data.sedeList || []).map(function(item){
        return option(item, item, state.sede === item);
      }).join("");
      if(state.sede && !(data.sedeList || []).some(function(x){ return x === state.sede; })){
        state.sede = "";
        sede.value = "";
      }else{
        sede.value = state.sede;
      }
    }
  }
  function collectOptions(){
    return {
      periodId:state.periodId,
      division:state.division,
      career:state.career,
      status:state.status,
      sede:state.sede,
      search:state.search,
      sortKey:state.sortKey,
      sortDir:state.sortDir
    };
  }
  function tableOptions(){
    return {
      rows:(state.data && state.data.rows) || [],
      changes:state.changes,
      rowFeedback:state.rowFeedback,
      sortKey:state.sortKey,
      sortDir:state.sortDir,
      onSort:onSort,
      onInput:onNoteInput,
      onSaveRow:saveRow
    };
  }
  function render(){
    if(state.rendering){ return; }
    state.rendering = true;
    try{
      if(!window.DefartCore || typeof window.DefartCore.summary !== "function"){
        throw new Error("DefartCore no está disponible.");
      }
      if(!window.DefartTable || typeof window.DefartTable.render !== "function"){
        throw new Error("DefartTable no está disponible.");
      }

      state.data = window.DefartCore.summary(collectOptions());
      fillFilters(state.data);
      renderKpis(state.data);

      var wrap = el("def-table-wrap");
      window.DefartTable.render(wrap, tableOptions());

      if(el("def-visible-count")){
        el("def-visible-count").textContent = ((state.data.rows || []).length) + " visibles";
      }
      if(el("def-diagnostics")){
        el("def-diagnostics").textContent = JSON.stringify(state.data.diagnostics || {}, null, 2);
      }

      updatePendingMessage();
      status("", "");
    }catch(error){
      console.error("[Defensas]", error);
      status(error.message || String(error), "warn");
    }finally{
      state.rendering = false;
    }
  }
  function scheduleRender(){
    if(state.filterTimer){ clearTimeout(state.filterTimer); }
    state.filterTimer = setTimeout(function(){
      state.filterTimer = null;
      render();
    }, 160);
  }
  function getRowById(id){
    var rows = state.data && Array.isArray(state.data.rows) ? state.data.rows : [];
    return rows.find(function(row){ return row._defId === id; }) || null;
  }
  function findInput(id, field){
    return document.querySelector('.def-note-input[data-id="'+cssEscape(id)+'"][data-field="'+cssEscape(field)+'"]');
  }
  function rowInputs(id){
    return Array.prototype.slice.call(document.querySelectorAll('.def-note-input[data-id="'+cssEscape(id)+'"]'));
  }
  function originalNote(row, field){
    if(!row){ return ""; }
    return field === "nart" ? noteToText(row._nart) : noteToText(row._ndef);
  }
  function cleanEmptyChange(id){
    var patch = state.changes[id];
    if(!patch){ return; }
    var keys = Object.keys(patch).filter(function(key){ return key !== "id"; });
    if(!keys.length){ delete state.changes[id]; }
  }
  function setChange(id, field, value){
    id = text(id);
    field = text(field);
    var row = getRowById(id);
    if(!id || !field || !row){ return; }

    if(!state.changes[id]){ state.changes[id] = { id:id }; }

    if(sameNote(value, originalNote(row, field))){
      delete state.changes[id][field];
      cleanEmptyChange(id);
    }else{
      state.changes[id][field] = value;
      delete state.rowFeedback[id];
    }

    updatePendingMessage();
  }
  function validDecimals(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return true; }
    return /^\d{1,2}(\.\d{0,2})?$|^10(\.0{0,2})?$|^0(\.\d{0,2})?$/.test(raw);
  }
  function validateInput(input){
    var value = text(input && input.value);
    if(!value){
      input.classList.remove("is-invalid");
      return true;
    }
    var num = Number(value.replace(",", "."));
    var ok = Number.isFinite(num) && num >= 0 && num <= 10 && validDecimals(value);
    input.classList.toggle("is-invalid", !ok);
    if(!ok){ status("La nota debe estar entre 0 y 10 y máximo 2 decimales.", "warn"); }
    return ok;
  }
  function validateRow(id){
    var invalid = false;
    rowInputs(id).forEach(function(input){
      if(!validateInput(input)){ invalid = true; }
    });
    return !invalid;
  }
  function anyInvalidInputs(){
    var invalid = false;
    document.querySelectorAll(".def-note-input").forEach(function(input){
      if(!validateInput(input)){ invalid = true; }
    });
    return invalid;
  }
  function updateRowPreview(id){
    var row = getRowById(id);
    if(!row || !window.DefartTable || typeof window.DefartTable.updateRowPreview !== "function"){
      return;
    }
    window.DefartTable.updateRowPreview(el("def-table-wrap"), row, tableOptions());
  }
  function onNoteInput(id, field, value, input){
    if(input && !validateInput(input)){ return; }
    setChange(id, field, value);
    updateRowPreview(id);
  }
  function onSort(key){
    if(!key){ return; }
    if(state.sortKey === key){
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    }else{
      state.sortKey = key;
      state.sortDir = "asc";
    }
    render();
  }
  function changesArray(ids){
    var wanted = ids ? ids.reduce(function(map, id){ map[id] = true; return map; }, {}) : null;
    return Object.keys(state.changes).filter(function(id){ return !wanted || wanted[id]; }).map(function(id){
      return clone(state.changes[id]);
    });
  }
  function pendingCount(){ return Object.keys(state.changes).length; }
  function updatePendingMessage(){
    var total = pendingCount();
    var btn = el("def-btn-save");

    if(btn){
      btn.disabled = state.saving || total === 0;
      btn.textContent = total ? "Guardar cambios (" + total + ")" : "Guardar cambios";
    }

    if(state.saving){
      setProgress(62, "Guardando cambios...");
      saveState("Guardando...");
      return;
    }

    if(total){
      setProgress(16, total + " estudiante(s) con cambios pendientes.");
      saveState("Cambios pendientes");
    }else{
      setProgress(0, "Sin cambios pendientes.");
      saveState("Listo");
    }
  }
  function clearFeedback(ids, delay){
    ids = ids || [];
    setTimeout(function(){
      ids.forEach(function(id){ delete state.rowFeedback[id]; });
      render();
    }, delay || 1200);
  }
  function markRows(ids, stateName){
    ids.forEach(function(id){ state.rowFeedback[id] = stateName; updateRowPreview(id); });
  }
  function applySaveSuccess(ids, result, mode){
    ids.forEach(function(id){ delete state.changes[id]; state.rowFeedback[id] = "saved"; });
    setProgress(100, result.message || "Guardado correctamente.");
    status((mode === "row" ? "Fila guardada: " : "Guardado general: ") + (result.message || "Cambios guardados."), "ok");
    updatePendingMessage();
    render();
    clearFeedback(ids, 1300);
  }
  function applySaveError(ids, result){
    ids.forEach(function(id){ state.rowFeedback[id] = "error"; });
    updatePendingMessage();
    render();
    var errors = result && Array.isArray(result.errors) ? result.errors.join(" | ") : "";
    status((result && result.message ? result.message : "No se pudieron guardar todos los cambios.") + (errors ? " " + errors : ""), "warn");
  }
  function runSave(changes, ids, mode){
    if(state.saving || !changes.length){
      updatePendingMessage();
      return;
    }
    if(!window.DefartCore || typeof window.DefartCore.saveNotes !== "function"){
      status("DefartCore.saveNotes no está disponible.", "warn");
      return;
    }

    state.saving = true;
    markRows(ids, "saving");
    updatePendingMessage();

    Promise.resolve().then(function(){
      return window.DefartCore.saveNotes(changes);
    }).then(function(result){
      result = result || { ok:false, message:"Sin respuesta del guardado." };
      if(result.ok){
        applySaveSuccess(ids, result, mode);
      }else{
        applySaveError(ids, result);
      }
    }).catch(function(error){
      console.error("[Defensas Save]", error);
      applySaveError(ids, { message:error.message || String(error), errors:[] });
    }).finally(function(){
      state.saving = false;
      updatePendingMessage();
    });
  }
  function saveRow(id){
    id = text(id);
    if(!id || !state.changes[id]){ return; }
    if(!validateRow(id)){ return; }
    runSave(changesArray([id]), [id], "row");
  }
  function saveAll(){
    if(anyInvalidInputs()){ return; }
    var ids = Object.keys(state.changes);
    runSave(changesArray(), ids, "all");
  }
  function rowsWithPending(){
    var rows = (state.data && state.data.rows) || [];
    if(window.DefartTable && typeof window.DefartTable.withPending === "function"){
      return rows.map(function(row){ return window.DefartTable.withPending(row, tableOptions()); });
    }
    return rows;
  }
  function exportExcel(){
    try{
      if(!window.DefartExport || typeof window.DefartExport.exportExcel !== "function"){
        throw new Error("DefartExport no está disponible.");
      }
      var result = window.DefartExport.exportExcel(rowsWithPending(), {
        periodId:state.periodId || "TODOS",
        periodLabel:state.periodId || "TODOS",
        division:state.division || "TODAS"
      });
      status("Excel descargado: " + (result.fileName || "archivo generado"), "ok");
    }catch(error){
      console.error("[Defensas Export]", error);
      status(error.message || String(error), "warn");
    }
  }
  function clearFilters(){
    state.periodId = "";
    state.division = "";
    state.career = "";
    state.status = "";
    state.sede = "";
    state.search = "";

    if(el("def-filter-periodo")){ el("def-filter-periodo").value = ""; }
    if(el("def-filter-division")){ el("def-filter-division").value = ""; }
    if(el("def-filter-carrera")){ el("def-filter-carrera").value = ""; }
    if(el("def-filter-estado")){ el("def-filter-estado").value = ""; }
    if(el("def-filter-sede")){ el("def-filter-sede").value = ""; }
    if(el("def-filter-search")){ el("def-filter-search").value = ""; }

    render();
  }
  function bind(){
    if(el("def-filter-periodo")){
      el("def-filter-periodo").addEventListener("change", function(event){
        state.periodId = event.target.value;
        state.division = "";
        state.career = "";
        render();
      });
    }
    if(el("def-filter-division")){
      el("def-filter-division").addEventListener("change", function(event){
        state.division = event.target.value;
        state.career = "";
        render();
      });
    }
    if(el("def-filter-carrera")){
      el("def-filter-carrera").addEventListener("change", function(event){
        state.career = event.target.value;
        render();
      });
    }
    if(el("def-filter-estado")){
      el("def-filter-estado").addEventListener("change", function(event){
        state.status = event.target.value;
        render();
      });
    }
    if(el("def-filter-sede")){
      el("def-filter-sede").addEventListener("change", function(event){
        state.sede = event.target.value;
        render();
      });
    }
    if(el("def-filter-search")){
      el("def-filter-search").addEventListener("input", function(event){
        state.search = event.target.value;
        scheduleRender();
      });
    }
    if(el("def-btn-clear")){ el("def-btn-clear").addEventListener("click", clearFilters); }
    if(el("def-btn-save")){ el("def-btn-save").addEventListener("click", saveAll); }
    if(el("def-btn-export")){ el("def-btn-export").addEventListener("click", exportExcel); }

    window.addEventListener("storage", function(event){
      if(event.key === "REQ_BL_SIGNAL_V1" || event.key === "REQ_EXCEL_LOCAL_V1:snapshot"){
        render();
      }
    });
    window.addEventListener("beforeunload", function(event){
      if(pendingCount()){
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }
  function boot(){
    try{
      if(window.ExcelLocalBridge && typeof window.ExcelLocalBridge.ensureReady === "function"){
        window.ExcelLocalBridge.ensureReady();
      }
      bind();
      render();
    }catch(error){
      console.error("[Defensas Boot]", error);
      status(error.message || String(error), "warn");
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.DefartApp = {
    render:render,
    saveAll:saveAll,
    saveRow:saveRow,
    getState:function(){ return clone(state); }
  };
})(window, document);