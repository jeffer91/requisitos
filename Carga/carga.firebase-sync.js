/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Controlar el apartado Firebase de Carga.
- Analizar primero las diferencias del período.
- Subir exclusivamente estudiantes, matrículas, requisitos e importaciones.
- No permitir que Carga suba calificaciones.
- Cargar la arquitectura Firebase únicamente cuando el usuario inicia una operación.
- Recuperar la lista de períodos y alinear el período global sin bloquear el arranque.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-period-recovery";
  var currentAnalysis=null;
  var running=false;
  var centerTask=null;
  var periodRecoveryTask=null;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}
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
  function number(id,value){var node=byId(id);if(node){node.textContent=String(Number(value||0));}}
  function message(value,type){var node=byId("cargaFirebaseMessage");if(node){node.textContent=text(value);node.className="carga-firebase-message "+(type||"");}}
  function status(label,type){
    var node=byId("cargaFirebaseStatus");
    if(!node){return;}
    node.textContent=label;
    node.className="carga-chip "+(type||"");
  }
  function setRunning(value){
    running=!!value;
    ["cargaBtnFirebaseAnalizar","cargaBtnFirebaseSubir"].forEach(function(id){var node=byId(id);if(node){node.disabled=running||!periodId();}});
    var upload=byId("cargaBtnFirebaseSubir");
    if(upload){upload.disabled=running||!periodId()||!currentAnalysis||Number(currentAnalysis.batchChanges||0)===0||Number(currentAnalysis.conflictos||0)>0;}
  }
  function clearSummary(){
    ["Pending","New","Modified","Unchanged","Conflicts","Remaining"].forEach(function(name){number("cargaFirebase"+name,0);});
    var rows=byId("cargaFirebaseCollections");if(rows){rows.innerHTML="";}
  }
  function entityLabel(entity){
    var labels={estudiantes:"Estudiantes",matriculas:"Matrículas",requisitos:"Requisitos",importaciones:"Importaciones"};
    return labels[entity]||entity;
  }
  function renderCollections(entities){
    var root=byId("cargaFirebaseCollections");
    if(!root){return;}
    var order=["estudiantes","matriculas","requisitos","importaciones"];
    root.innerHTML=order.map(function(entity){
      var item=entities&&entities[entity]||{nuevos:0,modificados:0,sinCambios:0,conflictos:0};
      return "<div class=\"carga-firebase-row\"><strong>"+entityLabel(entity)+"</strong>"+
        "<span>Nuevos: "+Number(item.nuevos||0)+"</span>"+
        "<span>Modificados: "+Number(item.modificados||0)+"</span>"+
        "<span>Iguales: "+Number(item.sinCambios||0)+"</span>"+
        "<span>Conflictos: "+Number(item.conflictos||0)+"</span></div>";
    }).join("");
  }
  function renderAnalysis(result){
    currentAnalysis=result&&result.ok?result:null;
    number("cargaFirebasePending",result&&result.pendingChanges);
    number("cargaFirebaseNew",result&&result.nuevos);
    number("cargaFirebaseModified",result&&result.modificados);
    number("cargaFirebaseUnchanged",result&&result.sinCambios);
    number("cargaFirebaseConflicts",result&&result.conflictos);
    number("cargaFirebaseRemaining",result&&result.remainingChanges);
    renderCollections(result&&result.entities||{});

    if(!result||result.ok===false){
      status("Error","is-danger");
      message(result&&result.message||"No se pudo analizar Firebase.","is-danger");
    }else if(Number(result.conflictos||0)>0){
      status("Revisión necesaria","is-danger");
      message("Se detectaron conflictos. No se habilitó la subida hasta resolverlos o actualizar la base local.","is-danger");
    }else if(Number(result.batchChanges||0)===0){
      status("Actualizado","is-ok");
      message("No existen cambios pendientes de Carga para este período.","is-ok");
    }else{
      status("Analizado","is-ok");
      message("Lote listo: "+Number(result.differences||0)+" diferencia(s) y "+Number(result.sinCambios||0)+" registro(s) ya iguales. Máximo 25 cambios por envío.","is-ok");
    }
    setRunning(false);
  }
  function syncPeriod(){
    var label=byId("cargaFirebasePeriod");if(label){label.textContent=periodLabel();}
    currentAnalysis=null;
    clearSummary();
    status(periodId()?"Pendiente de análisis":"Sin período",periodId()?"is-warn":"");
    message(periodId()?"Analice las diferencias antes de subir.":"Seleccione un período en Cargar estudiantes.","");
    setRunning(false);
  }
  function loadCenter(){
    if(center()){return Promise.resolve(center());}
    if(centerTask){return centerTask;}
    centerTask=new Promise(function(resolve,reject){
      var src=new URL("../BDLocal/firebase/bdl.firebase.operation-center.js",window.location.href).href;
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===src;});
      function ready(){var api=center();api?resolve(api):reject(new Error("El Centro de Operaciones Firebase no expuso su API."));}
      if(existing){existing.addEventListener("load",ready,{once:true});window.setTimeout(function(){if(center()){resolve(center());}},0);return;}
      var script=document.createElement("script");
      script.src=src;script.async=false;script.setAttribute("data-carga-firebase-center",src);
      script.onload=ready;script.onerror=function(){reject(new Error("No se pudo cargar el Centro de Operaciones Firebase."));};
      document.head.appendChild(script);
    }).finally(function(){centerTask=null;});
    return centerTask;
  }
  function ensureCenter(){
    return loadCenter().then(function(api){return Promise.resolve(typeof api.ensure==="function"?api.ensure():api).then(function(){return api;});});
  }
  function analyze(){
    if(running||!periodId()){return;}
    setRunning(true);status("Analizando","is-warn");message("Comparando la cola local con las tablas de Firebase...","");
    ensureCenter().then(function(api){return api.analyze("carga",{periodoId:periodId(),source:"Carga.firebase.analyze"});})
      .then(renderAnalysis).catch(function(error){renderAnalysis({ok:false,message:error&&error.message?error.message:String(error)});});
  }
  function upload(){
    if(running||!periodId()||!currentAnalysis){return;}
    var total=Number(currentAnalysis.differences||0);
    var unchanged=Number(currentAnalysis.sinCambios||0);
    if(!window.confirm("Se procesará el lote analizado para Carga.\n\nDiferencias: "+total+"\nYa iguales: "+unchanged+"\n\nNo se enviarán calificaciones. ¿Continuar?")){return;}
    setRunning(true);status("Subiendo","is-warn");message("Enviando únicamente las diferencias permitidas por Carga...","");
    ensureCenter().then(function(api){return api.push("carga",{periodoId:periodId(),requireAnalysis:true,source:"Carga.firebase.push"});})
      .then(function(result){
        if(!result||result.ok===false){
          status(result&&result.conflicts?"Conflicto":"Error","is-danger");
          message(result&&result.message||"No se pudo completar la subida.","is-danger");
          currentAnalysis=null;setRunning(false);return null;
        }
        status("Subida completada","is-ok");
        message("Firebase procesó "+Number(result.confirmedChanges||0)+" cambio(s). Se volverán a analizar los pendientes.","is-ok");
        currentAnalysis=null;
        return center().analyze("carga",{periodoId:periodId(),source:"Carga.firebase.afterPush"}).then(renderAnalysis);
      }).catch(function(error){status("Error","is-danger");message(error&&error.message?error.message:String(error),"is-danger");currentAnalysis=null;setRunning(false);});
  }
  function bind(){
    var select=byId("cargaPeriodoSelect");
    var analyzeButton=byId("cargaBtnFirebaseAnalizar");
    var uploadButton=byId("cargaBtnFirebaseSubir");
    if(select&&!select.__firebaseSyncBound){select.__firebaseSyncBound=true;select.addEventListener("change",syncPeriod);}
    if(analyzeButton&&!analyzeButton.__firebaseSyncBound){analyzeButton.__firebaseSyncBound=true;analyzeButton.addEventListener("click",analyze);}
    if(uploadButton&&!uploadButton.__firebaseSyncBound){uploadButton.__firebaseSyncBound=true;uploadButton.addEventListener("click",upload);}
    window.addEventListener("bdlocal:changes-created",function(){currentAnalysis=null;status("Cambios pendientes","is-warn");message("La información local cambió. Analice nuevamente antes de subir.","is-warn");setRunning(false);});
    window.addEventListener("carga:connection-ready",function(){recoverPeriods(0);});
    window.addEventListener("carga:periods-refreshed",function(){alignGlobalPeriod();syncPeriod();});
    syncPeriod();
    recoverPeriods(0);
  }

  window.CargaFirebaseSync={version:VERSION,analyze:analyze,upload:upload,renderAnalysis:renderAnalysis,ensureCenter:ensureCenter,recoverPeriods:recoverPeriods,alignGlobalPeriod:alignGlobalPeriod};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);
