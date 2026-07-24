/* =========================================================
Nombre completo: bdl.firebase.repository.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.repository.v2.js
Función o funciones:
- Ser la única puerta de acceso a las colecciones Firebase V2.
- Validar documentos antes de escribir.
- Consultar descargas completas o incrementales por updatedAt.
- Preparar registros de IndexedDB mediante el mapeador inverso.
- No ejecutar lecturas ni escrituras automáticamente al cargarse.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-central-repository";
  var DEFAULT_LIMIT = 250;
  var MAX_BATCH = 400;
  var state = {
    firestore:null,
    readyPromise:null,
    reads:0,
    writes:0,
    lastError:"",
    lastOperationAt:""
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function schema(){
    return window.RequisitosFirebaseSchema || null;
  }

  function identity(){
    return window.RequisitosFirebaseIdentity || null;
  }

  function validator(){
    return window.RequisitosFirebaseValidator || null;
  }

  function mapper(){
    return window.RequisitosFirebaseMapper || null;
  }

  function reverseMapper(){
    return window.RequisitosFirebaseReverseMapper || null;
  }

  function collectionName(entity){
    entity = text(entity).toLowerCase();
    var current = schema();
    var name = current && current.collections && current.collections[entity];
    if(!text(name)){ throw new Error("Colección Firebase desconocida: " + entity + "."); }
    return text(name);
  }

  function ensureFirestore(){
    if(state.firestore){ return Promise.resolve(state.firestore); }
    if(state.readyPromise){ return state.readyPromise; }

    state.readyPromise = Promise.resolve().then(function(){
      if(window.BL2Sync && typeof window.BL2Sync.ensureFirebase === "function"){
        return window.BL2Sync.ensureFirebase();
      }

      if(window.firebase && typeof window.firebase.firestore === "function"){
        return window.firebase.firestore();
      }

      throw new Error("Firebase Firestore no está disponible.");
    }).then(function(firestore){
      if(!firestore || typeof firestore.collection !== "function"){
        throw new Error("La instancia obtenida no es Firestore compatible.");
      }
      state.firestore = firestore;
      state.lastError = "";
      state.lastOperationAt = nowISO();
      return firestore;
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      throw error;
    }).finally(function(){
      state.readyPromise = null;
    });

    return state.readyPromise;
  }

  function documentId(entity,document,explicitId){
    explicitId = text(explicitId);
    if(explicitId){ return explicitId; }
    var helper = identity();
    if(helper && typeof helper.entityDocumentId === "function"){
      return text(helper.entityDocumentId(entity,document || {}));
    }
    return text(document && document.id);
  }

  function validateDocument(entity,document,explicitId){
    var helper = validator();
    if(!helper || typeof helper.validate !== "function"){
      throw new Error("RequisitosFirebaseValidator no está disponible.");
    }
    return helper.validate(entity,document || {},{
      documentId:documentId(entity,document,explicitId)
    });
  }

  function prepareWrite(entity,document,options){
    options = options || {};
    entity = text(entity).toLowerCase();
    document = clone(document || {});

    var id = documentId(entity,document,options.documentId);
    if(!id && ["historial","importaciones"].indexOf(entity) < 0){
      throw new Error("No se pudo formar el ID para " + entity + ".");
    }

    var stamp = nowISO();
    if(!text(document.createdAt)){ document.createdAt = stamp; }
    document.updatedAt = text(options.updatedAt || document.updatedAt) || stamp;
    document.version = Math.max(1,Number(document.version || 1));
    document.eliminado = document.eliminado === true;
    if(!document.eliminado){ document.eliminadoEn = text(document.eliminadoEn || ""); }

    if(id){
      document.id = id;
      document.firebaseDocumentId = id;
    }

    var check = validateDocument(entity,document,id);
    if(!check.ok){
      throw new Error("Documento " + entity + " inválido: " + check.errors.join(" "));
    }

    return {
      entity:entity,
      collection:collectionName(entity),
      documentId:id,
      document:document,
      validation:check
    };
  }

  function snapshotRows(snapshot){
    var rows = [];
    if(!snapshot){ return rows; }

    if(Array.isArray(snapshot.docs)){
      snapshot.docs.forEach(function(doc){
        var data = doc && typeof doc.data === "function" ? doc.data() : doc && doc.data || {};
        rows.push({ documentId:text(doc && doc.id),data:clone(data || {}) });
      });
      return rows;
    }

    if(typeof snapshot.forEach === "function"){
      snapshot.forEach(function(doc){
        var data = doc && typeof doc.data === "function" ? doc.data() : doc && doc.data || {};
        rows.push({ documentId:text(doc && doc.id),data:clone(data || {}) });
      });
    }

    return rows;
  }

  function list(entity,options){
    options = options || {};
    entity = text(entity).toLowerCase();
    var limit = Math.max(1,Math.min(1000,Number(options.limit || DEFAULT_LIMIT)));
    var since = text(options.updatedAfter || options.since || "");
    var includeDeleted = options.includeDeleted === true;

    return ensureFirestore().then(function(firestore){
      var query = firestore.collection(collectionName(entity));

      if(since && typeof query.where === "function"){
        query = query.where("updatedAt",">",since);
      }
      if(since && typeof query.orderBy === "function"){
        query = query.orderBy("updatedAt","asc");
      }
      if(typeof query.limit === "function"){
        query = query.limit(limit);
      }
      if(!query || typeof query.get !== "function"){
        throw new Error("La consulta Firestore no admite get().");
      }

      return query.get();
    }).then(function(snapshot){
      state.reads += 1;
      state.lastOperationAt = nowISO();
      state.lastError = "";

      var documents = snapshotRows(snapshot).filter(function(item){
        return includeDeleted || item.data.eliminado !== true;
      });

      return {
        ok:true,
        entity:entity,
        collection:collectionName(entity),
        incremental:!!since,
        since:since,
        total:documents.length,
        documents:documents,
        readAt:nowISO(),
        version:VERSION
      };
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      throw error;
    });
  }

  function getById(entity,id){
    entity = text(entity).toLowerCase();
    id = text(id);
    if(!id){ return Promise.resolve(null); }

    return ensureFirestore().then(function(firestore){
      return firestore.collection(collectionName(entity)).doc(id).get();
    }).then(function(snapshot){
      state.reads += 1;
      state.lastOperationAt = nowISO();
      if(!snapshot || snapshot.exists === false){ return null; }
      var data = typeof snapshot.data === "function" ? snapshot.data() : snapshot.data || {};
      return { documentId:text(snapshot.id || id),data:clone(data) };
    });
  }

  function write(entity,document,options){
    options = options || {};
    var prepared = prepareWrite(entity,document,options);

    return ensureFirestore().then(function(firestore){
      var collection = firestore.collection(prepared.collection);
      var reference = prepared.documentId ? collection.doc(prepared.documentId) : collection.doc();
      var finalId = prepared.documentId || text(reference.id);
      var payload = Object.assign({},prepared.document,{
        id:finalId,
        firebaseDocumentId:finalId
      });

      var check = validateDocument(prepared.entity,payload,finalId);
      if(!check.ok){
        throw new Error("Documento " + prepared.entity + " inválido: " + check.errors.join(" "));
      }

      return reference.set(payload,{ merge:options.merge !== false }).then(function(){
        state.writes += 1;
        state.lastOperationAt = nowISO();
        state.lastError = "";
        return {
          ok:true,
          entity:prepared.entity,
          collection:prepared.collection,
          documentId:finalId,
          document:clone(payload),
          validation:check,
          writtenAt:nowISO(),
          version:VERSION
        };
      });
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      throw error;
    });
  }

  function writeMany(entity,documents,options){
    options = options || {};
    documents = Array.isArray(documents) ? documents : [];
    if(!documents.length){
      return Promise.resolve({ ok:true,entity:text(entity).toLowerCase(),written:0,documents:[],version:VERSION });
    }
    if(documents.length > MAX_BATCH){
      return Promise.reject(new Error("El lote supera el máximo seguro de " + MAX_BATCH + " documentos."));
    }

    var prepared = documents.map(function(document){
      return prepareWrite(entity,document,options);
    });

    return ensureFirestore().then(function(firestore){
      if(typeof firestore.batch !== "function"){
        throw new Error("Firestore no admite escrituras por lote.");
      }

      var batch = firestore.batch();
      prepared.forEach(function(item){
        var collection = firestore.collection(item.collection);
        var reference = item.documentId ? collection.doc(item.documentId) : collection.doc();
        var finalId = item.documentId || text(reference.id);
        item.documentId = finalId;
        item.document.id = finalId;
        item.document.firebaseDocumentId = finalId;
        batch.set(reference,item.document,{ merge:options.merge !== false });
      });

      return batch.commit();
    }).then(function(){
      state.writes += prepared.length;
      state.lastOperationAt = nowISO();
      state.lastError = "";
      return {
        ok:true,
        entity:text(entity).toLowerCase(),
        collection:prepared[0] && prepared[0].collection || collectionName(entity),
        written:prepared.length,
        documents:prepared.map(function(item){
          return { documentId:item.documentId,document:clone(item.document) };
        }),
        writtenAt:nowISO(),
        version:VERSION
      };
    }).catch(function(error){
      state.lastError = error && error.message ? error.message : String(error);
      throw error;
    });
  }

  function softDelete(entity,document,options){
    options = Object.assign({},options || {});
    var payload = Object.assign({},document || {},{
      eliminado:true,
      eliminadoEn:nowISO(),
      updatedAt:nowISO(),
      version:Math.max(1,Number(document && document.version || 1)) + 1
    });
    return write(entity,payload,options);
  }

  function prepareLocalBundle(row,options){
    var current = mapper();
    if(!current || typeof current.bundle !== "function"){
      throw new Error("RequisitosFirebaseMapper no está disponible.");
    }
    return current.bundle(row || {},options || {});
  }

  function prepareLocalRecords(entity,documents,options){
    var current = reverseMapper();
    if(!current || typeof current.toLocalMany !== "function"){
      throw new Error("RequisitosFirebaseReverseMapper no está disponible.");
    }
    return current.toLocalMany(entity,documents || [],options || {});
  }

  function pull(entity,options){
    return list(entity,options || {}).then(function(result){
      return Object.assign({},result,{
        local:prepareLocalRecords(entity,result.documents,options || {})
      });
    });
  }

  function status(){
    return {
      ok:!state.lastError,
      ready:!!state.firestore,
      loading:!!state.readyPromise,
      reads:state.reads,
      writes:state.writes,
      lastError:state.lastError,
      lastOperationAt:state.lastOperationAt,
      version:VERSION
    };
  }

  window.RequisitosFirebaseRepository = {
    version:VERSION,
    ensureFirestore:ensureFirestore,
    collectionName:collectionName,
    documentId:documentId,
    validateDocument:validateDocument,
    prepareWrite:prepareWrite,
    list:list,
    getById:getById,
    write:write,
    writeMany:writeMany,
    softDelete:softDelete,
    pull:pull,
    prepareLocalBundle:prepareLocalBundle,
    prepareLocalRecords:prepareLocalRecords,
    status:status,
    reset:function(){ state.firestore=null;state.readyPromise=null;state.lastError=""; }
  };

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-repository-ready",{
      detail:{ ok:true,version:VERSION,automatic:false,at:nowISO() }
    }));
  }catch(error){}
})(window);
