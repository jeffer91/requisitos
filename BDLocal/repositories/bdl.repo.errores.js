(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var X = window.BDLNormError;
  if(!B || !X){ throw new Error("BDLRepoErrores requiere BDLRepoBase y BDLNormError."); }

  function guardar(error){
    return B.put(B.stores.erroresDatos, error);
  }

  function guardarMuchos(errors){
    return B.putAll(B.stores.erroresDatos, errors);
  }

  function crear(tipoError, tablaDestino, registroOriginal, mensaje, nivel){
    var error = X.crear(tipoError, tablaDestino, registroOriginal, mensaje, nivel);
    return guardar(error).then(function(){ return error; });
  }

  function pendientes(){
    return B.byIndex(B.stores.erroresDatos, "by_resuelto", false, { limit: 0 });
  }

  function porNivel(nivel){
    return B.byIndex(B.stores.erroresDatos, "by_nivel", nivel, { limit: 0 });
  }

  window.BDLRepoErrores = {
    guardar: guardar,
    guardarMuchos: guardarMuchos,
    crear: crear,
    pendientes: pendientes,
    porNivel: porNivel
  };
})(window);
