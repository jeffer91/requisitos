/* =========================================================
Nombre completo: con.global.js
Ruta o ubicación: /Requisitos/BDLocal/conexiones/con.global.js
Función:
- Conectar el módulo Global con BDLocal/BL2.
- Entregar snapshot histórico multiperíodo para análisis institucional.
- Exponer estudiantes, períodos y requisitos detectados desde cache o núcleo BL2.
Con qué se conecta:
- BDLocal/conexiones/con.index.js
- BDLocal/conexiones/con.utils.js
- Global/global.core.js
========================================================= */
(function(window){
  "use strict";

  var U = window.BDLocalConUtils;
  var hub = window.BDLocalConexiones;
  var VERSION = "1.0.0-bloque-2";

  if(!U){ throw new Error("BDLocalConUtils debe cargarse antes de con.global.js"); }

  function text(value){ return U.text ? U.text(value) : String(value == null ? "" : value).trim(); }

  function clone(value){ return U.clone ? U.clone(value) : JSON.parse(JSON.stringify(value || null)); }

  function ready(){
    if(hub && typeof hub.ready === "function"){
      return hub.ready().catch(function(){ return status(); });
    }
    return Promise.resolve(status());
  }

  function refresh(options){
    options = options || {};
    if(hub && typeof hub.refreshCache === "function"){
      return hub.refreshCache(Object.assign({ source:"ConGlobal" }, options)).catch(function(){ return U.readCache(); });
    }
    return Promise.resolve(U.readCache());
  }

  function cache(){
    try{ return U.readCache(); }
    catch(error){ return { meta:{}, periods:[], students:[], requirements:[], diagnostics:[{ message:error.message }] }; }
  }

  function normalizePeriod(period){
    if(U.normalizePeriod){ return U.normalizePeriod(period); }
    period = period || {};
    var id = text(period.periodoId || period.periodId || period.id || period.value || period.key);
    if(!id){ return null; }
    return Object.assign({}, period, { id:id, value:id, periodoId:id, label:text(period.label || period.periodoLabel || id) });
  }

  function normalizeStudent(row){
    if(U.normalizeStudent){ return U.normalizeStudent(row); }
    return Object.assign({}, row || {});
  }

  function periods(){
    return (cache().periods || []).map(normalizePeriod).filter(Boolean);
  }

  function students(filters){
    filters = filters || {};
    var rows = (cache().students || []).map(normalizeStudent);
    if(U.filterStudents){ return U.filterStudents(rows, filters); }
    return rows;
  }

  function requirements(filters){
    filters = filters || {};
    var reqs = Array.isArray(cache().requirements) ? cache().requirements : [];
    var periodoId = text(filters.periodoId || filters.periodId || "");
    var cedula = text(filters.cedula || filters.numeroIdentificacion || "");

    return reqs.filter(function(req){
      if(periodoId && text(req.periodoId || req.periodId) !== periodoId){ return false; }
      if(cedula && text(req.cedula || req.numeroIdentificacion) !== cedula){ return false; }
      return true;
    });
  }

  function detectedCareers(){
    var map = Object.create(null);

    students({ matricula:"" }).forEach(function(row){
      var nombre = text(row.NombreCarrera || row.nombreCarrera || row.carrera || row.Carrera || row._carrera);
      var codigo = text(row.CodigoCarrera || row.codigoCarrera || row.codigo || row._codigoCarrera || nombre);
      var key = (codigo || nombre).toUpperCase();
      if(!nombre){ return; }
      if(!map[key]){
        map[key] = {
          id:key,
          codigo:codigo || key,
          nombre:nombre,
          tipo:nombre.toUpperCase().indexOf("UNIVERSITARIA") >= 0 ? "UNIVERSITARIA" : "SUPERIOR"
        };
      }
    });

    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }

  function detectedRequirements(){
    var map = Object.create(null);
    var reserved = {
      id:true,
      _id:true,
      cedula:true,
      Cedula:true,
      "Cédula":true,
      numeroIdentificacion:true,
      NumeroIdentificacion:true,
      nombres:true,
      Nombres:true,
      nombre:true,
      Nombre:true,
      estudiante:true,
      Estudiante:true,
      carrera:true,
      Carrera:true,
      nombreCarrera:true,
      NombreCarrera:true,
      codigoCarrera:true,
      CodigoCarrera:true,
      periodo:true,
      Periodo:true,
      periodoId:true,
      periodId:true,
      periodoLabel:true,
      division:true,
      Division:true,
      estadoMatricula:true,
      EstadoMatricula:true,
      createdAt:true,
      updatedAt:true
    };

    requirements({}).forEach(function(req){
      var key = text(req.requisitoId || req.requisito || req.campo || req.key || req.nombre);
      if(key){ map[key] = { id:key, key:key, label:text(req.label || req.nombre || key) }; }
    });

    students({ matricula:"" }).forEach(function(row){
      Object.keys(row || {}).forEach(function(key){
        if(reserved[key]){ return; }
        var value = text(row[key]).toUpperCase();
        if(["CUMPLE", "NO CUMPLE", "PENDIENTE"].indexOf(value) >= 0){
          map[key] = { id:key, key:key, label:key };
        }
      });
    });

    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a, b){
      return a.label.localeCompare(b.label, "es");
    });
  }

  function snapshot(options){
    options = options || {};
    var c = cache();
    return {
      ok:true,
      source:"ConGlobal",
      version:VERSION,
      meta:clone(c.meta || {}),
      periods:periods(),
      students:students(options.filters || { matricula:"" }),
      requirements:requirements(options.filters || {}),
      careers:detectedCareers(),
      requirementCatalog:detectedRequirements(),
      diagnostics:clone(c.diagnostics || []),
      generatedAt:new Date().toISOString()
    };
  }

  function status(){
    var c = cache();
    return {
      ok:true,
      version:VERSION,
      source:"ConGlobal",
      periods:(c.periods || []).length,
      students:(c.students || []).length,
      requirements:(c.requirements || []).length,
      careers:detectedCareers().length,
      requirementCatalog:detectedRequirements().length,
      updatedAt:new Date().toISOString()
    };
  }

  var api = {
    version:VERSION,
    ready:ready,
    refresh:refresh,
    status:status,
    snapshot:snapshot,
    getSnapshot:snapshot,
    periods:periods,
    getPeriods:periods,
    students:students,
    getStudents:students,
    requirements:requirements,
    getRequirements:requirements,
    careers:detectedCareers,
    getCareers:detectedCareers,
    requirementCatalog:detectedRequirements,
    getRequirementCatalog:detectedRequirements
  };

  window.BDLocalGlobal = api;
  window.ConGlobal = api;

  if(hub && typeof hub.register === "function"){
    hub.register("global", api);
  }
})(window);
