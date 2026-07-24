/* =========================================================
Nombre completo: bdl.firebase.user-actions.js
Ruta: /BDLocal/firebase/bdl.firebase.user-actions.js
Función:
- Conectar de forma determinista los controles visibles de Firebase.
- Probar una lectura real en el proyecto configurado.
- Comparar y descargar el período legacy sin tocar Telegram.
- Procesar lotes manuales de cambios_pendientes con resumen visible.
- Exponer la migración V2 como Corrección de estructura Firebase.
- No borrar colecciones ni ejecutar tareas automáticas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-operational-controls";
  var FLAG="__firebaseUserActionsInstalled";
  var busy=false;
  var bindTimer=null;
  var bindAttempts=0;
  var MAX_BIND_ATTEMPTS=160;

  function text(value){return String(value==null?"":value).trim();}
  function byId(id){return document.getElementById(id);}
  function number(value){value=Number(value||0);return Number.isFinite(value)?value:0;}
  function card(){var status=byId("bl2-firebase-status");return status&&status.closest?status.closest(".bdlc-connection-card"):null;}
  function config(){return window.BL2Config&&window.BL2Config.firebase&&window.BL2Config.firebase.config||window.FIREBASE_CONFIG||window.firebaseConfig||{};}
  function store(){return window.BDLocalConfigStore||null;}
  function sync(){return window.BL2Sync||null;}
  function guard(){return window.BL2FirebaseGuard||null;}
  function bridge(){return window.BDLSyncUIBridge||null;}
  function migrationUI(){return window.RequisitosFirebaseMigrationUI||null;}
  function controlCenter(){return window.RequisitosFirebaseControlCenter||null;}

  function selectedPeriod(){
    try{
      if(window.RequisitosPeriodoGlobal&&typeof window.RequisitosPeriodoGlobal.get==="function"){
        var globalPeriod=window.RequisitosPeriodoGlobal.get();
        if(globalPeriod&&text(globalPeriod.id)){return {id:text(globalPeriod.id),label:text(globalPeriod.label||globalPeriod.id)};}
      }
    }catch(error){}
    try{
      if(window.BL2App&&typeof window.BL2App.getSelectedPeriod==="function"){
        var selected=window.BL2App.getSelectedPeriod();
        if(selected&&text(selected.id)){return {id:text(selected.id),label:text(selected.label||selected.id)};}
      }
    }catch(error2){}
    var select=byId("bl2-period-select");
    var id=text(select&&select.value);
    var option=select&&select.selectedOptions&&select.selectedOptions[0];
    return id?{id:id,label:text(option&&option.textContent||id)}:null;
  }

  function ensureFirebase(){
    var current=sync();
    if(!current||typeof current.ensureFirebase!=="function"){
      return Promise.reject(new Error("BL2Sync.ensureFirebase no está disponible."));
    }
    return current.ensureFirebase();
  }

  function ensureResultBox(){
    var host=card();
    if(!host){return null;}
    var box=byId("bl2-firebase-action-result");
    if(box){return box;}
    box=document.createElement("div");
    box.id="bl2-firebase-action-result";
    box.className="bdlc-alert info";
    box.innerHTML="<strong>Firebase preparado.</strong> Seleccione una acción manual para ver aquí el resultado.";
    var details=host.querySelector("details");
    if(details){host.insertBefore(box,details);}else{host.appendChild(box);}
    return box;
  }

  function showResult(title,message,type,data){
    var box=ensureResultBox();
    if(box){
      box.className="bdlc-alert "+(type||"info");
      box.innerHTML="<strong>"+text(title)+"</strong><br>"+text(message);
      if(data){box.setAttribute("data-last-result",JSON.stringify(data));}
    }
  }

  function setConnection(connected,error){
    var current=store();
    if(current&&typeof current.updateConnectionStatus==="function"){
      current.updateConnectionStatus("firebase",{
        connected:connected===true,
        status:connected===true?"ok":"error",
        lastError:text(error)
      });
    }
  }

  function moveMigrationPanel(){
    var host=card();
    var panel=byId("bl2-firebase-migration-panel");
    if(!host||!panel){return null;}
    panel.classList.add("bdlc-firebase-correction-panel");
    var details=host.querySelector("details");
    if(details&&panel.nextSibling!==details){host.insertBefore(panel,details);}
    return panel;
  }

  function ensureControls(){
    var host=card();
    if(!host){return false;}
    var actions=host.querySelector(":scope > .bdlc-actions")||host.querySelector(".bdlc-actions");
    if(!actions){return false;}

    var compare=host.querySelector('[data-bdlc-action="preview-firebase"]');
    var download=host.querySelector('[data-bdlc-action="pull-firebase"]');
    var test=host.querySelector('[data-bdlc-action="test-firebase"]');
    var refresh=byId("bl2-btn-fetch-firebase-config");

    if(compare){compare.textContent="Comparar período";compare.classList.add("bdlc-action-primary");}
    if(download){download.textContent="Descargar a BDLocal";download.classList.add("bdlc-action-secondary");}
    if(test){test.textContent="Probar conexión";test.classList.add("bdlc-action-utility");}
    if(refresh){refresh.textContent="Actualizar estado";refresh.classList.add("bdlc-action-utility");}

    var correct=byId("bl2-btn-correct-firebase-base");
    if(!correct){
      correct=document.createElement("button");
      correct.id="bl2-btn-correct-firebase-base";
      correct.className="bdlc-button bdlc-action-primary";
      correct.type="button";
      correct.textContent="Corregir estructura Firebase";
      actions.appendChild(correct);
    }

    ensureResultBox();
    var ui=migrationUI();
    if(ui&&typeof ui.bind==="function"){try{ui.bind();}catch(error){}}
    moveMigrationPanel();
    return true;
  }

  function projectId(){
    try{
      if(window.firebase&&typeof window.firebase.app==="function"){
        return text(window.firebase.app().options&&window.firebase.app().options.projectId);
      }
    }catch(error){}
    return text(config().projectId);
  }

  function testConnection(){
    showResult("Probando conexión","Leyendo un documento de Estudiantes en el proyecto configurado.","info");
    return ensureFirebase().then(function(firestore){
      if(!firestore||typeof firestore.collection!=="function"){throw new Error("Firestore no quedó disponible.");}
      return firestore.collection("Estudiantes").limit(1).get();
    }).then(function(snapshot){
      var read=number(snapshot&&snapshot.size);
      setConnection(true,"");
      var message="Conexión correcta con "+(projectId()||"Firebase")+". Lectura real completada: "+read+" documento(s).";
      showResult("Conexión verificada",message,"success",{projectId:projectId(),documents:read});
      window.alert(message);
      return {ok:true,projectId:projectId(),documents:read,message:message};
    }).catch(function(error){
      setConnection(false,error&&error.message);
      var message="No se pudo leer Firebase: "+text(error&&error.message||error);
      showResult("Error de conexión",message,"error");
      window.alert(message);
      return {ok:false,message:message};
    });
  }

  function renderComparison(result){
    var output=byId("bdlc-firebase-preview");
    if(output){output.textContent=JSON.stringify({
      modo:"SOLO LECTURA",
      periodo:result.period&&text(result.period.label||result.period.id),
      documentosRemotos:number(result.remoteDocuments),
      estudiantesUnicos:number(result.remoteUnique),
      cambiosSeguros:number(result.apply),
      cambiosLocalesProtegidos:number(result.pendingConflict),
      localesMasRecientes:number(result.localNewer),
      conflictosAmbiguos:number(result.ambiguous),
      duplicadosIgnorados:number(result.duplicateDocumentsIgnored)
    },null,2);}
  }

  function comparePeriod(){
    var period=selectedPeriod();
    var current=guard();
    if(!period){return Promise.reject(new Error("Seleccione un período."));}
    if(!current||typeof current.previewFirebase!=="function"){
      return Promise.reject(new Error("La comparación segura de Firebase no está disponible."));
    }
    showResult("Comparando período","Leyendo EstudiantesPeriodo sin modificar Firebase ni BDLocal.","info");
    return current.previewFirebase(period).then(function(result){
      renderComparison(result||{});
      var message=(period.label||period.id)+": "+number(result&&result.remoteDocuments)+" documento(s) remotos, "+number(result&&result.apply)+" cambio(s) seguros y "+number(result&&result.pendingConflict)+" protegido(s) por pendientes locales.";
      showResult("Comparación terminada",message,"success",result);
      window.alert(message+"\n\nNo se escribió información.");
      return result;
    });
  }

  function downloadPeriod(){
    var period=selectedPeriod();
    var current=guard();
    if(!period){return Promise.reject(new Error("Seleccione un período."));}
    if(!current||typeof current.pullFirebaseToLocal!=="function"){
      return Promise.reject(new Error("La descarga segura de Firebase no está disponible."));
    }
    return current.pullFirebaseToLocal(period,{confirm:true,previewOnly:false}).then(function(result){
      if(result&&result.cancelled){showResult("Descarga cancelada","No se modificó BDLocal.","info",result);return result;}
      var message="Aplicados en BDLocal: "+number(result&&result.applied)+". Cambios seguros detectados: "+number(result&&result.apply)+". Telegram no fue modificado.";
      showResult("Descarga finalizada",message,result&&result.ok===false?"warning":"success",result);
      window.alert(message);
      return result;
    });
  }

  function remainingFirebase(counts){
    var row=counts&&counts.detail&&counts.detail.firebase||{};
    return number(row.pending)+number(row.error)+number(row.blocked)+number(row.waitingRetry);
  }

  function pushPending(){
    var current=bridge();
    if(!current||typeof current.runTarget!=="function"){
      return Promise.reject(new Error("El puente de sincronización Firebase no está disponible."));
    }
    showResult("Procesando pendientes","Se procesará un máximo de 25 cambios del período activo.","info");
    return current.runTarget("firebase",{confirm:true,limit:25,batchSize:25}).then(function(result){
      var refresh=typeof current.refreshCounts==="function"?current.refreshCounts({force:true}):Promise.resolve(null);
      return refresh.then(function(counts){
        var processed=number(result&&result.confirmed||result&&result.marked||result&&result.processedIds&&result.processedIds.length);
        var written=number(result&&result.documentsWritten||result&&result.written);
        var conflicts=number(result&&result.conflicts);
        var remaining=remainingFirebase(counts);
        var message="Procesados: "+processed+" · escritos: "+written+" · conflictos: "+conflicts+" · pendientes restantes: "+remaining+".";
        if(result&&result.message){message+=" "+text(result.message);}
        showResult("Lote Firebase finalizado",message,result&&result.ok===false?"warning":"success",result);
        window.alert(message);
        return result;
      });
    });
  }

  function refreshStatus(){
    var current=controlCenter();
    var work=current&&typeof current.refreshStatus==="function"
      ? current.refreshStatus({force:true})
      : testConnection();
    return Promise.resolve(work).then(function(result){
      showResult("Estado actualizado","Se actualizaron conexión, cursores, lecturas, escrituras y conflictos.","success",result);
      return result;
    });
  }

  function correctStructure(){
    var ui=migrationUI();
    if(!ui){return Promise.reject(new Error("La migración Firebase V2 no terminó de cargar."));}
    if(typeof ui.bind==="function"){ui.bind();}
    moveMigrationPanel();
    if(typeof ui.preview!=="function"){return Promise.reject(new Error("La vista previa de migración no está disponible."));}
    showResult("Corrección de estructura","Se creará un respaldo y una vista previa. Todavía no se escribirán las colecciones V2.","info");
    return ui.preview().then(function(result){
      moveMigrationPanel();
      var panel=byId("bl2-firebase-migration-panel");
      if(panel&&typeof panel.scrollIntoView==="function"){panel.scrollIntoView({behavior:"smooth",block:"start"});}
      if(result&&result.cancelled){showResult("Corrección cancelada","No se leyó ni modificó la estructura.","info",result);return result;}
      var message="Vista previa y respaldo creados. Matrículas previstas: "+number(result&&result.counts&&result.counts.matriculas)+"; requisitos: "+number(result&&result.counts&&result.counts.requisitos)+"; notas: "+number(result&&result.counts&&result.counts.notas)+"; errores: "+number(result&&result.errors&&result.errors.length)+".";
      showResult("Vista previa V2 lista",message,result&&result.errors&&result.errors.length?"warning":"success",result);
      return result;
    });
  }

  function actionOf(target){
    if(!target||!target.closest){return "";}
    var button=target.closest("button");
    if(!button){return "";}
    if(button.id==="bl2-btn-correct-firebase-base"){return "correct";}
    if(button.id==="bl2-btn-push-firebase"){return "push";}
    if(button.id==="bl2-btn-fetch-firebase-config"){return "refresh";}
    var action=text(button.getAttribute("data-bdlc-action"));
    if(action==="test-firebase"){return "test";}
    if(action==="preview-firebase"){return "compare";}
    if(action==="pull-firebase"){return "download";}
    return "";
  }

  function executeAction(action){
    if(action==="test"){return testConnection();}
    if(action==="compare"){return comparePeriod();}
    if(action==="download"){return downloadPeriod();}
    if(action==="push"){return pushPending();}
    if(action==="refresh"){return refreshStatus();}
    if(action==="correct"){return correctStructure();}
    return Promise.resolve({ok:true,skipped:true});
  }

  function clickHandler(event){
    var action=actionOf(event.target);
    if(!action){return;}
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(busy){window.alert("Ya existe una operación Firebase en curso.");return;}
    busy=true;
    Promise.resolve().then(function(){return executeAction(action);}).catch(function(error){
      var message=text(error&&error.message||error);
      showResult("Operación no completada",message,"error");
      window.alert(message);
    }).finally(function(){busy=false;ensureControls();});
  }

  function scheduleBind(delay){
    if(bindTimer||bindAttempts>=MAX_BIND_ATTEMPTS){return;}
    bindTimer=window.setTimeout(function(){
      bindTimer=null;
      bindAttempts+=1;
      if(!ensureControls()){scheduleBind(bindAttempts<20?100:250);}
    },Math.max(50,number(delay)||100));
  }

  function install(){
    if(!window[FLAG]){
      window[FLAG]=true;
      document.addEventListener("click",clickHandler,true);
    }
    bindAttempts=0;
    scheduleBind(20);
    return true;
  }

  window.RequisitosFirebaseUserActions={
    version:VERSION,
    manualOnly:true,
    destructive:false,
    install:install,
    refresh:function(){bindAttempts=0;scheduleBind(20);},
    testConnection:testConnection,
    comparePeriod:comparePeriod,
    downloadPeriod:downloadPeriod,
    pushPending:pushPending,
    correctStructure:correctStructure,
    status:function(){return {version:VERSION,installed:!!window[FLAG],busy:busy,bindAttempts:bindAttempts,projectId:projectId(),destructive:false};}
  };

  ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:arquitectura-compartida-lista","requisitos:firebase-redesign-ready","bdlocal:sync-ui-updated"].forEach(function(name){
    window.addEventListener(name,function(){bindAttempts=0;scheduleBind(20);});
  });

  install();
})(window,document);
