/* =========================================================
Nombre completo: bl2-sqlite-adapter.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-sqlite-adapter.js
Función o funciones:
- Preparar adaptador SQLite para Base Local 2.0 en Electron.
- Usar puente seguro si existe window.BL2SQLiteBridge, window.electronAPI.sqlite o window.api.sqlite.
- Crear tablas e índices con migraciones SQL.
- No reemplazar todavía las consultas síncronas de las pantallas actuales.
Con qué se conecta:
- bl2-schema.js
- bl2-migrations.js
- bl2-storage.js
========================================================= */
(function(window){
  "use strict";

  var state = {ready:false, lastError:"", initializedAt:""};

  function migrations(){if(!window.BL2Migrations){throw new Error("BL2Migrations no disponible.");}return window.BL2Migrations;}
  function now(){return new Date().toISOString();}

  function bridge(){
    try{if(window.BL2SQLiteBridge && typeof window.BL2SQLiteBridge.query === "function"){return window.BL2SQLiteBridge;}}catch(error){}
    try{if(window.electronAPI && window.electronAPI.sqlite && typeof window.electronAPI.sqlite.query === "function"){return window.electronAPI.sqlite;}}catch(error){}
    try{if(window.api && window.api.sqlite && typeof window.api.sqlite.query === "function"){return window.api.sqlite;}}catch(error){}
    return null;
  }

  function available(){return !!bridge();}

  function query(sql, params){
    var b = bridge();
    if(!b){return Promise.reject(new Error("No existe puente SQLite en Electron."));}
    try{
      var result = b.query(sql, Array.isArray(params) ? params : []);
      if(result && typeof result.then === "function"){return result;}
      return Promise.resolve(result);
    }catch(error){return Promise.reject(error);}
  }

  function execute(sql, params){
    var b = bridge();
    if(!b){return Promise.reject(new Error("No existe puente SQLite en Electron."));}
    try{
      if(typeof b.execute === "function"){
        var executed = b.execute(sql, Array.isArray(params) ? params : []);
        return executed && typeof executed.then === "function" ? executed : Promise.resolve(executed);
      }
      return query(sql, params);
    }catch(error){return Promise.reject(error);}
  }

  function initialize(){
    if(!available()){return Promise.resolve({ok:false, skipped:true, mode:"sqlite", message:"SQLite no disponible en este runtime."});}
    var statements = migrations().sqliteCreateStatements();
    var chain = Promise.resolve();
    statements.forEach(function(sql){chain = chain.then(function(){return execute(sql, []);});});
    return chain.then(function(){
      state.ready = true;
      state.initializedAt = now();
      state.lastError = "";
      return {ok:true, mode:"sqlite", statements:statements.length, initializedAt:state.initializedAt};
    }).catch(function(error){
      state.ready = false;
      state.lastError = error && error.message ? error.message : String(error);
      return {ok:false, mode:"sqlite", errorMessage:state.lastError};
    });
  }

  function escapeJson(value){try{return JSON.stringify(value == null ? null : value);}catch(error){return "null";}}

  function upsertStudent(row){
    if(!window.BL2Schema){return Promise.reject(new Error("BL2Schema no disponible."));}
    var student = window.BL2Schema.helpers.normalizeStudent(row || {});
    return execute(
      "INSERT OR REPLACE INTO estudiantes (cedula, numeroIdentificacion, nombres, nombreCarrera, nombreCarreraKey, periodoId, periodoLabel, estadoMatricula, searchText, updatedAt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [student.cedula, student.numeroIdentificacion, student.nombres, student.nombreCarrera, student.nombreCarreraKey, student.periodoId, student.periodoLabel, student.estadoMatricula, student.searchText, student.updatedAt, escapeJson(student)]
    );
  }

  function upsertPeriod(row){
    if(!window.BL2Schema){return Promise.reject(new Error("BL2Schema no disponible."));}
    var period = window.BL2Schema.helpers.normalizePeriod(row || {});
    return execute(
      "INSERT OR REPLACE INTO periodos (id, periodoId, label, periodoLabel, labelKey, updatedAt, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [period.id, period.periodoId, period.label, period.periodoLabel, period.labelKey, period.updatedAt, escapeJson(period)]
    );
  }

  function bulkFromSnapshot(snapshot){
    snapshot = snapshot || {};
    var periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    var students = Array.isArray(snapshot.students) ? snapshot.students : [];
    return initialize().then(function(init){
      if(!init.ok){return init;}
      var chain = Promise.resolve();
      periods.forEach(function(period){chain = chain.then(function(){return upsertPeriod(period);});});
      students.forEach(function(student){chain = chain.then(function(){return upsertStudent(student);});});
      return chain.then(function(){return {ok:true, mode:"sqlite", periods:periods.length, students:students.length, updatedAt:now()};});
    });
  }

  function status(){
    return {ok:available() && !state.lastError, mode:"sqlite", available:available(), ready:state.ready, canServeSync:false, initializedAt:state.initializedAt, lastError:state.lastError, updatedAt:now()};
  }

  window.BL2SQLiteAdapter = {
    version:"2.0.0-alpha.1",
    isAvailable:available,
    canServeSync:function(){return false;},
    initialize:initialize,
    query:query,
    execute:execute,
    upsertStudent:upsertStudent,
    upsertPeriod:upsertPeriod,
    bulkFromSnapshot:bulkFromSnapshot,
    status:status
  };
})(window);
