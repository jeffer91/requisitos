/* =========================================================
Nombre completo: bdl.sync.ui-bridge.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.ui-bridge.js
Función o funciones:
- Mostrar la cola real cambios_pendientes del período activo.
- Sincronizar manualmente un destino o la cola completa.
- Confirmar el número real de pendientes y el máximo de 25.
- Evitar listeners duplicados entre la interfaz nueva y botones legacy.
- Reintentar, revisar o descartar pendientes con confirmación.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "0.7.0-manual-confirmed";
  var MAX_BATCH_SIZE = 25;
  var mounted = false;
  var eventsBound = false;
  var lastCounts = null;
  var rows = [];
  var items = [];
  var visible = [];

  var TARGETS = {
    google:{ label:"Google Sheets",short:"Google",button:"bl2-btn-push-google",legacy:"bl2-btn-sync-google",kpi:"bl2-kpi-google",status:"bl2-google-status",dot:"bl2-dot-google" },
    firebase:{ label:"Firebase",short:"Firebase",button:"bl2-btn-push-firebase",legacy:"bl2-btn-sync-firebase",kpi:"bl2-kpi-firebase",status:"bl2-firebase-status",dot:"bl2-dot-firebase" },
    supabase:{ label:"Supabase",short:"Supabase",button:"bl2-btn-push-supabase",legacy:"",kpi:"bl2-kpi-supabase",status:"bl2-supabase-status",dot:"bl2-dot-supabase" }
  };

  function id(name){ return name ? document.getElementById(name) : null; }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function safeBatch(value){ value = Math.floor(num(value || MAX_BATCH_SIZE)); return Math.min(MAX_BATCH_SIZE,Math.max(1,value || MAX_BATCH_SIZE)); }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function setText(name,value){ var element = id(name); if(element){ element.textContent = value; } }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function database(){ return window.BL2DB || null; }

  function period(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return { id:text(selected.id),label:text(selected.label || selected.id) }; }
    }
    var select = id("bl2-period-select");
    var periodoId = text(select && select.value);
    return { id:periodoId,label:select && select.selectedOptions && select.selectedOptions[0] ? text(select.selectedOptions[0].textContent) : periodoId };
  }

  function log(message,level){
    var box = id("bl2-log");
    if(box){
      var item = document.createElement("div");
      item.className = "bl2-log-item " + (level ? "is-" + level : "");
      item.innerHTML = "<strong>Sincronización</strong><span>" + esc(message) + "</span>";
      box.insertBefore(item,box.firstChild);
    }
    if(window.BL2Core && typeof window.BL2Core.log === "function"){
      window.BL2Core.log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO",message).catch(function(){});
    }
  }

  function blankCounts(){
    return { total:0,detail:{
      google:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 },
      firebase:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 },
      supabase:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 }
    } };
  }

  function targetCounts(counts,target){
    counts = counts || {};
    return counts.detail && counts.detail[target] ? counts.detail[target] : { pending:0,synced:0,error:0,blocked:0,waitingRetry:0 };
  }

  function openTotal(detail){
    detail = detail || {};
    return num(detail.pending) + num(detail.error) + num(detail.blocked) + num(detail.waitingRetry);
  }

  function targetButton(target){
    var config = TARGETS[target] || {};
    return id(config.button) || id(config.legacy);
  }

  function updateTarget(target,detail,running){
    var config = TARGETS[target];
    if(!config){ return; }
    detail = detail || {};
    var total = openTotal(detail);
    setText(config.kpi,String(total));
    setText(config.status,"Manual · " + total + " abierto(s): " + num(detail.pending) + " pendiente(s), " + num(detail.error) + " error(es), " + num(detail.blocked) + " bloqueado(s).");

    var dot = id(config.dot);
    if(dot){ dot.className = "bl2-dot " + (num(detail.error) || num(detail.blocked) ? "bl2-dot-bad" : total ? "bl2-dot-warn" : "bl2-dot-ok"); }

    var button = targetButton(target);
    if(button){
      button.disabled = !!running;
      button.classList.remove("success","warning","danger");
      if(running){ button.textContent = "Subiendo " + config.short + "..."; button.classList.add("warning"); }
      else if(total){ button.textContent = "Subir pendientes (" + total + ")"; button.classList.add("danger"); }
      else{ button.textContent = config.short + " actualizado"; button.classList.add("success"); }
    }
  }

  function publish(counts){
    lastCounts = counts || blankCounts();
    Object.keys(TARGETS).forEach(function(target){ updateTarget(target,targetCounts(lastCounts,target),false); });
    renderSummary();
    try{ window.dispatchEvent(new CustomEvent("bdlocal:sync-ui-updated",{ detail:{ counts:lastCounts,at:new Date().toISOString() } })); }catch(error){}
    return lastCounts;
  }

  function refreshCounts(){
    var current = period();
    var currentOutbox = outbox();
    if(!current.id || !currentOutbox || typeof currentOutbox.counts !== "function"){
      return Promise.resolve(publish(blankCounts()));
    }
    return currentOutbox.counts({ periodoId:current.id }).then(publish).catch(function(error){
      log(error.message || String(error),"warn");
      return publish(lastCounts || blankCounts());
    });
  }

  function targetWarning(target,current,total,limit){
    var lines = [
      "Destino: " + TARGETS[target].label,
      "Período: " + current.label,
      "Pendientes abiertos: " + total,
      "Máximo en esta ejecución: " + Math.min(limit,total)
    ];
    if(total > limit){ lines.push("Los restantes continuarán en la cola local."); }
    if(target === "firebase"){
      lines.push("Firebase: Estudiantes/{periodoId__cedula}.");
      lines.push("No se eliminarán documentos.");
    }
    lines.push("\n¿Continuar con esta operación manual?");
    return lines.join("\n");
  }

  function runTarget(target,options){
    options = options || {};
    target = text(target).toLowerCase();
    var config = TARGETS[target];
    var current = period();
    var limit = safeBatch(options.limit || options.batchSize || MAX_BATCH_SIZE);

    if(!config){ return Promise.reject(new Error("Destino no reconocido.")); }
    if(!current.id){ return Promise.reject(new Error("Seleccione un período.")); }

    return refreshCounts().then(function(counts){
      var detail = targetCounts(counts,target);
      var total = openTotal(detail);
      if(!total && !options.forceRetry){
        return { ok:true,skipped:true,target:target,message:config.label + ": no existen pendientes para el período activo." };
      }
      if(options.confirm !== false && !window.confirm(targetWarning(target,current,total,limit))){
        return { ok:true,cancelled:true,target:target };
      }

      updateTarget(target,{ pending:Math.max(total,1) },true);
      var request = {
        source:"BDLSyncUIBridge.manual." + target,
        manual:true,
        targets:[target],
        periodoId:current.id,
        periodoLabel:current.label,
        cedula:text(options.cedula),
        tabla:text(options.tabla),
        forceRetry:!!options.forceRetry,
        ignoreRetry:!!options.forceRetry,
        limit:limit,
        batchSize:limit
      };

      var work;
      if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.syncTarget === "function"){
        work = window.BDLSyncOrchestrator.syncTarget(target,request);
      }else if(window.BDLSyncV2 && typeof window.BDLSyncV2.request === "function"){
        work = window.BDLSyncV2.request(request);
      }else{
        return Promise.reject(new Error("No existe motor seguro de sincronización."));
      }

      return Promise.resolve(work).then(function(result){
        log(text(result && result.message || "Sincronización finalizada."),result && result.ok === false ? "warn" : "ok");
        return refreshAll().then(function(){ return result; });
      }).catch(function(error){
        log(error.message || String(error),"error");
        return refreshAll().then(function(){ throw error; });
      });
    });
  }

  function runQueue(options){
    options = options || {};
    var current = period();
    var limit = safeBatch(options.limit || options.batchSize || MAX_BATCH_SIZE);
    if(!current.id){ return Promise.reject(new Error("Seleccione un período.")); }
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      return Promise.reject(new Error("BDLSyncV2 no está disponible."));
    }

    return refreshCounts().then(function(counts){
      var totals = {};
      var allOpen = 0;
      Object.keys(TARGETS).forEach(function(target){ totals[target] = openTotal(targetCounts(counts,target)); allOpen += totals[target]; });
      if(!allOpen && !options.forceRetry){ return { ok:true,skipped:true,message:"No existen pendientes abiertos para ningún destino." }; }

      if(options.confirm !== false){
        var message = "Procesar cola manual\n\nPeríodo: " + current.label +
          "\nGoogle: " + totals.google +
          "\nFirebase: " + totals.firebase +
          "\nSupabase: " + totals.supabase +
          "\n\nMáximo: " + limit + " por destino. Los restantes continuarán pendientes.\n\n¿Continuar?";
        if(!window.confirm(message)){ return { ok:true,cancelled:true }; }
      }

      Object.keys(TARGETS).forEach(function(target){ updateTarget(target,{ pending:Math.max(totals[target],1) },true); });
      return window.BDLSyncV2.request({
        source:"BDLSyncUIBridge.manual.all",
        manual:true,
        targets:["google","firebase","supabase"],
        periodoId:current.id,
        periodoLabel:current.label,
        forceRetry:!!options.forceRetry,
        ignoreRetry:!!options.forceRetry,
        limit:limit,
        batchSize:limit
      }).then(function(result){
        log("Cola manual procesada.",result && result.ok === false ? "warn" : "ok");
        return refreshAll().then(function(){ return result; });
      });
    });
  }

  function targetFields(target){
    var currentOutbox = outbox();
    if(currentOutbox && typeof currentOutbox.fields === "function"){ return currentOutbox.fields(target); }
    if(target === "google"){ return { status:"estadoSheets",legacyStatus:"statusGoogle",attempts:"intentosSheets",error:"ultimoErrorSheets",nextRetryAt:"nextRetryAtSheets",blocked:"bloqueadoSheets" }; }
    if(target === "firebase"){ return { status:"estadoFirebase",legacyStatus:"statusFirebase",attempts:"intentosFirebase",error:"ultimoErrorFirebase",nextRetryAt:"nextRetryAtFirebase",blocked:"bloqueadoFirebase" }; }
    return { status:"estadoSupabase",legacyStatus:"statusSupabase",attempts:"intentosSupabase",error:"ultimoErrorSupabase",nextRetryAt:"nextRetryAtSupabase",blocked:"bloqueadoSupabase" };
  }

  function itemState(row,target){
    var fields = targetFields(target);
    var status = text(row[fields.status] || row[fields.legacyStatus] || "PENDIENTE").toUpperCase();
    if(status === "OK" || status === "DONE" || status === "SYNCED"){ status = "SINCRONIZADO"; }
    if(status === "PENDING"){ status = "PENDIENTE"; }
    var blocked = row[fields.blocked] === true;
    var retry = text(row[fields.nextRetryAt]);
    var retryTime = Date.parse(retry || "");
    var waiting = retry && Number.isFinite(retryTime) && retryTime > Date.now();
    return {
      status:status,
      className:status === "SINCRONIZADO" ? "synced" : blocked ? "blocked" : waiting ? "waiting" : status === "ERROR" ? "error" : "pending",
      attempts:num(row[fields.attempts]),
      error:text(row[fields.error]),
      nextRetryAt:retry
    };
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function rowTable(row){ return text(row && (row.tabla || row.tipo || "registro")); }
  function rowCedula(row){ return text(row && (row.cedula || row.numeroIdentificacion || row.registroId || row.idEstudiantePeriodo)); }

  function expand(source){
    var result = [];
    (source || []).forEach(function(row){
      Object.keys(TARGETS).forEach(function(target){ result.push({ row:row,target:target,state:itemState(row,target) }); });
    });
    return result;
  }

  function filters(){
    return {
      target:text((id("queue-target") || {}).value || "all"),
      status:text((id("queue-status") || {}).value || "open"),
      table:text((id("queue-table-filter") || {}).value).toLowerCase(),
      cedula:text((id("queue-cedula") || {}).value).toLowerCase()
    };
  }

  function applyFilters(source){
    var currentFilters = filters();
    return source.filter(function(item){
      if(currentFilters.target !== "all" && item.target !== currentFilters.target){ return false; }
      if(currentFilters.status === "open" && item.state.className === "synced"){ return false; }
      if(currentFilters.status !== "all" && currentFilters.status !== "open" && item.state.className !== currentFilters.status){ return false; }
      if(currentFilters.table && rowTable(item.row).toLowerCase().indexOf(currentFilters.table) < 0){ return false; }
      if(currentFilters.cedula && (rowCedula(item.row) || rowId(item.row)).toLowerCase().indexOf(currentFilters.cedula) < 0){ return false; }
      return true;
    }).slice(0,200);
  }

  function renderSummary(){
    var box = id("queue-summary");
    if(!box){ return; }
    var counts = lastCounts || blankCounts();
    box.innerHTML = Object.keys(TARGETS).map(function(target){
      var detail = targetCounts(counts,target);
      return '<article class="bdlc-card bdlc-kpi-card"><span>' + TARGETS[target].label + '</span><strong>' + openTotal(detail) + '</strong><small>Manual · máximo 25 · ' + num(detail.error) + ' error(es)</small></article>';
    }).join("");
  }

  function renderQueue(){
    var box = id("queue-table");
    if(!box){ return; }
    visible = applyFilters(items);
    setText("queue-result-count",visible.length + " fila(s) visibles de " + items.length);
    if(!visible.length){ box.className = "bdlc-empty"; box.textContent = "No existen registros para los filtros actuales."; return; }

    box.className = "bdlc-table-wrap";
    box.innerHTML = '<table class="bdlc-table"><thead><tr><th>Tabla</th><th>Cédula / ID</th><th>Destino</th><th>Estado</th><th>Intentos</th><th>Último error</th><th>Próximo intento</th><th>Acciones</th></tr></thead><tbody>' + visible.map(function(item,index){
      var state = item.state;
      var stateLabel = state.className === "waiting" ? "ESPERANDO" : state.className === "blocked" ? "BLOQUEADO" : state.status;
      var style = state.className === "synced" ? "ok" : state.className === "pending" ? "pending" : state.className === "waiting" ? "warning" : "error";
      return '<tr><td>' + esc(rowTable(item.row)) + '</td><td>' + esc(rowCedula(item.row) || rowId(item.row)) + '</td><td>' + esc(TARGETS[item.target].label) + '</td><td><span class="bdlc-status ' + style + '">' + esc(stateLabel) + '</span></td><td>' + state.attempts + '</td><td>' + esc(state.error || "—") + '</td><td>' + esc(state.nextRetryAt ? new Date(state.nextRetryAt).toLocaleString("es-EC") : "—") + '</td><td><div class="bdlc-actions"><button class="bdlc-button subtle" type="button" data-queue-view="' + index + '">Ver</button>' + (state.className !== "synced" ? '<button class="bdlc-button secondary" type="button" data-queue-retry="' + index + '">Reintentar</button><button class="bdlc-button danger" type="button" data-queue-discard="' + index + '">Descartar</button>' : '') + '</div></td></tr>';
    }).join("") + '</tbody></table>';
  }

  function loadQueue(){
    var current = period();
    var currentOutbox = outbox();
    var box = id("queue-table");
    if(!current.id){
      rows = []; items = []; visible = [];
      if(box){ box.className = "bdlc-empty"; box.textContent = "Seleccione un período para revisar la cola."; }
      return Promise.resolve([]);
    }
    if(box){ box.className = "bdlc-empty"; box.textContent = "Leyendo cola..."; }
    if(!currentOutbox || typeof currentOutbox.list !== "function"){
      rows = []; items = []; renderQueue(); return Promise.resolve([]);
    }
    return currentOutbox.list({ periodoId:current.id }).then(function(result){
      rows = Array.isArray(result) ? result : [];
      items = expand(rows);
      renderQueue();
      return rows;
    }).catch(function(error){
      if(box){ box.className = "bdlc-alert error"; box.textContent = error.message || String(error); }
      return [];
    });
  }

  function showPayload(index){
    var item = visible[num(index)];
    var output = id("queue-payload");
    if(item && output){ output.textContent = JSON.stringify({ target:item.target,targetState:item.state,change:item.row },null,2); }
  }

  function retryOne(index){
    var item = visible[num(index)];
    var currentOutbox = outbox();
    if(!item || !currentOutbox || typeof currentOutbox.resetRetries !== "function"){
      return Promise.reject(new Error("No se puede reintentar este cambio."));
    }
    if(!window.confirm("Reintentar este cambio en " + TARGETS[item.target].label + ". ¿Continuar?")){
      return Promise.resolve({ cancelled:true });
    }
    return currentOutbox.resetRetries([item.row],item.target).then(function(){
      return runTarget(item.target,{ confirm:false,forceRetry:true,cedula:rowCedula(item.row),tabla:rowTable(item.row),limit:1 });
    });
  }

  function retryErrors(){
    var currentOutbox = outbox();
    if(!currentOutbox || typeof currentOutbox.resetRetries !== "function"){
      return Promise.reject(new Error("El reintento no está disponible."));
    }
    var failed = items.filter(function(item){ return item.state.className === "error" || item.state.className === "blocked" || item.state.className === "waiting"; });
    if(!failed.length){ return Promise.resolve({ ok:true,message:"No existen errores para reintentar." }); }
    if(!window.confirm("Rehabilitar y reintentar " + failed.length + " destino(s). Se procesarán máximo 25 por destino. ¿Continuar?")){
      return Promise.resolve({ cancelled:true });
    }

    var chain = Promise.resolve();
    Object.keys(TARGETS).forEach(function(target){
      var targetRows = failed.filter(function(item){ return item.target === target; }).map(function(item){ return item.row; });
      if(targetRows.length){ chain = chain.then(function(){ return currentOutbox.resetRetries(targetRows,target); }); }
    });
    return chain.then(function(){ return runQueue({ confirm:false,forceRetry:true,limit:25 }); });
  }

  function discardOne(index){
    var item = visible[num(index)];
    var currentDb = database();
    if(!item || !currentDb || typeof currentDb.remove !== "function"){
      return Promise.reject(new Error("No se puede descartar este cambio."));
    }
    var table = text(item.row._repoCambiosSource) === "cambios_legacy" ? "cambios" : "cambios_pendientes";
    var key = rowId(item.row);
    if(!key){ return Promise.reject(new Error("Cambio sin identificador.")); }
    if(!window.confirm("Descartar definitivamente este pendiente. No se borrará el estudiante. ¿Continuar?")){
      return Promise.resolve({ cancelled:true });
    }
    return currentDb.remove(table,key).then(function(){
      log("Cambio descartado: " + key,"warn");
      return refreshAll().then(function(){ return { ok:true,message:"Cambio descartado." }; });
    });
  }

  function mountQueue(container){
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || id("bl2-queue-slot");
    if(!container){ return Promise.resolve(null); }

    if(!mounted || container.getAttribute("data-queue-mounted") !== "true"){
      mounted = true;
      container.className = "";
      container.setAttribute("data-queue-mounted","true");
      container.innerHTML = '<div class="bdlc-alert info">La cola nunca se procesa sola. Cada ejecución requiere confirmación y trabaja con máximo 25 cambios por destino.</div><div id="queue-summary" class="bdlc-card-grid three"></div><div class="bdlc-card"><div class="bdlc-form"><div class="bdlc-field"><label class="bdlc-label">Destino</label><select id="queue-target" class="bdlc-select"><option value="all">Todos</option><option value="google">Google Sheets</option><option value="firebase">Firebase</option><option value="supabase">Supabase</option></select></div><div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="queue-status" class="bdlc-select"><option value="open">Solo abiertos</option><option value="pending">Pendientes</option><option value="error">Errores</option><option value="blocked">Bloqueados</option><option value="waiting">Esperando reintento</option><option value="synced">Sincronizados</option><option value="all">Todos</option></select></div><div class="bdlc-field"><label class="bdlc-label">Tabla</label><input id="queue-table-filter" class="bdlc-input" type="search" placeholder="matriculas_periodo"></div><div class="bdlc-field"><label class="bdlc-label">Cédula o ID</label><input id="queue-cedula" class="bdlc-input" type="search"></div></div><div class="bdlc-actions"><button id="queue-refresh" class="bdlc-button secondary" type="button">Actualizar cola</button><button id="queue-sync" class="bdlc-button" type="button">Procesar selección</button><button id="queue-retry-errors" class="bdlc-button warning" type="button">Reintentar errores</button></div><p id="queue-result-count" class="bdlc-description"></p></div><div id="queue-table" class="bdlc-empty">Leyendo cola...</div><div class="bdlc-card"><h3>Detalle del cambio</h3><pre id="queue-payload" class="bdlc-raw-output">{}</pre></div>';

      id("queue-target").addEventListener("change",renderQueue);
      id("queue-status").addEventListener("change",renderQueue);
      [id("queue-table-filter"),id("queue-cedula")].forEach(function(input){
        if(input){ input.addEventListener("input",function(){ clearTimeout(input.__timer); input.__timer = setTimeout(renderQueue,250); }); }
      });
      id("queue-refresh").addEventListener("click",refreshAll);
      id("queue-sync").addEventListener("click",function(){
        var target = text((id("queue-target") || {}).value || "all");
        var work = target === "all" ? runQueue({ confirm:true,limit:25 }) : runTarget(target,{ confirm:true,limit:25 });
        work.catch(function(error){ log(error.message,"error"); });
      });
      id("queue-retry-errors").addEventListener("click",function(){ retryErrors().catch(function(error){ log(error.message,"error"); }); });
      container.addEventListener("click",function(event){
        var view = event.target.closest && event.target.closest("[data-queue-view]");
        var retry = event.target.closest && event.target.closest("[data-queue-retry]");
        var discard = event.target.closest && event.target.closest("[data-queue-discard]");
        if(view){ showPayload(view.getAttribute("data-queue-view")); }
        if(retry){ retryOne(retry.getAttribute("data-queue-retry")).catch(function(error){ log(error.message,"error"); }); }
        if(discard){ discardOne(discard.getAttribute("data-queue-discard")).catch(function(error){ log(error.message,"error"); }); }
      });
    }
    return refreshAll();
  }

  function refreshAll(){
    return Promise.all([refreshCounts(),loadQueue()]).then(function(result){ return result[0]; });
  }

  function bindButton(name,handler,flag){
    var button = id(name);
    if(!button || button.hasAttribute("data-bdlc-action") || button.getAttribute("data-bdlc-owned") === "ui" || button[flag]){ return; }
    button[flag] = true;
    button.addEventListener("click",handler);
  }

  function bind(){
    bindButton("bl2-btn-push-google",function(){ runTarget("google",{ confirm:true,limit:25 }).catch(function(error){ log(error.message,"error"); }); },"__syncGoogle");
    bindButton("bl2-btn-push-firebase",function(){ runTarget("firebase",{ confirm:true,limit:25 }).catch(function(error){ log(error.message,"error"); }); },"__syncFirebase");
    bindButton("bl2-btn-push-supabase",function(){ runTarget("supabase",{ confirm:true,limit:25 }).catch(function(error){ log(error.message,"error"); }); },"__syncSupabase");
    bindButton("bl2-btn-sync-queue",function(){ runQueue({ confirm:true,limit:25 }).catch(function(error){ log(error.message,"error"); }); },"__syncQueue");

    if(!eventsBound){
      eventsBound = true;
      window.addEventListener("bdlocal:changes-created",refreshAll);
      window.addEventListener("bdlocal:sync-v2-finished",refreshAll);
      window.addEventListener("bl2:period-changed",refreshAll);
      window.addEventListener("bl2:app-refreshed",refreshAll);
    }
    return mountQueue(id("bl2-queue-slot"));
  }

  window.BDLSyncUIBridge = {
    version:VERSION,
    maxBatchSize:MAX_BATCH_SIZE,
    manualOnly:true,
    bind:bind,
    mountQueue:mountQueue,
    refreshCounts:refreshCounts,
    refreshQueue:loadQueue,
    refreshAll:refreshAll,
    runTarget:runTarget,
    runQueue:runQueue,
    retryOne:retryOne,
    retryErrors:retryErrors,
    discardOne:discardOne,
    safeBatch:safeBatch,
    getSnapshot:function(){ return lastCounts || blankCounts(); },
    getQueueSnapshot:function(){ return rows.slice(); },
    getTargetState:function(target){ return targetCounts(lastCounts || blankCounts(),text(target).toLowerCase()); }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }
})(window,document);
