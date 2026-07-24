/* =========================================================
Nombre completo: cone.stats.firebase.js
Ruta: /BDLocal/conexiones/cone.stats.firebase.js
Función:
- Extender ConStats con una actualización manual desde la base oficial.
- Usar exclusivamente RequisitosFirebaseSyncEngine dentro del conector.
- Descargar estudiantes de forma incremental y recalcular la caché de Stats.
- Evitar cualquier acceso Firebase desde los archivos de pantalla.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-stats-official-refresh";
  var api=window.ConStats||window.BDLocalStats||null;
  var running=null;
  if(!api){return;}

  function text(value){return String(value==null?"":value).trim();}
  function engine(){return window.RequisitosFirebaseSyncEngine||null;}

  function ensureEngine(timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs||10000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var current=engine();
        if(current&&typeof current.pullEntity==="function"){resolve(current);return;}
        if(window.BDLOutboxBridge&&typeof window.BDLOutboxBridge.loadSharedArchitecture==="function"){
          window.BDLOutboxBridge.loadSharedArchitecture().catch(function(){});
        }
        if(Date.now()-started>=timeoutMs){reject(new Error("El motor Firebase V2 no está disponible para Stats."));return;}
        window.setTimeout(check,60);
      })();
    });
  }

  function refreshCache(periodoId,source){
    var options={
      periodoId:text(periodoId),
      periodId:text(periodoId),
      source:source||"ConStats.refreshOfficialStudents",
      mode:"full",
      full:true,
      force:true,
      immediate:true,
      incremental:true,
      cooldown:0
    };
    if(typeof api.refreshFull==="function"){return Promise.resolve(api.refreshFull(options));}
    if(typeof api.refresh==="function"){return Promise.resolve(api.refresh(options));}
    return Promise.reject(new Error("ConStats no puede recalcular la caché."));
  }

  function refreshOfficialStudents(options){
    options=Object.assign({},options||{});
    var periodoId=text(options.periodoId||options.periodId);
    if(!periodoId){return Promise.reject(new Error("Seleccione un período antes de actualizar Stats."));}
    if(running){return running;}

    running=ensureEngine().then(function(current){
      return current.pullEntity("estudiantes",{
        manual:true,
        full:options.full===true,
        includeDeleted:true,
        limit:Math.max(1,Math.min(1000,Number(options.limit||500))),
        maxPages:Math.max(1,Math.min(100,Number(options.maxPages||50)))
      });
    }).then(function(result){
      if(!result||result.ok===false){throw new Error(text(result&&result.message)||"No se pudo actualizar estudiantes desde Firebase.");}
      return refreshCache(periodoId,"ConStats.refreshOfficialStudents").then(function(){
        var summary={
          ok:true,
          periodoId:periodoId,
          downloaded:Number(result.downloaded||0),
          written:Number(result.written||0),
          removed:Number(result.removed||0),
          conflicts:Number(result.conflicts||0),
          rejected:Number(result.rejected||0),
          source:"ConStats",
          firebaseResult:result,
          finishedAt:new Date().toISOString()
        };
        try{window.dispatchEvent(new CustomEvent("stats:official-students-refreshed",{detail:summary}));}catch(error){}
        return summary;
      });
    }).finally(function(){running=null;});

    return running;
  }

  api.refreshOfficialStudents=refreshOfficialStudents;
  api.refreshTelegramFromOfficial=refreshOfficialStudents;
  api.firebaseOfficialStatus=function(){return {version:VERSION,running:!!running,manualOnly:true,directScreenAccess:false};};

  window.ConStatsFirebase={
    version:VERSION,
    install:function(){return true;},
    refreshOfficialStudents:refreshOfficialStudents,
    status:api.firebaseOfficialStatus
  };
})(window);
