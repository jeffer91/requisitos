/* =========================================================
Nombre completo: bdl.local.identity-repair.js
Ruta o ubicación: /BDLocal/maintenance/bdl.local.identity-repair.js
Función o funciones:
- Auditar identificaciones y claves relacionadas dentro de Base Local.
- Corregir cédulas ecuatorianas con cero inicial perdido cuando validen.
- Unificar la clave local como cedula__periodoId.
- Consolidar duplicados sin borrar valores no vacíos.
- Bloquear identidades con conflictos críticos de nombre o Telegram.
- Crear respaldo local antes de ejecutar una transacción atómica.
- No generar cambios_pendientes ni sincronización externa.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-safe-local-consolidation";
  var MAX_IDENTITIES=25;
  var running=false;
  var mounted=false;
  var lastPreview=null;
  var lastPlan=null;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function id(name){return document.getElementById(name);}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function db(){return window.BL2DB||null;}
  function config(){return window.BL2Config||{};}
  function stores(){return config().stores||{};}
  function backupRepo(){return window.BDLRepoBackups||window.BDLRepositories&&window.BDLRepositories.get&&window.BDLRepositories.get("backups")||null;}

  function normalizeCedula(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.normalizeCedula==="function"){return rules.normalizeCedula(value);}
    var utils=config().utils||{};
    return typeof utils.normalizeCedula==="function"?utils.normalizeCedula(value):text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }
  function analyzeIdentification(value){
    var rules=window.BDLRulesPersona;
    if(rules&&typeof rules.analyzeIdentification==="function"){return rules.analyzeIdentification(value);}
    var utils=config().utils||{};
    if(typeof utils.analyzeIdentification==="function"){return utils.analyzeIdentification(value);}
    var raw=text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    return {original:text(value),raw:raw,canonical:raw,changed:false,safeAutoCorrection:false,missingLeadingZero:false,type:raw?"OTHER_IDENTIFICATION":"EMPTY"};
  }
  function canonicalPeriodId(value){value=text(value);var match=value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return match?match[1]+"-"+match[2]+"__"+match[3]+"-"+match[4]:value.replace(/_+/g,"__");}
  function normalizeKey(value){var utils=config().utils||{};return typeof utils.normalizeKey==="function"?utils.normalizeKey(value):text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function rowCedula(row){return normalizeCedula(row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row._cedula||row.idPersona));}
  function rawCedula(row){return text(row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row._cedula||row.idPersona));}
  function rowPeriod(row){return canonicalPeriodId(row&&(row.periodoId||row.periodId||row.periodoCanonicoId||row.ultimoPeriodoId));}
  function studentId(cedula,periodoId){cedula=normalizeCedula(cedula);periodoId=canonicalPeriodId(periodoId);return cedula&&periodoId?cedula+"__"+periodoId:"";}
  function timestamp(row){var value=Date.parse(text(row&&(row.updatedAt||row.ultimaEdicionLocal||row.createdAt)));return Number.isFinite(value)?value:0;}
  function normalizedName(row){return text(row&&(row.nombreCompleto||row.Nombres||row.nombres||row.Nombre||row.nombre)).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase();}
  function normalizedTelegramUser(row){var rules=window.BDLRulesPersona;return rules&&rules.normalizeTelegramUser?rules.normalizeTelegramUser(row&&(row.telegramUser||row._telegramUser||row.usuarioTelegram||row.telegram)):text(row&&(row.telegramUser||row._telegramUser||row.usuarioTelegram||row.telegram)).replace(/^@+/,"");}
  function normalizedTelegramChat(row){var rules=window.BDLRulesPersona;return rules&&rules.normalizeTelegramChatId?rules.normalizeTelegramChatId(row&&(row.telegramChatId||row._telegramChatId||row.chatId)):text(row&&(row.telegramChatId||row._telegramChatId||row.chatId));}

  function descriptors(){
    var s=stores();
    return [
      {name:s.personas||"personas",keyPath:"cedula",kind:"person"},
      {name:s.estudiantes||"estudiantes",keyPath:"id",kind:"student"},
      {name:s.matriculasPeriodo||"matriculas_periodo",keyPath:"idEstudiantePeriodo",kind:"student"},
      {name:s.requisitosEstudiante||"requisitos_estudiante",keyPath:"id",kind:"requirement"},
      {name:s.notasTitulacion||"notas_titulacion",keyPath:"idEstudiantePeriodo",kind:"note"},
      {name:s.contactosEstudiante||"contactos_estudiante",keyPath:"id",kind:"contact"},
      {name:s.divisionesEstudiante||"divisiones_estudiante",keyPath:"id",kind:"division"},
      {name:s.requisitos||"requisitos",keyPath:"id",kind:"requirement"},
      {name:s.notas||"notas",keyPath:"id",kind:"noteLegacy"},
      {name:s.contactos||"contactos",keyPath:"id",kind:"contact"},
      {name:s.cambiosPendientes||"cambios_pendientes",keyPath:"id",kind:"reference"},
      {name:s.cambios||"cambios",keyPath:"id",kind:"reference"},
      {name:s.erroresValidacion||s.errores||"errores_validacion",keyPath:"id",kind:"reference"}
    ].filter(function(item,index,list){return item.name&&list.findIndex(function(other){return other.name===item.name;})===index;});
  }

  function readAll(){
    var current=db();
    if(!current||typeof current.getAll!=="function"){return Promise.reject(new Error("BL2DB no está disponible."));}
    return Promise.all(descriptors().map(function(descriptor){return current.getAll(descriptor.name).catch(function(){return [];}).then(function(rows){return {descriptor:descriptor,rows:Array.isArray(rows)?rows:[]};});}));
  }

  function suffixFromId(value,bases){
    value=text(value);
    for(var i=0;i<bases.length;i+=1){var base=text(bases[i]);if(base&&value.indexOf(base+"__")===0){return value.slice((base+"__").length);}}
    return "";
  }

  function transformedKey(row,descriptor,canonicalCedula,periodoId){
    var base=studentId(canonicalCedula,periodoId);
    if(descriptor.kind==="person"){return canonicalCedula;}
    if(descriptor.kind==="student"||descriptor.kind==="note"||descriptor.kind==="noteLegacy"||descriptor.kind==="contact"){return base||text(row[descriptor.keyPath]);}
    if(descriptor.kind==="requirement"){
      var requirement=normalizeKey(row.requisitoKey||row.key||row.nombre||row.requisitoLabel||"requisito");
      return base&&requirement?base+"__"+requirement:text(row[descriptor.keyPath]);
    }
    if(descriptor.kind==="division"){
      var oldCedula=rawCedula(row),oldCanonical=normalizeCedula(oldCedula);
      var oldBases=[text(row.idEstudiantePeriodo||row.studentId),periodoId&&oldCedula?oldCedula+"__"+periodoId:"",periodoId&&oldCedula?periodoId+"__"+oldCedula:"",periodoId&&oldCanonical?periodoId+"__"+oldCanonical:""];
      var suffix=normalizeKey(row.divisionKey||row.division||row.Division||suffixFromId(row.id,oldBases)||"division");
      return base&&suffix?base+"__"+suffix:text(row[descriptor.keyPath]);
    }
    return text(row[descriptor.keyPath]);
  }

  function replaceReferenceString(value,info){
    value=text(value);
    if(!value){return value;}
    if(value===info.rawCedula||value===info.cleanedRawCedula){return info.canonicalCedula;}
    for(var i=0;i<info.oldStudentIds.length;i+=1){var oldId=info.oldStudentIds[i];if(value===oldId){return info.canonicalStudentId;}if(oldId&&value.indexOf(oldId+"__")===0){return info.canonicalStudentId+value.slice(oldId.length);}}
    return value;
  }

  function patchReferences(value,info,depth){
    depth=Number(depth||0);
    if(depth>6||value==null){return value;}
    if(Array.isArray(value)){return value.map(function(item){return patchReferences(item,info,depth+1);});}
    if(typeof value!=="object"){return typeof value==="string"?replaceReferenceString(value,info):value;}
    var output={};
    Object.keys(value).forEach(function(name){
      var item=value[name];
      if(["cedula","numeroIdentificacion","NumeroIdentificacion","_cedula","idPersona"].indexOf(name)>=0){output[name]=info.canonicalCedula;return;}
      if(["idEstudiantePeriodo","studentId"].indexOf(name)>=0){output[name]=info.canonicalStudentId||replaceReferenceString(item,info);return;}
      output[name]=patchReferences(item,info,depth+1);
    });
    return output;
  }

  function transformRow(row,descriptor){
    row=clone(row||{});
    var raw=rawCedula(row),canonical=normalizeCedula(raw),periodoId=rowPeriod(row);
    if(!canonical){return null;}
    var canonicalStudent=studentId(canonical,periodoId);
    var oldStudentIds=[];
    [row.idEstudiantePeriodo,row.studentId,periodoId&&raw?raw+"__"+periodoId:"",periodoId&&raw?periodoId+"__"+raw:"",periodoId&&canonical?periodoId+"__"+canonical:""].forEach(function(value){value=text(value);if(value&&oldStudentIds.indexOf(value)<0){oldStudentIds.push(value);}});
    var info={rawCedula:raw,cleanedRawCedula:text(raw).replace(/[^0-9A-Za-z]/g,"").toUpperCase(),canonicalCedula:canonical,periodoId:periodoId,canonicalStudentId:canonicalStudent,oldStudentIds:oldStudentIds};
    var output=descriptor.kind==="reference"?patchReferences(row,info,0):Object.assign({},row);

    if(descriptor.kind!=="reference"){
      output.cedula=canonical;
      output.numeroIdentificacion=canonical;
      if("NumeroIdentificacion" in output){output.NumeroIdentificacion=canonical;}
      if("_cedula" in output){output._cedula=canonical;}
      if(periodoId){output.periodoId=periodoId;if("periodId" in output){output.periodId=periodoId;}if("periodoCanonicoId" in output){output.periodoCanonicoId=periodoId;}}
      if(canonicalStudent&&descriptor.kind!=="person"){output.idEstudiantePeriodo=canonicalStudent;output.studentId=canonicalStudent;}
    }

    var newKey=transformedKey(output,descriptor,canonical,periodoId);
    var oldKey=text(row[descriptor.keyPath]);
    if(descriptor.kind!=="reference"){
      output[descriptor.keyPath]=newKey;
      if(descriptor.kind==="student"||descriptor.kind==="note"||descriptor.kind==="noteLegacy"||descriptor.kind==="contact"){
        if("id" in output||descriptor.keyPath==="id"){output.id=newKey;}
      }
      if(descriptor.kind==="note"||descriptor.kind==="noteLegacy"){output.notaId=newKey;output.id=newKey;}
    }
    output.identityCanonicalizedAt=now();
    output.identityCanonicalizationSource="BDLocal.MantenimientoSeguro";
    output.updatedAt=text(row.updatedAt)||now();

    return {descriptor:descriptor,oldKey:oldKey,newKey:newKey,row:output,original:row,canonicalCedula:canonical,periodoId:periodoId,identityKey:canonical,changed:JSON.stringify(row)!==JSON.stringify(output),analysis:analyzeIdentification(raw)};
  }

  function criticalConflict(rows){
    var names={},users={},chats={};
    rows.forEach(function(row){var name=normalizedName(row),user=normalizedTelegramUser(row),chatId=normalizedTelegramChat(row);if(name){names[name]=true;}if(user){users[user]=true;}if(chatId){chats[chatId]=true;}});
    var reasons=[];
    if(Object.keys(names).length>1){reasons.push("nombres diferentes");}
    if(Object.keys(users).length>1){reasons.push("usuarios Telegram diferentes");}
    if(Object.keys(chats).length>1){reasons.push("chat IDs Telegram diferentes");}
    return reasons;
  }

  function mergeNonEmpty(rows){
    rows=(rows||[]).slice().sort(function(a,b){return timestamp(a)-timestamp(b);});
    var output={};
    rows.forEach(function(row){Object.keys(row||{}).forEach(function(name){var value=row[name];if(value===undefined||value===null||text(value)===""){if(output[name]===undefined){output[name]=clone(value);}}else{output[name]=clone(value);}});});
    var created=rows.map(function(row){return text(row.createdAt);}).filter(Boolean).sort()[0];
    if(created){output.createdAt=created;}
    output.updatedAt=rows.reduce(function(latest,row){return timestamp(row)>timestamp(latest)?row:latest;},rows[0]||{}).updatedAt||now();
    return output;
  }

  function buildPlan(results){
    var all=[];
    results.forEach(function(result){result.rows.forEach(function(row){var transformed=transformRow(row,result.descriptor);if(transformed&&transformed.changed){all.push(transformed);}});});
    var groups={};
    all.forEach(function(item){if(!groups[item.identityKey]){groups[item.identityKey]={identity:item.identityKey,items:[],conflicts:[],warnings:[]};}groups[item.identityKey].items.push(item);});

    var safeGroups=[],conflictGroups=[];
    Object.keys(groups).sort().forEach(function(identity){
      var group=groups[identity];
      var criticalRows=group.items.filter(function(item){return ["person","student","contact"].indexOf(item.descriptor.kind)>=0;}).map(function(item){return item.original;});
      var reasons=criticalConflict(criticalRows);
      if(reasons.length){group.conflicts=reasons;conflictGroups.push(group);return;}

      var buckets={};
      group.items.forEach(function(item){
        var bucketKey=item.descriptor.name+"::"+item.newKey;
        if(!buckets[bucketKey]){buckets[bucketKey]={descriptor:item.descriptor,newKey:item.newKey,items:[]};}
        buckets[bucketKey].items.push(item);
      });
      group.operations=[];
      Object.keys(buckets).forEach(function(bucketKey){
        var bucket=buckets[bucketKey];
        if(bucket.descriptor.kind==="reference"){
          bucket.items.forEach(function(item){group.operations.push({store:bucket.descriptor.name,keyPath:bucket.descriptor.keyPath,newKey:item.oldKey,put:item.row,deletes:[],sources:[item.original]});});
          return;
        }
        var merged=mergeNonEmpty(bucket.items.map(function(item){return item.row;}));
        merged[bucket.descriptor.keyPath]=bucket.newKey;
        var deletes=bucket.items.map(function(item){return item.oldKey;}).filter(function(value,index,list){return value&&value!==bucket.newKey&&list.indexOf(value)===index;});
        group.operations.push({store:bucket.descriptor.name,keyPath:bucket.descriptor.keyPath,newKey:bucket.newKey,put:merged,deletes:deletes,sources:bucket.items.map(function(item){return item.original;})});
      });
      safeGroups.push(group);
    });

    var selected=safeGroups.slice(0,MAX_IDENTITIES);
    return {
      scannedRows:results.reduce(function(total,result){return total+result.rows.length;},0),
      affectedRows:all.length,
      identitiesFound:safeGroups.length+conflictGroups.length,
      safeIdentities:safeGroups.length,
      conflictIdentities:conflictGroups.length,
      selectedIdentities:selected.length,
      remainingSafeIdentities:Math.max(0,safeGroups.length-selected.length),
      operations:selected.reduce(function(total,group){return total+group.operations.length;},0),
      deletes:selected.reduce(function(total,group){return total+group.operations.reduce(function(sum,operation){return sum+operation.deletes.length;},0);},0),
      selected:selected,
      conflicts:conflictGroups,
      allSafe:safeGroups
    };
  }

  function publicPlan(plan){
    if(!plan){return null;}
    return {scannedRows:plan.scannedRows,affectedRows:plan.affectedRows,identitiesFound:plan.identitiesFound,safeIdentities:plan.safeIdentities,conflictIdentities:plan.conflictIdentities,selectedIdentities:plan.selectedIdentities,remainingSafeIdentities:plan.remainingSafeIdentities,operations:plan.operations,deletes:plan.deletes,selected:plan.selected.map(function(group){return {identity:group.identity,operations:group.operations.map(function(operation){return {store:operation.store,newKey:operation.newKey,deletes:operation.deletes,sourceRows:operation.sources.length};});};}),conflicts:plan.conflicts.slice(0,50).map(function(group){return {identity:group.identity,reasons:group.conflicts,rows:group.items.length};})};
  }

  function preview(){
    if(running){return Promise.resolve({ok:true,skipped:true,message:"Ya existe una consolidación local en curso."});}
    running=true;lastPlan=null;status("Analizando identidades y relaciones locales...","info");
    return readAll().then(function(results){
      var plan=buildPlan(results);lastPlan=plan;
      lastPreview=Object.assign({ok:true,version:VERSION,generatedAt:now(),maxIdentities:MAX_IDENTITIES,canonicalLocalId:"cedula__periodoId",writesExternal:false,createsOutbox:false,message:"Análisis local: "+plan.safeIdentities+" identidad(es) segura(s), "+plan.conflictIdentities+" conflicto(s), "+plan.selectedIdentities+" seleccionada(s) para el siguiente lote."},publicPlan(plan));
      render(lastPreview);status(lastPreview.message,plan.conflictIdentities?"warning":"success");return clone(lastPreview);
    }).catch(function(error){status(error.message||String(error),"error");throw error;}).finally(function(){running=false;render(lastPreview||{});});
  }

  function backupPlan(plan){
    var repository=backupRepo();
    if(!repository||typeof repository.save!=="function"){return Promise.reject(new Error("El repositorio de respaldos no está disponible."));}
    var documents=[];
    plan.selected.forEach(function(group){group.operations.forEach(function(operation){documents.push({identity:group.identity,store:operation.store,newKey:operation.newKey,deletes:operation.deletes,sources:operation.sources,merged:operation.put});});});
    return repository.save({scope:"bdlocal.identity",tipo:"pre_local_identity_repair",type:"pre_local_identity_repair",schemaVersion:"2",totalRegistros:documents.length,origen:"BDLLocalIdentityRepair",payload:{createdAt:now(),canonicalLocalId:"cedula__periodoId",documents:documents}});
  }

  function executeTransaction(plan){
    var current=db();
    if(!current||typeof current.tx!=="function"){return Promise.reject(new Error("BL2DB.tx no está disponible."));}
    var storeNames=[];
    plan.selected.forEach(function(group){group.operations.forEach(function(operation){if(storeNames.indexOf(operation.store)<0){storeNames.push(operation.store);}});});
    if(!storeNames.length){return Promise.resolve({puts:0,deletes:0});}
    return current.tx(storeNames,"readwrite").then(function(transaction){
      return new Promise(function(resolve,reject){
        var puts=0,deletes=0;
        transaction.oncomplete=function(){resolve({puts:puts,deletes:deletes});};
        transaction.onerror=function(){reject(transaction.error||new Error("No se pudo consolidar Base Local."));};
        transaction.onabort=function(){reject(transaction.error||new Error("La consolidación local fue cancelada por IndexedDB."));};
        try{
          plan.selected.forEach(function(group){group.operations.forEach(function(operation){var objectStore=transaction.objectStore(operation.store);objectStore.put(clone(operation.put));puts+=1;operation.deletes.forEach(function(oldKey){objectStore.delete(oldKey);deletes+=1;});});});
        }catch(error){try{transaction.abort();}catch(inner){}reject(error);}
      });
    });
  }

  function refresh(){
    var cache=stores().cacheViews||stores().resumen||"cache_views";
    var current=db();
    var clear=current&&typeof current.clear==="function"?current.clear(cache).catch(function(){return null;}):Promise.resolve(null);
    return clear.then(function(){
      try{window.dispatchEvent(new CustomEvent("bdlocal:identity-local-repaired",{detail:{at:now(),canonicalLocalId:"cedula__periodoId",queued:false}}));}catch(error){}
      var hub=window.BDLocalConexiones;
      return hub&&typeof hub.refreshCache==="function"?hub.refreshCache({force:true,light:true,source:"local_identity_repair"}).catch(function(){return null;}):null;
    });
  }

  function apply(){
    var plan=lastPlan;
    if(!plan||!plan.selected.length){return Promise.resolve({ok:true,skipped:true,message:"No existen correcciones seguras en la última vista previa."});}
    if(!window.confirm("Consolidar identidades en Base Local\n\nIdentidades: "+plan.selectedIdentities+"\nOperaciones: "+plan.operations+"\nClaves antiguas a retirar: "+plan.deletes+"\n\nSe creará un respaldo local y no se enviará nada a Firebase ni Google. ¿Continuar?")){return Promise.resolve({ok:true,cancelled:true,message:"Consolidación cancelada."});}
    if(running){return Promise.resolve({ok:true,skipped:true,message:"Ya existe una consolidación local en curso."});}
    running=true;status("Creando respaldo antes de consolidar...","warning");
    return backupPlan(plan).then(function(backup){return executeTransaction(plan).then(function(result){return {backup:backup,result:result};});}).then(function(context){return refresh().then(function(){return context;});}).then(function(context){
      var result={ok:true,identities:plan.selectedIdentities,operations:context.result.puts,deletes:context.result.deletes,remainingSafeIdentities:plan.remainingSafeIdentities,conflicts:plan.conflictIdentities,backupId:context.backup&& (context.backup.id||context.backup.backupId)||"",writesExternal:false,createsOutbox:false,message:"Base Local consolidada: "+plan.selectedIdentities+" identidad(es), "+context.result.puts+" registro(s) guardado(s) y "+context.result.deletes+" clave(s) antigua(s) retirada(s)."};
      lastPlan=null;lastPreview=result;render(result);status(result.message,"success");return result;
    }).catch(function(error){status(error.message||String(error),"error");throw error;}).finally(function(){running=false;render(lastPreview||{});});
  }

  function status(message,type){var node=id("local-identity-status");if(node){node.className="bdlc-alert "+(type||"info");node.textContent=message;}}
  function render(report){
    var summary=id("local-identity-summary"),output=id("local-identity-json"),button=id("local-identity-apply");
    if(!summary||!output){return;}
    report=report||{};
    var rows=[["Filas revisadas",Number(report.scannedRows||0)],["Filas que requieren ajuste",Number(report.affectedRows||0)],["Identidades seguras",Number(report.safeIdentities||report.identities||0)],["Identidades con conflicto",Number(report.conflictIdentities||report.conflicts||0)],["Seleccionadas en este lote",Number(report.selectedIdentities||report.identities||0)],["Pendientes para otro lote",Number(report.remainingSafeIdentities||0)],["Claves antiguas",Number(report.deletes||0)]];
    summary.className="bdlc-table-wrap";
    summary.innerHTML='<table class="bdlc-table"><tbody>'+rows.map(function(row){return '<tr><th>'+esc(row[0])+'</th><td>'+esc(row[1])+'</td></tr>';}).join("")+'</tbody></table>';
    output.textContent=JSON.stringify(report,null,2);
    if(button){button.disabled=!lastPlan||!lastPlan.selected.length||running;}
  }

  function mount(container){
    if(typeof container==="string"){container=document.querySelector(container);}
    container=container||id("bl2-maintenance-slot");
    if(!container){return false;}
    var card=id("local-identity-repair-card");
    if(!card){
      card=document.createElement("div");card.id="local-identity-repair-card";card.className="bdlc-card";
      card.innerHTML='<div class="bdlc-header"><div><h3>Corregir identidades en Base Local</h3><p>Unifica cédulas y relaciones locales sin generar cola ni enviar datos externos.</p></div><span class="bdlc-status warning">Vista previa y respaldo</span></div><div class="bdlc-actions"><button id="local-identity-preview" class="bdlc-button" type="button">Analizar identidades locales</button><button id="local-identity-apply" class="bdlc-button warning" type="button" disabled>Aplicar lote seguro</button></div><div id="local-identity-status" class="bdlc-alert info">Pendiente de análisis. Máximo 25 identidades por confirmación.</div><div id="local-identity-summary" class="bdlc-empty">Ejecute el análisis para preparar el lote.</div><details><summary>JSON técnico</summary><pre id="local-identity-json" class="bdlc-raw-output">{}</pre></details>';
      container.appendChild(card);
      id("local-identity-preview").addEventListener("click",function(){preview().catch(function(){});});
      id("local-identity-apply").addEventListener("click",function(){apply().catch(function(){});});
    }
    mounted=true;render(lastPreview||{});return true;
  }

  function diagnostics(){return Promise.resolve({ok:true,version:VERSION,running:running,mounted:mounted,maxIdentities:MAX_IDENTITIES,canonicalLocalId:"cedula__periodoId",writesExternal:false,createsOutbox:false,lastPreview:lastPreview});}

  window.BDLLocalIdentityRepair={version:VERSION,preview:preview,apply:apply,mount:mount,diagnostics:diagnostics,canonicalStudentId:studentId,transformRow:transformRow,buildPlan:buildPlan,getLastPreview:function(){return clone(lastPreview);},writesExternal:false,createsOutbox:false};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){mount();},{once:true});}else{mount();}
})(window,document);
