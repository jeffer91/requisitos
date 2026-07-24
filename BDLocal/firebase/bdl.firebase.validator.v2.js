/* =========================================================
Nombre completo: bdl.firebase.validator.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.validator.v2.js
Función o funciones:
- Validar documentos de las ocho colecciones oficiales.
- Comprobar identidad, campos obligatorios, fechas y tipos.
- Detectar campos desconocidos sin borrar información.
- Impedir que documentos incompletos entren a IndexedDB o Firebase.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-contract-validator";
  var COMMON_FIELDS = [
    "id","localId","firebaseDocumentId","createdAt","updatedAt","version","dataHash",
    "eliminado","eliminadoEn","syncSource","syncTarget","syncEntity","syncSchemaVersion",
    "ultimaSincronizacion","lastChangeIds"
  ];

  var REQUIRED = {
    estudiantes:["cedula"],
    matriculas:["periodoId","cedula"],
    requisitos:["periodoId","cedula","valores"],
    notas:["periodoId","cedula"],
    periodos:["periodoId","label"],
    carreras:["codigoCarrera","nombreCarrera"],
    historial:["entidad","entidadId","accion","createdAt"],
    importaciones:["periodoId","archivoNombre","createdAt"]
  };

  var NOTE_FIELDS = [
    "notaTeorica","notaPractica","notaComplexivo","notaTeoricaSupletorio",
    "notaPracticaSupletorio","notaSupletorio","notaEscrito","notaDefensaTrabajo",
    "notaTrabajoTitulacion","notaArticulo","notaDefensa","notaFinal","notaOficial",
    "notaMinimaAprobacion"
  ];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function schema(){
    return window.RequisitosFirebaseSchema || null;
  }

  function identity(){
    return window.RequisitosFirebaseIdentity || null;
  }

  function isObject(value){
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function isDateValue(value){
    if(!text(value)){ return false; }
    return !Number.isNaN(Date.parse(value));
  }

  function ownershipFields(entity){
    var current = schema();
    var ownership = current && current.ownership && current.ownership[entity];
    return ownership && Array.isArray(ownership.fields) ? ownership.fields.slice() : [];
  }

  function allowedFields(entity){
    var map = Object.create(null);
    ownershipFields(entity).concat(COMMON_FIELDS).forEach(function(field){
      map[text(field)] = true;
    });

    if(entity === "requisitos"){
      ["observacion","source","origen"].forEach(function(field){ map[field] = true; });
    }

    if(entity === "notas"){
      ["oportunidadAplicada","notaMinimaAprobacion","codigoTitulacion","horarioOrigen"].forEach(function(field){ map[field] = true; });
    }

    if(entity === "historial"){
      ["periodoLabel","metadata","source","origen"].forEach(function(field){ map[field] = true; });
    }

    if(entity === "importaciones"){
      ["archivoTipo","archivoTamano","estado","detalleErrores","source","origen"].forEach(function(field){ map[field] = true; });
    }

    return map;
  }

  function expectedDocumentId(entity,document){
    var helper = identity();
    if(!helper || typeof helper.entityDocumentId !== "function"){ return ""; }
    return text(helper.entityDocumentId(entity,document || {}));
  }

  function validateIdentity(entity,document,documentId,errors,warnings){
    var expected = expectedDocumentId(entity,document);
    var supplied = text(documentId || document && (document.firebaseDocumentId || document.id));

    if(["historial","importaciones"].indexOf(entity) >= 0){
      return;
    }

    if(!expected){
      errors.push("No se pudo construir el identificador oficial del documento.");
      return;
    }

    if(supplied && supplied !== expected){
      errors.push("El ID remoto no coincide con el contenido: se esperaba " + expected + ".");
    }

    if(document && document.localId && ["matriculas","requisitos","notas"].indexOf(entity) >= 0){
      var helper = identity();
      var expectedLocal = helper && typeof helper.entityLocalId === "function"
        ? text(helper.entityLocalId(entity,document))
        : "";
      if(expectedLocal && text(document.localId) !== expectedLocal){
        warnings.push("localId no coincide con la identidad local esperada.");
      }
    }
  }

  function validateRequired(entity,document,errors){
    (REQUIRED[entity] || []).forEach(function(field){
      var value = document && document[field];
      var missing = value === undefined || value === null || (typeof value !== "boolean" && !isObject(value) && !Array.isArray(value) && text(value) === "");
      if(missing){ errors.push("Falta el campo obligatorio " + field + "."); }
    });
  }

  function validateCommon(document,errors,warnings){
    if(document.updatedAt !== undefined && text(document.updatedAt) && !isDateValue(document.updatedAt)){
      errors.push("updatedAt no contiene una fecha válida.");
    }
    if(document.createdAt !== undefined && text(document.createdAt) && !isDateValue(document.createdAt)){
      errors.push("createdAt no contiene una fecha válida.");
    }
    if(document.eliminado === true && !isDateValue(document.eliminadoEn)){
      errors.push("Un documento eliminado debe incluir eliminadoEn válido.");
    }
    if(document.version !== undefined){
      var version = Number(document.version);
      if(!Number.isInteger(version) || version < 1){
        errors.push("version debe ser un entero positivo.");
      }
    }else{
      warnings.push("El documento no incluye version.");
    }
    if(!text(document.dataHash)){
      warnings.push("El documento no incluye dataHash para comparar cambios.");
    }
  }

  function validateEntityTypes(entity,document,errors,warnings){
    if(entity === "requisitos" && !isObject(document.valores)){
      errors.push("valores debe ser un objeto con los requisitos.");
    }

    if(entity === "notas"){
      NOTE_FIELDS.forEach(function(field){
        var value = document[field];
        if(value === undefined || value === null || text(value) === ""){ return; }
        var number = Number(value);
        if(!Number.isFinite(number) || number < 0 || number > 10){
          errors.push(field + " debe ser una nota entre 0 y 10.");
        }
      });
    }

    if(entity === "matriculas"){
      var status = text(document.estadoMatricula).toUpperCase();
      if(status && ["ACTIVO","RETIRADO","NO_APARECE_EN_ULTIMA_CARGA"].indexOf(status) < 0){
        warnings.push("estadoMatricula contiene un valor no reconocido.");
      }
      if(document.retirado === true && status && status !== "RETIRADO"){
        warnings.push("retirado y estadoMatricula no son consistentes.");
      }
    }

    if(entity === "periodos" && document.activo !== undefined && typeof document.activo !== "boolean"){
      errors.push("activo debe ser booleano en periodos.");
    }

    if(entity === "carreras" && document.activo !== undefined && typeof document.activo !== "boolean"){
      errors.push("activo debe ser booleano en carreras.");
    }
  }

  function unknownFields(entity,document){
    var allowed = allowedFields(entity);
    return Object.keys(document || {}).filter(function(field){
      return !allowed[field] && field.charAt(0) !== "_";
    });
  }

  function validate(entity,document,options){
    options = options || {};
    entity = text(entity).toLowerCase();
    document = isObject(document) ? document : {};

    var current = schema();
    var collections = current && current.collections || {};
    var knownEntities = Object.keys(collections);
    var errors = [];
    var warnings = [];

    if(knownEntities.indexOf(entity) < 0){
      errors.push("Entidad Firebase desconocida: " + entity + ".");
    }

    validateRequired(entity,document,errors);
    validateIdentity(entity,document,options.documentId,errors,warnings);
    validateCommon(document,errors,warnings);
    validateEntityTypes(entity,document,errors,warnings);

    var unknown = unknownFields(entity,document);
    if(unknown.length){
      warnings.push("Campos no declarados: " + unknown.join(", ") + ".");
    }

    return {
      ok:errors.length === 0,
      entity:entity,
      documentId:text(options.documentId || document.firebaseDocumentId || document.id),
      expectedDocumentId:expectedDocumentId(entity,document),
      errors:errors,
      warnings:warnings,
      unknownFields:unknown,
      version:VERSION
    };
  }

  function validateMany(entity,documents,options){
    documents = Array.isArray(documents) ? documents : [];
    options = options || {};

    var results = documents.map(function(item,index){
      var data = item && item.data && isObject(item.data) ? item.data : item;
      var documentId = item && (item.documentId || item.id) || "";
      return validate(entity,data,{ documentId:documentId,index:index });
    });

    return {
      ok:results.every(function(result){ return result.ok; }),
      entity:text(entity).toLowerCase(),
      total:results.length,
      valid:results.filter(function(result){ return result.ok; }).length,
      invalid:results.filter(function(result){ return !result.ok; }).length,
      results:results,
      version:VERSION
    };
  }

  function assertValid(entity,document,options){
    var result = validate(entity,document,options || {});
    if(!result.ok){
      throw new Error("Documento " + entity + " inválido: " + result.errors.join(" "));
    }
    return result;
  }

  window.RequisitosFirebaseValidator = {
    version:VERSION,
    validate:validate,
    validateMany:validateMany,
    assertValid:assertValid,
    expectedDocumentId:expectedDocumentId,
    unknownFields:unknownFields
  };

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-validator-ready",{
      detail:{ ok:true,version:VERSION,at:new Date().toISOString() }
    }));
  }catch(error){}
})(window);
