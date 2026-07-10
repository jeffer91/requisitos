/* =========================================================
Archivo: bdl.service.periodos.js
Ruta: /BDLocal/services/bdl.service.periodos.js
Función:
- Servicio de períodos disponibles.
- Encapsular lectura de períodos desde repositorio o BL2Core.
- Dar una API común para pantallas y filtros.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
- BDLocal/repositories/bdl.repo.periodos.js
========================================================= */
(function(window){
  "use strict";

  var Services = window.BDLServices;
  if(!Services){ return; }

  function list(){
    var repo = Services.repo("periodos");
    if(repo && typeof repo.list === "function"){
      return repo.list();
    }
    return Services.getPeriods();
  }

  function active(){
    return list().then(function(rows){
      return rows.find(function(row){ return !!(row && row.activo); }) || rows[0] || null;
    });
  }

  function getById(periodoId){
    var repo = Services.repo("periodos");
    if(repo && typeof repo.getById === "function"){
      return repo.getById(periodoId);
    }
    return list().then(function(rows){
      return rows.find(function(row){
        return String(row.id || row.periodoId || "") === String(periodoId || "");
      }) || null;
    });
  }

  var api = { list: list, active: active, getById: getById };
  Services.register("periodos", api);
  window.BDLServicePeriodos = api;
})(window);
