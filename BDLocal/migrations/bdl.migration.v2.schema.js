/* =========================================================
Archivo: bdl.migration.v2.schema.js
Ruta: /BDLocal/migrations/bdl.migration.v2.schema.js
Función:
- Registrar la migración segura DB_VERSION 2.
- Documentar tablas nuevas creadas en IndexedDB.
- Verificar que BL2DB esté usando schemaVersion 2 sin modificar datos.
Con qué se conecta:
- BDLocal/migrations/bdl.migration.index.js
- BDLocal/bl2.config.v2.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var Migrations = window.BDLMigrations;
  if(!Migrations || typeof Migrations.register !== "function"){ return; }

  var TABLES = [
    "periodos_carreras",
    "periodos_divisiones",
    "personas",
    "matriculas_periodo",
    "requisitos_estudiante",
    "notas_titulacion",
    "contactos_estudiante",
    "divisiones_estudiante",
    "importaciones",
    "cambios_pendientes",
    "sync_estado",
    "errores_validacion",
    "cache_views"
  ];

  function status(){
    var config = window.BL2Config || {};
    var db = window.BL2DB || null;
    var meta = db && typeof db.meta === "function" ? db.meta() : null;

    return {
      version: 2,
      name: "DB_VERSION_2_SCHEMA_SAFE",
      destructive: false,
      configVersion: Number(config.dbVersion || 0),
      schemaVersion: config.schemaVersion || "",
      dbMeta: meta,
      tables: TABLES.slice(),
      ready: Number(config.dbVersion || 0) >= 2 && !!db
    };
  }

  Migrations.register("2.0.0-schema-safe", {
    version: "2.0.0-schema-safe",
    title: "DB_VERSION 2 - esquema seguro no destructivo",
    destructive: false,
    tables: TABLES.slice(),
    status: status,
    run: function(){ return Promise.resolve(status()); }
  });

  window.BDLMigrationV2Schema = {
    version: "2.0.0-schema-safe",
    tables: TABLES.slice(),
    status: status
  };
})(window);
