/* =========================================================
Nombre completo: bl2.config.v2.js
Ruta o ubicación: /BDLocal/bl2.config.v2.js
Función o funciones:
- Configurar DB_VERSION 2 sin borrar tablas existentes.
- Declarar las trece tablas oficiales V2.
- Reutilizar tablas V2 para resumen, errores y metadatos legacy.
- Centralizar índices esperados para diagnóstico y mantenimiento.
- Separar Firebase personal de Firebase académico sin tocar credenciales.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.2.0-firebase-split";
  var config = window.BL2Config = window.BL2Config || {};
  var stores = config.stores = config.stores || {};

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value,fallback){ value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function defineStore(key,value){ stores[key] = text(stores[key] || value); return stores[key]; }
  function unique(list){ var seen = Object.create(null); return (list || []).filter(function(item){ item = text(item); if(!item || seen[item]){ return false; } seen[item] = true; return true; }); }

  config.version = "2";
  config.dbVersion = Math.max(num(config.dbVersion,1),2);
  config.schemaVersion = text(config.schemaVersion || "2");

  /* Stores generales y legacy que siguen siendo compatibles. */
  defineStore("settings","settings");
  defineStore("periodos","periodos");
  defineStore("estudiantes","estudiantes");
  defineStore("requisitos","requisitos");
  defineStore("contactos","contactos");
  defineStore("notas","notas");
  defineStore("cambios","cambios");
  defineStore("logs","logs");
  defineStore("backups","backups");

  /* Trece stores oficiales V2. */
  defineStore("periodosCarreras","periodos_carreras");
  defineStore("periodosDivisiones","periodos_divisiones");
  defineStore("personas","personas");
  defineStore("matriculasPeriodo","matriculas_periodo");
  defineStore("requisitosEstudiante","requisitos_estudiante");
  defineStore("notasTitulacion","notas_titulacion");
  defineStore("contactosEstudiante","contactos_estudiante");
  defineStore("divisionesEstudiante","divisiones_estudiante");
  defineStore("importaciones","importaciones");
  defineStore("cambiosPendientes","cambios_pendientes");
  defineStore("syncEstado","sync_estado");
  defineStore("erroresValidacion","errores_validacion");
  defineStore("cacheViews","cache_views");

  stores.resumen = stores.cacheViews;
  stores.errores = stores.erroresValidacion;
  stores.syncMeta = stores.syncEstado;

  var requiredGeneralKeys = [
    "settings","periodos","estudiantes","requisitos","contactos",
    "notas","cambios","logs","backups"
  ];

  var requiredV2Keys = [
    "periodosCarreras","periodosDivisiones","personas","matriculasPeriodo",
    "requisitosEstudiante","notasTitulacion","contactosEstudiante",
    "divisionesEstudiante","importaciones","cambiosPendientes",
    "syncEstado","erroresValidacion","cacheViews"
  ];

  var requiredKeys = requiredGeneralKeys.concat(requiredV2Keys);

  config.dbV2 = Object.assign({},config.dbV2 || {},{
    enabled:true,
    version:2,
    configVersion:VERSION,
    createdAt:config.dbV2 && config.dbV2.createdAt ? config.dbV2.createdAt : "2026-07-07",
    updatedAt:new Date().toISOString(),
    destructive:false,
    requiredStoreKeys:requiredKeys.slice(),
    requiredV2StoreKeys:requiredV2Keys.slice(),
    aliases:{ resumen:stores.resumen,errores:stores.errores,syncMeta:stores.syncMeta },
    note:"DB_VERSION 2 mantiene nueve stores generales/legacy y trece stores V2: veintidós tablas físicas."
  });

  config.dbV2.requiredStores = unique(requiredKeys.map(function(key){ return stores[key]; }));
  config.dbV2.requiredV2Stores = unique(requiredV2Keys.map(function(key){ return stores[key]; }));

  config.dbV2.indexes = {
    periodosCarreras:["periodoId","carreraKey","updatedAt"],
    periodosDivisiones:["periodoId","divisionKey","updatedAt"],
    personas:["nombreKey","nombreCompleto","updatedAt"],
    matriculasPeriodo:["periodoId","cedula","periodo_cedula","estadoMatricula","carreraKey","divisionKey","updatedAt"],
    requisitosEstudiante:["idEstudiantePeriodo","periodoId","cedula","periodo_cedula","requisitoKey","estadoKey","updatedAt"],
    notasTitulacion:["periodoId","cedula","periodo_cedula","estadoDefensaKey","updatedAt"],
    contactosEstudiante:["idEstudiantePeriodo","periodoId","cedula","periodo_cedula","tipoKey","updatedAt"],
    divisionesEstudiante:["idEstudiantePeriodo","periodoId","cedula","periodo_cedula","divisionKey","updatedAt"],
    importaciones:["periodoId","source","createdAt","updatedAt"],
    cambiosPendientes:["status","target","status_target","periodoId","cedula","tabla","createdAt","updatedAt"],
    syncEstado:["target","periodoId","target_periodo","updatedAt"],
    erroresValidacion:["periodoId","cedula","tipo","createdAt","updatedAt"],
    cacheViews:["viewKey","periodoId","updatedAt"]
  };

  /*
   * Firebase queda separado por responsabilidad:
   * - Estudiantes/{cedula}: persona y Telegram.
   * - EstudiantesPeriodo/{periodoId__cedula}: datos académicos.
   * `collection` conserva compatibilidad y apunta siempre al destino académico.
   */
  config.firebase = Object.assign({},config.firebase || {},{
    enabled:true,
    manualOnly:true,
    automatic:false,
    collection:"EstudiantesPeriodo",
    academicCollection:"EstudiantesPeriodo",
    personCollection:"Estudiantes",
    telegramCollection:"Estudiantes",
    documentIdStrategy:"periodoId__cedula",
    academicDocumentIdStrategy:"periodoId__cedula",
    personDocumentIdStrategy:"cedula",
    excludeTelegramFromAcademic:true,
    telegramFields:[
      "telegramUser","telegramChatId","telegramUpdatedAt",
      "telegramSource","telegramCheckedAt","telegramVerifiedAt"
    ],
    batchSize:25,
    maxBatchSize:25,
    deleteAllowed:false,
    previewBeforePull:true,
    backupBeforePull:true,
    protectLocalPending:true
  });

  function requiredStores(){ return config.dbV2.requiredStores.slice(); }
  function requiredV2Stores(){ return config.dbV2.requiredV2Stores.slice(); }

  function missingRequiredStoreNames(storeNames){
    var present = Object.create(null);
    (Array.isArray(storeNames) ? storeNames : []).forEach(function(name){ present[text(name)] = true; });
    return requiredStores().filter(function(name){ return !present[text(name)]; });
  }

  function hasRequiredStoreNames(storeNames){ return missingRequiredStoreNames(storeNames).length === 0; }

  function isConfigReady(){
    return !!config.stores && Number(config.dbVersion || 0) >= 2 && requiredV2Stores().length === requiredV2Keys.length && requiredStores().length === 22;
  }

  config.dbV2.requiredStoresList = requiredStores;
  config.dbV2.requiredV2StoresList = requiredV2Stores;
  config.dbV2.hasRequiredStoreNames = hasRequiredStoreNames;
  config.dbV2.missingRequiredStoreNames = missingRequiredStoreNames;
  config.dbV2.isConfigReady = isConfigReady;

  window.BL2Config = config;

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:config-v2-ready",{
      detail:{
        ok:true,
        version:VERSION,
        dbVersion:config.dbVersion,
        physicalStores:requiredStores(),
        v2Stores:requiredV2Stores(),
        aliases:config.dbV2.aliases,
        firebase:{
          personCollection:config.firebase.personCollection,
          academicCollection:config.firebase.academicCollection,
          academicDocumentIdStrategy:config.firebase.academicDocumentIdStrategy
        }
      }
    }));
  }catch(error){}
})(window);
