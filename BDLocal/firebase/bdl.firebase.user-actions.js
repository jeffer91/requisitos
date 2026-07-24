/* =========================================================
Nombre completo: bdl.firebase.user-actions.js
Ruta: /BDLocal/firebase/bdl.firebase.user-actions.js
Función:
- Conectar de forma determinista los controles visibles de Firebase.
- Probar la conexión mediante una lectura V2 limitada a un documento.
- Comparar el período activo con una muestra V2 limitada y sin escrituras.
- Descargar mediante el controlador V2 con presupuesto de lectura.
- Procesar lotes manuales de cambios_pendientes con resumen visible.
- Exponer la migración V2 dentro de Mantenimiento.
- No consultar colecciones legacy ni ejecutar tareas automáticas.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-v2-read-budget-actions";
  var FLAG="__firebaseUserActionsInstalled";
  var COMPARE_LIMIT=100;
  var COMPARE_ENTITIES=["matriculas","requisitos","notas"];
  var COMPARE_READ_BUDGET=COMPARE_LIMIT*COMPARE_ENTITIES.length;
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
  function repository(){return window.RequisitosFirebaseRepository||null;}
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

  function ensureRepository(){
    var current=repository();
    if(!current||typeof current.list!=="function"){
      return Promise.reject(new Error("El repositorio Firebase V2 no está disponible."));
    }
    return Promise.resolve(current);
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

  function migrationHost(){
    return byId("bl2-firebase-migration-host")||card();
  }

  function moveMigrationPanel(){
    var host=migrationHost();
    var panel=byId("bl2-firebase-migration-panel");
    if(!host||!panel){return null;}
    panel.classList.add("bdlc-firebase-correction-panel");
    if(panel.parentNode!==host){host.appendChild(panel);}
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

    if(compare){compare.textContent="Comparar período V2";compare.classList.add("bdlc-action-primary");}
    if(download){download.textContent="Traer cambios V2";download.classList.add("bdlc-action-secondary");}
    if(test){test.textContent="Probar conexión";test.classList.add("bdlc-action-utility");}
    if(refresh){refresh.textContent="Actualizar estado";refresh.classList.add("bdlc-action-utility");}

    var correct=byId("bl2-btn-correct-firebase-base");
    if(!correct){
      correct=document.createElement("button");
      correct.id="bl2-btn-correct-firebase-base";
      correct.className="bdlc-button bdlc-action-secondary";
      correct.type="button";
      correct.textContent="Preparar migración Firebase V2";
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
    showResult("Probando conexión","Se realizará una sola lectura en la colección V2 de períodos.","info");
    return ensureRepository().then(function(current){
      return current.list("periodos",{limit:1,includeDeleted:false});
    }).then(function(result){
      var read=number(result&&result.total);
      setConnection(true,"");
      var message="Conexión correcta con "+(projectId()||"Firebase")+". Lectura V2 completada: "+read+" documento(s).";
      showResult("Conexión verificada",message,"success",{projectId:projectId(),documents:read,readBudget:1});
      window.alert(message);
      return {ok:true,projectId:projectId(),documents:read,readBudget:1,message:message};
    }).catch(function(error){
      setConnection(false,error&&error.message);
      var message="No se pudo leer Firebase V2: "+text(error&&error.message||error);
      showResult("Error de conexión",message,"error");
      window.alert(message);
      return {ok:false,message:message};
    });
  }

  function renderComparison(result){
    var output=byId("bdlc-firebase-preview");
    if(output){output.textContent=JSON.stringify(result,null,2);}
  }

  function comparePeriod(){
    var period=selectedPeriod();
    if(!period){return Promise.reject(new Error("Seleccione un período."));}
    showResult("Comparando período V2","Se leerán como máximo "+COMPARE_READ_BUDGET+" documentos entre matrículas, requisitos y notas. No se escribirá información.","info");
    return ensureRepository().then(function(current){
      return Promise.all(COMPARE_ENTITIES.map(function(entity){
        return current.list(entity,{
          periodoId:period.id,
          includeDeleted:true,
          limit:COMPARE_LIMIT
        });
      }));
    }).then(function(results){
      var detail={
        modo:"SOLO LECTURA V2",
        periodo:period.label||period.id,
        periodoId:period.id,
        limitePorColeccion:COMPARE_LIMIT,
        presupuestoMaximoLecturas:COMPARE_READ_BUDGET,
        colecciones:{},
        documentosLeidos:0,
        limitado:false
      };
      results.forEach(function(result,index){
        var entity=COMPARE_ENTITIES[index];
        var total=number(result&&result.total);
        detail.colecciones[entity]={documentos:total,hayMas:result&&result.hasMore===true};
        detail.documentosLeidos+=total;
        if(result&&result.hasMore===true){detail.limitado=true;}
      });
      renderComparison(detail);
      var message=(period.label||period.id)+": "+detail.documentosLeidos+" documento(s) V2 leídos; máximo permitido "+COMPARE_READ_BUDGET+". "+(detail.limitado?"La vista es una muestra limitada.":"La muestra disponible quedó completa.");
      showResult("Comparación V2 terminada",message,"success",detail);
      window.alert(message+"\n\nNo se escribió información.");
      return detail;
    });
  }

  function downloadPeriod(){
    var current=controlCenter();
    if(!current||typeof current.pullPeriod!=="function"){
      return Promise.reject(new Error("El controlador Firebase V2 no está disponible."));
    }
    return current.pullPeriod({full:false});
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
      showResult("Estado actualizado","Se actualizaron cursores, métricas locales y conflictos sin recorrer colecciones remotas.","success",result);
      return result;
    });
  }

  function correctStructure(){
    var ui=migrationUI();
    if(!ui){return Promise.reject(new Error("La migración Firebase V2 no terminó de cargar."));}
    if(typeof ui.bind==="function"){ui.bind();}
    moveMigrationPanel();
    if(typeof ui.preview!=="function"){return Promise.reject(new Error("La vista previa de migración no está disponible."));}
    showResult("Preparando migración","Se realizará una sola lectura paginada de las colecciones legacy y se creará un respaldo local.","info");
    return ui.preview().then(function(result){
      moveMigrationPanel();
      var panel=byId("bl2-firebase-migration-panel");
      if(panel&&typeof panel.scrollIntoView==="function"){panel.scrollIntoView({behavior:"smooth",block:"start"});}
      if(result&&result.cancelled){showResult("Preparación cancelada","No se leyó ni modificó la estructura.","info",result);return result;}
      var message="Vista previa y respaldo creados. Lecturas estimadas: "+number(result&&result.estimatedSourceReads)+" de "+number(result&&result.migrationReadBudget)+" permitidas; documentos previstos: "+number(result&&result.estimatedApplyReads)+"; errores: "+number(result&&result.errors&&result.errors.length)+".";
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
    automatic:false,
    destructive:false,
    compareReadBudget:COMPARE_READ_BUDGET,
    install:install,
    refresh:function(){bindAttempts=0;scheduleBind(20);},
    testConnection:testConnection,
    comparePeriod:comparePeriod,
    downloadPeriod:downloadPeriod,
    pushPending:pushPending,
    correctStructure:correctStructure,
    status:function(){return {version:VERSION,installed:!!window[FLAG],busy:busy,bindAttempts:bindAttempts,projectId:projectId(),manualOnly:true,automatic:false,compareReadBudget:COMPARE_READ_BUDGET,destructive:false};}
  };

  ["DOMContentLoaded","bdlocal:bl2-html-scripts-loaded","requisitos:arquitectura-compartida-lista","requisitos:firebase-redesign-ready","bdlocal:sync-ui-updated"].forEach(function(name){
    window.addEventListener(name,function(){bindAttempts=0;scheduleBind(20);});
  });

  install();
})(window,document);
