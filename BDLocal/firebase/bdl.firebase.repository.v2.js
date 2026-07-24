/* =========================================================
Nombre completo: bdl.firebase.repository.v2.js
Ruta: /BDLocal/firebase/bdl.firebase.repository.v2.js
Función:
- Ser la única puerta de acceso a Firebase V2.
- Paginar por updatedAt + documentId sin perder empates.
- Filtrar por período las colecciones académicas.
- Contabilizar consultas y documentos leídos por separado.
- Escribir con verificación atómica de versión/hash cuando sea posible.
- No ejecutar operaciones automáticamente al cargarse.
========================================================= */
(function(window){
  "use strict";

  var VERSION="1.1.0-safe-cursor-conflicts";
  var DEFAULT_LIMIT=250;
  var MAX_BATCH=400;
  var PERIOD_SCOPED={matriculas:true,requisitos:true,notas:true};
  var state={
    firestore:null,readyPromise:null,
    queryCount:0,readDocuments:0,writes:0,
    conflicts:0,lastError:"",lastOperationAt:""
  };

  function text(value){return String(value==null?"":value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}
  function nowISO(){return new Date().toISOString();}
  function schema(){return window.RequisitosFirebaseSchema||null;}
  function identity(){return window.RequisitosFirebaseIdentity||null;}
  function validator(){return window.RequisitosFirebaseValidator||null;}
  function mapper(){return window.RequisitosFirebaseMapper||null;}
  function reverseMapper(){return window.RequisitosFirebaseReverseMapper||null;}
  function periodScoped(entity){return PERIOD_SCOPED[text(entity).toLowerCase()]===true;}
  function collectionName(entity){
    entity=text(entity).toLowerCase();
    var current=schema();var name=current&&current.collections&&current.collections[entity];
    if(!text(name)){throw new Error("Colección Firebase desconocida: "+entity+".");}
    return text(name);
  }
  function ensureFirestore(){
    if(state.firestore){return Promise.resolve(state.firestore);}
    if(state.readyPromise){return state.readyPromise;}
    state.readyPromise=Promise.resolve().then(function(){
      if(window.BL2Sync&&typeof window.BL2Sync.ensureFirebase==="function"){return window.BL2Sync.ensureFirebase();}
      if(window.firebase&&typeof window.firebase.firestore==="function"){return window.firebase.firestore();}
      throw new Error("Firebase Firestore no está disponible.");
    }).then(function(firestore){
      if(!firestore||typeof firestore.collection!=="function"){throw new Error("La instancia obtenida no es Firestore compatible.");}
      state.firestore=firestore;state.lastError="";state.lastOperationAt=nowISO();return firestore;
    }).catch(function(error){state.lastError=error&&error.message?error.message:String(error);throw error;})
      .finally(function(){state.readyPromise=null;});
    return state.readyPromise;
  }
  function documentId(entity,document,explicitId){
    explicitId=text(explicitId);if(explicitId){return explicitId;}
    var helper=identity();
    if(helper&&typeof helper.entityDocumentId==="function"){return text(helper.entityDocumentId(entity,document||{}));}
    return text(document&&document.id);
  }
  function validateDocument(entity,document,explicitId){
    var helper=validator();if(!helper||typeof helper.validate!=="function"){throw new Error("RequisitosFirebaseValidator no está disponible.");}
    return helper.validate(entity,document||{},{documentId:documentId(entity,document,explicitId)});
  }
  function prepareWrite(entity,document,options){
    options=options||{};entity=text(entity).toLowerCase();document=clone(document||{});
    var id=documentId(entity,document,options.documentId);
    if(!id&&["historial","importaciones"].indexOf(entity)<0){throw new Error("No se pudo formar el ID para "+entity+".");}
    var stamp=nowISO();
    if(!text(document.createdAt)){document.createdAt=stamp;}
    document.updatedAt=text(options.updatedAt||document.updatedAt)||stamp;
    document.version=Math.max(1,Number(document.version||1));
    document.eliminado=document.eliminado===true;
    document.eliminadoEn=document.eliminado?(text(document.eliminadoEn)||document.updatedAt):"";
    if(id){document.id=id;document.firebaseDocumentId=id;}
    var check=validateDocument(entity,document,id);
    if(!check.ok){throw new Error("Documento "+entity+" inválido: "+check.errors.join(" "));}
    return {entity:entity,collection:collectionName(entity),documentId:id,document:document,validation:check};
  }
  function snapshotRows(snapshot){
    var rows=[];if(!snapshot){return rows;}
    function add(doc){
      var data=doc&&typeof doc.data==="function"?doc.data():doc&&doc.data||{};
      rows.push({documentId:text(doc&&doc.id),data:clone(data||{})});
    }
    if(Array.isArray(snapshot.docs)){snapshot.docs.forEach(add);return rows;}
    if(typeof snapshot.forEach==="function"){snapshot.forEach(add);}
    return rows;
  }
  function tuple(item){return {updatedAt:text(item&&item.data&&item.data.updatedAt),documentId:text(item&&item.documentId)};}
  function compareTuple(a,b){
    a=a||{};b=b||{};
    var date=text(a.updatedAt).localeCompare(text(b.updatedAt));
    return date!==0?date:text(a.documentId).localeCompare(text(b.documentId));
  }
  function normalizeCursor(options){
    options=options||{};var source=options.cursor||{};
    if(typeof source==="string"){source={updatedAt:source};}
    return {
      updatedAt:text(source.updatedAt||source.lastCursor||options.updatedAfter||options.since||""),
      documentId:text(source.documentId||source.lastDocumentId||options.afterDocumentId||"")
    };
  }
  function documentIdField(){
    try{
      if(window.firebase&&window.firebase.firestore&&window.firebase.firestore.FieldPath&&typeof window.firebase.firestore.FieldPath.documentId==="function"){
        return window.firebase.firestore.FieldPath.documentId();
      }
    }catch(error){}
    return "__name__";
  }
  function applyQuery(query,entity,options,cursor){
    var periodoId=text(options.periodoId||"");
    if(periodScoped(entity)&&periodoId&&typeof query.where==="function"){query=query.where("periodoId","==",periodoId);}
    if(typeof query.orderBy==="function"){
      query=query.orderBy("updatedAt","asc");
      query=query.orderBy(documentIdField(),"asc");
    }
    if(cursor.updatedAt&&cursor.documentId&&typeof query.startAfter==="function"){
      query=query.startAfter(cursor.updatedAt,cursor.documentId);
    }else if(cursor.updatedAt&&typeof query.where==="function"){
      query=query.where("updatedAt",">=",cursor.updatedAt);
    }
    if(typeof query.limit==="function"){query=query.limit(options.limit);}
    return query;
  }
  function list(entity,options){
    options=Object.assign({},options||{});entity=text(entity).toLowerCase();
    options.limit=Math.max(1,Math.min(1000,Number(options.limit||DEFAULT_LIMIT)));
    var cursor=normalizeCursor(options);var includeDeleted=options.includeDeleted===true;
    return ensureFirestore().then(function(firestore){
      var query=applyQuery(firestore.collection(collectionName(entity)),entity,options,cursor);
      if(!query||typeof query.get!=="function"){throw new Error("La consulta Firestore no admite get().");}
      return query.get();
    }).then(function(snapshot){
      state.queryCount+=1;state.lastOperationAt=nowISO();state.lastError="";
      var all=snapshotRows(snapshot).sort(function(a,b){return compareTuple(tuple(a),tuple(b));});
      state.readDocuments+=all.length;
      var documents=all.filter(function(item){
        if(cursor.updatedAt&&compareTuple(tuple(item),cursor)<=0){return false;}
        return includeDeleted||item.data.eliminado!==true;
      });
      var last=documents.length?tuple(documents[documents.length-1]):cursor;
      return {
        ok:true,entity:entity,collection:collectionName(entity),incremental:!!cursor.updatedAt,
        periodoId:text(options.periodoId),cursorBefore:clone(cursor),cursorAfter:clone(last),
        total:documents.length,documents:documents,hasMore:all.length>=options.limit,
        readAt:nowISO(),version:VERSION
      };
    }).catch(function(error){state.lastError=error&&error.message?error.message:String(error);throw error;});
  }
  function getById(entity,id){
    entity=text(entity).toLowerCase();id=text(id);if(!id){return Promise.resolve(null);}
    return ensureFirestore().then(function(firestore){return firestore.collection(collectionName(entity)).doc(id).get();})
      .then(function(snapshot){
        state.queryCount+=1;state.lastOperationAt=nowISO();
        if(!snapshot||snapshot.exists===false){return null;}
        state.readDocuments+=1;
        var data=typeof snapshot.data==="function"?snapshot.data():snapshot.data||{};
        return {documentId:text(snapshot.id||id),data:clone(data)};
      });
  }
  function remoteMatchesExpected(remote,expected){
    expected=expected||{};remote=remote||null;
    if(expected.exists===false){return !remote;}
    if(!remote){return expected.exists!==true&&!text(expected.hash)&&!Number(expected.version)&&!text(expected.updatedAt);}
    if(text(expected.hash)&&text(remote.dataHash)!==text(expected.hash)){return false;}
    if(Number(expected.version)>0&&Number(remote.version||0)!==Number(expected.version)){return false;}
    if(text(expected.updatedAt)&&text(remote.updatedAt)!==text(expected.updatedAt)){return false;}
    return true;
  }
  function conflictError(entity,id,remote,local,expected){
    var error=new Error("Conflicto de sincronización en "+entity+"/"+id+".");
    error.code="FIREBASE_CONFLICT";
    error.conflict={entity:entity,documentId:id,remote:clone(remote),local:clone(local),expected:clone(expected||{})};
    return error;
  }
  function writeChecked(entity,document,options){
    options=options||{};var prepared=prepareWrite(entity,document,options);var expected=clone(options.expected||{});
    return ensureFirestore().then(function(firestore){
      var reference=firestore.collection(prepared.collection).doc(prepared.documentId);
      function decide(remote,writer){
        var local=clone(prepared.document);var same=remote&&text(remote.dataHash)&&text(remote.dataHash)===text(local.dataHash);
        if(same){return {ok:true,unchanged:true,entity:prepared.entity,collection:prepared.collection,documentId:prepared.documentId,document:clone(remote),version:VERSION};}
        var baselineKnown=expected.exists!==undefined||text(expected.hash)||Number(expected.version)>0||text(expected.updatedAt);
        if(remote&&baselineKnown&&!remoteMatchesExpected(remote,expected)){throw conflictError(prepared.entity,prepared.documentId,remote,local,expected);}
        if(remote&&!baselineKnown&&options.allowUnbasedOverwrite!==true){throw conflictError(prepared.entity,prepared.documentId,remote,local,expected);}
        if(!remote&&expected.exists===true&&options.allowRecreate!==true){throw conflictError(prepared.entity,prepared.documentId,remote,local,expected);}
        local.createdAt=text(remote&&remote.createdAt)||text(local.createdAt)||nowISO();
        local.updatedAt=nowISO();
        local.version=Math.max(Number(local.version||1),Number(remote&&remote.version||0)+1);
        writer(local);
        return {ok:true,unchanged:false,entity:prepared.entity,collection:prepared.collection,documentId:prepared.documentId,document:clone(local),version:VERSION};
      }
      if(typeof firestore.runTransaction==="function"){
        return firestore.runTransaction(function(transaction){
          return transaction.get(reference).then(function(snapshot){
            var remote=snapshot&&snapshot.exists!==false?(typeof snapshot.data==="function"?snapshot.data():snapshot.data||{}):null;
            return decide(remote,function(payload){transaction.set(reference,payload,{merge:false});});
          });
        });
      }
      return reference.get().then(function(snapshot){
        state.queryCount+=1;
        var remote=snapshot&&snapshot.exists!==false?(typeof snapshot.data==="function"?snapshot.data():snapshot.data||{}):null;
        if(remote){state.readDocuments+=1;}
        var decision=decide(remote,function(){});
        if(decision.unchanged){return decision;}
        return reference.set(decision.document,{merge:false}).then(function(){return decision;});
      });
    }).then(function(result){
      if(!result.unchanged){state.writes+=1;}
      state.lastOperationAt=nowISO();state.lastError="";return result;
    }).catch(function(error){
      if(error&&error.code==="FIREBASE_CONFLICT"){state.conflicts+=1;}
      state.lastError=error&&error.message?error.message:String(error);throw error;
    });
  }
  function writeManyChecked(entity,entries,options){
    entries=Array.isArray(entries)?entries:[];options=options||{};
    if(entries.length>MAX_BATCH){return Promise.reject(new Error("El lote supera el máximo seguro de "+MAX_BATCH+" documentos."));}
    var results=[];var conflicts=[];var chain=Promise.resolve();
    entries.forEach(function(entry){
      chain=chain.then(function(){
        var document=entry&&entry.document?entry.document:entry;
        var currentOptions=Object.assign({},options,entry&&entry.options||{}, {
          documentId:entry&&entry.documentId||options.documentId,
          expected:entry&&entry.expected||options.expected
        });
        return writeChecked(entity,document,currentOptions).then(function(result){results.push(result);})
          .catch(function(error){
            if(error&&error.code==="FIREBASE_CONFLICT"){conflicts.push(error.conflict);return;}
            throw error;
          });
      });
    });
    return chain.then(function(){
      return {ok:conflicts.length===0,entity:text(entity).toLowerCase(),written:results.filter(function(item){return !item.unchanged;}).length,
        unchanged:results.filter(function(item){return item.unchanged;}).length,results:results,conflicts:conflicts,version:VERSION};
    });
  }
  function write(entity,document,options){options=Object.assign({allowUnbasedOverwrite:true},options||{});return writeChecked(entity,document,options);}
  function writeMany(entity,documents,options){
    documents=Array.isArray(documents)?documents:[];
    return writeManyChecked(entity,documents.map(function(document){return {document:document};}),Object.assign({allowUnbasedOverwrite:true},options||{}));
  }
  function softDelete(entity,document,options){
    var payload=Object.assign({},document||{},{eliminado:true,eliminadoEn:nowISO(),updatedAt:nowISO(),version:Math.max(1,Number(document&&document.version||1))+1});
    return writeChecked(entity,payload,options||{});
  }
  function prepareLocalBundle(row,options){
    var current=mapper();if(!current||typeof current.bundle!=="function"){throw new Error("RequisitosFirebaseMapper no está disponible.");}
    return current.bundle(row||{},options||{});
  }
  function prepareLocalRecords(entity,documents,options){
    var current=reverseMapper();if(!current||typeof current.toLocalMany!=="function"){throw new Error("RequisitosFirebaseReverseMapper no está disponible.");}
    return current.toLocalMany(entity,documents||[],options||{});
  }
  function pull(entity,options){return list(entity,options||{}).then(function(result){return Object.assign({},result,{local:prepareLocalRecords(entity,result.documents,options||{})});});}
  function status(){return {ok:!state.lastError,ready:!!state.firestore,loading:!!state.readyPromise,queries:state.queryCount,
    reads:state.readDocuments,readDocuments:state.readDocuments,writes:state.writes,conflicts:state.conflicts,
    lastError:state.lastError,lastOperationAt:state.lastOperationAt,version:VERSION};}

  window.RequisitosFirebaseRepository={
    version:VERSION,ensureFirestore:ensureFirestore,collectionName:collectionName,documentId:documentId,
    validateDocument:validateDocument,prepareWrite:prepareWrite,list:list,getById:getById,
    write:write,writeMany:writeMany,writeChecked:writeChecked,writeManyChecked:writeManyChecked,
    softDelete:softDelete,pull:pull,prepareLocalBundle:prepareLocalBundle,prepareLocalRecords:prepareLocalRecords,
    periodScoped:periodScoped,normalizeCursor:normalizeCursor,compareTuple:compareTuple,status:status,
    reset:function(){state.firestore=null;state.readyPromise=null;state.lastError="";}
  };
  try{window.dispatchEvent(new CustomEvent("requisitos:firebase-repository-ready",{detail:{ok:true,version:VERSION,at:nowISO()}}));}catch(error){}
})(window);
