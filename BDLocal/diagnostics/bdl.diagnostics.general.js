/* =========================================================
Archivo: bdl.diagnostics.general.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.general.js
Función:
- Ejecutar diagnóstico general de BDLocal.
- Verificar reglas, repositorios, servicios, vistas, migraciones, sync y módulos críticos.
- Contar registros principales sin modificar datos.
- Detectar problemas de carga, módulos faltantes y pendientes de sincronización.
Con qué se conecta:
- BDLocal/bl2.db.js
- BDLocal/rules/bdl.rules.index.js
- BDLocal/repositories/bdl.repo.*.js
- BDLocal/services/bdl.service.*.js
- BDLocal/sync/bdl.sync.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block10";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function exists(value){ return !!value; }

  function listFrom(obj){
    try{
      if(obj && typeof obj.list === "function"){
        return obj.list();
      }
    }catch(error){}
    return [];
  }

  function getRepo(name){
    try{
      if(window.BDLRepositories && typeof window.BDLRepositories.get === "function"){
        return window.BDLRepositories.get(name);
      }
    }catch(error){}
    return null;
  }

  function getService(name){
    try{
      if(window.BDLServices && typeof window.BDLServices.get === "function"){
        return window.BDLServices.get(name);
      }
    }catch(error){}
    return null;
  }

  function safeCount(repoName, options){
    options = options || {};
    var repo = getRepo(repoName);
    if(!repo || typeof repo.list !== "function"){
      return Promise.resolve({ name: repoName, ok:false, total:0, error:"Repositorio no disponible." });
    }
    return Promise.resolve(repo.list(options)).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      return { name: repoName, ok:true, total:rows.length };
    }).catch(function(error){
      return { name: repoName, ok:false, total:0, error:error.message || String(error) };
    });
  }

  function safeSyncStatus(){
    try{
      if(window.BDLSyncV2 && typeof window.BDLSyncV2.status === "function"){
        return Promise.resolve(window.BDLSyncV2.status()).catch(function(error){
          return { ok:false, error:error.message || String(error) };
        });
      }
    }catch(error2){
      return Promise.resolve({ ok:false, error:error2.message || String(error2) });
    }
    return Promise.resolve({ ok:false, error:"BDLSyncV2 no disponible." });
  }

  function checkExpected(label, existing, expected){
    expected = Array.isArray(expected) ? expected : [];
    existing = Array.isArray(existing) ? existing : [];
    var missing = expected.filter(function(name){ return existing.indexOf(name) < 0; });
    return {
      label: label,
      ok: missing.length === 0,
      total: existing.length,
      existing: existing,
      missing: missing
    };
  }

  function modulesStatus(){
    return {
      BL2Config: exists(window.BL2Config),
      BL2DB: exists(window.BL2DB),
      BL2Core: exists(window.BL2Core),
      BDLRules: exists(window.BDLRules),
      BDLRepositories: exists(window.BDLRepositories),
      BDLServices: exists(window.BDLServices),
      BDLViews: exists(window.BDLViews),
      BDLMigrations: exists(window.BDLMigrations),
      BDLDiagnostics: exists(window.BDLDiagnostics),
      BDLSyncTargets: exists(window.BDLSyncTargets),
      BDLSyncOutbox: exists(window.BDLSyncOutbox),
      BDLSyncOrchestrator: exists(window.BDLSyncOrchestrator),
      BDLSyncV2: exists(window.BDLSyncV2),
      BDLocalSyncManager: exists(window.BDLocalSyncManager)
    };
  }

  function rulesStatus(){
    var rules = listFrom(window.BDLRules);
    return checkExpected("rules", rules, [
      "periodo.require",
      "persona.normalize",
      "matricula.normalize",
      "requisitos.extract",
      "notas.normalize",
      "duplicados.merge",
      "retirados.detect",
      "sync.change",
      "errors.collect",
      "pipeline.import.rows",
      "pipeline.sync.changes"
    ]);
  }

  function reposStatus(){
    var repos = listFrom(window.BDLRepositories);
    return checkExpected("repositories", repos, [
      "periodos",
      "estudiantes",
      "personas",
      "matriculas",
      "requisitos",
      "notas",
      "contactos",
      "cambios",
      "logs",
      "backups"
    ]);
  }

  function servicesStatus(){
    var services = listFrom(window.BDLServices);
    return checkExpected("services", services, [
      "periodos",
      "estudiantes",
      "ficha",
      "defensas",
      "tabla",
      "stats",
      "reportes",
      "coordi"
    ]);
  }

  function countAll(){
    return Promise.all([
      safeCount("periodos"),
      safeCount("estudiantes"),
      safeCount("personas"),
      safeCount("matriculas"),
      safeCount("requisitos"),
      safeCount("notas"),
      safeCount("contactos"),
      safeCount("cambios"),
      safeCount("logs"),
      safeCount("backups")
    ]);
  }

  function score(result){
    var total = 0;
    var passed = 0;

    function add(ok){ total++; if(ok){ passed++; } }

    Object.keys(result.modules || {}).forEach(function(key){ add(!!result.modules[key]); });
    add(result.rules.ok);
    add(result.repositories.ok);
    add(result.services.ok);
    add(result.sync && result.sync.outboxReady !== false);
    (result.counts || []).forEach(function(item){ add(item.ok); });

    return {
      passed: passed,
      total: total,
      percent: total ? Math.round((passed * 100) / total) : 0
    };
  }

  function recommendations(result){
    var list = [];

    if(!result.modules.BL2DB){ list.push("BL2DB no está cargado; revisar orden de scripts en bl2.html."); }
    if(!result.rules.ok){ list.push("Faltan reglas: " + result.rules.missing.join(", ")); }
    if(!result.repositories.ok){ list.push("Faltan repositorios: " + result.repositories.missing.join(", ")); }
    if(!result.services.ok){ list.push("Faltan servicios: " + result.services.missing.join(", ")); }

    var cambios = (result.counts || []).find(function(item){ return item.name === "cambios"; });
    if(cambios && cambios.total > 0){ list.push("Hay cambios en cola; usar Sincronizar cola para procesarlos."); }

    if(result.sync && result.sync.paused){ list.push("La sincronización está pausada: " + text(result.sync.pausedReason)); }
    if(!result.modules.BDLocalSyncManager){ list.push("BDLocalSyncManager no está cargado; la cola no podrá enviar a destinos externos."); }

    if(!list.length){ list.push("BDLocal se ve consistente para continuar con el siguiente bloque."); }
    return list;
  }

  function run(options){
    options = options || {};

    return Promise.all([
      countAll(),
      safeSyncStatus()
    ]).then(function(values){
      var result = {
        ok: true,
        version: VERSION,
        checkedAt: new Date().toISOString(),
        scope: options.scope || "general",
        modules: modulesStatus(),
        rules: rulesStatus(),
        repositories: reposStatus(),
        services: servicesStatus(),
        views: listFrom(window.BDLViews),
        migrations: listFrom(window.BDLMigrations).map(function(item){ return item && item.version ? item.version : item; }),
        sync: values[1],
        counts: values[0]
      };

      result.score = score(result);
      result.ok = result.score.percent >= 75 && result.modules.BL2DB && result.modules.BDLRepositories && result.modules.BDLServices;
      result.recommendations = recommendations(result);

      try{
        if(window.BDLDiagnostics && typeof window.BDLDiagnostics.add === "function"){
          window.BDLDiagnostics.add("BDLocalGeneral", result.ok ? "INFO" : "WARN", "Diagnóstico general ejecutado", { score: result.score, ok: result.ok });
        }
      }catch(error){}

      return result;
    });
  }

  window.BDLDiagnosticsGeneral = {
    version: VERSION,
    run: run,
    modulesStatus: modulesStatus,
    rulesStatus: rulesStatus,
    reposStatus: reposStatus,
    servicesStatus: servicesStatus
  };
})(window);
