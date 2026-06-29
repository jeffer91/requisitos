/* =========================================================
Nombre completo: bl2-periodos.repo.js
Ruta o ubicación: /Requisitos/BaseLocal2/repositories/bl2-periodos.repo.js
Función o funciones:
- Entregar períodos visibles desde BL2 sin depender directamente de pantallas.
- Usar BL2.periodos.listar cuando esté disponible.
- Mantener fallback seguro hacia Base Local V1.
Con qué se conecta:
- bl2-api.js
- bl2-legacy-adapter.js
- BaseLocal/baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  function parentValue(name){try{return window.parent && window.parent !== window ? window.parent[name] : null;}catch(error){return null;}}
  function api(){return window.BL2 || parentValue("BL2") || null;}
  function text(value){return String(value == null ? "" : value).trim();}
  function normalize(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}

  function normalizePeriod(period){
    var row = Object.assign({}, period || {});
    var label = text(row.label || row.periodoLabel || row.periodo || row.nombrePeriodo || row.id || "SIN PERIODO");
    row.id = text(row.id || row.periodoId || label);
    row.periodoId = text(row.periodoId || row.id);
    row.label = label;
    row.periodoLabel = text(row.periodoLabel || label);
    row.updatedAt = text(row.updatedAt || row.actualizadoEn || row.creadoEn || "");
    return row;
  }

  function valid(period){
    var label = text(period && (period.label || period.periodoLabel || period.id));
    if(!label || isCedulaLike(label)){return false;}
    var clean = normalize(label);
    if(clean === "sin periodo" || clean === "sin_periodo"){return true;}
    return /20\d{2}/.test(clean) || clean.indexOf("periodo") >= 0;
  }

  function listar(){
    var bl2 = api();
    var rows = [];
    if(bl2 && bl2.periodos && typeof bl2.periodos.listar === "function"){
      rows = bl2.periodos.listar() || [];
    }else if(bl2 && bl2.compat && typeof bl2.compat.snapshot === "function"){
      var snap = bl2.compat.snapshot({clone:false}) || {};
      rows = Array.isArray(snap.periods) ? snap.periods : [];
    }
    var map = Object.create(null);
    return rows.map(normalizePeriod).filter(function(period){
      var key = normalize(period.id || period.label);
      if(!valid(period) || !key || map[key]){return false;}
      map[key] = true;
      return true;
    });
  }

  function status(){return {ok:true, mode:"bl2_periodos_repo", total:listar().length, updatedAt:new Date().toISOString()};}

  window.BL2PeriodosRepo = {version:"2.0.0-alpha.1",listar:listar,status:status};
})(window);
