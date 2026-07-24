/* =========================================================
Nombre completo: bdl.firebase.identity.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.identity.js
Función o funciones:
- Crear y convertir identificadores de estudiante-período.
- Mantener la clave local cedula__periodoId.
- Mantener el documento remoto periodoId__cedula.
- Evitar que las pantallas formen IDs de Firebase directamente.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.1-stable-aliases";

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function config(){
    return window.BL2Config || {};
  }

  function schema(){
    return window.RequisitosFirebaseSchema || null;
  }

  function normalizeCedula(value){
    var utils = config().utils || {};
    if(typeof utils.normalizeCedula === "function"){
      return text(utils.normalizeCedula(value));
    }
    return text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function canonicalPeriodId(value){
    var utils = config().utils || {};
    if(typeof utils.canonicalPeriodId === "function"){
      return text(utils.canonicalPeriodId(value));
    }

    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function cedulaOf(row){
    row = row || {};
    return normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row.identificacion ||
      row.Identificacion ||
      row.Cedula ||
      row["Cédula"] ||
      row._cedula ||
      ""
    );
  }

  function periodOf(row){
    row = row || {};
    return canonicalPeriodId(
      row.periodoId ||
      row.periodId ||
      row.periodoCanonicoId ||
      row.ultimoPeriodoId ||
      row.idPeriodo ||
      row._periodoId ||
      ""
    );
  }

  function makeLocalStudentPeriodId(cedula,periodoId){
    cedula = normalizeCedula(cedula);
    periodoId = canonicalPeriodId(periodoId);

    var currentSchema = schema();
    if(currentSchema && typeof currentSchema.makeLocalStudentPeriodId === "function"){
      return currentSchema.makeLocalStudentPeriodId(cedula,periodoId);
    }

    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }

  function makeRemoteStudentPeriodId(periodoId,cedula){
    cedula = normalizeCedula(cedula);
    periodoId = canonicalPeriodId(periodoId);

    var currentSchema = schema();
    if(currentSchema && typeof currentSchema.makeRemoteStudentPeriodId === "function"){
      return currentSchema.makeRemoteStudentPeriodId(periodoId,cedula);
    }

    return cedula && periodoId ? periodoId + "__" + cedula : "";
  }

  function parseLocalStudentPeriodId(value){
    value = text(value);
    var separator = value.indexOf("__");

    if(separator <= 0){
      return { ok:false,localId:value,cedula:"",periodoId:"" };
    }

    var cedula = normalizeCedula(value.slice(0,separator));
    var periodoId = canonicalPeriodId(value.slice(separator + 2));

    return {
      ok:!!(cedula && periodoId),
      localId:makeLocalStudentPeriodId(cedula,periodoId),
      remoteId:makeRemoteStudentPeriodId(periodoId,cedula),
      cedula:cedula,
      periodoId:periodoId
    };
  }

  function parseRemoteStudentPeriodId(value){
    value = text(value);
    var separator = value.lastIndexOf("__");

    if(separator <= 0){
      return { ok:false,remoteId:value,cedula:"",periodoId:"" };
    }

    var periodoId = canonicalPeriodId(value.slice(0,separator));
    var cedula = normalizeCedula(value.slice(separator + 2));

    return {
      ok:!!(cedula && periodoId),
      localId:makeLocalStudentPeriodId(cedula,periodoId),
      remoteId:makeRemoteStudentPeriodId(periodoId,cedula),
      cedula:cedula,
      periodoId:periodoId
    };
  }

  function identityFromRow(row){
    var cedula = cedulaOf(row);
    var periodoId = periodOf(row);

    return {
      ok:!!(cedula && periodoId),
      cedula:cedula,
      periodoId:periodoId,
      localId:makeLocalStudentPeriodId(cedula,periodoId),
      remoteId:makeRemoteStudentPeriodId(periodoId,cedula)
    };
  }

  function entityDocumentId(entity,row){
    entity = text(entity).toLowerCase();
    row = row || {};

    if(entity === "estudiantes"){
      return cedulaOf(row);
    }

    if(["matriculas","requisitos","notas"].indexOf(entity) >= 0){
      return identityFromRow(row).remoteId;
    }

    if(entity === "periodos"){
      return periodOf(row) || canonicalPeriodId(row.id || row.value || "");
    }

    if(entity === "carreras"){
      return text(
        row.codigoCarrera || row.CodigoCarrera || row.codigo || row.id || ""
      );
    }

    return text(row.id || "");
  }

  function entityLocalId(entity,row){
    entity = text(entity).toLowerCase();
    row = row || {};

    if(entity === "estudiantes"){
      return cedulaOf(row);
    }

    if(["matriculas","requisitos","notas"].indexOf(entity) >= 0){
      return identityFromRow(row).localId;
    }

    return entityDocumentId(entity,row);
  }

  function convertLocalToRemote(localId){
    return parseLocalStudentPeriodId(localId).remoteId || "";
  }

  function convertRemoteToLocal(remoteId){
    return parseRemoteStudentPeriodId(remoteId).localId || "";
  }

  var api = {
    version:VERSION,
    normalizeCedula:normalizeCedula,
    canonicalPeriodId:canonicalPeriodId,
    cedulaOf:cedulaOf,
    periodOf:periodOf,
    makeLocalStudentPeriodId:makeLocalStudentPeriodId,
    makeRemoteStudentPeriodId:makeRemoteStudentPeriodId,
    localStudentPeriodId:makeLocalStudentPeriodId,
    remoteStudentPeriodId:makeRemoteStudentPeriodId,
    parseLocalStudentPeriodId:parseLocalStudentPeriodId,
    parseRemoteStudentPeriodId:parseRemoteStudentPeriodId,
    identityFromRow:identityFromRow,
    entityDocumentId:entityDocumentId,
    entityLocalId:entityLocalId,
    convertLocalToRemote:convertLocalToRemote,
    convertRemoteToLocal:convertRemoteToLocal
  };

  window.RequisitosFirebaseIdentity = api;

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-identity-ready",{
      detail:{ ok:true,version:VERSION,at:new Date().toISOString() }
    }));
  }catch(error){}
})(window);
