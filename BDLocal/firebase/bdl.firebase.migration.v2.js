/* =========================================================
Nombre completo: bdl.firebase.migration.v2.js
Ruta: /BDLocal/firebase/bdl.firebase.migration.v2.js
Función:
- Crear vista previa de Estudiantes y EstudiantesPeriodo.
- Respaldar los documentos legacy en IndexedDB antes de escribir.
- Transformar datos a las ocho colecciones oficiales.
- Derivar catálogos de períodos y carreras.
- Unir historial e historial_periodos con IDs deterministas.
- Aplicar una migración idempotente y no destructiva.
- No ejecutarse automáticamente ni eliminar colecciones antiguas.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.0.0-nondestructive-migration";
  var PAGE_SIZE=400;
  var WRITE_BATCH=25;
  var CONFIRMATION="MIGRAR A FIREBASE V2";
  var state={running:false,operation:"",lastError:"",lastPreview:null,lastResult:null};

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function identity(){return window.RequisitosFirebaseIdentity||null;}
  function repository(){return window.RequisitosFirebaseRepository||null;}
  function schema(){return window.RequisitosFirebaseSchema||null;}
  function db(){return window.BL2DB||null;}
  function conflicts(){return window.BDLRepoConflictos||null;}
  function normalizeKey(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");}
  function stable(value){
    if(value===null||value===undefined){return String(value);}
    if(typeof value!=="object"){return JSON.stringify(value);}
    if(Array.isArray(value)){return "["+value.map(stable).join(",")+"]";}
    return "{"+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+":"+stable(value[key]);}).join(",")+"}";
  }
  function hash(value){
    var source=stable(value),result=2166136261;
    for(var index=0;index<source.length;index+=1){result^=source.charCodeAt(index);result+=(result<<1)+(result<<4)+(result<<7)+(result<<8)+(result<<24);}
    return "h"+(result>>>0).toString(16).padStart(8,"0");
  }
  function functional(value){
    var current=mapper();
    return current&&typeof current.functionalContent==="function"?current.functionalContent(value):value;
  }
  function dataHash(entity,value){
    var current=mapper();
    return current&&typeof current.dataHash==="function"
      ? current.dataHash({entity:entity,data:functional(value)})
      : hash({entity:entity,data:functional(value)});
  }
  function withMeta(entity,value,source){
    value=Object.assign({},value||{});
    var stamp=text(value.updatedAt||value.actualizadoEn||value.createdAt)||now();
    value.createdAt=text(value.createdAt||value.creadoEn)||stamp;
    value.updatedAt=stamp;
    value.version=Math.max(1,Number(value.version||1));
    value.eliminado=value.eliminado===true;
    value.eliminadoEn=value.eliminado?(text(value.eliminadoEn)||stamp):"";
    value.migrationSource=text(value.migrationSource||source||"legacy");
    value.migrationVersion=VERSION;
    value.dataHash=dataHash(entity,value);
    return value;
  }
  function nonEmptyMerge(left,right){
    var output=Object.assign({},left||{});
    Object.keys(right||{}).forEach(function(key){
      var value=right[key];
      if(value!==undefined&&value!==null&&(typeof value!=="string"||text(value)!=="")){output[key]=clone(value);}
      else if(output[key]===undefined){output[key]=clone(value);}
    });
    return output;
  }
  function documentIdField(){
    try{
      if(window.firebase&&window.firebase.firestore&&window.firebase.firestore.FieldPath&&typeof window.firebase.firestore.FieldPath.documentId==="function"){
        return window.firebase.firestore.FieldPath.documentId();
      }
    }catch(error){}
    return "__name__";
  }
  function ensure(){
    var current=repository();
    if(!current||typeof current.ensureFirestore!=="function"){return Promise.reject(new Error("Repositorio Firebase V2 no disponible."));}
    if(!mapper()||!identity()||!schema()){return Promise.reject(new Error("Contrato y mapeadores Firebase V2 no disponibles."));}
    return current.ensureFirestore();
  }
  function snapshotRows(snapshot){
    var rows=[];
    if(snapshot&&Array.isArray(snapshot.docs)){
      snapshot.docs.forEach(function(doc){rows.push({documentId:text(doc.id),data:clone(typeof doc.data==="function"?doc.data():doc.data||{})});});
    }else if(snapshot&&typeof snapshot.forEach==="function"){
      snapshot.forEach(function(doc){rows.push({documentId:text(doc.id),data:clone(typeof doc.data==="function"?doc.data():doc.data||{})});});
    }
    return rows;
  }
  function readLegacyCollection(collectionName,options){
    options=options||{};
    var limit=Math.max(1,Math.min(500,Number(options.limit||PAGE_SIZE)));
    var maxPages=Math.max(1,Math.min(1000,Number(options.maxPages||500)));
    var documents=[],lastId="",pages=0;
    return ensure().then(function(firestore){
      function page(){
        var query=firestore.collection(collectionName);
        if(typeof query.orderBy==="function"){query=query.orderBy(documentIdField(),"asc");}
        if(lastId&&typeof query.startAfter==="function"){query=query.startAfter(lastId);}
        if(typeof query.limit==="function"){query=query.limit(limit);}
        return query.get().then(function(snapshot){
          pages+=1;
          var rows=snapshotRows(snapshot);
          if(!rows.length){return;}
          var next=text(rows[rows.length-1].documentId);
          if(next===lastId){throw new Error("La lectura legacy no avanzó en "+collectionName+".");}
          documents=documents.concat(rows);
          lastId=next;
          if(rows.length>=limit&&pages<maxPages){return page();}
          if(rows.length>=limit&&pages>=maxPages){throw new Error("La lectura legacy alcanzó el límite de páginas en "+collectionName+".");}
        });
      }
      return page();
    }).then(function(){return {collection:collectionName,documents:documents,total:documents.length,pages:pages,lastDocumentId:lastId};});
  }
  function parseAcademic(item){
    var helper=identity(),data=Object.assign({},item&&item.data||{}),parsed=null;
    if(helper&&typeof helper.parseRemoteStudentPeriodId==="function"){parsed=helper.parseRemoteStudentPeriodId(item&&item.documentId||"");}
    if(parsed&&parsed.ok){
      if(!text(data.periodoId)){data.periodoId=parsed.periodoId;}
      if(!text(data.cedula||data.numeroIdentificacion)){data.cedula=parsed.cedula;data.numeroIdentificacion=parsed.cedula;}
    }
    return data;
  }
  function add(map,entity,documentId,document,source){
    if(!text(documentId)||!document){return false;}
    map[entity]=map[entity]||Object.create(null);
    var existing=map[entity][documentId]||null;
    var merged=existing?nonEmptyMerge(existing,document):clone(document);
    merged.id=documentId;
    merged.firebaseDocumentId=documentId;
    map[entity][documentId]=withMeta(entity,merged,source);
    return true;
  }
  function periodDocument(data){
    var helper=identity(),periodoId=helper&&typeof helper.periodOf==="function"?helper.periodOf(data):text(data.periodoId);
    if(!periodoId){return null;}
    return withMeta("periodos",{
      id:periodoId,periodoId:periodoId,
      label:text(data.periodoLabel||data.periodoCanonicoLabel||data.Periodo||data.periodo||periodoId),
      inicio:text(data.inicio||data.fechaInicio),fin:text(data.fin||data.fechaFin),
      tipoPeriodo:text(data.tipoPeriodo||data.periodType),activo:data.activo!==false,
      orden:Number(data.orden||0)
    },"EstudiantesPeriodo");
  }
  function careerDocument(data){
    var code=text(data.CodigoCarrera||data.codigoCarrera||data.codigoCarreraActual);
    var name=text(data.NombreCarrera||data.nombreCarrera||data.Carrera||data.carrera||data.nombreCarreraActual);
    if(!code&&!name){return null;}
    code=code||normalizeKey(name).toUpperCase();
    return withMeta("carreras",{
      id:code,codigoCarrera:code,nombreCarrera:name||code,
      nombreCorto:text(data.nombreCorto),activo:data.carreraActiva!==false,orden:Number(data.ordenCarrera||0)
    },"EstudiantesPeriodo");
  }
  function historyDocument(item,sourceCollection){
    var data=Object.assign({},item&&item.data||{});
    var id="legacy__"+normalizeKey(sourceCollection)+"__"+normalizeKey(item&&item.documentId||hash(data));
    var entityId=text(data.entidadId||data.registroId||data.documentoId||data.idEstudiantePeriodo||data.cedula||item.documentId);
    var created=text(data.createdAt||data.fecha||data.timestamp||data.updatedAt)||now();
    return withMeta("historial",{
      id:id,
      entidad:text(data.entidad||data.tabla||data.tipo||"legacy"),
      entidadId:entityId||id,
      periodoId:text(data.periodoId||data.periodId),
      cedula:text(data.cedula||data.numeroIdentificacion),
      campo:text(data.campo||data.field),
      anterior:data.anterior!==undefined?clone(data.anterior):clone(data.valorAnterior),
      nuevo:data.nuevo!==undefined?clone(data.nuevo):clone(data.valorNuevo),
      accion:text(data.accion||data.action||"MIGRAR_HISTORIAL"),
      usuario:text(data.usuario||data.user),
      pantalla:text(data.pantalla||data.source||sourceCollection),
      metadata:{legacyCollection:sourceCollection,legacyDocumentId:text(item.documentId),legacyData:clone(data)},
      createdAt:created,updatedAt:text(data.updatedAt)||created
    },sourceCollection);
  }
  function buildPlan(raw){
    raw=raw||{};
    var map={
      estudiantes:Object.create(null),matriculas:Object.create(null),requisitos:Object.create(null),notas:Object.create(null),
      periodos:Object.create(null),carreras:Object.create(null),historial:Object.create(null),importaciones:Object.create(null)
    };
    var errors=[],warnings=[];
    var legacyStudents=raw.Estudiantes&&raw.Estudiantes.documents||[];
    var legacyAcademic=raw.EstudiantesPeriodo&&raw.EstudiantesPeriodo.documents||[];

    legacyStudents.forEach(function(item,index){
      try{
        var data=Object.assign({},item.data||{});
        if(!text(data.cedula||data.numeroIdentificacion)){data.cedula=item.documentId;data.numeroIdentificacion=item.documentId;}
        var document=mapper().studentDocument(data);
        if(!document){throw new Error("No se pudo formar estudiante.");}
        add(map,"estudiantes",document.id,document,"Estudiantes");
      }catch(error){errors.push({collection:"Estudiantes",documentId:item.documentId,index:index,error:error.message||String(error)});}
    });

    legacyAcademic.forEach(function(item,index){
      try{
        var data=parseAcademic(item);
        var bundle=mapper().bundle(data,{requirements:data.requisitos||data.requirements||[],notes:data.notas||data.notes||{}});
        if(!bundle||!bundle.ok){throw new Error(bundle&&bundle.errors&&bundle.errors.join(" ")||"No se pudo formar el paquete académico.");}
        Object.keys(bundle.documents).forEach(function(entity){
          var document=bundle.documents[entity];
          if(document){add(map,entity,document.id,document,"EstudiantesPeriodo");}
        });
        var period=periodDocument(data);if(period){add(map,"periodos",period.periodoId,period,"EstudiantesPeriodo");}
        var career=careerDocument(data);if(career){add(map,"carreras",career.codigoCarrera,career,"EstudiantesPeriodo");}
      }catch(error){errors.push({collection:"EstudiantesPeriodo",documentId:item.documentId,index:index,error:error.message||String(error)});}
    });

    ["historial","historial_periodos"].forEach(function(collection){
      ((raw[collection]&&raw[collection].documents)||[]).forEach(function(item,index){
        try{var document=historyDocument(item,collection);add(map,"historial",document.id,document,collection);}
        catch(error){errors.push({collection:collection,documentId:item.documentId,index:index,error:error.message||String(error)});}
      });
    });

    var entities={};
    Object.keys(map).forEach(function(entity){
      entities[entity]=Object.keys(map[entity]).sort().map(function(id){return {documentId:id,document:map[entity][id]};});
    });
    var counts={};Object.keys(entities).forEach(function(entity){counts[entity]=entities[entity].length;});
    var sourceCounts={};Object.keys(raw).forEach(function(collection){sourceCounts[collection]=Number(raw[collection]&&raw[collection].total||0);});
    var fingerprint=hash({sourceCounts:sourceCounts,counts:counts,ids:Object.keys(entities).reduce(function(out,entity){out[entity]=entities[entity].map(function(item){return item.documentId;});return out;},{})});
    if(!counts.estudiantes){warnings.push("La vista previa no produjo estudiantes.");}
    if(!counts.matriculas){warnings.push("La vista previa no produjo matrículas.");}
    return {version:VERSION,createdAt:now(),sourceCounts:sourceCounts,counts:counts,entities:entities,errors:errors,warnings:warnings,fingerprint:fingerprint};
  }
  function backupRows(raw,fingerprint){
    var backupId="firebase_legacy__"+now().replace(/[^0-9]/g,"")+"__"+fingerprint.replace(/^h/,"");
    var rows=[],manifest={
      id:backupId,type:"FIREBASE_LEGACY_MIGRATION",source:"firebase",schemaVersion:VERSION,
      fingerprint:fingerprint,createdAt:now(),updatedAt:now(),collections:{},chunks:[]
    };
    Object.keys(raw).forEach(function(collection){
      var documents=raw[collection]&&raw[collection].documents||[];
      manifest.collections[collection]=documents.length;
      for(var start=0,part=0;start<documents.length;start+=250,part+=1){
        var id=backupId+"__"+normalizeKey(collection)+"__"+part;
        var row={id:id,type:"FIREBASE_LEGACY_MIGRATION_CHUNK",backupId:backupId,collection:collection,part:part,documents:clone(documents.slice(start,start+250)),createdAt:manifest.createdAt,updatedAt:manifest.updatedAt};
        rows.push(row);manifest.chunks.push(id);
      }
    });
    rows.unshift(manifest);
    return {backupId:backupId,manifest:manifest,rows:rows};
  }
  function saveBackup(raw,fingerprint){
    var current=db();
    if(!current||typeof current.bulkPut!=="function"){return Promise.reject(new Error("BL2DB no está disponible para el respaldo."));}
    var backup=backupRows(raw,fingerprint);
    return current.bulkPut("backups",backup.rows).then(function(saved){
      if(!saved||saved.length!==backup.rows.length){throw new Error("El respaldo local no se guardó completamente.");}
      return {ok:true,backupId:backup.backupId,manifest:backup.manifest,records:saved.length};
    });
  }
  function readAllLegacy(options){
    options=options||{};
    var currentSchema=schema();
    var legacy=currentSchema&&currentSchema.legacy&&currentSchema.legacy.collections||{};
    var collections=[
      text(legacy.estudiantes||"Estudiantes"),
      text(legacy.estudiantesPeriodo||"EstudiantesPeriodo"),
      text(legacy.historial||"historial"),
      text(legacy.historialPeriodos||"historial_periodos")
    ].filter(Boolean);
    var raw={};var chain=Promise.resolve();
    collections.forEach(function(collection){
      chain=chain.then(function(){
        return readLegacyCollection(collection,options).then(function(result){raw[collection]=result;});
      });
    });
    return chain.then(function(){return raw;});
  }
  function token(plan){return "migration__"+plan.fingerprint+"__"+Date.now().toString(36);}
  function preview(options){
    if(state.running){return Promise.reject(new Error("Ya existe una operación de migración en curso."));}
    state.running=true;state.operation="preview";state.lastError="";
    var raw=null,plan=null;
    return readAllLegacy(options||{}).then(function(result){raw=result;plan=buildPlan(raw);return saveBackup(raw,plan.fingerprint);}).then(function(backup){
      plan.backup=backup;plan.token=token(plan);plan.expiresAt=new Date(Date.now()+60*60*1000).toISOString();
      state.lastPreview=plan;
      return clone({ok:plan.errors.length===0,version:VERSION,token:plan.token,expiresAt:plan.expiresAt,fingerprint:plan.fingerprint,sourceCounts:plan.sourceCounts,counts:plan.counts,errors:plan.errors,warnings:plan.warnings,backup:plan.backup,destructive:false,legacyDelete:false});
    }).catch(function(error){state.lastError=error.message||String(error);throw error;}).finally(function(){state.running=false;state.operation="";});
  }
  function planByToken(value){
    var plan=state.lastPreview;
    if(!plan||text(plan.token)!==text(value)){throw new Error("La vista previa ya no está disponible. Genere una nueva.");}
    if(Date.parse(plan.expiresAt)<Date.now()){throw new Error("La vista previa expiró. Genere una nueva.");}
    if(!plan.backup||!text(plan.backup.backupId)){throw new Error("La migración no tiene respaldo confirmado.");}
    return plan;
  }
  function remoteMeta(remote){
    if(!remote){return {exists:false};}
    return {exists:true,hash:text(remote.data&&remote.data.dataHash),version:Number(remote.data&&remote.data.version||0),updatedAt:text(remote.data&&remote.data.updatedAt)};
  }
  function saveMigrationConflict(entity,item,remote,reason){
    var current=conflicts();
    if(!current||typeof current.save!=="function"){return Promise.resolve(null);}
    return current.save({
      entidad:entity,documentoId:item.documentId,periodoId:text(item.document.periodoId),cedula:text(item.document.cedula),
      motivo:reason||"MIGRATION_TARGET_DIFFERENT",local:item.document,remote:remote&&remote.data||null,
      expected:{exists:false},changeIds:[],metadata:{migration:true,fingerprint:state.lastPreview&&state.lastPreview.fingerprint}
    });
  }
  function applyItem(entity,item,options){
    options=options||{};var current=repository();
    return current.getById(entity,item.documentId).then(function(remote){
      if(remote&&text(remote.data&&remote.data.dataHash)===text(item.document.dataHash)){
        return {status:"UNCHANGED",entity:entity,documentId:item.documentId};
      }
      if(remote&&options.overwriteExisting!==true){
        return saveMigrationConflict(entity,item,remote,"MIGRATION_TARGET_DIFFERENT").then(function(){return {status:"CONFLICT",entity:entity,documentId:item.documentId};});
      }
      var expected=remoteMeta(remote);
      return current.writeChecked(entity,item.document,{
        documentId:item.documentId,expected:expected,allowUnbasedOverwrite:false,allowRecreate:false
      }).then(function(result){return {status:result.unchanged?"UNCHANGED":"WRITTEN",entity:entity,documentId:item.documentId};}).catch(function(error){
        if(error&&error.code==="FIREBASE_CONFLICT"){
          return saveMigrationConflict(entity,item,{data:error.conflict&&error.conflict.remote},"MIGRATION_ATOMIC_CONFLICT").then(function(){return {status:"CONFLICT",entity:entity,documentId:item.documentId};});
        }
        throw error;
      });
    });
  }
  function apply(previewToken,confirmation,options){
    options=options||{};
    if(text(confirmation)!==CONFIRMATION){return Promise.reject(new Error("La confirmación de migración no coincide."));}
    if(state.running){return Promise.reject(new Error("Ya existe una operación de migración en curso."));}
    var plan=planByToken(previewToken);
    if(plan.errors.length&&options.allowInvalid!==true){return Promise.reject(new Error("La vista previa contiene errores; corrija antes de migrar."));}
    state.running=true;state.operation="apply";state.lastError="";
    var result={ok:true,version:VERSION,fingerprint:plan.fingerprint,backupId:plan.backup.backupId,startedAt:now(),written:0,unchanged:0,conflicts:0,failed:0,byEntity:{},errors:[],legacyDeleted:false};
    var entities=["periodos","carreras","estudiantes","matriculas","requisitos","notas","historial","importaciones"];
    var chain=Promise.resolve();
    entities.forEach(function(entity){
      var items=plan.entities[entity]||[];
      result.byEntity[entity]={total:items.length,written:0,unchanged:0,conflicts:0,failed:0};
      for(var start=0;start<items.length;start+=WRITE_BATCH){
        (function(batch){
          chain=chain.then(function(){
            var inner=Promise.resolve();
            batch.forEach(function(item){
              inner=inner.then(function(){
                return applyItem(entity,item,options).then(function(outcome){
                  var key=outcome.status.toLowerCase();
                  if(key==="written"){result.written+=1;result.byEntity[entity].written+=1;}
                  else if(key==="unchanged"){result.unchanged+=1;result.byEntity[entity].unchanged+=1;}
                  else if(key==="conflict"){result.conflicts+=1;result.byEntity[entity].conflicts+=1;}
                }).catch(function(error){
                  result.failed+=1;result.byEntity[entity].failed+=1;
                  result.errors.push({entity:entity,documentId:item.documentId,error:error.message||String(error)});
                  if(options.continueOnError!==true){throw error;}
                });
              });
            });
            return inner;
          });
        })(items.slice(start,start+WRITE_BATCH));
      }
    });
    return chain.then(function(){
      result.finishedAt=now();result.ok=result.failed===0&&result.conflicts===0;
      result.message=result.ok?"Migración V2 aplicada sin conflictos.":"Migración V2 finalizada con conflictos o errores protegidos.";
      state.lastResult=result;
      try{window.dispatchEvent(new CustomEvent("requisitos:firebase-migration-finished",{detail:clone(result)}));}catch(error){}
      return clone(result);
    }).catch(function(error){state.lastError=error.message||String(error);result.ok=false;result.failed+=1;result.errors.push({error:state.lastError});throw error;}).finally(function(){state.running=false;state.operation="";});
  }
  function status(){
    return {version:VERSION,running:state.running,operation:state.operation,lastError:state.lastError,hasPreview:!!state.lastPreview,lastPreview:state.lastPreview?{token:state.lastPreview.token,fingerprint:state.lastPreview.fingerprint,expiresAt:state.lastPreview.expiresAt,counts:clone(state.lastPreview.counts),backupId:state.lastPreview.backup&&state.lastPreview.backup.backupId}:null,lastResult:clone(state.lastResult),confirmation:CONFIRMATION,destructive:false,legacyDelete:false};
  }

  window.RequisitosFirebaseMigration={
    version:VERSION,confirmation:CONFIRMATION,preview:preview,apply:apply,status:status,
    readLegacyCollection:readLegacyCollection,readAllLegacy:readAllLegacy,buildPlan:buildPlan,
    saveBackup:saveBackup,applyItem:applyItem,
    resetPreview:function(){state.lastPreview=null;state.lastResult=null;return true;}
  };
  try{window.dispatchEvent(new CustomEvent("requisitos:firebase-migration-ready",{detail:{ok:true,version:VERSION,destructive:false,legacyDelete:false}}));}catch(error){}
})(window);
