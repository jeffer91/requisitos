(function(window){
  "use strict";

  window.BDLRepos = {
    base: window.BDLRepoBase,
    config: window.BDLRepoConfig,
    periodos: window.BDLRepoPeriodos,
    carreras: window.BDLRepoCarreras,
    personas: window.BDLRepoPersonas,
    estudiantes: window.BDLRepoEstudiantes,
    requisitos: window.BDLRepoRequisitos,
    notas: window.BDLRepoNotas,
    divisiones: window.BDLRepoDivisiones,
    dashboard: window.BDLRepoDashboard,
    errores: window.BDLRepoErrores
  };

  if(window.BDLRepoBase){
    window.BDLRepoBase.emit("bdlocal:repos-ready", { ready: true, at: new Date().toISOString() });
  }
})(window);
