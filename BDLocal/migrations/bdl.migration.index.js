/* =========================================================
Archivo: bdl.migration.index.js
Ruta: /BDLocal/migrations/bdl.migration.index.js
Función:
- Crear el punto de entrada de migraciones de BDLocal.
- Registrar migraciones seguras sin ejecutar cambios destructivos automáticamente.
- Declarar DB_VERSION 2 como migración de esquema no destructiva.
Con qué se conecta:
- BDLocal/bl2.config.v2.js
- BDLocal/bl2.db.js
- BDLocal/diagnostics/bdl.diagnostics.general.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.2.0-block11";
  var migrations = [];

  function text(value){ return String(value == null ? "" : value).trim(); }

  function normalizeMigration(versionOrMigration, migration){
    if(typeof versionOrMigration === "object" && !migration){
      return Object.assign({}, versionOrMigration);
    }
    return Object.assign({ version: text(versionOrMigration) }, migration || {});
  }

  function register(versionOrMigration, migration){
    var item = normalizeMigration(versionOrMigration, migration);
    item.version = text(item.version);
    if(!item.version){ return false; }
    if(!item.run){ item.run = function(){ return Promise.resolve(item.status ? item.status() : item); }; }

    var exists = migrations.some(function(current){ return text(current.version) === item.version; });
    if(exists){ return false; }

    migrations.push(item);
    migrations.sort(function(a, b){ return text(a.version).localeCompare(text(b.version)); });
    return true;
  }

  function list(){ return migrations.slice(); }

  function currentDbVersion(){
    var config = window.BL2Config || {};
    return Number(config.dbVersion || 0);
  }

  function pending(fromVersion, toVersion){
    fromVersion = Number(fromVersion || 1);
    toVersion = Number(toVersion || currentDbVersion());
    return migrations.filter(function(item){
      var numeric = Number(String(item.version).split(".")[0] || 0);
      return numeric > fromVersion && numeric <= toVersion;
    });
  }

  function v2Status(){
    var config = window.BL2Config || {};
    var db = window.BL2DB || null;
    var meta = db && typeof db.meta === "function" ? db.meta() : null;
    var stores = config.stores || {};
    var expected = [
      stores.periodosCarreras || "periodos_carreras",
      stores.periodosDivisiones || "periodos_divisiones",
      stores.personas || "personas",
      stores.matriculasPeriodo || "matriculas_periodo",
      stores.requisitosEstudiante || "requisitos_estudiante",
      stores.notasTitulacion || "notas_titulacion",
      stores.contactosEstudiante || "contactos_estudiante",
      stores.divisionesEstudiante || "divisiones_estudiante",
      stores.importaciones || "importaciones",
      stores.cambiosPendientes || "cambios_pendientes",
      stores.syncEstado || "sync_estado",
      stores.erroresValidacion || "errores_validacion",
      stores.cacheViews || "cache_views"
    ];

    return {
      ok: Number(config.dbVersion || 0) >= 2 && !!db,
      dbVersion: Number(config.dbVersion || 0),
      schemaVersion: text(config.schemaVersion || ""),
      destructive: false,
      expectedStores: expected,
      dbMeta: meta
    };
  }

  register("2.0.0-schema-safe", {
    title: "DB_VERSION 2 - esquema seguro no destructivo",
    destructive: false,
    status: v2Status,
    run: function(){ return Promise.resolve(v2Status()); }
  });

  window.BDLMigrations = {
    version: VERSION,
    register: register,
    list: list,
    pending: pending,
    currentDbVersion: currentDbVersion
  };
})(window);
