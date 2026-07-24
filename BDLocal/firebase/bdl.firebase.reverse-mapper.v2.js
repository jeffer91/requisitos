/* =========================================================
Nombre completo: bdl.firebase.reverse-mapper.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.reverse-mapper.v2.js
Función o funciones:
- Convertir documentos Firebase V2 a registros de IndexedDB.
- Expandir un documento de requisitos en filas locales por requisito.
- Mantener metadatos remotos sin crear cambios pendientes.
- Validar antes de preparar cualquier escritura local.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-firebase-to-local";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function identity(){
    return window.RequisitosFirebaseIdentity || null;
  }

  function validator(){
    return window.RequisitosFirebaseValidator || null;
  }

  function normalizeKey(value){
    var utils = window.BL2Config && window.BL2Config.utils || {};
    if(typeof utils.normalizeKey === "function"){
      return text(utils.normalizeKey(value));
    }
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"_")
      .replace(/^_+|_+$/g,"");
  }

  function baseMeta(entity,document,documentId){
    return {
      _firebaseEntity:entity,
      _firebaseDocumentId:text(documentId || document && (document.firebaseDocumentId || document.id)),
      _firebaseDataHash:text(document && document.dataHash),
      _firebaseVersion:Number(document && document.version || 1),
      _firebaseUpdatedAt:text(document && document.updatedAt),
      _firebaseDeleted:document && document.eliminado === true,
      _firebaseImportedAt:new Date().toISOString(),
      _syncSource:"firebase_pull",
      _skipOutbox:true
    };
  }

  function localPerson(document,documentId){
    var helper = identity();
    var cedula = helper ? helper.cedulaOf(document) : text(document.cedula);
    if(!cedula){ return []; }

    return [{
      store:"personas",
      row:Object.assign({},baseMeta("estudiantes",document,documentId),{
        id:cedula,
        cedula:cedula,
        numeroIdentificacion:cedula,
        nombreCompleto:text(document.nombres || document.nombreCompleto),
        nombres:text(document.nombres || document.nombreCompleto),
        correoPersonal:text(document.correoPersonal),
        correoInstitucional:text(document.correoInstitucional),
        celular:text(document.celular),
        telegramUser:text(document.telegramUser).replace(/^@+/,""),
        telegramChatId:text(document.telegramChatId),
        sede:text(document.sede),
        codigoCarreraActual:text(document.codigoCarreraActual),
        nombreCarreraActual:text(document.nombreCarreraActual),
        createdAt:text(document.createdAt),
        updatedAt:text(document.updatedAt),
        eliminado:document.eliminado === true,
        eliminadoEn:text(document.eliminadoEn)
      })
    }];
  }

  function localEnrollment(document,documentId){
    var helper = identity();
    var current = helper ? helper.identityFromRow(document) : null;
    if(!current || !current.ok){ return []; }

    return [{
      store:"matriculas_periodo",
      row:Object.assign({},baseMeta("matriculas",document,documentId),{
        id:current.localId,
        idEstudiantePeriodo:current.localId,
        studentId:current.localId,
        periodo_cedula:current.periodoId + "__" + current.cedula,
        periodoId:current.periodoId,
        periodId:current.periodoId,
        cedula:current.cedula,
        numeroIdentificacion:current.cedula,
        codigoCarrera:text(document.codigoCarrera),
        carreraKey:normalizeKey(document.codigoCarrera || document.nombreCarrera),
        nombreCarrera:text(document.nombreCarrera),
        NombreCarrera:text(document.nombreCarrera),
        sede:text(document.sede),
        Sede:text(document.sede),
        division:text(document.division),
        divisionKey:normalizeKey(document.division),
        estadoMatricula:text(document.estadoMatricula || (document.retirado ? "RETIRADO" : "ACTIVO")).toUpperCase(),
        retirado:document.retirado === true,
        retiradoEn:text(document.retiradoEn),
        modalidadTitulacion:text(document.modalidadTitulacion),
        createdAt:text(document.createdAt),
        updatedAt:text(document.updatedAt),
        eliminado:document.eliminado === true,
        eliminadoEn:text(document.eliminadoEn)
      })
    }];
  }

  function localRequirements(document,documentId){
    var helper = identity();
    var current = helper ? helper.identityFromRow(document) : null;
    var values = document && document.valores;
    if(!current || !current.ok || !values || typeof values !== "object" || Array.isArray(values)){
      return [];
    }

    var rows = Object.keys(values).map(function(name){
      var key = normalizeKey(name);
      var requirementId = current.localId + "__" + key;
      var value = values[name];

      return {
        store:"requisitos_estudiante",
        row:Object.assign({},baseMeta("requisitos",document,documentId),{
          id:requirementId,
          requisitoId:requirementId,
          idEstudiantePeriodo:current.localId,
          studentId:current.localId,
          periodo_cedula:current.periodoId + "__" + current.cedula,
          periodoId:current.periodoId,
          periodId:current.periodoId,
          cedula:current.cedula,
          numeroIdentificacion:current.cedula,
          requisitoKey:key,
          requirementKey:key,
          requisitoLabel:text(name),
          label:text(name),
          valor:value,
          estado:value,
          estadoKey:normalizeKey(value),
          observaciones:text(document.observaciones),
          createdAt:text(document.createdAt),
          updatedAt:text(document.updatedAt),
          eliminado:document.eliminado === true,
          eliminadoEn:text(document.eliminadoEn)
        })
      };
    });

    if(!rows.length && document.eliminado === true){
      rows.push({
        store:"requisitos_estudiante",
        row:Object.assign({},baseMeta("requisitos",document,documentId),{
          id:current.localId + "__documento_eliminado",
          idEstudiantePeriodo:current.localId,
          periodoId:current.periodoId,
          cedula:current.cedula,
          requisitoKey:"documento_eliminado",
          valor:"",
          eliminado:true,
          eliminadoEn:text(document.eliminadoEn),
          updatedAt:text(document.updatedAt)
        })
      });
    }

    return rows;
  }

  function localNotes(document,documentId){
    var helper = identity();
    var current = helper ? helper.identityFromRow(document) : null;
    if(!current || !current.ok){ return []; }

    var row = Object.assign({},clone(document),baseMeta("notas",document,documentId),{
      id:current.localId,
      notaId:current.localId,
      idEstudiantePeriodo:current.localId,
      studentId:current.localId,
      periodo_cedula:current.periodoId + "__" + current.cedula,
      periodoId:current.periodoId,
      periodId:current.periodoId,
      cedula:current.cedula,
      numeroIdentificacion:current.cedula,
      createdAt:text(document.createdAt),
      updatedAt:text(document.updatedAt),
      eliminado:document.eliminado === true,
      eliminadoEn:text(document.eliminadoEn)
    });

    delete row.localId;
    delete row.firebaseDocumentId;

    return [{ store:"notas_titulacion",row:row }];
  }

  function localPeriod(document,documentId){
    var helper = identity();
    var periodoId = helper ? helper.periodOf(document) : text(document.periodoId || document.id);
    if(!periodoId){ return []; }

    return [{
      store:"periodos",
      row:Object.assign({},baseMeta("periodos",document,documentId),{
        id:periodoId,
        periodoId:periodoId,
        value:periodoId,
        label:text(document.label || document.periodoLabel || periodoId),
        periodoLabel:text(document.label || document.periodoLabel || periodoId),
        inicio:text(document.inicio),
        fin:text(document.fin),
        tipoPeriodo:text(document.tipoPeriodo),
        activo:document.activo !== false,
        orden:Number(document.orden || 0),
        createdAt:text(document.createdAt),
        updatedAt:text(document.updatedAt),
        eliminado:document.eliminado === true,
        eliminadoEn:text(document.eliminadoEn)
      })
    }];
  }

  function localCareer(document,documentId){
    var code = text(document.codigoCarrera || document.id);
    if(!code){ return []; }

    return [{
      store:"cache_views",
      row:Object.assign({},baseMeta("carreras",document,documentId),{
        id:"catalogo_carrera__" + code,
        viewKey:"catalogo:carreras:" + code,
        periodoId:"",
        tipo:"catalogo_carrera",
        codigoCarrera:code,
        nombreCarrera:text(document.nombreCarrera),
        nombreCorto:text(document.nombreCorto),
        activo:document.activo !== false,
        orden:Number(document.orden || 0),
        createdAt:text(document.createdAt),
        updatedAt:text(document.updatedAt),
        eliminado:document.eliminado === true,
        eliminadoEn:text(document.eliminadoEn)
      })
    }];
  }

  function localHistory(document,documentId){
    var id = text(documentId || document.id) || "historial__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    return [{
      store:"logs",
      row:Object.assign({},baseMeta("historial",document,documentId),clone(document),{
        id:id,
        logId:id,
        nivel:text(document.nivel || "INFO"),
        tipo:"HISTORIAL_FIREBASE",
        createdAt:text(document.createdAt) || new Date().toISOString()
      })
    }];
  }

  function localImport(document,documentId){
    var id = text(documentId || document.id) || "importacion__" + Date.now() + "__" + Math.random().toString(16).slice(2);
    return [{
      store:"importaciones",
      row:Object.assign({},baseMeta("importaciones",document,documentId),clone(document),{
        id:id,
        importacionId:id,
        periodoId:text(document.periodoId),
        createdAt:text(document.createdAt) || new Date().toISOString(),
        updatedAt:text(document.updatedAt || document.createdAt) || new Date().toISOString()
      })
    }];
  }

  var CONVERTERS = {
    estudiantes:localPerson,
    matriculas:localEnrollment,
    requisitos:localRequirements,
    notas:localNotes,
    periodos:localPeriod,
    carreras:localCareer,
    historial:localHistory,
    importaciones:localImport
  };

  function toLocal(entity,document,options){
    options = options || {};
    entity = text(entity).toLowerCase();
    document = document && typeof document === "object" ? clone(document) : {};
    var documentId = text(options.documentId || document.firebaseDocumentId || document.id);
    var check = validator() && typeof validator().validate === "function"
      ? validator().validate(entity,document,{ documentId:documentId })
      : { ok:true,errors:[],warnings:[] };

    if(!check.ok && options.allowInvalid !== true){
      return {
        ok:false,
        entity:entity,
        documentId:documentId,
        records:[],
        stores:{},
        validation:check,
        errors:check.errors.slice(),
        version:VERSION
      };
    }

    var converter = CONVERTERS[entity];
    if(typeof converter !== "function"){
      return {
        ok:false,
        entity:entity,
        documentId:documentId,
        records:[],
        stores:{},
        validation:check,
        errors:["No existe convertidor local para " + entity + "."],
        version:VERSION
      };
    }

    var records = converter(document,documentId);
    var stores = {};
    records.forEach(function(item){
      if(!stores[item.store]){ stores[item.store] = []; }
      stores[item.store].push(item.row);
    });

    return {
      ok:records.length > 0,
      entity:entity,
      documentId:documentId,
      records:records,
      stores:stores,
      validation:check,
      errors:records.length ? [] : ["El documento no produjo registros locales."],
      version:VERSION
    };
  }

  function toLocalMany(entity,documents,options){
    documents = Array.isArray(documents) ? documents : [];
    options = options || {};
    var stores = {};
    var results = documents.map(function(item){
      var data = item && item.data && typeof item.data === "object" ? item.data : item;
      var documentId = item && (item.documentId || item.id) || "";
      var result = toLocal(entity,data,Object.assign({},options,{ documentId:documentId }));
      Object.keys(result.stores || {}).forEach(function(store){
        if(!stores[store]){ stores[store] = []; }
        stores[store] = stores[store].concat(result.stores[store]);
      });
      return result;
    });

    return {
      ok:results.every(function(result){ return result.ok; }),
      entity:text(entity).toLowerCase(),
      total:results.length,
      converted:results.filter(function(result){ return result.ok; }).length,
      rejected:results.filter(function(result){ return !result.ok; }).length,
      stores:stores,
      results:results,
      version:VERSION
    };
  }

  window.RequisitosFirebaseReverseMapper = {
    version:VERSION,
    toLocal:toLocal,
    toLocalMany:toLocalMany,
    converters:CONVERTERS
  };

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-reverse-mapper-ready",{
      detail:{ ok:true,version:VERSION,at:new Date().toISOString() }
    }));
  }catch(error){}
})(window);
