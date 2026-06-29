/* =========================================================
Nombre completo: bl2-screen-adapter.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-screen-adapter.js
Función o funciones:
- Entregar datos listos para Stats, Ficha, Tabla, Coordi, Reportes y Defensas.
- Evitar que cada pantalla calcule o lea desde localStorage por su cuenta.
- Mantener una API simple para migrar pantallas por bloques.
Con qué se conecta:
- bl2-data-engine.js
- bl2-requirements-engine.js
- bl2-api.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-core.1";
  function engine(){return window.BL2DataEngine || null;}
  function reqEngine(){return window.BL2RequirementsEngine || null;}
  function text(value){return String(value == null ? "" : value).trim();}

  function ensure(){if(!engine()){throw new Error("BL2DataEngine no disponible.");}return engine();}
  function withMeta(kind, payload, filters){
    payload = payload || {};
    payload._screen = {kind:kind,filters:filters || {},generatedAt:new Date().toISOString(),source:"BL2ScreenAdapter",version:VERSION};
    return payload;
  }

  function forStats(filters){return withMeta("stats", ensure().statsSummary(filters || {}), filters || {});}
  function forFicha(cedula, options){
    var student = ensure().getStudentById(cedula, options || {});
    if(!student){return withMeta("ficha", {student:null,found:false,message:"Estudiante no encontrado."}, {cedula:cedula});}
    var approval = reqEngine() && typeof reqEngine().studentApproval === "function" ? reqEngine().studentApproval(student) : (student._bl2Approval || null);
    var finals = reqEngine() && typeof reqEngine().finalApproval === "function" ? reqEngine().finalApproval(student) : (student._bl2FinalApproval || []);
    return withMeta("ficha", {student:student,found:true,approval:approval,finalApproval:finals}, {cedula:cedula});
  }
  function forTabla(filters){var data = ensure().listStudents(filters || {});return withMeta("tabla", data, filters || {});}
  function forCoordi(filters){var data = ensure().listStudents(filters || {});return withMeta("coordi", data, filters || {});}
  function forReportes(filters){var summary = ensure().statsSummary(filters || {});return withMeta("reportes", summary, filters || {});}
  function forDefensas(filters){var data = ensure().listStudents(filters || {});return withMeta("defensas", data, filters || {});}
  function options(filters){
    var data = ensure().listStudents(Object.assign({}, filters || {}, {limit:0}));
    return withMeta("options", {rows:data.rows || [],total:data.total || 0}, filters || {});
  }

  function status(){return {ok:!!engine(),mode:"bl2_screen_adapter",version:VERSION,engine:engine() && engine().status ? engine().status() : null,updatedAt:new Date().toISOString()};}

  window.BL2ScreenAdapter = {version:VERSION,forStats:forStats,forFicha:forFicha,forTabla:forTabla,forCoordi:forCoordi,forReportes:forReportes,forDefensas:forDefensas,options:options,status:status,helpers:{text:text}};
})(window);
