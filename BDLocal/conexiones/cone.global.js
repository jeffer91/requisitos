/* =========================================================
Nombre completo: cone.global.js
Ruta o ubicación: /BDLocal/conexiones/cone.global.js
Función o funciones:
- Conectar Global con la caché consolidada de BDLocal.
- Entregar períodos, estudiantes, requisitos, carreras y catálogo.
- Ejecutar refrescos reales mediante BDLocalConexiones.
- Volver a renderizar Global cuando otra pantalla modifica la base.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-live-global";
  var U = window.BDLocalConUtils;
  var hub = window.BDLocalConexiones;
  var refreshTimer = null;
  var eventsBound = false;
  if(!U){ return; }

  function text(value){ return U.text ? U.text(value) : String(value == null ? "" : value).trim(); }
  function clone(value){
    if(U.clone){ return U.clone(value); }
    try{ return JSON.parse(JSON.stringify(value || null)); }catch(error){ return value; }
  }
  function ready(){
    return hub && typeof hub.ready === "function"
      ? hub.ready().catch(function(){ return status(); })
      : Promise.resolve(status());
  }
  function refresh(options){
    return hub && typeof hub.refreshCache === "function"
      ? hub.refreshCache(Object.assign({ source:"ConGlobal",full:true,immediate:true },options || {})).catch(function(){ return U.readCache(); })
      : Promise.resolve(U.readCache());
  }
  function cache(){
    try{ return U.readCache(); }
    catch(error){ return { meta:{},periods:[],students:[],requirements:[],diagnostics:[{ message:error.message }] }; }
  }
  function normalizePeriod(period){ return U.normalizePeriod ? U.normalizePeriod(period) : period; }
  function normalizeStudent(row){ return U.normalizeStudent ? U.normalizeStudent(row) : Object.assign({},row || {}); }
  function periods(){ return (cache().periods || []).map(normalizePeriod).filter(Boolean); }
  function students(filters){
    filters = filters || {};
    var rows = (cache().students || []).map(normalizeStudent);
    return U.filterStudents ? U.filterStudents(rows,filters) : rows;
  }
  function requirements(filters){
    filters = filters || {};
    var reqs = Array.isArray(cache().requirements) ? cache().requirements : [];
    var periodoId = text(filters.periodoId || filters.periodId || "");
    var cedula = text(filters.cedula || filters.numeroIdentificacion || "");
    return reqs.filter(function(req){
      return (!periodoId || text(req.periodoId || req.periodId) === periodoId) &&
        (!cedula || text(req.cedula || req.numeroIdentificacion) === cedula);
    });
  }
  function careers(){
    var map = {};
    students({ matricula:"" }).forEach(function(row){
      var nombre = text(row.NombreCarrera || row.nombreCarrera || row.carrera || row.Carrera || row._carrera);
      var codigo = text(row.CodigoCarrera || row.codigoCarrera || row.codigo || row._codigoCarrera || nombre);
      var key = (codigo || nombre).toUpperCase();
      if(nombre && !map[key]){
        map[key] = {
          id:key,
          codigo:codigo || key,
          nombre:nombre,
          tipo:nombre.toUpperCase().indexOf("UNIVERSITARIA") >= 0 ? "UNIVERSITARIA" : "SUPERIOR"
        };
      }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){ return a.nombre.localeCompare(b.nombre,"es"); });
  }
  function requirementCatalog(){
    var map = {};
    requirements({}).forEach(function(req){
      var key = text(req.requisitoId || req.requisito || req.campo || req.key || req.nombre);
      if(key){ map[key] = { id:key,key:key,label:text(req.label || req.nombre || key) }; }
    });
    students({ matricula:"" }).forEach(function(row){
      Object.keys(row || {}).forEach(function(key){
        var value = text(row[key]).toUpperCase();
        if(["CUMPLE","NO CUMPLE","PENDIENTE"].indexOf(value) >= 0){
          map[key] = { id:key,key:key,label:key };
        }
      });
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){ return a.label.localeCompare(b.label,"es"); });
  }
  function snapshot(options){
    options = options || {};
    var current = cache();
    return {
      ok:true,
      source:"ConGlobal",
      version:VERSION,
      meta:clone(current.meta || {}),
      periods:periods(),
      students:students(options.filters || { matricula:"" }),
      requirements:requirements(options.filters || {}),
      careers:careers(),
      requirementCatalog:requirementCatalog(),
      diagnostics:clone(current.diagnostics || []),
      generatedAt:new Date().toISOString()
    };
  }
  function status(){
    var current = cache();
    return {
      ok:true,
      version:VERSION,
      source:"ConGlobal",
      periods:(current.periods || []).length,
      students:(current.students || []).length,
      requirements:(current.requirements || []).length,
      careers:careers().length,
      requirementCatalog:requirementCatalog().length,
      updatedAt:new Date().toISOString()
    };
  }

  function scheduleRender(){
    if(refreshTimer){ window.clearTimeout(refreshTimer); }
    refreshTimer = window.setTimeout(function(){
      refreshTimer = null;
      try{
        if(window.GlobalCore && typeof window.GlobalCore.invalidate === "function"){ window.GlobalCore.invalidate(); }
        if(window.GlobalApp && typeof window.GlobalApp.render === "function"){ window.GlobalApp.render(); }
      }catch(error){}
    },260);
  }

  function bindEvents(){
    if(eventsBound){ return; }
    eventsBound = true;
    [
      "bdlocal:screen-data-updated",
      "bdlocal:legacy-snapshot",
      "requisitos:bl:snapshot-changed"
    ].forEach(function(name){ window.addEventListener(name,scheduleRender); });
    window.addEventListener("storage",function(event){
      if(event && [
        "REQ_BDLOCAL_CONEXIONES_CACHE_V1",
        "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1",
        "REQ_EXCEL_LOCAL_V1:snapshot"
      ].indexOf(event.key) >= 0){ scheduleRender(); }
    });
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
    careers:careers,
    getCareers:careers,
    requirementCatalog:requirementCatalog,
    getRequirementCatalog:requirementCatalog
  };

  window.BDLocalGlobal = api;
  window.ConGlobal = api;
  if(hub && typeof hub.register === "function"){ hub.register("global",api); }
  bindEvents();
})(window);
