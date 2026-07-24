/* =========================================================
Nombre completo: stats.telegram.firebase-sync.js
Ruta: /Stats/stats.telegram.firebase-sync.js
Función:
- Actualizar la cobertura de Telegram mediante ConStats.
- No leer Firebase, IndexedDB ni repositorios desde la pantalla.
- Solicitar una descarga incremental manual al conector central.
- Recalcular y renderizar Stats después de actualizar la caché.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-connector-only";
  var running=false;

  function text(value){return String(value==null?"":value).trim();}
  function status(message,type){
    var node=document.getElementById("stats-status");
    if(!node){return;}
    node.textContent=text(message);
    node.className="stats-status "+(type||"");
  }
  function button(){return document.getElementById("stats-refresh");}
  function connector(){return window.ConStats||window.BDLocalStats||null;}
  function state(){
    if(window.StatsApp&&typeof window.StatsApp.getState==="function"){return window.StatsApp.getState()||{};}
    return {
      periodId:text(document.getElementById("stats-periodo")&&document.getElementById("stats-periodo").value),
      requirementKey:""
    };
  }
  function activeSection(){
    try{
      if(window.StatsSections&&typeof window.StatsSections.current==="function"){return text(window.StatsSections.current());}
    }catch(error){}
    return text(window.location&&window.location.hash).replace(/^#/,"");
  }
  function shouldIntercept(){
    var current=state();
    return !!text(current.periodId)&&(
      activeSection()==="stats-telegram-section"||
      text(current.requirementKey)==="telegram"
    );
  }
  function renderUpdated(summary){
    try{
      if(window.StatsDataPatch&&typeof window.StatsDataPatch.reload==="function"){window.StatsDataPatch.reload(true).catch(function(){});}
      if(window.StatsCore&&typeof window.StatsCore.invalidate==="function"){window.StatsCore.invalidate({reason:"telegram-official-refresh",keepPeriods:true});}
      if(window.StatsApp&&typeof window.StatsApp.render==="function"){window.StatsApp.render({force:false,reason:"telegram-official-refresh"});}
      window.dispatchEvent(new CustomEvent("stats:telegram-synced",{detail:summary||{}}));
    }catch(error){}
  }
  function run(){
    if(running){return Promise.resolve({ok:true,skipped:true,running:true});}
    var currentState=state();
    var periodId=text(currentState.periodId);
    if(!periodId){return Promise.reject(new Error("Seleccione un período antes de actualizar Telegram."));}

    var con=connector();
    if(!con||typeof con.refreshTelegramFromOfficial!=="function"){
      return Promise.reject(new Error("ConStats no permite actualizar desde la base oficial."));
    }

    running=true;
    var refreshButton=button();
    if(refreshButton){refreshButton.disabled=true;}
    status("Descargando cambios de estudiantes desde la base oficial...","");

    return Promise.resolve(con.refreshTelegramFromOfficial({
      periodoId:periodId,
      periodId:periodId,
      full:false,
      limit:500,
      maxPages:50,
      source:"StatsTelegramConnector.manual"
    })).then(function(summary){
      summary=summary||{};
      summary.message=Number(summary.downloaded||0)>0
        ? "Telegram actualizado desde la caché oficial: "+Number(summary.written||0)+" registros locales procesados."
        : "Telegram ya estaba actualizado; no se encontraron cambios nuevos.";
      if(Number(summary.conflicts||0)>0){
        summary.message+=" Se detectaron "+Number(summary.conflicts)+" conflicto(s) protegidos.";
      }
      status(summary.message,Number(summary.conflicts||0)>0?"warn":"ok");
      renderUpdated(summary);
      return summary;
    }).catch(function(error){
      var summary={
        ok:false,
        periodoId:periodId,
        error:error&&error.message?error.message:String(error),
        message:"No se pudo actualizar Telegram. Stats conservó la información local."
      };
      status(summary.message+" "+summary.error,"warn");
      renderUpdated(summary);
      return summary;
    }).finally(function(){
      running=false;
      if(refreshButton){refreshButton.disabled=false;}
    });
  }
  function bind(){
    var refreshButton=button();
    if(!refreshButton||refreshButton.__statsTelegramSyncBound){return false;}
    refreshButton.__statsTelegramSyncBound=true;
    refreshButton.addEventListener("click",function(event){
      if(!shouldIntercept()){return;}
      event.preventDefault();
      event.stopImmediatePropagation();
      run();
    },true);
    return true;
  }

  window.StatsTelegramFirebaseSync={
    version:VERSION,
    directFirebase:false,
    connectorOnly:true,
    run:run,
    bind:bind,
    shouldIntercept:shouldIntercept,
    isRunning:function(){return running;}
  };

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}
  else{bind();}
})(window,document);
