/* =========================================================
Archivo: bdl.repo.personas.js
Ruta: /BDLocal/repositories/bdl.repo.personas.js
Función:
- Repositorio real de personas.
- Lee primero personas y usa estudiantes solo como fallback.
========================================================= */
(function(window){
  "use strict";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(v){ return String(v == null ? "" : v).trim(); }
  function store(){ return Repos.storeName("personas", "personas"); }
  function legacy(){ return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null; }

  function normalize(row){
    row = row || {};
    if(window.BDLRulesPersona && typeof window.BDLRulesPersona.buildPersona === "function"){
      return window.BDLRulesPersona.buildPersona(row);
    }
    return {
      cedula: text(row.cedula || row._cedula || row.numeroIdentificacion || row.NumeroIdentificacion),
      nombreCompleto: text(row.nombreCompleto || row.nombres || row.Nombres || row.nombre || row.Nombre),
      nombres: text(row.nombres || row.Nombres || row.nombreCompleto || row.nombre || row.Nombre),
      correoPersonal: text(row.correoPersonal || row.CorreoPersonal || row.email),
      correoInstitucional: text(row.correoInstitucional || row.CorreoInstitucional),
      celular: text(row.celular || row.Celular || row.telefono),
      updatedAt: text(row.updatedAt) || new Date().toISOString(),
      origen: text(row.origen || "personas")
    };
  }

  function legacyList(options){
    var repo = legacy();
    if(!repo){ return Promise.resolve([]); }
    return repo.list(options || {}).then(function(rows){
      var map = Object.create(null);
      (rows || []).forEach(function(row){
        var item = normalize(row);
        if(item.cedula && !map[item.cedula]){ map[item.cedula] = item; }
      });
      return Object.keys(map).map(function(k){ return map[k]; });
    });
  }

  function list(options){
    options = options || {};
    return Repos.safeGetAll(store()).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      if(text(options.cedula)){ rows = rows.filter(function(row){ return text(row.cedula) === text(options.cedula); }); }
      return rows.length ? rows : legacyList(options);
    });
  }

  function getByCedula(cedula){ return list({ cedula: cedula }).then(function(rows){ return rows[0] || null; }); }
  function save(row){
    var item = normalize(row);
    if(!item.cedula){ return Promise.reject(new Error("Persona sin cedula.")); }
    return Repos.safePut(store(), item);
  }
  function saveMany(rows){ return Repos.bulkPut(store(), (rows || []).map(normalize).filter(function(row){ return !!row.cedula; })); }

  var api = { list:list, getByCedula:getByCedula, save:save, saveMany:saveMany, normalize:normalize, legacyList:legacyList };
  Repos.register("personas", api);
  window.BDLRepoPersonas = api;
})(window);
