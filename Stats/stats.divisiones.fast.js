/* =========================================================
Nombre completo: stats.divisiones.fast.js
Ruta o ubicación: /Requisitos/Stats/stats.divisiones.fast.js
Función o funciones:
- Hacer que Stats use exclusivamente las divisiones configuradas para el período.
- Evitar que valores históricos de estudiantes reconstruyan divisiones inexistentes.
- Mantener el resumen calculado por StatsCore sin romper KPIs ni tablas.
========================================================= */
(function(window){
  "use strict";

  function text(value){ return String(value == null ? "" : value).trim(); }
  function unique(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      item = text(item && typeof item === "object" ? (item.nombre || item.label || item.name || item.id || item.value) : item);
      if(item){ map[item.toLowerCase()] = item; }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a, b){
      return a.localeCompare(b, "es", { sensitivity:"base" });
    });
  }
  function configuredDivisions(periodId, rows){
    var service = window.BLDivisionesService || null;
    periodId = text(periodId);
    if(!service || !periodId){ return { authoritative:false, values:[] }; }

    try{
      if(typeof service.listDivisionsWithEmpty === "function"){
        return { authoritative:true, values:unique(service.listDivisionsWithEmpty(rows || [], "", { periodoId:periodId, periodId:periodId }) || []) };
      }
    }catch(error){}
    try{
      if(typeof service.listDivisions === "function"){
        return { authoritative:true, values:unique(service.listDivisions(rows || [], { periodoId:periodId, periodId:periodId }) || []) };
      }
    }catch(error2){}
    try{
      if(typeof service.divisionsForPeriod === "function"){
        return { authoritative:true, values:unique(service.divisionsForPeriod(periodId) || []) };
      }
    }catch(error3){}
    return { authoritative:true, values:[] };
  }
  function patch(){
    if(!window.StatsCore || window.StatsCore.__divisionesFastInstalled){ return false; }
    if(typeof window.StatsCore.resumen !== "function"){ return false; }

    var originalResumen = window.StatsCore.resumen;
    var originalDivisions = typeof window.StatsCore.divisions === "function" ? window.StatsCore.divisions : null;

    window.StatsCore.resumen = function(options){
      var data = originalResumen.apply(window.StatsCore, arguments) || {};
      options = options || {};
      var periodId = text(options.periodId || options.periodoId || "");
      var authority = configuredDivisions(periodId, data.rows || data.estudiantes || []);
      if(authority.authoritative){ data.divisionList = authority.values.slice(); }
      return data;
    };

    window.StatsCore.divisions = function(list, options){
      options = options || {};
      var authority = configuredDivisions(options.periodId || options.periodoId || "", list || []);
      if(authority.authoritative){ return authority.values.slice(); }
      return originalDivisions ? originalDivisions.apply(window.StatsCore, arguments) : [];
    };

    window.StatsCore.__divisionesFastInstalled = true;
    window.StatsCore.__divisionesAuthoritativeByPeriod = true;
    return true;
  }
  function boot(){
    if(patch()){ return; }
    var tries = 0;
    var timer = window.setInterval(function(){
      tries += 1;
      if(patch() || tries >= 30){ window.clearInterval(timer); }
    }, 120);
  }

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window);