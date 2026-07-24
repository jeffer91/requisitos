/* =========================================================
Nombre completo: bdl.firebase.schema.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.schema.v2.js
Función o funciones:
- Definir las colecciones oficiales de la app Requisitos.
- Mantener Firebase como fuente oficial y BDLocal como caché.
- Centralizar identificadores, fechas de cambio y borrado lógico.
- Conservar compatibilidad con la sincronización antigua durante la migración.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-firebase-primary-schema";

  var schema = {
    version:VERSION,
    sourceOfTruth:"firebase",
    localRole:"cache",
    googleRole:"export",
    collections:{
      estudiantes:"estudiantes",
      matriculas:"matriculas",
      requisitos:"requisitos",
      notas:"notas",
      periodos:"periodos",
      carreras:"carreras",
      historial:"historial",
      importaciones:"importaciones"
    },
    documentIds:{
      estudiantes:"cedula",
      matriculas:"periodoId__cedula",
      requisitos:"periodoId__cedula",
      notas:"periodoId__cedula",
      periodos:"periodoId",
      carreras:"codigoCarrera",
      historial:"auto",
      importaciones:"auto"
    },
    identity:{
      personField:"cedula",
      periodField:"periodoId",
      updatedAtField:"updatedAt",
      createdAtField:"createdAt",
      deletedField:"eliminado",
      deletedAtField:"eliminadoEn",
      versionField:"version"
    },
    synchronization:{
      initialDownload:"global",
      incrementalDownload:true,
      incrementalField:"updatedAt",
      uploadOnlyChanges:true,
      softDelete:true,
      directScreenAccess:false,
      localOutbox:"cambios_pendientes",
      conflictStrategy:"updatedAt_then_version"
    },
    legacy:{
      enabled:true,
      readOnlyDuringMigration:true,
      collections:{
        estudiantes:"Estudiantes",
        estudiantesPeriodo:"EstudiantesPeriodo",
        estudiantesPersona:"estudiantes_persona",
        historialPeriodos:"historial_periodos"
      }
    }
  };

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function applyToConfig(){
    var config = window.BL2Config = window.BL2Config || {};
    var firebase = config.firebase = config.firebase || {};

    firebase.schemaV2 = clone(schema);
    firebase.sourceOfTruth = "firebase";
    firebase.localRole = "cache";
    firebase.googleRole = "export";
    firebase.collections = Object.assign({},schema.collections);
    firebase.documentIds = Object.assign({},schema.documentIds);
    firebase.incrementalField = schema.identity.updatedAtField;
    firebase.softDelete = true;

    /*
     * No se cambian todavía academicCollection y personCollection.
     * Esos nombres antiguos siguen activos únicamente mientras se migra
     * el sincronizador y los datos existentes sin pérdida de información.
     */

    return firebase;
  }

  window.RequisitosFirebaseSchema = schema;
  applyToConfig();

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-schema-v2-ready",{
      detail:{
        ok:true,
        version:VERSION,
        sourceOfTruth:schema.sourceOfTruth,
        localRole:schema.localRole,
        collections:clone(schema.collections),
        at:new Date().toISOString()
      }
    }));
  }catch(error){}
})(window);
