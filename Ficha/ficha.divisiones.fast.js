/* =========================================================
Nombre completo: ficha.divisiones.fast.js
Ruta o ubicación: /Requisitos/Ficha/ficha.divisiones.fast.js
Función o funciones:
- Evitar que Ficha construya el selector de divisiones recorriendo estudiantes cuando existen divisiones configuradas.
- Tomar primero las divisiones desde BLDivisionesService.
- Usar FichaCore como respaldo si no hay divisiones configuradas.
- Mantener caché liviana de divisiones por período y matrícula.
- Evitar recalcular divisiones en cada render de búsqueda.
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- BLDivisionesService
- ficha.core.js
- ficha.app.js
========================================================= */
(function(window, document){
  "use strict";

  var CACHE = {};
  var ORIGINAL = null;

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function unique(list){
    var map = {};
    var out = [];

    (Array.isArray(list) ? list : []).forEach(function(item){
      var value = text(item && typeof item === "object" ? (item.nombre || item.label || item.name || item.id || item.value) : item);
      var key = norm(value);

      if(value && !map[key]){
        map[key] = true;
        out.push(value);
      }
    });

    return out.sort(function(a, b){
      return a.localeCompare(b, "es", {sensitivity:"base"});
    });
  }

  function keyOf(options){
    options = options || {};

    return [
      text(options.periodId || options.periodoId || ""),
      text(options.matricula || options.estadoMatricula || "ACTIVO")
    ].join("|");
  }

  function listFromService(options){
    options = options || {};

    var service = window.BLDivisionesService || null;
    var periodId = text(options.periodId || options.periodoId || "");

    if(!service || !periodId){
      return [];
    }

    try{
      if(typeof service.listDivisionsWithEmpty === "function"){
        return unique((service.listDivisionsWithEmpty([], "", {
          periodoId:periodId,
          periodId:periodId
        }) || []).filter(Boolean));
      }
    }catch(error){}

    try{
      if(typeof service.listDivisions === "function"){
        return unique(service.listDivisions([], {
          periodoId:periodId,
          periodId:periodId
        }) || []);
      }
    }catch(error2){}

    try{
      if(typeof service.divisionsForPeriod === "function"){
        return unique((service.divisionsForPeriod(periodId) || []).map(function(item){
          return item && (item.nombre || item.label || item.name || item.id || item.value);
        }));
      }
    }catch(error3){}

    try{
      if(typeof service.all === "function"){
        return unique((service.all(periodId) || []).map(function(item){
          return item && (item.nombre || item.label || item.name || item.id || item.value);
        }));
      }
    }catch(error4){}

    return [];
  }

  function listFromCore(list, options){
    if(!ORIGINAL){
      return [];
    }

    try{
      return unique(ORIGINAL.call(window.FichaCore, list, options || {}) || []);
    }catch(error){
      console.warn("[Ficha divisiones fast] Respaldo FichaCore falló", error);
      return [];
    }
  }

  function fastDivisions(list, options){
    options = options || {};

    if(list){
      return listFromCore(list, options);
    }

    var key = keyOf(options);

    if(CACHE[key]){
      return CACHE[key].slice();
    }

    var configured = listFromService(options);

    if(configured.length){
      CACHE[key] = configured.slice();
      return configured;
    }

    var fallback = listFromCore(null, options);

    CACHE[key] = fallback.slice();
    return fallback;
  }

  function patch(){
    if(!window.FichaCore || typeof window.FichaCore.divisions !== "function"){
      return false;
    }

    if(window.FichaCore.__divisionesFastInstalled){
      return true;
    }

    ORIGINAL = window.FichaCore.divisions;

    window.FichaCore.divisions = fastDivisions;
    window.FichaCore.__divisionesFastInstalled = true;
    window.FichaCore.invalidateDivisionesFast = function(){
      CACHE = {};
    };

    return true;
  }

  function clearCache(){
    CACHE = {};

    if(window.FichaCore && typeof window.FichaCore.invalidateDivisionesFast === "function"){
      try{
        window.FichaCore.invalidateDivisionesFast();
      }catch(error){}
    }
  }

  function boot(){
    if(patch()){
      return;
    }

    var tries = 0;
    var timer = window.setInterval(function(){
      tries += 1;

      if(patch() || tries >= 30){
        window.clearInterval(timer);
      }
    }, 120);
  }

  window.addEventListener("bdlocal:legacy-ready", clearCache);
  window.addEventListener("bdlocal:legacy-snapshot", clearCache);
  window.addEventListener("requisitos:bl:snapshot-changed", clearCache);

  window.addEventListener("storage", function(event){
    if(event && (
      event.key === "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1" ||
      event.key === "REQ_EXCEL_LOCAL_V1:snapshot" ||
      event.key === "REQ_BL_SIGNAL_V1"
    )){
      clearCache();
    }
  });

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);