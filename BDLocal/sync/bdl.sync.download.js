(function(window){
  "use strict";

  var F = window.BDLSyncFirebase;
  var S = window.BDLSyncConfig;

  if(!F || !S){ throw new Error("BDLSyncDownload requiere Firebase y configuración."); }

  function bajarEstudiantes(since){
    return F.listUpdated(S.collections.estudiantes, since, S.limites.loteBajada).then(function(rows){
      if(!window.BDLRepoEstudiantes){ throw new Error("BDLRepoEstudiantes no disponible."); }
      return window.BDLRepoEstudiantes.guardarMuchos(rows).then(function(result){
        return { rows: rows.length, result: result };
      });
    });
  }

  function bajarPeriodos(since){
    return F.listUpdated(S.collections.periodos, since, S.limites.loteBajada).then(function(rows){
      if(!window.BDLRepoPeriodos){ throw new Error("BDLRepoPeriodos no disponible."); }
      return window.BDLRepoPeriodos.guardarMuchos(rows).then(function(result){
        return { rows: rows.length, result: result };
      });
    });
  }

  window.BDLSyncDownload = {
    bajarEstudiantes: bajarEstudiantes,
    bajarPeriodos: bajarPeriodos
  };
})(window);
