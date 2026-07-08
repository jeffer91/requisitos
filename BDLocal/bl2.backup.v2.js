/* =========================================================
Archivo: bl2.backup.v2.js
Ruta: /BDLocal/bl2.backup.v2.js
Función:
- Respaldo y restauración DB_VERSION 2.
- Exportar tablas nuevas y legacy necesarias sin incluir la tabla backups.
- Restaurar por merge seguro o con limpieza confirmada.
- Crear tarjeta visual en BL2 sin modificar bl2.app.js.
Con qué se conecta:
- BL2DB
- BL2Config.stores
- BL2Core
- BDLocal/bl2.html
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.1.0-block27";
  var BACKUP_KIND = "BL2_BACKUP_V2";

  function text(v){ return String(v == null ? "" : v).trim(); }
  function now(){ return new Date().toISOString(); }
  function byId(id){ return document.getElementById(id); }
  function db(){ return window.BL2DB || null; }
  function stores(){ return window.BL2Config && window.BL2Config.stores ? window.BL2Config.stores : {}; }
  function clone(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function esc(v){ return text(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }

  function safeName(v){
    return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 110) || "BL2";
  }

  function unique(list){
    var map = Object.create(null);
    (list || []).forEach(function(item){ item = text(item); if(item){ map[item] = true; } });
    return Object.keys(map);
  }

  function tableNames(){
    var s = stores();
    return unique([
      s.settings || "settings",
      s.periodos || "periodos",
      s.estudiantes || "estudiantes",
      s.requisitos || "requisitos",
      s.contactos || "contactos",
      s.notas || "notas",
      s.cambios || "cambios",
      s.logs || "logs",
      s.errores || "errores",
      s.syncMeta || "sync_meta",
      s.periodosCarreras || "periodos_carreras",
      s.periodosDivisiones || "periodos_divisiones",
      s.personas || "personas",
      s.matriculasPeriodo || "matriculas_periodo",
      s.requisitosEstudiante || "requisitos_estudiante",
      s.notasTitulacion || "notas_titulacion",
      s.contactosEstudiante || "contactos_estudiante",
      s.divisionesEstudiante || "divisiones_estudiante",
      s.importaciones || "importaciones",
      s.cambiosPendientes || "cambios_pendientes",
      s.syncEstado || "sync_estado",
      s.erroresValidacion || "errores_validacion",
      s.cacheViews || "cache_views"
    ]);
  }

  function requireDB(){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no disponible.")); }
    return Promise.resolve(current);
  }

  function activePeriod(){
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){
      return window.BL2Core.getActivePeriod();
    }
    var current = db();
    if(!current || typeof current.getSetting !== "function"){ return Promise.resolve(null); }
    return Promise.all([
      current.getSetting("activePeriodId", ""),
      current.getSetting("activePeriodLabel", "")
    ]).then(function(values){
      return text(values[0]) ? { id:text(values[0]), label:text(values[1] || values[0]) } : null;
    });
  }

  function hasPeriod(row, periodoId){
    row = row || {};
    periodoId = text(periodoId);
    if(!periodoId){ return true; }
    return text(row.periodoId) === periodoId || text(row.id) === periodoId || text(row.periodId) === periodoId;
  }

  function collectCedulasFromRows(rows, periodoId){
    var map = Object.create(null);
    (rows || []).forEach(function(row){
      if(hasPeriod(row, periodoId)){
        var cedula = text(row.cedula || row.numeroIdentificacion || row.idPersona);
        if(cedula){ map[cedula] = true; }
      }
    });
    return map;
  }

  function filterTable(tableName, rows, periodoId, cedulas){
    rows = Array.isArray(rows) ? rows : [];
    periodoId = text(periodoId);
    if(!periodoId){ return rows; }

    if(tableName === "settings" || tableName === "sync_meta" || tableName === "sync_estado"){
      return rows;
    }
    if(tableName === "personas"){
      return rows.filter(function(row){ return !!cedulas[text(row && row.cedula)]; });
    }
    return rows.filter(function(row){ return hasPeriod(row, periodoId); });
  }

  function buildSummary(tables){
    var summary = {};
    Object.keys(tables || {}).forEach(function(name){ summary[name] = Array.isArray(tables[name]) ? tables[name].length : 0; });
    return summary;
  }

  function createPayload(options){
    options = options || {};
    var scope = text(options.scope || "all");
    return requireDB().then(function(current){
      return (scope === "period" && !text(options.periodoId) ? activePeriod() : Promise.resolve({ id:text(options.periodoId || ""), label:text(options.periodoLabel || "") })).then(function(period){
        period = period || {};
        var periodoId = scope === "period" ? text(options.periodoId || period.id) : "";
        var periodoLabel = scope === "period" ? text(options.periodoLabel || period.label || periodoId) : "Toda BDLocal";
        if(scope === "period" && !periodoId){ throw new Error("Seleccione un período para exportar respaldo por período."); }

        var names = tableNames();
        var rawTables = {};
        var chain = Promise.resolve();

        names.forEach(function(name){
          chain = chain.then(function(){
            return current.getAll(name).then(function(rows){ rawTables[name] = Array.isArray(rows) ? rows : []; }).catch(function(error){ rawTables[name] = []; rawTables[name + "__error"] = error.message || String(error); });
          });
        });

        return chain.then(function(){
          var cedulas = Object.assign({}, collectCedulasFromRows(rawTables["matriculas_periodo"], periodoId), collectCedulasFromRows(rawTables["estudiantes"], periodoId));
          var tables = {};
          names.forEach(function(name){ tables[name] = filterTable(name, rawTables[name], periodoId, cedulas); });
          return {
            kind: BACKUP_KIND,
            version: VERSION,
            schemaVersion: "2",
            dbName: window.BL2Config && window.BL2Config.dbName || "REQUISITOS_BL2",
            scope: scope,
            periodoId: periodoId,
            periodoLabel: periodoLabel,
            exportedAt: now(),
            tables: tables,
            summary: buildSummary(tables)
          };
        });
      });
    });
  }

  function downloadPayload(payload){
    var name = "BL2_V2_" + (payload.scope === "period" ? safeName(payload.periodoLabel || payload.periodoId) : "TODA_BDLOCAL") + "_" + now().replace(/[:.]/g,"-") + ".json";
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return { fileName:name, size:blob.size };
  }

  function saveBackupRecord(payload){
    var current = db();
    var s = stores();
    if(!current || typeof current.put !== "function" || !text(s.backups || "backups")){ return Promise.resolve(null); }
    var createdAt = now();
    var record = {
      id:"backup_v2_" + createdAt.replace(/[^0-9]/g, "") + "_" + Math.random().toString(16).slice(2),
      type:"manual_v2",
      scope:payload.scope,
      periodoId:payload.periodoId,
      periodoLabel:payload.periodoLabel,
      summary:clone(payload.summary || {}),
      payload:clone(payload),
      createdAt:createdAt,
      updatedAt:createdAt
    };
    return current.put(s.backups || "backups", record).then(function(){ return record; }).catch(function(){ return null; });
  }

  function exportBackup(options){
    options = options || {};
    return createPayload(options).then(function(payload){
      return saveBackupRecord(payload).then(function(record){
        var file = downloadPayload(payload);
        return { ok:true, payload:payload, record:record, fileName:file.fileName, size:file.size };
      });
    });
  }

  function readJSONFile(file){
    return new Promise(function(resolve, reject){
      if(!file){ reject(new Error("No se recibió archivo JSON.")); return; }
      var reader = new FileReader();
      reader.onload = function(){ try{ resolve(JSON.parse(String(reader.result || ""))); }catch(error){ reject(new Error("JSON inválido.")); } };
      reader.onerror = function(){ reject(reader.error || new Error("No se pudo leer archivo.")); };
      reader.readAsText(file, "utf-8");
    });
  }

  function validatePayload(payload){
    payload = payload || {};
    if(!payload.tables){ throw new Error("El respaldo no contiene tablas."); }
    if(payload.kind && payload.kind !== BACKUP_KIND){ throw new Error("El respaldo no es BL2_BACKUP_V2."); }
    return payload;
  }

  function restorePayload(payload, options){
    options = options || {};
    payload = validatePayload(payload);
    return requireDB().then(function(current){
      return current.importAll(payload, { clearBeforeImport:!!options.clearBeforeImport }).then(function(result){
        return Object.assign({}, result, { ok:true, kind:BACKUP_KIND, restoredAt:now(), clearBeforeImport:!!options.clearBeforeImport });
      });
    });
  }

  function restoreFile(file, options){
    return readJSONFile(file).then(function(payload){ return restorePayload(payload, options || {}); });
  }

  function setStatus(message){
    var el = byId("bl2-backup-v2-status");
    if(el){ el.textContent = text(message); }
  }

  function ensurePanel(){
    if(byId("bl2-backup-v2-card")){ return byId("bl2-backup-v2-card"); }
    var main = document.querySelector(".bl2-main") || document.body;
    var card = document.createElement("section");
    card.id = "bl2-backup-v2-card";
    card.className = "bl2-card";
    card.innerHTML = [
      '<div class="bl2-card-head bl2-card-head-row">',
      '  <div><h2>Backup DB_VERSION 2</h2><p>Exporta y restaura tablas nuevas sin depender del respaldo legacy.</p></div>',
      '</div>',
      '<div class="bl2-actions">',
      '  <button id="bl2-backup-v2-export-all" class="bl2-btn bl2-btn-light" type="button">Exportar V2 completo</button>',
      '  <button id="bl2-backup-v2-export-period" class="bl2-btn bl2-btn-light" type="button">Exportar V2 período activo</button>',
      '  <button id="bl2-backup-v2-restore" class="bl2-btn bl2-btn-light" type="button">Restaurar V2 JSON</button>',
      '  <button id="bl2-backup-v2-restore-clear" class="bl2-btn bl2-btn-light" type="button">Restaurar limpiando tablas</button>',
      '</div>',
      '<input id="bl2-backup-v2-file" type="file" accept=".json,application/json" hidden />',
      '<p id="bl2-backup-v2-status" class="bl2-empty">Listo para crear respaldo DB_VERSION 2.</p>'
    ].join("");
    main.appendChild(card);
    return card;
  }

  function bind(){
    ensurePanel();
    var allBtn = byId("bl2-backup-v2-export-all");
    var periodBtn = byId("bl2-backup-v2-export-period");
    var restoreBtn = byId("bl2-backup-v2-restore");
    var restoreClearBtn = byId("bl2-backup-v2-restore-clear");
    var fileInput = byId("bl2-backup-v2-file");

    if(allBtn && !allBtn.__v2Backup){ allBtn.__v2Backup = true; allBtn.addEventListener("click", function(){ setStatus("Creando respaldo completo..."); exportBackup({ scope:"all" }).then(function(r){ setStatus("Respaldo completo creado: " + r.fileName); }).catch(function(e){ setStatus("Error: " + (e.message || String(e))); }); }); }
    if(periodBtn && !periodBtn.__v2Backup){ periodBtn.__v2Backup = true; periodBtn.addEventListener("click", function(){ setStatus("Creando respaldo del período activo..."); exportBackup({ scope:"period" }).then(function(r){ setStatus("Respaldo de período creado: " + r.fileName); }).catch(function(e){ setStatus("Error: " + (e.message || String(e))); }); }); }
    if(restoreBtn && !restoreBtn.__v2Backup){ restoreBtn.__v2Backup = true; restoreBtn.addEventListener("click", function(){ fileInput.dataset.clearBeforeImport = "false"; fileInput.click(); }); }
    if(restoreClearBtn && !restoreClearBtn.__v2Backup){ restoreClearBtn.__v2Backup = true; restoreClearBtn.addEventListener("click", function(){ if(confirm("Esto limpiará las tablas incluidas en el JSON antes de restaurar. ¿Continuar?")){ fileInput.dataset.clearBeforeImport = "true"; fileInput.click(); } }); }
    if(fileInput && !fileInput.__v2Backup){ fileInput.__v2Backup = true; fileInput.addEventListener("change", function(){ var file = fileInput.files && fileInput.files[0]; var clear = fileInput.dataset.clearBeforeImport === "true"; if(!file){ return; } setStatus("Restaurando respaldo V2..."); restoreFile(file, { clearBeforeImport:clear }).then(function(result){ setStatus("Restauración V2 completa: " + result.imported + " registros importados."); fileInput.value = ""; }).catch(function(e){ setStatus("Error restaurando: " + (e.message || String(e))); fileInput.value = ""; }); }); }
  }

  window.BL2BackupV2 = { version:VERSION, createPayload:createPayload, exportBackup:exportBackup, restorePayload:restorePayload, restoreFile:restoreFile, bind:bind };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  }else{
    bind();
  }
})(window, document);
