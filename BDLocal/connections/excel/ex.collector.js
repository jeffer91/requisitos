/* =========================================================
Nombre completo: ex.collector.js
Ruta: /BDLocal/connections/excel/ex.collector.js
Función:
- Recolectar datos locales para respaldo/cierre del día.
- No modifica datos.
========================================================= */
(function(window){
  "use strict";

  function stores(){
    var cfg = window.BDLConfig && window.BDLConfig.stores ? window.BDLConfig.stores : {};
    return Object.keys(cfg).map(function(k){ return cfg[k]; }).filter(Boolean);
  }

  function listStore(store){
    if(!window.BDLDB || typeof window.BDLDB.list !== "function"){ return Promise.resolve([]); }
    return window.BDLDB.list(store,{limit:0}).catch(function(error){ return { error:error && error.message ? error.message : String(error) }; });
  }

  function collectAll(){
    var result = { meta:{ createdAt:new Date().toISOString(), app:"Requisitos", module:"BL" }, stores:{}, continuityEvents:[], health:[] };
    var chain = Promise.resolve();
    stores().forEach(function(store){
      chain = chain.then(function(){ return listStore(store).then(function(rows){ result.stores[store] = rows; }); });
    });
    return chain.then(function(){
      if(window.BDLContEventRepo && typeof window.BDLContEventRepo.list === "function"){ result.continuityEvents = window.BDLContEventRepo.list(); }
      if(window.BDLContHealthRepo && typeof window.BDLContHealthRepo.list === "function"){ result.health = window.BDLContHealthRepo.list(); }
      return result;
    });
  }

  function collectCritical(){
    return collectAll().then(function(all){
      var events = (all.continuityEvents || []).filter(function(e){ return e && (e.prioridad === "manual" || e.prioridad === "critico"); });
      return { meta:all.meta, continuityEvents:events, health:all.health };
    });
  }

  window.BDLExcelCollector = {
    collectAll: collectAll,
    collectCritical: collectCritical
  };
})(window);
