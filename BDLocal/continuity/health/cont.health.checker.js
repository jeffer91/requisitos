/* =========================================================
Nombre completo: cont.health.checker.js
Ruta: /BDLocal/continuity/health/cont.health.checker.js
Función:
- Probar el estado de conectores registrados.
- No sincroniza datos.
========================================================= */
(function(window){
  "use strict";

  function fallback(id, message){
    return { id:id, ok:false, status:"no_configurado", message:message || "Conector no configurado", updatedAt:new Date().toISOString() };
  }

  function checkOne(id){
    var conn = window.BDLConnRegistry && window.BDLConnRegistry.get(id);
    if(!conn){
      var missing = fallback(id, "Conector no registrado");
      if(window.BDLContHealthRepo){ window.BDLContHealthRepo.set(id, missing); }
      return Promise.resolve(missing);
    }
    var fn = conn.health || conn.test;
    if(typeof fn !== "function"){
      var noHealth = fallback(id, "Conector sin prueba de estado");
      if(window.BDLContHealthRepo){ window.BDLContHealthRepo.set(id, noHealth); }
      return Promise.resolve(noHealth);
    }
    return Promise.resolve().then(fn).then(function(result){
      result = Object.assign({ id:id, ok:!!(result && result.ok), status:(result && result.status) || ((result && result.ok) ? "ok" : "error"), updatedAt:new Date().toISOString() }, result || {});
      if(window.BDLContHealthRepo){ window.BDLContHealthRepo.set(id, result); }
      return result;
    }).catch(function(error){
      var failed = { id:id, ok:false, status:"error", message:error && error.message ? error.message : String(error), updatedAt:new Date().toISOString() };
      if(window.BDLContHealthRepo){ window.BDLContHealthRepo.set(id, failed); }
      return failed;
    });
  }

  function checkAll(){
    var ids = ["bdlocal", "firebase", "supabase", "excel", "googleSheets"];
    return Promise.all(ids.map(checkOne));
  }

  window.BDLContHealthChecker = { checkOne:checkOne, checkAll:checkAll };
})(window);
