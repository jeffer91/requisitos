/* =========================================================
Archivo: bdl.rules.index.js
Ruta: /BDLocal/rules/bdl.rules.index.js
Función:
- Crear el punto de entrada de reglas de BDLocal.
- Mantener una fachada segura para mover reglas fuera de bl2.core.js sin romper pantallas actuales.
- Registrar reglas pequeñas y ejecutarlas en orden cuando los siguientes bloques las implementen.
Con qué se conecta:
- BDLocal/bl2.core.js
- BDLocal/services/bdl.service.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var registry = Object.create(null);

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function register(name, fn){
    name = text(name);
    if(!name || typeof fn !== "function"){ return false; }
    registry[name] = fn;
    return true;
  }

  function has(name){
    return !!registry[text(name)];
  }

  function run(name, payload, context){
    name = text(name);
    if(!registry[name]){
      return Promise.resolve(clone(payload));
    }

    try{
      return Promise.resolve(registry[name](clone(payload), context || {}));
    }catch(error){
      return Promise.reject(error);
    }
  }

  function pipeline(names, payload, context){
    names = Array.isArray(names) ? names : [];
    var chain = Promise.resolve(clone(payload));

    names.forEach(function(name){
      chain = chain.then(function(current){
        return run(name, current, context || {});
      });
    });

    return chain;
  }

  window.BDLRules = {
    version: VERSION,
    register: register,
    has: has,
    run: run,
    pipeline: pipeline,
    list: function(){ return Object.keys(registry); }
  };
})(window);
