/* =========================================================
Archivo: bdl.service.index.js
Ruta: /BDLocal/services/bdl.service.index.js
Función:
- Crear el punto de entrada de servicios inteligentes de BDLocal.
- Permitir que pantallas pidan datos a servicios en vez de filtrar toda la base.
- Mantener compatibilidad inicial con BL2Core mientras se crean servicios específicos.
Con qué se conecta:
- BDLocal/rules/bdl.rules.index.js
- BDLocal/repositories/bdl.repo.index.js
- BDLocal/bl2.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var services = Object.create(null);

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function register(name, service){
    name = text(name);
    if(!name || !service){ return false; }
    services[name] = service;
    return true;
  }

  function get(name){
    return services[text(name)] || null;
  }

  function core(){
    return window.BL2Core || null;
  }

  function getStudents(options){
    var current = core();
    if(current && typeof current.getStudents === "function"){
      return current.getStudents(options || {});
    }
    return Promise.resolve([]);
  }

  function getPeriods(){
    var current = core();
    if(current && typeof current.getPeriods === "function"){
      return current.getPeriods();
    }
    return Promise.resolve([]);
  }

  window.BDLServices = {
    version: VERSION,
    register: register,
    get: get,
    list: function(){ return Object.keys(services); },
    core: core,
    getStudents: getStudents,
    getPeriods: getPeriods
  };
})(window);
