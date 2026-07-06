/* =========================================================
Archivo: bl2.backup.js
Ruta: /BDLocal/bl2.backup.js
Función:
- Crear respaldos JSON automáticos y manuales de BL2.
- Respaldo automático después de cada carga Excel.
- Respaldo automático una vez al día.
- Exportación manual por período o toda la base.
- Restauración desde JSON.
- Mantener solo los últimos respaldos locales definidos en configuración.
========================================================= */
(function(window, document){
  "use strict";

  var config = window.BL2Config || {};
  var db = window.BL2DB;
  var stores = config.stores || {};
  var backupConfig = config.backup || {};
  var settingsKeys = config.settingsKeys || {};
  var utils = config.utils || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function todayKey(){
    return utils.todayKey ? utils.todayKey() : new Date().toISOString().slice(0, 10);
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    return JSON.parse(JSON.stringify(value));
  }

  function safeFileName(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 90) || "BL2";
  }

  function requireDB(){
    if(!db){
      return Promise.reject(new Error("BL2DB no está cargado."));
    }
    return Promise.resolve(db);
  }

  function filterByPeriod(rows, periodoId){
    periodoId = text(periodoId);
    rows = Array.isArray(rows) ? rows : [];

    if(!periodoId){
      return rows;
    }

    return rows.filter(function(row){
      return text(row && row.periodoId) === periodoId || text(row && row.id) === periodoId;
    });
  }

  function getActivePeriod(){
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){
      return window.BL2Core.getActivePeriod();
    }

    return Promise.all([
      db.getSetting(settingsKeys.activePeriodId || "activePeriodId", ""),
      db.getSetting(settingsKeys.activePeriodLabel || "activePeriodLabel", "")
    ]).then(function(values){
      if(!text(values[0])){
        return null;
      }

      return {
        id: text(values[0]),
        label: text(values[1] || values[0])
      };
    });
  }

  function log(level, message, payload){
    if(window.BL2Core && typeof window.BL2Core.log === "function"){
      return window.BL2Core.log(level, message, payload);
    }

    console.log("[BL2Backup]", level, message, payload || "");
    return Promise.resolve();
  }

  function createPayload(options){
    options = options || {};

    return requireDB().then(function(){
      var scope = text(options.scope || "period");
      var periodoId = text(options.periodoId || "");
      var periodoLabel = text(options.periodoLabel || "");

      return (periodoId || scope === "all"
        ? Promise.resolve({ id: periodoId, label: periodoLabel })
        : getActivePeriod()
      ).then(function(period){
        period = period || {};
        periodoId = scope === "all" ? "" : text(periodoId || period.id);
        periodoLabel = scope === "all" ? "Toda BL2" : text(periodoLabel || period.label || periodoId);

        var tableNames = [
          stores.settings,
          stores.periodos,
          stores.estudiantes,
          stores.requisitos,
          stores.contactos,
          stores.notas,
          stores.cambios,
          stores.logs,
          stores.resumen,
          stores.errores,
          stores.syncMeta
        ].filter(Boolean);

        var payload = {
          app: "Requisitos",
          module: "BL2",
          version: config.version || "1.0.0",
          dbName: config.dbName || "REQUISITOS_BL2",
          type: text(options.type || "manual"),
          scope: scope,
          periodoId: periodoId,
          periodoLabel: periodoLabel,
          exportedAt: nowISO(),
          tables: {}
        };

        var chain = Promise.resolve();

        tableNames.forEach(function(tableName){
          chain = chain.then(function(){
            return db.getAll(tableName).then(function(rows){
              if(scope !== "all"){
                if(tableName === stores.settings || tableName === stores.syncMeta){
                  payload.tables[tableName] = rows;
                }else{
                  payload.tables[tableName] = filterByPeriod(rows, periodoId);
                }
              }else{
                payload.tables[tableName] = rows;
              }
            });
          });
        });

        return chain.then(function(){
          payload.summary = buildPayloadSummary(payload);
          return payload;
        });
      });
    });
  }

  function buildPayloadSummary(payload){
    payload = payload || {};
    var tables = payload.tables || {};

    function count(name){
      return Array.isArray(tables[name]) ? tables[name].length : 0;
    }

    return {
      periodos: count(stores.periodos),
      estudiantes: count(stores.estudiantes),
      requisitos: count(stores.requisitos),
      contactos: count(stores.contactos),
      notas: count(stores.notas),
      cambios: count(stores.cambios),
      logs: count(stores.logs),
      errores: count(stores.errores)
    };
  }

  function saveBackupRecord(payload, options){
    options = options || {};
    payload = payload || {};

    var createdAt = nowISO();
    var record = {
      id: "backup_" + createdAt.replace(/[^0-9]/g, "") + "_" + Math.random().toString(16).slice(2),
      type: text(options.type || payload.type || "manual"),
      scope: text(payload.scope || options.scope || "period"),
      periodoId: text(payload.periodoId || ""),
      periodoLabel: text(payload.periodoLabel || ""),
      summary: clone(payload.summary || {}),
      payload: clone(payload),
      createdAt: createdAt,
      updatedAt: createdAt
    };

    return db.put(stores.backups, record).then(function(){
      return pruneBackups().then(function(){
        return record;
      });
    });
  }

  function pruneBackups(){
    var keep = Number(backupConfig.keepLastLocalBackups || 3);

    if(!Number.isFinite(keep) || keep <= 0){
      keep = 3;
    }

    return db.getAll(stores.backups).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];

      rows.sort(function(a, b){
        return text(b.createdAt).localeCompare(text(a.createdAt));
      });

      var toDelete = rows.slice(keep);
      var chain = Promise.resolve();

      toDelete.forEach(function(row){
        chain = chain.then(function(){
          return db.remove(stores.backups, row.id);
        });
      });

      return chain.then(function(){
        return {
          kept: Math.min(rows.length, keep),
          removed: toDelete.length
        };
      });
    });
  }

  function downloadJSON(payload, options){
    options = options || {};

    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], {
      type: backupConfig.exportMime || "application/json"
    });

    var scope = text(payload.scope || "period");
    var periodo = scope === "all" ? "TODA_BL2" : safeFileName(payload.periodoLabel || payload.periodoId || "PERIODO");
    var stamp = nowISO().replace(/[:.]/g, "-");
    var prefix = backupConfig.filePrefix || "BL2_RESPALDO";
    var fileName = safeFileName(prefix + "_" + periodo + "_" + stamp) + ".json";

    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = options.fileName || fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(function(){
      URL.revokeObjectURL(url);
      if(link.parentNode){
        link.parentNode.removeChild(link);
      }
    }, 500);

    return {
      fileName: link.download,
      size: blob.size
    };
  }

  function createBackup(options){
    options = options || {};

    return createPayload(options).then(function(payload){
      return saveBackupRecord(payload, options).then(function(record){
        return {
          ok: true,
          record: {
            id: record.id,
            type: record.type,
            scope: record.scope,
            periodoId: record.periodoId,
            periodoLabel: record.periodoLabel,
            summary: record.summary,
            createdAt: record.createdAt
          },
          payload: payload
        };
      });
    });
  }

  function autoAfterExcel(periodoId){
    if(backupConfig.automaticAfterExcel === false){
      return Promise.resolve({
        ok: true,
        skipped: true,
        reason: "Respaldo automático después de Excel desactivado."
      });
    }

    return createBackup({
      type: "excel",
      scope: "period",
      periodoId: periodoId
    }).then(function(result){
      return db.setSetting(settingsKeys.lastExcelBackupAt || "lastExcelBackupAt", nowISO()).then(function(){
        return log("OK", "Respaldo automático creado después de carga Excel.", {
          periodoId: periodoId,
          backupId: result.record.id
        });
      }).then(function(){
        return result;
      });
    });
  }

  function dailyIfNeeded(options){
    options = options || {};

    if(backupConfig.automaticDaily === false){
      return Promise.resolve({
        ok: true,
        skipped: true,
        reason: "Respaldo diario desactivado."
      });
    }

    var key = settingsKeys.lastDailyBackupAt || "lastDailyBackupAt";

    return db.getSetting(key, "").then(function(lastValue){
      var lastDay = text(lastValue).slice(0, 10);
      var today = todayKey();

      if(lastDay === today && !options.force){
        return {
          ok: true,
          skipped: true,
          reason: "Ya existe respaldo diario de hoy.",
          lastBackupAt: lastValue
        };
      }

      return createBackup({
        type: "daily",
        scope: options.scope || "all",
        periodoId: options.periodoId || ""
      }).then(function(result){
        return db.setSetting(key, nowISO()).then(function(){
          return log("OK", "Respaldo diario creado.", {
            backupId: result.record.id,
            scope: result.record.scope
          });
        }).then(function(){
          return result;
        });
      });
    });
  }

  function exportManual(options){
    options = options || {};

    return createBackup({
      type: "manual",
      scope: options.scope || "period",
      periodoId: options.periodoId || "",
      periodoLabel: options.periodoLabel || ""
    }).then(function(result){
      var download = downloadJSON(result.payload, options);

      return log("OK", "Respaldo manual exportado.", {
        fileName: download.fileName,
        size: download.size
      }).then(function(){
        return Object.assign({}, result, {
          downloaded: true,
          fileName: download.fileName,
          size: download.size
        });
      });
    });
  }

  function readJSONFile(file){
    return new Promise(function(resolve, reject){
      if(!file){
        reject(new Error("No se recibió archivo JSON."));
        return;
      }

      var reader = new FileReader();

      reader.onload = function(){
        try{
          resolve(JSON.parse(String(reader.result || "")));
        }catch(error){
          reject(new Error("El archivo no es un JSON válido."));
        }
      };

      reader.onerror = function(){
        reject(reader.error || new Error("No se pudo leer el JSON."));
      };

      reader.readAsText(file, "utf-8");
    });
  }

  function restoreFromPayload(payload, options){
    options = options || {};
    payload = payload || {};

    if(!payload.tables){
      return Promise.reject(new Error("El respaldo no contiene tablas."));
    }

    return db.importAll(payload, {
      clearBeforeImport: !!options.clearBeforeImport
    }).then(function(result){
      return log("OK", "Respaldo restaurado en BL2.", result).then(function(){
        return result;
      });
    });
  }

  function restoreFromFile(file, options){
    return readJSONFile(file).then(function(payload){
      return restoreFromPayload(payload, options || {});
    });
  }

  window.BL2Backup = {
    createPayload: createPayload,
    createBackup: createBackup,

    autoAfterExcel: autoAfterExcel,
    dailyIfNeeded: dailyIfNeeded,

    exportManual: exportManual,
    downloadJSON: downloadJSON,

    restoreFromPayload: restoreFromPayload,
    restoreFromFile: restoreFromFile,

    pruneBackups: pruneBackups
  };
})(window, document);