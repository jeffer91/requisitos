/* =========================================================
Nombre completo: bdl.firebase.schema.v2.js
Ruta o ubicación: /BDLocal/firebase/bdl.firebase.schema.v2.js
Función o funciones:
- Definir las colecciones oficiales de la app Requisitos.
- Mantener Firebase como fuente oficial y BDLocal como caché.
- Separar explícitamente las claves locales de los IDs remotos.
- Definir la responsabilidad de cada colección y sus campos principales.
- Conservar las colecciones antiguas únicamente durante la migración.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.1.0-firebase-contract";

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

    /*
     * Firestore conserva período primero para facilitar consultas,
     * migración desde EstudiantesPeriodo y lectura por período.
     */
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

    /*
     * IndexedDB conserva la identidad que ya utiliza la app.
     * La diferencia de orden es intencional y la resuelve el adaptador.
     */
    localIds:{
      estudiantes:"cedula",
      matriculas:"cedula__periodoId",
      requisitos:"cedula__periodoId",
      notas:"cedula__periodoId",
      periodos:"periodoId",
      carreras:"codigoCarrera",
      historial:"auto",
      importaciones:"auto"
    },

    identity:{
      personField:"cedula",
      periodField:"periodoId",
      localStudentPeriodSeparator:"__",
      remoteStudentPeriodSeparator:"__",
      updatedAtField:"updatedAt",
      createdAtField:"createdAt",
      deletedField:"eliminado",
      deletedAtField:"eliminadoEn",
      versionField:"version",
      hashField:"dataHash"
    },

    ownership:{
      estudiantes:{
        description:"Información personal y carrera actual del estudiante.",
        fields:[
          "cedula","nombres","correoPersonal","correoInstitucional","celular",
          "telegramUser","telegramChatId","sede","codigoCarreraActual",
          "nombreCarreraActual","createdAt","updatedAt","version","dataHash"
        ]
      },
      matriculas:{
        description:"Participación del estudiante dentro de un período específico.",
        fields:[
          "periodoId","cedula","codigoCarrera","nombreCarrera","sede","division",
          "estadoMatricula","retirado","retiradoEn","modalidadTitulacion",
          "createdAt","updatedAt","version","dataHash"
        ]
      },
      requisitos:{
        description:"Todos los estados de requisitos del estudiante en un período.",
        fields:[
          "periodoId","cedula","valores","observaciones","createdAt","updatedAt",
          "version","dataHash"
        ]
      },
      notas:{
        description:"Notas y resultados de titulación del estudiante en un período.",
        fields:[
          "periodoId","cedula","modalidadTitulacion","notaTeorica","notaPractica",
          "notaComplexivo","notaTeoricaSupletorio","notaPracticaSupletorio",
          "notaSupletorio","notaEscrito","notaDefensaTrabajo","notaTrabajoTitulacion",
          "notaArticulo","notaDefensa","notaFinal","notaOficial","estadoEvaluacion",
          "createdAt","updatedAt","version","dataHash"
        ]
      },
      periodos:{
        description:"Catálogo oficial de períodos disponibles.",
        fields:[
          "periodoId","label","inicio","fin","tipoPeriodo","activo","orden",
          "createdAt","updatedAt"
        ]
      },
      carreras:{
        description:"Catálogo oficial para normalizar códigos y nombres de carreras.",
        fields:[
          "codigoCarrera","nombreCarrera","nombreCorto","activo","orden",
          "createdAt","updatedAt"
        ]
      },
      historial:{
        description:"Auditoría de cambios importantes realizados en la información.",
        fields:[
          "entidad","entidadId","periodoId","cedula","campo","anterior","nuevo",
          "accion","usuario","pantalla","createdAt"
        ]
      },
      importaciones:{
        description:"Registro de archivos cargados y sus resultados.",
        fields:[
          "periodoId","archivoNombre","archivoHash","totalFilas","nuevos","actualizados",
          "sinCambios","retirados","errores","usuario","createdAt","updatedAt"
        ]
      }
    },

    synchronization:{
      initialDownload:"global",
      incrementalDownload:true,
      incrementalField:"updatedAt",
      uploadOnlyChanges:true,
      compareByHash:true,
      softDelete:true,
      directScreenAccess:false,
      localOutbox:"cambios_pendientes",
      localSyncState:"sync_estado",
      conflictStrategy:"updatedAt_then_version",
      screenReadsFrom:"indexeddb",
      screenWritesTo:"indexeddb_then_outbox"
    },

    migration:{
      phase:"CONTRACT_DEFINED",
      destructive:false,
      deleteLegacyCollections:false,
      requireBackupBeforeDataMove:true,
      requireCountComparison:true,
      requireScreenValidation:true
    },

    legacy:{
      enabled:true,
      readOnlyDuringMigration:true,
      collections:{
        estudiantes:"Estudiantes",
        estudiantesPeriodo:"EstudiantesPeriodo",
        estudiantesPersona:"estudiantes_persona",
        historial:"historial",
        historialPeriodos:"historial_periodos"
      }
    }
  };

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function makeLocalStudentPeriodId(cedula,periodoId){
    cedula = String(cedula == null ? "" : cedula).trim();
    periodoId = String(periodoId == null ? "" : periodoId).trim();
    return cedula && periodoId ? cedula + "__" + periodoId : "";
  }

  function makeRemoteStudentPeriodId(periodoId,cedula){
    periodoId = String(periodoId == null ? "" : periodoId).trim();
    cedula = String(cedula == null ? "" : cedula).trim();
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

  function applyToConfig(){
    var config = window.BL2Config = window.BL2Config || {};
    var firebase = config.firebase = config.firebase || {};

    firebase.schemaV2 = clone(schema);
    firebase.sourceOfTruth = schema.sourceOfTruth;
    firebase.localRole = schema.localRole;
    firebase.googleRole = schema.googleRole;
    firebase.collections = Object.assign({},schema.collections);
    firebase.documentIds = Object.assign({},schema.documentIds);
    firebase.localIds = Object.assign({},schema.localIds);
    firebase.incrementalField = schema.identity.updatedAtField;
    firebase.softDelete = schema.synchronization.softDelete;

    /*
     * academicCollection y personCollection antiguos permanecen activos
     * hasta que el nuevo sincronizador y la migración hayan sido validados.
     */

    return firebase;
  }

  schema.makeLocalStudentPeriodId = makeLocalStudentPeriodId;
  schema.makeRemoteStudentPeriodId = makeRemoteStudentPeriodId;

  window.RequisitosFirebaseSchema = schema;
  applyToConfig();

  try{
    window.dispatchEvent(new CustomEvent("requisitos:firebase-schema-v2-ready",{
      detail:{
        ok:true,
        version:VERSION,
        sourceOfTruth:schema.sourceOfTruth,
        localRole:schema.localRole,
        migrationPhase:schema.migration.phase,
        collections:clone(schema.collections),
        at:new Date().toISOString()
      }
    }));
  }catch(error){}
})(window);
