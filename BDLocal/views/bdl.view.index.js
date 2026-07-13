/* =========================================================
Archivo: bdl.view.index.js
Ruta: /BDLocal/views/bdl.view.index.js
Función:
- Crear el punto de entrada de vistas/cachés reconstruibles de BDLocal.
- Registrar vistas rápidas sin convertirlas en fuente oficial de datos.
- Preparar aceleradores para Defensas, Tabla, Stats, Coordi y Reportes.
Con qué se conecta:
- BDLocal/services/bdl.service.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var views = Object.create(null);
  var CACHE_PREFIX = "REQ_BDL_VIEW_CACHE_V1:";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function key(name, periodoId){
    return CACHE_PREFIX + text(name) + ":" + text(periodoId || "global");
  }

  function register(name, view){
    name = text(name);
    if(!name || !view){ return false; }
    views[name] = view;
    return true;
  }

  function get(name){
    return views[text(name)] || null;
  }

  function clearCache(name, periodoId){
    try{ window.localStorage.removeItem(key(name, periodoId)); }catch(error){}
    return true;
  }

  window.BDLViews = {
    version: VERSION,
    cachePrefix: CACHE_PREFIX,
    key: key,
    register: register,
    get: get,
    list: function(){ return Object.keys(views); },
    clearCache: clearCache
  };
})(window);
