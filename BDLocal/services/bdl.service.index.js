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

  var VERSION = "0.2.0-block4";
  var services = Object.create(null);

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeBasic(value){
    var cfg = window.BL2Config && window.BL2Config.utils;
    if(cfg && typeof cfg.normalizeBasic === "function"){
      return cfg.normalizeBasic(value);
    }
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function normalizeSearch(value){
    return normalizeBasic(value).toLowerCase();
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

  function repo(name){
    return window.BDLRepositories && typeof window.BDLRepositories.get === "function" ? window.BDLRepositories.get(name) : null;
  }

  function repos(){
    return window.BDLRepositories || null;
  }

  function core(){
    return window.BL2Core || null;
  }

  function getStudents(options){
    var service = get("estudiantes");
    if(service && typeof service.list === "function"){
      return service.list(options || {});
    }

    var current = core();
    if(current && typeof current.getStudents === "function"){
      return current.getStudents(options || {});
    }
    return Promise.resolve([]);
  }

  function getPeriods(){
    var service = get("periodos");
    if(service && typeof service.list === "function"){
      return service.list();
    }

    var current = core();
    if(current && typeof current.getPeriods === "function"){
      return current.getPeriods();
    }
    return Promise.resolve([]);
  }

  function paginate(rows, options){
    var helper = repos();
    if(helper && typeof helper.paginate === "function"){
      return helper.paginate(rows, options || {});
    }

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

  function contains(row, value, fields){
    value = normalizeSearch(value);
    if(!value){ return true; }
    fields = Array.isArray(fields) ? fields : [];
    return fields.some(function(field){
      return normalizeSearch(row && row[field]).indexOf(value) >= 0;
    });
  }

  function sortBy(rows, key, dir){
    rows = Array.isArray(rows) ? rows.slice() : [];
    key = text(key || "nombres");
    dir = text(dir || "asc").toLowerCase() === "desc" ? -1 : 1;

    return rows.sort(function(a, b){
      var av = normalizeSearch(a && a[key]);
      var bv = normalizeSearch(b && b[key]);
      if(av < bv){ return -1 * dir; }
      if(av > bv){ return 1 * dir; }
      return 0;
    });
  }

  window.BDLServices = {
    version: VERSION,
    register: register,
    get: get,
    list: function(){ return Object.keys(services); },
    repo: repo,
    repos: repos,
    core: core,
    text: text,
    normalizeBasic: normalizeBasic,
    normalizeSearch: normalizeSearch,
    contains: contains,
    sortBy: sortBy,
    paginate: paginate,
    getStudents: getStudents,
    getPeriods: getPeriods
  };
})(window);
