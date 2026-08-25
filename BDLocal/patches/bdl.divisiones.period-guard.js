/* =========================================================
Nombre completo: bdl.divisiones.period-guard.js
Ruta o ubicación: /BDLocal/patches/bdl.divisiones.period-guard.js
Función o funciones:
- Corregir periodos_carreras y periodos_divisiones después de cualquier escritura del store periodos.
- Evitar que objetos de división terminen persistidos como "[object Object]".
- Mantener una sola carrera por división dentro de la representación V2 del período.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-period-dimensions-guard";
  var api = window.ConCarga || window.BDLocalCarga || null;
  if(!api){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }
  function canon(value){
    var utils = window.BDLocalConUtils;
    return utils && typeof utils.canonicalPeriodId === "function"
      ? utils.canonicalPeriodId(value)
      : text(value).replace(/_+/g, "__");
  }
  function db(){ return window.BL2DB || null; }
  function stores(){
    var current = window.BL2Config && window.BL2Config.stores || {};
    return {
      periodos:current.periodos || "periodos",
      periodosCarreras:current.periodosCarreras || "periodos_carreras",
      periodosDivisiones:current.periodosDivisiones || "periodos_divisiones"
    };
  }
  function career(item){
    item = item || {};
    if(typeof item === "string"){ item = { nombre:item }; }
    var code = text(item.codigo || item.codigoCarrera || item.CodigoCarrera || item.codCarrera || "");
    var name = text(item.nombre || item.nombreCarrera || item.NombreCarrera || item.Carrera || item.carrera || item.label || code);
    var id = key(code || name);
    return id && name ? { id:id, codigo:code, nombre:name } : null;
  }
  function uniqueCareers(list){
    var map = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(item){ var current = career(item); if(current){ map[current.id] = current; } });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" }); });
  }
  function division(item){
    if(!item){ return null; }
    if(typeof item === "string"){ item = { nombre:item }; }
    var name = text(item.nombre || item.label || item.name || item.id || "");
    var id = key(item.id || name);
    return id && name ? { id:id, nombre:name, carreras:uniqueCareers(item.carreras || item.careers || []) } : null;
  }
  function cleanDivisions(list, careers){
    var allowed = Object.create(null);
    uniqueCareers(careers || []).forEach(function(item){ allowed[item.id] = item; });
    var owner = Object.create(null);
    return (Array.isArray(list) ? list : []).map(division).filter(Boolean).map(function(item){
      var clean = [];
      item.carreras.forEach(function(value){
        var current = career(value);
        if(!current || !allowed[current.id] || owner[current.id]){ return; }
        owner[current.id] = item.id;
        clean.push(allowed[current.id]);
      });
      return { id:item.id, nombre:item.nombre, carreras:uniqueCareers(clean) };
    });
  }
  function removePeriodRows(storeName, periodoId){
    var database = db();
    if(!database || typeof database.getAll !== "function" || typeof database.remove !== "function"){ return Promise.resolve(0); }
    return database.getAll(storeName).catch(function(){ return []; }).then(function(rows){
      var chain = Promise.resolve();
      var removed = 0;
      (rows || []).forEach(function(row){
        if(canon(row && row.periodoId) !== periodoId){ return; }
        var id = text(row && (row.id || row.key || row._id));
        if(!id){ return; }
        chain = chain.then(function(){ return database.remove(storeName, id).then(function(){ removed += 1; }).catch(function(){ return null; }); });
      });
      return chain.then(function(){ return removed; });
    });
  }
  function putMany(storeName, rows){
    var database = db();
    rows = Array.isArray(rows) ? rows : [];
    if(!database || !rows.length){ return Promise.resolve([]); }
    if(typeof database.bulkPut === "function"){ return database.bulkPut(storeName, rows); }
    return Promise.resolve([]);
  }
  function repair(period){
    period = period || {};
    var periodoId = canon(period.periodoId || period.id || period.periodoCanonicoId || "");
    if(!periodoId){ return Promise.resolve({ ok:true, skipped:true }); }
    var currentStores = stores();
    var careers = uniqueCareers(period.carrerasDetectadas || []);
    var divisions = cleanDivisions(period.divisiones || [], careers);
    var careerRows = careers.map(function(item){
      return { type:"career", id:periodoId + "__" + item.id, periodoId:periodoId, careerId:item.id, codigoCarrera:item.codigo || "", carrera:item.nombre, updatedAt:now(), source:"division_period_guard" };
    });
    var divisionRows = divisions.map(function(item){
      return { type:"division", id:periodoId + "__" + item.id, periodoId:periodoId, divisionId:item.id, division:item.nombre, nombre:item.nombre, carreras:item.carreras, updatedAt:now(), source:"division_period_guard" };
    });
    return Promise.all([
      removePeriodRows(currentStores.periodosCarreras, periodoId),
      removePeriodRows(currentStores.periodosDivisiones, periodoId)
    ]).then(function(){
      return Promise.all([putMany(currentStores.periodosCarreras, careerRows), putMany(currentStores.periodosDivisiones, divisionRows)]);
    }).then(function(){ return { ok:true, careers:careerRows.length, divisions:divisionRows.length }; });
  }
  function install(){
    var database = db();
    if(!database || database.__divisionPeriodGuardInstalled){ return !!database; }
    if(typeof database.put !== "function" || typeof database.bulkPut !== "function"){ return false; }
    var currentStores = stores();
    var originalPut = database.put.bind(database);
    var originalBulkPut = database.bulkPut.bind(database);
    database.put = function(storeName, value){
      return originalPut(storeName, value).then(function(saved){
        if(text(storeName) !== text(currentStores.periodos)){ return saved; }
        return repair(saved || value).catch(function(error){ try{ console.warn("[DivisionesPeriodGuard]", error); }catch(innerError){} return null; }).then(function(){ return saved; });
      });
    };
    database.bulkPut = function(storeName, rows){
      rows = Array.isArray(rows) ? rows : [];
      return originalBulkPut(storeName, rows).then(function(saved){
        if(text(storeName) !== text(currentStores.periodos) || !rows.length){ return saved; }
        var source = Array.isArray(saved) && saved.length ? saved : rows;
        var chain = Promise.resolve();
        source.forEach(function(period){ chain = chain.then(function(){ return repair(period).catch(function(){ return null; }); }); });
        return chain.then(function(){ return saved; });
      });
    };
    database.__divisionPeriodGuardInstalled = true;
    database.divisionPeriodGuardVersion = VERSION;
    return true;
  }

  var originalReady = typeof api.ready === "function" ? api.ready.bind(api) : function(){ return Promise.resolve(true); };
  api.ready = function(){
    return Promise.resolve(originalReady.apply(api, arguments)).then(function(result){ install(); return result; });
  };

  window.CargaDivisionesPeriodGuard = { version:VERSION, install:install, repair:repair };
})(window);
