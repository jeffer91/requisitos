/* =========================================================
Nombre completo: bl2.test.js
Ruta o ubicación: /BDLocal/bl2.test.js
Función o funciones:
- Ejecutar una certificación integral sin escribir datos ni usar internet.
- Verificar arranque, tablas, registros, servicios y conectores.
- Comprobar política manual, lote máximo y puerta única de sincronización.
- Validar estructura Firebase periodoId__cedula mediante datos simulados.
- Validar filtros, IDs estables y combinación segura de Google Sheets.
- Detectar duplicados lógicos existentes en cambios_pendientes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "3.0.0-read-only-certification";
  var state = { running:false,lastResult:null };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function db(){ return window.BL2DB || null; }
  function core(){ return window.BL2Core || null; }
  function config(){ return window.BL2Config || {}; }
  function activePeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return Promise.resolve(selected); }
    }
    return core() && typeof core().getActivePeriod === "function" ? core().getActivePeriod() : Promise.resolve(null);
  }

  function result(name,level,message,payload){ return { ok:level !== "bad",level:level,name:name,message:message,payload:payload || null,at:now() }; }
  function ok(name,message,payload){ return result(name,"ok",message,payload); }
  function warn(name,message,payload){ return result(name,"warn",message,payload); }
  function bad(name,message,payload){ return result(name,"bad",message,payload); }
  function safe(name,fn){ return Promise.resolve().then(fn).catch(function(error){ return bad(name,error && error.message ? error.message : String(error)); }); }
  function emit(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{ detail:clone(detail || {}) })); }catch(error){} }

  function registryList(registry){
    try{ return registry && typeof registry.list === "function" ? registry.list() : []; }
    catch(error){ return []; }
  }

  function missing(existing,expected){ return expected.filter(function(name){ return existing.indexOf(name) < 0; }); }

  function checkModules(){
    var required = [
      "BL2Config","BL2DB","BL2Core","BL2Backup","BL2App","BL2Test",
      "BDLRules","BDLRepositories","BDLServices","BDLocalConexiones",
      "BDLSyncTargets","BDLSyncOutbox","BDLSyncOrchestrator","BDLSyncV2",
      "BDLSyncUIBridge","BDLocalSyncFixups","BL2CloudPullSafe",
      "BL2FirebaseGuard","BDLSyncTargetFirebase"
    ];
    var absent = required.filter(function(name){ return !window[name]; });
    return Promise.resolve(absent.length ? bad("Módulos","Faltan módulos: " + absent.join(", "),{ missing:absent }) : ok("Módulos",required.length + " módulos principales disponibles."));
  }

  function checkRegistries(){
    var rules = registryList(window.BDLRules);
    var repositories = registryList(window.BDLRepositories);
    var services = registryList(window.BDLServices);
    var connectors = [];
    try{
      var status = window.BDLocalConexiones && window.BDLocalConexiones.status ? window.BDLocalConexiones.status() : {};
      connectors = Array.isArray(status.connectors) ? status.connectors : [];
    }catch(error){}
    var targets = registryList(window.BDLSyncTargets);

    var failures = {
      rules:missing(rules,["periodo.require","persona.normalize","matricula.normalize","requisitos.extract","notas.normalize","duplicados.merge","retirados.detect","sync.change","errors.collect","pipeline.import.rows","pipeline.sync.changes"]),
      repositories:missing(repositories,["periodos","estudiantes","personas","matriculas","requisitos","notas","contactos","cambios","logs","backups"]),
      services:missing(services,["periodos","estudiantes","ficha","defensas","tabla","stats","reportes","coordi"]),
      connectors:missing(connectors,["carga","tabla","ficha","stats","coordi","reportes","defensas","global"]),
      targets:missing(targets,["google","firebase","supabase"])
    };
    var failed = Object.keys(failures).filter(function(name){ return failures[name].length; });
    return Promise.resolve(failed.length ? bad("Registros centrales","Faltan registros en: " + failed.join(", "),failures) : ok("Registros centrales","Reglas, repositorios, servicios, conectores y destinos están registrados.",{ rules:rules.length,repositories:repositories.length,services:services.length,connectors:connectors.length,targets:targets }));
  }

  function checkAppReady(){
    if(!window.BL2App || typeof window.BL2App.getState !== "function"){ return Promise.resolve(bad("Arranque","BL2App.getState no está disponible.")); }
    var app = window.BL2App.getState() || {};
    if(!app.scriptsReady){ return Promise.resolve(bad("Arranque","La app inició antes de confirmar la carga de scripts.",app)); }
    if(!app.ready){ return Promise.resolve(bad("Arranque","BL2App todavía no está lista.",app)); }
    return Promise.resolve(ok("Arranque","La app inició después de cargar y verificar todos los módulos.",{ ready:app.ready,scriptsReady:app.scriptsReady,periodos:(app.periods || []).length }));
  }

  function checkDB(){
    var current = db();
    if(!current || typeof current.open !== "function"){ return Promise.resolve(bad("IndexedDB","BL2DB.open no está disponible.")); }
    return current.open().then(function(){
      var meta = typeof current.meta === "function" ? current.meta() : {};
      return meta.open ? ok("IndexedDB","La base abrió correctamente.",meta) : bad("IndexedDB","La base no aparece abierta.",meta);
    });
  }

  function checkStores(){
    var current = db();
    var meta = current && typeof current.meta === "function" ? current.meta() : {};
    var actual = Array.isArray(meta.stores) ? meta.stores : [];
    var map = {};
    Object.keys(config().stores || {}).forEach(function(name){ var storeName = text(config().stores[name]); if(storeName){ map[storeName] = true; } });
    var expected = Object.keys(map);
    var absent = expected.filter(function(name){ return actual.indexOf(name) < 0; });
    return Promise.resolve(absent.length ? bad("Tablas físicas","Faltan tablas: " + absent.join(", "),{ expected:expected,actual:actual,missing:absent }) : ok("Tablas físicas",actual.length + " tablas físicas disponibles.",{ stores:actual }));
  }

  function checkPeriods(){
    if(!core() || typeof core().getPeriods !== "function"){ return Promise.resolve(bad("Períodos","BL2Core.getPeriods no está disponible.")); }
    return core().getPeriods().then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      return rows.length ? ok("Períodos",rows.length + " período(s) registrados.",{ total:rows.length }) : warn("Períodos","La base está operativa, pero no tiene períodos registrados.");
    });
  }

  function checkActivePeriod(){
    return activePeriod().then(function(period){ return period && text(period.id) ? ok("Período activo",text(period.label || period.id),period) : warn("Período activo","No hay período activo seleccionado."); });
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
    return activePeriod().then(function(period){
      if(!period || !text(period.id)){ return warn("Consulta","Sin período activo; no se ejecutó consulta de estudiantes."); }
      if(core() && typeof core().searchStudents === "function"){
        return core().searchStudents({ periodoId:period.id,search:"",limit:1 }).then(function(data){ return ok("Consulta","Consulta de estudiantes respondió correctamente.",{ periodoId:period.id,total:Number(data && data.total || 0),rows:Array.isArray(data && data.rows) ? data.rows.length : 0 }); });
      }
      if(core() && typeof core().getStudents === "function"){
        return core().getStudents({ periodoId:period.id,limit:1 }).then(function(rows){ return ok("Consulta","Consulta de estudiantes respondió correctamente.",{ periodoId:period.id,rows:Array.isArray(rows) ? rows.length : 0 }); });
      }
      return bad("Consulta","No existe un método de consulta disponible.");
    });
  }

  function checkBackup(){
    var backup = window.BL2Backup;
    if(!backup || typeof backup.createPayload !== "function"){ return Promise.resolve(bad("Respaldo","BL2Backup.createPayload no está disponible.")); }
    return activePeriod().then(function(period){
      var options = period && text(period.id) ? { scope:"period",periodoId:period.id,periodoLabel:period.label,type:"diagnostic" } : { scope:"all",type:"diagnostic" };
      return backup.createPayload(options).then(function(payload){
        var tables = payload && payload.tables ? Object.keys(payload.tables).length : 0;
        return tables ? ok("Respaldo","El payload se generó sin guardar ni descargar.",{ scope:payload.scope,tables:tables,summary:payload.summary }) : bad("Respaldo","El payload no contiene tablas.");
      });
    });
  }

  function checkSyncPolicy(){
    var cfg = config();
    var policy = cfg.sync || {};
    var firebase = cfg.firebase || {};
    var problems = [];
    if(policy.manualOnly !== true || policy.automatic !== false){ problems.push("La política general no es solo manual."); }
    if(policy.syncOnIdle !== false || policy.syncOnClose !== false){ problems.push("Quedó habilitado un disparador por inactividad o cierre."); }
    if(Number(policy.maxBatchSize || 25) > 25){ problems.push("El lote general supera 25."); }
    if(firebase.manualOnly !== true || firebase.automatic !== false){ problems.push("Firebase no está declarado como manual."); }
    if(firebase.firebaseDaily === true || firebase.syncOncePerDay === true){ problems.push("Firebase conserva una marca diaria automática."); }
    if(Number(firebase.maxBatchSize || firebase.batchSize || 25) > 25){ problems.push("El lote Firebase supera 25."); }

    var statusPromise = window.BDLSyncV2 && typeof window.BDLSyncV2.status === "function" ? window.BDLSyncV2.status() : Promise.resolve(null);
    return Promise.resolve(statusPromise).then(function(status){
      status = status || {};
      if(status.manualOnly !== true || status.automatic !== false){ problems.push("BDLSyncV2 no reporta modo manual."); }
      if(status.outboxReady !== true){ problems.push("La cola segura no está lista."); }
      if(status.orchestratorReady !== true){ problems.push("El orquestador no está listo."); }
      if(status.firebaseTargetReady !== true){ problems.push("El destino Firebase no está registrado."); }
      var fixups = window.BDLocalSyncFixups && typeof window.BDLocalSyncFixups.status === "function" ? window.BDLocalSyncFixups.status() : {};
      if(!fixups.installed || !fixups.manager || !fixups.legacy || !fixups.ui){ problems.push("La puerta única no quedó instalada en todas las rutas."); }
      return problems.length ? bad("Política de sincronización",problems.join(" "),{ config:policy,firebase:firebase,status:status,fixups:fixups }) : ok("Política de sincronización","Solo manual, sin cierre/inactividad y con máximo 25.",{ status:status,fixups:fixups });
    });
  }

  function checkFirebaseShape(){
    var target = window.BDLSyncTargetFirebase;
    if(!target){ return Promise.resolve(bad("Firebase seguro","BDLSyncTargetFirebase no está disponible.")); }
    var period = "2026-01__2026-06";
    var cedula = "0123456789";
    var firstId = target.documentId(period,cedula);
    var secondId = target.documentId(period,cedula);
    var groups = target.groupChanges([
      { id:"c1",periodoId:period,cedula:cedula,payload:{ periodoId:period,cedula:cedula } },
      { id:"c2",periodoId:period,cedula:cedula,payload:{ periodoId:period,cedula:cedula } }
    ],{ periodoId:period,limit:25 });
    var limited = target.safeRows(new Array(30).fill(0).map(function(_,index){ return { id:"x" + index }; }),{ limit:100 });
    var problems = [];
    if(firstId !== period + "__" + cedula || firstId !== secondId){ problems.push("El ID Firebase no es estable."); }
    if(!groups || groups.groups.length !== 1 || groups.groups[0].changeIds.length !== 2){ problems.push("Dos cambios del mismo estudiante no se consolidan."); }
    if(limited.length !== 25){ problems.push("El destino Firebase no limita a 25."); }
    return Promise.resolve(problems.length ? bad("Firebase seguro",problems.join(" "),{ documentId:firstId,groups:groups,limited:limited.length }) : ok("Firebase seguro","ID estable, consolidación por estudiante y límite de 25 verificados sin conexión.",{ documentId:firstId,groups:groups.groups.length,changes:groups.groups[0].changeIds.length,limit:limited.length }));
  }

  function checkSheetsSafety(){
    var safePull = window.BL2CloudPullSafe;
    var facade = window.BL2CloudPull;
    if(!safePull || !safePull.diagnostics){ return Promise.resolve(bad("Google Sheets seguro","La API segura de diagnóstico no está disponible.")); }
    var problems = [];
    var technical = safePull.technicalTablesIgnored || [];
    ["cambios","logs","sync_meta","cambiosPendientes"].forEach(function(name){ if(technical.indexOf(name) < 0){ problems.push("No se ignora " + name + "."); } });
    if(!facade || facade.compatibilityOnly !== true){ problems.push("La implementación antigua no quedó como fachada."); }

    var extracted = safePull.extractTables({ tables:{ Estudiantes:[{ cedula:"0123456789" }],Cambios:[{ id:"x" }],Logs:[{ id:"l" }],Sync_Meta:[{ key:"s" }] } });
    if(!extracted.estudiantes || !extracted.cambios || !extracted.logs || !extracted.sync_meta){ problems.push("La clasificación de tablas no reconoce la prueba simulada."); }

    var period = { id:"2026-01__2026-06",label:"Prueba" };
    var requirement = { cedula:"0123456789",periodoId:period.id,requisito:"Académico" };
    var id1 = safePull.diagnostics.stableRowId("requisitos",requirement,period);
    var id2 = safePull.diagnostics.stableRowId("requisitos",clone(requirement),period);
    if(id1 !== id2){ problems.push("El ID de requisito no es estable."); }

    var merged = safePull.diagnostics.mergeNonEmpty({ Nombres:"Nombre completo",Carrera:"Software",correo:"local@correo.com" },{ Nombres:"",Carrera:"Sistemas" });
    if(merged.Nombres !== "Nombre completo" || merged.Carrera !== "Sistemas" || merged.correo !== "local@correo.com"){ problems.push("La combinación segura borra o no actualiza campos correctamente."); }

    return Promise.resolve(problems.length ? bad("Google Sheets seguro",problems.join(" "),{ technical:technical,id1:id1,id2:id2,merged:merged }) : ok("Google Sheets seguro","Tablas técnicas ignoradas, fachada única, IDs estables y combinación no destructiva verificados.",{ ignored:technical,stableId:id1,merged:merged }));
  }

  function checkQueueIntegrity(){
    var current = db();
    var currentOutbox = window.BDLSyncOutbox;
    if(!current || typeof current.getAll !== "function" || !currentOutbox || typeof currentOutbox.logicalKey !== "function"){ return Promise.resolve(bad("Integridad de cola","No se puede analizar cambios_pendientes.")); }
    return activePeriod().then(function(period){
      return current.getAll("cambios_pendientes").then(function(rows){
        rows = (rows || []).filter(function(row){ return !period || !period.id || !text(row.periodoId) || text(row.periodoId) === text(period.id); });
        var counts = {};
        rows.forEach(function(row){ var logical = currentOutbox.logicalKey(row); counts[logical] = (counts[logical] || 0) + 1; });
        var duplicates = Object.keys(counts).filter(function(name){ return counts[name] > 1; }).map(function(name){ return { key:name,total:counts[name] }; });
        return duplicates.length ? bad("Integridad de cola",duplicates.length + " clave(s) lógicas duplicadas en cambios_pendientes.",{ rows:rows.length,duplicates:duplicates.slice(0,20) }) : ok("Integridad de cola",rows.length + " cambio(s) revisados sin duplicados lógicos.",{ rows:rows.length });
      });
    });
  }

  function checkUIOwnership(){
    var scripts = Array.prototype.slice.call(document.scripts || []).map(function(script){ return text(script.getAttribute("src") || script.src); });
    var legacyLoaded = scripts.filter(function(src){ return src.indexOf("bdlocal-modal.js") >= 0 || src.indexOf("bdl.migration.legacy-v2.ui.js") >= 0; });
    var pullButton = document.getElementById("bl2-btn-pull-sheets");
    var problems = [];
    if(legacyLoaded.length){ problems.push("Se cargaron interfaces antiguas."); }
    if(!pullButton){ problems.push("No existe el botón Traer Google Sheets."); }
    else if(pullButton.getAttribute("data-cloud-pull-owner") !== "safe"){ problems.push("El botón de Google Sheets no pertenece al flujo seguro."); }
    if(!window.BDLSyncUIBridge || window.BDLSyncUIBridge.__singleSyncGateInstalled !== true){ problems.push("La interfaz no usa la puerta única de sincronización."); }
    return Promise.resolve(problems.length ? bad("Propiedad de interfaz",problems.join(" "),{ legacyLoaded:legacyLoaded,buttonOwner:pullButton && pullButton.getAttribute("data-cloud-pull-owner") }) : ok("Propiedad de interfaz","Sin interfaces antiguas; Sheets y sincronización tienen un único propietario."));
  }

  function checkConnections(){
    if(!window.BDLocalConexiones || typeof window.BDLocalConexiones.status !== "function"){ return Promise.resolve(bad("Pantallas","BDLocalConexiones no está disponible.")); }
    var status = window.BDLocalConexiones.status() || {};
    var connectors = Array.isArray(status.connectors) ? status.connectors : [];
    return Promise.resolve(connectors.length >= 8 ? ok("Pantallas",connectors.length + " conectores registrados.",status) : bad("Pantallas","Faltan conectores de pantallas.",status));
  }

  function summarize(results){
    var summary = { ok:true,total:results.length,passed:0,warned:0,failed:0,status:"ok",message:"Certificación BDLocal correcta y de solo lectura." };
    results.forEach(function(item){
      if(!item || item.level === "bad" || item.ok === false){ summary.failed += 1; }
      else if(item.level === "warn"){ summary.warned += 1; }
      else{ summary.passed += 1; }
    });
    if(summary.failed){ summary.ok = false; summary.status = "bad"; summary.message = "BDLocal tiene controles fallidos."; }
    else if(summary.warned){ summary.status = "warn"; summary.message = "BDLocal superó los controles técnicos con advertencias operativas."; }
    return summary;
  }

  function run(options){
    options = options || {};
    if(state.running){ return Promise.resolve({ ok:true,running:true,message:"La certificación ya está en ejecución." }); }
    state.running = true;
    emit("bl2:test-start",{ at:now(),readOnly:true,network:false });
    var tests = [
      checkModules,checkRegistries,checkAppReady,checkDB,checkStores,checkPeriods,checkActivePeriod,
      checkCounts,checkCurrentQuery,checkBackup,checkSyncPolicy,checkFirebaseShape,
      checkSheetsSafety,checkQueueIntegrity,checkUIOwnership,checkConnections
    ];
    var results = [];
    var chain = Promise.resolve();
    tests.forEach(function(testFn){ chain = chain.then(function(){ return safe("Prueba",testFn).then(function(item){ results.push(item); emit("bl2:test-step",item); }); }); });
    return chain.then(function(){
      var report = { ok:true,readOnly:true,network:false,version:VERSION,generatedAt:now(),summary:summarize(results),results:results };
      report.ok = report.summary.ok;
      state.lastResult = clone(report);
      emit("bl2:test-finish",report);
      if(options.log !== false && window.console){ console.info("[BL2 Certificación solo lectura]",report); }
      return report;
    }).catch(function(error){
      var report = { ok:false,readOnly:true,network:false,version:VERSION,generatedAt:now(),summary:{ ok:false,status:"bad",message:error.message || String(error) },results:results };
      state.lastResult = clone(report);
      emit("bl2:test-error",report);
      return report;
    }).finally(function(){ state.running = false; });
  }

  window.BL2Test = {
    version:VERSION,
    readOnly:true,
    network:false,
    run:run,
    runAll:run,
    print:function(){ return run({ log:true }); },
    getLastResult:function(){ return clone(state.lastResult); }
  };
})(window,document);
