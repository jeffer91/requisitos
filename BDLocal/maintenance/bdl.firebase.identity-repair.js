/* =========================================================
Nombre completo: bdl.firebase.identity-repair.js
Ruta o ubicación: /BDLocal/maintenance/bdl.firebase.identity-repair.js
Función o funciones:
- Analizar documentos Estudiantes/{cedula} en lotes pequeños.
- Detectar cédulas ecuatorianas de nueve dígitos con cero inicial perdido.
- Conservar identificaciones extranjeras o ambiguas sin alterarlas.
- Crear respaldo local del documento remoto antes de corregirlo.
- Renombrar o ajustar máximo diez documentos por confirmación.
- Revalidar destinos dentro de una transacción Firebase.
- Bloquear documentos cuyo ID y campos internos no coincidan.
- Respetar la cuota Firebase y no crear cambios_pendientes.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.1.1-conflict-safe";
  var TARGET="firebase_identity_repair";
  var SCAN_LIMIT=15;
  var MAX_DESTINATION_CHECKS=10;
  var MAX_CORRECTIONS=10;
  var running=false;
  var mounted=false;
  var lastPreview=null;
  var lastPlan=[];

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function id(name){return document.getElementById(name);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function config(){return window.BL2Config||{};}
  function utils(){return config().utils||{};}
  function db(){return window.BL2DB||null;}
  function store(){return window.BDLocalConfigStore||null;}
  function backupRepo(){return window.BDLRepoBackups||window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("backups")||null;}
  function sync(){return window.BL2Sync||null;}
  function collectionName(){var firebase=config().firebase||{};return text(firebase.personCollection||firebase.telegramCollection||"Estudiantes")||"Estudiantes";}
  function stateStore(){return config().stores&&config().stores.syncEstado||"sync_estado";}
  function stateId(){return TARGET+"__"+collectionName();}

  function analyzeIdentification(value){
    if(utils().analyzeIdentification){return utils().analyzeIdentification(value);}
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return {original:text(value),raw:raw,canonical:raw,changed:false,type:raw?"OTHER_IDENTIFICATION":"EMPTY",validEcuadorian:false,missingLeadingZero:false,safeAutoCorrection:false,reason:"Regla central no disponible."};
  }
  function normalize(value){var result=analyzeIdentification(value);return text(result.canonical||result.raw);}
  function ensureFirebase(){return sync()&&sync().ensureFirebase?sync().ensureFirebase():Promise.reject(new Error("Firebase no está disponible."));}
  function getState(){var current=db();return current&&current.get?current.get(stateStore(),stateId()).catch(function(){return null;}):Promise.resolve(null);}
  function saveState(patch){var current=db();if(!current||!current.put){return Promise.resolve(null);}return getState().then(function(existing){return current.put(stateStore(),Object.assign({},existing||{},patch||{},{id:stateId(),target:TARGET,periodoId:"",updatedAt:now()}));});}

  function quota(ops){var current=store();return current&&current.getFirebaseQuotaStatus?current.getFirebaseQuotaStatus(Number(ops||0)):{allowed:true,level:"sin_control",estimatedOps:Number(ops||0)};}
  function registerUsage(reads,writes,deletes,label){var current=store();if(current&&current.registerFirebaseUsage){current.registerFirebaseUsage({reads:Number(reads||0),writes:Number(writes||0),deletes:Number(deletes||0),label:label||"Mantenimiento Firebase."});}}
  function progress(percent,message){try{window.dispatchEvent(new CustomEvent("bl2:sync-progress",{detail:{target:"firebase mantenimiento",percent:Number(percent||0),detail:text(message),at:now()}}));}catch(error){}}
  function status(message,type){var node=id("firebase-identity-status");if(node){node.className="bdlc-alert "+(type||"info");node.textContent=message;}}

  function documentField(){return window.firebase&&window.firebase.firestore&&window.firebase.firestore.FieldPath&&window.firebase.firestore.FieldPath.documentId?window.firebase.firestore.FieldPath.documentId():"__name__";}
  function buildQuery(firestore,cursor,restart){var query=firestore.collection(collectionName()).orderBy(documentField()).limit(SCAN_LIMIT);if(cursor&&!restart&&query.startAfter){query=query.startAfter(cursor);}return query;}

  function classify(doc){
    var data=doc.data()||{};
    var docAnalysis=analyzeIdentification(doc.id);
    var fieldValue=text(data.cedula||data.numeroIdentificacion||"");
    var fieldAnalysis=analyzeIdentification(fieldValue);
    var canonical="",action="NONE",reason="Sin corrección segura.";

    if(docAnalysis.missingLeadingZero&&docAnalysis.safeAutoCorrection){
      canonical=docAnalysis.canonical;
      if(fieldValue&&fieldAnalysis.canonical!==canonical){
        action="CONFLICT";
        reason="El ID puede completar su cero, pero los campos internos contienen otra identificación.";
      }else{
        action="RENAME";
        reason="El ID del documento perdió el cero inicial de una cédula ecuatoriana válida.";
      }
    }else if(docAnalysis.validEcuadorian){
      canonical=docAnalysis.canonical;
      if(!fieldValue||(fieldAnalysis.canonical===canonical&&fieldValue!==canonical)){action="PATCH_FIELDS";reason="El ID es correcto, pero los campos internos requieren normalización.";}
      else if(fieldAnalysis.canonical!==canonical){action="CONFLICT";reason="El ID y los campos de identificación representan valores diferentes.";}
    }else if(fieldAnalysis.missingLeadingZero&&fieldAnalysis.safeAutoCorrection&&normalize(doc.id)===fieldAnalysis.canonical){
      canonical=fieldAnalysis.canonical;action="PATCH_FIELDS";reason="Los campos internos perdieron el cero inicial.";
    }

    return {sourceId:text(doc.id),canonicalId:canonical,action:action,reason:reason,sourceIdentification:fieldValue,docAnalysis:docAnalysis,fieldAnalysis:fieldAnalysis,data:clone(data),destinationExists:false,destinationChecked:action!=="RENAME",ready:action==="PATCH_FIELDS"};
  }

  function checkDestinations(firestore,plan,readCounter){
    var candidates=plan.filter(function(item){return item.action==="RENAME";}).slice(0,MAX_DESTINATION_CHECKS);
    var checked=Object.create(null),chain=Promise.resolve();
    candidates.forEach(function(item){
      checked[item.sourceId]=true;
      chain=chain.then(function(){
        readCounter.value+=1;
        return firestore.collection(collectionName()).doc(item.canonicalId).get().then(function(snapshot){
          item.destinationChecked=true;item.destinationExists=!!snapshot.exists;
          if(snapshot.exists){item.ready=false;item.action="CONFLICT";item.reason="Ya existe el documento destino "+item.canonicalId+"; no se fusionará automáticamente.";}
          else{item.ready=true;}
        });
      });
    });
    return chain.then(function(){
      plan.forEach(function(item){
        if(item.action==="RENAME"&&!checked[item.sourceId]){item.ready=false;item.action="WAITING_DESTINATION_CHECK";item.reason="La verificación del destino queda para el siguiente lote por protección de cuota.";}
      });
    });
  }

  function publicPreview(preview){
    return Object.assign({},preview,{plan:(preview.plan||[]).map(function(item){return {sourceId:item.sourceId,canonicalId:item.canonicalId,action:item.action,ready:item.ready,reason:item.reason,sourceIdentification:item.sourceIdentification,destinationExists:item.destinationExists,destinationChecked:item.destinationChecked,docType:item.docAnalysis&&item.docAnalysis.type||"",fieldType:item.fieldAnalysis&&item.fieldAnalysis.type||""};})});
  }

  function preview(options){
    options=options||{};
    if(running){return Promise.resolve({ok:true,skipped:true,message:"Ya existe un mantenimiento Firebase en curso."});}
    var estimated=SCAN_LIMIT+MAX_DESTINATION_CHECKS;
    var q=quota(estimated);
    if(q.allowed===false){return Promise.resolve({ok:false,blocked:true,quota:q,message:"La cuota protegida no permite analizar Firebase."});}
    running=true;lastPlan=[];status("Leyendo un lote seguro de Firebase...","info");progress(10,"Analizando identidades Firebase...");

    return Promise.all([ensureFirebase(),getState()]).then(function(values){
      var firestore=values[0],saved=values[1]||{};
      if(saved.cycleComplete&&options.restart!==true){return {firestore:firestore,saved:saved,completed:true};}
      return buildQuery(firestore,text(saved.cursor),options.restart===true).get().then(function(snapshot){return {firestore:firestore,saved:saved,snapshot:snapshot};});
    }).then(function(context){
      if(context.completed){lastPreview={ok:true,skipped:true,cycleComplete:true,collection:collectionName(),reads:0,scanned:0,ready:0,conflicts:0,foreignOrUnverified:0,message:"El recorrido terminó. Use Reiniciar recorrido para analizar nuevamente desde el inicio.",plan:[]};return lastPreview;}
      var snapshot=context.snapshot,plan=[],lastId="";
      snapshot.forEach(function(doc){lastId=doc.id;plan.push(classify(doc));});
      var reads={value:Number(snapshot.size||0)};
      return checkDestinations(context.firestore,plan,reads).then(function(){
        var cycleComplete=Number(snapshot.size||0)<SCAN_LIMIT;
        lastPlan=plan.filter(function(item){return item.ready;}).slice(0,MAX_CORRECTIONS);
        lastPreview={ok:true,collection:collectionName(),scanned:Number(snapshot.size||0),reads:reads.value,ready:lastPlan.length,conflicts:plan.filter(function(item){return item.action==="CONFLICT";}).length,waiting:plan.filter(function(item){return item.action==="WAITING_DESTINATION_CHECK";}).length,foreignOrUnverified:plan.filter(function(item){return !item.docAnalysis.validEcuadorian&&!item.docAnalysis.missingLeadingZero;}).length,cursor:lastId,cycleComplete:cycleComplete,plan:plan,message:"Lote analizado: "+Number(snapshot.size||0)+" documento(s), "+lastPlan.length+" corrección(es) segura(s), "+plan.filter(function(item){return item.action==="CONFLICT";}).length+" conflicto(s)."};
        registerUsage(reads.value,0,0,"Vista previa de identidades Firebase.");
        return saveState({cursor:lastId,cycleComplete:cycleComplete,lastPreviewAt:now(),lastPreview:publicPreview(lastPreview)}).then(function(){return lastPreview;});
      });
    }).then(function(result){render(result);status(result.message,result.ok===false?"error":"success");progress(100,result.message);return publicPreview(result);}).catch(function(error){status(error.message||String(error),"error");throw error;}).finally(function(){running=false;});
  }

  function backupPlan(plan){
    var repository=backupRepo();
    if(!repository||!repository.save){return Promise.reject(new Error("El repositorio de respaldos no está disponible."));}
    return repository.save({scope:"firebase.identity",tipo:"pre_firebase_identity_repair",type:"pre_firebase_identity_repair",schemaVersion:"1",totalRegistros:plan.length,origen:"BDLFirebaseIdentityRepair",payload:{collection:collectionName(),createdAt:now(),documents:plan.map(function(item){return {sourceId:item.sourceId,canonicalId:item.canonicalId,action:item.action,data:item.data};})}});
  }

  function applyTransaction(firestore,plan){
    var collection=firestore.collection(collectionName());
    var renames=plan.filter(function(item){return item.action==="RENAME";});
    return firestore.runTransaction(function(transaction){
      return Promise.all(renames.map(function(item){return transaction.get(collection.doc(item.canonicalId));})).then(function(destinations){
        destinations.forEach(function(snapshot,index){if(snapshot.exists){throw new Error("El documento destino "+renames[index].canonicalId+" apareció después de la vista previa. No se aplicó ninguna corrección.");}});
        plan.forEach(function(item){
          var corrected=Object.assign({},item.data,{cedula:item.canonicalId,numeroIdentificacion:item.canonicalId,identityCorrectedAt:now(),identityCorrectionSource:"BDLocal.MantenimientoSeguro",identityPreviousDocumentId:item.sourceId,identitySchemaVersion:"1"});
          if(item.action==="RENAME"){transaction.set(collection.doc(item.canonicalId),corrected,{merge:true});transaction.delete(collection.doc(item.sourceId));}
          else{transaction.set(collection.doc(item.sourceId),corrected,{merge:true});}
        });
      });
    });
  }

  function apply(){
    var plan=lastPlan.filter(function(item){return item.ready;}).slice(0,MAX_CORRECTIONS);
    if(!plan.length){return Promise.resolve({ok:true,skipped:true,message:"No existen correcciones seguras en la última vista previa."});}
    var writes=plan.length,deletes=plan.filter(function(item){return item.action==="RENAME";}).length,verificationReads=deletes,estimate=writes+deletes+verificationReads;
    var q=quota(estimate);
    if(q.allowed===false){return Promise.resolve({ok:false,blocked:true,quota:q,message:"La cuota protegida no permite aplicar las correcciones."});}
    if(!window.confirm("Corregir identidades Firebase\n\nColección: "+collectionName()+"\nDocumentos: "+plan.length+"\nLecturas de verificación: "+verificationReads+"\nEscrituras: "+writes+"\nEliminaciones de IDs antiguos: "+deletes+"\n\nSe guardará un respaldo local antes de continuar. ¿Aplicar?")){return Promise.resolve({ok:true,cancelled:true,message:"Corrección cancelada."});}
    if(running){return Promise.resolve({ok:true,skipped:true,message:"Ya existe un mantenimiento Firebase en curso."});}
    running=true;status("Creando respaldo de los documentos remotos...","warning");progress(20,"Respaldando documentos Firebase...");

    return backupPlan(plan).then(function(backup){return ensureFirebase().then(function(firestore){return applyTransaction(firestore,plan).then(function(){return backup;});});}).then(function(backup){
      registerUsage(verificationReads,writes,deletes,"Corrección transaccional de identidades Firebase.");
      var result={ok:true,collection:collectionName(),corrected:plan.length,renamed:deletes,patched:writes-deletes,verificationReads:verificationReads,writes:writes,deletes:deletes,backupId:backup&&backup.id||backup&&backup.backupId||"",message:"Firebase corregido: "+plan.length+" documento(s). Respaldo local creado."};
      lastPlan=[];lastPreview=null;
      return saveState({lastAppliedAt:now(),lastResult:result}).then(function(){render(result);status(result.message,"success");progress(100,result.message);return result;});
    }).catch(function(error){status(error.message||String(error),"error");throw error;}).finally(function(){running=false;render(lastPreview||{});});
  }

  function render(report){
    var summary=id("firebase-identity-summary"),output=id("firebase-identity-json"),applyButton=id("firebase-identity-apply");
    if(!summary||!output){return;}
    report=report||lastPreview||{};
    var rows=[["Colección",report.collection||collectionName()],["Documentos revisados",Number(report.scanned||0)],["Lecturas consumidas",Number(report.reads||report.verificationReads||0)],["Correcciones seguras",Number(report.ready||report.corrected||0)],["Conflictos",Number(report.conflicts||0)],["Pendientes de verificar",Number(report.waiting||0)],["Extranjeras o no verificadas",Number(report.foreignOrUnverified||0)],["Recorrido completo",report.cycleComplete?"Sí":"No"]];
    summary.className="bdlc-table-wrap";
    summary.innerHTML='<table class="bdlc-table"><tbody>'+rows.map(function(row){return '<tr><th>'+esc(row[0])+'</th><td>'+esc(row[1])+'</td></tr>';}).join("")+'</tbody></table>';
    output.textContent=JSON.stringify(publicPreview(report),null,2);
    if(applyButton){applyButton.disabled=!lastPlan.length||running;}
  }

  function mount(container){
    if(typeof container==="string"){container=document.querySelector(container);}
    container=container||id("bl2-maintenance-slot");
    if(!container){return false;}
    var card=id("firebase-identity-repair-card");
    if(!card){
      card=document.createElement("div");card.id="firebase-identity-repair-card";card.className="bdlc-card";
      card.innerHTML='<div class="bdlc-header"><div><h3>Corregir identidades en Firebase</h3><p>Revisa Estudiantes en lotes de 15. Solo agrega el cero cuando la cédula ecuatoriana valida correctamente.</p></div><span class="bdlc-status warning">Manual y con respaldo</span></div><div class="bdlc-actions"><button id="firebase-identity-preview" class="bdlc-button" type="button">Analizar siguiente lote</button><button id="firebase-identity-restart" class="bdlc-button secondary" type="button">Reiniciar recorrido</button><button id="firebase-identity-apply" class="bdlc-button warning" type="button" disabled>Aplicar correcciones seguras</button></div><div id="firebase-identity-status" class="bdlc-alert info">Pendiente de análisis. No se realizan escrituras automáticas.</div><div id="firebase-identity-summary" class="bdlc-empty">Ejecute la vista previa.</div><details><summary>JSON del lote</summary><pre id="firebase-identity-json" class="bdlc-raw-output">{}</pre></details>';
      container.appendChild(card);
      id("firebase-identity-preview").addEventListener("click",function(){preview({restart:false}).catch(function(){});});
      id("firebase-identity-restart").addEventListener("click",function(){saveState({cursor:"",cycleComplete:false}).then(function(){return preview({restart:true});}).catch(function(error){status(error.message,"error");});});
      id("firebase-identity-apply").addEventListener("click",function(){apply().catch(function(error){status(error.message,"error");});});
    }
    mounted=true;render(lastPreview||{});return true;
  }

  function bind(){mount(id("bl2-maintenance-slot"));}
  function diagnostics(){return getState().then(function(saved){return {ok:true,version:VERSION,collection:collectionName(),running:running,mounted:mounted,scanLimit:SCAN_LIMIT,maxCorrections:MAX_CORRECTIONS,writesAutomatic:false,createsOutbox:false,state:saved,lastPreview:lastPreview?publicPreview(lastPreview):null};});}

  window.BDLFirebaseIdentityRepair={version:VERSION,preview:preview,apply:apply,mount:mount,bind:bind,diagnostics:diagnostics,analyzeIdentification:analyzeIdentification,getLastPreview:function(){return lastPreview?publicPreview(lastPreview):null;},writesAutomatic:false,createsOutbox:false};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind,{once:true});}else{bind();}
})(window,document);
