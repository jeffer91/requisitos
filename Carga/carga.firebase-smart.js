/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Exponer una sola acción visible: Actualizar Firebase.
- Reconstruir la cola Firebase desde las tablas oficiales de BDLocal al iniciar la acción manual.
- Detectar una Firebase completamente vacía con lecturas mínimas y usar modo de carga inicial.
- Usar modo diferencial cuando Firebase ya contiene información.
- Procesar un solo lote de hasta 25 cambios a la vez, con una pausa breve entre lotes.
- Subir exclusivamente estudiantes, matrículas, requisitos, períodos, carreras, importaciones e historial.
- No permitir que Carga suba calificaciones.
- Cargar una sola arquitectura compartida y reutilizar el Centro de Operaciones Firebase.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-smart-single-button";
  var MAX_BATCH_SIZE=25;
  var MAX_AUTO_BATCHES=400;
  var BATCH_DELAY_MS=140;
  var EMPTY_CHECK_ENTITIES=["estudiantes","matriculas","requisitos","periodos","carreras","importaciones","historial"];
  var running=false;
  var centerTask=null;
  var architectureTask=null;
  var periodRecoveryTask=null;
  var currentScript=document.currentScript;
  var scriptBase=currentScript&&currentScript.src?currentScript.src:window.location.href;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function number(value){value=Number(value||0);return Number.isFinite(value)?value:0;}
  function delay(ms){return new Promise(function(resolve){window.setTimeout(resolve,Math.max(0,Number(ms||0)));});}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function periodId(){return text(byId("cargaPeriodoSelect")&&byId("cargaPeriodoSelect").value);}
  function periodLabel(){
    var select=byId("cargaPeriodoSelect");
    if(!select||select.selectedIndex<0){return "Sin seleccionar";}
    return text(select.options[select.selectedIndex]&&select.options[select.selectedIndex].text)||periodId()||"Sin seleccionar";
  }
  function canonicalPeriodId(value){
    value=text(value);
    var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");
  }
  function globalPeriodId(){
    var api=window.BDLPeriodoGlobal||window.RequisitosPeriodoGlobal||null;
    try{
      var value=api&&typeof api.get==="function"?api.get():api&&typeof api.status==="function"?(api.status()||{}).period:null;
      return canonicalPeriodId(value&&(value.id||value.periodoId||value.value));
    }catch(error){return "";}
  }
  function alignGlobalPeriod(){
    var select=byId("cargaPeriodoSelect");
    var wanted=globalPeriodId();
    if(!select||!wanted||!select.options||select.options.length<=1){return false;}
    var exists=Array.prototype.some.call(select.options,function(option){return canonicalPeriodId(option.value)===wanted;});
    if(!exists){return false;}
    if(canonicalPeriodId(select.value)!==wanted){
      select.value=wanted;
      select.dispatchEvent(new Event("change",{bubbles:true}));
    }
    return canonicalPeriodId(select.value)===wanted;
  }
  function recoverPeriods(attempt){
    attempt=Math.max(0,Number(attempt||0));
    var select=byId("cargaPeriodoSelect");
    if(select&&select.options&&select.options.length>1){alignGlobalPeriod();return Promise.resolve(true);}
    if(periodRecoveryTask){return periodRecoveryTask;}
    var index=window.CargaConnectionIndex;
    if(index&&typeof index.refreshPeriods==="function"){
      periodRecoveryTask=Promise.resolve(index.refreshPeriods()).then(function(){
        alignGlobalPeriod();
        return !!(select&&select.options&&select.options.length>1);
      }).catch(function(){return false;}).finally(function(){periodRecoveryTask=null;});
      return periodRecoveryTask.then(function(ok){
        if(!ok&&attempt<80){window.setTimeout(function(){recoverPeriods(attempt+1);},250);}
        return ok;
      });
    }
    if(attempt<80){window.setTimeout(function(){recoverPeriods(attempt+1);},250);}
    return Promise.resolve(false);
  }

  function status(label,type){
    var node=byId("cargaFirebaseStatus");
    if(!node){return;}
    node.textContent=text(label);
    node.setAttribute("data-status",text(type||""));
  }
  function message(value,type){
    var node=byId("cargaFirebaseMessage");
    if(!node){return;}
    node.textContent=text(value);
    node.className="carga-firebase-message "+(type||"");
  }
  function setRunning(value){
    running=!!value;
    var button=byId("cargaBtnFirebaseActualizar");
    if(button){
      button.disabled=running||!periodId();
      button.textContent=running?"Actualizando Firebase...":"Actualizar Firebase";
    }
  }
  function syncPeriod(){
    setRunning(false);
    if(!periodId()){
      status("Sin período","");
      message("Seleccione un período antes de actualizar Firebase.","");
      return;
    }
    status("Listo","is-ok");
    message("Firebase se actualizará desde BDLocal y solo procesará las diferencias de este período.","");
  }

  function absolute(relative){
    try{return new URL(relative,scriptBase).href;}catch(error){return relative;}
  }
  function waitFor(test,label,timeoutMs){
    timeoutMs=Math.max(500,Number(timeoutMs||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeoutMs){reject(new Error("No se pudo preparar "+label+"."));return;}
        window.setTimeout(check,60);
      })();
    });
  }
  function loadScript(relative,test,label){
    var current=null;
    try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    var src=absolute(relative);
    var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){
      return script.src===src||script.getAttribute("data-carga-firebase-src")===src;
    });
    if(existing){
      return test?waitFor(test,label||relative,15000):Promise.resolve(src);
    }
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-carga-firebase-src",src);
      script.onload=function(){
        if(test){waitFor(test,label||relative,15000).then(resolve).catch(reject);}
        else{resolve(src);}
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+(label||relative)+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function loadCenter(){
    if(center()){return Promise.resolve(center());}
    if(centerTask){return centerTask;}
    centerTask=loadScript(
      "../BDLocal/firebase/bdl.firebase.operation-center.js",
      function(){return center();},
      "el Centro de Operaciones Firebase"
    ).finally(function(){centerTask=null;});
    return centerTask;
  }

  function ensureSharedArchitecture(){
    var bridge=window.BDLOutboxBridge||null;
    if(!bridge||typeof bridge.loadSharedArchitecture!=="function"){
      return Promise.reject(new Error("El puente compartido de BDLocal no está disponible."));
    }
    var existing=window.BDLSharedArchitectureReady;
    if(existing){
      return Promise.resolve(existing).catch(function(){return bridge.loadSharedArchitecture();});
    }
    return bridge.loadSharedArchitecture();
  }

  function ensureArchitecture(){
    if(architectureTask){return architectureTask;}
    architectureTask=loadScript(
      "../BDLocal/adapters/bdl.screen-deps.js",
      function(){return window.BDLocalScreenDeps||null;},
      "las dependencias compartidas de BDLocal"
    ).then(function(screenDeps){
      if(!screenDeps||typeof screenDeps.activateHeavy!=="function"){
        throw new Error("BDLocalScreenDeps.activateHeavy no está disponible.");
      }
      return screenDeps.activateHeavy();
    }).then(function(){
      var hub=window.BDLocalConexiones||null;
      if(!hub||typeof hub.ensureCoreReady!=="function"){
        throw new Error("El núcleo completo de BDLocal no está disponible.");
      }
      return hub.ensureCoreReady();
    }).then(function(){
      return ensureSharedArchitecture();
    }).then(function(){
      return loadScript(
        "../BDLocal/sync/targets/bdl.sync.targets.index.js",
        function(){return window.BDLSyncTargets||null;},
        "el registro de destinos de sincronización"
      );
    }).then(function(){
      return loadScript(
        "../BDLocal/sync/bdl.sync.outbox.js",
        function(){return window.BDLSyncOutbox||null;},
        "la cola de sincronización"
      );
    }).then(function(){
      return loadScript(
        "../BDLocal/sync/bdl.sync.orchestrator.js",
        function(){return window.BDLSyncOrchestrator||null;},
        "el orquestador de sincronización"
      );
    }).then(function(){
      return loadScript(
        "../BDLocal/sync/bdl.sync.index.js",
        function(){return window.BDLSyncV2||null;},
        "el motor de sincronización V2"
      );
    }).then(function(){
      return loadScript(
        "../BDLocal/sync/targets/bdl.sync.target.firebase.js",
        function(){return window.BDLSyncTargetFirebase||null;},
        "el destino Firebase V2"
      );
    }).then(function(){
      var pushControl=window.RequisitosFirebasePushControl||null;
      if(pushControl&&typeof pushControl.installRebuildGate==="function"){
        pushControl.installRebuildGate();
      }
      var required={
        BDLSyncOutbox:window.BDLSyncOutbox,
        BDLSyncTargetFirebase:window.BDLSyncTargetFirebase,
        RequisitosFirebaseRepository:window.RequisitosFirebaseRepository,
        BDLRepoPersonas:window.BDLRepoPersonas
      };
      var missing=Object.keys(required).filter(function(name){return !required[name];});
      if(missing.length){throw new Error("Arquitectura Firebase incompleta: falta "+missing.join(", ")+".");}
      return true;
    }).finally(function(){architectureTask=null;});
    return architectureTask;
  }

  function ensureCenter(){
    return loadCenter().then(function(api){
      return ensureArchitecture().then(function(){
        var pushControl=window.RequisitosFirebasePushControl||null;
        if(pushControl&&typeof pushControl.installRebuildGate==="function"){
          pushControl.installRebuildGate();
        }
        return Promise.resolve(typeof api.ensure==="function"?api.ensure():api).then(function(){return api;});
      });
    });
  }

  function detectRemoteState(){
    var current=repository();
    if(!current||typeof current.list!=="function"){
      return Promise.reject(new Error("El repositorio Firebase V2 no está disponible."));
    }
    var detail={empty:true,checked:0,documentsFound:0,collections:{}};
    var chain=Promise.resolve();
    EMPTY_CHECK_ENTITIES.forEach(function(entity){
      chain=chain.then(function(){
        return current.list(entity,{limit:1,includeDeleted:true}).then(function(result){
          var total=number(result&&result.total);
          detail.collections[entity]=total;
          detail.checked+=1;
          detail.documentsFound+=total;
          if(total>0){detail.empty=false;}
        });
      });
    });
    return chain.then(function(){return detail;});
  }

  function prepareLocalQueue(api){
    if(!api||typeof api.requeue!=="function"){
      return Promise.reject(new Error("La reconstrucción inteligente desde BDLocal no está disponible."));
    }
    return api.requeue("carga",{
      periodoId:periodId(),
      source:"Carga.firebase.smartUpdate"
    }).then(function(result){
      if(!result||result.ok===false){
        throw new Error(result&&result.message||"No se pudo preparar la información local para Firebase.");
      }
      return result;
    });
  }

  function emptyTotals(mode,prepared){
    return {
      ok:true,
      mode:mode,
      prepared:number(prepared&&prepared.requeued||prepared&&prepared.prepared),
      batches:0,
      selectedChanges:0,
      confirmedChanges:0,
      documentsWritten:0,
      conflicts:0,
      alreadyEqual:0,
      newDocuments:0,
      modifiedDocuments:0,
      stopped:false,
      stopReason:""
    };
  }
  function addAnalysis(totals,analysis){
    totals.alreadyEqual+=number(analysis&&analysis.sinCambios);
    totals.newDocuments+=number(analysis&&analysis.nuevos);
    totals.modifiedDocuments+=number(analysis&&analysis.modificados);
  }
  function addPush(totals,result){
    totals.batches+=1;
    totals.selectedChanges+=number(result&&result.selectedChanges);
    totals.confirmedChanges+=number(result&&result.confirmedChanges);
    totals.documentsWritten+=number(result&&result.documentsWritten);
    totals.conflicts+=number(result&&result.conflicts);
  }
  function progressMessage(totals){
    var target=totals.prepared>0?" de "+totals.prepared:"";
    return "Procesados "+totals.confirmedChanges+target+" cambio(s) · "+totals.documentsWritten+" documento(s) escritos · "+totals.conflicts+" conflicto(s).";
  }

  function runBootstrapBatches(api,totals,iteration){
    iteration=Number(iteration||0);
    if(iteration>=MAX_AUTO_BATCHES){
      totals.stopped=true;
      totals.stopReason="Se alcanzó el límite de seguridad de lotes por ejecución.";
      return Promise.resolve(totals);
    }
    status("Carga inicial","is-warn");
    message("Validando de forma segura el siguiente lote de hasta "+MAX_BATCH_SIZE+" cambios...","");
    return api.analyze("carga",{
      periodoId:periodId(),
      source:"Carga.firebase.bootstrapAnalyze"
    }).then(function(analysis){
      if(!analysis||analysis.ok===false){throw new Error(analysis&&analysis.message||"No se pudo validar la carga inicial de Firebase.");}
      addAnalysis(totals,analysis);
      if(number(analysis.batchChanges)===0){return totals;}
      if(number(analysis.conflictos)>0){
        totals.stopped=true;
        totals.conflicts+=number(analysis.conflictos);
        totals.stopReason="Se detectaron conflictos durante la validación de la carga inicial.";
        return totals;
      }
      message("Lote validado: "+number(analysis.nuevos)+" nuevo(s), "+number(analysis.modificados)+" modificado(s) y "+number(analysis.sinCambios)+" ya igual(es).","");
      return api.push("carga",{
        periodoId:periodId(),
        requireAnalysis:true,
        source:"Carga.firebase.bootstrapPush"
      }).then(function(result){
        if(!result){throw new Error("Firebase no devolvió resultado.");}
        addPush(totals,result);
        if(number(result.conflicts)>0){
          totals.stopped=true;
          totals.stopReason="Se detectaron conflictos y la carga se detuvo para no sobrescribir información.";
          return totals;
        }
        if(result.ok===false){throw new Error(result.message||"No se pudo completar el lote Firebase.");}
        if(number(result.selectedChanges)===0){return totals;}
        if(number(result.confirmedChanges)===0){
          totals.stopped=true;
          totals.stopReason="El lote no confirmó cambios; se detuvo para evitar un ciclo de reintentos.";
          return totals;
        }
        message(progressMessage(totals),"");
        return delay(BATCH_DELAY_MS).then(function(){return runBootstrapBatches(api,totals,iteration+1);});
      });
    });
  }

  function runDifferentialBatches(api,totals,iteration){
    iteration=Number(iteration||0);
    if(iteration>=MAX_AUTO_BATCHES){
      totals.stopped=true;
      totals.stopReason="Se alcanzó el límite de seguridad de lotes por ejecución.";
      return Promise.resolve(totals);
    }
    status("Comparando","is-warn");
    message("Revisando el siguiente lote de hasta "+MAX_BATCH_SIZE+" cambios sin recorrer toda Firebase...","");
    return api.analyze("carga",{
      periodoId:periodId(),
      source:"Carga.firebase.smartAnalyze"
    }).then(function(analysis){
      if(!analysis||analysis.ok===false){throw new Error(analysis&&analysis.message||"No se pudo comparar BDLocal con Firebase.");}
      addAnalysis(totals,analysis);
      if(number(analysis.batchChanges)===0){return totals;}
      if(number(analysis.conflictos)>0){
        totals.stopped=true;
        totals.conflicts+=number(analysis.conflictos);
        totals.stopReason="Se detectaron conflictos durante el análisis.";
        return totals;
      }
      status("Actualizando","is-warn");
      message("Lote analizado: "+number(analysis.differences)+" diferencia(s) y "+number(analysis.sinCambios)+" documento(s) ya iguales.","");
      return api.push("carga",{
        periodoId:periodId(),
        requireAnalysis:true,
        source:"Carga.firebase.smartPush"
      }).then(function(result){
        if(!result){throw new Error("Firebase no devolvió resultado.");}
        addPush(totals,result);
        if(number(result.conflicts)>0){
          totals.stopped=true;
          totals.stopReason="Se detectaron conflictos y la actualización se detuvo para no sobrescribir información.";
          return totals;
        }
        if(result.ok===false){throw new Error(result.message||"No se pudo completar el lote Firebase.");}
        if(number(result.selectedChanges)===0){return totals;}
        if(number(result.confirmedChanges)===0){
          totals.stopped=true;
          totals.stopReason="El lote no confirmó cambios; se detuvo para evitar un ciclo de reintentos.";
          return totals;
        }
        message(progressMessage(totals),"");
        return delay(BATCH_DELAY_MS).then(function(){return runDifferentialBatches(api,totals,iteration+1);});
      });
    });
  }

  function finishSummary(totals){
    if(totals.stopped){
      status(totals.conflicts>0?"Revisión necesaria":"Pausado",totals.conflicts>0?"is-danger":"is-warn");
      message(
        progressMessage(totals)+" "+totals.stopReason,
        totals.conflicts>0?"is-danger":"is-warn"
      );
      return totals;
    }
    status("Actualizado","is-ok");
    var modeText=totals.mode==="bootstrap"?"Carga inicial completada.":"Actualización diferencial completada.";
    message(
      modeText+" "+totals.confirmedChanges+" cambio(s) procesados, "+totals.documentsWritten+" documento(s) escritos y "+totals.alreadyEqual+" ya estaban iguales.",
      "is-ok"
    );
    return totals;
  }

  function updateFirebase(){
    if(running||!periodId()){return Promise.resolve(null);}
    setRunning(true);
    status("Preparando","is-warn");
    message("Preparando una sola arquitectura compartida de BDLocal y Firebase...","");

    var api=null;
    var remoteState=null;
    var prepared=null;

    return ensureCenter().then(function(current){
      api=current;
      status("Verificando","is-warn");
      message("Comprobando con lecturas mínimas si Firebase está vacía...","");
      return detectRemoteState();
    }).then(function(result){
      remoteState=result;
      status(result.empty?"Firebase vacía":"Firebase existente","is-warn");
      message(result.empty
        ?"Firebase está vacía. Se usará una carga inicial segura y controlada por lotes."
        :"Firebase contiene datos. Se usará comparación diferencial por lotes.","");
      return prepareLocalQueue(api);
    }).then(function(result){
      prepared=result;
      var preparedCount=number(result&&result.requeued||result&&result.prepared);
      if(preparedCount===0){
        status("Sin datos locales","is-warn");
        message("No existen registros locales de Carga para este período. Guarde primero la información en BDLocal.","is-warn");
        return {done:true,result:{ok:true,emptyLocal:true,prepared:0,mode:remoteState&&remoteState.empty?"bootstrap":"differential"}};
      }
      var mode=remoteState&&remoteState.empty?"bootstrap":"differential";
      var totals=emptyTotals(mode,prepared);
      status(mode==="bootstrap"?"Carga inicial":"Comparando","is-warn");
      message("Se prepararon "+preparedCount+" cambio(s) desde BDLocal. Iniciando lotes de hasta "+MAX_BATCH_SIZE+"...","");
      var task=mode==="bootstrap"
        ?runBootstrapBatches(api,totals,0)
        :runDifferentialBatches(api,totals,0);
      return task.then(function(finalTotals){return {done:false,result:finishSummary(finalTotals)};});
    }).then(function(wrapper){
      return wrapper&&wrapper.result||wrapper;
    }).catch(function(error){
      status("Error","is-danger");
      message(error&&error.message?error.message:String(error),"is-danger");
      return {ok:false,message:error&&error.message?error.message:String(error)};
    }).finally(function(){setRunning(false);});
  }

  /* Compatibilidad: las acciones antiguas apuntan a la nueva operación única. */
  function analyze(){return updateFirebase();}
  function rebuild(){return updateFirebase();}
  function upload(){return updateFirebase();}

  function ensureInlineUI(){
    var legacyTitle=byId("tituloCargaFirebase");
    var legacyCard=legacyTitle&&legacyTitle.closest?legacyTitle.closest("section"):null;
    if(legacyCard&&legacyCard.parentNode){legacyCard.parentNode.removeChild(legacyCard);}

    var actions=byId("cargaBtnGuardar");
    actions=actions&&actions.parentNode;
    if(!actions){return false;}

    var button=byId("cargaBtnFirebaseActualizar");
    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.id="cargaBtnFirebaseActualizar";
      button.className="carga-btn carga-btn-primary";
      button.textContent="Actualizar Firebase";
      var clean=byId("cargaBtnLimpiar");
      actions.insertBefore(button,clean&&clean.parentNode===actions?clean:null);
    }

    var panel=actions.closest?actions.closest(".carga-file-panel"):actions.parentNode;
    if(panel&&!byId("cargaFirebaseInlineState")){
      var row=document.createElement("div");
      row.id="cargaFirebaseInlineState";
      row.innerHTML='<span>Firebase</span><strong id="cargaFirebaseStatus">Listo</strong>';
      panel.appendChild(row);
      var info=document.createElement("div");
      info.id="cargaFirebaseMessage";
      info.className="carga-firebase-message";
      info.textContent="Firebase se actualizará desde BDLocal y solo procesará diferencias.";
      panel.appendChild(info);
    }
    return true;
  }

  function bind(){
    ensureInlineUI();
    var select=byId("cargaPeriodoSelect");
    var button=byId("cargaBtnFirebaseActualizar");
    if(select&&!select.__firebaseSmartBound){
      select.__firebaseSmartBound=true;
      select.addEventListener("change",syncPeriod);
    }
    if(button&&!button.__firebaseSmartBound){
      button.__firebaseSmartBound=true;
      button.addEventListener("click",function(event){
        event.preventDefault();
        updateFirebase();
      });
    }
    window.addEventListener("bdlocal:changes-created",function(){
      if(running){return;}
      status("Cambios locales","is-warn");
      message("BDLocal cambió. Pulse Actualizar Firebase cuando quiera respaldar las diferencias.","is-warn");
      setRunning(false);
    });
    window.addEventListener("carga:saved",function(){
      if(running){return;}
      status("Cambios locales","is-warn");
      message("La carga quedó guardada en BDLocal. Puede actualizar Firebase con un solo botón.","is-warn");
      setRunning(false);
    });
    window.addEventListener("carga:connection-ready",function(){recoverPeriods(0);});
    window.addEventListener("carga:periods-refreshed",function(){alignGlobalPeriod();syncPeriod();});
    syncPeriod();
    recoverPeriods(0);
  }

  var publicApi={
    version:VERSION,
    maxBatchSize:MAX_BATCH_SIZE,
    automatic:false,
    manualOnly:true,
    update:updateFirebase,
    analyze:analyze,
    rebuild:rebuild,
    upload:upload,
    ensureCenter:ensureCenter,
    ensureArchitecture:ensureArchitecture,
    detectRemoteState:detectRemoteState,
    recoverPeriods:recoverPeriods,
    alignGlobalPeriod:alignGlobalPeriod,
    status:function(){return {version:VERSION,running:running,periodoId:periodId(),maxBatchSize:MAX_BATCH_SIZE};}
  };
  window.CargaFirebaseSmart=publicApi;
  window.CargaFirebaseSync=publicApi;

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})(window,document);
