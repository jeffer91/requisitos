/* =========================================================
Archivo: bl2.config.v2.js
Ruta: /BDLocal/bl2.config.v2.js
Función:
- Subir configuración de IndexedDB a DB_VERSION 2.
- Declarar tablas oficiales nuevas sin borrar tablas actuales.
- Centralizar nombres de stores V2 para repositorios, servicios, sync y diagnósticos.
- Exponer helpers para validar si la configuración V2 está lista.
Con qué se conecta:
- BDLocal/bl2.config.js
- BDLocal/bl2.db.js
- BDLocal/repositories/*
- BDLocal/services/*
- BDLocal/diagnostics/bdl.final.health.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.1-safe-config";
  var config = window.BL2Config = window.BL2Config || {};
  var stores = config.stores = config.stores || {};

  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value, fallback){ value = Number(value); return isFinite(value) ? value : fallback; }
  function defineStore(key, value){ stores[key] = text(stores[key] || value); return stores[key]; }

  config.version = config.version || "2";
  config.dbVersion = Math.max(num(config.dbVersion, 1), 2);
  config.schemaVersion = text(config.schemaVersion || "2");

  /* Stores legacy que deben seguir existiendo. */
  defineStore("periodos", "periodos");
  defineStore("estudiantes", "estudiantes");
  defineStore("requisitos", "requisitos");
  defineStore("contactos", "contactos");
  defineStore("notas", "notas");
  defineStore("cambios", "cambios");
  defineStore("logs", "logs");
  defineStore("backups", "backups");

  /* Stores oficiales V2. */
  defineStore("periodosCarreras", "periodos_carreras");
  defineStore("periodosDivisiones", "periodos_divisiones");
  defineStore("personas", "personas");
  defineStore("matriculasPeriodo", "matriculas_periodo");
  defineStore("requisitosEstudiante", "requisitos_estudiante");
  defineStore("notasTitulacion", "notas_titulacion");
  defineStore("contactosEstudiante", "contactos_estudiante");
  defineStore("divisionesEstudiante", "divisiones_estudiante");
  defineStore("importaciones", "importaciones");
  defineStore("cambiosPendientes", "cambios_pendientes");
  defineStore("syncEstado", "sync_estado");
  defineStore("erroresValidacion", "errores_validacion");
  defineStore("cacheViews", "cache_views");

  var requiredV2Keys = [
    "personas",
    "matriculasPeriodo",
    "requisitosEstudiante",
    "notasTitulacion",
    "contactosEstudiante",
    "divisionesEstudiante",
    "cambiosPendientes",
    "syncEstado",
    "cacheViews"
  ];

  config.dbV2 = Object.assign({}, config.dbV2 || {}, {
    enabled: true,
    version: 2,
    configVersion: VERSION,
    createdAt: config.dbV2 && config.dbV2.createdAt ? config.dbV2.createdAt : "2026-07-07",
    updatedAt: new Date().toISOString(),
    destructive: false,
    requiredStoreKeys: requiredV2Keys.slice(),
    note: "DB_VERSION 2 agrega tablas nuevas sin borrar tablas actuales."
  });

  config.dbV2.requiredStores = requiredV2Keys.map(function(key){ return stores[key]; }).filter(Boolean);

  config.dbV2.indexes = Object.assign({}, config.dbV2.indexes || {}, {
    personas: ["cedula", "nombreKey"],
    matriculasPeriodo: ["periodoId", "cedula", "periodo_cedula", "estadoMatricula", "carreraKey", "divisionKey"],
    requisitosEstudiante: ["periodoId", "cedula", "periodo_cedula", "requisitoKey", "estadoKey"],
    notasTitulacion: ["periodoId", "cedula", "periodo_cedula", "estadoDefensaKey"],
    contactosEstudiante: ["periodoId", "cedula", "periodo_cedula", "tipoKey"],
    cambiosPendientes: ["status", "target", "status_target", "createdAt", "periodoId", "cedula"],
    syncEstado: ["target", "periodoId", "updatedAt"],
    cacheViews: ["viewKey", "periodoId", "updatedAt"]
  });

  function requiredStores(){ return config.dbV2.requiredStores.slice(); }

  function hasRequiredStoreNames(storeNames){
    storeNames = Array.isArray(storeNames) ? storeNames : [];
    var map = {};
    storeNames.forEach(function(name){ map[text(name)] = true; });
    return requiredStores().every(function(name){ return !!map[text(name)]; });
  }

  function missingRequiredStoreNames(storeNames){
    storeNames = Array.isArray(storeNames) ? storeNames : [];
    var map = {};
    storeNames.forEach(function(name){ map[text(name)] = true; });
    return requiredStores().filter(function(name){ return !map[text(name)]; });
  }

  function isConfigReady(){
    return !!config.stores && Number(config.dbVersion || 0) >= 2 && requiredStores().length === requiredV2Keys.length;
  }

  config.dbV2.requiredStoresList = requiredStores;
  config.dbV2.hasRequiredStoreNames = hasRequiredStoreNames;
  config.dbV2.missingRequiredStoreNames = missingRequiredStoreNames;
  config.dbV2.isConfigReady = isConfigReady;

  window.BL2Config = config;

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:config-v2-ready", {
      detail: {
        ok: true,
        version: VERSION,
        dbVersion: config.dbVersion,
        stores: requiredStores()
      }
    }));
  }catch(error){}
})(window);