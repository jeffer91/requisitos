/* =========================================================
Archivo: bdl.repo.personas.js
Ruta: /BDLocal/repositories/bdl.repo.personas.js
Función:
- Repositorio virtual de personas.
- Construir personas únicas desde la tabla actual estudiantes.
- Preparar la futura tabla personas sin exigir migración todavía.
Con qué se conecta:
- BDLocal/repositories/bdl.repo.estudiantes.js
- BDLocal/rules/bdl.rules.persona.js
========================================================= */
(function(window){
  "use strict";

  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }

  function studentRepo(){ return Repos.get("estudiantes") || window.BDLRepoEstudiantesV2 || null; }

  function buildPersona(row){
    if(window.BDLRulesPersona && typeof window.BDLRulesPersona.buildPersona === "function"){
      return window.BDLRulesPersona.buildPersona(row || {});
    }
    return {
      cedula: text(row && row.cedula),
      nombreCompleto: text((row && (row.nombres || row.Nombres || row.nombre)) || ""),
      updatedAt: text(row && row.updatedAt) || new Date().toISOString()
    };
  }

  function list(options){
    var repo = studentRepo();
    if(!repo){ return Promise.resolve([]); }

    return repo.list(options || {}).then(function(rows){
      var map = Object.create(null);
      rows.forEach(function(row){
        var persona = buildPersona(row || {});
        if(!persona.cedula){ return; }
        if(!map[persona.cedula]){ map[persona.cedula] = persona; return; }
        if(text(persona.updatedAt) > text(map[persona.cedula].updatedAt)){ map[persona.cedula] = persona; }
      });
      return Object.keys(map).map(function(key){ return map[key]; });
    });
  }

  function getByCedula(cedula){
    cedula = text(cedula);
    return list({}).then(function(rows){
      return rows.find(function(row){ return text(row.cedula) === cedula; }) || null;
    });
  }

  var api = { list: list, getByCedula: getByCedula, buildPersona: buildPersona };
  Repos.register("personas", api);
  window.BDLRepoPersonas = api;
})(window);
