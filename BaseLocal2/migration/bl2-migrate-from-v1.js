/* =========================================================
Nombre completo: bl2-migrate-from-v1.js
Ruta o ubicación: /Requisitos/BaseLocal2/migration/bl2-migrate-from-v1.js
Función o funciones:
- Copiar la Base Local actual V1 hacia el motor BL2 seleccionado.
- No borrar ni modificar la Base Local V1.
- Ejecutar validación previa y guardar reporte de migración.
- Mantener la migración manual por defecto para no hacer lento el arranque.
Con qué se conecta:
- bl2-config.js
- bl2-legacy-adapter.js
- bl2-storage.js
- bl2-migration-report.js
========================================================= */
(function(window){
  "use strict";

  var STATUS_KEY = "REQ_BL2_MIGRATOR_STATUS";
  var AUTO_KEY = "REQ_BL2_AUTO_MIGRATE_V1";
  var running = false;

  function now(){return new Date().toISOString();}
  function cfg(){return window.BL2Config || null;}
  function legacy(){return window.BL2LegacyAdapter || null;}
  function storage(){return window.BL2Storage || null;}
  function reporter(){return window.BL2MigrationReport || null;}
  function readJson(key, fallback){try{var raw = window.localStorage.getItem(key);return raw ? JSON.parse(raw) : fallback;}catch(error){return fallback;}}
  function writeJson(key, value){try{window.localStorage.setItem(key, JSON.stringify(value));}catch(error){}return value;}
  function autoAllowed(){try{return window.localStorage.getItem(AUTO_KEY) === "true";}catch(error){return false;}}

  function saveStatus(status){
    var payload = Object.assign({updatedAt:now(), autoEnabled:autoAllowed()}, status || {});
    writeJson(STATUS_KEY, payload);
    if(cfg() && typeof cfg().writeJson === "function"){cfg().writeJson(cfg().keys.migrationStatus, payload);}
    return payload;
  }

  function status(){return readJson(STATUS_KEY, {ok:true, mode:"idle", updatedAt:"", autoEnabled:autoAllowed()});}

  function emit(kind, payload){
    var detail = Object.assign({kind:kind, at:now()}, payload || {});
    try{window.dispatchEvent(new CustomEvent("bl2:migration:" + kind, {detail:detail}));}catch(error){}
    try{if(window.parent && window.parent !== window){window.parent.postMessage({type:"bl2:migration:" + kind, payload:detail}, "*");}}catch(error){}
  }

  function preview(options){
    options = options || {};
    if(!legacy() || typeof legacy().readSnapshot !== "function"){return {ok:false, errors:[{type:"legacy_unavailable", message:"No se pudo leer Base Local V1."}], totals:{periods:0, students:0, history:0}};}
    var snapshot = legacy().readSnapshot({clone:false, force:options.force === true});
    var report = reporter() && typeof reporter().summarize === "function" ? reporter().summarize(snapshot) : {ok:true, totals:{periods:(snapshot.periods||[]).length, students:(snapshot.students||[]).length, history:(snapshot.history||[]).length}, warnings:[], errors:[]};
    if(reporter() && typeof reporter().save === "function"){reporter().save(report);}
    saveStatus({ok:report.ok, mode:"preview", report:report});
    return report;
  }

  function run(options){
    options = options || {};
    if(running){return Promise.resolve(saveStatus({ok:false, mode:"running", message:"La migración BL2 ya está en ejecución."}));}
    if(!legacy() || typeof legacy().readSnapshot !== "function"){
      return Promise.resolve(saveStatus({ok:false, mode:"error", message:"Adaptador V1 no disponible."}));
    }
    if(!storage() || typeof storage().copySnapshot !== "function"){
      return Promise.resolve(saveStatus({ok:false, mode:"error", message:"Motor BL2 no disponible."}));
    }

    running = true;
    saveStatus({ok:true, mode:"starting", message:"Preparando copia segura de Base Local V1 hacia BL2."});
    emit("started", {mode:"manual"});

    var snapshot = legacy().readSnapshot({clone:false, force:options.force === true});
    var report = preview({force:false});

    if(!report.ok && options.ignoreErrors !== true){
      running = false;
      var blocked = saveStatus({ok:false, mode:"blocked", message:"Migración bloqueada por errores en el reporte.", report:report});
      emit("blocked", blocked);
      return Promise.resolve(blocked);
    }

    return storage().copySnapshot(snapshot, options).then(function(result){
      running = false;
      var finalStatus = saveStatus({ok:result && result.ok !== false, mode:"finished", message:"Copia BL2 finalizada.", report:report, result:result});
      emit("finished", finalStatus);
      return finalStatus;
    }).catch(function(error){
      running = false;
      var failed = saveStatus({ok:false, mode:"error", message:error && error.message ? error.message : String(error), report:report});
      emit("error", failed);
      return failed;
    });
  }

  function schedule(){
    if(!autoAllowed()){saveStatus({ok:true, mode:"idle", message:"Migración automática pausada. Ejecutar manualmente cuando se requiera."});return;}
    setTimeout(function(){run({force:false});}, 1200);
  }

  window.BL2Migrator = {version:"2.0.0-alpha.1",status:status,preview:preview,run:run,autoKey:AUTO_KEY};

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", schedule);
  }else{
    schedule();
  }
})(window);
