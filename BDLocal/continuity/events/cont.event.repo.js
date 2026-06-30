/* =========================================================
Nombre completo: cont.event.repo.js
Ruta: /BDLocal/continuity/events/cont.event.repo.js
Función:
- Guardar eventos de continuidad.
- Versión inicial segura con localStorage para no tocar schema aún.
========================================================= */
(function(window){
  "use strict";

  var KEY = "REQ_CONTINUITY_EVENTS_V1";
  var MAX = 1000;

  function read(){
    try{ return JSON.parse(window.localStorage.getItem(KEY) || "[]"); }catch(error){ return []; }
  }

  function write(rows){
    rows = Array.isArray(rows) ? rows.slice(-MAX) : [];
    try{ window.localStorage.setItem(KEY, JSON.stringify(rows)); }catch(error){}
    return rows;
  }

  function add(event){
    var rows = read();
    rows.push(event);
    write(rows);
    return event;
  }

  function list(){ return read(); }
  function clear(){ write([]); return true; }

  window.BDLContEventRepo = {
    add: add,
    list: list,
    clear: clear
  };
})(window);
