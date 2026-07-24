/* =========================================================
Nombre completo: bdl.sync.target.firebase.js
Ruta: /BDLocal/sync/targets/bdl.sync.target.firebase.js
Función:
- Procesar manualmente cambios_pendientes hacia Firebase V2.
- Reconstruir el documento completo desde IndexedDB antes de subir.
- Separar estudiantes, matrículas, requisitos y notas.
- Comparar dataHash para evitar escrituras idénticas.
- Mantener máximo 25 cambios locales por ejecución.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-firebase-v2-outbox";
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
  function configStore(){return window.BDLocalConfigStore||null;}
  function repos(){return window.BDLRepositories||null;}
  function repo(name,fallback){
    var registry=repos();
    return registry&&typeof registry.get==="function"?(registry.get(name)||fallback||null):(fallback||null);
  }
  function rowId(row){return text(row&&(row.id||row.cambioId));}
  function payloadOf(row){return clone(row&&(row.payload||row.data||row.registro)||{});}
  function tableOf(row){return normalizeKey(row&&(row.tabla||row.table||row.tipo||row.type)||"");}
  function safeRows(rows,options){
    rows=Array.isArray(rows)?rows:[];options=options||{};
    var requested=Number(options.limit||options.batchSize||MAX_BATCH_SIZE);
    if(!Number.isFinite(requested)||requested<=0){requested=MAX_BATCH_SIZE;}
    return rows.slice(0,Math.min(MAX_BATCH_SIZE,Math.floor(requested)));
  }
  function identityOf(change,options){
    var data=Object.assign({},payloadOf(change),change||{});
    if(options&&options.periodoId&&!data.periodoId){data.periodoId=options.periodoId;}
    var helper=identity();
    return helper&&typeof helper.identityFromRow==="function"
      ?helper.identityFromRow(data)
      :{ok:false,cedula:text(data.cedula),periodoId:text(data.periodoId),localId:"",remoteId:""};
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
  function localContext(change,options){
    var current=identityOf(change,options);
    var payload=payloadOf(change);
    if(!current.ok){
      return Promise.resolve({ok:false,identity:current,payload:payload,change:change,reason:"Falta período o identificación."});
    }
    var personaRepo=repo("personas",window.BDLRepoPersonas);
    var matriculaRepo=repo("matriculas",window.BDLRepoMatriculas);
    var requisitosRepo=repo("requisitos",window.BDLRepoRequisitos);
    var notasRepo=repo("notas",window.BDLRepoNotas);
    var person=personaRepo&&typeof personaRepo.getByCedula==="function"
      ?personaRepo.getByCedula(current.cedula).catch(function(){return null;}):Promise.resolve(null);
    var enrollment=matriculaRepo&&typeof matriculaRepo.getByPeriodoCedula==="function"
      ?matriculaRepo.getByPeriodoCedula(current.periodoId,current.cedula).catch(function(){return null;}):Promise.resolve(null);
    var requirements=requisitosRepo&&typeof requisitosRepo.list==="function"
      ?requisitosRepo.list({periodoId:current.periodoId,cedula:current.cedula}).catch(function(){return [];}):Promise.resolve([]);
    var notes=notasRepo&&typeof notasRepo.getByPeriodoCedula==="function"
      ?notasRepo.getByPeriodoCedula(current.periodoId,current.cedula).catch(function(){return null;}):Promise.resolve(null);
    return Promise.all([person,enrollment,requirements,notes]).then(function(values){
      var base=Object.assign({},values[0]||{},values[1]||{},payload,{
        cedula:current.cedula,numeroIdentificacion:current.cedula,
        periodoId:current.periodoId,periodId:current.periodoId
      });
      return {ok:true,identity:current,payload:payload,change:change,base:base,person:values[0],enrollment:values[1],requirements:values[2]||[],notes:values[3]};
    });
  }
  function directDocument(entity,context){
    var data=Object.assign({},context.payload||{});
    if(entity==="periodos"){
      data.periodoId=text(data.periodoId||data.id||context.identity.periodoId);
      data.id=data.periodoId;
      data.label=text(data.label||data.periodoLabel||data.nombre||data.periodoId);
    }else if(entity==="carreras"){
      data.codigoCarrera=text(data.codigoCarrera||data.CodigoCarrera||data.codigo||data.id);
      data.id=data.codigoCarrera;
      data.nombreCarrera=text(data.nombreCarrera||data.NombreCarrera||data.nombre);
    }else if(entity==="historial"){
      data.entidad=text(data.entidad||data.tabla||"registro");
      data.entidadId=text(data.entidadId||data.registroId||context.identity.localId);
      data.accion=text(data.accion||data.action||"UPSERT");
      data.createdAt=text(data.createdAt)||now();
      delete data.id;
    }else if(entity==="importaciones"){
      data.periodoId=text(data.periodoId||context.identity.periodoId);
      data.archivoNombre=text(data.archivoNombre||data.fileName||data.archivo||"importacion");
      data.createdAt=text(data.createdAt)||now();
      delete data.id;
    }
    return data;
  }
  function documentFor(entity,context){
    var current=mapper();
    if(!current){return null;}
    if(entity==="estudiantes"&&typeof current.studentDocument==="function"){return current.studentDocument(context.base);}
    if(entity==="matriculas"&&typeof current.enrollmentDocument==="function"){return current.enrollmentDocument(context.base);}
    if(entity==="requisitos"&&typeof current.requirementsDocument==="function"){return current.requirementsDocument(context.base,context.requirements);}
    if(entity==="notas"&&typeof current.notesDocument==="function"){return current.notesDocument(context.base,context.notes||{});}
    return directDocument(entity,context);
  }
  function prepareEntries(rows,options){
    var skipped=[];
    return Promise.all(safeRows(rows,options).map(function(change){
      return localContext(change,options).then(function(context){
        if(!context.ok){skipped.push({id:rowId(change),reason:context.reason});return [];}
        var entries=[];
        entitiesFor(change).forEach(function(entity){
          var document=documentFor(entity,context);
          var central=repository();
          var documentId=central&&typeof central.documentId==="function"?central.documentId(entity,document||{}):text(document&&document.id);
          if(!document||(!documentId&&["historial","importaciones"].indexOf(entity)<0)){
            skipped.push({id:rowId(change),entity:entity,reason:"No se pudo formar el documento completo."});
            return;
          }
          entries.push({entity:entity,documentId:documentId,document:document,changeIds:[rowId(change)].filter(Boolean)});
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
  function compareEntries(entries){
    var central=repository();
    return Promise.all((entries||[]).map(function(item){
      if(!item.documentId||!central||typeof central.getById!=="function"){
        item.changed=true;return item;
      }
      return central.getById(item.entity,item.documentId).then(function(remote){
        var remoteHash=text(remote&&remote.data&&remote.data.dataHash);
        var localHash=text(item.document&&item.document.dataHash);
        item.changed=!(remoteHash&&localHash&&remoteHash===localHash);
        item.remoteHash=remoteHash;
        return item;
      }).catch(function(){item.changed=true;return item;});
    }));
  }
  function quotaFor(writes){
    var current=configStore();
    if(!current||typeof current.getFirebaseQuotaStatus!=="function"){
      return {allowed:true,level:"sin_control",estimatedOps:Number(writes||0),message:"Control de cuota no disponible."};
    }
    return current.getFirebaseQuotaStatus(Number(writes||0))||{allowed:true};
  }
  function registerUsage(writes){
    try{var current=configStore();if(current&&typeof current.registerFirebaseUsage==="function"){
      current.registerFirebaseUsage({writes:Number(writes||0),label:"Firebase V2: cambios diferentes."});
    }}catch(error){}
  }
  function markStateStart(entities,periodoId){
    var state=syncState();if(!state||typeof state.begin!=="function"){return Promise.resolve([]);}
    return Promise.all(entities.map(function(entity){return state.begin("firebase",entity,periodoId,"push");}));
  }
  function markStateSuccess(counts,periodoId){
    var state=syncState();if(!state||typeof state.pushSuccess!=="function"){return Promise.resolve([]);}
    return Promise.all(Object.keys(counts).map(function(entity){
      return state.pushSuccess(entity,periodoId,{writeCount:counts[entity],batchCount:1,at:now()});
    }));
  }
  function markStateError(entities,periodoId,error){
    var state=syncState();if(!state||typeof state.fail!=="function"){return Promise.resolve([]);}
    return Promise.all(entities.map(function(entity){return state.fail("firebase",entity,periodoId,error,{mode:"push"});}));
  }
  function writeChanged(entries,options){
    var central=repository();
    if(!central||typeof central.writeMany!=="function"){return Promise.reject(new Error("Repositorio Firebase V2 no disponible."));}
    var grouped=Object.create(null);
    entries.filter(function(item){return item.changed;}).forEach(function(item){
      (grouped[item.entity]=grouped[item.entity]||[]).push(item.document);
    });
    var counts={};var results=[];var chain=Promise.resolve();
    Object.keys(grouped).forEach(function(entity){
      chain=chain.then(function(){
        return central.writeMany(entity,grouped[entity],{merge:true}).then(function(result){
          counts[entity]=Number(result&&result.written||0);results.push(result);return result;
        });
      });
    });
    return chain.then(function(){return {counts:counts,results:results,written:Object.keys(counts).reduce(function(sum,key){return sum+counts[key];},0)};});
  }
  function push(pendingRows,options){
    options=Object.assign({},options||{});
    if(options.manual!==true){
      return Promise.resolve({ok:false,target:"firebase",blocked:true,deferWithoutAttempt:true,processedIds:[],message:"Firebase V2 solo admite sincronización manual."});
    }
    if(!text(options.periodoId)&&options.allowAllPeriods!==true){
      return Promise.resolve({ok:false,target:"firebase",blocked:true,deferWithoutAttempt:true,processedIds:[],message:"Seleccione un período antes de subir a Firebase."});
    }
    if(!repository()||!mapper()||!identity()){
      return Promise.resolve({ok:false,target:"firebase",blocked:true,deferWithoutAttempt:true,processedIds:[],message:"La arquitectura Firebase V2 todavía no está cargada."});
    }

    var prepared;var compared;var entities=[];var quota;
    return prepareEntries(pendingRows,options).then(function(result){
      prepared=result;
      if(!result.entries.length){
        return {empty:true,result:{ok:false,target:"firebase",processedIds:[],skipped:result.skipped,message:"Ningún cambio produjo documentos válidos."}};
      }
      return compareEntries(result.entries).then(function(items){
        compared=items;entities=Array.from(new Set(items.map(function(item){return item.entity;})));
        quota=quotaFor(items.filter(function(item){return item.changed;}).length);
        if(quota.allowed===false){
          return {empty:true,result:{ok:false,target:"firebase",blocked:true,quotaBlocked:true,deferWithoutAttempt:true,processedIds:[],skipped:prepared.skipped,quota:quota,message:quota.message||"Firebase bloqueado por cuota."}};
        }
        return markStateStart(entities,text(options.periodoId)).then(function(){return {empty:false};});
      });
    }).then(function(stage){
      if(stage.empty){return stage.result;}
      return writeChanged(compared,options).then(function(written){
        var processed=[];compared.forEach(function(item){item.changeIds.forEach(function(id){if(processed.indexOf(id)<0){processed.push(id);}});});
        registerUsage(written.written);
        return markStateSuccess(written.counts,text(options.periodoId)).then(function(){
          return {
            ok:true,target:"firebase",schema:"V2",collections:Object.keys(written.counts),documentsPrepared:compared.length,
            documentsWritten:written.written,unchanged:compared.filter(function(item){return !item.changed;}).length,
            processedIds:processed,skipped:prepared.skipped,quota:quota,results:written.results,
            message:"Firebase V2 actualizado: "+written.written+" documento(s) diferente(s); "+processed.length+" cambio(s) confirmado(s)."
          };
        });
      }).catch(function(error){
        return markStateError(entities,text(options.periodoId),error).then(function(){throw error;});
      });
    }).catch(function(error){
      return {ok:false,target:"firebase",processedIds:[],message:error&&error.message?error.message:String(error)};
    });
  }

  var api={version:VERSION,push:push,safeRows:safeRows,entitiesFor:entitiesFor,prepareEntries:prepareEntries,compareEntries:compareEntries,quotaFor:quotaFor,collections:"Firebase V2",documentId:"periodoId__cedula",manualOnly:true};
  if(window.BDLSyncTargets&&typeof window.BDLSyncTargets.register==="function"){
    window.BDLSyncTargets.register("firebase",api);
  }
  window.BDLSyncTargetFirebase=api;
})(window);