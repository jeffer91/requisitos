(function(window){
  "use strict";

  var H = window.BDLUIH;
  if(!H){ throw new Error("BDLUIH debe cargarse antes de BDLUIFirebase."); }

  function run(){
    if(!window.BDLSync || !window.BDLSync.syncNow){ H.notify("BDLSync no disponible", "error"); return Promise.resolve(null); }
    H.notify("Sincronizando con Firebase...");
    return window.BDLSync.syncNow({ manual:true }).then(function(result){
      H.notify(result && result.ok ? "Sincronización completada" : "Sincronización con errores", result && result.ok ? "" : "error");
      if(window.BDLUIDashboard){ window.BDLUIDashboard.loadPeriodos(); }
      if(window.BDLUIEstudiantes){ window.BDLUIEstudiantes.refresh(); }
      return result;
    });
  }

  window.addEventListener("bdlocal:sync-status", function(event){
    var detail = event.detail || {};
    H.notify(detail.message || detail.status || "Sincronizando...");
  });

  window.BDLUIFirebase = { run:run };
})(window);
