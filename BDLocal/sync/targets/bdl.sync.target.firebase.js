/* =========================================================
Nombre completo: bdl.sync.target.firebase.js
Ruta o ubicación: /BDLocal/sync/targets/bdl.sync.target.firebase.js
Función o funciones:
- Sincronizar cambios académicos con EstudiantesPeriodo.
- Usar periodoId__cedula como identificador estable del documento.
- Consolidar varios cambios del mismo estudiante en una sola escritura.
- Leer la versión completa más reciente desde Base Local.
- Excluir Telegram y datos personales reservados del documento académico.
- Rechazar documentos parciales y enviar máximo 25 cambios.
- Comprobar la cuota manual antes de ejecutar el batch Firebase.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.6.0-academic-collection";
  var MAX_BATCH_SIZE = 25;
  var TELEGRAM_FIELDS = {
    telegram:true,
    telegramUser:true,
    telegramUsername:true,
    usuarioTelegram:true,
    telegramChatId:true,
    chatIdTelegram:true,
    chatId:true,
    telegramUpdatedAt:true,
    telegramSource:true,
    telegramCheckedAt:true,
    telegramVerifiedAt:true
  };

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function configStore(){ return window.BDLocalConfigStore || null; }
  function firebaseConfig(){ return window.BL2Config && window.BL2Config.firebase || {}; }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePeriod(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g,"__");
  }

  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function payloadOf(row){ return clone(row && (row.payload || row.data || row.registro) || {}); }

  function periodOf(row,options){
    var payload = payloadOf(row);
    return normalizePeriod((row && (row.periodoId || row.periodId)) || payload.periodoId || payload.periodId || (options && options.periodoId));
  }

  function cedulaOf(row){
    var payload = payloadOf(row);
    return normalizeCedula((row && (row.cedula || row.numeroIdentificacion)) || payload.cedula || payload.numeroIdentificacion);
  }

  function documentId(periodoId,cedula){ return normalizePeriod(periodoId) + "__" + normalizeCedula(cedula); }

  function clean(value){
    if(value === undefined || typeof value === "function"){ return null; }
    if(value === null){ return null; }
    if(Array.isArray(value)){ return value.map(clean); }
    if(typeof value === "object"){
      var result = {};
      Object.keys(value).forEach(function(key){
        if(key.charAt(0) === "_" || key === "original"){ return; }
        var item = clean(value[key]);
        if(item !== undefined){ result[key] = item; }
      });
      return result;
    }
    return value;
  }

  function academicCollectionName(){
    var config = firebaseConfig();
    return text(config.academicCollection || config.collection || "EstudiantesPeriodo") || "EstudiantesPeriodo";
  }

  function personCollectionName(){
    var config = firebaseConfig();
    return text(config.personCollection || config.telegramCollection || "Estudiantes") || "Estudiantes";
  }

  function stripTelegramFields(document){
    document = document && typeof document === "object" ? document : {};
    Object.keys(TELEGRAM_FIELDS).forEach(function(field){ delete document[field]; });
    return document;
  }

  function safeRows(rows,options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var requested = Number(options.limit || options.batchSize || MAX_BATCH_SIZE);
    if(!Number.isFinite(requested) || requested <= 0){ requested = MAX_BATCH_SIZE; }
    return rows.slice(0,Math.min(MAX_BATCH_SIZE,Math.floor(requested)));
  }

  function groupChanges(rows,options){
    var groups = Object.create(null);
    var skipped = [];

    safeRows(rows,options).forEach(function(change){
      var periodoId = periodOf(change,options);
      var cedula = cedulaOf(change);
      if(!periodoId || !cedula){
        skipped.push({ id:rowId(change),reason:"Falta período o cédula." });
        return;
      }
      if(options && options.periodoId && normalizePeriod(options.periodoId) !== periodoId){
        skipped.push({ id:rowId(change),reason:"El cambio no pertenece al período seleccionado." });
        return;
      }
      var id = documentId(periodoId,cedula);
      if(!groups[id]){
        groups[id] = { documentId:id,periodoId:periodoId,cedula:cedula,changeIds:[],fallback:null };
      }
      if(rowId(change)){ groups[id].changeIds.push(rowId(change)); }
      var payload = payloadOf(change);
      if(payload && Object.keys(payload).length){ groups[id].fallback = payload; }
    });

    return { groups:Object.keys(groups).map(function(key){ return groups[key]; }),skipped:skipped };
  }

  function fallbackLooksComplete(payload){
    payload = payload || {};
    return !!text(payload.Nombres || payload.nombres || payload.nombreCompleto || payload.NombreCompleto) &&
      !!normalizeCedula(payload.cedula || payload.numeroIdentificacion) &&
      !!normalizePeriod(payload.periodoId || payload.periodoCanonicoId);
  }

  function readLocalStudent(group){
    var core = window.BL2Core;
    if(core && typeof core.getStudentByCedula === "function"){
      return core.getStudentByCedula(group.cedula,group.periodoId).then(function(student){
        if(student){ return student; }
        return fallbackLooksComplete(group.fallback) ? group.fallback : null;
      });
    }
    return Promise.resolve(fallbackLooksComplete(group.fallback) ? group.fallback : null);
  }

  function buildDocument(student,group){
    student = stripTelegramFields(clean(student || {}));
    if(!student || typeof student !== "object"){ return null; }

    var cedula = normalizeCedula(student.cedula || student.numeroIdentificacion || group.cedula);
    var periodoId = normalizePeriod(student.periodoId || student.periodoCanonicoId || group.periodoId);
    var nombres = text(student.Nombres || student.nombres || student.nombreCompleto || student.NombreCompleto);
    if(!cedula || !periodoId || !nombres){ return null; }

    var id = documentId(periodoId,cedula);
    return Object.assign({},student,{
      id:id,
      firebaseDocumentId:id,
      cedula:cedula,
      numeroIdentificacion:text(student.numeroIdentificacion || cedula),
      Nombres:text(student.Nombres || nombres),
      nombres:text(student.nombres || nombres),
      periodoId:periodoId,
      periodoCanonicoId:periodoId,
      periodoLabel:text(student.periodoLabel || student.periodoCanonicoLabel || periodoId),
      periodoCanonicoLabel:text(student.periodoCanonicoLabel || student.periodoLabel || periodoId),
      ultimoPeriodoId:periodoId,
      syncSource:"BDLocal",
      syncTarget:"Firebase",
      syncEntity:"academic_period",
      syncSchemaVersion:"4",
      lastChangeIds:group.changeIds.slice(0,25),
      updatedAt:text(student.updatedAt || now()),
      ultimaSincronizacion:now()
    });
  }

  function prepareDocuments(rows,options){
    var grouped = groupChanges(rows,options);
    return Promise.all(grouped.groups.map(function(group){
      return readLocalStudent(group).then(function(student){
        var document = buildDocument(student,group);
        if(!document){
          grouped.skipped.push({ ids:group.changeIds.slice(),reason:"No se encontró un estudiante académico completo en Base Local." });
          return null;
        }
        return { documentId:document.firebaseDocumentId,document:document,changeIds:group.changeIds.slice() };
      });
    })).then(function(documents){
      return { documents:documents.filter(Boolean),skipped:grouped.skipped };
    });
  }

  function quotaFor(writes){
    var current = configStore();
    if(!current || typeof current.getFirebaseQuotaStatus !== "function"){
      return { allowed:true,level:"sin_control",estimatedOps:Number(writes || 0),message:"Control de cuota no disponible." };
    }
    var quota = current.getFirebaseQuotaStatus(Number(writes || 0)) || {};
    quota.message = quota.allowed
      ? (quota.level === "advertencia" ? "Firebase se aproxima al límite manual." : "Cuota Firebase disponible.")
      : "Firebase bloqueado por cuota manual: " + Number(quota.used || 0) + " / " + Number(quota.limit || 0) + ".";
    return quota;
  }

  function registerUsage(writes){
    try{
      var current = configStore();
      if(current && typeof current.registerFirebaseUsage === "function"){
        current.registerFirebaseUsage({ writes:Number(writes || 0),label:"Subida académica segura BDLocal → EstudiantesPeriodo." });
      }
    }catch(error){}
  }

  function setConnection(ok,error){
    try{
      var current = configStore();
      if(current && typeof current.updateConnectionStatus === "function"){
        current.updateConnectionStatus("firebase",{ connected:!!ok,status:ok ? "ok" : "error",lastError:ok ? "" : text(error) });
      }
    }catch(innerError){}
  }

  function push(pendingRows,options){
    options = Object.assign({},options || {});
    if(options.manual !== true){
      return Promise.resolve({ ok:false,target:"firebase",blocked:true,processedIds:[],message:"Firebase solo admite subida manual." });
    }
    if(!text(options.periodoId)){
      return Promise.resolve({ ok:false,target:"firebase",blocked:true,processedIds:[],message:"Seleccione un período antes de subir a Firebase." });
    }
    if(!window.BL2Sync || typeof window.BL2Sync.ensureFirebase !== "function"){
      return Promise.resolve({ ok:false,target:"firebase",processedIds:[],message:"BL2Sync.ensureFirebase no está disponible." });
    }

    return prepareDocuments(pendingRows,options).then(function(prepared){
      if(!prepared.documents.length){
        return { ok:false,target:"firebase",processedIds:[],skipped:prepared.skipped,message:"No existen documentos académicos completos para enviar." };
      }

      var quota = quotaFor(prepared.documents.length);
      if(quota.allowed === false){
        return {
          ok:false,
          blocked:true,
          quotaBlocked:true,
          target:"firebase",
          processedIds:[],
          skipped:prepared.skipped,
          quota:quota,
          message:quota.message
        };
      }

      return window.BL2Sync.ensureFirebase().then(function(firestore){
        var batch = firestore.batch();
        var collection = firestore.collection(academicCollectionName());
        prepared.documents.forEach(function(item){
          batch.set(collection.doc(item.documentId),item.document,{ merge:true });
        });
        return batch.commit();
      }).then(function(response){
        var processedIds = [];
        prepared.documents.forEach(function(item){ processedIds = processedIds.concat(item.changeIds); });
        registerUsage(prepared.documents.length);
        setConnection(true,"");
        return {
          ok:true,
          target:"firebase",
          collection:academicCollectionName(),
          personCollection:personCollectionName(),
          documents:prepared.documents.length,
          processedIds:processedIds,
          skipped:prepared.skipped,
          quota:quota,
          response:response || {},
          message:"EstudiantesPeriodo actualizado: " + prepared.documents.length + " estudiante(s), " + processedIds.length + " cambio(s) confirmado(s). Telegram no fue modificado." + (quota.level === "advertencia" ? " Advertencia: cuota cercana al límite." : "")
        };
      });
    }).catch(function(error){
      setConnection(false,error.message || String(error));
      return { ok:false,target:"firebase",processedIds:[],message:error.message || String(error) };
    });
  }

  if(window.BDLSyncTargets && typeof window.BDLSyncTargets.register === "function"){
    window.BDLSyncTargets.register("firebase",{
      push:push,
      version:VERSION,
      collection:"EstudiantesPeriodo",
      personCollection:"Estudiantes",
      documentId:"periodoId__cedula",
      telegramExcluded:true
    });
  }

  window.BDLSyncTargetFirebase = {
    version:VERSION,
    push:push,
    safeRows:safeRows,
    groupChanges:groupChanges,
    prepareDocuments:prepareDocuments,
    buildDocument:buildDocument,
    stripTelegramFields:stripTelegramFields,
    documentId:documentId,
    academicCollectionName:academicCollectionName,
    personCollectionName:personCollectionName,
    quotaFor:quotaFor
  };
})(window);
