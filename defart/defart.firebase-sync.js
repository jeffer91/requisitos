/* =========================================================
Nombre completo: defart.firebase-sync.js
Ruta: /defart/defart.firebase-sync.js
Función:
- Analizar las diferencias de notas del período seleccionado.
- Subir exclusivamente las notas originadas en Defensas.
- Preparar una reconstrucción desde los cambios locales conservados.
- Exigir un análisis vigente antes de enviar.
- Mantener el período global seleccionado después del arranque asíncrono de Defensas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.2.0-firebase-rebuild";
  var analysis=null;
  var running=false;
  var periodAligned=false;

  function byId(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function center(){return window.RequisitosFirebaseOperationCenter||null;}
  function periodId(){return text(byId("def-filter-periodo")&&byId("def-filter-periodo").value);}
  function globalPeriod(){
    var api=window.BDLPeriodoGlobal||window.RequisitosPeriodoGlobal||null;
    try{
      var value=api&&typeof api.get==="function"?api.get():api&&typeof api.status==="function"?(api.status()||{}).period:null;
      return text(value&&(value.id||value.periodoId||value.value));
    }catch(error){return "";}
  }
  function alignPeriod(attempt){
    attempt=Number(attempt||0);
    if(periodAligned){return true;}
    var select=byId("def-filter-periodo");
    var wanted=globalPeriod();
    if(select&&wanted&&select.options&&select.options.length>1){
      var exists=Array.prototype.some.call(select.options,function(option){return text(option.value)===wanted;});
      if(exists){
        if(!text(select.value)){select.value=wanted;select.dispatchEvent(new Event("change",{bubbles:true}));}
        periodAligned=text(select.value)===wanted;
        if(periodAligned){clear();return true;}
      }
    }
    if(attempt<160){window.setTimeout(function(){alignPeriod(attempt+1);},60);}
    return false;
  }
  function setNumber(id,value){var node=byId(id);if(node){node.textContent=String(Number(value||0));}}
  function status(message,type){var node=byId("def-firebase-status");if(node){node.textContent=text(message);node.className="def-firebase-status "+(type||"");}}
  function ensureRebuildButton(){
    var current=byId("def-btn-firebase-rebuild");
    if(current){return current;}
    var analyzeButton=byId("def-btn-firebase-analyze");
    var parent=analyzeButton&&analyzeButton.parentNode;
    if(!parent){return null;}
    var button=document.createElement("button");
    button.type="button";
    button.id="def-btn-firebase-rebuild";
    button.textContent="Preparar carga completa";
    button.title="Vuelve a dejar pendientes únicamente las notas conservadas de Defensas";
    parent.insertBefore(button,analyzeButton);
    return button;
  }
  function setButtons(){
    var rebuildButton=byId("def-btn-firebase-rebuild");
    var analyzeButton=byId("def-btn-firebase-analyze");
    var pushButton=byId("def-btn-firebase-push");
    if(rebuildButton){rebuildButton.disabled=running||!periodId();}
    if(analyzeButton){analyzeButton.disabled=running||!periodId();}
    if(pushButton){pushButton.disabled=running||!periodId()||!analysis||Number(analysis.batchChanges||0)===0||Number(analysis.conflictos||0)>0;}
  }
  function clear(){
    analysis=null;
    ["Pending","New","Modified","Unchanged","Conflicts"].forEach(function(name){setNumber("defFirebase"+name,0);});
    status(periodId()?"Analice las diferencias de calificaciones.":"Seleccione un período.",periodId()?"is-warn":"");
    setButtons();
  }
  function ensure(){
    var api=center();
    if(!api){return Promise.reject(new Error("El Centro de Operaciones Firebase no está disponible."));}
    return Promise.resolve(typeof api.ensure==="function"?api.ensure():api).then(function(){return api;});
  }
  function render(result){
    analysis=result&&result.ok?result:null;
    setNumber("defFirebasePending",result&&result.pendingChanges);
    setNumber("defFirebaseNew",result&&result.nuevos);
    setNumber("defFirebaseModified",result&&result.modificados);
    setNumber("defFirebaseUnchanged",result&&result.sinCambios);
    setNumber("defFirebaseConflicts",result&&result.conflictos);
    if(!result||result.ok===false){
      status(result&&result.message||"No se pudo analizar Firebase.","is-danger");
    }else if(Number(result.conflictos||0)>0){
      status("Hay conflictos en notas. Revise antes de subir.","is-danger");
    }else if(Number(result.batchChanges||0)===0){
      status("Las calificaciones están actualizadas.","is-ok");
    }else{
      status("Análisis listo: "+Number(result.differences||0)+" diferencia(s) de notas.","is-ok");
    }
    running=false;setButtons();
  }
  function analyze(){
    if(running||!periodId()){return;}
    running=true;setButtons();status("Comparando calificaciones con Firebase...","is-warn");
    ensure().then(function(api){return api.analyze("defensas",{periodoId:periodId(),source:"Defensas.firebase.analyze"});})
      .then(render).catch(function(error){render({ok:false,message:error&&error.message?error.message:String(error)});});
  }
  function rebuild(){
    if(running||!periodId()){return;}
    if(!window.confirm("Se volverán a dejar pendientes para Firebase únicamente los cambios de notas conservados por Defensas en este período.\n\nNo se modificarán Carga, Ncomplex ni Telegram. ¿Continuar?")){return;}
    analysis=null;running=true;setButtons();status("Preparando las notas completas de Defensas...","is-warn");
    ensure().then(function(api){
      if(typeof api.requeue!=="function"){throw new Error("La reconstrucción Firebase no está disponible.");}
      return api.requeue("defensas",{periodoId:periodId(),source:"Defensas.firebase.rebuild"});
    }).then(function(result){
      if(!result||result.ok===false){throw new Error(result&&result.message||"No se pudo preparar la reconstrucción.");}
      if(Number(result.requeued||0)===0){
        running=false;status("No existen cambios conservados. Guarde nuevamente las notas antes de reconstruir Firebase.","is-warn");setButtons();return null;
      }
      status("Se prepararon "+Number(result.requeued||0)+" cambio(s). Analizando el primer lote...","is-ok");
      return center().analyze("defensas",{periodoId:periodId(),source:"Defensas.firebase.rebuildAnalyze"}).then(render);
    }).catch(function(error){analysis=null;running=false;status(error&&error.message?error.message:String(error),"is-danger");setButtons();});
  }
  function push(){
    if(running||!analysis||!periodId()){return;}
    if(!window.confirm("Se subirán exclusivamente las calificaciones del lote analizado.\n\nNo se modificarán estudiantes, matrículas, requisitos, Ncomplex ni Telegram. ¿Continuar?")){return;}
    running=true;setButtons();status("Subiendo calificaciones a Firebase...","is-warn");
    ensure().then(function(api){return api.push("defensas",{periodoId:periodId(),requireAnalysis:true,source:"Defensas.firebase.push"});})
      .then(function(result){
        if(!result||result.ok===false){analysis=null;running=false;status(result&&result.message||"No se pudo subir las calificaciones.","is-danger");setButtons();return null;}
        status("Calificaciones procesadas: "+Number(result.confirmedChanges||0)+" cambio(s).","is-ok");
        analysis=null;
        return center().analyze("defensas",{periodoId:periodId(),source:"Defensas.firebase.afterPush"}).then(render);
      }).catch(function(error){analysis=null;running=false;status(error&&error.message?error.message:String(error),"is-danger");setButtons();});
  }
  function bind(){
    var period=byId("def-filter-periodo");
    var rebuildButton=ensureRebuildButton();
    var analyzeButton=byId("def-btn-firebase-analyze");
    var pushButton=byId("def-btn-firebase-push");
    if(period&&!period.__firebaseNotesBound){period.__firebaseNotesBound=true;period.addEventListener("change",function(){periodAligned=true;clear();});}
    if(rebuildButton&&!rebuildButton.__firebaseNotesBound){rebuildButton.__firebaseNotesBound=true;rebuildButton.addEventListener("click",rebuild);}
    if(analyzeButton&&!analyzeButton.__firebaseNotesBound){analyzeButton.__firebaseNotesBound=true;analyzeButton.addEventListener("click",analyze);}
    if(pushButton&&!pushButton.__firebaseNotesBound){pushButton.__firebaseNotesBound=true;pushButton.addEventListener("click",push);}
    ["bdlocal:defart-notas-saved","bdlocal:defensas-notas-mirrored"].forEach(function(name){window.addEventListener(name,function(){analysis=null;status("Las notas locales cambiaron. Analice nuevamente.","is-warn");setButtons();});});
    window.addEventListener("defart:bootstrap-ready",function(){periodAligned=false;alignPeriod(0);});
    clear();
    alignPeriod(0);
  }

  window.DefartFirebaseSync={version:VERSION,analyze:analyze,rebuild:rebuild,push:push,render:render,alignPeriod:alignPeriod};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);
