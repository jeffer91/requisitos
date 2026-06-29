/* =========================================================
Nombre completo: excel-estudiantes.repo.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-estudiantes.repo.js
Función o funciones:
- Repositorio de estudiantes local para compatibilidad.
- Lee estudiantes desde ExcelLocalRepo.
- Permite consultar activos, retirados, todos y conteos por estado.
Con qué se conecta:
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";

  function repo(){return window.ExcelLocalRepo||null;}
  function text(value){return String(value==null?"":value).trim();}
  function estado(value){return text(value||"ACTIVO").toUpperCase()==="RETIRADO"?"RETIRADO":"ACTIVO";}

  function listAll(){return repo()&&repo().listAllStudents?repo().listAllStudents():[];}

  function listByPeriod(periodId,options){
    if(repo()&&repo().listStudentsByPeriod)return repo().listStudentsByPeriod(periodId,options||{});
    periodId=text(periodId);
    return listAll().filter(function(s){return !periodId||s.periodoId===periodId;});
  }

  function listByStatus(status,periodId){
    if(repo()&&repo().listStudentsByStatus)return repo().listStudentsByStatus(status,periodId);
    return listByPeriod(periodId).filter(function(s){return estado(s.estadoMatricula)===estado(status);});
  }

  function listActive(periodId){return listByStatus("ACTIVO",periodId);}
  function listRetired(periodId){return listByStatus("RETIRADO",periodId);}

  function countByStatus(periodId){
    if(repo()&&repo().countByStatus)return repo().countByStatus(periodId);
    var out={ACTIVO:0,RETIRADO:0,TOTAL:0};
    listByPeriod(periodId).forEach(function(s){var e=estado(s.estadoMatricula);out[e]=(out[e]||0)+1;out.TOTAL+=1;});
    return out;
  }

  window.ExcelEstudiantesRepo={
    listAll:listAll,
    listByPeriod:listByPeriod,
    listByStatus:listByStatus,
    listActive:listActive,
    listRetired:listRetired,
    countByStatus:countByStatus
  };
})(window);
