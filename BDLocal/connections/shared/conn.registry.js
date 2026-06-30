/* =========================================================
Nombre completo: conn.registry.js
Ruta: /BDLocal/connections/shared/conn.registry.js
Función:
- Registrar conectores disponibles.
- Permitir consultar conectores por id.
- No ejecuta sincronizaciones.
========================================================= */
(function(window){
  "use strict";

  var connectors = {};

  function register(connector){
    if(!connector || !connector.id){ return false; }
    connectors[connector.id] = connector;
    return true;
  }

  function get(id){
    return connectors[id] || null;
  }

  function list(){
    return Object.keys(connectors).map(function(id){ return connectors[id]; });
  }

  function clear(){
    connectors = {};
    return true;
  }

  window.BDLConnRegistry = {
    register: register,
    get: get,
    list: list,
    clear: clear
  };
})(window);
