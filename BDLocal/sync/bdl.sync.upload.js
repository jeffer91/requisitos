(function(window){
  "use strict";

  var Q = window.BDLSyncQueue;
  var S = window.BDLSyncConfig;

  if(!Q || !S){ throw new Error("BDLSyncUpload requiere cola y configuración."); }

  function firebaseSender(){
    if(window.BDLConnFirebase && typeof window.BDLConnFirebase.sendItem === "function"){
      return function(item){ return window.BDLConnFirebase.sendItem(item); };
    }
    if(window.BDLFirebaseUpload && typeof window.BDLFirebaseUpload.sendItem === "function"){
      return function(item){ return window.BDLFirebaseUpload.sendItem(item); };
    }
    if(window.BDLSyncFirebase && typeof window.BDLSyncFirebase.saveItem === "function"){
      return function(item){ return window.BDLSyncFirebase.saveItem(item); };
    }
    return null;
  }

  function enviarPendientes(limit){
    var result = { total: 0, ok: 0, error: 0, target: "firebase" };
    var send = firebaseSender();
    if(!send){ return Promise.reject(new Error("Firebase no disponible para subida.")); }
    return Q.pendientes(limit).then(function(items){
      result.total = items.length;
      var chain = Promise.resolve(result);
      items.forEach(function(item){
        chain = chain.then(function(){
          return Q.marcarProcesando(item)
            .then(function(){ return send(item); })
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