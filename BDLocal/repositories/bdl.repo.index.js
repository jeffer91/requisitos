/* =========================================================
Archivo: bdl.repo.index.js
Ruta: /BDLocal/repositories/bdl.repo.index.js
Función:
- Crear el punto de entrada de repositorios de BDLocal.
- Centralizar acceso a BL2DB sin cambiar todavía la estructura actual.
- Servir como puente temporal para futuras tablas: personas, matriculas_periodo, requisitos_estudiante, notas_titulacion y cambios_pendientes.
Con qué se conecta:
- BDLocal/bl2.db.js
- BDLocal/services/bdl.service.index.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var repos = Object.create(null);

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function db(){
    return window.BL2DB || null;
  }

  function stores(){
    return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {};
  }

  function register(name, repo){
    name = text(name);
    if(!name || !repo){ return false; }
    repos[name] = repo;
    return true;
  }

  function get(name){
    return repos[text(name)] || null;
  }

  function requireDB(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    return Promise.resolve(current);
  }

  function getAll(storeName){
    storeName = text(storeName);
    return requireDB().then(function(current){
      return current.getAll(storeName);
    });
  }

  function put(storeName, row){
    storeName = text(storeName);
    return requireDB().then(function(current){
      return current.put(storeName, row);
    });
  }

  function queryByIndex(storeName, indexName, value){
    return requireDB().then(function(current){
      return current.queryByIndex(storeName, indexName, value);
    });
  }

  window.BDLRepositories = {
    version: VERSION,
    register: register,
    get: get,
    list: function(){ return Object.keys(repos); },
    db: db,
    stores: stores,
    requireDB: requireDB,
    getAll: getAll,
    put: put,
    queryByIndex: queryByIndex
  };
})(window);
