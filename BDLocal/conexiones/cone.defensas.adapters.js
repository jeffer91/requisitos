/* =========================================================
Nombre completo: cone.defensas.adapters.js
Ruta o ubicación: /BDLocal/conexiones/cone.defensas.adapters.js
Función o funciones:
- Mantener hidratados los adaptadores legacy usados por DefartCore.
- Aplicar requisitos a ExcelLocalRepo y BL2DataEngine.
- Reinstalar la protección cuando cone.defensas reconstruye adaptadores.
Con qué se conecta:
- cone.defensas.js
- cone.defensas.requisitos.js
- defart.core.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-requirements-adapters";

  function requirementsBridge(){
    return window.BDLocalDefensasRequirements || null;
  }

  function hydrate(result){
    var bridge = requirementsBridge();
    if(!bridge || typeof bridge.attachRows !== "function"){
      return result;
    }

    if(Array.isArray(result)){
      return bridge.attachRows(result);
    }

    if(!result || typeof result !== "object"){
      return result;
    }

    var copy = Object.assign({}, result);

    if(Array.isArray(copy.rows)){
      copy.rows = bridge.attachRows(copy.rows);
    }

    if(Array.isArray(copy.students)){
      copy.students = bridge.attachRows(copy.students);
    }

    if(Array.isArray(copy.estudiantes)){
      copy.estudiantes = bridge.attachRows(copy.estudiantes);
    }

    return copy;
  }

  function wrap(target, name){
    if(!target || typeof target[name] !== "function"){
      return;
    }

    if(target[name].__defensasRequirementsAdapterWrapped){
      return;
    }

    var original = target[name];
    var wrapped = function(){
      return hydrate(
        original.apply(this, arguments)
      );
    };

    wrapped.__defensasRequirementsAdapterWrapped = true;
    wrapped.__original = original;
    target[name] = wrapped;
  }

  function patchTarget(target){
    [
      "listStudents",
      "getStudents",
      "listAllStudents",
      "filterStudents",
      "getRows",
      "rows",
      "all",
      "listar",
      "search",
      "getSnapshot",
      "snapshot",
      "stats"
    ].forEach(function(name){
      wrap(target, name);
    });
  }

  function patch(){
    patchTarget(window.ExcelLocalRepo);
    patchTarget(window.BL2DataEngine);
    return true;
  }

  function schedulePatch(){
    window.setTimeout(patch, 0);
  }

  window.addEventListener(
    "bdlocal:defensas-ready",
    schedulePatch
  );

  window.addEventListener(
    "bdlocal:defensas-requisitos-ready",
    schedulePatch
  );

  var attempts = 0;
  var timer = window.setInterval(function(){
    attempts += 1;
    patch();

    if(attempts >= 30){
      window.clearInterval(timer);
    }
  }, 100);

  window.BDLocalDefensasAdapters = {
    version: VERSION,
    patch: patch,
    hydrate: hydrate
  };

  patch();
})(window);
