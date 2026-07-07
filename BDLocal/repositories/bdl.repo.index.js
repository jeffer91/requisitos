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

  var VERSION = "0.2.0-block3";
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

  function storeName(key, fallback){
    var current = stores();
    return text(current[key]) || text(fallback || key);
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

  function getAll(storeNameValue){
    storeNameValue = text(storeNameValue);
    return requireDB().then(function(current){
      return current.getAll(storeNameValue);
    });
  }

  function put(storeNameValue, row){
    storeNameValue = text(storeNameValue);
    return requireDB().then(function(current){
      return current.put(storeNameValue, row);
    });
  }

  function bulkPut(storeNameValue, rows){
    storeNameValue = text(storeNameValue);
    rows = Array.isArray(rows) ? rows : [];
    return requireDB().then(function(current){
      if(typeof current.bulkPut === "function"){
        return current.bulkPut(storeNameValue, rows);
      }
      return rows.reduce(function(chain, row){
        return chain.then(function(){ return current.put(storeNameValue, row); });
      }, Promise.resolve()).then(function(){ return rows.length; });
    });
  }

  function queryByIndex(storeNameValue, indexName, value){
    return requireDB().then(function(current){
      return current.queryByIndex(storeNameValue, indexName, value);
    });
  }

  function safeGetAll(storeNameValue){
    return getAll(storeNameValue).catch(function(error){
      console.warn("[BDLRepositories] No se pudo leer store", storeNameValue, error);
      return [];
    });
  }

  function safePut(storeNameValue, row){
    return put(storeNameValue, row).catch(function(error){
      console.warn("[BDLRepositories] No se pudo guardar en store", storeNameValue, error);
      return null;
    });
  }

  function safeQueryByIndex(storeNameValue, indexName, value){
    return queryByIndex(storeNameValue, indexName, value).catch(function(error){
      console.warn("[BDLRepositories] No se pudo consultar índice", storeNameValue, indexName, error);
      return [];
    });
  }

  function byPeriodo(rows, periodoId){
    periodoId = text(periodoId);
    rows = Array.isArray(rows) ? rows : [];
    if(!periodoId){ return rows.slice(); }
    return rows.filter(function(row){ return text(row && row.periodoId) === periodoId; });
  }

  function byCedula(rows, cedula){
    cedula = text(cedula);
    rows = Array.isArray(rows) ? rows : [];
    if(!cedula){ return rows.slice(); }
    return rows.filter(function(row){ return text(row && row.cedula) === cedula; });
  }

  function paginate(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    var limit = Math.max(1, Number(options.limit || 25));
    var page = Math.max(1, Number(options.page || 1));
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / limit));
    var start = (page - 1) * limit;

    return {
      rows: rows.slice(start, start + limit),
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages
    };
  }

  window.BDLRepositories = {
    version: VERSION,
    register: register,
    get: get,
    list: function(){ return Object.keys(repos); },
    db: db,
    stores: stores,
    storeName: storeName,
    requireDB: requireDB,
    getAll: getAll,
    put: put,
    bulkPut: bulkPut,
    queryByIndex: queryByIndex,
    safeGetAll: safeGetAll,
    safePut: safePut,
    safeQueryByIndex: safeQueryByIndex,
    byPeriodo: byPeriodo,
    byCedula: byCedula,
    paginate: paginate
  };
})(window);
