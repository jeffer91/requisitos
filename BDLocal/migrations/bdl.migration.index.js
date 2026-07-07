/* =========================================================
Archivo: bdl.migration.index.js
Ruta: /BDLocal/migrations/bdl.migration.index.js
Función:
- Crear el punto de entrada de migraciones de BDLocal.
- Registrar migraciones futuras sin ejecutar cambios destructivos.
- Preparar la migración segura hacia DB_VERSION 2.
Con qué se conecta:
- BDLocal/bl2.config.js
- BDLocal/bl2.db.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.1.0-block1";
  var migrations = [];

  function register(migration){
    if(!migration || typeof migration.run !== "function"){ return false; }
    migrations.push(migration);
    migrations.sort(function(a, b){ return Number(a.version || 0) - Number(b.version || 0); });
    return true;
  }

  function list(){
    return migrations.slice();
  }

  function currentDbVersion(){
    return window.BL2Config && window.BL2Config.dbVersion ? Number(window.BL2Config.dbVersion) : 1;
  }

  function pending(fromVersion, toVersion){
    fromVersion = Number(fromVersion || 1);
    toVersion = Number(toVersion || currentDbVersion());
    return migrations.filter(function(item){
      var version = Number(item.version || 0);
      return version > fromVersion && version <= toVersion;
    });
  }

  window.BDLMigrations = {
    version: VERSION,
    register: register,
    list: list,
    pending: pending,
    currentDbVersion: currentDbVersion
  };
})(window);
