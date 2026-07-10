/* =========================================================
Nombre completo: carga.ui.js
Ruta o ubicación: /Requisitos/Carga/carga.ui.js
Función o funciones:
- Administrar la pantalla de Carga en flujo local-first.
- Exigir período antes de subir Excel.
- Procesar archivo y guardar en BDLocal sin vista previa obligatoria.
- Guardar SOLO en BDLocal con sync:false.
- Mostrar que Firebase, Supabase y Google Sheets quedan pendientes para subida manual desde BDLocal.
Con qué se conecta:
- carga.html
- carga.css
- carga.app.js
- carga.state.js
- CargaSave
========================================================= */
(function(window, document){
  "use strict";

  var LS_PERIODO = "carga.periodoSeleccionado";
  var LS_PERIODO_LABEL = "carga.periodoSeleccionadoLabel";
  var LS_PERIODOS = "carga.periodos.local";
  var LS_SYNC = "carga.sync.estado";

  var MONTHS = [
    { value:"01", label:"Enero" },
    { value:"02", label:"Febrero" },
    { value:"03", label:"Marzo" },
    { value:"04", label:"Abril" },
    { value:"05", label:"Mayo" },
    { value:"06", label:"Junio" },
    { value:"07", label:"Julio" },
    { value:"08", label:"Agosto" },
    { value:"09", label:"Septiembre" },
    { value:"10", label:"Octubre" },
    { value:"11", label:"Noviembre" },
    { value:"12", label:"Diciembre" }
  ];

  var els = {};
  var selectedFile = null;
  var selectedPeriodId = "";
  var busy = false;
  var uiReady = false;

  function byId(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function nowISO(){ return new Date().toISOString(); }
  function show(el){ if(el){ el.classList.remove("carga-hidden"); el.hidden = false; } }
  function hide(el){ if(el){ el.classList.add("carga-hidden"); el.hidden = true; } }
  function setText(id, value){ var el = byId(id); if(el){ el.textContent = value; } }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail:detail || {} })); }catch(error){}
  }

  function storageGet(key, fallback){
    try{
      var raw = window.localStorage.getItem(key);
      if(raw == null || raw === ""){ return fallback; }
      return JSON.parse(raw);
    }catch(error){
      try{ return window.localStorage.getItem(key) || fallback; }catch(error2){ return fallback; }
    }
  }

  function storageSet(key, value){
    try{
      window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      return true;
    }catch(error){ return false; }
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function key(value){ return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g, ""); }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }

  function monthLabel(value){
    var found = MONTHS.filter(function(item){ return item.value === text(value); })[0];
    return found ? found.label : text(value);
  }

  function periodLabel(fromMonth, fromYear, toMonth, toYear){
    return monthLabel(fromMonth) + " " + text(fromYear) + " a " + monthLabel(toMonth) + " " + text(toYear);
  }

  function periodId(fromMonth, fromYear, toMonth, toYear){
    return text(fromYear) + "-" + text(fromMonth) + "__" + text(toYear) + "-" + text(toMonth);
  }

  function normalizePeriod(period){
    period = period || {};
    var id = canonicalPeriodId(period.id || period.periodoId || period.periodoCanonicoId || period.value || "");
    var label = text(period.label || period.periodoLabel || period.periodoCanonicoLabel || period.nombre || id);
    if(!id){ return null; }
    return Object.assign({}, period, {
      id:id,
      value:id,
      key:id,
      label:label,
      nombre:label,
      periodoId:id,
      periodId:id,
      periodoLabel:label,
      periodoCanonicoId:id,
      periodoCanonicoLabel:label,
      divisiones:Array.isArray(period.divisiones) ? period.divisiones : [],
      carrerasDetectadas:Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : [],
      updatedAt:period.updatedAt || nowISO()
    });
  }

  function getPeriods(){
    var raw = storageGet(LS_PERIODOS, []);
    raw = Array.isArray(raw) ? raw : [];
    var map = {};
    raw.map(normalizePeriod).filter(Boolean).forEach(function(period){ map[period.id] = period; });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.label).localeCompare(text(b.label), "es", { sensitivity:"base" });
    });
  }

  function savePeriods(periods){
    periods = Array.isArray(periods) ? periods.map(normalizePeriod).filter(Boolean) : [];
    storageSet(LS_PERIODOS, periods);
    emit("carga:periods-local-updated", { total:periods.length, at:nowISO() });
    return periods;
  }

  function mergePeriods(periods){
    var map = {};
    getPeriods().concat(Array.isArray(periods) ? periods : []).map(normalizePeriod).filter(Boolean).forEach(function(period){
      map[period.id] = Object.assign({}, map[period.id] || {}, period, { updatedAt:nowISO() });
    });
    return savePeriods(Object.keys(map).map(function(id){ return map[id]; }));
  }

  function selectedPeriod(){
    selectedPeriodId = canonicalPeriodId(selectedPeriodId || storageGet(LS_PERIODO, "") || "");
    if(!selectedPeriodId){ return null; }
    var found = getPeriods().filter(function(period){ return period.id === selectedPeriodId; })[0];
    if(found){ return found; }
    var label = text(storageGet(LS_PERIODO_LABEL, "")) || selectedPeriodId;
    return normalizePeriod({ id:selectedPeriodId, label:label });
  }

  function setSelectedPeriod(period){
    period = normalizePeriod(period);
    if(!period){
      selectedPeriodId = "";
      try{ window.localStorage.removeItem(LS_PERIODO); }catch(error){}
      try{ window.localStorage.removeItem(LS_PERIODO_LABEL); }catch(error2){}
      renderPeriodUI(getPeriods());
      return null;
    }

    selectedPeriodId = period.id;
    storageSet(LS_PERIODO, period.id);
    storageSet(LS_PERIODO_LABEL, period.label);
    emit("bl2:period-change", { periodoId:period.id, periodoLabel:period.label, source:"CargaUI", at:nowISO() });
    renderPeriodUI(getPeriods());
    renderSelectedPeriodState();
    return period;
  }

  function cacheElements(){
    els.runtimePill = byId("cargaRuntimePill");
    els.estadoPill = byId("cargaEstadoPill");
    els.periodoChip = byId("cargaPeriodoChip");
    els.periodoSelect = byId("cargaPeriodoSelect");
    els.btnPeriodoCrear = byId("cargaBtnPeriodoCrear");
    els.btnPeriodoEditar = byId("cargaBtnPeriodoEditar");
    els.btnPeriodoBorrar = byId("cargaBtnPeriodoBorrar");
    els.btnCorregirDuplicados = byId("cargaBtnCorregirDuplicados");
    els.periodoDesdeMes = byId("cargaPeriodoDesdeMes");
    els.periodoDesdeAnio = byId("cargaPeriodoDesdeAnio");
    els.periodoHastaMes = byId("cargaPeriodoHastaMes");
    els.periodoHastaAnio = byId("cargaPeriodoHastaAnio");
    els.periodoSeleccionado = byId("cargaPeriodoSeleccionado");
    els.periodosCards = byId("cargaPeriodosCards");
    els.periodoActivoChip = byId("cargaPeriodoActivoChip");
    els.subirBloqueado = byId("cargaSubirBloqueado");
    els.subirContenido = byId("cargaSubirContenido");
    els.archivoInput = byId("cargaArchivoInput");
    els.dropzone = byId("cargaDropzone");
    els.fileInfo = byId("cargaFileInfo");
    els.btnGuardar = byId("cargaBtnGuardar");
    els.btnLimpiar = byId("cargaBtnLimpiar");
    els.resultadoBox = byId("cargaResultadoBox");
    els.warnings = byId("cargaWarnings");
    els.errors = byId("cargaErrors");
    els.syncChip = byId("cargaSyncChip");
    els.syncBase = byId("cargaSyncBase");
    els.syncTexto = byId("cargaSyncTexto");
    els.syncBar = byId("cargaSyncBar");
    els.syncUltimo = byId("cargaSyncUltimo");
    els.toast = byId("cargaToast");
  }

  function fillMonthSelect(select, defaultValue){
    if(!select){ return; }
    select.innerHTML = MONTHS.map(function(item){
      return '<option value="' + item.value + '">' + item.label + '</option>';
    }).join("");
    select.value = defaultValue || select.value || "04";
  }

  function fillPeriodForm(period){
    period = normalizePeriod(period || selectedPeriod());
    if(!period){ return; }
    var match = period.id.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
    if(match){
      if(els.periodoDesdeAnio){ els.periodoDesdeAnio.value = match[1]; }
      if(els.periodoDesdeMes){ els.periodoDesdeMes.value = match[2]; }
      if(els.periodoHastaAnio){ els.periodoHastaAnio.value = match[3]; }
      if(els.periodoHastaMes){ els.periodoHastaMes.value = match[4]; }
    }
  }

  function createOrUpdatePeriod(){
    var fromMonth = text(els.periodoDesdeMes && els.periodoDesdeMes.value) || "04";
    var fromYear = text(els.periodoDesdeAnio && els.periodoDesdeAnio.value) || String(new Date().getFullYear());
    var toMonth = text(els.periodoHastaMes && els.periodoHastaMes.value) || "09";
    var toYear = text(els.periodoHastaAnio && els.periodoHastaAnio.value) || fromYear;

    if(!/^\d{4}$/.test(fromYear) || !/^\d{4}$/.test(toYear)){
      showMessage("warning", "Escribe años válidos de 4 dígitos.");
      return;
    }

    var id = periodId(fromMonth, fromYear, toMonth, toYear);
    var label = periodLabel(fromMonth, fromYear, toMonth, toYear);
    var current = getPeriods();
    var previous = current.filter(function(period){ return period.id === id; })[0] || {};
    var period = normalizePeriod(Object.assign({}, previous, { id:id, label:label, createdAt:previous.createdAt || nowISO(), updatedAt:nowISO() }));

    mergePeriods([period]);
    setSelectedPeriod(period);
    showMessage("success", "Período seleccionado: " + label + ".");
  }

  function deletePeriod(){
    var period = selectedPeriod();
    if(!period){ showMessage("warning", "No hay período seleccionado para borrar."); return; }
    if(!window.confirm("¿Borrar este período de la lista local de Carga? No borra estudiantes de BDLocal.")){ return; }
    var periods = getPeriods().filter(function(item){ return item.id !== period.id; });
    savePeriods(periods);
    setSelectedPeriod(null);
    showMessage("success", "Período eliminado de la lista local. Los estudiantes en BDLocal no se borraron.");
  }

  function fixDuplicatePeriods(){
    var before = storageGet(LS_PERIODOS, []);
    before = Array.isArray(before) ? before : [];
    var after = savePeriods(before);
    showMessage(before.length === after.length ? "warning" : "success", before.length === after.length ? "No se encontraron períodos duplicados." : "Duplicados corregidos: " + (before.length - after.length) + ".");
    renderPeriodUI(after);
  }

  function renderPeriodUI(periods){
    periods = Array.isArray(periods) ? periods : getPeriods();
    var selected = selectedPeriod();

    if(els.periodoSelect){
      els.periodoSelect.innerHTML = '<option value="">Seleccione...</option>' + periods.map(function(period){
        return '<option value="' + period.id + '">' + period.label + '</option>';
      }).join("");
      els.periodoSelect.value = selected ? selected.id : "";
    }

    if(els.periodosCards){
      if(!periods.length){
        els.periodosCards.innerHTML = '<div class="carga-empty compact">No hay períodos creados.</div>';
      }else{
        els.periodosCards.innerHTML = periods.map(function(period){
          var active = selected && selected.id === period.id;
          return '<button type="button" class="carga-period-card ' + (active ? 'is-active' : '') + '" data-period-id="' + period.id + '">' +
            '<strong>' + period.label + '</strong><small>' + period.id + '</small></button>';
        }).join("");
      }
    }

    renderSelectedPeriodState();
  }

  function renderSelectedPeriodState(){
    var period = selectedPeriod();
    var hasPeriod = !!period;

    if(els.periodoChip){
      els.periodoChip.textContent = hasPeriod ? "Período OK" : "Sin período";
      els.periodoChip.className = "carga-chip " + (hasPeriod ? "ok" : "warn");
    }
    if(els.periodoActivoChip){
      els.periodoActivoChip.textContent = hasPeriod ? period.label : "Sin período";
      els.periodoActivoChip.className = "carga-chip " + (hasPeriod ? "ok" : "warn");
    }
    if(els.periodoSeleccionado){
      els.periodoSeleccionado.textContent = hasPeriod ? (period.label + " · " + period.id) : "Ningún período seleccionado.";
    }
    if(els.subirBloqueado){ hasPeriod ? hide(els.subirBloqueado) : show(els.subirBloqueado); }
    if(els.subirContenido){ els.subirContenido.classList.toggle("is-disabled", !hasPeriod); }
    if(els.btnGuardar){ els.btnGuardar.disabled = busy || !hasPeriod || !selectedFile; }

    setText("cargaResumenPeriodo", hasPeriod ? period.label : "—");
  }

  function setStatus(type, title, message){
    if(els.estadoPill){
      els.estadoPill.textContent = title || "Listo";
      els.estadoPill.className = "carga-pill " + (type === "error" ? "carga-pill-error" : type === "warning" ? "carga-pill-warn" : type === "working" ? "carga-pill-warn" : "carga-pill-ok");
      if(message){ els.estadoPill.title = message; }
    }
  }

  function showMessage(type, message){
    if(!els.toast){
      if(type === "error"){ console.error(message); }
      else{ console.log(message); }
      return;
    }
    els.toast.className = "carga-toast is-" + (type || "success");
    els.toast.textContent = message || "";
    show(els.toast);
    window.clearTimeout(els.toast.__timer);
    els.toast.__timer = window.setTimeout(function(){ hide(els.toast); }, 4200);
  }

  function setBusy(value, message){
    busy = !!value;
    [els.btnGuardar, els.btnLimpiar, els.archivoInput, els.btnPeriodoCrear, els.btnPeriodoEditar, els.btnPeriodoBorrar].forEach(function(el){
      if(el){ el.disabled = busy; }
    });
    if(els.btnGuardar){ els.btnGuardar.disabled = busy || !selectedFile || !selectedPeriod(); }
    if(message){ setStatus("working", "Procesando", message); }
  }

  function appAvailable(){
    return !!(window.CargaApp && typeof window.CargaApp.readFile === "function" && typeof window.CargaApp.save === "function");
  }

  function state(){
    if(window.CargaState && typeof window.CargaState.get === "function"){ return window.CargaState.get(); }
    if(window.CargaApp && typeof window.CargaApp.state === "function"){ return window.CargaApp.state(); }
    return {};
  }

  function listBox(el, items, emptyText, kind){
    if(!el){ return; }
    items = Array.isArray(items) ? items : [];
    if(!items.length){
      el.innerHTML = '<div class="carga-empty">' + emptyText + '</div>';
      return;
    }
    el.innerHTML = items.slice(0, 80).map(function(item){
      var msg = text(item.mensaje || item.message || item.campo || item.tipo || item);
      return '<div class="carga-list-item ' + (kind || '') + '">' + msg + '</div>';
    }).join("");
  }

  function renderSummary(report){
    var st = state();
    var normalized = st.normalized || {};
    var rows = Array.isArray(st.rows) ? st.rows : [];
    var careers = normalized.carrerasDetectadas || {};
    var reqs = [];
    try{
      reqs = window.CargaDetectRequisitos ? window.CargaDetectRequisitos.detect(normalized.rowsMapeadas || rows).filter(function(item){ return item.detected; }) : [];
    }catch(error){ reqs = []; }

    setText("cargaResumenArchivo", st.fileName || (selectedFile && selectedFile.name) || "—");
    setText("cargaResumenFilas", String(rows.length || (normalized.total || 0)));
    setText("cargaResumenCarreras", String(Object.keys(careers || {}).length));
    setText("cargaResumenRequisitos", String(reqs.length));

    listBox(els.warnings, st.warnings || [], "Sin advertencias.", "warning");
    listBox(els.errors, st.errors || [], "Sin errores.", "error");

    if(report){
      show(els.resultadoBox);
      setText("cargaResultTotal", String(num(report.total || report.totalEntrada)));
      setText("cargaResultGuardados", String(num(report.guardados || report.saved)));
      setText("cargaResultActualizados", String(num(report.actualizados || report.updated)));
      setText("cargaResultDuplicados", String(num(report.duplicados || report.merged)));
      setText("cargaResultAdvertencias", String((Array.isArray(report.advertencias || report.warnings) ? (report.advertencias || report.warnings).length : num(report.advertencias || report.warnings))));
    }
  }

  function updateSyncState(data){
    data = Object.assign({ base:"BDLocal", percent:0, pending:0, message:"En espera", ultimo:"sin actividad" }, data || {});
    storageSet(LS_SYNC, data);
    renderSync(data);
  }

  function renderSync(data){
    data = data || storageGet(LS_SYNC, { base:"BDLocal", percent:0, pending:0, message:"En espera", ultimo:"sin actividad" });
    var percent = Math.max(0, Math.min(100, num(data.percent)));
    if(els.syncBase){ els.syncBase.textContent = text(data.base || "BDLocal"); }
    if(els.syncTexto){ els.syncTexto.textContent = percent + "% · Cambios para nubes " + num(data.pending) + " · " + text(data.message || "En espera"); }
    if(els.syncBar){ els.syncBar.style.width = percent + "%"; }
    if(els.syncUltimo){ els.syncUltimo.textContent = "Último resultado: " + text(data.ultimo || "sin actividad"); }
    if(els.syncChip){
      els.syncChip.textContent = percent >= 100 ? "BDLocal OK" : "BDLocal";
      els.syncChip.className = "carga-chip " + (percent >= 100 ? "ok" : "warn");
    }
  }

  function processFile(file){
    var period = selectedPeriod();
    if(!period){
      showMessage("warning", "Primero selecciona o crea un período.");
      return Promise.reject(new Error("Sin período seleccionado."));
    }
    if(!appAvailable()){
      showMessage("error", "CargaApp no está disponible. Revisa el orden de scripts.");
      return Promise.reject(new Error("CargaApp no disponible."));
    }

    setBusy(true, "Leyendo archivo");
    updateSyncState({ base:"BDLocal", percent:10, pending:0, message:"Leyendo archivo", ultimo:"procesando" });

    return window.CargaApp.readFile(file, {
      periodoId:period.id,
      periodoLabel:period.label,
      periodoCanonicoId:period.id,
      periodoCanonicoLabel:period.label,
      localOnly:true,
      sync:false
    }).then(function(payload){
      renderSummary();
      updatePeriodCareers(period.id);
      updateSyncState({ base:"BDLocal", percent:45, pending:0, message:"Archivo validado", ultimo:"listo para guardar" });
      setStatus("ok", "Archivo leído", "Listo para guardar en BDLocal.");
      return payload;
    }).catch(function(error){
      renderSummary();
      setStatus("error", "Error al leer", error.message || String(error));
      showMessage("error", "No se pudo leer el archivo: " + (error.message || String(error)));
      throw error;
    }).finally(function(){
      setBusy(false);
      renderSelectedPeriodState();
    });
  }

  function updatePeriodCareers(periodId){
    try{
      var st = state();
      var detected = st.normalized && st.normalized.carrerasDetectadas ? st.normalized.carrerasDetectadas : {};
      var careers = Object.keys(detected).map(function(name){ return { id:key(name), nombre:name, total:detected[name] }; });
      var periods = getPeriods().map(function(period){
        if(period.id !== periodId){ return period; }
        return Object.assign({}, period, { carrerasDetectadas:careers, totalUltimaCarga:(st.rows || []).length, updatedAt:nowISO() });
      });
      savePeriods(periods);
    }catch(error){}
  }

  function saveCarga(){
    if(!appAvailable()){
      showMessage("error", "CargaApp no está disponible. No se puede guardar.");
      return Promise.reject(new Error("CargaApp no disponible."));
    }
    var st = state();
    if(!st.normalized || !Array.isArray(st.rows) || !st.rows.length){
      showMessage("warning", "Primero selecciona un archivo.");
      return Promise.resolve(null);
    }
    if(Array.isArray(st.errors) && st.errors.length){
      showMessage("error", "No se puede guardar porque existen errores en la carga.");
      return Promise.resolve(null);
    }

    setBusy(true, "Guardando en BDLocal");
    updateSyncState({ base:"BDLocal", percent:70, pending:0, message:"Guardando local", ultimo:"procesando" });

    return window.CargaApp.save({
      sync:false,
      localOnly:true,
      cloudSync:false,
      manualCloudSync:true,
      source:"CargaUI.localOnly"
    }).then(function(report){
      report = report || {};
      renderSummary(report);
      if(report.ok !== false){
        var pending = num(report.changes || report.pendientes || report.pending || report.total || 0);
        showMessage("success", "Carga guardada en BDLocal. Firebase, Supabase y Google Sheets quedan pendientes para subir manualmente desde BDLocal.");
        setStatus("ok", "Guardado local", "BDLocal actualizado. Nubes pendientes.");
        updateSyncState({ base:"BDLocal", percent:100, pending:pending, message:"Nubes pendientes desde BDLocal", ultimo:"guardado local correcto" });
        emit("carga:local-save-only", { ok:true, report:report, at:nowISO() });
      }else{
        showMessage("warning", report.message || "La carga terminó con observaciones.");
        setStatus("warning", "Revisar resultado", report.message || "Observaciones en la carga.");
      }
      return report;
    }).catch(function(error){
      var message = error && error.message ? error.message : "No se pudo guardar la carga.";
      renderSummary();
      setStatus("error", "Error al guardar", message);
      showMessage("error", message);
      throw error;
    }).finally(function(){
      setBusy(false);
      renderSelectedPeriodState();
    });
  }

  function uploadAndSave(){
    if(!selectedFile){ showMessage("warning", "Selecciona un archivo antes de subir."); return; }
    processFile(selectedFile).then(function(){ return saveCarga(); }).catch(function(error){
      if(error && error.message === "Sin período seleccionado."){ return; }
    });
  }

  function processClipboard(value){
    var period = selectedPeriod();
    if(!period){ return Promise.reject(new Error("Sin período seleccionado.")); }
    if(!window.CargaApp || typeof window.CargaApp.readClipboard !== "function"){
      return Promise.reject(new Error("CargaApp.readClipboard no disponible."));
    }
    return window.CargaApp.readClipboard(value || "", {
      periodoId:period.id,
      periodoLabel:period.label,
      localOnly:true,
      sync:false
    }).then(function(payload){ renderSummary(); return payload; });
  }

  function clearScreen(){
    try{ if(window.CargaState && typeof window.CargaState.reset === "function"){ window.CargaState.reset(); } }catch(error){}
    selectedFile = null;
    if(els.archivoInput){ els.archivoInput.value = ""; }
    if(els.fileInfo){ els.fileInfo.textContent = "Ningún archivo seleccionado."; }
    hide(els.resultadoBox);
    setText("cargaResumenArchivo", "—");
    setText("cargaResumenFilas", "0");
    setText("cargaResumenCarreras", "0");
    setText("cargaResumenRequisitos", "0");
    listBox(els.warnings, [], "Sin advertencias.");
    listBox(els.errors, [], "Sin errores.");
    updateSyncState({ base:"BDLocal", percent:0, pending:0, message:"En espera", ultimo:"sin actividad" });
    renderSelectedPeriodState();
  }

  function openDivisions(){
    var period = selectedPeriod();
    if(!period){ showMessage("warning", "Primero selecciona un período."); return; }
    if(window.CargaDivisionesPopup && typeof window.CargaDivisionesPopup.open === "function"){
      window.CargaDivisionesPopup.open(period);
    }else{
      showMessage("warning", "El popup de divisiones no está disponible.");
    }
  }

  function handleFileChange(){
    var file = els.archivoInput && els.archivoInput.files && els.archivoInput.files[0] ? els.archivoInput.files[0] : null;
    selectedFile = file;
    if(els.fileInfo){ els.fileInfo.textContent = file ? (file.name + " · " + Math.round((file.size || 0) / 1024) + " KB") : "Ningún archivo seleccionado."; }
    renderSelectedPeriodState();
  }

  function bindEvents(){
    if(els.periodoSelect){
      els.periodoSelect.addEventListener("change", function(){
        var id = canonicalPeriodId(els.periodoSelect.value || "");
        var period = getPeriods().filter(function(item){ return item.id === id; })[0];
        setSelectedPeriod(period || null);
        fillPeriodForm(period);
      });
    }

    if(els.periodosCards){
      els.periodosCards.addEventListener("click", function(event){
        var btn = event.target.closest("[data-period-id]");
        if(!btn){ return; }
        var period = getPeriods().filter(function(item){ return item.id === btn.getAttribute("data-period-id"); })[0];
        setSelectedPeriod(period);
        fillPeriodForm(period);
      });
    }

    if(els.btnPeriodoCrear){ els.btnPeriodoCrear.addEventListener("click", createOrUpdatePeriod); }
    if(els.btnPeriodoEditar){ els.btnPeriodoEditar.addEventListener("click", function(){ fillPeriodForm(selectedPeriod()); }); }
    if(els.btnPeriodoBorrar){ els.btnPeriodoBorrar.addEventListener("click", deletePeriod); }
    if(els.btnCorregirDuplicados){ els.btnCorregirDuplicados.addEventListener("click", fixDuplicatePeriods); }
    if(els.archivoInput){ els.archivoInput.addEventListener("change", handleFileChange); }
    if(els.btnGuardar){ els.btnGuardar.addEventListener("click", uploadAndSave); }
    if(els.btnLimpiar){ els.btnLimpiar.addEventListener("click", clearScreen); }

    ["dragenter", "dragover"].forEach(function(name){
      if(els.dropzone){ els.dropzone.addEventListener(name, function(event){ event.preventDefault(); els.dropzone.classList.add("is-over"); }); }
    });
    ["dragleave", "drop"].forEach(function(name){
      if(els.dropzone){ els.dropzone.addEventListener(name, function(event){ event.preventDefault(); els.dropzone.classList.remove("is-over"); }); }
    });
    if(els.dropzone){
      els.dropzone.addEventListener("drop", function(event){
        var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0] ? event.dataTransfer.files[0] : null;
        if(!file){ return; }
        selectedFile = file;
        if(els.fileInfo){ els.fileInfo.textContent = file.name + " · " + Math.round((file.size || 0) / 1024) + " KB"; }
        renderSelectedPeriodState();
      });
    }

    window.addEventListener("carga:processed", function(){ renderSummary(); });
    window.addEventListener("carga:saved", function(event){ renderSummary(event.detail || null); });
    window.addEventListener("bdlocal:cloud-pending", function(event){
      var detail = event.detail || {};
      updateSyncState({ base:"BDLocal", percent:100, pending:num(detail.total), message:"Nubes pendientes desde BDLocal", ultimo:"guardado local correcto" });
    });
  }

  function loadPeriods(){
    var con = window.ConCarga || window.BDLocalCarga;
    if(con && typeof con.getPeriods === "function"){
      return con.getPeriods().then(function(periods){ return mergePeriods(periods || []); }).catch(function(){ return getPeriods(); });
    }
    if(window.BL2Core && typeof window.BL2Core.getPeriods === "function"){
      return window.BL2Core.getPeriods().then(function(periods){ return mergePeriods(periods || []); }).catch(function(){ return getPeriods(); });
    }
    return Promise.resolve(getPeriods());
  }

  function renderAll(report){
    renderPeriodUI(getPeriods());
    renderSummary(report || null);
    renderSync();
  }

  function getSelectedPeriod(){ return selectedPeriod(); }

  function boot(){
    if(uiReady){ return; }
    uiReady = true;
    cacheElements();
    if(els.runtimePill){ els.runtimePill.textContent = window.electronAPI ? "Electron" : "Navegador"; }
    fillMonthSelect(els.periodoDesdeMes, "04");
    fillMonthSelect(els.periodoHastaMes, "09");
    var year = new Date().getFullYear();
    if(els.periodoDesdeAnio && !els.periodoDesdeAnio.value){ els.periodoDesdeAnio.value = year; }
    if(els.periodoHastaAnio && !els.periodoHastaAnio.value){ els.periodoHastaAnio.value = year; }
    selectedPeriodId = canonicalPeriodId(storageGet(LS_PERIODO, "") || "");
    bindEvents();
    renderSync();

    loadPeriods().then(function(periods){
      renderPeriodUI(periods);
      fillPeriodForm(selectedPeriod());
      clearScreen();
      if(!appAvailable()){
        setStatus("error", "Carga incompleta", "No se encontró CargaApp.");
        showMessage("error", "La interfaz cargó, pero CargaApp no está disponible. Revisa rutas y orden de scripts en carga.html.");
        return;
      }
      setStatus("ok", "Listo", "Selecciona un período y sube el Excel oficial.");
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }

  window.CargaUI = {
    boot:boot,
    renderAll:renderAll,
    clearScreen:clearScreen,
    getSelectedPeriod:getSelectedPeriod,
    processFile:processFile,
    processClipboard:processClipboard,
    saveCarga:saveCarga,
    openDivisions:openDivisions,
    renderSync:renderSync
  };
})(window, document);