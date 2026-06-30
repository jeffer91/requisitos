(function(window){
  "use strict";

  var Q = window.BDLSyncQueue;
  var S = window.BDLSyncConfig;

  if(!Q || !S){ throw new Error("BDLSyncUpload requiere cola y configuración."); }

  function isEnabled(id){
    if(window.BDLConnSettings && typeof window.BDLConnSettings.isEnabled === "function"){
      return window.BDLConnSettings.isEnabled(id);
    }
    return true;
  }

  function firebaseSender(){
    if(!isEnabled("firebase")){ return null; }
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

  function supabaseSender(){
    if(!isEnabled("supabase")){ return null; }
    if(window.BDLConnSupabase && typeof window.BDLConnSupabase.sendItem === "function"){
      return function(item){ return window.BDLConnSupabase.sendItem(item); };
    }
    return null;
  }

  function sendWithFallback(item){
    var firebase = firebaseSender();
    var supabase = supabaseSender();
    if(firebase){
      return firebase(item).then(function(result){ return { target:"firebase", result:result }; }).catch(function(firebaseError){
        if(!supabase){ throw firebaseError; }
        return supabase(item).then(function(result){
          return { target:"supabase", fallbackFrom:"firebase", firebaseError:firebaseError && firebaseError.message ? firebaseError.message : String(firebaseError), result:result };
        });
      });
    }
    if(supabase){
      return supabase(item).then(function(result){ return { target:"supabase", fallbackFrom:"firebase_no_disponible", result:result }; });
    }
    return Promise.reject(new Error("No hay nube disponible para subida. Firebase y Supabase están pausados o no configurados."));
  }

  function enviarPendientes(limit){
    var result = { total: 0, ok: 0, error: 0, target: "auto", firebase:0, supabase:0, details:[] };
    return Q.pendientes(limit).then(function(items){
      result.total = items.length;
      var chain = Promise.resolve(result);
      items.forEach(function(item){
        chain = chain.then(function(){
          return Q.marcarProcesando(item)
            .then(function(){ return sendWithFallback(item); })
            .then(function(sent){
              result.ok += 1;
              if(sent.target === "supabase"){ result.supabase += 1; }
              else{ result.firebase += 1; }
              result.details.push({ id:item.id, target:sent.target, fallbackFrom:sent.fallbackFrom || "" });
              return Q.marcarSincronizado(item);
            })
            .catch(function(error){
              result.error += 1;
              result.details.push({ id:item.id, ok:false, error:error && error.message ? error.message : String(error) });
              return Q.marcarError(item, error);
            })
            .then(function(){ return result; });
        });
      });
      return chain;
    });
  }

  window.BDLSyncUpload = { enviarPendientes: enviarPendientes, sendWithFallback: sendWithFallback };
})(window);
