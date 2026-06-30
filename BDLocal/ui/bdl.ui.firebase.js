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
    return window.BDLSync.syncNow({ manual:true, full:true }).then(function(result){
      if(result && result.ok){
        var down = result.result && result.result.down ? result.result.down : [];
        var periodos = down[0] && down[0].rows ? down[0].rows : 0;
        var estudiantes = down[1] && down[1].rows ? down[1].rows : 0;
        H.notify("Sincronización completada. Periodos: " + periodos + " | Estudiantes: " + estudiantes);
      }else{
        var msg = result && result.error && result.error.message ? result.error.message : "Sincronización con errores";
        H.notify(msg, "error");
      }
      return reloadAfterSync(result);
    }).catch(function(error){
      H.notify(error && error.message ? error.message : String(error), "error");
      return { ok:false, error:error };
    });
  }

  window.addEventListener("bdlocal:sync-status", function(event){
    var detail = event.detail || {};
    H.notify(detail.message || detail.status || "Sincronizando...");
  });

  window.BDLUIFirebase = { run:run };
})(window);
