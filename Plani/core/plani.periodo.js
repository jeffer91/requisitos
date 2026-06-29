/* =========================================================
Nombre completo: plani.periodo.js
Ruta o ubicación: /Requisitos/Plani/core/plani.periodo.js
Función o funciones:
- Centralizar lectura y clasificación de períodos para Plani.
- Reutilizar fuentes existentes si están disponibles: BL2, ExcelLocalRepo o StatsRules.
- Mantener un respaldo mínimo cuando todavía no se cargan dependencias externas.
Con qué se conecta:
- plani.constants.js
- plani.state.js
- ../frontend/plani.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}

  function periodIdOf(period){
    return text(period && (period.id || period.periodoId || period.value || period.key || period.codigo) || period);
  }

  function periodLabelOf(period){
    return text(period && (period.label || period.periodoLabel || period.nombre || period.name || period.descripcion || period.id || period.periodoId) || period);
  }

  function classify(value){
    var raw = text(value);
    if(!raw){return {id:"", label:"Sin período", isRegular:false, isPVC:false, raw:""};}
    try{
      if(window.StatsRules && typeof window.StatsRules.classifyPeriod === "function"){
        return window.StatsRules.classifyPeriod(raw);
      }
    }catch(error){}
    var source = norm(raw);
    var regular = (source.indexOf("octubre") >= 0 && source.indexOf("marzo") >= 0) || (source.indexOf("abril") >= 0 && source.indexOf("septiembre") >= 0);
    return {id:regular ? "REGULAR" : "PVC", label:regular ? "Regular" : "PVC", isRegular:regular, isPVC:!regular, raw:raw};
  }

  function normalizePeriod(period){
    var id = periodIdOf(period);
    var label = periodLabelOf(period) || id;
    return {id:id, label:label, type:classify(label || id), raw:period};
  }

  function unique(list){
    var map = Object.create(null);
    (list || []).forEach(function(period){
      var item = normalizePeriod(period);
      var key = compact(item.id || item.label);
      if(!key || map[key]){return;}
      map[key] = item;
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label, "es");});
  }

  function listFromBL2(){
    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.listPeriods === "function"){
        return window.BL2EstudiantesRepo.listPeriods() || [];
      }
      if(window.BL2 && window.BL2.periodos && typeof window.BL2.periodos.listar === "function"){
        return window.BL2.periodos.listar() || [];
      }
    }catch(error){console.warn("[PlaniPeriodo BL2]", error);}
    return [];
  }

  function listFromExcelLocal(){
    try{
      if(window.ExcelLocalBridge && typeof window.ExcelLocalBridge.ensureReady === "function"){
        window.ExcelLocalBridge.ensureReady();
      }
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.listPeriods === "function"){
        return window.ExcelLocalRepo.listPeriods() || [];
      }
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.getSnapshot === "function"){
        return (window.ExcelLocalRepo.getSnapshot().periods || []);
      }
    }catch(error){console.warn("[PlaniPeriodo ExcelLocal]", error);}
    return [];
  }

  function fallbackPeriods(){
    return [
      {id:"2025-10", label:"Octubre 2025 - Marzo 2026"},
      {id:"2026-04", label:"Abril 2026 - Septiembre 2026"}
    ];
  }

  function list(){
    var found = unique([].concat(listFromBL2()).concat(listFromExcelLocal()));
    return found.length ? found : unique(fallbackPeriods());
  }

  function summary(period){
    var item = normalizePeriod(period || {});
    return {
      id:item.id,
      label:item.label,
      type:item.type,
      source:item.raw ? "PlaniPeriodo" : "Sin fuente"
    };
  }

  window.PlaniPeriodo = {
    list:list,
    classify:classify,
    normalizePeriod:normalizePeriod,
    periodIdOf:periodIdOf,
    periodLabelOf:periodLabelOf,
    summary:summary
  };
})(window);
