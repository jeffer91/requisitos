(function(window){
  "use strict";

  var S = window.BDLSyncConfig;

  if(!S){ throw new Error("BDLSyncDownload requiere configuración."); }

  function enabled(id){
    if(window.BDLConnSettings && typeof window.BDLConnSettings.isEnabled === "function"){
      return window.BDLConnSettings.isEnabled(id);
    }
    return true;
  }

  function firebaseReader(){
    if(!enabled("firebase")){ return null; }
    if(window.BDLConnFirebase && typeof window.BDLConnFirebase.listUpdated === "function"){
      return function(collectionName, since, limit){ return window.BDLConnFirebase.listUpdated(collectionName, since, limit); };
    }
    if(window.BDLFirebaseDownload && typeof window.BDLFirebaseDownload.listUpdated === "function"){
      return function(collectionName, since, limit){ return window.BDLFirebaseDownload.listUpdated(collectionName, since, limit); };
    }
    if(window.BDLSyncFirebase && typeof window.BDLSyncFirebase.listUpdated === "function"){
      return function(collectionName, since, limit){ return window.BDLSyncFirebase.listUpdated(collectionName, since, limit); };
    }
    return null;
  }

  function supabaseReader(){
    if(!enabled("supabase")){ return null; }
    if(window.BDLConnSupabase && typeof window.BDLConnSupabase.listUpdated === "function"){
      return function(collectionName, since, limit){ return window.BDLConnSupabase.listUpdated(collectionName, since, limit); };
    }
    return null;
  }

  function readCloud(collectionName, since, limit){
    var f = firebaseReader();
    var s = supabaseReader();
    if(f){
      return f(collectionName, since, limit).then(function(rows){ return { target:"firebase", rows:rows || [] }; }).catch(function(error){
        if(!s){ throw error; }
        return s(collectionName, since, limit).then(function(rows){ return { target:"supabase", rows:rows || [] }; });
      });
    }
    if(s){ return s(collectionName, since, limit).then(function(rows){ return { target:"supabase", rows:rows || [] }; }); }
    return Promise.reject(new Error("No hay nube disponible para bajada."));
  }

  function bajarEstudiantes(since){
    return readCloud(S.collections.estudiantes, since, S.limites.loteBajada).then(function(pack){
      if(!window.BDLRepoEstudiantes){ throw new Error("BDLRepoEstudiantes no disponible."); }
      return window.BDLRepoEstudiantes.guardarMuchos(pack.rows).then(function(result){ return { target:pack.target, rows:pack.rows.length, result:result }; });
    });
  }

  function bajarPeriodos(since){
    return readCloud(S.collections.periodos, since, S.limites.loteBajada).then(function(pack){
      if(!window.BDLRepoPeriodos){ throw new Error("BDLRepoPeriodos no disponible."); }
      return window.BDLRepoPeriodos.guardarMuchos(pack.rows).then(function(result){ return { target:pack.target, rows:pack.rows.length, result:result }; });
    });
  }

  window.BDLSyncDownload = {
    bajarEstudiantes: bajarEstudiantes,
    bajarPeriodos: bajarPeriodos,
    readCloud: readCloud
  };
})(window);
