/* =========================================================
Nombre completo: cont.health.repo.js
Ruta: /BDLocal/continuity/health/cont.health.repo.js
Función:
- Guardar último estado conocido de cada base.
- Versión inicial con localStorage.
========================================================= */
(function(window){
  "use strict";

  var KEY = "REQ_CONTINUITY_HEALTH_V1";

  function readAll(){
    try{ return JSON.parse(window.localStorage.getItem(KEY) || "{}"); }catch(error){ return {}; }
  }

  function writeAll(data){
    try{ window.localStorage.setItem(KEY, JSON.stringify(data || {})); }catch(error){}
    return data || {};
  }

  function set(id, status){
    var data = readAll();
    data[id] = Object.assign({ id:id, updatedAt:new Date().toISOString() }, status || {});
    writeAll(data);
    return data[id];
  }

  function get(id){ return readAll()[id] || null; }
  function list(){ var data = readAll(); return Object.keys(data).map(function(id){ return data[id]; }); }

  window.BDLContHealthRepo = { set:set, get:get, list:list };
})(window);
