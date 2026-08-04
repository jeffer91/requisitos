/* =========================================================
Nombre completo: cone.stats.firebase.js
Ruta: /BDLocal/conexiones/cone.stats.firebase.js
Función:
- Extender ConStats con una actualización manual de Telegram.
- Delegar la lectura al Centro de Operaciones Firebase.
- Actualizar únicamente telegramUser y telegramChatId en la persona local.
- Recalcular la caché de Stats sin reemplazar nombres, correos, carrera u otros datos.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-telegram-fields-only";
  var api=window.ConStats||window.BDLocalStats||null;
  var running=null;
  if(!api){return;}

  function text(value){return String(value==null?"":value).trim();}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}

  function ensureCenter(timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var current=center();
        if(current){
          Promise.resolve(typeof current.ensure==="function"?current.ensure():current).then(function(){resolve(current);}).catch(reject);
          return;
        }
        if(Date.now()-started>=timeoutMs){reject(new Error("El Centro de Operaciones Firebase no está disponible para Stats."));return;}
        window.setTimeout(check,60);
      })();
    });
  }

  function refreshCache(periodoId,source){
    var options={
      periodoId:text(periodoId),periodId:text(periodoId),
      source:source||"ConStats.refreshTelegram",mode:"full",full:true,
      force:true,immediate:true,incremental:true,cooldown:0
    };
    if(typeof api.refreshFull==="function"){return Promise.resolve(api.refreshFull(options));}
    if(typeof api.refresh==="function"){return Promise.resolve(api.refresh(options));}
    return Promise.reject(new Error("ConStats no puede recalcular la caché."));
  }

  function refreshTelegramFromOfficial(options){
    options=Object.assign({},options||{});
    var periodoId=text(options.periodoId||options.periodId);
    if(!periodoId){return Promise.reject(new Error("Seleccione un período antes de actualizar Telegram."));}
    if(running){return running;}

    running=ensureCenter().then(function(current){
      return current.refreshTelegram({
        periodoId:periodoId,periodId:periodoId,
        full:options.full===true,
        limit:Math.max(1,Math.min(1000,Number(options.limit||500))),
        maxPages:Math.max(1,Math.min(100,Number(options.maxPages||50))),
        source:text(options.source||"ConStats.refreshTelegramFromOfficial")
      });
    }).then(function(result){
      if(!result||result.ok===false){throw new Error(text(result&&result.message)||"No se pudo actualizar Telegram desde Firebase.");}
      return refreshCache(periodoId,"ConStats.refreshTelegramFromOfficial").then(function(){
        var summary={
          ok:true,periodoId:periodoId,
          downloaded:Number(result.downloaded||0),
          written:Number(result.written||0),
          unchanged:Number(result.unchanged||0),
          skipped:Number(result.skipped||0),
          conflicts:0,
          telegramOnly:true,
          source:"ConStats",
          firebaseResult:result,
          finishedAt:new Date().toISOString()
        };
        try{window.dispatchEvent(new CustomEvent("stats:official-telegram-refreshed",{detail:summary}));}catch(error){}
        return summary;
      });
    }).finally(function(){running=null;});

    return running;
  }

  api.refreshTelegramFromOfficial=refreshTelegramFromOfficial;
  api.refreshOfficialStudents=refreshTelegramFromOfficial;
  api.firebaseOfficialStatus=function(){
    return {version:VERSION,running:!!running,manualOnly:true,directScreenAccess:false,telegramOnly:true};
  };

  window.ConStatsFirebase={
    version:VERSION,
    install:function(){return true;},
    refreshTelegramFromOfficial:refreshTelegramFromOfficial,
    refreshOfficialStudents:refreshTelegramFromOfficial,
    status:api.firebaseOfficialStatus
  };
})(window);
