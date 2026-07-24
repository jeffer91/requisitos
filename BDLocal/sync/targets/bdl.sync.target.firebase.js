/* =========================================================
Nombre completo: bdl.sync.target.firebase.js
Ruta: /BDLocal/sync/targets/bdl.sync.target.firebase.js
Función:
- Procesar cambios_pendientes hacia las ocho colecciones Firebase V2.
- Validar identidad según la entidad, sin exigir cédula a catálogos.
- Escribir con control atómico de versión/hash.
- Registrar conflictos y confirmar solo cambios completamente procesados.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.1.0-conflict-safe-entities";
  var MAX_BATCH_SIZE=25;

  function text(value){return String(value==null?"":value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function normalizeKey(value){
    return text(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function identity(){return window.RequisitosFirebaseIdentity||null;}
  function syncState(){return window.BDLRepoSyncEstado||null;}
  function conflictRepo(){return window.BDLRepoConflictos||null;}
  function configStore(){return window.BDLocalConfigStore||null;}
  function repos(){return window.BDLRepositories||null;}
  function repo(name,fallback){var registry=repos();return registry&&typeof registry.get==="function"?(registry.get(name)||fallback||null):(fallback||null);}
  function rowId(row){return text(row&&(row.id||row.cambioId));}
  function payloadOf(row){return clone(row&&(row.payload||row.data||row.registro)||{});}
  function tableOf(row){return normalizeKey(row&&(row.tabla||row.table||row.tipo||row.type)||"");}
  function actionOf(row){return text(row&&(row.accion||row.action)||"UPSERT").toUpperCase();}
  function safeRows(rows,options){
    rows=Array.isArray(rows)?rows:[];options=options||{};
    var requested=Number(options.limit||options.batchSize||MAX_BATCH_SIZE);
    if(!Number.isFinite(requested)||requested<=0){requested=MAX_BATCH_SIZE;}
    return rows.slice(0,Math.min(MAX_BATCH_SIZE,Math.floor(requested)));
  }
  function entitiesFor(change){
    var table=tableOf(change);
    if(/requisit/.test(table)){return ["requisitos"];}
    if(/nota|evaluacion|defensa|complex/.test(table)){return ["notas"];}
    if(/persona|contact/.test(table)){return ["estudiantes"];}
    if(/matricula|division/.test(table)){return ["matriculas"];}
    if(/periodo/.test(table)){return ["periodos"];}
    if(/carrera/.test(table)){return ["carreras"];}
    if(/historial|log/.test(table)){return ["historial"];}
    if(/importacion/.test(table)){return ["importaciones"];}
    return ["estudiantes","matriculas","requisitos","notas"];
  }
  function requiresStudentIdentity(entity){return ["matriculas","requisitos","notas"].indexOf(entity)>=0;}
  function identityOf(change,options){
    var data=Object.assign({},payloadOf(change),change||{});
    if(options&&options.periodoId&&!data.periodoId){data.periodoId=options.periodoId;}
    var helper=identity();
    return helper&&typeof helper.identityFromRow==="function"?helper.identityFromRow(data):{ok:false,cedula:text(data.cedula),periodoId:text(data.periodoId),localId:"",remoteId:""};
  }
  function localContext(change,options){
    var current=identityOf(change,options);var payload=payloadOf(change);
    var requested=entitiesFor(change);var needsIdentity=requested.some(requiresStudentIdentity);
    if(needsIdentity&&!current.ok){return Promise.resolve({ok:false,change:change,payload:payload,entities:requested,reason:"Falta período o identificación."});}
    var personaRepo=repo("personas",window.BDLRepoPersonas);
    var matriculaRepo=repo("matriculas",window.BDLRepoMatriculas);
    var requisitosRepo=repo("requisitos",window.BDLRepoRequisitos);
    var notasRepo=repo("notas",window.BDLRepoNotas);
    var person=current.cedula&&personaRepo&&typeof personaRepo.getByCedula==="function"?personaRepo.getByCedula(current.cedula).catch(function(){return null;}):Promise.resolve(null);
    var enrollment=current.ok&&matriculaRepo&&typeof matriculaRepo.getByPeriodoCedula==="function"?matriculaRepo.getByPeriodoCedula(current.periodoId,current.cedula).catch(function(){return null;}):Promise.resolve(null);
    var requirements=current.ok&&requisitosRepo&&typeof requisitosRepo.list==="function"?requisitosRepo.list({periodoId:current.periodoId,cedula:current.cedula}).catch(function(){return [];}):Promise.resolve([]);
    var notes=current.ok&&notasRepo&&typeof notasRepo.getByPeriodoCedula==="function"?notasRepo.getByPeriodoCedula(current.periodoId,current.cedula).catch(function(){return null;}):Promise.resolve(null);
    return Promise.all([person,enrollment,requirements,notes]).then(function(values){
      var base=Object.assign({},values[0]||{},values[1]||{},payload);
      if(current.cedula){base.cedula=current.cedula;base.numeroIdentificacion=current.cedula;}
      if(current.periodoId){base.periodoId=current.periodoId;base.periodId=current.periodoId;}
      return {ok:true,identity:current,payload:payload,change:change,entities:requested,base:base,
        person:values[0],enrollment:values[1],requirements:values[2]||[],notes:values[3]};
    });
  }
  function stableId(prefix,value){
    value=text(value);var hash=2166136261;
    for(var i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash+=(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24);}
    return prefix+"__"+(hash>>>0).toString(16);
  }
  function withMeta(entity,data,source){
    data=Object.assign({},data||{});var current=mapper();var stamp=now();
    data.createdAt=text(data.createdAt)||stamp;data.updatedAt=text(data.updatedAt)||stamp;
    data.version=Math.max(1,Number(data.version||1));
    data.eliminado=data.eliminado===true;data.eliminadoEn=data.eliminado?(text(data.eliminadoEn)||data.updatedAt):"";
    if(current&&typeof current.dataHash==="function"&&typeof current.functionalContent==="function"){
      data.dataHash=current.dataHash({entity:entity,data:current.functionalContent(data)});
    }
    data.syncSource=text(data.syncSource||source||"BDLocal");
    return data;
  }
  function directDocument(entity,context){
    var data=Object.assign({},context.payload||{});var changeId=rowId(context.change);var current=context.identity||{};
    if(entity==="periodos"){
      data.periodoId=text(data.periodoId||data.id||current.periodoId);data.id=data.periodoId;
      data.label=text(data.label||data.periodoLabel||data.nombre||data.periodoId);
    }else if(entity==="carreras"){
      data.codigoCarrera=text(data.codigoCarrera||data.CodigoCarrera||data.codigo||data.id);data.id=data.codigoCarrera;
      data.nombreCarrera=text(data.nombreCarrera||data.NombreCarrera||data.nombre);
    }else if(entity==="historial"){
      data.id=text(data.id)||changeId||stableId("historial",JSON.stringify(data));
      data.entidad=text(data.entidad||data.tabla||"registro");data.entidadId=text(data.entidadId||data.registroId||current.localId||data.id);
      data.accion=text(data.accion||data.action||actionOf(context.change));data.createdAt=text(data.createdAt)||now();
    }else if(entity==="importaciones"){
      data.periodoId=text(data.periodoId||current.periodoId);
      data.archivoNombre=text(data.archivoNombre||data.fileName||data.archivo||"importacion");
      data.id=text(data.id)||(text(data.archivoHash)&&data.periodoId?text(data.archivoHash)+"__"+data.periodoId:changeId||stableId("importacion",JSON.stringify(data)));
      data.createdAt=text(data.createdAt)||now();
    }
    if(actionOf(context.change)==="DELETE"||data.eliminado===true){data.eliminado=true;data.eliminadoEn=text(data.eliminadoEn)||now();}
    return withMeta(entity,data,"BDLocal");
  }
  function documentFor(entity,context){
    var current=mapper();if(!current){return null;}var document=null;
    if(entity==="estudiantes"&&typeof current.studentDocument==="function"){document=current.studentDocument(context.base);}
    else if(entity==="matriculas"&&typeof current.enrollmentDocument==="function"){document=current.enrollmentDocument(context.base);}
    else if(entity==="requisitos"&&typeof current.requirementsDocument==="function"){document=current.requirementsDocument(context.base,context.requirements);}
    else if(entity==="notas"&&typeof current.notesDocument==="function"){document=current.notesDocument(context.base,context.notes||{});}
    else{document=directDocument(entity,context);}
    if(document&&(actionOf(context.change)==="DELETE"||context.payload.eliminado===true)){
      document.eliminado=true;document.eliminadoEn=text(context.payload.eliminadoEn)||now();document=withMeta(entity,document,"BDLocal");
    }
    return document;
  }
  function baseFor(entity,context){
    if(entity==="estudiantes"){return context.person;}
    if(entity==="matriculas"){return context.enrollment;}
    if(entity==="requisitos"){return context.requirements&&context.requirements[0]||null;}
    if(entity==="notas"){return context.notes;}
    return context.payload;
  }
  function expectedFor(base){
    base=base||{};var known=!!(text(base._firebaseDataHash)||Number(base._firebaseVersion)>0||text(base._firebaseUpdatedAt));
    return known?{
      exists:true,hash:text(base._firebaseDataHash),version:Number(base._firebaseVersion||0),updatedAt:text(base._firebaseUpdatedAt)
    }:{exists:base._firebaseDocumentId?true:undefined};
  }
  function prepareEntries(rows,options){
    var skipped=[];
    return Promise.all(safeRows(rows,options).map(function(change){
      return localContext(change,options).then(function(context){
        if(!context.ok){skipped.push({id:rowId(change),reason:context.reason});return [];}
        var entries=[];
        context.entities.forEach(function(entity){
          var document=documentFor(entity,context);var central=repository();
          var documentId=central&&typeof central.documentId==="function"?central.documentId(entity,document||{}):text(document&&document.id);
          if(!document||(!documentId&&["historial","importaciones"].indexOf(entity)<0)){
            skipped.push({id:rowId(change),entity:entity,reason:"No se pudo formar el documento completo."});return;
          }
          entries.push({entity:entity,documentId:documentId,document:document,expected:expectedFor(baseFor(entity,context)),changeIds:[rowId(change)].filter(Boolean),context:context});
        });
        return entries;
      });
    })).then(function(groups){
      var map=Object.create(null);
      groups.forEach(function(list){(list||[]).forEach(function(item){
        var key=item.entity+"__"+(item.documentId||JSON.stringify(item.document));
        if(!map[key]){map[key]=item;return;}
        map[key].document=Object.assign({},map[key].document,item.document);
        item.changeIds.forEach(function(id){if(map[key].changeIds.indexOf(id)<0){map[key].changeIds.push(id);}});
      });});
      return {entries:Object.keys(map).map(function(key){return map[key];}),skipped:skipped};
    });
  }
  function quotaFor(writes){
    var current=configStore();
    if(!current||typeof current.getFirebaseQuotaStatus!=="function"){return {allowed:true,level:"sin_control",estimatedOps:Number(writes||0),message:"Control de cuota no disponible."};}
    return current.getFirebaseQuotaStatus(Number(writes||0))||{allowed:true};
  }
  function registerUsage(writes){try{var current=configStore();if(current&&typeof current.registerFirebaseUsage==="function"){current.registerFirebaseUsage({writes:Number(writes||0),label:"Firebase V2: escrituras confirmadas."});}}catch(error){}}
  function markStateStart(entities,periodoId){var current=syncState();if(!current||typeof current.begin!=="function"){return Promise.resolve([]);}return Promise.all(entities.map(function(entity){return current.begin("firebase",entity,periodoId,"push");}));}
  function markStateSuccess(counts,conflictCounts,periodoId){
    var current=syncState();if(!current||typeof current.pushSuccess!=="function"){return Promise.resolve([]);}
    var entities=Object.keys(Object.assign({},counts,conflictCounts));
    return Promise.all(entities.map(function(entity){return current.pushSuccess(entity,periodoId,{writeCount:counts[entity]||0,conflictCount:conflictCounts[entity]||0,batchCount:1,at:now()});}));
  }
  function markStateError(entities,periodoId,error){var current=syncState();if(!current||typeof current.fail!=="function"){return Promise.resolve([]);}return Promise.all(entities.map(function(entity){return current.fail("firebase",entity,periodoId,error,{mode:"push"});}));}
  function saveConflict(entry,conflict){
    var current=conflictRepo();if(!current||typeof current.save!=="function"){return Promise.resolve(null);}
    var id=entry.context&&entry.context.identity||{};
    return current.save({entidad:entry.entity,documentoId:entry.documentId,periodoId:id.periodoId,cedula:id.cedula,
      motivo:"ATOMIC_REMOTE_CONFLICT",local:entry.document,remote:conflict&&conflict.remote,expected:entry.expected,changeIds:entry.changeIds});
  }
  function writeEntries(entries){
    var central=repository();if(!central||typeof central.writeManyChecked!=="function"){return Promise.reject(new Error("Repositorio Firebase V2 seguro no disponible."));}
    var grouped=Object.create(null);entries.forEach(function(entry){(grouped[entry.entity]=grouped[entry.entity]||[]).push(entry);});
    var results=[];var counts={};var conflictCounts={};var successKeys=Object.create(null);var conflictKeys=Object.create(null);var chain=Promise.resolve();
    Object.keys(grouped).forEach(function(entity){chain=chain.then(function(){
      var source=grouped[entity];
      return central.writeManyChecked(entity,source.map(function(entry){return {documentId:entry.documentId,document:entry.document,expected:entry.expected};}),
        {merge:false,allowUnbasedOverwrite:false}).then(function(result){
          results.push(result);counts[entity]=Number(result.written||0);conflictCounts[entity]=Number(result.conflicts&&result.conflicts.length||0);
          (result.results||[]).forEach(function(item){successKeys[entity+"__"+item.documentId]=true;});
          var conflictTasks=(result.conflicts||[]).map(function(conflict){
            var key=entity+"__"+text(conflict.documentId);conflictKeys[key]=true;
            var entry=source.filter(function(item){return item.documentId===conflict.documentId;})[0];
            return entry?saveConflict(entry,conflict):Promise.resolve(null);
          });
          return Promise.all(conflictTasks);
        });
    });});
    return chain.then(function(){return {counts:counts,conflictCounts:conflictCounts,results:results,successKeys:successKeys,conflictKeys:conflictKeys,
      written:Object.keys(counts).reduce(function(sum,key){return sum+counts[key];},0),conflicts:Object.keys(conflictKeys).length};});
  }
  function processedChangeIds(entries,written){
    var status=Object.create(null);
    entries.forEach(function(entry){
      var key=entry.entity+"__"+entry.documentId;var success=written.successKeys[key]===true;
      entry.changeIds.forEach(function(id){
        if(!status[id]){status[id]={total:0,success:0};}
        status[id].total+=1;if(success){status[id].success+=1;}
      });
    });
    return Object.keys(status).filter(function(id){return status[id].total>0&&status[id].success===status[id].total;});
  }
  function push(pendingRows,options){
    options=Object.assign({},options||{});
    if(options.manual!==true){return Promise.resolve({ok:false,target:"firebase",blocked:true,deferWithoutAttempt:true,processedIds:[],message:"Firebase V2 solo admite sincronización manual."});}
    if(!repository()||!mapper()||!identity()){return Promise.resolve({ok:false,target:"firebase",blocked:true,deferWithoutAttempt:true,processedIds:[],message:"La arquitectura Firebase V2 todavía no está cargada."});}
    var prepared;var entities=[];var quota;
    return prepareEntries(pendingRows,options).then(function(result){
      prepared=result;if(!result.entries.length){return {stop:true,result:{ok:false,target:"firebase",processedIds:[],skipped:result.skipped,message:"Ningún cambio produjo documentos válidos."}};}
      entities=Array.from(new Set(result.entries.map(function(item){return item.entity;})));
      quota=quotaFor(result.entries.length);
      if(quota.allowed===false){return {stop:true,result:{ok:false,target:"firebase",blocked:true,quotaBlocked:true,deferWithoutAttempt:true,processedIds:[],skipped:result.skipped,quota:quota,message:quota.message||"Firebase bloqueado por cuota."}};}
      return markStateStart(entities,text(options.periodoId)).then(function(){return {stop:false};});
    }).then(function(stage){
      if(stage.stop){return stage.result;}
      return writeEntries(prepared.entries).then(function(written){
        var processed=processedChangeIds(prepared.entries,written);registerUsage(written.written);
        return markStateSuccess(written.counts,written.conflictCounts,text(options.periodoId)).then(function(){return {
          ok:written.conflicts===0,target:"firebase",schema:"V2",collections:entities,
          documentsPrepared:prepared.entries.length,documentsWritten:written.written,conflicts:written.conflicts,
          processedIds:processed,skipped:prepared.skipped,quota:quota,results:written.results,
          message:written.conflicts?"Se detectaron conflictos. Los cambios afectados permanecen pendientes.":"Firebase V2 actualizado sin conflictos."
        };});
      });
    }).catch(function(error){return markStateError(entities,text(options.periodoId),error).then(function(){return {ok:false,target:"firebase",processedIds:[],message:error.message||String(error)};});});
  }

  if(window.BDLSyncTargets&&typeof window.BDLSyncTargets.register==="function"){
    window.BDLSyncTargets.register("firebase",{push:push,version:VERSION,collections:["estudiantes","matriculas","requisitos","notas","periodos","carreras","historial","importaciones"],conflictSafe:true});
  }
  window.BDLSyncTargetFirebase={version:VERSION,push:push,safeRows:safeRows,entitiesFor:entitiesFor,prepareEntries:prepareEntries,
    processedChangeIds:processedChangeIds,documentFor:documentFor,expectedFor:expectedFor};
})(window);
