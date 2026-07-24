/* =========================================================
Nombre completo: bdl.firebase.push-control.js
Ruta: /BDLocal/firebase/bdl.firebase.push-control.js
Función:
- Sustituir el botón Firebase heredado por la subida V2.
- Procesar únicamente cambios_pendientes del período activo.
- Mantener conflictos y cambios no procesados dentro de la cola.
- Evitar referencias a EstudiantesPeriodo en la interfaz operativa.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-push-v2";
  var FLAG="__firebaseV2PushControlBound";
  var running=false;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function engine(){return window.RequisitosFirebaseSyncEngine||null;}
  function outbox(){return window.BDLSyncOutbox||null;}

  function period(){
    try{
      if(window.RequisitosPeriodoGlobal&&typeof window.RequisitosPeriodoGlobal.get==="function"){
        var current=window.RequisitosPeriodoGlobal.get();
        if(current&&text(current.id)){return {id:text(current.id),label:text(current.label||current.id)};}
      }
    }catch(error){}
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){return {id:text(selected.id),label:text(selected.label||selected.id)};}
      }
    }catch(error){}
    return null;
  }

  function log(message,level){
    var box=byId("bl2-log");
    if(box){
      var item=document.createElement("div");
      item.className="bl2-log-item "+(level?"is-"+level:"");
      item.innerHTML="<strong>Firebase V2</strong><span>"+text(message).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</span>";
      box.insertBefore(item,box.firstChild);
    }
  }

  function progress(percent,detail){
    try{window.dispatchEvent(new CustomEvent("bl2:sync-progress",{detail:{target:"Firebase",percent:percent,detail:detail}}));}catch(error){}
  }

  function pendingCount(periodoId){
    var current=outbox();
    if(!current||typeof current.counts!=="function"){return Promise.resolve(null);}
    return current.counts({periodoId:periodoId,force:true,includeLegacy:false}).then(function(counts){
      var detail=counts&&counts.detail&&counts.detail.firebase||{};
      return Number(detail.pending||0)+Number(detail.error||0)+Number(detail.blocked||0)+Number(detail.waitingRetry||0);
    }).catch(function(){return null;});
  }

  function refresh(){
    if(window.RequisitosFirebaseControlCenter&&typeof window.RequisitosFirebaseControlCenter.refreshStatus==="function"){
      window.RequisitosFirebaseControlCenter.refreshStatus().catch(function(){});
    }
    if(window.BDLSyncUIBridge&&typeof window.BDLSyncUIBridge.refreshCounts==="function"){
      window.BDLSyncUIBridge.refreshCounts({force:true}).catch(function(){});
    }
    if(window.BL2App&&typeof window.BL2App.refresh==="function"){
      window.BL2App.refresh({force:true,reason:"firebase-v2-push"}).catch(function(){});
    }
  }

  function run(){
    if(running){return Promise.reject(new Error("Ya existe una subida Firebase en curso."));}
    var currentPeriod=period();
    if(!currentPeriod){return Promise.reject(new Error("Seleccione un período."));}
    if(!engine()||typeof engine().pushPending!=="function"){
      return Promise.reject(new Error("El motor Firebase V2 todavía no está disponible."));
    }

    return pendingCount(currentPeriod.id).then(function(total){
      if(total===0){
        window.alert("Firebase V2 no tiene cambios pendientes para "+currentPeriod.label+".");
        return {ok:true,skipped:true};
      }
      var totalText=total==null?"por revisar":String(total);
      if(!window.confirm(
        "Firebase V2\n\nPeríodo: "+currentPeriod.label+
        "\nCambios abiertos: "+totalText+
        "\nMáximo por ejecución: 25.\n\nLa subida validará versión, hash y fecha antes de escribir. Los conflictos permanecerán pendientes.\n\n¿Continuar?"
      )){
        return {ok:true,cancelled:true};
      }

      running=true;
      var button=byId("bl2-btn-push-firebase");
      if(button){button.disabled=true;button.textContent="Subiendo Firebase...";}
      progress(10,"Preparando cambios pendientes...");

      return engine().pushPending({
        manual:true,
        periodoId:currentPeriod.id,
        periodoLabel:currentPeriod.label,
        limit:25,
        batchSize:25,
        source:"FirebaseV2PushControl.manual"
      }).then(function(result){
        if(!result){throw new Error("Firebase no devolvió resultado.");}
        progress(100,"Subida Firebase finalizada.");
        var message=text(result.message||"Subida finalizada.");
        log(message,result.ok===false?"warn":"ok");
        window.alert(message);
        try{window.dispatchEvent(new CustomEvent("bdlocal:sync-v2-finished",{detail:{target:"firebase",result:result}}));}catch(error){}
        return result;
      }).finally(function(){
        running=false;
        refresh();
      });
    });
  }

  function bind(){
    if(window[FLAG]){return window.RequisitosFirebasePushControl;}
    var current=byId("bl2-btn-push-firebase");
    if(!current){return null;}
    var button=current.cloneNode(true);
    current.parentNode.replaceChild(button,current);
    button.__firebaseV2PushBound=true;
    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopPropagation();
      if(typeof event.stopImmediatePropagation==="function"){event.stopImmediatePropagation();}
      run().catch(function(error){
        running=false;
        log(error&&error.message?error.message:String(error),"error");
        window.alert(error&&error.message?error.message:String(error));
        refresh();
      });
    },true);
    window[FLAG]=true;
    return window.RequisitosFirebasePushControl;
  }

  window.RequisitosFirebasePushControl={
    version:VERSION,
    manualOnly:true,
    automatic:false,
    bind:bind,
    run:run,
    status:function(){return {version:VERSION,bound:!!window[FLAG],running:running,period:period()};}
  };

  bind();
})(window,document);
