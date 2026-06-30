(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIFirebase."); }

  function reloadAfterSync(result){
    var reload = window.BDLUIDashboard ? window.BDLUIDashboard.loadPeriodos() : Promise.resolve([]);
    return reload.then(function(){
      var periodoId = H.val('#bdlPeriodoSelect') || (window.BDLState && window.BDLState.getPeriodoActivo ? window.BDLState.getPeriodoActivo() : "");
      var tasks = [];
      if(periodoId && window.BDLUIDashboard){ tasks.push(window.BDLUIDashboard.loadDashboard(periodoId)); }
      if(window.BDLUIEstudiantes){ tasks.push(window.BDLUIEstudiantes.load({ periodoId:periodoId, page:1 })); }
      return Promise.all(tasks).then(function(){ return result; });
    });
  }

  function run(){
    if(!window.BDLSync || !window.BDLSync.syncNow){ H.notify("BDLSync no disponible", "error"); return Promise.resolve(null); }
    H.notify("Sincronizando con Firebase...");
    return window.BDLSync.syncNow({ manual:true }).then(function(result){
      H.notify(result && result.ok ? "Sincronización completada" : "Sincronización con errores", result && result.ok ? "" : "error");
      return reloadAfterSync(result);
    });
  }

  window.addEventListener("bdlocal:sync-status", function(event){
    var detail = event.detail || {};
    H.notify(detail.message || detail.status || "Sincronizando...");
  });

  window.BDLUIFirebase = { run:run };
})(window);
