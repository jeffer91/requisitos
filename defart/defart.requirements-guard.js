/* =========================================================
Nombre completo: defart.requirements-guard.js
Ruta o ubicación: /defart/defart.requirements-guard.js
Función o funciones:
- Diferenciar requisitos pendientes de requisitos todavía no cargados.
- Evitar mostrar "Sin requisitos" cuando la conexión aún está preparando datos.
- Mantener N-ART editable aunque los requisitos no estén cargados.
- Mantener N-DEF bloqueada hasta recibir y cumplir requisitos_estudiante.
Con qué se conecta:
- defart.core.js
- defart.service-bridge.js
- ../BDLocal/conexiones/cone.defensas.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.1.0-nart-always-editable";

  function protectRow(row){
    if(!row || typeof row !== "object"){
      return row;
    }

    if(row._bdlRequirementsLoaded !== false){
      return row;
    }

    return Object.assign({}, row, {
      _canArt: true,
      _canDef: false,
      _requirementsOk: false,
      _requirementsLoaded: false,
      _estadoDefensa: row._nart !== null && Number(row._nart) < 7 ? "Supletorio Art" : "Requisitos no cargados",
      _missingRequirements: [],
      _requirementValues: {},
      _requirementsPending: true
    });
  }

  function protectSummary(summary){
    if(!summary || typeof summary !== "object"){
      return summary;
    }

    var states = Array.isArray(summary.states)
      ? summary.states.slice()
      : [];

    if(states.indexOf("Requisitos no cargados") < 0){
      states.unshift("Requisitos no cargados");
    }

    return Object.assign({}, summary, {
      rows: Array.isArray(summary.rows)
        ? summary.rows.map(protectRow)
        : [],
      exportRows: Array.isArray(summary.exportRows)
        ? summary.exportRows.map(protectRow)
        : summary.exportRows,
      states: states
    });
  }

  function install(){
    var core = window.DefartCore;

    if(!core || typeof core.summary !== "function"){
      return false;
    }

    if(core.__requirementsGuardInstalled){
      return true;
    }

    if(typeof core.decorate === "function"){
      var originalDecorate = core.decorate;
      core.decorate = function(){
        return protectRow(
          originalDecorate.apply(core, arguments)
        );
      };
    }

    var originalSummary = core.summary;
    core.summary = function(){
      return protectSummary(
        originalSummary.apply(core, arguments)
      );
    };

    core.__requirementsGuardInstalled = true;
    return true;
  }

  function start(){
    if(install()){ return; }

    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      if(install() || attempts >= 30){
        window.clearInterval(timer);
      }
    }, 100);
  }

  window.DefartRequirementsGuard = {
    version: VERSION,
    install: install,
    protectRow: protectRow,
    protectSummary: protectSummary
  };

  start();
})(window);
