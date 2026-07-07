/* =========================================================
Archivo: bdl.diagnostics.defensas.js
Ruta: /BDLocal/diagnostics/bdl.diagnostics.defensas.js
Función:
- Diagnosticar conexión de Defensas con BDLocal.
- Verificar disponibilidad de servicios, repositorios, cone.defensas, notas y cambios.
- Contar estudiantes, períodos, notas y cambios pendientes sin modificar datos.
Con qué se conecta:
- BDLocal/bl2.db.js
- BDLocal/repositories/bdl.repo.*.js
- BDLocal/services/bdl.service.*.js
- BDLocal/conexiones/cone.defensas.js
- defart/defart.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block8";

  function text(value){ return String(value == null ? "" : value).trim(); }

  function ok(value){ return !!value; }

  function safeCount(repoName, options){
    options = options || {};
    try{
      if(!window.BDLRepositories || typeof window.BDLRepositories.get !== "function"){
        return Promise.resolve({ repo: repoName, ok:false, total:0, error:"BDLRepositories no disponible." });
      }
      var repo = window.BDLRepositories.get(repoName);
      if(!repo || typeof repo.list !== "function"){
        return Promise.resolve({ repo: repoName, ok:false, total:0, error:"Repositorio no disponible." });
      }
      return Promise.resolve(repo.list(options)).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        return { repo: repoName, ok:true, total: rows.length };
      }).catch(function(error){
        return { repo: repoName, ok:false, total:0, error:error.message || String(error) };
      });
    }catch(error2){
      return Promise.resolve({ repo: repoName, ok:false, total:0, error:error2.message || String(error2) });
    }
  }

  function readDefartState(){
    try{
      if(window.DefartApp && typeof window.DefartApp.getState === "function"){
        var state = window.DefartApp.getState() || {};
        return {
          ok: true,
          periodId: text(state.periodId || ""),
          division: text(state.division || ""),
          career: text(state.career || ""),
          status: text(state.status || ""),
          search: text(state.search || ""),
          visibleRows: state.data && Array.isArray(state.data.rows) ? state.data.rows.length : 0,
          exportRows: state.data && Array.isArray(state.data.exportRows) ? state.data.exportRows.length : 0,
          changes: state.changes ? Object.keys(state.changes).length : 0
        };
      }
    }catch(error){
      return { ok:false, error:error.message || String(error) };
    }
    return { ok:false, error:"DefartApp no disponible." };
  }

  function status(){
    var cone = window.BDLocalConeDefensas && typeof window.BDLocalConeDefensas.status === "function" ? window.BDLocalConeDefensas.status() : null;
    var services = window.BDLServices && typeof window.BDLServices.list === "function" ? window.BDLServices.list() : [];
    var repos = window.BDLRepositories && typeof window.BDLRepositories.list === "function" ? window.BDLRepositories.list() : [];

    return Promise.all([
      safeCount("estudiantes", {}),
      safeCount("periodos", {}),
      safeCount("notas", {}),
      safeCount("cambios", {})
    ]).then(function(counts){
      var result = {
        ok: true,
        version: VERSION,
        checkedAt: new Date().toISOString(),
        globals: {
          BL2DB: ok(window.BL2DB),
          BDLRules: ok(window.BDLRules),
          BDLRepositories: ok(window.BDLRepositories),
          BDLServices: ok(window.BDLServices),
          BDLocalConeDefensas: ok(window.BDLocalConeDefensas),
          DefartCore: ok(window.DefartCore),
          DefartPersistence: ok(window.DefartPersistence),
          DefartApp: ok(window.DefartApp)
        },
        coneDefensas: cone,
        services: services,
        repositories: repos,
        counts: counts,
        defartState: readDefartState()
      };

      result.ok = result.globals.BL2DB && result.globals.BDLRepositories && result.globals.BDLServices && result.globals.DefartCore;
      return result;
    });
  }

  function paint(targetId){
    var target = document.getElementById(targetId || "def-diagnostics");
    return status().then(function(result){
      if(target){ target.textContent = JSON.stringify(result, null, 2); }
      return result;
    });
  }

  window.BDLDiagnosticsDefensas = {
    version: VERSION,
    status: status,
    paint: paint
  };
})(window);
