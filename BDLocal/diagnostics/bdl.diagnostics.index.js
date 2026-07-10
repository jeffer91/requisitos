/* =========================================================
Archivo: bdl.diagnostics.index.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.index.js
Función:
- Crear el punto de entrada de diagnóstico de BDLocal.
- Registrar eventos técnicos sin depender todavía de una pantalla nueva.
- Preparar diagnóstico visible de reglas, repositorios, servicios, sync y migraciones.
Con qué se conecta:
- BDLocal/bl2.core.js
- BDLocal/bl2.app.js
- BDLocal/bl2.raw-view.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var KEY = "REQ_BDL_DIAGNOSTICS_V1";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function read(){
    try{
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(error){
      return [];
    }
  }

  function write(rows){
    try{
      window.localStorage.setItem(KEY, JSON.stringify((rows || []).slice(-300)));
    }catch(error){}
  }

  function add(scope, level, message, data){
    var rows = read();
    rows.push({
      id: "diag_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      scope: text(scope || "BDLocal"),
      level: text(level || "INFO").toUpperCase(),
      message: text(message),
      data: data || null,
      createdAt: new Date().toISOString()
    });
    write(rows);
    return rows[rows.length - 1];
  }

  function clear(){
    write([]);
    return true;
  }

  window.BDLDiagnostics = {
    version: VERSION,
    key: KEY,
    add: add,
    read: read,
    clear: clear
  };
})(window);
