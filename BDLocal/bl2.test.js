/* =========================================================
Nombre completo: bl2.test.js
Ruta o ubicación: /BDLocal/bl2.test.js
Función o funciones:
- Ejecutar pruebas rápidas de BL2 sin escribir datos de prueba.
- Verificar IndexedDB, tablas, período, consultas, respaldo y sincronización.
- Mantener compatibilidad con BL2App y Diagnóstico y salud.
========================================================= */
(function(window){
  "use strict";

  var state = { running:false,lastResult:null };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function db(){ return window.BL2DB || null; }
  function core(){ return window.BL2Core || null; }
  function config(){ return window.BL2Config || {}; }

  function result(name,level,message,payload){
    return { ok:level !== "bad",level:level,name:name,message:message,payload:payload || null,at:now() };
  }

  function ok(name,message,payload){ return result(name,"ok",message,payload); }
  function warn(name,message,payload){ return result(name,"warn",message,payload); }
  function bad(name,message,payload){ return result(name,"bad",message,payload); }

  function safe(name,fn){
    return Promise.resolve().then(fn).catch(function(error){ return bad(name,error && error.message ? error.message : String(error)); });
  }

  function emit(name,detail){
    try{ window.dispatchEvent(new CustomEvent(name,{ detail:clone(detail || {}) })); }catch(error){}
  }

  function checkModules(){
    var required = ["BL2Config","BL2DB","BL2Core","BL2Backup","BDLRepositories","BDLServices","BDLSyncOutbox"];
    var missing = required.filter(function(name){ return !window[name]; });
    return Promise.resolve(missing.length ? bad("Módulos","Faltan módulos: " + missing.join(", "),{ missing:missing }) : ok("Módulos","Módulos principales disponibles."));
  }

  function checkDB(){
    var current = db();
    if(!current || typeof current.open !== "function"){ return Promise.resolve(bad("IndexedDB","BL2DB.open no está disponible.")); }
    return current.open().then(function(){
      var meta = typeof current.meta === "function" ? current.meta() : {};
      return ok("IndexedDB","La base abrió correctamente.",meta);
    });
  }

  function checkStores(){
    var current = db();
    var meta = current && typeof current.meta === "function" ? current.meta() : {};
    var actual = Array.isArray(meta.stores) ? meta.stores : [];
    var expected = config().stores ? Object.keys(config().stores).map(function(key){ return config().stores[key]; }).filter(Boolean) : [];
    var missing = expected.filter(function(name){ return actual.indexOf(name) < 0; });
    return Promise.resolve(missing.length ? bad("Tablas físicas","Faltan tablas: " + missing.join(", "),{ expected:expected,actual:actual,missing:missing }) : ok("Tablas físicas",actual.length + " tabla(s) disponibles.",{ stores:actual }));
  }

  function checkPeriods(){
    var current = core();
    if(!current || typeof current.getPeriods !== "function"){ return Promise.resolve(bad("Períodos","BL2Core.getPeriods no está disponible.")); }
    return current.getPeriods().then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      return rows.length ? ok("Períodos",rows.length + " período(s) registrados.",{ total:rows.length }) : warn("Períodos","La base está operativa, pero todavía no tiene períodos registrados.");
    });
  }

  function checkActivePeriod(){
    var current = core();
    if(!current || typeof current.getActivePeriod !== "function"){ return Promise.resolve(bad("Período activo","BL2Core.getActivePeriod no está disponible.")); }
    return current.getActivePeriod().then(function(period){
      return period && text(period.id) ? ok("Período activo",text(period.label || period.id),period) : warn("Período activo","No hay período activo seleccionado.");
    });
  }

  function countTable(name){
    var current = db();
    if(!current || typeof current.count !== "function"){ return Promise.resolve({ name:name,ok:false,total:0,error:"BL2DB.count no disponible." }); }
    return current.count(name).then(function(total){ return { name:name,ok:true,total:Number(total || 0) }; }).catch(function(error){ return { name:name,ok:false,total:0,error:error.message || String(error) }; });
  }

  function checkCounts(){
    var names = ["personas","matriculas_periodo","requisitos_estudiante","notas_titulacion","contactos_estudiante","cambios_pendientes","errores_validacion","backups"];
    return Promise.all(names.map(countTable)).then(function(rows){
      var failed = rows.filter(function(row){ return !row.ok; });
      return failed.length ? bad("Conteos","Fallaron " + failed.length + " conteo(s).",rows) : ok("Conteos","Conteos físicos ejecutados correctamente.",rows);
    });
  }

  function checkCurrentQuery(){
    var current = core();
    if(!current || typeof current.getActivePeriod !== "function"){ return Promise.resolve(warn("Consulta","No se pudo determinar el período activo.")); }
    return current.getActivePeriod().then(function(period){
      if(!period || !text(period.id)){ return warn("Consulta","Sin período activo; no se ejecutó consulta de estudiantes."); }
      if(typeof current.searchStudents === "function"){
        return current.searchStudents({ periodoId:period.id,search:"",limit:1 }).then(function(data){ return ok("Consulta","Consulta de estudiantes respondió correctamente.",{ periodoId:period.id,total:Number(data && data.total || 0),rows:Array.isArray(data && data.rows) ? data.rows.length : 0 }); });
      }
      if(typeof current.getStudents === "function"){
        return current.getStudents({ periodoId:period.id,limit:1 }).then(function(rows){ return ok("Consulta","Consulta de estudiantes respondió correctamente.",{ periodoId:period.id,rows:Array.isArray(rows) ? rows.length : 0 }); });
      }
      return warn("Consulta","No existe un método de consulta disponible.");
    });
  }

  function checkBackup(){
    var backup = window.BL2Backup;
    if(!backup || typeof backup.createPayload !== "function"){ return Promise.resolve(bad("Respaldo","BL2Backup.createPayload no está disponible.")); }
    return Promise.resolve(core() && core().getActivePeriod ? core().getActivePeriod() : null).then(function(period){
      var options = period && text(period.id) ? { scope:"period",periodoId:period.id,periodoLabel:period.label,type:"diagnostic" } : { scope:"all",type:"diagnostic" };
      return backup.createPayload(options).then(function(payload){
        var tables = payload && payload.tables ? Object.keys(payload.tables).length : 0;
        return tables ? ok("Respaldo","La generación de payload funciona sin guardar ni descargar.",{ scope:payload.scope,tables:tables,summary:payload.summary }) : bad("Respaldo","El payload no contiene tablas.");
      });
    });
  }

  function checkSync(){
    if(window.BDLSyncV2 && typeof window.BDLSyncV2.status === "function"){
      return Promise.resolve(window.BDLSyncV2.status()).then(function(status){ return status && status.outbox !== false ? ok("Sincronización","Motor y cola disponibles.",status) : warn("Sincronización","Motor disponible con cola pendiente de revisión.",status); });
    }
    if(window.BDLSyncOrchestrator && typeof window.BDLSyncOrchestrator.status === "function"){
      return Promise.resolve(window.BDLSyncOrchestrator.status()).then(function(status){ return ok("Sincronización","Orquestador disponible.",status); });
    }
    return Promise.resolve(bad("Sincronización","No existe motor de sincronización."));
  }

  function checkConnections(){
    if(!window.BDLocalConexiones || typeof window.BDLocalConexiones.status !== "function"){ return Promise.resolve(warn("Pantallas","BDLocalConexiones no está disponible.")); }
    var status = window.BDLocalConexiones.status() || {};
    var connectors = Array.isArray(status.connectors) ? status.connectors : [];
    return Promise.resolve(connectors.length ? ok("Pantallas",connectors.length + " conector(es) registrados.",status) : warn("Pantallas","No se detectaron conectores registrados.",status));
  }

  function summarize(results){
    var summary = { ok:true,total:results.length,passed:0,warned:0,failed:0,status:"ok",message:"Prueba BL2 correcta y de solo lectura." };
    results.forEach(function(item){
      if(!item || item.level === "bad" || item.ok === false){ summary.failed++; }
      else if(item.level === "warn"){ summary.warned++; }
      else{ summary.passed++; }
    });
    if(summary.failed){ summary.ok = false; summary.status = "bad"; summary.message = "BL2 tiene controles fallidos."; }
    else if(summary.warned){ summary.status = "warn"; summary.message = "BL2 funciona con advertencias."; }
    return summary;
  }

  function run(options){
    options = options || {};
    if(state.running){ return Promise.resolve({ ok:true,running:true,message:"La prueba ya está en ejecución." }); }
    state.running = true;
    emit("bl2:test-start",{ at:now(),readOnly:true });
    var tests = [checkModules,checkDB,checkStores,checkPeriods,checkActivePeriod,checkCounts,checkCurrentQuery,checkBackup,checkSync,checkConnections];
    var results = [];
    var chain = Promise.resolve();
    tests.forEach(function(test){ chain = chain.then(function(){ return safe("Prueba",test).then(function(item){ results.push(item); emit("bl2:test-step",item); }); }); });
    return chain.then(function(){
      var report = { ok:true,readOnly:true,generatedAt:now(),summary:summarize(results),results:results };
      report.ok = report.summary.ok;
      state.lastResult = clone(report);
      emit("bl2:test-finish",report);
      if(options.log !== false && window.console){ console.info("[BL2 Test solo lectura]",report); }
      return report;
    }).catch(function(error){
      var report = { ok:false,readOnly:true,generatedAt:now(),summary:{ ok:false,status:"bad",message:error.message || String(error) },results:results };
      state.lastResult = clone(report);
      emit("bl2:test-error",report);
      return report;
    }).finally(function(){ state.running = false; });
  }

  window.BL2Test = {
    version:"2.0.0-read-only",
    readOnly:true,
    run:run,
    runAll:run,
    print:function(){ return run({ log:true }); },
    getLastResult:function(){ return clone(state.lastResult); }
  };
})(window);
