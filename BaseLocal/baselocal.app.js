/* =========================================================
Nombre completo: baselocal.app.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.app.js
Función o funciones:
- Renderizar la pantalla Base Local como panel liviano.
- Mostrar períodos, estudiantes, historial y diagnóstico local solo cuando corresponda.
- Aplicar filtro por estado de matrícula: ACTIVO, RETIRADO o todos.
- Aplicar filtro por división.
- Permitir sincronización manual, bajada manual desde Firebase, limpieza de base y borrado seguro de período.
- Mantener la sincronización automática pausada por defecto para acelerar la pantalla.
- Evitar doble sincronización diaria cuando Maqueta ya controla Firebase en segundo plano.
- Evitar pantalla blanca por eventos repetidos durante la sincronización.
- Renderizar solo la pestaña activa y paginar estudiantes.
Con qué se conecta:
- services/bl-campos.js
- services/bl-normalizador.js
- services/bl-filtros.js
- services/bl-limpiar-base.service.js
- services/bl-borrar-periodo.service.js
- ../BaseLocal2/repositories/bl2-dashboard.repo.js
- baselocal.core.js
- baselocal.firebase.js
- baselocal.connector.js
- baselocal.limpiar.js
- baselocal.borrar-periodo.js
- baselocal.manual.js
========================================================= */
(function(window,document){
  "use strict";

  var AUTO_SYNC_KEY = "REQ_BL_AUTO_SYNC_ENABLED_V1";
  var state = {tab:"periodos",periodId:"",divisionFilter:"",search:"",statusFilter:"ACTIVO",loading:false,dailyStarted:false,renderPending:false,renderTimer:null,lastRenderError:null,lastView:null,studentPage:1,studentPageSize:100,lastDashboard:null};

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
  function autoSyncAllowed(){try{return window.localStorage.getItem(AUTO_SYNC_KEY)==="true";}catch(error){return false;}}

  function getField(row, canonicalName, fallback){
    try{if(window.BLCampos && typeof window.BLCampos.getValue === "function"){var value = window.BLCampos.getValue(row || {}, canonicalName, fallback || "");return value == null || text(value) === "" ? (fallback || "") : value;}}catch(error){}
    return fallback || "";
  }

  function divisionOf(row){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function") return window.BLDivisionesService.studentDivision(row);
    var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];
    return list[0] || row.division || "Sin división";
  }

  function status(message, className){var box = el("bl-status");if(box){box.textContent = message;box.className = "bl-status " + (className || "bl-status-info");}}
  function safeCall(label, fn, fallback){try{return typeof fn === "function" ? fn() : fallback;}catch(error){console.warn("[BaseLocal " + label + "]", error);state.lastRenderError = error && error.message ? error.message : String(error);return fallback;}}
  function dashboard(deep){
    return safeCall("BL2DashboardRepo.summary", function(){return window.BL2DashboardRepo && typeof window.BL2DashboardRepo.summary === "function" ? window.BL2DashboardRepo.summary({periodId:state.periodId, deep:!!deep}) : null;}, null);
  }
  function invalidateCaches(){
    if(window.BL2DashboardRepo && typeof window.BL2DashboardRepo.invalidate === "function"){window.BL2DashboardRepo.invalidate();}
    if(window.BaseLocalAPI && typeof window.BaseLocalAPI.clearSnapshotCache === "function"){window.BaseLocalAPI.clearSnapshotCache();}
  }

  function setBusy(isBusy, message, mode){
    state.loading = !!isBusy;
    var pullBtn = el("bl-btn-pull-firebase");
    var syncBtn = el("bl-btn-sync-now");
    var cleanBtn = el("bl-btn-clean-base");
    var deleteBtn = el("bl-btn-delete-period");
    if(pullBtn){pullBtn.disabled = !!isBusy;pullBtn.textContent = isBusy && mode === "pull" ? "Bajando..." : "Solo bajar Firebase";}
    if(syncBtn){syncBtn.disabled = !!isBusy;syncBtn.textContent = isBusy && mode === "sync" ? "Sincronizando..." : "Sincronizar ahora";}
    if(cleanBtn){cleanBtn.disabled = !!isBusy;cleanBtn.textContent = isBusy && mode === "clean" ? "Limpiando..." : "Limpiar base";}
    if(deleteBtn){deleteBtn.disabled = !!isBusy;deleteBtn.textContent = isBusy && mode === "delete" ? "Borrando..." : "Borrar período";}
    if(message){status(message, "bl-status-info");}
  }

  function table(headers, rows){
    if(!rows || !rows.length){return '<p class="bl-help">Sin datos todavía. Primero analiza un Excel en Carga, baja datos desde Firebase o sincroniza Base Local.</p>';}
    var head = '<table><thead><tr>' + headers.map(function(header){return '<th>' + esc(header.label) + '</th>';}).join("") + '</tr></thead><tbody>';
    head += rows.map(function(row){return '<tr>' + headers.map(function(header){var value = typeof header.value === "function" ? header.value(row) : row[header.key];return '<td>' + esc(value) + '</td>';}).join("") + '</tr>';}).join("");
    return head + '</tbody></table>';
  }
  var REQ_COLUMNS = [
    {key:"academico", label:"Académico"},
    {key:"documentacion", label:"Documentación"},
    {key:"financiero", label:"Financiero"},
    {key:"practicasvinculacion", label:"Prácticas"},
    {key:"vinculacion", label:"Vinculación"},
    {key:"seguimientograduados", label:"Seguimiento"},
    {key:"ingles", label:"Inglés"},
    {key:"actualizaciondatos", label:"Actualización"},
    {key:"titulacion", label:"Titulación"},
    {key:"aprobaciontitulacion", label:"Aprob. titulación"},
    {key:"aprobacioncomplexivoproyecto", label:"Aprob. complexivo"}
  ];

  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function compact(value){
    return norm(value).replace(/[^a-z0-9]/g, "");
  }

  function pickLoose(row, aliases, fallback){
    row = row || {};
    aliases = aliases || [];

    var keys = Object.keys(row);
    var wanted = aliases.map(compact);

    for(var i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){
        return row[aliases[i]];
      }
    }

    for(var j = 0; j < keys.length; j += 1){
      if(wanted.indexOf(compact(keys[j])) >= 0 && row[keys[j]] != null && text(row[keys[j]]) !== ""){
        return row[keys[j]];
      }
    }

    return fallback || "";
  }

  function reqValue(row, key){
    try{
      if(window.BL2RequirementsEngine && typeof window.BL2RequirementsEngine.valueOf === "function"){
        var rv = window.BL2RequirementsEngine.valueOf(row || {}, key);
        if(text(rv) !== ""){
          return rv;
        }
      }
    }catch(error){}

    try{
      if(window.BL2RequisitosRepo && typeof window.BL2RequisitosRepo.field === "function"){
        var bv = window.BL2RequisitosRepo.field(row || {}, key, "");
        if(text(bv) !== ""){
          return bv;
        }
      }
    }catch(error){}

    try{
      if(window.BL2StudentNormalizer && typeof window.BL2StudentNormalizer.value === "function"){
        var nv = window.BL2StudentNormalizer.value(row || {}, key);
        if(text(nv) !== ""){
          return nv;
        }
      }
    }catch(error){}

    try{
      if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
        var cv = window.BLCampos.getValue(row || {}, key, "");
        if(text(cv) !== ""){
          return cv;
        }
      }
    }catch(error){}

    return pickLoose(row, [key], "");
  }

  function reqEstado(value){
    try{
      if(window.BL2RequirementsEngine && typeof window.BL2RequirementsEngine.cellStatus === "function"){
        return window.BL2RequirementsEngine.cellStatus(value);
      }
    }catch(error){}

    var k = norm(value);
    return ["cumple","si","sí","s","ok","aprobado","aprobada","1","true","x","validado","validada","completo","completa"].indexOf(k) >= 0 ? "cumple" : "no_cumple";
  }

  function reqBadge(row, key){
    var value = reqValue(row, key);
    var ok = reqEstado(value) === "cumple";

    return '<span class="bl-req-mini ' + (ok ? 'bl-req-ok' : 'bl-req-bad') + '" title="' + esc(value || 'VACÍO') + '">' + (ok ? 'CUMPLE' : 'NO CUMPLE') + '</span>';
  }

  function renderStudentJson(row){
    var clean = Object.assign({}, row || {});
    return JSON.stringify(clean, null, 2);
  }

  function bindStudentInspectButtons(rows){
    rows = rows || [];

    document.querySelectorAll("[data-bl-student-json]").forEach(function(button){
      button.addEventListener("click", function(){
        var index = Number(button.getAttribute("data-bl-student-json"));
        var row = rows[index] || null;

        if(!row){
          status("No encontré el registro local de ese estudiante.", "bl-status-warn");
          return;
        }

        var json = renderStudentJson(row);

        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(json).then(function(){
              status("JSON local copiado. También se abrió en una ventana pequeña.", "bl-status-ok");
            }).catch(function(){});
          }
        }catch(error){}

        var win = window.open("", "_blank", "width=900,height=700");

        if(win && win.document){
          win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Registro Base Local</title><style>body{font-family:Consolas,monospace;padding:18px;background:#f8fafc;color:#0f172a;}pre{white-space:pre-wrap;background:white;border:1px solid #dbe3ef;border-radius:12px;padding:16px;}</style></head><body><h3>Registro guardado en Base Local</h3><pre>' + esc(json) + '</pre></body></html>');
          win.document.close();
        }else{
          window.prompt("Registro guardado en Base Local", json);
        }
      });
    });
  }


  function renderPeriods(view){
    var target = el("bl-periodos-table");if(!target) return;
    target.innerHTML = table([{label:"Período", key:"label"},{label:"ID", key:"id"},{label:"Actualizado", key:"updatedAt"}], view.periods || []);
  }

  function pageInfo(total){
    var pages = Math.max(1, Math.ceil((total || 0) / state.studentPageSize));
    state.studentPage = Math.max(1, Math.min(state.studentPage, pages));
    var from = total ? ((state.studentPage - 1) * state.studentPageSize) + 1 : 0;
    var to = Math.min(state.studentPage * state.studentPageSize, total || 0);
    return {page:state.studentPage,pages:pages,from:from,to:to,total:total || 0,offset:(state.studentPage - 1) * state.studentPageSize,hasPrev:state.studentPage>1,hasNext:state.studentPage<pages,label:total ? (from + "-" + to + " de " + total) : "0 registros"};
  }

  function renderStudentPagination(info){
    var label = el("bl-students-page-label");if(label){label.textContent = info.label + " · Página " + info.page + " de " + info.pages;}
    [["bl-students-first",!info.hasPrev],["bl-students-prev",!info.hasPrev],["bl-students-next",!info.hasNext],["bl-students-last",!info.hasNext]].forEach(function(pair){var btn=el(pair[0]);if(btn){btn.disabled=!!pair[1];}});
  }

  function renderStudents(view){
    var target = el("bl-estudiantes-table");if(!target) return;
    var all = view.students || [];
    var info = pageInfo(all.length);
    var rows = all.slice(info.offset, info.offset + state.studentPageSize);

    renderStudentPagination(info);

    if(!rows.length){
      target.innerHTML = '<p class="bl-help">Sin estudiantes visibles. Revisa período, estado, división o búsqueda.</p>';
      return;
    }

    var headers = ["Cédula","Nombre","Carrera","División","Sede","Estado","Período"]
      .concat(REQ_COLUMNS.map(function(req){return req.label;}))
      .concat(["Guardado local"]);

    var html = '<table><thead><tr>' + headers.map(function(label){
      return '<th>' + esc(label) + '</th>';
    }).join("") + '</tr></thead><tbody>';

    html += rows.map(function(row, index){
      var cells = [
        esc(row.cedula || getField(row, "cedula", "")),
        esc(row.nombres || getField(row, "nombres", row.Nombres || "")),
        esc(row.nombrecarrera || getField(row, "nombreCarrera", row.NombreCarrera || "")),
        esc(divisionOf(row)),
        esc(getField(row, "sede", row.Sede || row.sede || "")),
        esc(row.estadoMatricula || getField(row, "estadoMatricula", "ACTIVO")),
        esc(row.periodoLabel || row.periodoId || getField(row, "periodoId", ""))
      ];

      var reqCells = REQ_COLUMNS.map(function(req){
        return reqBadge(row, req.key);
      });

      var inspect = '<button type="button" class="bl-btn bl-btn-light" data-bl-student-json="' + index + '">Ver JSON</button>';

      return '<tr>'
        + cells.map(function(value){return '<td>' + value + '</td>';}).join("")
        + reqCells.map(function(value){return '<td>' + value + '</td>';}).join("")
        + '<td>' + inspect + '</td>'
        + '</tr>';
    }).join("");

    target.innerHTML = html + '</tbody></table>';

    bindStudentInspectButtons(rows);
  }

  function renderHistory(view){
    var target = el("bl-history-table");if(!target) return;
    var rows = (view.history || []).slice(0, 50);
    target.innerHTML = table([{label:"Fecha", key:"createdAt"},{label:"Acción", value:function(row){return row.action || "análisis";}},{label:"Período", key:"periodoLabel"},{label:"Origen", key:"fileName"},{label:"Filas", key:"totalRows"}], rows);
  }

  function renderDiagnostics(view){
    var box = el("bl-diagnostics-box");if(!box) return;
    var diagnostics = view.diagnostics || {};
    var firebaseStatus = safeCall("firebaseStatus", function(){return window.BaseLocalFirebase && typeof window.BaseLocalFirebase.getLastStatus === "function" ? window.BaseLocalFirebase.getLastStatus() : {ok:false, mode:"sin_firebase"};}, {ok:false, mode:"sin_firebase"});
    var syncStatus = safeCall("syncStatus", function(){return window.BaseLocalFirebase && typeof window.BaseLocalFirebase.getSyncStatus === "function" ? window.BaseLocalFirebase.getSyncStatus() : {ok:false, mode:"sin_sync"};}, {ok:false, mode:"sin_sync"});
    var bridgeCounts = safeCall("bridgeCounts", function(){return window.BaseLocalBridge && typeof window.BaseLocalBridge.counts === "function" ? window.BaseLocalBridge.counts() : null;}, null);
    var cleanLogs = safeCall("cleanLogs", function(){return window.BLLimpiarBaseService && typeof window.BLLimpiarBaseService.getLogs === "function" ? window.BLLimpiarBaseService.getLogs().slice(0,3) : [];}, []);
    box.textContent = JSON.stringify({dashboard:state.lastDashboard,local:diagnostics,vista:{periodoId:state.periodId,division:state.divisionFilter,estadoMatricula:state.statusFilter,busqueda:state.search,estudiantesVisibles:(view.students || []).length,estudiantesDelPeriodo:view.totalStudentsPeriod || 0,conteoEstados:view.statusCounts || {}},firebase:firebaseStatus,sync:syncStatus,bridge:bridgeCounts,limpiezaBase:cleanLogs,ultimoErrorVista:state.lastRenderError || "",rendimiento:{tab:state.tab,autoSyncEnabled:autoSyncAllowed(),panelLiviano:true}}, null, 2);
  }

  function renderSelectors(view){
    var selector = el("bl-filter-period");
    if(selector){var current = state.periodId || selector.value;selector.innerHTML = '<option value="">Todos los períodos</option>' + (view.periods || []).map(function(period){return '<option value="' + esc(period.id) + '">' + esc(period.label || period.id) + '</option>';}).join("");selector.value = current;}
    var estado = el("bl-filter-estado");if(estado){estado.value = state.statusFilter;}
    var div = el("bl-filter-division");
    if(div){
      var divisions = view.divisions || [];
      var currentDivision = state.divisionFilter;
      div.innerHTML = '<option value="">Todas</option>' + divisions.map(function(name){return '<option value="' + esc(name) + '">' + esc(name) + '</option>';}).join("");
      if(currentDivision && divisions.indexOf(currentDivision) < 0){state.divisionFilter = "";div.value = "";}else{div.value = currentDivision;}
    }
  }

  function emptyView(message){return {periods:[],students:[],allStudentsForPeriod:[],statusCounts:{ACTIVO:0, RETIRADO:0, TOTAL:0},totalStudentsPeriod:0,history:[{createdAt:new Date().toISOString(), action:"error", periodoLabel:"Base Local", fileName:message || "Error", totalRows:0}],historyCount:1,diagnostics:{ok:false, error:message || "Base Local no disponible"},careersCount:0,divisions:[],snapshot:null};}

  function viewOptions(){
    var isStudents = state.tab === "estudiantes";
    return {division:state.divisionFilter,includeHistory:state.tab === "historial",includeDiagnostics:state.tab === "diagnostico",includeDivisions:true,includeDivisionsSummary:state.tab === "diagnostico",includeSnapshot:false,includeAllStudentsForPeriod:false,includeStatusCounts:isStudents,skipStudents:!isStudents};
  }

  function renderActiveTab(view){
    if(state.tab === "periodos"){renderPeriods(view);return;}
    if(state.tab === "estudiantes"){renderStudents(view);return;}
    if(state.tab === "historial"){renderHistory(view);return;}
    if(state.tab === "diagnostico"){renderDiagnostics(view);return;}
    if(state.tab === "manual"){var manual = el("bl-manual-text");if(manual && window.BaseLocalManual){manual.value = window.BaseLocalManual.getManual();}}
  }

  function renderKpis(view, dash, firebaseStatus, syncStatus){
    var counts = view.statusCounts || {ACTIVO:null, RETIRADO:null, TOTAL:null};
    var dashCounts = dash && dash.statusCounts ? dash.statusCounts : {};
    var total = counts.TOTAL != null && counts.TOTAL !== 0 ? counts.TOTAL : (dash && dash.students != null ? dash.students : 0);
    if(el("bl-kpi-periodos")) el("bl-kpi-periodos").textContent = dash && dash.periods != null ? dash.periods : (view.periods || []).length;
    if(el("bl-kpi-estudiantes")) el("bl-kpi-estudiantes").textContent = total || 0;
    if(el("bl-kpi-activos")) el("bl-kpi-activos").textContent = counts.ACTIVO != null && counts.ACTIVO !== 0 ? counts.ACTIVO : (dashCounts.ACTIVO == null ? "—" : dashCounts.ACTIVO);
    if(el("bl-kpi-retirados")) el("bl-kpi-retirados").textContent = counts.RETIRADO != null && counts.RETIRADO !== 0 ? counts.RETIRADO : (dashCounts.RETIRADO == null ? "—" : dashCounts.RETIRADO);
    if(el("bl-kpi-historial")) el("bl-kpi-historial").textContent = dash && dash.history != null ? dash.history : (view.historyCount || (view.history || []).length);
    if(el("bl-kpi-carreras")) el("bl-kpi-carreras").textContent = view.careersCount || (dash && dash.careers != null ? dash.careers : "—");
    if(el("bl-kpi-estado")) el("bl-kpi-estado").textContent = syncStatus && syncStatus.ok ? "Sincronizada" : (firebaseStatus && firebaseStatus.ok ? "Firebase" : "Local");
  }

  function render(){
    state.renderPending = false;
    try{
      if(!window.BaseLocalAPI || typeof window.BaseLocalAPI.buildView !== "function"){throw new Error("BaseLocalAPI no está disponible. Revisa que baselocal.core.js haya cargado correctamente.");}
      var deepDash = state.tab === "estudiantes" || state.tab === "diagnostico";
      var view = window.BaseLocalAPI.buildView(state.periodId, state.search, state.statusFilter, viewOptions());
      state.lastView = view;
      state.lastDashboard = dashboard(deepDash);
      var firebaseStatus = safeCall("firebaseStatus", function(){return window.BaseLocalFirebase && typeof window.BaseLocalFirebase.getLastStatus === "function" ? window.BaseLocalFirebase.getLastStatus() : null;}, null);
      var syncStatus = safeCall("syncStatus", function(){return window.BaseLocalFirebase && typeof window.BaseLocalFirebase.getSyncStatus === "function" ? window.BaseLocalFirebase.getSyncStatus() : null;}, null);
      renderSelectors(view);
      renderKpis(view, state.lastDashboard, firebaseStatus, syncStatus);
      renderActiveTab(view);
      if(!state.loading){status("Base Local cargada en modo panel liviano. Pestaña: " + state.tab + ". División: " + (state.divisionFilter || "Todas") + ". Registros visibles: " + ((view.students || []).length) + ".", "bl-status-ok");}
    }catch(error){
      console.error("[BaseLocal Render]", error);state.lastRenderError = error.message || String(error);
      var fallback = emptyView(state.lastRenderError);renderSelectors(fallback);renderActiveTab(fallback);
      status("Base Local no se cayó. Error controlado: " + state.lastRenderError, "bl-status-warn");
    }
  }

  function scheduleRender(reason){if(state.renderTimer){clearTimeout(state.renderTimer);}state.renderPending = true;state.renderTimer = setTimeout(function(){state.renderTimer = null;render(reason || "programado");}, 220);}
  function setTab(tab){state.tab = tab;if(tab !== "estudiantes"){state.studentPage = 1;}document.querySelectorAll(".bl-tabs button").forEach(function(button){button.classList.toggle("is-active", button.dataset.tab === tab);});document.querySelectorAll(".bl-panel").forEach(function(panel){panel.classList.toggle("is-active", panel.id === "bl-tab-" + tab);});scheduleRender("tab-" + tab);}

  function exportJson(){
    try{var data = window.BaseLocalAPI.getSnapshot();var blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});var link = document.createElement("a");link.href = URL.createObjectURL(blob);link.download = "carga-base-local.json";link.click();setTimeout(function(){URL.revokeObjectURL(link.href);}, 1000);}
    catch(error){status("No se pudo exportar Base Local: " + (error.message || error), "bl-status-warn");}
  }

  function copyRefs(){
    var content = window.BaseLocalManual ? window.BaseLocalManual.getManual() : "";
    if(navigator.clipboard && navigator.clipboard.writeText){navigator.clipboard.writeText(content).then(function(){status("Referencias copiadas.", "bl-status-ok");}).catch(function(){var manual = el("bl-manual-text");if(manual){manual.focus();manual.select();}status("Copia manualmente desde la pestaña Manual.", "bl-status-warn");});return;}
    var manualFallback = el("bl-manual-text");if(manualFallback){manualFallback.focus();manualFallback.select();}status("Copia manualmente desde la pestaña Manual.", "bl-status-warn");
  }

  async function pullFromFirebase(){
    if(state.loading){return;}
    try{
      if(!window.BaseLocalFirebase || typeof window.BaseLocalFirebase.pull !== "function"){throw new Error("BaseLocalFirebase no está disponible.");}
      setBusy(true, "Bajando datos desde Firebase hacia la base local...", "pull");
      var result = await window.BaseLocalFirebase.pull();
      state.periodId = "";state.divisionFilter = "";state.search = "";state.statusFilter = "ACTIVO";state.studentPage = 1;
      if(el("bl-filter-search")){el("bl-filter-search").value = "";}if(el("bl-filter-estado")){el("bl-filter-estado").value = "ACTIVO";}if(el("bl-filter-division")){el("bl-filter-division").value = "";}
      if(window.RequisitosBL && typeof window.RequisitosBL.rebuildSnapshotToCollections === "function"){window.RequisitosBL.rebuildSnapshotToCollections({force:true});}
      invalidateCaches();render();
      status("Datos bajados correctamente desde Firebase. Estudiantes: " + (result.totalStudents || 0) + ". Períodos: " + (result.totalPeriods || 0) + ".", "bl-status-ok");
    }catch(error){console.error("[BaseLocal Firebase Pull]", error);status("Base Local sigue activa. Error al bajar Firebase: " + (error.message || String(error)), "bl-status-warn");}
    finally{setBusy(false);}
  }

  async function syncNow(mode){
    if(state.loading){return;}
    try{
      if(!window.BaseLocalFirebase || typeof window.BaseLocalFirebase.sync !== "function"){throw new Error("BaseLocalFirebase.sync no está disponible.");}
      setBusy(true, "Sincronizando Base Local con Firebase...", "sync");
      var result = await window.BaseLocalFirebase.sync({mode:mode || "manual"});
      if(window.RequisitosBL && typeof window.RequisitosBL.rebuildSnapshotToCollections === "function"){window.RequisitosBL.rebuildSnapshotToCollections({force:true});}
      invalidateCaches();render();
      if(result && result.ok){status(result.message || "Sincronización finalizada correctamente.", "bl-status-ok");}
      else{status((result && result.message) || "No se pudo sincronizar. Base Local sigue funcionando.", "bl-status-warn");}
    }catch(error){console.error("[BaseLocal Sync]", error);status("Base Local sigue activa. Error de sincronización: " + (error.message || String(error)), "bl-status-warn");}
    finally{setBusy(false);}
  }

  async function limpiarBase(){
    if(state.loading){return;}
    try{
      if(!window.BaseLocalLimpiar || typeof window.BaseLocalLimpiar.ejecutar !== "function"){throw new Error("BaseLocalLimpiar no está disponible.");}
      setBusy(true, "Limpiando Firebase y reconstruyendo Base Local...", "clean");
      var result = await window.BaseLocalLimpiar.ejecutar();
      state.periodId = "";state.divisionFilter = "";state.search = "";state.statusFilter = "ACTIVO";state.studentPage = 1;
      if(el("bl-filter-search")){el("bl-filter-search").value = "";}if(el("bl-filter-estado")){el("bl-filter-estado").value = "ACTIVO";}if(el("bl-filter-division")){el("bl-filter-division").value = "";}
      invalidateCaches();render();
      status((result && result.mensaje) || "Firebase y Base Local reparados.", result && result.errores && result.errores.length ? "bl-status-warn" : "bl-status-ok");
    }catch(error){console.error("[BaseLocal Limpiar]", error);status("Base Local sigue activa. Error al limpiar base: " + (error.message || String(error)), "bl-status-warn");}
    finally{setBusy(false);}
  }

  function parentOwnsDailySync(){try{return !!(window.parent && window.parent !== window && window.parent.MAQ_BASELOCAL_BACKGROUND_SYNC);}catch(error){return false;}}
  function runDailySync(){
    if(parentOwnsDailySync()){state.dailyStarted = true;return;}
    if(state.dailyStarted){return;}state.dailyStarted = true;
    if(!autoSyncAllowed()){status("Base Local activa. Sincronización automática pausada para mantener la pantalla rápida.", "bl-status-ok");return;}
    setTimeout(async function(){
      try{
        if(!window.BaseLocalFirebase || typeof window.BaseLocalFirebase.runDailyIfNeeded !== "function"){return;}
        var result = await window.BaseLocalFirebase.runDailyIfNeeded(false, {mode:"daily_from_bl", background:true});
        if(result && result.ok){if(window.RequisitosBL && typeof window.RequisitosBL.mirrorSnapshotToCollections === "function"){window.RequisitosBL.mirrorSnapshotToCollections({silent:true});}invalidateCaches();render();status(result.message || "Sincronización diaria completada en segundo plano.", "bl-status-ok");}
        else if(result && result.skipped){return;}
        else if(result && result.message){status("Base Local activa. Firebase queda pendiente: " + result.message, "bl-status-warn");}
      }catch(error){console.warn("[BaseLocal Daily Sync]", error);status("Base Local activa. Firebase queda pendiente: " + (error.message || error), "bl-status-warn");}
    }, 3200);
  }

  function bindGlobalErrors(){
    window.addEventListener("error", function(event){var msg = event && event.message ? event.message : "Error de pantalla Base Local";console.error("[BaseLocal Global Error]", event.error || event);state.lastRenderError = msg;status("Base Local protegida. Error controlado: " + msg, "bl-status-warn");});
    window.addEventListener("unhandledrejection", function(event){var reason = event && event.reason ? event.reason : "Promesa rechazada";var msg = reason && reason.message ? reason.message : String(reason);console.error("[BaseLocal Promise Error]", reason);state.lastRenderError = msg;status("Base Local protegida. Error de sincronización controlado: " + msg, "bl-status-warn");});
  }

  function bindCrossWindowEvents(){
    window.addEventListener("storage", function(event){if(event.key === "REQ_BL_SIGNAL_V1"){invalidateCaches();scheduleRender("storage");}});
    window.addEventListener("message", function(event){var data = event.data || {};var type = String(data.type || "");if(type.indexOf("requisitos:bl:") === 0){invalidateCaches();scheduleRender(type);}});
    ["requisitos:bl:changed","requisitos:bl:snapshot-changed","requisitos:bl:sync-complete","baselocal:sync-complete","baselocal:firebase-pull-finished","requisitos:bl:mirror-complete","requisitos:bl:limpieza-complete","requisitos:bl:periodo-borrado","baselocal:periodo-borrado","requisitos:bl:division-created","requisitos:bl:periodo-borrado-historial-purgado"].forEach(function(name){window.addEventListener(name, function(){invalidateCaches();scheduleRender(name);});});
  }

  window.BaseLocalApp = {render:render,scheduleRender:scheduleRender,status:status,setBusy:setBusy,getState:function(){return Object.assign({}, state);}};

  function boot(){
    bindGlobalErrors();
    safeCall("ExcelLocalBridge.ensureReady", function(){if(window.ExcelLocalBridge && typeof window.ExcelLocalBridge.ensureReady === "function"){window.ExcelLocalBridge.ensureReady();}}, null);
    document.querySelectorAll(".bl-tabs button").forEach(function(button){button.addEventListener("click", function(){setTab(button.dataset.tab);});});
    if(el("bl-filter-period")){el("bl-filter-period").addEventListener("change", function(event){state.periodId = event.target.value;state.divisionFilter = "";state.studentPage = 1;scheduleRender("period-filter");});}
    if(el("bl-filter-estado")){el("bl-filter-estado").addEventListener("change", function(event){state.statusFilter = event.target.value;state.studentPage = 1;scheduleRender("estado-filter");});}
    if(el("bl-filter-division")){el("bl-filter-division").addEventListener("change", function(event){state.divisionFilter = event.target.value;state.studentPage = 1;scheduleRender("division-filter");});}
    if(el("bl-filter-search")){el("bl-filter-search").addEventListener("input", function(event){state.search = event.target.value;state.studentPage = 1;scheduleRender("search");});}
    if(el("bl-btn-refresh")){el("bl-btn-refresh").addEventListener("click", function(){invalidateCaches();render();});}
    if(el("bl-btn-pull-firebase")){el("bl-btn-pull-firebase").addEventListener("click", pullFromFirebase);}
    if(el("bl-btn-sync-now")){el("bl-btn-sync-now").addEventListener("click", function(){syncNow("manual");});}
    if(el("bl-btn-clean-base")){el("bl-btn-clean-base").addEventListener("click", limpiarBase);}
    if(el("bl-btn-export")){el("bl-btn-export").addEventListener("click", exportJson);}
    if(el("bl-btn-copy-refs")){el("bl-btn-copy-refs").addEventListener("click", copyRefs);}
    if(el("bl-students-first")){el("bl-students-first").addEventListener("click", function(){state.studentPage=1;render();});}
    if(el("bl-students-prev")){el("bl-students-prev").addEventListener("click", function(){state.studentPage=Math.max(1,state.studentPage-1);render();});}
    if(el("bl-students-next")){el("bl-students-next").addEventListener("click", function(){state.studentPage+=1;render();});}
    if(el("bl-students-last")){el("bl-students-last").addEventListener("click", function(){var total=(state.lastView&&state.lastView.students?state.lastView.students.length:0);state.studentPage=Math.max(1,Math.ceil(total/state.studentPageSize));render();});}
    bindCrossWindowEvents();render();
    try{window.dispatchEvent(new CustomEvent("bl:ready", {detail:{module:"BaseLocal", ready:true, at:new Date().toISOString()}}));if(window.parent && window.parent !== window){window.parent.postMessage({type:"requisitos:bl:ready", payload:{module:"BaseLocal", ready:true, at:new Date().toISOString()}}, "*");}}catch(error){}
    runDailySync();
  }

  if(document.readyState === "loading"){document.addEventListener("DOMContentLoaded", boot);}else{boot();}
})(window,document);
