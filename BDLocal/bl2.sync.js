/* =========================================================
Archivo: bl2.sync.js
Ruta: /BDLocal/bl2.sync.js
Función:
- Sincronizar BL2 con Google Sheets mediante Apps Script.
- Google Sheets: frecuente, cada 5 minutos máximo y en inactividad.
- Firebase: no frecuente, solo una vez al día por período.
- Firebase usa la colección existente Estudiantes.
- No crea colecciones nuevas en Firebase.
- Trabaja en lotes de 50 para no saturar.
========================================================= */
(function(window, document){
  "use strict";

  var config = window.BL2Config || {};
  var db = window.BL2DB;
  var stores = config.stores || {};
  var utils = config.utils || {};
  var settingsKeys = config.settingsKeys || {};
  var syncConfig = config.sync || {};
  var googleConfig = config.google || {};
  var firebaseConfig = config.firebase || {};
  var changeStatus = config.changeStatus || {};

  var state = {
    googleRunning: false,
    firebaseRunning: false,
    firebaseReady: null,
    firebaseLoading: null,
    lastActivityAt: Date.now()
  };

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

  function normalizeCedula(value){
    if(utils.normalizeCedula){
      return utils.normalizeCedula(value);
    }

    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function requireDB(){
    if(!db){
      return Promise.reject(new Error("BL2DB no está cargado."));
    }
    return Promise.resolve(db);
  }

  function log(level, message, payload){
    if(window.BL2Core && typeof window.BL2Core.log === "function"){
      return window.BL2Core.log(level, message, payload);
    }

    console.log("[BL2Sync]", level, message, payload || "");
    return Promise.resolve();
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: clone(detail || {}) }));
    }catch(error){}
  }

  function progress(target, percent, detail){
    dispatch("bl2:sync-progress", {
      target: target,
      percent: Math.max(0, Math.min(100, Number(percent) || 0)),
      detail: text(detail),
      at: nowISO()
    });
  }

  function markActivity(){
    state.lastActivityAt = Date.now();
  }

  function isIdle(){
    var idleMs = Number(syncConfig.idleSyncSeconds || 30) * 1000;
    return Date.now() - state.lastActivityAt >= idleMs;
  }

  ["click", "keydown", "input", "change", "mousemove", "scroll", "touchstart"].forEach(function(eventName){
    try{
      window.addEventListener(eventName, markActivity, { passive: true });
    }catch(error){}
  });

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

  function getPeriodId(options){
    options = options || {};

    if(text(options.periodoId)){
      return Promise.resolve({
        id: text(options.periodoId),
        label: text(options.periodoLabel || options.periodoId)
      });
    }

    return getActivePeriod();
  }

  function minutesSince(iso){
    if(!text(iso)){
      return Infinity;
    }

    var time = new Date(iso).getTime();

    if(!Number.isFinite(time)){
      return Infinity;
    }

    return (Date.now() - time) / 60000;
  }

  function getGoogleScriptUrl(){
    if(text(googleConfig.scriptUrl)){
      return Promise.resolve(text(googleConfig.scriptUrl));
    }

    return db.getSetting(settingsKeys.googleScriptUrl || "googleScriptUrl", "");
  }

  function setGoogleScriptUrl(url){
    return db.setSetting(settingsKeys.googleScriptUrl || "googleScriptUrl", text(url));
  }

  function filterByPeriod(rows, periodoId){
    rows = Array.isArray(rows) ? rows : [];
    periodoId = text(periodoId);

    if(!periodoId){
      return rows;
    }

    return rows.filter(function(row){
      return text(row && row.periodoId) === periodoId || text(row && row.id) === periodoId;
    });
  }

  function getTableRowsForPeriod(periodoId, options){
    options = options || {};
    var full = !!options.fullPeriod;

    var tableNames = [
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

    var result = {};
    var chain = Promise.resolve();

    tableNames.forEach(function(tableName){
      chain = chain.then(function(){
        return db.getAll(tableName).then(function(rows){
          if(tableName === stores.syncMeta){
            result[tableName] = rows;
            return;
          }

          if(tableName === stores.periodos){
            result[tableName] = full ? rows : rows.filter(function(row){
              return text(row.id) === periodoId;
            });
            return;
          }

          result[tableName] = full ? filterByPeriod(rows, periodoId) : filterByPeriod(rows, periodoId);
        });
      });
    });

    return chain.then(function(){
      return result;
    });
  }

  function getPendingChangesFor(target, periodoId){
    target = text(target || "google").toLowerCase();

    if(window.BL2Core && typeof window.BL2Core.getPendingChanges === "function"){
      return window.BL2Core.getPendingChanges(target, periodoId);
    }

    var field = target === "firebase" ? "statusFirebase" : "statusGoogle";
    var pending = changeStatus.pending || "PENDIENTE";

    return db.queryByIndex(stores.cambios, field, pending).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];

      if(text(periodoId)){
        rows = rows.filter(function(row){
          return text(row.periodoId) === text(periodoId);
        });
      }

      return rows;
    });
  }

  function markChanges(changes, target, status, response){
    changes = Array.isArray(changes) ? changes : [];
    target = text(target || "google").toLowerCase();
    status = status || changeStatus.synced || "SINCRONIZADO";

    var field = target === "firebase" ? "statusFirebase" : "statusGoogle";
    var chain = Promise.resolve();

    changes.forEach(function(change){
      chain = chain.then(function(){
        var row = Object.assign({}, change);
        row[field] = status;
        row.updatedAt = nowISO();

        if(response){
          row[target + "Response"] = clone(response);
        }

        return db.put(stores.cambios, row);
      });
    });

    return chain.then(function(){
      return changes.length;
    });
  }

  function postJSON(url, payload){
    return fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function(response){
      return response.text().then(function(raw){
        var data = null;

        try{
          data = raw ? JSON.parse(raw) : {};
        }catch(error){
          data = {
            ok: response.ok,
            raw: raw
          };
        }

        if(!response.ok){
          throw new Error(data.message || data.error || "Error HTTP " + response.status);
        }

        return data;
      });
    });
  }

  function syncGoogle(options){
    options = options || {};

    if(state.googleRunning){
      return Promise.resolve({
        ok: true,
        running: true,
        message: "Google ya se está sincronizando."
      });
    }

    return requireDB().then(function(){
      return getPeriodId(options);
    }).then(function(period){
      if(!period || !text(period.id)){
        throw new Error("Seleccione un período antes de sincronizar Google Sheets.");
      }

      return getGoogleScriptUrl().then(function(url){
        if(!text(url)){
          return {
            ok: false,
            skipped: true,
            reason: "No hay URL de Apps Script configurada.",
            periodoId: period.id
          };
        }

        return db.getSetting(settingsKeys.lastGoogleSyncAt || "lastGoogleSyncAt", "").then(function(lastSync){
          var minMinutes = Number(syncConfig.googleMinMinutes || 5);

          if(!options.force && minutesSince(lastSync) < minMinutes){
            return {
              ok: true,
              skipped: true,
              reason: "Google se sincronizó hace menos de " + minMinutes + " minutos.",
              lastGoogleSyncAt: lastSync,
              periodoId: period.id
            };
          }

          state.googleRunning = true;
          progress("google", 5, "Preparando datos para Google Sheets...");

          return getPendingChangesFor("google", period.id).then(function(changes){
            return getTableRowsForPeriod(period.id, {
              fullPeriod: !!options.fullPeriod
            }).then(function(tables){
              var payload = {
                action: options.action || "sync_bl2",
                target: "google_sheets",
                source: "BL2",
                mode: options.fullPeriod ? "full_period" : "changes",
                periodoId: period.id,
                periodoLabel: period.label,
                generatedAt: nowISO(),
                commonFields: googleConfig.commonFields || ["periodoId", "cedula", "updatedAt"],
                changes: changes,
                tables: tables
              };

              progress("google", 35, "Enviando a Apps Script...");

              return postJSON(url, payload).then(function(response){
                progress("google", 75, "Marcando cambios sincronizados...");

                return markChanges(changes, "google", changeStatus.synced || "SINCRONIZADO", response).then(function(){
                  return db.setSetting(settingsKeys.lastGoogleSyncAt || "lastGoogleSyncAt", nowISO());
                }).then(function(){
                  progress("google", 100, "Google Sheets sincronizado.");

                  return log("OK", "Google Sheets sincronizado.", {
                    periodoId: period.id,
                    cambios: changes.length,
                    response: response
                  });
                }).then(function(){
                  return {
                    ok: true,
                    target: "google",
                    periodoId: period.id,
                    changes: changes.length,
                    response: response
                  };
                });
              });
            });
          }).finally(function(){
            state.googleRunning = false;
          });
        });
      });
    }).catch(function(error){
      state.googleRunning = false;
      progress("google", 0, "Error en Google Sheets: " + error.message);

      return log("ERROR", "Falló sincronización Google Sheets.", {
        error: error.message
      }).then(function(){
        return {
          ok: false,
          error: error.message
        };
      });
    });
  }

  function maybeSyncGoogleIdle(options){
    options = options || {};

    if(!isIdle() && !options.force){
      return Promise.resolve({
        ok: true,
        skipped: true,
        reason: "La app todavía está en uso."
      });
    }

    return syncGoogle(options);
  }

  function loadScript(src){
    return new Promise(function(resolve, reject){
      var existing = Array.prototype.slice.call(document.scripts).find(function(script){
        return script.src === src;
      });

      if(existing){
        resolve(true);
        return;
      }

      var script = document.createElement("script");
      script.src = src;
      script.async = true;

      script.onload = function(){
        resolve(true);
      };

      script.onerror = function(){
        reject(new Error("No se pudo cargar: " + src));
      };

      document.head.appendChild(script);
    });
  }

  function ensureFirebase(){
    if(state.firebaseReady){
      return state.firebaseReady;
    }

    if(state.firebaseLoading){
      return state.firebaseLoading;
    }

    state.firebaseLoading = Promise.resolve()
      .then(function(){
        if(window.firebase && window.firebase.firestore){
          return true;
        }

        return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js").then(function(){
          return loadScript("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js");
        });
      })
      .then(function(){
        if(!window.firebase){
          throw new Error("Firebase SDK no quedó disponible.");
        }

        if(!window.firebase.apps || !window.firebase.apps.length){
          window.firebase.initializeApp(firebaseConfig.config || {});
        }

        state.firebaseReady = window.firebase.firestore();
        return state.firebaseReady;
      })
      .finally(function(){
        state.firebaseLoading = null;
      });

    return state.firebaseLoading;
  }

  function cleanForFirebase(value){
    if(value === undefined){
      return null;
    }

    if(value === null){
      return null;
    }

    if(Array.isArray(value)){
      return value.map(cleanForFirebase);
    }

    if(typeof value === "object"){
      var result = {};

      Object.keys(value).forEach(function(key){
        if(key.charAt(0) === "_"){
          return;
        }

        if(key === "original"){
          return;
        }

        var cleaned = cleanForFirebase(value[key]);

        if(cleaned !== undefined){
          result[key] = cleaned;
        }
      });

      return result;
    }

    return value;
  }

  function buildFirebaseStudent(row){
    row = cleanForFirebase(row || {});
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion);

    row.cedula = cedula;
    row.numeroIdentificacion = row.numeroIdentificacion || cedula;
    row.ultimoPeriodoId = row.ultimoPeriodoId || row.periodoId || "";
    row.updatedAt = row.updatedAt || nowISO();
    row.ultimaSincronizacion = nowISO();

    return row;
  }

  function runInBatches(items, batchSize, handler, onProgress){
    items = Array.isArray(items) ? items : [];
    batchSize = Number(batchSize || 50);

    if(!Number.isFinite(batchSize) || batchSize <= 0){
      batchSize = 50;
    }

    var total = items.length;
    var done = 0;
    var chain = Promise.resolve();

    for(var i = 0; i < items.length; i += batchSize){
      (function(batch){
        chain = chain.then(function(){
          return handler(batch).then(function(){
            done += batch.length;

            if(typeof onProgress === "function"){
              onProgress(done, total);
            }
          });
        });
      })(items.slice(i, i + batchSize));
    }

    return chain.then(function(){
      return {
        total: total,
        done: done
      };
    });
  }

  function syncFirebaseUpload(options){
    options = options || {};

    return getPeriodId(options).then(function(period){
      if(!period || !text(period.id)){
        throw new Error("Seleccione un período antes de subir a Firebase.");
      }

      progress("firebase", 5, "Preparando Firebase...");

      return ensureFirebase().then(function(firestore){
        progress("firebase", 15, "Leyendo estudiantes del período...");

        return window.BL2Core.getStudents({ periodoId: period.id }).then(function(students){
          var batchSize = Number(firebaseConfig.batchSize || syncConfig.firebaseBatchSize || 50);
          var collection = text(firebaseConfig.collection || "Estudiantes");

          progress("firebase", 25, "Subiendo en lotes de " + batchSize + "...");

          return runInBatches(students, batchSize, function(batch){
            var writeBatch = firestore.batch();

            batch.forEach(function(row){
              var clean = buildFirebaseStudent(row);
              var docId = normalizeCedula(clean.cedula);
              var ref = firestore.collection(collection).doc(docId);

              writeBatch.set(ref, clean, { merge: true });
            });

            return writeBatch.commit();
          }, function(done, total){
            var percent = total ? Math.round((done * 70) / total) + 25 : 95;
            progress("firebase", percent, "Firebase: " + done + " de " + total);
          }).then(function(result){
            return getPendingChangesFor("firebase", period.id).then(function(changes){
              return markChanges(changes, "firebase", changeStatus.synced || "SINCRONIZADO", {
                uploaded: result.done
              });
            }).then(function(){
              progress("firebase", 100, "Firebase sincronizado.");

              return {
                ok: true,
                action: "upload",
                periodoId: period.id,
                total: result.total,
                uploaded: result.done
              };
            });
          });
        });
      });
    });
  }

  function syncFirebaseDownload(options){
    options = options || {};

    return getPeriodId(options).then(function(period){
      if(!period || !text(period.id)){
        throw new Error("Seleccione un período antes de descargar desde Firebase.");
      }

      return ensureFirebase().then(function(firestore){
        var collection = text(firebaseConfig.collection || "Estudiantes");

        progress("firebase", 20, "Descargando período desde Firebase...");

        return firestore.collection(collection)
          .where("periodoId", "==", period.id)
          .get()
          .then(function(snapshot){
            var rows = [];

            snapshot.forEach(function(doc){
              rows.push(Object.assign({}, doc.data() || {}, {
                cedula: normalizeCedula((doc.data() || {}).cedula || doc.id),
                numeroIdentificacion: normalizeCedula((doc.data() || {}).numeroIdentificacion || doc.id),
                periodoId: period.id,
                periodoLabel: (doc.data() || {}).periodoLabel || period.label
              }));
            });

            progress("firebase", 70, "Guardando descarga en BL2...");

            return window.BL2Core.saveStudents(rows, {
              normalized: true,
              periodoId: period.id,
              periodoLabel: period.label
            }).then(function(summary){
              progress("firebase", 100, "Descarga Firebase completada.");

              return {
                ok: true,
                action: "download",
                periodoId: period.id,
                downloaded: rows.length,
                summary: summary
              };
            });
          });
      });
    });
  }

  function syncFirebaseCompare(options){
    options = options || {};

    return getPeriodId(options).then(function(period){
      if(!period || !text(period.id)){
        throw new Error("Seleccione un período antes de comparar con Firebase.");
      }

      return ensureFirebase().then(function(firestore){
        var collection = text(firebaseConfig.collection || "Estudiantes");

        progress("firebase", 20, "Leyendo Firebase para comparar...");

        return firestore.collection(collection)
          .where("periodoId", "==", period.id)
          .get()
          .then(function(snapshot){
            var remoteByCedula = {};

            snapshot.forEach(function(doc){
              var data = doc.data() || {};
              var cedula = normalizeCedula(data.cedula || data.numeroIdentificacion || doc.id);
              remoteByCedula[cedula] = Object.assign({}, data, {
                cedula: cedula
              });
            });

            return window.BL2Core.getStudents({ periodoId: period.id }).then(function(localRows){
              var localByCedula = {};
              var onlyLocal = [];
              var onlyRemote = [];
              var different = [];
              var equal = [];

              localRows.forEach(function(row){
                localByCedula[normalizeCedula(row.cedula || row.numeroIdentificacion)] = row;
              });

              Object.keys(localByCedula).forEach(function(cedula){
                var local = localByCedula[cedula];
                var remote = remoteByCedula[cedula];

                if(!remote){
                  onlyLocal.push(local);
                  return;
                }

                var winner = window.BL2Core && typeof window.BL2Core.compareRecords === "function"
                  ? window.BL2Core.compareRecords(local, remote)
                  : compareUpdatedAt(local, remote);

                if(winner === "equal"){
                  equal.push(local);
                }else{
                  different.push({
                    cedula: cedula,
                    winner: winner,
                    local: local,
                    remote: remote
                  });
                }
              });

              Object.keys(remoteByCedula).forEach(function(cedula){
                if(!localByCedula[cedula]){
                  onlyRemote.push(remoteByCedula[cedula]);
                }
              });

              var result = {
                ok: true,
                action: "compare",
                periodoId: period.id,
                local: localRows.length,
                remote: Object.keys(remoteByCedula).length,
                equal: equal.length,
                different: different.length,
                onlyLocal: onlyLocal.length,
                onlyRemote: onlyRemote.length,
                detail: {
                  different: different,
                  onlyLocal: onlyLocal,
                  onlyRemote: onlyRemote
                }
              };

              progress("firebase", 100, "Comparación Firebase finalizada.");
              return result;
            });
          });
      });
    });
  }

  function compareUpdatedAt(localRow, remoteRow){
    var local = text(localRow && localRow.updatedAt);
    var remote = text(remoteRow && remoteRow.updatedAt);

    if(local === remote){
      return "equal";
    }

    if(local && remote){
      return local > remote ? "local" : "remote";
    }

    if(local && !remote){
      return "local";
    }

    if(!local && remote){
      return "remote";
    }

    return "equal";
  }

  function getFirebaseDailyKey(periodoId){
    return "firebaseDaily__" + text(periodoId);
  }

  function wasFirebaseSyncedToday(periodoId){
    return db.get(stores.syncMeta, getFirebaseDailyKey(periodoId)).then(function(row){
      return row && text(row.day) === todayKey();
    });
  }

  function markFirebaseDailySynced(periodoId, payload){
    return db.put(stores.syncMeta, {
      key: getFirebaseDailyKey(periodoId),
      periodoId: periodoId,
      day: todayKey(),
      payload: clone(payload || {}),
      updatedAt: nowISO()
    }).then(function(){
      return db.setSetting(settingsKeys.lastFirebaseSyncAt || "lastFirebaseSyncAt", nowISO());
    }).then(function(){
      return db.setSetting(settingsKeys.lastFirebaseSyncDay || "lastFirebaseSyncDay", todayKey());
    });
  }

  function syncFirebase(options){
    options = options || {};

    if(state.firebaseRunning){
      return Promise.resolve({
        ok: true,
        running: true,
        message: "Firebase ya se está sincronizando."
      });
    }

    state.firebaseRunning = true;

    return getPeriodId(options).then(function(period){
      if(!period || !text(period.id)){
        throw new Error("Seleccione un período antes de sincronizar Firebase.");
      }

      var action = text(options.action || "upload").toLowerCase();

      return (function(){
        if(action === "download"){
          return syncFirebaseDownload(options);
        }

        if(action === "compare"){
          return syncFirebaseCompare(options);
        }

        return syncFirebaseUpload(options);
      })().then(function(result){
        return markFirebaseDailySynced(period.id, result).then(function(){
          return log("OK", "Firebase sincronizado.", result);
        }).then(function(){
          return result;
        });
      });
    }).catch(function(error){
      progress("firebase", 0, "Error en Firebase: " + error.message);

      return log("ERROR", "Falló sincronización Firebase.", {
        error: error.message
      }).then(function(){
        return {
          ok: false,
          error: error.message
        };
      });
    }).finally(function(){
      state.firebaseRunning = false;
    });
  }

  function maybeSyncFirebaseDaily(options){
    options = options || {};

    if(!isIdle() && !options.force){
      return Promise.resolve({
        ok: true,
        skipped: true,
        reason: "La app todavía está en uso."
      });
    }

    return getPeriodId(options).then(function(period){
      if(!period || !text(period.id)){
        return {
          ok: true,
          skipped: true,
          reason: "No hay período activo para Firebase."
        };
      }

      return wasFirebaseSyncedToday(period.id).then(function(doneToday){
        if(doneToday && !options.force){
          return {
            ok: true,
            skipped: true,
            reason: "Firebase ya se sincronizó hoy para este período.",
            periodoId: period.id
          };
        }

        return syncFirebase(Object.assign({}, options, {
          action: options.action || "upload"
        }));
      });
    });
  }

  function syncBeforeClose(options){
    options = options || {};

    var maxMs = Number(syncConfig.closeSyncMaxSeconds || 30) * 1000;
    var timeout = new Promise(function(resolve){
      setTimeout(function(){
        resolve({
          ok: false,
          timeout: true,
          message: "Tiempo máximo de sincronización antes de cerrar alcanzado."
        });
      }, maxMs);
    });

    var work = Promise.resolve()
      .then(function(){
        return syncGoogle(Object.assign({}, options, {
          force: true
        }));
      })
      .then(function(googleResult){
        return maybeSyncFirebaseDaily(Object.assign({}, options, {
          force: false
        })).then(function(firebaseResult){
          return {
            ok: true,
            google: googleResult,
            firebase: firebaseResult
          };
        });
      });

    return Promise.race([work, timeout]);
  }

  window.BL2Sync = {
    markActivity: markActivity,
    isIdle: isIdle,

    getGoogleScriptUrl: getGoogleScriptUrl,
    setGoogleScriptUrl: setGoogleScriptUrl,

    syncGoogle: syncGoogle,
    maybeSyncGoogleIdle: maybeSyncGoogleIdle,

    syncFirebase: syncFirebase,
    maybeSyncFirebaseDaily: maybeSyncFirebaseDaily,

    syncBeforeClose: syncBeforeClose,

    getPendingChangesFor: getPendingChangesFor,
    markChanges: markChanges,

    ensureFirebase: ensureFirebase,
    getState: function(){ return clone(state); }
  };
})(window, document);