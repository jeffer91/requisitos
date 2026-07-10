/* =========================================================
Nombre completo: bdlocal-sync-fixups.js
Ruta o ubicación: /js/bdlocal-config/bdlocal-sync-fixups.js
Función o funciones:
- Mantener una sola puerta manual hacia Google, Firebase y Supabase.
- Reafirmar EstudiantesPeriodo como colección académica.
- Mostrar Estudiantes como colección personal y de Telegram.
- Delegar compare/download directamente en BL2FirebaseGuard.
- Conservar el guardado de la credencial de Apps Script.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.2.1-firebase-split";
  var MAX=25;
  var installed=false;
  var bound=false;

  function text(v){return String(v==null?"":v).trim();}
  function limit(v){v=Math.floor(Number(v||MAX));return Math.min(MAX,Math.max(1,v||MAX));}
  function box(){return window.BDLSyncOutbox||null;}

  function firebaseConfig(){
    return {
      enabled:true,mode:"manual",manualOnly:true,automatic:false,
      collection:"EstudiantesPeriodo",academicCollection:"EstudiantesPeriodo",
      personCollection:"Estudiantes",telegramCollection:"Estudiantes",
      documentIdStrategy:"periodoId__cedula",academicDocumentIdStrategy:"periodoId__cedula",
      personDocumentIdStrategy:"cedula",excludeTelegramFromAcademic:true,
      batchSize:25,maxBatchSize:25,deleteAllowed:false,
      previewBeforePull:true,backupBeforePull:true,protectLocalPending:true
    };
  }

  function enforce(){
    var cfg=window.BL2Config=window.BL2Config||{};
    cfg.firebase=Object.assign({},cfg.firebase||{},firebaseConfig());
    try{
      var store=window.BDLocalConfigStore;
      if(store&&store.patchConfig){
        store.patchConfig({
          sync:{mode:"manual",manualOnly:true,automatic:false,syncOnIdle:false,syncOnClose:false,maxBatchSize:25},
          firebase:firebaseConfig()
        });
      }
    }catch(error){}
    return cfg.firebase;
  }

  function patchVisibleConfig(){
    var academic=document.getElementById("bdlc-firebase-collection");
    var strategy=document.getElementById("bdlc-firebase-document-id");
    if(academic){academic.value="EstudiantesPeriodo";}
    if(strategy){strategy.value="periodoId__cedula";}
    if(academic&&!document.getElementById("bdlc-firebase-person-collection")){
      var field=academic.closest?academic.closest(".bdlc-field"):academic.parentNode;
      if(field&&field.parentNode){
        var node=document.createElement("div");
        node.className="bdlc-field";
        node.innerHTML='<label class="bdlc-label">Colección persona y Telegram</label><input id="bdlc-firebase-person-collection" class="bdlc-input" value="Estudiantes" readonly>';
        field.parentNode.insertBefore(node,field.nextSibling);
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll(".bdlc-connection-card"),function(card){
      var title=card.querySelector("h3"),description=card.querySelector(".bdlc-connection-head p");
      var message="EstudiantesPeriodo guarda datos académicos; Estudiantes conserva persona y Telegram.";
      if(title&&text(title.textContent)==="Firebase"&&description&&text(description.textContent)!==message){description.textContent=message;}
    });
  }

  function selectedPeriod(){
    try{
      if(window.BL2App&&window.BL2App.getSelectedPeriod){var p=window.BL2App.getSelectedPeriod();if(p&&text(p.id)){return Promise.resolve({id:text(p.id),label:text(p.label||p.id)});}}
    }catch(error){}
    return window.BL2Core&&window.BL2Core.getActivePeriod?window.BL2Core.getActivePeriod().then(function(p){return p&&text(p.id)?{id:text(p.id),label:text(p.label||p.periodoLabel||p.id)}:null;}):Promise.resolve(null);
  }

  function request(target,options){
    options=Object.assign({},options||{});
    if(options.manual!==true){return Promise.resolve({ok:false,blocked:true,target:target,message:"Solicitud automática bloqueada."});}
    if(!window.BDLSyncV2||!window.BDLSyncV2.request){return Promise.reject(new Error("BDLSyncV2 no está disponible."));}
    return (text(options.periodoId)?Promise.resolve({id:text(options.periodoId),label:text(options.periodoLabel||options.periodoId)}):selectedPeriod()).then(function(p){
      if(!p){throw new Error("Seleccione un período.");}
      var size=limit(options.limit||options.batchSize);
      return window.BDLSyncV2.request({manual:true,automatic:false,source:text(options.source||"BDLocalSyncFixups.manual."+target),targets:[target],periodoId:p.id,periodoLabel:p.label,limit:size,batchSize:size});
    });
  }

  function count(target,periodoId){
    if(!box()||!box().counts){return Promise.resolve(0);}
    return box().counts({periodoId:periodoId}).then(function(c){var d=c&&c.detail&&c.detail[target]||{};return Number(d.pending||0)+Number(d.error||0)+Number(d.blocked||0)+Number(d.waitingRetry||0);}).catch(function(){return 0;});
  }

  function confirmed(target,options){
    options=Object.assign({},options||{});
    return selectedPeriod().then(function(p){
      if(!p){throw new Error("Seleccione un período.");}
      return count(target,p.id).then(function(total){
        if(!total&&!options.forceRetry){return {ok:true,skipped:true,target:target,message:"No existen pendientes."};}
        var size=limit(options.limit||options.batchSize);
        if(options.confirm!==false){
          var note=target==="firebase"?"\nColección: EstudiantesPeriodo\nTelegram no se modifica":"";
          if(!window.confirm("Sincronización manual\n\nDestino: "+target+"\nPeríodo: "+p.label+"\nPendientes: "+total+"\nMáximo: "+Math.min(size,total||size)+note+"\n\n¿Continuar?")){return {ok:true,cancelled:true,target:target};}
        }
        return request(target,{manual:true,periodoId:p.id,periodoLabel:p.label,limit:size,batchSize:size,source:"BDLocalSyncFixups.confirmed."+target});
      });
    });
  }

  function patchManager(){
    var m=window.BDLocalSyncManager;if(!m){return false;}
    m.pushLocalToSheets=function(o){return request("google",Object.assign({},o||{},{source:"BDLocalSyncManager.google"}));};
    m.pushLocalToFirebase=function(o){return request("firebase",Object.assign({},o||{},{source:"BDLocalSyncManager.firebase"}));};
    m.pushLocalToSupabase=function(o){return request("supabase",Object.assign({},o||{},{source:"BDLocalSyncManager.supabase"}));};
    m.syncQueue=function(o){o=Object.assign({},o||{});if(o.manual!==true){return Promise.resolve({ok:false,blocked:true,message:"Cola automática bloqueada."});}return selectedPeriod().then(function(p){if(!p){throw new Error("Seleccione un período.");}var size=limit(o.limit||o.batchSize);return window.BDLSyncV2.request({manual:true,automatic:false,source:"BDLocalSyncManager.queue",targets:o.targets||["google","firebase","supabase"],periodoId:p.id,periodoLabel:p.label,limit:size,batchSize:size});});};
    m.syncAll=m.syncQueue;m.__singleSyncGateInstalled=true;return true;
  }

  function patchSync(){
    var s=window.BL2Sync;if(!s){return false;}
    s.syncGoogle=function(o){return request("google",Object.assign({},o||{},{source:"BL2Sync.google"}));};
    s.syncFirebase=function(o){
      o=o||{};var action=text(o.action||"upload").toLowerCase();
      if(action==="compare"||action==="download"){
        var guard=window.BL2FirebaseGuard;
        if(!guard||!guard.pullFirebaseToLocal){return Promise.reject(new Error("BL2FirebaseGuard no está disponible."));}
        return guard.pullFirebaseToLocal({id:o.periodoId,label:o.periodoLabel||o.periodoId},{confirm:o.confirm!==false,previewOnly:action==="compare"});
      }
      return request("firebase",Object.assign({},o,{source:"BL2Sync.firebase"}));
    };
    s.maybeSyncGoogleIdle=function(){return Promise.resolve({ok:false,blocked:true});};
    s.maybeSyncFirebaseDaily=function(){return Promise.resolve({ok:false,blocked:true});};
    s.syncBeforeClose=function(){return Promise.resolve({ok:true,skipped:true,manualOnly:true});};
    s.__singleSyncGateInstalled=true;return true;
  }

  function patchUI(){var ui=window.BDLSyncUIBridge;if(!ui){return false;}ui.runTarget=function(target,o){return confirmed(text(target).toLowerCase(),o||{});};ui.__singleSyncGateInstalled=true;return true;}

  function saveSheets(){
    var field=document.getElementById("bdlc-sheets-token"),store=window.BDLocalConfigStore;
    if(!field||!store||!store.getSheetsConfig||!store.setSheetsConfig){return;}
    var current=store.getSheetsConfig({includeSecret:true})||{};
    store.setSheetsConfig({enabled:current.enabled,appsScriptUrl:current.appsScriptUrl,token:text(field.value),spreadsheetId:current.spreadsheetId,sheetName:current.sheetName,batchSize:current.batchSize});
  }

  function bind(){
    if(bound){return;}bound=true;
    document.addEventListener("click",function(e){var b=e.target&&e.target.closest?e.target.closest("[data-bdlc-action]"):null;if(b&&b.getAttribute("data-bdlc-action")==="save-sheets"){saveSheets();}},true);
    if(window.MutationObserver){new MutationObserver(patchVisibleConfig).observe(document.body,{childList:true,subtree:true});}
  }

  function install(){
    enforce();bind();patchVisibleConfig();
    var manager=patchManager(),legacy=patchSync(),ui=patchUI();
    installed=manager||legacy||ui||installed;
    return {ok:installed,manager:manager,legacy:legacy,ui:ui,academicCollection:"EstudiantesPeriodo",personCollection:"Estudiantes"};
  }

  window.BDLocalSyncFixups={version:VERSION,compatibilityOnly:true,manualOnly:true,maxBatchSize:MAX,install:install,enforceFirebaseSplit:enforce,patchFirebaseUI:patchVisibleConfig,requestTarget:request,confirmedTarget:confirmed,saveSheetsAccess:saveSheets,status:function(){return {version:VERSION,installed:installed,manager:!!(window.BDLocalSyncManager&&window.BDLocalSyncManager.__singleSyncGateInstalled),legacy:!!(window.BL2Sync&&window.BL2Sync.__singleSyncGateInstalled),ui:!!(window.BDLSyncUIBridge&&window.BDLSyncUIBridge.__singleSyncGateInstalled),academicCollection:"EstudiantesPeriodo",personCollection:"Estudiantes"};}};

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install);
  window.addEventListener("bl2:ready",install);
  window.addEventListener("bl2:app-refreshed",function(){enforce();patchVisibleConfig();});
})(window,document);
