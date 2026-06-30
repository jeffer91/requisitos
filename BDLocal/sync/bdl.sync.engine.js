(function(window){
  "use strict";

  var S = window.BDLSyncConfig;
  var L = window.BDLSyncLog;
  var U = window.BDLSyncUpload;
  var D = window.BDLSyncDownload;
  var C = window.BDLRepoConfig;

  if(!S || !L || !U || !D){ throw new Error("Motor de sincronización incompleto."); }

  var running = false;

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){}
  }

  function getLastSync(){
    if(!C){ return Promise.resolve(""); }
    return C.obtener("ultimaSincronizacionFirebase").then(function(row){ return row && row.valor ? row.valor : ""; });
  }

  function setLastSync(value){
    if(!C){ return Promise.resolve(value); }
    return C.guardar("ultimaSincronizacionFirebase", value).then(function(){ return value; });
  }

  function localHasStudents(){
    if(!window.BDLRepoEstudiantes){ return Promise.resolve(false); }
    return window.BDLRepoEstudiantes.listarResumen("", { limit: 1 }).then(function(rows){ return !!(rows && rows.length); }).catch(function(){ return false; });
  }

  function syncNow(options){
    options = options || {};
    if(running){ return Promise.resolve({ ok:false, message:"Sincronización ya en ejecución." }); }
    running = true;
    emit("bdlocal:sync-status", { status:S.estados.preparing, message:"Preparando sincronización" });

    var logRef = null;
    var since = "";
    var startedAt = S.now();
    var hasLocal = false;

    return L.crear("firebase", S.estados.preparing, { manual: !!options.manual })
      .then(function(log){ logRef = log; return localHasStudents(); })
      .then(function(value){ hasLocal = value; return getLastSync(); })
      .then(function(last){
        since = options.full === true || options.manual === true || !hasLocal ? "" : (last || "");
        emit("bdlocal:sync-status", { status:S.estados.uploading, message:"Subiendo cambios locales" });
        return U.enviarPendientes();
      })
      .then(function(up){
        emit("bdlocal:sync-status", { status:S.estados.downloading, message: since ? "Descargando cambios nuevos" : "Descargando base completa desde Firebase" });
        return Promise.all([D.bajarPeriodos(since), D.bajarEstudiantes(since)]).then(function(down){ return { up: up, down: down, fullDownload: !since }; });
      })
      .then(function(result){
        emit("bdlocal:sync-status", { status:S.estados.applying, message:"Actualizando estado local" });
        return setLastSync(startedAt).then(function(){ return result; });
      })
      .then(function(result){
        running = false;
        emit("bdlocal:sync-status", { status:S.estados.completed, message:"Sincronización completada" });
        return L.cerrar(logRef, S.estados.completed, result).then(function(){ return { ok:true, result:result }; });
      })
      .catch(function(error){
        running = false;
        emit("bdlocal:sync-status", { status:S.estados.error, message:error && error.message ? error.message : String(error) });
        if(logRef){ return L.cerrar(logRef, S.estados.error, { error:error && error.message ? error.message : String(error) }).then(function(){ return { ok:false, error:error }; }); }
        return { ok:false, error:error };
      });
  }

  function syncBackground(){
    setTimeout(function(){ syncNow({ manual:false }); }, 50);
    return true;
  }

  window.BDLSyncEngine = {
    syncNow: syncNow,
    syncBackground: syncBackground,
    isRunning: function(){ return running; }
  };
})(window);
