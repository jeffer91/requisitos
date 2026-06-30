/* =========================================================
Nombre completo: conn.flow.js
Ruta: /BDLocal/connections/shared/conn.flow.js
Función:
- Revisar botones, variables globales y puntos mínimos del flujo de la pantalla actual.
- No modifica datos.
========================================================= */
(function(window, document){
  "use strict";

  function hasId(id){ return !!document.getElementById(id); }
  function hasGlobal(name){ return typeof window[name] !== "undefined"; }
  function item(type, name, ok, detail){ return { type:type, name:name, ok:!!ok, detail:detail || "" }; }

  var MAP = {
    Carga: {
      ids:["bdlBtnSync","bdlBtnRefresh","bdlPeriodoGuardar","bdlBtnAnalizarExcel","bdlBtnGuardarCarga","bdlBtnDivisiones","bdlPeriodoSelect","bdlCargaFile"],
      globals:["BDLocal","BDLUIApp","BDLUICarga","BDLUIDivisiones","BDLUIFirebase"]
    },
    BL: {
      ids:["blBtnSync","blBtnUpload","blBtnDownload","blBtnPurge","blBtnDiff","blBtnDiag","blBtnCheckContinuity","blBtnCloseDay","blBtnSheetsPreview"],
      globals:["BDLocal","BDLContinuity","BLApp","BLTabs","BLPanelStatus","BLPanelCloseDay","BLPanelSheets"]
    },
    Tabla: {
      ids:["tabla-refresh","tabla-periodo","tabla-division","tabla-carrera","tabla-search","tabla-table-wrap"],
      globals:["BDLocal","TablaApp"]
    },
    Ficha: {
      ids:["ficha-btn-refresh","ficha-periodo","ficha-division","ficha-search","ficha-modalidad-save","ficha-detail"],
      globals:["BDLocal","FichaApp","FichaCore","FichaModalidad"]
    },
    Stats: {
      ids:["stats-refresh","stats-periodo","stats-division","stats-carrera","stats-total","stats-notes"],
      globals:["BDLocal","StatsApp","StatsCore","StatsRules"]
    },
    Coordi: {
      ids:["coordi-refresh","coordi-periodo","coordi-division","coordi-carrera","coordi-estudiantes","coordi-diagnostics"],
      globals:["BDLocal","CoordiApp","CoordiCore"]
    },
    Reportes: {
      ids:["repo-refresh","repo-tipo","repo-periodo","repo-preview","repo-diagnostics"],
      globals:["BDLocal","RepoApp","RepoCore"]
    },
    Defensas: {
      ids:["def-btn-refresh","def-btn-save","def-filter-periodo","def-filter-division","def-table-wrap","def-diagnostics"],
      globals:["BDLocal","DefartCore","DefartContinuity","DefartExport"]
    }
  };

  function currentScreen(){
    if(window.BDLConnectionAudit && typeof window.BDLConnectionAudit.currentScreen === "function"){
      return window.BDLConnectionAudit.currentScreen();
    }
    return "Pantalla";
  }

  function audit(){
    var screen = currentScreen();
    var cfg = MAP[screen] || { ids:[], globals:[] };
    var ids = cfg.ids.map(function(id){ return item("button_or_dom", id, hasId(id), hasId(id) ? "Existe" : "No encontrado"); });
    var globals = cfg.globals.map(function(name){ return item("global", name, hasGlobal(name), hasGlobal(name) ? "Cargado" : "No cargado"); });
    var all = ids.concat(globals);
    return {
      ok: all.every(function(x){ return x.ok; }),
      screen: screen,
      checkedAt: new Date().toISOString(),
      missing: all.filter(function(x){ return !x.ok; }),
      ids: ids,
      globals: globals
    };
  }

  window.BDLFlowAudit = { audit:audit };
})(window, document);