/* =========================================================
Nombre completo: bdl.external-operation.supplement.js
Ruta: /BDLocal/firebase/bdl.external-operation.supplement.js
Función:
- Incorporar las descargas de Google Sheets al bloqueo externo único.
- Bloquear cambios de período mientras una operación externa está activa.
- Interceptar los controles legacy antes de sus listeners antiguos.
- Cargar y esperar todos los conectores activos antes de certificar BDLocal.
- Mantener las operaciones manuales y no destructivas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.0-cloud-pull-period-connectors";
  var FLAG="__bdlExternalOperationSupplementInstalled";
  var PATCH_FLAG="__bdlExternalOperationSupplementPatched";
  var CONNECTORS_SCRIPT_ID="bdl-active-connectors-ready-script";
  var timer=null;
  var attempts=0;
  var MAX_ATTEMPTS=180;
  var scriptBase=document.currentScript&&document.currentScript.src?document.currentScript.src:document.baseURI;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function gate(){return window.BDLExternalOperationGate||null;}
  function cloud(){return window.BL2CloudPullSafe||null;}
  function connectorsUrl(){try{return new URL("../conexiones/cone.active-connectors.ready.js",scriptBase).href;}catch(error){return "../conexiones/cone.active-connectors.ready.js";}}

  function ensureActiveConnectors(){
    if(window.BDLActiveConnectors){
      if(typeof window.BDLActiveConnectors.patch==="function"){window.BDLActiveConnectors.patch();}
      if(typeof window.BDLActiveConnectors.ensure==="function"){return window.BDLActiveConnectors.ensure().catch(function(){return null;});}
      return Promise.resolve(window.BDLActiveConnectors);
    }
    var existing=byId(CONNECTORS_SCRIPT_ID);
    if(existing){
      return window.BDLActiveConnectorsReady&&typeof window.BDLActiveConnectorsReady.then==="function"
        ?window.BDLActiveConnectorsReady.catch(function(){return null;})
        :Promise.resolve(null);
    }
    return new Promise(function(resolve){
      var script=document.createElement("script");
      script.id=CONNECTORS_SCRIPT_ID;
      script.src=connectorsUrl();
      script.async=false;
      script.defer=false;
      script.setAttribute("data-bdl-active-connectors","true");
      script.onload=function(){
        var ready=window.BDLActiveConnectorsReady;
        if(ready&&typeof ready.then==="function"){ready.then(resolve).catch(function(){resolve(null);});return;}
        resolve(window.BDLActiveConnectors||null);
      };
      script.onerror=function(){resolve(null);};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function setDisabled(node,locked){
    if(!node||!("disabled" in node)){return;}
    if(locked){
      if(node.disabled!==true){node.setAttribute("data-bdl-supplement-disabled","true");node.disabled=true;}
    }else if(node.getAttribute("data-bdl-supplement-disabled")==="true"){
      node.removeAttribute("data-bdl-supplement-disabled");
      node.disabled=false;
    }
  }

  function syncUi(){
    var current=gate();
    var locked=!!(current&&typeof current.isLocked==="function"&&current.isLocked());
    [
      "bl2-btn-pull-sheets",
      "bl2-btn-pull-sheets-all",
      "bl2-btn-clean-sheets-duplicates",
      "bl2-btn-period-save"
    ].forEach(function(id){setDisabled(byId(id),locked);});
    Array.prototype.slice.call(document.querySelectorAll("[data-bl2-period]")).forEach(function(node){setDisabled(node,locked);});
  }

  function wrapMethod(api,name,owner){
    if(!api||typeof api[name]!=="function"){return false;}
    if(api[name][PATCH_FLAG]){return true;}
    var original=api[name].bind(api);
    var wrapped=function(){
      var current=gate();
      var args=Array.prototype.slice.call(arguments);
      if(!current||typeof current.withLock!=="function"){
        return Promise.reject(new Error("El bloqueo único de operaciones no está disponible."));
      }
      return current.withLock(owner,function(){return original.apply(null,args);},{kind:"cloud-pull"});
    };
    wrapped[PATCH_FLAG]=true;
    wrapped.__original=original;
    api[name]=wrapped;
    return true;
  }

  function patchCloud(){
    var api=cloud();
    if(!api){return false;}
    wrapMethod(api,"pullSheetsToLocal","google:pull-period");
    wrapMethod(api,"pullAllSheetsToLocal","google:pull-all");
    wrapMethod(api,"selectAndPull","google:select-and-pull");
    wrapMethod(api,"cleanSheetsDuplicates","google:compact");
    api.operationGuardVersion=VERSION;
    return true;
  }

  function alertPeriodResult(result){
    if(!result||result.cancelled){return result;}
    window.alert(
      text(result.message||"Google Sheets procesado.")+"\n\n"+
      "Filas remotas: "+Number(result.totalEntrada||0)+"\n"+
      "Aplicables: "+Number(result.aplicables||0)+"\n"+
      "Protegidos: "+Number((result.protectedLocal||0)+(result.localNewer||0)+(result.ambiguous||0))
    );
    return result;
  }

  function alertAllResult(result){
    if(!result||result.cancelled){return result;}
    window.alert(
      text(result.message||"Google Sheets procesado.")+"\n\n"+
      "Períodos: "+Number(result.periodosProcesados||0)+"\n"+
      "Filas remotas: "+Number(result.totalEntrada||0)+"\n"+
      "Aplicables: "+Number(result.aplicables||0)+"\n"+
      "Protegidos: "+Number(result.protegidos||0)
    );
    return result;
  }

  function blockPeriodChange(event){
    var current=gate();
    if(!current||typeof current.isLocked!=="function"||!current.isLocked()){return false;}
    var button=event.target&&event.target.closest?event.target.closest("#bl2-btn-period-save,[data-bl2-period]"):null;
    if(!button){return false;}
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    var status=current.status&&current.status();
    window.alert("No se puede cambiar el período mientras está activa la operación: "+text(status&&status.owner||"externa")+".");
    return true;
  }

  function googleAction(event){
    var button=event.target&&event.target.closest?event.target.closest("button"):null;
    if(!button){return "";}
    if(button.id==="bl2-btn-pull-sheets"){return "period";}
    if(button.id==="bl2-btn-pull-sheets-all"){return "all";}
    if(button.id==="bl2-btn-clean-sheets-duplicates"){return "compact";}
    return "";
  }

  function clickHandler(event){
    if(blockPeriodChange(event)){return;}
    var action=googleAction(event);
    if(!action){return;}
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if(!patchCloud()){
      window.alert("La descarga segura de Google Sheets todavía no está disponible.");
      return;
    }

    var api=cloud();
    var work;
    if(action==="period"){
      work=api.selectAndPull().then(alertPeriodResult);
    }else if(action==="all"){
      work=api.pullAllSheetsToLocal({confirm:true}).then(alertAllResult);
    }else{
      if(!window.confirm("Compactar duplicados de Google Sheets sin borrar registros únicos. ¿Continuar?")){return;}
      work=api.cleanSheetsDuplicates().then(function(result){window.alert(text(result&&result.message||"Duplicados compactados."));return result;});
    }

    Promise.resolve(work).catch(function(error){
      if(error&&error.message==="Operación cancelada."){return;}
      window.alert(text(error&&error.message||error));
    }).finally(syncUi);
  }

  function schedule(delay){
    if(timer||attempts>=MAX_ATTEMPTS){return;}
    timer=window.setTimeout(function(){
      timer=null;
      attempts+=1;
      patchCloud();
      syncUi();
      ensureActiveConnectors();
      if(!cloud()||!window.BDLActiveConnectors){schedule(attempts<30?80:220);}
    },Math.max(30,Number(delay||60)));
  }

  if(!window[FLAG]){
    window[FLAG]=true;
    document.addEventListener("click",clickHandler,true);
    window.addEventListener("bdlocal:external-operation-lock-changed",syncUi);
    ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:firebase-redesign-ready","bl2:app-refreshed"].forEach(function(name){
      window.addEventListener(name,function(){attempts=0;schedule(20);});
    });
  }

  window.BDLExternalOperationSupplement={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    destructive:false,
    patchCloud:patchCloud,
    ensureActiveConnectors:ensureActiveConnectors,
    syncUi:syncUi,
    status:function(){
      var active=window.BDLActiveConnectors&&typeof window.BDLActiveConnectors.status==="function"?window.BDLActiveConnectors.status():null;
      return {version:VERSION,installed:!!window[FLAG],cloudPatched:!!(cloud()&&cloud().operationGuardVersion),activeConnectors:active,locked:!!(gate()&&gate().isLocked&&gate().isLocked())};
    }
  };

  patchCloud();
  syncUi();
  ensureActiveConnectors();
  schedule(30);
})(window,document);
