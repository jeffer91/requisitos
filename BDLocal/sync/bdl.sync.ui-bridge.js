/* =========================================================
Nombre completo: bdl.sync.ui-bridge.js
Ruta o ubicación: /BDLocal/sync/bdl.sync.ui-bridge.js
Función o funciones:
- Conectar el Centro de Control con la cola real cambios_pendientes.
- Mostrar pendientes por período, tabla, cédula, destino y estado.
- Sincronizar toda la cola, un destino o un registro.
- Rehabilitar errores, mostrar payload y descartar con confirmación.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.6.0-queue-center";
  var eventsBound = false;
  var mounted = false;
  var lastCounts = null;
  var queueRows = [];
  var queueItems = [];
  var visibleItems = [];

  var TARGETS = {
    google:{ label:"Google Sheets",short:"Google",buttonId:"bl2-btn-push-google",legacyId:"bl2-btn-sync-google",kpiId:"bl2-kpi-google",statusId:"bl2-google-status",dotId:"bl2-dot-google" },
    firebase:{ label:"Firebase",short:"Firebase",buttonId:"bl2-btn-push-firebase",legacyId:"bl2-btn-sync-firebase",kpiId:"bl2-kpi-firebase",statusId:"bl2-firebase-status",dotId:"bl2-dot-firebase" },
    supabase:{ label:"Supabase",short:"Supabase",buttonId:"bl2-btn-push-supabase",legacyId:"",kpiId:"bl2-kpi-supabase",statusId:"bl2-supabase-status",dotId:"bl2-dot-supabase" }
  };

  function id(name){ return name ? document.getElementById(name) : null; }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function setText(name,value){ var el = id(name); if(el){ el.textContent = value; } }
  function outbox(){ return window.BDLSyncOutbox || null; }
  function database(){ return window.BL2DB || null; }

  function selectedPeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return { id:text(selected.id),label:text(selected.label || selected.id) }; }
    }
    var select = id("bl2-period-select");
    var pid = text(select && select.value);
    return { id:pid,label:select && select.selectedOptions && select.selectedOptions[0] ? text(select.selectedOptions[0].textContent) : pid };
  }

  function log(message,level){
    var box = id("bl2-log");
    if(box){
      var item = document.createElement("div");
      item.className = "bl2-log-item " + (level ? "is-" + level : "");
      item.innerHTML = "<strong>Sincronización</strong><span>" + esc(message) + "</span>";
      box.insertBefore(item,box.firstChild);
    }
    if(window.BL2Core && typeof window.BL2Core.log === "function"){ window.BL2Core.log(level === "error" ? "ERROR" : level === "warn" ? "WARN" : "INFO",message).catch(function(){}); }
  }

  function emptyCounts(){
    return { total:0,detail:{ google:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 },firebase:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 },supabase:{ pending:0,synced:0,error:0,blocked:0,waitingRetry:0 } } };
  }

  function detailFor(counts,target){
    counts = counts || {};
    if(counts.detail && counts.detail[target]){ return counts.detail[target]; }
    return { pending:num(counts[target]),synced:num(counts["synced" + target]),error:num(counts["errors" + target]),blocked:num(counts["blocked" + target]),waitingRetry:num(counts["waitingRetry" + target]) };
  }

  function pendingTotal(detail){ return num(detail.pending) + num(detail.error) + num(detail.blocked) + num(detail.waitingRetry); }
  function buttonFor(target){ var cfg = TARGETS[target] || {}; return id(cfg.buttonId) || id(cfg.legacyId); }

  function styleButton(target,detail,running){
    var cfg = TARGETS[target];
    var button = buttonFor(target);
    if(!cfg || !button){ return; }
    var total = pendingTotal(detail || {});
    button.disabled = !!running;
    button.classList.remove("success","warning","danger");
    if(running){ button.textContent = "Subiendo " + cfg.short + "..."; button.classList.add("warning"); return; }
    if(total){ button.textContent = "Subir " + cfg.short + " (" + total + ")"; button.classList.add("danger"); }
    else{ button.textContent = cfg.short + " actualizado"; button.classList.add("success"); }
  }

  function updateTarget(target,detail){
    var cfg = TARGETS[target];
    if(!cfg){ return; }
    detail = detail || {};
    setText(cfg.kpiId,String(pendingTotal(detail)));
    setText(cfg.statusId,"Cola " + cfg.label + ": " + num(detail.pending) + " pendiente(s), " + num(detail.waitingRetry) + " esperando, " + num(detail.blocked) + " bloqueado(s), " + num(detail.error) + " error(es).");
    var dot = id(cfg.dotId);
    if(dot){ dot.className = "bl2-dot " + (num(detail.error) || num(detail.blocked) ? "bl2-dot-bad" : num(detail.pending) || num(detail.waitingRetry) ? "bl2-dot-warn" : "bl2-dot-ok"); }
    styleButton(target,detail,false);
  }

  function publish(counts){
    lastCounts = counts || emptyCounts();
    Object.keys(TARGETS).forEach(function(target){ updateTarget(target,detailFor(lastCounts,target)); });
    renderQueueSummary();
    try{ window.dispatchEvent(new CustomEvent("bdlocal:sync-ui-updated",{ detail:{ counts:lastCounts,at:new Date().toISOString() } })); }catch(error){}
    return lastCounts;
  }

  function refreshCounts(){
    var ob = outbox();
    var current = selectedPeriod();
    if(!ob || typeof ob.counts !== "function"){ return Promise.resolve(publish(emptyCounts())); }
    return ob.counts({ periodoId:current.id }).then(publish).catch(function(error){ log("No se pudieron leer los pendientes: " + (error.message || String(error)),"warn"); return publish(lastCounts || emptyCounts()); });
  }

  function summarize(result){
    result = result || {};
    if(Array.isArray(result.results)){ return result.results.map(function(item){ return text(item.message || item.target); }).join(" | "); }
    return text(result.message || (result.ok === false ? "Sincronización con alertas." : "Sincronización finalizada."));
  }

  function syncRunner(target,options){
    if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.syncTarget === "function"){ return window.BDLSyncOrchestrator.syncTarget(target,options); }
    if(window.BDLSyncV2 && typeof window.BDLSyncV2.request === "function"){ return window.BDLSyncV2.request(options); }
    return Promise.reject(new Error("No existe motor de sincronización."));
  }

  function runTarget(target,options){
    options = options || {};
    target = text(target).toLowerCase();
    var cfg = TARGETS[target];
    var current = selectedPeriod();
    if(!cfg){ return Promise.reject(new Error("Destino no reconocido.")); }
    if(!current.id){ return Promise.reject(new Error("Seleccione un período.")); }
    if(options.confirm !== false && !confirm("Subir los cambios pendientes de " + current.label + " a " + cfg.label + ". ¿Continuar?")){ return Promise.resolve({ ok:true,cancelled:true }); }
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
      limit:Math.max(1,num(options.limit || 25)),
      batchSize:Math.max(1,num(options.batchSize || options.limit || 25))
    };
    styleButton(target,{ pending:1 },true);
    return Promise.resolve(syncRunner(target,request)).then(function(result){ log(summarize(result),result && result.ok === false ? "warn" : "ok"); return refreshAll().then(function(){ return result; }); }).catch(function(error){ log(error.message || String(error),"error"); return refreshAll().then(function(){ throw error; }); });
  }

  function runQueue(options){
    options = options || {};
    var current = selectedPeriod();
    if(!current.id){ return Promise.reject(new Error("Seleccione un período.")); }
    if(options.confirm !== false && !confirm("Procesar Google Sheets, Firebase y Supabase para " + current.label + ". ¿Continuar?")){ return Promise.resolve({ ok:true,cancelled:true }); }
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){ return Promise.reject(new Error("BDLSyncV2 no está disponible.")); }
    Object.keys(TARGETS).forEach(function(target){ styleButton(target,{ pending:1 },true); });
    return window.BDLSyncV2.request({ source:"BDLSyncUIBridge.manual.all",manual:true,targets:["google","firebase","supabase"],periodoId:current.id,periodoLabel:current.label,forceRetry:!!options.forceRetry,ignoreRetry:!!options.forceRetry,limit:Math.max(1,num(options.limit || 25)),batchSize:Math.max(1,num(options.batchSize || 25)) }).then(function(result){ log(summarize(result),result && result.ok === false ? "warn" : "ok"); return refreshAll().then(function(){ return result; }); });
  }

  function fields(target){
    var ob = outbox();
    if(ob && typeof ob.fields === "function"){ return ob.fields(target); }
    if(target === "google"){ return { status:"estadoSheets",legacyStatus:"statusGoogle",attempts:"intentosSheets",error:"ultimoErrorSheets",nextRetryAt:"nextRetryAtSheets",blocked:"bloqueadoSheets" }; }
    if(target === "firebase"){ return { status:"estadoFirebase",legacyStatus:"statusFirebase",attempts:"intentosFirebase",error:"ultimoErrorFirebase",nextRetryAt:"nextRetryAtFirebase",blocked:"bloqueadoFirebase" }; }
    return { status:"estadoSupabase",legacyStatus:"statusSupabase",attempts:"intentosSupabase",error:"ultimoErrorSupabase",nextRetryAt:"nextRetryAtSupabase",blocked:"bloqueadoSupabase" };
  }

  function targetState(row,target){
    var f = fields(target);
    var status = text(row[f.status] || row[f.legacyStatus] || "PENDIENTE").toUpperCase();
    if(status === "OK" || status === "DONE" || status === "SYNCED"){ status = "SINCRONIZADO"; }
    if(status === "PENDING"){ status = "PENDIENTE"; }
    var blocked = row[f.blocked] === true;
    var retry = text(row[f.nextRetryAt]);
    var retryTime = Date.parse(retry || "");
    var waiting = retry && Number.isFinite(retryTime) && retryTime > Date.now();
    var classification = status === "SINCRONIZADO" ? "synced" : blocked ? "blocked" : waiting ? "waiting" : status === "ERROR" ? "error" : "pending";
    return { status:status,classification:classification,attempts:num(row[f.attempts]),error:text(row[f.error]),nextRetryAt:retry,blocked:blocked };
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function rowTable(row){ return text(row && (row.tabla || row.tipo || "registro")); }
  function rowCedula(row){ return text(row && (row.cedula || row.numeroIdentificacion || row.registroId || row.idEstudiantePeriodo)); }

  function expandRows(rows){
    var output = [];
    rows.forEach(function(row){
      Object.keys(TARGETS).forEach(function(target){ output.push({ row:row,target:target,state:targetState(row,target) }); });
    });
    return output;
  }

  function readFilters(){
    return { target:text((id("queue-target") || {}).value),status:text((id("queue-status") || {}).value),table:text((id("queue-table") || {}).value).toLowerCase(),cedula:text((id("queue-cedula") || {}).value).toLowerCase() };
  }

  function filterItems(items){
    var filter = readFilters();
    return items.filter(function(item){
      if(filter.target && filter.target !== "all" && item.target !== filter.target){ return false; }
      if(filter.status === "open" && item.state.classification === "synced"){ return false; }
      if(filter.status && filter.status !== "all" && filter.status !== "open" && item.state.classification !== filter.status){ return false; }
      if(filter.table && rowTable(item.row).toLowerCase().indexOf(filter.table) < 0){ return false; }
      if(filter.cedula && rowCedula(item.row).toLowerCase().indexOf(filter.cedula) < 0){ return false; }
      return true;
    }).slice(0,200);
  }

  function renderQueueSummary(){
    var target = id("queue-summary");
    if(!target){ return; }
    var counts = lastCounts || emptyCounts();
    target.innerHTML = Object.keys(TARGETS).map(function(name){ var detail = detailFor(counts,name); return '<article class="bdlc-card bdlc-kpi-card"><span>' + TARGETS[name].label + '</span><strong>' + pendingTotal(detail) + '</strong><small>' + num(detail.error) + ' error(es), ' + num(detail.blocked) + ' bloqueado(s)</small></article>'; }).join("");
  }

  function renderQueue(){
    var target = id("queue-table");
    if(!target){ return; }
    visibleItems = filterItems(queueItems);
    setText("queue-result-count",visibleItems.length + " fila(s) visibles de " + queueItems.length);
    if(!visibleItems.length){ target.className = "bdlc-empty"; target.textContent = "No existen registros para los filtros actuales."; return; }
    target.className = "bdlc-table-wrap";
    target.innerHTML = '<table class="bdlc-table"><thead><tr><th>Tabla</th><th>Cédula / ID</th><th>Destino</th><th>Estado</th><th>Intentos</th><th>Último error</th><th>Próximo intento</th><th>Acciones</th></tr></thead><tbody>' + visibleItems.map(function(item,index){
      var state = item.state;
      return '<tr><td>' + esc(rowTable(item.row)) + '</td><td>' + esc(rowCedula(item.row) || rowId(item.row)) + '</td><td>' + esc(TARGETS[item.target].label) + '</td><td><span class="bdlc-status ' + (state.classification === "synced" ? "ok" : state.classification === "pending" ? "pending" : state.classification === "waiting" ? "warning" : "error") + '">' + esc(state.classification === "waiting" ? "ESPERANDO" : state.classification === "blocked" ? "BLOQUEADO" : state.status) + '</span></td><td>' + state.attempts + '</td><td>' + esc(state.error || "—") + '</td><td>' + esc(state.nextRetryAt ? new Date(state.nextRetryAt).toLocaleString("es-EC") : "—") + '</td><td><div class="bdlc-actions"><button class="bdlc-button subtle" type="button" data-queue-view="' + index + '">Ver</button>' + (state.classification !== "synced" ? '<button class="bdlc-button secondary" type="button" data-queue-retry="' + index + '">Reintentar</button><button class="bdlc-button danger" type="button" data-queue-discard="' + index + '">Descartar</button>' : '') + '</div></td></tr>';
    }).join("") + '</tbody></table>';
  }

  function loadQueue(){
    var ob = outbox();
    var current = selectedPeriod();
    var target = id("queue-table");
    if(target){ target.className = "bdlc-empty"; target.textContent = "Leyendo cola..."; }
    if(!ob || typeof ob.list !== "function"){ queueRows = []; queueItems = []; renderQueue(); return Promise.resolve([]); }
    return ob.list({ periodoId:current.id }).then(function(rows){
      queueRows = Array.isArray(rows) ? rows : [];
      queueItems = expandRows(queueRows);
      renderQueue();
      return rows;
    }).catch(function(error){ if(target){ target.className = "bdlc-alert error"; target.textContent = error.message || String(error); } return []; });
  }

  function showPayload(index){
    var item = visibleItems[num(index)];
    var output = id("queue-payload");
    if(item && output){ output.textContent = JSON.stringify({ target:item.target,targetState:item.state,change:item.row },null,2); }
  }

  function retryOne(index){
    var item = visibleItems[num(index)];
    var ob = outbox();
    if(!item || !ob || typeof ob.resetRetries !== "function"){ return Promise.reject(new Error("No se puede reintentar este registro.")); }
    if(!confirm("Reintentar este cambio en " + TARGETS[item.target].label + ". ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    return ob.resetRetries([item.row],item.target).then(function(){ return runTarget(item.target,{ confirm:false,forceRetry:true,cedula:rowCedula(item.row),tabla:rowTable(item.row),limit:1 }); });
  }

  function retryErrors(){
    var ob = outbox();
    if(!ob || typeof ob.resetRetries !== "function"){ return Promise.reject(new Error("La rehabilitación de errores no está disponible.")); }
    var open = queueItems.filter(function(item){ return item.state.classification === "error" || item.state.classification === "blocked" || item.state.classification === "waiting"; });
    if(!open.length){ return Promise.resolve({ ok:true,message:"No existen errores para reintentar." }); }
    if(!confirm("Rehabilitar y reintentar " + open.length + " destino(s) con error o bloqueo. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    var chain = Promise.resolve();
    Object.keys(TARGETS).forEach(function(target){
      var rows = open.filter(function(item){ return item.target === target; }).map(function(item){ return item.row; });
      if(rows.length){ chain = chain.then(function(){ return ob.resetRetries(rows,target); }); }
    });
    return chain.then(function(){ return runQueue({ confirm:false,forceRetry:true }); });
  }

  function discardOne(index){
    var item = visibleItems[num(index)];
    var currentDb = database();
    if(!item || !currentDb || typeof currentDb.remove !== "function"){ return Promise.reject(new Error("No se puede descartar este registro.")); }
    var source = text(item.row._repoCambiosSource);
    var table = source === "cambios_legacy" ? "cambios" : "cambios_pendientes";
    var key = rowId(item.row);
    if(!key){ return Promise.reject(new Error("El cambio no tiene identificador.")); }
    if(!confirm("Descartar definitivamente este cambio de la cola. Esta acción no modifica el registro del estudiante, pero elimina su pendiente de sincronización. ¿Continuar?")){ return Promise.resolve({ cancelled:true }); }
    return currentDb.remove(table,key).then(function(){ log("Cambio descartado de " + table + ": " + key,"warn"); return refreshAll().then(function(){ return { ok:true,message:"Cambio descartado." }; }); });
  }

  function mountQueue(container){
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || id("bl2-queue-slot");
    if(!container){ return Promise.resolve(null); }
    if(!mounted || container.getAttribute("data-queue-mounted") !== "true"){
      mounted = true;
      container.className = "";
      container.setAttribute("data-queue-mounted","true");
      container.innerHTML = '<div id="queue-summary" class="bdlc-card-grid three"></div><div class="bdlc-card"><div class="bdlc-form"><div class="bdlc-field"><label class="bdlc-label">Destino</label><select id="queue-target" class="bdlc-select"><option value="all">Todos</option><option value="google">Google Sheets</option><option value="firebase">Firebase</option><option value="supabase">Supabase</option></select></div><div class="bdlc-field"><label class="bdlc-label">Estado</label><select id="queue-status" class="bdlc-select"><option value="open">Solo abiertos</option><option value="pending">Pendientes</option><option value="error">Errores</option><option value="blocked">Bloqueados</option><option value="waiting">Esperando reintento</option><option value="synced">Sincronizados</option><option value="all">Todos</option></select></div><div class="bdlc-field"><label class="bdlc-label">Tabla</label><input id="queue-table-filter" class="bdlc-input" type="search" placeholder="matriculas_periodo"></div><div class="bdlc-field"><label class="bdlc-label">Cédula o ID</label><input id="queue-cedula" class="bdlc-input" type="search"></div></div><div class="bdlc-actions"><button id="queue-refresh" class="bdlc-button secondary" type="button">Actualizar cola</button><button id="queue-sync" class="bdlc-button" type="button">Sincronizar pendientes</button><button id="queue-retry-errors" class="bdlc-button warning" type="button">Reintentar errores</button></div><p id="queue-result-count" class="bdlc-description"></p></div><div id="queue-table" class="bdlc-empty">Leyendo cola...</div><div class="bdlc-card"><h3>Detalle del cambio</h3><pre id="queue-payload" class="bdlc-raw-output">{}</pre></div>';

      id("queue-target").addEventListener("change",renderQueue);
      id("queue-status").addEventListener("change",renderQueue);
      [id("queue-table-filter"),id("queue-cedula")].forEach(function(input){ if(input){ input.addEventListener("input",function(){ clearTimeout(input.__timer); input.__timer = setTimeout(renderQueue,250); }); } });
      id("queue-refresh").addEventListener("click",refreshAll);
      id("queue-sync").addEventListener("click",function(){ runQueue({ confirm:true }).catch(function(error){ log(error.message,"error"); }); });
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

  function refreshAll(){ return Promise.all([refreshCounts(),loadQueue()]).then(function(result){ return result[0]; }); }

  function bindButton(name,handler,flag){
    var button = id(name);
    if(!button || button.getAttribute("data-bdlc-owned") === "ui" || button[flag]){ return; }
    button[flag] = true;
    button.addEventListener("click",handler);
  }

  function bind(){
    bindButton("bl2-btn-push-google",function(){ runTarget("google",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); },"__syncGoogle");
    bindButton("bl2-btn-push-firebase",function(){ runTarget("firebase",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); },"__syncFirebase");
    bindButton("bl2-btn-push-supabase",function(){ runTarget("supabase",{ confirm:true }).catch(function(error){ log(error.message,"error"); }); },"__syncSupabase");
    bindButton("bl2-btn-sync-queue",function(){ runQueue({ confirm:true }).catch(function(error){ log(error.message,"error"); }); },"__syncQueue");
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
    getSnapshot:function(){ return lastCounts || emptyCounts(); },
    getQueueSnapshot:function(){ return queueRows.slice(); },
    getTargetState:function(target){ return detailFor(lastCounts || emptyCounts(),text(target).toLowerCase()); }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }
})(window, document);
