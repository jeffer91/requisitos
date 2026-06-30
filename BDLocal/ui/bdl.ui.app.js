(function(window, document){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIApp."); }

  function periodoActual(){
    return H.val('#bdlPeriodoSelect') || (window.BDLState && window.BDLState.getPeriodoActivo ? window.BDLState.getPeriodoActivo() : '');
  }

  function refrescarResumen(){
    var periodoId = periodoActual();
    var tasks = [];
    if(window.BDLUIPeriodos){ tasks.push(window.BDLUIPeriodos.load()); }
    if(periodoId && window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(periodoId)); }
    return Promise.all(tasks).then(function(){ H.notify(periodoId ? 'Resumen actualizado.' : 'Seleccione o cree un período.'); });
  }

  function bind(){
    H.on('#bdlPeriodoSelect', 'change', function(){
      var periodoId = H.val('#bdlPeriodoSelect');
      if(window.BDLRepoConfig){ window.BDLRepoConfig.guardarPeriodoActivo(periodoId); }
      if(window.BDLUICarga){ window.BDLUICarga.reiniciar(); }
      if(window.BDLUIDashboard){ window.BDLUIDashboard.loadDashboard(periodoId); }
      H.notify(periodoId ? 'Período seleccionado. Puede analizar un archivo.' : 'Seleccione o cree un período.');
    });
    H.on('#bdlPeriodoGuardar', 'click', function(){ if(window.BDLUIPeriodos){ window.BDLUIPeriodos.save(); } });
    H.on('#bdlPeriodoNuevo', 'click', function(){ if(window.BDLUIPeriodos){ window.BDLUIPeriodos.reset(); } });
    H.on('#bdlBtnRefresh', 'click', refrescarResumen);
    H.on('#bdlClosePanel', 'click', function(){ if(window.BDLUIDetalle){ window.BDLUIDetalle.close(); } });
    H.on('#bdlBtnSync', 'click', function(){ if(window.BDLUIFirebase){ window.BDLUIFirebase.run(); } });
    H.on('#bdlCargaFile', 'change', function(){ if(window.BDLUICarga){ window.BDLUICarga.reiniciar(); } });
    H.on('#bdlBtnAnalizarExcel', 'click', function(){ if(window.BDLUICarga){ window.BDLUICarga.analizar(); } });
    H.on('#bdlBtnGuardarCarga', 'click', function(){ if(window.BDLUICarga){ window.BDLUICarga.guardar(); } });
    H.on('#bdlBtnDivisiones', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.open(); } });
    H.on('#bdlDivClose', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.close(); } });
    H.on('#bdlDivCancel', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.close(); } });
    H.on('#bdlDivSaveName', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.createOrSelect(); } });
    H.on('#bdlDivDeleteName', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.removeSelected(); } });
    H.on('#bdlDivSaveAll', 'click', function(){ if(window.BDLUIDivisiones){ window.BDLUIDivisiones.save(); } });
    H.on('#bdlCargaSummaryClose', 'click', function(){ if(window.BDLUICarga){ window.BDLUICarga.cerrarResumen(); } });
    H.on('#bdlCargaSummaryOk', 'click', function(){ if(window.BDLUICarga){ window.BDLUICarga.cerrarResumen(); } });
  }

  function loadInitialData(){
    var periodoId = periodoActual();
    if(!periodoId){
      if(window.BDLUIDashboard){ window.BDLUIDashboard.renderStats({}); }
      H.notify('Seleccione o cree un período.');
      return Promise.resolve();
    }
    if(window.BDLUIDashboard){ return window.BDLUIDashboard.loadDashboard(periodoId).then(function(){ H.notify('Listo.'); }); }
    H.notify('Listo.');
    return Promise.resolve();
  }

  function boot(){
    H.notify('Cargando...');
    var start = window.BDLocal && window.BDLocal.boot ? window.BDLocal.boot() : Promise.resolve();
    start.then(function(){
      bind();
      if(window.BDLUIPeriodos){ window.BDLUIPeriodos.fillMonths(); window.BDLUIPeriodos.reset(); return window.BDLUIPeriodos.load(); }
      return window.BDLUIDashboard ? window.BDLUIDashboard.loadPeriodos() : [];
    }).then(loadInitialData).then(function(){ if(window.BDLUICarga){ window.BDLUICarga.reiniciar(); } }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); }else{ boot(); }
  window.BDLUIApp = { boot:boot, refrescarResumen:refrescarResumen };
})(window, document);
