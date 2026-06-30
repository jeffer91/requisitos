(function(window){
  "use strict";

  var Q = window.BDLSyncQueue;
  var F = window.BDLSyncFirebase;
  var S = window.BDLSyncConfig;

  if(!Q || !F || !S){ throw new Error("BDLSyncUpload requiere cola, Firebase y configuración."); }

  function enviarPendientes(limit){
    var result = { total: 0, ok: 0, error: 0 };
    return Q.pendientes(limit).then(function(items){
      result.total = items.length;
      var chain = Promise.resolve(result);
      items.forEach(function(item){
        chain = chain.then(function(){
          return Q.marcarProcesando(item)
            .then(function(){ return F.saveItem(item); })
            .then(function(){ result.ok += 1; return Q.marcarSincronizado(item); })
            .catch(function(error){ result.error += 1; return Q.marcarError(item, error); })
            .then(function(){ return result; });
        });
      });
      return chain;
    });
  }

  window.BDLSyncUpload = { enviarPendientes: enviarPendientes };
})(window);
