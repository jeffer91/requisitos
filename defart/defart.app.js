/* =========================================================
Nombre completo: defart.app.js
Ruta o ubicación: /Requisitos/defart/defart.app.js
Función o funciones:
- Renderizar tabla inteligente de Defensas.
- Manejar filtros por período, división, carrera, estado, sede y búsqueda.
- Editar N-ART y N-DEF directamente en tabla.
- Aplicar estados finales: Falta requisitos, Supletorio Art, Supletorio Def, Aprobado.
- Bloquear N-ART si faltan requisitos y N-DEF si N-ART es menor a 7.
- Mostrar cálculo N-FIN en vivo antes de guardar.
- Guardado automático y botón Guardar todo.
- Descargar Excel visible.
Con qué se conecta:
- defart.core.js
- defart.export.js
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
    autoTimer:null,
    filterTimer:null,
    rendering:false,
    saving:false
  };

  var HEADERS = [
    {key:"_cedula", label:"Cédula", className:"col-cedula"},
    {key:"_nombre", label:"Nombre", className:"col-nombre"},
    {key:"_carrera", label:"Carrera", className:"col-carrera"},
    {key:"_division", label:"División", className:"col-carrera"},
    {key:"_nart", label:"N-ART", className:"col-nota"},
    {key:"_ndef", label:"N-DEF", className:"col-nota"},
    {key:"_nfin", label:"N-FIN", className:"col-nota"}
  ];

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }

  function status(message, type){
    var box = el("def-status");
    if(box){
      box.textContent = message;
      box.className = "def-status " + (type || "");
    }
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

  function noteText(value){
    return window.DefartCore && typeof window.DefartCore.noteToText === "function" ? window.DefartCore.noteToText(value) : (value == null ? "" : String(value));
  }

  function option(value, label, selected){
    return '<option value="' + esc(value) + '" ' + (selected ? "selected" : "") + '>' + esc(label) + '</option>';
  }

  function fillFilters(data){
    data = data || {};
    var periodo = el("def-filter-periodo");
    var division = el("def-filter-division");
    var carrera = el("def-filter-carrera");
    var sede = el("def-filter-sede");
    var estado = el("def-filter-estado");

    if(periodo){
      periodo.innerHTML = option("", "Todos", !state.periodId) + (data.periodList || []).map(function(item){
        return option(item.id, item.label || item.id, state.periodId === item.id);
      }).join("");
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

    if(estado){
      var states = data.states || ["Falta requisitos", "Supletorio Art", "Supletorio Def", "Aprobado"];
      estado.innerHTML = option("", "Todos", !state.status) + states.map(function(item){
        return option(item, item, state.status === item);
      }).join("");
      estado.value = state.status;
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

  function kpi(id, value){
    var box = el(id);
    if(box){ box.textContent = value || 0; }
  }

  function renderKpis(data){
    var k = data.kpis || {};
    kpi("def-kpi-total", k.total);
    kpi("def-kpi-sin-req", k["Falta requisitos"] || k["Sin requisitos"]);
    kpi("def-kpi-pend-art", 0);
    kpi("def-kpi-sup-art", k["Supletorio Art"]);
    kpi("def-kpi-pend-def", 0);
    kpi("def-kpi-sup-def", k["Supletorio Def"]);
    kpi("def-kpi-completo", k["Aprobado"] || k["Completo"]);
  }

  function stateClass(row){
    var value = row && row._estadoDefensa;
    if(value === "Aprobado" || value === "Completo"){ return "estado-completo"; }
    if(value === "Falta requisitos" || value === "Sin requisitos"){ return "estado-sin-requisitos"; }
    if(value === "Supletorio Art" || value === "Supletorio Def"){ return "estado-supletorio"; }
    return "estado-pendiente";
  }

  function statePill(row){
    return '<span class="def-pill ' + stateClass(row) + '">' + esc(row._estadoDefensa) + '</span>';
  }

  function pendingPatch(id){ return state.changes[id] ? clone(state.changes[id]) : null; }

  function withPending(row){
    var patch = pendingPatch(row._defId);
    if(patch && window.DefartCore && typeof window.DefartCore.preview === "function"){
      return window.DefartCore.preview(row, patch);
    }
    return row;
  }

  function blockTitle(row, isArt){
    if(!row._canArt){ return "Bloqueado: faltan requisitos."; }
    if(!isArt && !row._canDef){ return "Bloqueado: N-ART debe ser 7 o más."; }
    return "";
  }

  function inputHtml(row, field){
    var shown = withPending(row);
    var isArt = field === "nart";
    var value = isArt ? shown._nart : shown._ndef;
    var enabled = isArt ? shown._canArt : shown._canDef;
    var title = enabled ? "" : blockTitle(shown, isArt);
    return '<input class="def-note-input" type="number" min="0" max="10" step="0.01" inputmode="decimal" data-id="' + esc(row._defId) + '" data-field="' + field + '" value="' + esc(noteText(value)) + '" ' + (enabled ? "" : "disabled") + ' title="' + esc(title) + '" />';
  }

  function sortIcon(key){
    if(state.sortKey !== key){ return ""; }
    return state.sortDir === "asc" ? " ▲" : " ▼";
  }

  function cellFor(row, header){
    if(header.key === "_nart"){ return inputHtml(row, "nart"); }
    if(header.key === "_ndef"){ return inputHtml(row, "ndef"); }
    if(header.key === "_nfin"){ return '<strong class="def-nfin-value">' + esc(noteText(withPending(row)._nfin)) + '</strong>'; }
    return esc(withPending(row)[header.key] || "");
  }

  function tableHtml(rows){
    if(!rows || !rows.length){ return '<div class="def-empty">Sin estudiantes con los filtros seleccionados.</div>'; }
    var head = '<table class="def-table"><thead><tr>' + HEADERS.map(function(header){
      return '<th class="' + esc(header.className || "") + '" data-sort="' + esc(header.key) + '">' + esc(header.label) + sortIcon(header.key) + '</th>';
    }).join("") + '<th data-sort="_estadoDefensa">Estado' + sortIcon("_estadoDefensa") + '</th></tr></thead><tbody>';

    var body = rows.map(function(original){
      var row = withPending(original);
      var pending = !!state.changes[original._defId];
      return '<tr class="' + esc(stateClass(row)) + (pending ? ' is-pending' : '') + '" data-id="' + esc(original._defId) + '">' +
        HEADERS.map(function(header){ return '<td class="' + esc(header.className || "") + '">' + cellFor(original, header) + '</td>'; }).join("") +
        '<td class="col-estado">' + statePill(row) + '</td></tr>';
    }).join("");
    return head + body + '</tbody></table>';
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

  function render(){
    if(state.rendering || state.saving){ return; }
    state.rendering = true;
    try{
      state.data = window.DefartCore.summary(collectOptions());
      fillFilters(state.data);
      renderKpis(state.data);
      var wrap = el("def-table-wrap");
      if(wrap){ wrap.innerHTML = tableHtml(state.data.rows || []); }
      if(el("def-visible-count")){ el("def-visible-count").textContent = (state.data.rows || []).length + " visibles"; }
      if(el("def-diagnostics")){ el("def-diagnostics").textContent = JSON.stringify(state.data.diagnostics || {}, null, 2); }
      bindTableEvents();
      updatePendingMessage();
      status("Defensas cargado correctamente desde BaseLocal. Estado: " + (state.status || "Todos") + ".", "ok");
    }catch(error){
      console.error("[Defensas]", error);
      status(error.message || String(error), "warn");
    }finally{
      state.rendering = false;
    }
  }

  function scheduleFilterRender(){
    if(state.filterTimer){ clearTimeout(state.filterTimer); }
    state.filterTimer = setTimeout(render, 180);
  }

  function getRowById(id){
    var rows = state.data && Array.isArray(state.data.rows) ? state.data.rows : [];
    return rows.find(function(row){ return row._defId === id; }) || null;
  }

  function findInput(id, field){
    var found = null;
    document.querySelectorAll(".def-note-input").forEach(function(input){
      if(input.getAttribute("data-id") === id && input.getAttribute("data-field") === field){ found = input; }
    });
    return found;
  }

  function setChange(id, field, value){
    if(!state.changes[id]){ state.changes[id] = {id:id}; }
    state.changes[id][field] = value;
    updatePendingMessage();
  }

  function updatePendingMessage(){
    var total = Object.keys(state.changes).length;
    var btn = el("def-btn-save");
    if(btn){ btn.disabled = state.saving; }
    if(total){
      setProgress(state.saving ? 60 : 12, total + " estudiante(s) con cambios pendientes.");
      saveState(state.saving ? "Guardando..." : "Cambios pendientes");
    }else{
      setProgress(state.saving ? 60 : 0, state.saving ? "Guardando..." : "Sin cambios pendientes.");
      saveState(state.saving ? "Guardando..." : "Listo");
    }
  }

  function validDecimals(value){
    var raw = text(value).replace(",", ".");
    if(!raw){ return true; }
    return /^\d{1,2}(\.\d{0,2})?$|^10(\.0{0,2})?$|^0(\.\d{0,2})?$/.test(raw);
  }

  function validateInput(input){
    var value = text(input.value);
    if(!value){ input.classList.remove("is-invalid"); return true; }
    var num = Number(value.replace(",", "."));
    var ok = Number.isFinite(num) && num >= 0 && num <= 10 && validDecimals(value);
    input.classList.toggle("is-invalid", !ok);
    if(!ok){ status("La nota debe estar entre 0 y 10 y máximo 2 decimales.", "warn"); }
    return ok;
  }

  function rowPatchFromInputs(id){
    var patch = {id:id};
    var nart = findInput(id, "nart");
    var ndef = findInput(id, "ndef");
    if(nart){ patch.nart = nart.value; }
    if(ndef){ patch.ndef = ndef.value; }
    return patch;
  }

  function updateRowPreview(id){
    var original = getRowById(id);
    if(!original || !window.DefartCore || typeof window.DefartCore.preview !== "function"){ return; }
    var preview = window.DefartCore.preview(original, rowPatchFromInputs(id));
    var rowEl = null;
    document.querySelectorAll('#def-table-wrap tr[data-id]').forEach(function(tr){
      if(tr.getAttribute('data-id') === id){ rowEl = tr; }
    });
    if(!rowEl){ return; }
    rowEl.className = stateClass(preview) + " is-pending";
    var nfin = rowEl.querySelector(".def-nfin-value");
    if(nfin){ nfin.textContent = noteText(preview._nfin); }
    var estado = rowEl.querySelector(".col-estado");
    if(estado){ estado.innerHTML = statePill(preview); }
    var ndefInput = findInput(id, "ndef");
    if(ndefInput){
      ndefInput.disabled = !preview._canDef;
      ndefInput.title = preview._canDef ? "" : blockTitle(preview, false);
    }
  }

  function anyInvalidInputs(){
    var invalid = false;
    document.querySelectorAll(".def-note-input").forEach(function(input){
      if(!validateInput(input)){ invalid = true; }
    });
    return invalid;
  }

  function onNoteInput(input){
    if(!validateInput(input)){ return; }
    var id = input.getAttribute("data-id");
    var field = input.getAttribute("data-field");
    setChange(id, field, input.value);
    updateRowPreview(id);
    scheduleAutoSave();
  }

  function focusNextInput(input){
    var inputs = Array.prototype.slice.call(document.querySelectorAll(".def-note-input:not(:disabled)"));
    var index = inputs.indexOf(input);
    if(index >= 0 && inputs[index + 1]){
      inputs[index + 1].focus();
      inputs[index + 1].select();
      return true;
    }
    return false;
  }

  function bindTableEvents(){
    document.querySelectorAll("#def-table-wrap th[data-sort]").forEach(function(th){
      th.addEventListener("click", function(){
        var key = th.getAttribute("data-sort");
        if(state.sortKey === key){ state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; }
        else{ state.sortKey = key; state.sortDir = "asc"; }
        render();
      });
    });
    document.querySelectorAll(".def-note-input").forEach(function(input){
      input.addEventListener("input", function(){ onNoteInput(input); });
      input.addEventListener("change", function(){ onNoteInput(input); });
      input.addEventListener("keydown", function(event){
        if(event.key === "Enter"){
          event.preventDefault();
          onNoteInput(input);
          focusNextInput(input);
        }
      });
    });
  }

  function changesArray(){ return Object.keys(state.changes).map(function(key){ return state.changes[key]; }); }
  function clearChanges(){ state.changes = {}; updatePendingMessage(); }

  function scheduleAutoSave(){
    if(state.autoTimer){ clearTimeout(state.autoTimer); }
    state.autoTimer = setTimeout(function(){ saveAll("auto"); }, 2200);
  }

  function saveAll(mode){
    if(state.saving){ return; }
    if(anyInvalidInputs()){ return; }
    var changes = changesArray();
    if(!changes.length){ updatePendingMessage(); return; }
    state.saving = true;
    setProgress(60, "Guardando cambios...");
    saveState("Guardando...");
    try{
      var result = window.DefartCore.saveNotes(changes);
      if(result.ok){
        clearChanges();
        setProgress(100, result.message || "Guardado.");
        status((mode === "auto" ? "Autoguardado: " : "") + result.message, "ok");
        setTimeout(function(){ setProgress(0, "Sin cambios pendientes."); }, 900);
        render();
      }else{
        status((result.message || "Guardado parcial") + " Errores: " + (result.errors || []).join(" | "), "warn");
      }
    }catch(error){
      console.error("[Defensas Save]", error);
      status(error.message || String(error), "warn");
    }finally{
      state.saving = false;
      updatePendingMessage();
    }
  }

  function exportExcel(){
    try{
      var rows = ((state.data && state.data.rows) || []).map(withPending);
      var result = window.DefartExport.exportExcel(rows, {periodId:state.periodId || "TODOS", periodLabel:state.periodId || "TODOS", division:state.division || "TODAS"});
      status("Excel descargado: " + result.fileName, "ok");
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
        scheduleFilterRender();
      });
    }
    if(el("def-btn-clear")){ el("def-btn-clear").addEventListener("click", clearFilters); }
    if(el("def-btn-refresh")){ el("def-btn-refresh").addEventListener("click", render); }
    if(el("def-btn-export")){ el("def-btn-export").addEventListener("click", exportExcel); }
    if(el("def-btn-save")){ el("def-btn-save").addEventListener("click", function(){ saveAll("manual"); }); }
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

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window, document);
