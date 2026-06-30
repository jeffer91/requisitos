(function(window){
  "use strict";

  function save(normalized, validation, options){
    options = options || {};
    normalized = normalized || {};
    validation = validation || {};

    if(validation.ok === false && options.allowErrors !== true){
      return Promise.resolve({ ok:false, saved:0, total: normalized.total || 0, errors: (validation.errors || []).length, message:"La carga tiene errores y no fue guardada." });
    }

    if(!window.BDLRepoEstudiantes){
      return Promise.reject(new Error("BDLRepoEstudiantes no está disponible."));
    }

    var rows = normalized.rowsMapeadas || [];
    return window.BDLRepoEstudiantes.guardarMuchos(rows, null).then(function(result){
      var tasks = [];
      if(window.BDLRepoCarreras){ tasks.push(window.BDLRepoCarreras.guardarDesdeEstudiantes(rows)); }
      if(window.BDLRepoRequisitos){ tasks.push(window.BDLRepoRequisitos.guardarCatalogo()); }
      if(window.BDLRepoDashboard && normalized.periodoDetectado && normalized.periodoDetectado.periodoId){
        tasks.push(window.BDLRepoDashboard.recalcularBasico(normalized.periodoDetectado.periodoId));
      }
      return Promise.all(tasks).then(function(){
        return Object.assign({ ok:true }, result);
      });
    });
  }

  window.CargaSave = { save: save };
})(window);
