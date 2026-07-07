/* =========================================================
Nombre completo: ficha.divisiones.fast.js
Ruta o ubicación: /Requisitos/Ficha/ficha.divisiones.fast.js
Función o funciones:
- Evitar que Ficha construya el selector de divisiones recorriendo estudiantes cuando existen divisiones configuradas.
- Tomar primero las divisiones desde BLDivisionesService.
- Usar la lógica anterior de FichaCore solo como respaldo si no hay divisiones configuradas.
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- BLDivisionesService
- ficha.core.js
- ficha.app.js
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

  function configuredDivisions(options){
    options = options || {};
    var service = window.BLDivisionesService || null;
    var periodId = text(options.periodId || options.periodoId || "");

    if(!service || !periodId){ return []; }

    try{
      if(typeof service.listDivisionsWithEmpty === "function"){
        return unique((service.listDivisionsWithEmpty([], "", { periodoId:periodId, periodId:periodId }) || []).filter(Boolean));
      }
    }catch(error){}

    try{
      if(typeof service.listDivisions === "function"){
        return unique(service.listDivisions([], { periodoId:periodId, periodId:periodId }) || []);
      }
    }catch(error2){}

    try{
      if(typeof service.divisionsForPeriod === "function"){
        return unique((service.divisionsForPeriod(periodId) || []).map(function(div){ return div && (div.nombre || div.label || div.id); }));
      }
    }catch(error3){}

    return [];
  }

  function patch(){
    if(!window.FichaCore || window.FichaCore.__divisionesFastInstalled){ return false; }
    if(typeof window.FichaCore.divisions !== "function"){ return false; }

    var originalDivisions = window.FichaCore.divisions;

    window.FichaCore.divisions = function(list, options){
      options = options || {};

      if(!list){
        var configured = configuredDivisions(options);
        if(configured.length){ return configured; }
      }

      return originalDivisions.apply(window.FichaCore, arguments);
    };

    window.FichaCore.__divisionesFastInstalled = true;
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
