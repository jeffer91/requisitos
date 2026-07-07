/* =========================================================
Nombre completo: stats.divisiones.fast.js
Ruta o ubicación: /Requisitos/Stats/stats.divisiones.fast.js
Función o funciones:
- Hacer que Stats use divisiones configuradas por período para llenar filtros.
- Evitar que el selector de divisiones dependa solo de recorrer estudiantes.
- Mantener el resumen calculado por StatsCore sin romper KPIs ni tablas.
Con qué se conecta:
- ../BDLocal/adapters/bdl.divisiones.fast-cache.js
- stats.core.js
- stats.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){ return String(value == null ? "" : value).trim(); }

  function unique(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      item = text(item);
      if(item){ map[item.toLowerCase()] = item; }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a, b){
      return a.localeCompare(b, "es", { sensitivity:"base" });
    });
  }

  function configuredDivisions(periodId, rows){
    var service = window.BLDivisionesService || null;
    periodId = text(periodId);
    if(!service){ return []; }

    try{
      if(typeof service.listDivisionsWithEmpty === "function"){
        return unique(service.listDivisionsWithEmpty(rows || [], "", { periodoId:periodId, periodId:periodId }) || []);
      }
    }catch(error){}

    try{
      if(periodId && typeof service.divisionsForPeriod === "function"){
        return unique((service.divisionsForPeriod(periodId) || []).map(function(div){ return div && (div.nombre || div.label || div.id); }));
      }
    }catch(error2){}

    return [];
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
      var configured = configuredDivisions(periodId, data.rows || data.estudiantes || []);
      if(configured.length){ data.divisionList = configured; }
      return data;
    };

    window.StatsCore.divisions = function(list, options){
      options = options || {};
      var configured = configuredDivisions(options.periodId || options.periodoId || "", list || []);
      if(configured.length){ return configured; }
      return originalDivisions ? originalDivisions.apply(window.StatsCore, arguments) : [];
    };

    window.StatsCore.__divisionesFastInstalled = true;
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

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window);
