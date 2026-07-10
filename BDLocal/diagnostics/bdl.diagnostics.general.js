/* =========================================================
Archivo: bdl.diagnostics.general.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.general.js
Función:
- Ejecutar diagnóstico general de BDLocal.
- Verificar reglas, repositorios, servicios, vistas, migraciones, sync y módulos críticos.
- Contar registros principales sin modificar datos.
- Mostrar cola nueva cambios_pendientes por Google, Firebase y Supabase.
- Detectar pendientes, errores, espera de reintento y bloqueos por demasiados fallos.
Con qué se conecta:
- BDLocal/bl2.db.js
- BDLocal/rules/bdl.rules.index.js
- BDLocal/repositories/bdl.repo.*.js
- BDLocal/services/bdl.service.*.js
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.0-block25";
  var MAX_ATTEMPTS = 3;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function exists(value){ return !!value; }
  function nowMs(){ return Date.now(); }

  function listFrom(obj){ try{ if(obj && typeof obj.list === "function"){ return obj.list(); } }catch(error){} return []; }
  function getRepo(name){ try{ if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){ return window.BDLRepositories.get(name); } }catch(error){} return null; }

  function safeCount(repoName, options){
    options = options || {};
    var repo = getRepo(repoName);
    if(!repo || typeof repo.list !== "function"){ return Promise.resolve({ name:repoName, ok:false, total:0, error:"Repositorio no disponible." }); }
    return Promise.resolve(repo.list(options)).then(function(rows){ rows = Array.isArray(rows) ? rows : []; return { name:repoName, ok:true, total:rows.length }; }).catch(function(error){ return { name:repoName, ok:false, total:0, error:error.message || String(error) }; });
  }

  function safeSyncStatus(){
    try{ if(window.BDLSyncV2 && typeof window.BDLSyncV2.status === "function"){ return Promise.resolve(window.BDLSyncV2.status()).catch(function(error){ return { ok:false, error:error.message || String(error) }; }); } }catch(error2){ return Promise.resolve({ ok:false, error:error2.message || String(error2) }); }
    return Promise.resolve({ ok:false, error:"BDLSyncV2 no disponible." });
  }

  function fields(target){
    target = text(target).toLowerCase();
    if(target === "google"){ return { status:"estadoSheets", legacyStatus:"statusGoogle", attempts:"intentosSheets", nextRetryAt:"nextRetryAtSheets", blocked:"bloqueadoSheets" }; }
    if(target === "firebase"){ return { status:"estadoFirebase", legacyStatus:"statusFirebase", attempts:"intentosFirebase", nextRetryAt:"nextRetryAtFirebase", blocked:"bloqueadoFirebase" }; }
    if(target === "supabase"){ return { status:"estadoSupabase", legacyStatus:"statusSupabase", attempts:"intentosSupabase", nextRetryAt:"nextRetryAtSupabase", blocked:"bloqueadoSupabase" }; }
    return { status:"estado" + target, legacyStatus:"status" + target, attempts:"intentos" + target, nextRetryAt:"nextRetryAt" + target, blocked:"bloqueado" + target };
  }

  function statusOf(row, target){ var f = fields(target); return upper((row || {})[f.status] || (row || {})[f.legacyStatus]); }
  function attemptsOf(row, target){ var f = fields(target); return Number((row || {})[f.attempts] || 0); }
  function isDone(row, target){ return statusOf(row, target) === "SINCRONIZADO"; }
  function isError(row, target){ return statusOf(row, target) === "ERROR"; }
  function isBlocked(row, target){ var f = fields(target); return (row || {})[f.blocked] === true || (isError(row, target) && attemptsOf(row, target) >= MAX_ATTEMPTS); }
  function isWaiting(row, target){
    var f = fields(target);
    var next = text((row || {})[f.nextRetryAt]);
    if(!next){ return false; }
    var t = new Date(next).getTime();
    return Number.isFinite(t) && t > nowMs();
  }

  function targetStats(rows, target){
    var result = { pending:0, synced:0, error:0, waitingRetry:0, blocked:0 };
    rows.forEach(function(row){
      if(isDone(row, target)){ result.synced++; return; }
      if(isBlocked(row, target)){ result.blocked++; return; }
      if(isWaiting(row, target)){ result.waitingRetry++; return; }
      if(isError(row, target)){ result.error++; }
      result.pending++;
    });
    return result;
  }

  function queueSummary(){
    var repo = getRepo("cambios") || getRepo("cambios_pendientes");
    if(!repo || typeof repo.list !== "function"){ return Promise.resolve({ ok:false, total:0, error:"Repositorio de cambios no disponible." }); }
    return Promise.resolve(repo.list({})).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      var byTable = {};
      rows.forEach(function(row){ var key = text(row.tabla || row.tipo || "sin_tabla") || "sin_tabla"; byTable[key] = (byTable[key] || 0) + 1; });
      return { ok:true, total:rows.length, byTable:byTable, google:targetStats(rows, "google"), firebase:targetStats(rows, "firebase"), supabase:targetStats(rows, "supabase"), targets: window.BDLSyncTargets && typeof window.BDLSyncTargets.list === "function" ? window.BDLSyncTargets.list() : [] };
    }).catch(function(error){ return { ok:false, total:0, error:error.message || String(error) }; });
  }

  function checkExpected(label, existing, expected){ expected = Array.isArray(expected) ? expected : []; existing = Array.isArray(existing) ? existing : []; var missing = expected.filter(function(name){ return existing.indexOf(name) < 0; }); return { label:label, ok:missing.length === 0, total:existing.length, existing:existing, missing:missing }; }

  function modulesStatus(){
    return { BL2Config:exists(window.BL2Config), BL2DB:exists(window.BL2DB), BL2Core:exists(window.BL2Core), BDLRules:exists(window.BDLRules), BDLRepositories:exists(window.BDLRepositories), BDLServices:exists(window.BDLServices), BDLViews:exists(window.BDLViews), BDLMigrations:exists(window.BDLMigrations), BDLDiagnostics:exists(window.BDLDiagnostics), BDLSyncTargets:exists(window.BDLSyncTargets), BDLSyncOutbox:exists(window.BDLSyncOutbox), BDLSyncOrchestrator:exists(window.BDLSyncOrchestrator), BDLSyncV2:exists(window.BDLSyncV2), BDLocalSyncManager:exists(window.BDLocalSyncManager) };
  }

  function rulesStatus(){ return checkExpected("rules", listFrom(window.BDLRules), ["periodo.require", "persona.normalize", "matricula.normalize", "requisitos.extract", "notas.normalize", "duplicados.merge", "retirados.detect", "sync.change", "errors.collect", "pipeline.import.rows", "pipeline.sync.changes"]); }
  function reposStatus(){ return checkExpected("repositories", listFrom(window.BDLRepositories), ["periodos", "estudiantes", "personas", "matriculas", "requisitos", "notas", "contactos", "cambios", "logs", "backups"]); }
  function servicesStatus(){ return checkExpected("services", listFrom(window.BDLServices), ["periodos", "estudiantes", "ficha", "defensas", "tabla", "stats", "reportes", "coordi"]); }
  function countAll(){ return Promise.all([safeCount("periodos"), safeCount("estudiantes"), safeCount("personas"), safeCount("matriculas"), safeCount("requisitos"), safeCount("notas"), safeCount("contactos"), safeCount("cambios"), safeCount("logs"), safeCount("backups")]); }

  function score(result){
    var total = 0; var passed = 0;
    function add(ok){ total++; if(ok){ passed++; } }
    Object.keys(result.modules || {}).forEach(function(key){ add(!!result.modules[key]); });
    add(result.rules.ok); add(result.repositories.ok); add(result.services.ok); add(result.sync && result.sync.outboxReady !== false); add(result.queue && result.queue.ok !== false);
    (result.counts || []).forEach(function(item){ add(item.ok); });
    return { passed:passed, total:total, percent: total ? Math.round((passed * 100) / total) : 0 };
  }

  function destinationLine(name, q){
    q = q || { pending:0, synced:0, error:0, waitingRetry:0, blocked:0 };
    return name + " " + q.pending + " pendiente(s), " + q.waitingRetry + " esperando reintento, " + q.blocked + " bloqueado(s), " + q.error + " con error reintentable.";
  }

  function recommendations(result){
    var list = [];
    if(!result.modules.BL2DB){ list.push("BL2DB no está cargado; revisar orden de scripts en bl2.html."); }
    if(!result.rules.ok){ list.push("Faltan reglas: " + result.rules.missing.join(", ")); }
    if(!result.repositories.ok){ list.push("Faltan repositorios: " + result.repositories.missing.join(", ")); }
    if(!result.services.ok){ list.push("Faltan servicios: " + result.services.missing.join(", ")); }
    if(result.queue && result.queue.total > 0){
      list.push("Cola nueva: " + destinationLine("Google", result.queue.google));
      list.push("Cola nueva: " + destinationLine("Firebase", result.queue.firebase));
      list.push("Cola nueva: " + destinationLine("Supabase", result.queue.supabase));
      if(result.queue.byTable && result.queue.byTable.notas_titulacion){ list.push("Hay notas_titulacion pendientes/listas para sincronización controlada."); }
    }
    if(result.queue && result.queue.targets && result.queue.targets.indexOf("google") >= 0 && result.queue.targets.indexOf("supabase") >= 0){ list.push("Adaptadores activos: Google y Supabase para notas_titulacion."); }
    if(result.queue && result.queue.targets && result.queue.targets.indexOf("firebase") >= 0){ list.push("Adaptador activo: Firebase para notas_titulacion."); }
    if(result.sync && result.sync.paused){ list.push("La sincronización está pausada: " + text(result.sync.pausedReason)); }
    if(!list.length){ list.push("BDLocal se ve consistente para continuar con el siguiente bloque."); }
    return list;
  }

  function run(options){
    options = options || {};
    return Promise.all([countAll(), safeSyncStatus(), queueSummary()]).then(function(values){
      var result = { ok:true, version:VERSION, checkedAt:new Date().toISOString(), scope:options.scope || "general", modules:modulesStatus(), rules:rulesStatus(), repositories:reposStatus(), services:servicesStatus(), views:listFrom(window.BDLViews), migrations:listFrom(window.BDLMigrations).map(function(item){ return item && item.version ? item.version : item; }), sync:values[1], queue:values[2], counts:values[0] };
      result.score = score(result);
      result.ok = result.score.percent >= 75 && result.modules.BL2DB && result.modules.BDLRepositories && result.modules.BDLServices;
      result.recommendations = recommendations(result);
      try{ if(window.BDLDiagnostics && typeof window.BDLDiagnostics.add === "function"){ window.BDLDiagnostics.add("BDLocalGeneral", result.ok ? "INFO" : "WARN", "Diagnóstico general ejecutado", { score:result.score, ok:result.ok, queue:result.queue }); } }catch(error){}
      return result;
    });
  }

  window.BDLDiagnosticsGeneral = { version:VERSION, run:run, modulesStatus:modulesStatus, rulesStatus:rulesStatus, reposStatus:reposStatus, servicesStatus:servicesStatus, queueSummary:queueSummary };
})(window);
