/* =========================================================
Nombre completo: bl2-dashboard.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-dashboard.repo.js
Función o funciones:
- Entregar un resumen liviano para el panel Base Local.
- Evitar que Base Local calcule diagnóstico completo al abrir.
- Leer metadata, conteos rápidos y estado de BL2/Firebase sin bloquear la vista.
- Calcular conteos profundos solo si se solicita explícitamente.
Con qué se conecta:
- bl2-api.js
- bl2-periodos.repo.js
- BaseLocal/baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  var cache = {key:"", value:null, at:0};
  var CACHE_MS = 1500;

  function parentValue(name){try{return window.parent && window.parent !== window ? window.parent[name] : null;}catch(error){return null;}}
  function api(){return window.BL2 || parentValue("BL2") || null;}
  function periodosRepo(){return window.BL2PeriodosRepo || parentValue("BL2PeriodosRepo") || null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function safe(label, fn, fallback){try{return typeof fn === "function" ? fn() : fallback;}catch(error){console.warn("[BL2DashboardRepo]", label, error);return fallback;}}

  function readSnapshot(){
    var bl2 = api();
    if(bl2 && bl2.compat && typeof bl2.compat.snapshot === "function"){
      return bl2.compat.snapshot({clone:false}) || {};
    }
    return {};
  }

  function fastSummary(options){
    options = options || {};
    var periodId = text(options.periodId || "");
    var deep = options.deep === true;
    var key = [periodId, deep ? "deep" : "fast"].join("|");
    if(cache.value && cache.key === key && Date.now() - cache.at < CACHE_MS){return cache.value;}

    var snapshot = readSnapshot();
    var periods = periodosRepo() && typeof periodosRepo().listar === "function" ? periodosRepo().listar() : (Array.isArray(snapshot.periods) ? snapshot.periods : []);
    var students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var history = Array.isArray(snapshot.history) ? snapshot.history : [];
    var meta = snapshot.meta || {};
    var totalStudents = Number(meta.totalStudents || students.length || 0) || 0;
    var statusCounts = {ACTIVO:null, RETIRADO:null, TOTAL:periodId ? null : totalStudents};
    var careers = null;

    if(deep){
      var careerMap = Object.create(null);
      statusCounts = {ACTIVO:0, RETIRADO:0, TOTAL:0};
      students.forEach(function(row){
        var rowPeriod = text(row && (row.periodoId || row.ultimoPeriodoId || row.periodoLabel || row.periodo));
        if(periodId && rowPeriod !== periodId){return;}
        var estado = String(row && (row.estadoMatricula || row.EstadoMatricula || "ACTIVO")).toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
        var career = text(row && (row.nombreCarrera || row.nombrecarrera || row.NombreCarrera || row.carrera || row.Carrera)) || "SIN CARRERA";
        statusCounts[estado] += 1;
        statusCounts.TOTAL += 1;
        careerMap[career] = true;
      });
      careers = Object.keys(careerMap).length;
    }

    var bl2Status = safe("BL2.status", function(){return api() && typeof api().status === "function" ? api().status({deep:false}) : null;}, null);
    var storageStatus = safe("BL2.storage.estado", function(){return api() && api().storage && typeof api().storage.estado === "function" ? api().storage.estado() : null;}, null);
    var migrationStatus = safe("BL2.migracion.estado", function(){return api() && api().migracion && typeof api().migracion.estado === "function" ? api().migracion.estado() : null;}, null);

    var result = {
      ok:true,
      mode:deep ? "deep" : "fast",
      periodId:periodId,
      periods:periods.length,
      students:totalStudents,
      history:history.length,
      careers:careers,
      statusCounts:statusCounts,
      meta:meta,
      bl2Status:bl2Status,
      storageStatus:storageStatus,
      migrationStatus:migrationStatus,
      updatedAt:now()
    };
    cache = {key:key, value:result, at:Date.now()};
    return result;
  }

  function invalidate(){cache = {key:"", value:null, at:0};}
  function status(){return {ok:true, mode:"bl2_dashboard_repo", cached:!!cache.value, updatedAt:now()};}

  window.BL2DashboardRepo = {version:"2.0.0-alpha.1",summary:fastSummary,invalidate:invalidate,status:status};
})(window);
