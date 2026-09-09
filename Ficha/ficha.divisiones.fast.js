/* =========================================================
Nombre completo: ficha.divisiones.fast.js
Ruta o ubicación: /Requisitos/Ficha/ficha.divisiones.fast.js
Función o funciones:
- Evitar que Ficha reconstruya divisiones recorriendo estudiantes cuando existe un período seleccionado.
- Tomar BLDivisionesService como fuente autoritativa, incluso cuando devuelve cero divisiones.
- Usar FichaCore solo cuando no existe servicio o no existe contexto de período.
- Mantener caché liviana de divisiones por período y matrícula.
========================================================= */
(function(window, document){
  "use strict";

  var CACHE = {};
  var ORIGINAL = null;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function unique(list){
    var map = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function(item){
      var value = text(item && typeof item === "object" ? (item.nombre || item.label || item.name || item.id || item.value) : item);
      var id = norm(value);
      if(value && !map[id]){ map[id] = true; out.push(value); }
    });
    return out.sort(function(a, b){ return a.localeCompare(b, "es", { sensitivity:"base" }); });
  }
  function periodIdOf(options){
    options = options || {};
    return text(options.periodId || options.periodoId || "");
  }
  function keyOf(options){
    options = options || {};
    return [periodIdOf(options), text(options.matricula || options.estadoMatricula || "ACTIVO")].join("|");
  }
  function listFromService(options){
    options = options || {};
    var service = window.BLDivisionesService || null;
    var periodId = periodIdOf(options);
    if(!service || !periodId){ return { authoritative:false, values:[] }; }

    try{
      if(typeof service.listDivisionsWithEmpty === "function"){
        return { authoritative:true, values:unique((service.listDivisionsWithEmpty([], "", { periodoId:periodId, periodId:periodId }) || []).filter(Boolean)) };
      }
    }catch(error){}
    try{
      if(typeof service.listDivisions === "function"){
        return { authoritative:true, values:unique(service.listDivisions([], { periodoId:periodId, periodId:periodId }) || []) };
      }
    }catch(error2){}
    try{
      if(typeof service.divisionsForPeriod === "function"){
        return { authoritative:true, values:unique((service.divisionsForPeriod(periodId) || []).map(function(item){
          return item && (item.nombre || item.label || item.name || item.id || item.value);
        })) };
      }
    }catch(error3){}
    return { authoritative:true, values:[] };
  }
  function listFromCore(list, options){
    if(!ORIGINAL){ return []; }
    try{ return unique(ORIGINAL.call(window.FichaCore, list, options || {}) || []); }
    catch(error){ console.warn("[Ficha divisiones fast] Respaldo FichaCore falló", error); return []; }
  }
  function fastDivisions(list, options){
    options = options || {};
    var authority = listFromService(options);
    if(authority.authoritative){
      var cacheKey = keyOf(options);
      CACHE[cacheKey] = authority.values.slice();
      return authority.values.slice();
    }
    return listFromCore(list, options);
  }
  function patch(){
    if(!window.FichaCore || typeof window.FichaCore.divisions !== "function"){ return false; }
    if(window.FichaCore.__divisionesFastInstalled){ return true; }
    ORIGINAL = window.FichaCore.divisions;
    window.FichaCore.divisions = fastDivisions;
    window.FichaCore.__divisionesFastInstalled = true;
    window.FichaCore.__divisionesAuthoritativeByPeriod = true;
    window.FichaCore.invalidateDivisionesFast = function(){ CACHE = {}; };
    return true;
  }
  function clearCache(){
    CACHE = {};
    if(window.FichaCore && typeof window.FichaCore.invalidateDivisionesFast === "function"){
      try{ window.FichaCore.invalidateDivisionesFast(); }catch(error){}
    }
  }
  function boot(){
    if(patch()){ return; }
    var tries = 0;
    var timer = window.setInterval(function(){ tries += 1; if(patch() || tries >= 30){ window.clearInterval(timer); } }, 120);
  }

  window.addEventListener("bdlocal:legacy-ready", clearCache);
  window.addEventListener("bdlocal:legacy-snapshot", clearCache);
  window.addEventListener("requisitos:bl:snapshot-changed", clearCache);
  window.addEventListener("bdlocal:screen-data-updated", clearCache);
  window.addEventListener("carga:divisions-saved", clearCache);
  window.addEventListener("carga:divisions-authority-updated", clearCache);
  window.addEventListener("storage", function(event){
    if(event && (
      event.key === "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1" ||
      event.key === "REQ_EXCEL_LOCAL_V1:snapshot" ||
      event.key === "REQ_BL_SIGNAL_V1" ||
      event.key === "carga.periodos.divisiones" ||
      event.key === "carga.periodos.local"
    )){ clearCache(); }
  });

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", boot); }
  else{ boot(); }
})(window, document);