/* =========================================================
Nombre completo: bdlocal-sync-fixups.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-sync-fixups.js
Función o funciones:
- Mantener compatibilidad con llamadas antiguas de sincronización.
- Redirigir Google, Firebase y Supabase únicamente a BDLSyncV2.
- Impedir cargas completas paralelas fuera de cambios_pendientes.
- Reafirmar EstudiantesPeriodo como destino académico.
- Mostrar Estudiantes como origen personal y de Telegram.
- Vincular el acceso de Apps Script con el formulario actual.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.2.0-firebase-split";
  var MAX_BATCH_SIZE=25;
  var installed=false;
  var formBound=false;
  var observer=null;

  function text(v){return String(v==null?"":v).trim();}
  function now(){return new Date().toISOString();}
  function safeBatch(v){v=Math.floor(Number(v||MAX_BATCH_SIZE));return Math.min(MAX_BATCH_SIZE,Math.max(1,v||MAX_BATCH_SIZE));}
  function outbox(){return window.BDLSyncOutbox||null;}

  function splitConfig(){
    return {
      enabled:true,
      mode:"manual",
      manualOnly:true,
      automatic:false,
      collection:"EstudiantesPeriodo",
      academicCollection:"EstudiantesPeriodo",
      personCollection:"Estudiantes",
      telegramCollection:"Estudiantes",
      documentIdStrategy:"periodoId__cedula",
      academicDocumentIdStrategy:"periodoId__cedula",
      personDocumentIdStrategy:"cedula",
      excludeTelegramFromAcademic:true,
      batchSize:25,
      maxBatchSize:25,
      deleteAllowed:false,
      previewBeforePull:true,
      backupBeforePull:true,
      protectLocalPending:true
    };
  }

  function enforceFirebaseSplit(){
    var cfg=window.BL2Config=window.BL2Config||{};
    cfg.firebase=Object.assign({},cfg.firebase||{},splitConfig());
    try{
      var store=window.BDLocalConfigStore;
      if(store&&typeof store.patchConfig==="function"){
        store.patchConfig({
          sync:{mode:"manual",manualOnly:true,automatic:false,syncOnIdle:false,syncOnClose:false,maxBatchSize:25},
          firebase:splitConfig()
        });
      }
    }catch(error){}
    return cfg.firebase;
  }

  function patchFirebaseUI(){
    var academic=document.getElementById("bdlc-firebase-collection");
    var strategy=document.getElementById("bdlc-firebase-document-id");
    if(academic){academic.value="EstudiantesPeriodo";academic.setAttribute("title","Datos académicos por período");}
    if(strategy){strategy.value="periodoId__cedula";}

    if(academic&&!document.getElementById("bdlc-firebase-person-collection")){
      var field=academic.closest?academic.closest(".bdlc-field"):academic.parentNode;
      if(field&&field.parentNode){
        var person=document.createElement("div");
        person.className="bdlc-field";
        person.innerHTML='<label class="bdlc-label">Colección persona y Telegram</label><input id="bdlc-firebase-person-collection" class="bdlc-input" value="Estudiantes" readonly>';
        field.parentNode.insertBefore(person,field.nextSibling);
      }
    }

    var cards=document.querySelectorAll(".bdlc-connection-card");
    Array.prototype.forEach.call(cards,function(card){
      var title=card.querySelector("h3");
      if(title&&text(title.textContent)==="Firebase"){
        var description=card.querySelector(".bdlc-connection-head p");
        if(description){description.textContent="EstudiantesPeriodo guarda datos académicos; Estudiantes conserva persona y Telegram.";}
      }
    });
    return !!academic;
  }

  function selectedPeriod(){
    try{
      if(window.BL2App&&window.BL2App.getSelectedPeriod){var selected=window.BL2App.getSelectedPeriod();if(selected&&text(selected.id)){return Promise.resolve({id:text(selected.id),label:text(selected.label||selected.id)});}}
      if(window.BL2App&&window.BL2App.getState){var state=window.BL2App.getState()||{};if(state.activePeriod&&text(state.activePeriod.id)){return Promise.resolve({id:text(state.activePeriod.id),label:text(state.activePeriod.label||state.activePeriod.id)});}}
    }catch(error){}
    return window.BL2Core&&window.BL2Core.getActivePeriod?window.BL2Core.getActivePeriod().then(function(period){return period&&text(period.id)?{id:text(period.id),label:text(period.label||period.periodoLabel||period.id)}:null;}):Promise.resolve(null);
  }

  function blocked(target,message,extra){return Promise.resolve(Object.assign({ok:false,blocked:true,target:target,message:message,at:now()},extra||{}));}

  function requestTarget(target,options){
    target=text(target).toLowerCase();options=Object.assign({},options||{});
    if(options.manual!==true){return blocked(target,"Solicitud automática bloqueada. La sincronización es exclusivamente manual.");}
    if(!window.BDLSyncV2||!window.BDLSyncV2.request){return Promise.reject(new Error("BDLSyncV2 no está disponible."));}
    return (text(options.periodoId)?Promise.resolve({id:text(options.periodoId),label:text(options.periodoLabel||options.periodoId)}):selectedPeriod()).then(function(period){
      if(!period||!period.id){throw new Error("Seleccione un período antes de sincronizar.");}
      var limit=safeBatch(options.limit||options.batchSize);
      return window.BDLSyncV2.request({manual:true,automatic:false,source:text(options.source||"BDLocalSyncFixups.manual."+target),targets:[target],periodoId:period.id,periodoLabel:period.label,cedula:text(options.cedula),tabla:text(options.tabla),forceRetry:options.forceRetry===true,ignoreRetry:options.ignoreRetry===true||options.forceRetry===true,limit:limit,batchSize:limit});
    });
  }

  function openCount(target,periodoId){
    if(!outbox()||!outbox().counts){return Promise.resolve(0);}
    return outbox().counts({periodoId:periodoId}).then(function(counts){var detail=counts&&counts.detail&&counts.detail[target]||{};return Number(detail.pending||0)+Number(detail.error||0)+Number(detail.blocked||0)+Number(detail.waitingRetry||0);}).catch(function(){return 0;});
  }

  function confirmedTarget(target,options){
    options=Object.assign({},options||{});
    return selectedPeriod().then(function(period){
      if(!period){throw new Error("Seleccione un período antes de sincronizar.");}
      return openCount(target,period.id).then(function(total){
        if(!total&&options.forceRetry!==true){return {ok:true,skipped:true,target:target,message:"No existen pendientes para "+target+" en el período activo."};}
        var limit=safeBatch(options.limit||options.batchSize);
        if(options.confirm!==false){
          var extra=target==="firebase"?"\nColección académica: EstudiantesPeriodo\nTelegram: no se modifica":"";
          if(!window.confirm("Sincronización manual\n\nDestino: "+target+"\nPeríodo: "+period.label+"\nPendientes abiertos: "+total+"\nMáximo: "+Math.min(limit,total||limit)+extra+"\n\n¿Continuar?")){return {ok:true,cancelled:true,target:target};}
        }
        return requestTarget(target,Object.assign({},options,{manual:true,periodoId:period.id,periodoLabel:period.label,limit:limit,batchSize:limit}));
      });
    }).then(function(result){return window.BDLSyncUIBridge&&window.BDLSyncUIBridge.refreshAll?window.BDLSyncUIBridge.refreshAll().catch(function(){return null;}).then(function(){return result;}):result;});
  }

  function patchManager(){
    var manager=window.BDLocalSyncManager;if(!manager){return false;}
    manager.pushLocalToSheets=function(o){return requestTarget("google",Object.assign({},o||{},{source:"BDLocalSyncManager.manual.google"}));};
    manager.pushLocalToFirebase=function(o){return requestTarget("firebase",Object.assign({},o||{},{source:"BDLocalSyncManager.manual.firebase"}));};
    manager.pushLocalToSupabase=function(o){return requestTarget("supabase",Object.assign({},o||{},{source:"BDLocalSyncManager.manual.supabase"}));};
    manager.syncQueue=function(o){o=Object.assign({},o||{});if(o.manual!==true){return blocked("all","Cola automática bloqueada.");}return selectedPeriod().then(function(period){if(!period){throw new Error("Seleccione un período.");}var limit=safeBatch(o.limit||o.batchSize);return window.BDLSyncV2.request({manual:true,automatic:false,source:"BDLocalSyncManager.manual.queue",targets:o.targets||["google","firebase","supabase"],periodoId:period.id,periodoLabel:period.label,limit:limit,batchSize:limit});});};
    manager.syncAll=manager.syncQueue;manager.__singleSyncGateInstalled=true;manager.__firebaseSplitVersion=VERSION;return true;
  }

  function patchLegacySync(){
    var sync=window.BL2Sync;if(!sync){return false;}
    var firebasePull=sync.__splitOriginalFirebasePull||sync.syncFirebase;sync.__splitOriginalFirebasePull=firebasePull;
    sync.syncGoogle=function(o){return requestTarget("google",Object.assign({},o||{},{source:"BL2Sync.manual.google"}));};
    sync.syncFirebase=function(o){o=o||{};var action=text(o.action||"upload").toLowerCase();if(action==="compare"||action==="download"){return typeof firebasePull==="function"?firebasePull.call(sync,o):Promise.reject(new Error("La descarga Firebase no está disponible."));}return requestTarget("firebase",Object.assign({},o,{source:"BL2Sync.manual.firebase"}));};
    sync.maybeSyncGoogleIdle=function(){return blocked("google","Sincronización por inactividad desactivada.");};
    sync.maybeSyncFirebaseDaily=function(){return blocked("firebase","Sincronización diaria desactivada.");};
    sync.syncBeforeClose=function(){return Promise.resolve({ok:true,skipped:true,manualOnly:true,message:"No se sincronizó al cerrar; la cola permanece guardada."});};
    sync.__singleSyncGateInstalled=true;sync.__firebaseSplitVersion=VERSION;return true;
  }

  function patchUI(){var ui=window.BDLSyncUIBridge;if(!ui){return false;}ui.runTarget=function(target,options){return confirmedTarget(text(target).toLowerCase(),options||{});};ui.__singleSyncGateInstalled=true;return true;}

  function saveSheetsAccess(){
    var field=document.getElementById("bdlc-sheets-token"),store=window.BDLocalConfigStore;
    if(!field||!store||!store.getSheetsConfig||!store.setSheetsConfig){return false;}
    var current=store.getSheetsConfig({includeSecret:true})||{};
    store.setSheetsConfig({enabled:current.enabled,appsScriptUrl:current.appsScriptUrl,token:text(field.value),spreadsheetId:current.spreadsheetId,sheetName:current.sheetName,batchSize:current.batchSize});return true;
  }

  function bindCurrentForm(){
    if(formBound){return;}formBound=true;
    document.addEventListener("click",function(event){var button=event.target&&event.target.closest?event.target.closest("[data-bdlc-action]"):null;if(button&&button.getAttribute("data-bdlc-action")==="save-sheets"){saveSheetsAccess();}},true);
    if(window.MutationObserver){observer=new MutationObserver(function(){patchFirebaseUI();});observer.observe(document.body,{childList:true,subtree:true});}
  }

  function install(){
    enforceFirebaseSplit();
    var managerReady=patchManager(),syncReady=patchLegacySync(),uiReady=patchUI();
    bindCurrentForm();patchFirebaseUI();installed=managerReady||syncReady||uiReady||installed;
    return {ok:installed,manager:managerReady,legacy:syncReady,ui:uiReady,formBound:formBound,academicCollection:"EstudiantesPeriodo",personCollection:"Estudiantes"};
  }

  window.BDLocalSyncFixups={version:VERSION,compatibilityOnly:true,manualOnly:true,maxBatchSize:MAX_BATCH_SIZE,install:install,enforceFirebaseSplit:enforceFirebaseSplit,patchFirebaseUI:patchFirebaseUI,requestTarget:requestTarget,confirmedTarget:confirmedTarget,saveSheetsAccess:saveSheetsAccess,status:function(){return {version:VERSION,installed:installed,manager:!!(window.BDLocalSyncManager&&window.BDLocalSyncManager.__singleSyncGateInstalled),legacy:!!(window.BL2Sync&&window.BL2Sync.__singleSyncGateInstalled),ui:!!(window.BDLSyncUIBridge&&window.BDLSyncUIBridge.__singleSyncGateInstalled),formBound:formBound,academicCollection:"EstudiantesPeriodo",personCollection:"Estudiantes"};}};

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install);
  window.addEventListener("bl2:ready",install);
  window.addEventListener("bl2:app-refreshed",function(){enforceFirebaseSplit();patchFirebaseUI();});
})(window,document);
