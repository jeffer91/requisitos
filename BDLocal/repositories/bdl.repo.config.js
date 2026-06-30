(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  if(!B){ throw new Error("BDLRepoBase debe cargarse antes de BDLRepoConfig."); }

  function guardar(clave, valor){
    return B.put(B.stores.appConfig, {
      clave: String(clave || ""),
      valor: valor,
      updatedAt: B.now()
    });
  }

  function obtener(clave){
    return B.get(B.stores.appConfig, String(clave || ""));
  }

  function guardarPeriodoActivo(periodoId){
    return guardar("periodoActivo", periodoId || "").then(function(){
      if(window.BDLState){ window.BDLState.setPeriodoActivo(periodoId || ""); }
      return periodoId || "";
    });
  }

  function obtenerPeriodoActivo(){
    if(window.BDLState && window.BDLState.getPeriodoActivo()){
      return Promise.resolve(window.BDLState.getPeriodoActivo());
    }
    return obtener("periodoActivo").then(function(row){
      return row && row.valor ? row.valor : "";
    });
  }

  window.BDLRepoConfig = {
    guardar: guardar,
    obtener: obtener,
    guardarPeriodoActivo: guardarPeriodoActivo,
    obtenerPeriodoActivo: obtenerPeriodoActivo
  };
})(window);
