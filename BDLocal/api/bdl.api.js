(function(window){
  "use strict";

  var cfg = window.BDLConfig;
  var db = window.BDLDB;
  var state = window.BDLState;
  var cache = window.BDLCache;

  if(!cfg || !db || !state || !cache){
    throw new Error("BDLocal API requiere config, db, state y cache.");
  }

  function boot(){
    return db.open().then(function(){
      state.patch({ booted: true, bootedAt: cfg.now() });
      try{ window.localStorage.setItem(cfg.keys.lastBoot, cfg.now()); }catch(error){}
      return status();
    });
  }

  function status(){
    return {
      ok: true,
      version: cfg.version,
      dbName: cfg.dbName,
      dbVersion: cfg.dbVersion,
      booted: state.get().booted,
      bootedAt: state.get().bootedAt,
      periodoActivo: state.getPeriodoActivo(),
      updatedAt: cfg.now()
    };
  }

  function guardarConfig(clave, valor){
    return db.put(cfg.stores.appConfig, { clave: clave, valor: valor, updatedAt: cfg.now() });
  }

  function obtenerConfig(clave){
    return db.get(cfg.stores.appConfig, clave);
  }

  function listarPeriodos(options){
    var cached = cache.get("periodos", "list");
    if(cached && !(options && options.force)){ return Promise.resolve(cached); }
    return db.list(cfg.stores.periodos, options || {}).then(function(rows){
      rows.sort(function(a, b){ return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); });
      return cache.set("periodos", "list", rows, 60000);
    });
  }

  function setPeriodoActivo(periodoId){
    state.setPeriodoActivo(periodoId);
    return guardarConfig("periodoActivo", periodoId);
  }

  function listarEstudiantesResumen(options){
    options = options || {};
    var periodoId = options.periodoId || state.getPeriodoActivo();
    var page = Math.max(1, Number(options.page || 1));
    var limit = Math.max(1, Number(options.limit || cfg.defaultPageSize));
    var key = JSON.stringify({periodoId: periodoId, page: page, limit: limit});
    var cached = cache.get("estudiantes_resumen", key);
    if(cached && !options.force){ return Promise.resolve(cached); }
    return db.list(cfg.stores.estudiantesResumen, { index: periodoId ? "by_periodoId" : null, value: periodoId || null, offset: (page - 1) * limit, limit: limit }).then(function(rows){
      var result = { rows: rows, page: page, limit: limit, periodoId: periodoId, source: "BDLocal" };
      return cache.set("estudiantes_resumen", key, result, 15000);
    });
  }

  function detalleEstudiante(idEstudiantePeriodo){
    return Promise.all([
      db.get(cfg.stores.estudiantesResumen, idEstudiantePeriodo),
      db.get(cfg.stores.estudiantesDetalle, idEstudiantePeriodo),
      db.list(cfg.stores.estudianteRequisitos, { index: "by_idEstudiantePeriodo", value: idEstudiantePeriodo, limit: 0 }),
      db.list(cfg.stores.estudianteNotas, { index: "by_idEstudiantePeriodo", value: idEstudiantePeriodo, limit: 0 }),
      db.list(cfg.stores.estudianteDivisiones, { index: "by_idEstudiantePeriodo", value: idEstudiantePeriodo, limit: 0 })
    ]).then(function(parts){
      return { resumen: parts[0] || null, detalle: parts[1] || null, requisitos: parts[2], notas: parts[3], divisiones: parts[4] };
    });
  }

  function invalidate(){
    cache.clear();
    state.reset();
    return true;
  }

  window.BDLocal = {
    boot: boot,
    status: status,
    config: { guardar: guardarConfig, obtener: obtenerConfig },
    periodos: { listar: listarPeriodos, setActivo: setPeriodoActivo, activo: state.getPeriodoActivo },
    estudiantes: { resumen: listarEstudiantesResumen, detalle: detalleEstudiante },
    invalidate: invalidate,
    raw: { config: cfg, db: db, state: state, cache: cache }
  };
})(window);
