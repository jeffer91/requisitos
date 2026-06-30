(function(window, document){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIApp."); }

  function bind(){
    H.on('#bdlPeriodoSelect', 'change', function(){
      var periodoId = H.val('#bdlPeriodoSelect');
      if(window.BDLRepoConfig){ window.BDLRepoConfig.guardarPeriodoActivo(periodoId); }
      if(window.BDLUICarga){ window.BDLUICarga.reiniciar(); }
      if(window.BDLUIDashboard){ window.BDLUIDashboard.loadDashboard(periodoId); }
      if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.load({ periodoId:periodoId, page:1 }); }
    });
    H.on('#bdlPeriodoGuardar', 'click', function(){ if(window.BDLUIPeriodos){ window.BDLUIPeriodos.save(); } });
    H.on('#bdlPeriodoNuevo', 'click', function(){ if(window.BDLUIPeriodos){ window.BDLUIPeriodos.reset(); } });
    H.on('#bdlBtnRefresh', 'click', function(){ if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.refresh(); } });
    H.on('#bdlBtnPrev', 'click', function(){ if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.prev(); } });
    H.on('#bdlBtnNext', 'click', function(){ if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.next(); } });
    H.on('#bdlSearch', 'input', function(){ if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.search(); } });
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
  }

  function loadInitialData(){
    var periodoId = H.val('#bdlPeriodoSelect') || (window.BDLState && window.BDLState.getPeriodoActivo ? window.BDLState.getPeriodoActivo() : '');
    if(!periodoId){ H.notify('Cargar listo. Cree o seleccione un período.'); return Promise.resolve(); }
    var tasks = [];
    if(window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(periodoId)); }
    if(window.BDLUIEstudiantes){ tasks.push(window.BDLUIEstudiantes.load({ periodoId:periodoId, page:1 })); }
    return Promise.all(tasks).then(function(){ H.notify('Cargar listo.'); });
  }

  function boot(){
    H.notify('Iniciando carga...');
    var start = window.BDLocal && window.BDLocal.boot ? window.BDLocal.boot() : Promise.resolve();
    start.then(function(){
      bind();
      if(window.BDLUIPeriodos){ window.BDLUIPeriodos.fillMonths(); window.BDLUIPeriodos.reset(); return window.BDLUIPeriodos.load(); }
      return window.BDLUIDashboard ? window.BDLUIDashboard.loadPeriodos() : [];
    }).then(loadInitialData).then(function(){ if(window.BDLUICarga){ window.BDLUICarga.reiniciar(); } }).catch(function(error){ H.notify(error && error.message ? error.message : String(error), 'error'); });
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); }else{ boot(); }
  window.BDLUIApp = { boot:boot };
})(window, document);
