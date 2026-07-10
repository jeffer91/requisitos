/* =========================================================
Nombre completo: bdl.diagnostics.ui-bridge.js
Ruta o ubicación: /BDLocal/diagnostics/bdl.diagnostics.ui-bridge.js
Función o funciones:
- Montar Diagnóstico y salud dentro del Centro de Control.
- Combinar salud estructural, integridad, rendimiento y prueba de solo lectura.
- Mostrar puntuación, controles, recomendaciones y JSON técnico.
- Copiar y descargar el reporte sin modificar la base.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.4.0-control-center";
  var mounted = false;
  var running = false;
  var lastReport = null;

  function id(name){ return document.getElementById(name); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function now(){ return new Date().toISOString(); }

  function period(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return { id:text(selected.id),label:text(selected.label || selected.id) }; }
    }
    var select = id("bl2-period-select");
    var periodoId = text(select && select.value);
    return { id:periodoId,label:select && select.selectedOptions && select.selectedOptions[0] ? text(select.selectedOptions[0].textContent) : periodoId };
  }

  function safe(name,fn,fallback){
    return Promise.resolve().then(function(){ return typeof fn === "function" ? fn() : fallback; }).then(function(value){ return { name:name,ok:true,value:value }; }).catch(function(error){ return { name:name,ok:false,error:error.message || String(error),value:fallback }; });
  }

  function backups(){
    if(window.BL2Backup && typeof window.BL2Backup.listBackups === "function"){ return window.BL2Backup.listBackups(); }
    if(window.BL2DB && typeof window.BL2DB.getAll === "function"){ return window.BL2DB.getAll("backups").catch(function(){ return []; }); }
    return Promise.resolve([]);
  }

  function connections(){
    try{ return window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function" ? window.BDLocalConexiones.status() : null; }
    catch(error){ return { ok:false,error:error.message || String(error) }; }
  }

  function syncSnapshot(){
    if(window.BDLSyncUIBridge && typeof window.BDLSyncUIBridge.getSnapshot === "function"){ return window.BDLSyncUIBridge.getSnapshot(); }
    return null;
  }

  function sourceValue(results,name){
    var row = results.filter(function(item){ return item.name === name; })[0];
    return row ? row.value : null;
  }

  function uniqueRecommendations(report){
    var map = Object.create(null);
    var output = [];
    function add(value){ value = text(value); if(value && !map[value]){ map[value] = true; output.push(value); } }
    [report.general,report.performance,report.maintenance].forEach(function(source){ (source && source.recommendations || []).forEach(add); });
    if(report.health && report.health.message){ add(report.health.message); }
    if(report.test && report.test.summary && report.test.summary.message){ add(report.test.summary.message); }
    if(!report.period.id){ add("Seleccione un período para ejecutar controles de datos y cola con alcance preciso."); }
    if(!report.backups.total){ add("No existe un respaldo local registrado. Cree uno antes de realizar mantenimiento."); }
    if(!output.length){ add("BDLocal no presenta alertas importantes en los controles ejecutados."); }
    return output;
  }

  function calculateScore(report){
    var checks = [];
    function add(key,label,ok,detail,section){ checks.push({ key:key,label:label,ok:!!ok,detail:text(detail),section:section || "diagnostico" }); }

    var health = report.health || {};
    var meta = health.dbMeta || (window.BL2DB && window.BL2DB.meta ? window.BL2DB.meta() : {});
    add("db","IndexedDB abierta",!!(meta && meta.open),meta && meta.name || "Sin metadatos");
    add("version","Versión de base",num(meta && meta.version) >= 2,"Versión " + text(meta && meta.version || "—"));
    add("stores","Tablas requeridas",!(health.missingStores || []).length,(health.missingStores || []).length ? "Faltan: " + health.missingStores.join(", ") : "Completas","mantenimiento");

    var performance = report.performance || {};
    var badIndexes = (performance.indexes || []).filter(function(item){ return !item.ok; });
    add("indexes","Índices configurados",badIndexes.length === 0,badIndexes.length ? badIndexes.length + " índice(s) faltante(s)" : "Correctos","mantenimiento");
    add("counts","Lectura de tablas",(performance.counts || []).every(function(item){ return item.ok; }),"Tablas revisadas: " + (performance.counts || []).length);
    add("services","Servicios principales",!(performance.services && performance.services.results || []).some(function(item){ return !item.ok; }),"Servicios revisados: " + (performance.services && performance.services.results || []).length);

    var maintenance = report.maintenance || {};
    add("duplicates","Duplicados lógicos",num(maintenance.duplicates && maintenance.duplicates.total) === 0,num(maintenance.duplicates && maintenance.duplicates.total) + " detectado(s)","mantenimiento");
    add("incomplete","Registros completos",num(maintenance.incomplete && maintenance.incomplete.total) === 0,num(maintenance.incomplete && maintenance.incomplete.total) + " incompleto(s)","mantenimiento");
    add("orphans","Relaciones válidas",num(maintenance.orphans && maintenance.orphans.total) === 0,num(maintenance.orphans && maintenance.orphans.total) + " huérfana(s)","mantenimiento");
    add("validation","Errores de validación",num(maintenance.validationErrors) === 0,num(maintenance.validationErrors) + " error(es)","mantenimiento");
    add("blocked","Sincronización sin bloqueos",num(maintenance.blocked && maintenance.blocked.total) === 0,num(maintenance.blocked && maintenance.blocked.total) + " destino(s) bloqueado(s)","cola");

    var test = report.test || {};
    add("readonly-test","Prueba funcional de solo lectura",test.ok !== false,test.summary && test.summary.message || "Sin resultado");
    add("backup","Respaldo disponible",num(report.backups.total) > 0,num(report.backups.total) + " respaldo(s)","respaldos");

    var connectors = report.connections && Array.isArray(report.connections.connectors) ? report.connections.connectors : [];
    add("connections","Conectores de pantallas",connectors.length > 0,connectors.length + " conector(es)","pantallas");

    var passed = checks.filter(function(item){ return item.ok; }).length;
    return { passed:passed,total:checks.length,percent:checks.length ? Math.round((passed * 100) / checks.length) : 0,checks:checks };
  }

  function buildReport(results){
    var backupRows = sourceValue(results,"backups") || [];
    backupRows = Array.isArray(backupRows) ? backupRows : [];
    backupRows.sort(function(a,b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
    var report = {
      ok:true,
      readOnly:true,
      version:VERSION,
      generatedAt:now(),
      period:period(),
      health:sourceValue(results,"health") || {},
      general:sourceValue(results,"general") || {},
      performance:sourceValue(results,"performance") || {},
      maintenance:sourceValue(results,"maintenance") || {},
      test:sourceValue(results,"test") || {},
      connections:sourceValue(results,"connections") || null,
      sync:sourceValue(results,"sync") || null,
      backups:{ total:backupRows.length,last:backupRows[0] ? { id:backupRows[0].id,type:backupRows[0].type,scope:backupRows[0].scope,periodoId:backupRows[0].periodoId,createdAt:backupRows[0].createdAt } : null },
      sourceErrors:results.filter(function(item){ return !item.ok; }).map(function(item){ return { source:item.name,error:item.error }; })
    };
    report.score = calculateScore(report);
    report.ok = report.score.percent >= 85 && report.sourceErrors.length === 0;
    report.status = report.ok ? "SALUDABLE" : report.score.percent >= 65 ? "CON ADVERTENCIAS" : "REQUIERE ATENCIÓN";
    report.recommendations = uniqueRecommendations(report);
    return report;
  }

  function runDiagnostics(){
    if(running){ return Promise.resolve(lastReport || { ok:true,running:true }); }
    running = true;
    status("Ejecutando controles de solo lectura...","info");
    var tasks = [
      safe("health",function(){ return window.BDLFinalHealth && window.BDLFinalHealth.run ? window.BDLFinalHealth.run() : {}; },{}),
      safe("general",function(){ return window.BDLDiagnosticsGeneral && window.BDLDiagnosticsGeneral.run ? window.BDLDiagnosticsGeneral.run({ scope:"control-center",periodoId:period().id }) : {}; },{}),
      safe("performance",function(){ return window.BDLPerformanceAudit && window.BDLPerformanceAudit.run ? window.BDLPerformanceAudit.run() : {}; },{}),
      safe("maintenance",function(){ return window.BDLLegacyCleanup && window.BDLLegacyCleanup.analyze ? window.BDLLegacyCleanup.analyze() : {}; },{}),
      safe("test",function(){ return window.BL2Test && window.BL2Test.run ? window.BL2Test.run({ log:false }) : {}; },{}),
      safe("backups",backups,[]),
      safe("connections",connections,null),
      safe("sync",function(){ return syncSnapshot(); },null)
    ];
    return Promise.all(tasks).then(function(results){
      lastReport = buildReport(results);
      render(lastReport);
      status("Diagnóstico finalizado: " + lastReport.status + ".",lastReport.ok ? "success" : lastReport.score.percent >= 65 ? "warning" : "error");
      try{ window.dispatchEvent(new CustomEvent("bdlocal:diagnostics-finished",{ detail:lastReport })); }catch(error){}
      return lastReport;
    }).catch(function(error){
      status(error.message || String(error),"error");
      throw error;
    }).finally(function(){ running = false; });
  }

  function status(message,type){
    var box = id("diagnostics-status");
    if(box){ box.className = "bdlc-alert " + (type || "info"); box.textContent = message; }
  }

  function scoreClass(percent){ return percent >= 85 ? "ok" : percent >= 65 ? "warning" : "error"; }

  function render(report){
    var score = id("diagnostics-score");
    var checks = id("diagnostics-checks");
    var recommendations = id("diagnostics-recommendations");
    var output = id("diagnostics-json");
    if(!score || !checks || !recommendations || !output){ return; }
    score.className = "bdlc-card";
    score.innerHTML = '<div class="bdlc-header"><div><span class="bdlc-overline">Puntuación de salud</span><h3 class="bdlc-title">' + esc(report.score.percent) + '%</h3><p class="bdlc-description">' + esc(report.score.passed) + ' de ' + esc(report.score.total) + ' controles correctos.</p></div><span class="bdlc-status ' + scoreClass(report.score.percent) + '">' + esc(report.status) + '</span></div><div class="bdlc-progress"><div class="bdlc-progress-bar" style="width:' + report.score.percent + '%"></div></div>';
    checks.className = "bdlc-table-wrap";
    checks.innerHTML = '<table class="bdlc-table"><thead><tr><th>Control</th><th>Estado</th><th>Detalle</th><th>Ir a</th></tr></thead><tbody>' + report.score.checks.map(function(item){ return '<tr><td>' + esc(item.label) + '</td><td><span class="bdlc-status ' + (item.ok ? "ok" : "error") + '">' + (item.ok ? "CORRECTO" : "REVISAR") + '</span></td><td>' + esc(item.detail || "—") + '</td><td>' + (!item.ok && item.section !== "diagnostico" ? '<button class="bdlc-button subtle" type="button" data-diagnostic-section="' + esc(item.section) + '">Abrir</button>' : '—') + '</td></tr>'; }).join("") + '</tbody></table>';
    recommendations.innerHTML = report.recommendations.map(function(item){ return '<div class="bdlc-log-item"><strong>Recomendación</strong><span>' + esc(item) + '</span></div>'; }).join("");
    output.textContent = JSON.stringify(report,null,2);
  }

  function copyReport(){
    if(!navigator.clipboard || !navigator.clipboard.writeText){ return Promise.reject(new Error("El portapapeles no está disponible.")); }
    return navigator.clipboard.writeText(JSON.stringify(lastReport || {},null,2)).then(function(){ status("Reporte copiado.","success"); });
  }

  function downloadReport(){
    if(!lastReport){ throw new Error("Ejecute primero el diagnóstico."); }
    var blob = new Blob([JSON.stringify(lastReport,null,2)],{ type:"application/json;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "BDLOCAL_DIAGNOSTICO_" + now().replace(/[:.]/g,"-") + ".json";
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){ URL.revokeObjectURL(link.href); link.remove(); },1000);
    status("Reporte descargado.","success");
  }

  function openSection(section){
    var button = document.querySelector('[data-bl2-section-target="' + section + '"]');
    if(button){ button.click(); }
  }

  function mount(container){
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || id("bl2-diagnostics-slot");
    if(!container){ return Promise.resolve(null); }
    if(!mounted || container.getAttribute("data-diagnostics-mounted") !== "true"){
      mounted = true;
      container.className = "";
      container.setAttribute("data-diagnostics-mounted","true");
      container.innerHTML = '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Diagnóstico integral</h3><p>Todos los controles de esta pantalla son de solo lectura.</p></div><span class="bdlc-status ok">No modifica datos</span></div><div class="bdlc-actions"><button id="diagnostics-run" class="bdlc-button" type="button">Ejecutar diagnóstico</button><button id="diagnostics-copy" class="bdlc-button secondary" type="button">Copiar reporte</button><button id="diagnostics-download" class="bdlc-button secondary" type="button">Descargar JSON</button></div><div id="diagnostics-status" class="bdlc-alert info">Pendiente de ejecutar.</div></div><div id="diagnostics-score" class="bdlc-placeholder"><strong>Sin puntuación</strong><span>Ejecute el diagnóstico.</span></div><div class="bdlc-card"><h3>Controles</h3><div id="diagnostics-checks" class="bdlc-empty">No hay resultados todavía.</div></div><div class="bdlc-card"><h3>Recomendaciones</h3><div id="diagnostics-recommendations" class="bdlc-log-list"><div class="bdlc-empty">No hay recomendaciones todavía.</div></div></div><div class="bdlc-card"><h3>JSON técnico</h3><pre id="diagnostics-json" class="bdlc-raw-output">{}</pre></div>';
      id("diagnostics-run").addEventListener("click",function(){ runDiagnostics().catch(function(){}); });
      id("diagnostics-copy").addEventListener("click",function(){ copyReport().catch(function(error){ status(error.message,"error"); }); });
      id("diagnostics-download").addEventListener("click",function(){ try{ downloadReport(); }catch(error){ status(error.message,"error"); } });
      container.addEventListener("click",function(event){ var button = event.target.closest && event.target.closest("[data-diagnostic-section]"); if(button){ openSection(button.getAttribute("data-diagnostic-section")); } });
    }
    return Promise.resolve(container);
  }

  function migrationPreview(){
    return window.BDLLegacyCleanup && window.BDLLegacyCleanup.previewMigration ? window.BDLLegacyCleanup.previewMigration() : Promise.reject(new Error("Mantenimiento seguro no está disponible."));
  }

  function migrationRun(){
    return window.BDLLegacyCleanup && window.BDLLegacyCleanup.runMigration ? window.BDLLegacyCleanup.runMigration() : Promise.reject(new Error("Mantenimiento seguro no está disponible."));
  }

  function bind(){ return mount(id("bl2-diagnostics-slot")); }

  window.BDLDiagnosticsUIBridge = {
    version:VERSION,
    bind:bind,
    mount:mount,
    run:runDiagnostics,
    render:render,
    copyReport:copyReport,
    downloadReport:downloadReport,
    migrationPreview:migrationPreview,
    migrationRun:migrationRun,
    getLastReport:function(){ return lastReport; }
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",bind);
  }else{
    bind();
  }
})(window, document);
