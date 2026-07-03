/* =========================================================
Nombre completo: bdl.sync.queue.js
Ruta o ubicación: /Requisitos/BDLocal/sync/bdl.sync.queue.js
Función o funciones:
- Guardar cola real de sincronización.
- Crear pendientes separados para Firebase, Supabase y Google Sheets.
- Evitar duplicados exactos de sincronización.
- Reintentar errores sin perder cambios.
- Mantener compatibilidad con la versión anterior de BDLSyncQueue.
Con qué se conecta:
- bdl.repo.base.js
- bdl.keys.js
- bdl.sync.config.js
- bdl.sync.changes.js
- bdl.sync.worker.js
- bdl.sync.engine.js
========================================================= */
(function(window){
  "use strict";

  var B = window.BDLRepoBase;
  var K = window.BDLKeys;
  var S = window.BDLSyncConfig;

  if(!B || !K || !S){
    throw new Error("BDLSyncQueue requiere BDLRepoBase, BDLKeys y BDLSyncConfig.");
  }

  function now(){
    return S && typeof S.now === "function" ? S.now() : new Date().toISOString();
  }

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return value;
    }
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail:detail || {} }));
    }catch(error){}
  }

  function id(prefix){
    if(K && typeof K.id === "function"){
      return K.id(prefix || "sync_queue");
    }

    return (prefix || "sync_queue") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  function queueEstados(){
    return Object.assign({
      pendiente: "pendiente",
      procesando: "procesando",
      sincronizado: "sincronizado",
      error: "error"
    }, S.queueEstados || {});
  }

  function limitDefault(){
    return Number(S.limites && S.limites.loteSubida ? S.limites.loteSubida : 100);
  }

  function normalizeBase(value){
    if(window.BDLSyncChanges && typeof window.BDLSyncChanges.normalizeBaseName === "function"){
      return window.BDLSyncChanges.normalizeBaseName(value);
    }

    var raw = text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    if(raw === "sheets" || raw === "google" || raw === "googlesheets"){
      return "google_sheets";
    }

    if(raw === "firestore"){
      return "firebase";
    }

    return raw || "";
  }

  function labelBase(base){
    if(window.BDLSyncChanges && typeof window.BDLSyncChanges.labelBase === "function"){
      return window.BDLSyncChanges.labelBase(base);
    }

    if(base === "firebase"){ return "Firebase"; }
    if(base === "supabase"){ return "Supabase"; }
    if(base === "google_sheets"){ return "Google Sheets"; }
    return base;
  }

  function buildChanges(tabla, accion, idRegistro, datos, options){
    options = options || {};

    if(window.BDLSyncChanges && typeof window.BDLSyncChanges.build === "function"){
      return window.BDLSyncChanges.build(tabla, accion, idRegistro, datos, options);
    }

    var createdAt = now();
    var bases = options.bases || ["firebase", "supabase", "google_sheets"];

    return bases.map(function(base){
      base = normalizeBase(base);

      return {
        base: base,
        baseLabel: labelBase(base),
        tabla: text(tabla),
        accion: text(accion || "upsert"),
        idRegistro: text(idRegistro),
        datos: clone(datos || {}),
        estado: queueEstados().pendiente,
        intentos: 0,
        error: "",
        createdAt: createdAt,
        updatedAt: createdAt
      };
    });
  }

  function normalizeItem(change){
    change = clone(change || {});

    var estados = queueEstados();
    var base = normalizeBase(change.base || change.provider || change.destino && change.destino.base || "firebase");
    var tabla = text(change.tabla || "registros");
    var accion = text(change.accion || "upsert");
    var idRegistro = text(change.idRegistro || change.id || "");
    var createdAt = text(change.createdAt) || now();

    return Object.assign({}, change, {
      id: text(change.id) || id("sync_queue"),
      base: base,
      baseLabel: text(change.baseLabel) || labelBase(base),
      tabla: tabla,
      accion: accion,
      idRegistro: idRegistro,
      datos: clone(change.datos || {}),
      destino: change.destino || { base:base, label:labelBase(base) },
      estado: text(change.estado) || estados.pendiente,
      intentos: Number(change.intentos || 0),
      maxIntentos: Number(change.maxIntentos || 5),
      error: text(change.error),
      createdAt: createdAt,
      updatedAt: now(),
      dedupeKey: text(change.dedupeKey) || [base, tabla, accion, idRegistro, text(change.fingerprint)].join("|"),
      replaceKey: text(change.replaceKey) || [base, tabla, idRegistro].join("|")
    });
  }

  function all(){
    return B.list(B.stores.syncQueue, { limit:0 });
  }

  function removeOlderPending(row){
    return all().then(function(rows){
      var same = rows.filter(function(item){
        return item &&
          item.id !== row.id &&
          text(item.replaceKey || [item.base, item.tabla, item.idRegistro].join("|")) === row.replaceKey &&
          (item.estado === queueEstados().pendiente || item.estado === queueEstados().error);
      });

      var chain = Promise.resolve();

      same.forEach(function(item){
        chain = chain.then(function(){
          return B.remove(B.stores.syncQueue, item.id).catch(function(){
            return null;
          });
        });
      });

      return chain.then(function(){
        return row;
      });
    });
  }

  function existsSame(row){
    return all().then(function(rows){
      return rows.some(function(item){
        return item &&
          text(item.dedupeKey) === row.dedupeKey &&
          item.estado !== queueEstados().sincronizado;
      });
    });
  }

  function putUnique(row, options){
    options = options || {};
    row = normalizeItem(row);

    return existsSame(row).then(function(exists){
      if(exists && options.force !== true){
        return {
          ok: true,
          skipped: true,
          row: row,
          reason: "duplicate"
        };
      }

      return removeOlderPending(row).then(function(){
        return B.put(B.stores.syncQueue, row).then(function(){
          emit("bdlocal:sync-queue-added", {
            id: row.id,
            base: row.base,
            baseLabel: row.baseLabel,
            tabla: row.tabla,
            idRegistro: row.idRegistro,
            at: now()
          });

          return {
            ok: true,
            skipped: false,
            row: row
          };
        });
      });
    });
  }

  function agregar(tabla, accion, idRegistro, datos, options){
    options = options || {};
    var changes = buildChanges(tabla, accion, idRegistro, datos, options);
    var saved = [];
    var skipped = [];
    var chain = Promise.resolve();

    changes.forEach(function(change){
      chain = chain.then(function(){
        return putUnique(change, options).then(function(result){
          if(result.skipped){
            skipped.push(result.row);
          }else{
            saved.push(result.row);
          }

          return result;
        });
      });
    });

    return chain.then(function(){
      emit("bdlocal:sync-queue-batch-added", {
        tabla: tabla,
        accion: accion,
        idRegistro: idRegistro,
        saved: saved.length,
        skipped: skipped.length,
        total: changes.length,
        at: now()
      });

      return {
        ok: true,
        saved: saved.length,
        skipped: skipped.length,
        total: changes.length,
        rows: saved,
        skippedRows: skipped
      };
    });
  }

  function agregarCambio(change, options){
    return putUnique(change, options || {}).then(function(result){
      return result.row;
    });
  }

  function agregarMuchos(changes, options){
    changes = Array.isArray(changes) ? changes : [];
    options = options || {};

    var saved = [];
    var skipped = [];
    var chain = Promise.resolve();

    changes.forEach(function(change){
      chain = chain.then(function(){
        return putUnique(change, options).then(function(result){
          if(result.skipped){
            skipped.push(result.row);
          }else{
            saved.push(result.row);
          }
        });
      });
    });

    return chain.then(function(){
      emit("bdlocal:sync-queue-many-added", {
        saved: saved.length,
        skipped: skipped.length,
        total: changes.length,
        at: now()
      });

      return {
        ok: true,
        saved: saved.length,
        skipped: skipped.length,
        total: changes.length,
        rows: saved,
        skippedRows: skipped
      };
    });
  }

  function pendientes(limit, base){
    limit = Number(limit || limitDefault());
    base = normalizeBase(base);

    return B.byIndex(B.stores.syncQueue, "by_estado", queueEstados().pendiente, { limit:0 }).then(function(rows){
      rows = rows.filter(function(row){
        if(base && normalizeBase(row.base) !== base){
          return false;
        }
        return true;
      });

      rows.sort(function(a, b){
        var pa = Number(a.prioridad || 5);
        var pb = Number(b.prioridad || 5);

        if(pa !== pb){
          return pa - pb;
        }

        return text(a.createdAt).localeCompare(text(b.createdAt));
      });

      return limit ? rows.slice(0, limit) : rows;
    });
  }

  function errores(limit, base){
    limit = Number(limit || 0);
    base = normalizeBase(base);

    return B.byIndex(B.stores.syncQueue, "by_estado", queueEstados().error, { limit:0 }).then(function(rows){
      rows = rows.filter(function(row){
        if(base && normalizeBase(row.base) !== base){
          return false;
        }
        return Number(row.intentos || 0) < Number(row.maxIntentos || 5);
      });

      rows.sort(function(a, b){
        return text(a.updatedAt).localeCompare(text(b.updatedAt));
      });

      return limit ? rows.slice(0, limit) : rows;
    });
  }

  function marcarProcesando(item){
    item = normalizeItem(item);
    item.estado = queueEstados().procesando;
    item.iniciadoEn = now();
    item.updatedAt = now();

    return B.put(B.stores.syncQueue, item).then(function(){
      emit("bdlocal:sync-item-processing", {
        id: item.id,
        base: item.base,
        tabla: item.tabla,
        at: now()
      });

      return item;
    });
  }

  function marcarSincronizado(item, response){
    item = normalizeItem(item);
    item.estado = queueEstados().sincronizado;
    item.error = "";
    item.response = response || item.response || {};
    item.sincronizadoEn = now();
    item.updatedAt = now();

    return B.put(B.stores.syncQueue, item).then(function(){
      emit("bdlocal:sync-item-ok", {
        id: item.id,
        base: item.base,
        tabla: item.tabla,
        at: now()
      });

      return item;
    });
  }

  function marcarError(item, error){
    item = normalizeItem(item);
    item.estado = queueEstados().error;
    item.intentos = Number(item.intentos || 0) + 1;
    item.error = error && error.message ? error.message : String(error || "Error de sincronización");
    item.ultimoErrorEn = now();
    item.updatedAt = now();

    return B.put(B.stores.syncQueue, item).then(function(){
      emit("bdlocal:sync-item-error", {
        id: item.id,
        base: item.base,
        tabla: item.tabla,
        intentos: item.intentos,
        error: item.error,
        at: now()
      });

      return item;
    });
  }

  function reintentarErrores(base){
    return errores(0, base).then(function(rows){
      var chain = Promise.resolve();
      var changed = [];

      rows.forEach(function(row){
        chain = chain.then(function(){
          row.estado = queueEstados().pendiente;
          row.updatedAt = now();
          row.reintentoEn = now();

          return B.put(B.stores.syncQueue, row).then(function(){
            changed.push(row);
          });
        });
      });

      return chain.then(function(){
        if(changed.length){
          emit("bdlocal:sync-errors-requeued", {
            total: changed.length,
            base: base || "",
            at: now()
          });
        }

        return changed;
      });
    });
  }

  function pendientesPorBase(){
    return all().then(function(rows){
      var summary = {
        firebase: { pendiente:0, procesando:0, sincronizado:0, error:0, total:0 },
        supabase: { pendiente:0, procesando:0, sincronizado:0, error:0, total:0 },
        google_sheets: { pendiente:0, procesando:0, sincronizado:0, error:0, total:0 },
        total: rows.length,
        updatedAt: now()
      };

      rows.forEach(function(row){
        var base = normalizeBase(row.base || "firebase");
        var estado = text(row.estado || queueEstados().pendiente);

        if(!summary[base]){
          summary[base] = { pendiente:0, procesando:0, sincronizado:0, error:0, total:0 };
        }

        summary[base].total += 1;

        if(summary[base][estado] == null){
          summary[base][estado] = 0;
        }

        summary[base][estado] += 1;
      });

      return summary;
    });
  }

  function limpiarSincronizados(maxAgeMs){
    maxAgeMs = Number(maxAgeMs || 1000 * 60 * 60 * 24);
    var limitTime = Date.now() - maxAgeMs;

    return B.byIndex(B.stores.syncQueue, "by_estado", queueEstados().sincronizado, { limit:0 }).then(function(rows){
      var toRemove = rows.filter(function(row){
        var t = new Date(row.sincronizadoEn || row.updatedAt || row.createdAt || 0).getTime();
        return Number.isFinite(t) && t < limitTime;
      });

      var chain = Promise.resolve();

      toRemove.forEach(function(row){
        chain = chain.then(function(){
          return B.remove(B.stores.syncQueue, row.id).catch(function(){
            return null;
          });
        });
      });

      return chain.then(function(){
        return {
          ok: true,
          removed: toRemove.length
        };
      });
    });
  }

  window.BDLSyncQueue = {
    agregar: agregar,
    agregarCambio: agregarCambio,
    agregarMuchos: agregarMuchos,
    pendientes: pendientes,
    errores: errores,
    pendientesPorBase: pendientesPorBase,
    marcarProcesando: marcarProcesando,
    marcarSincronizado: marcarSincronizado,
    marcarError: marcarError,
    reintentarErrores: reintentarErrores,
    limpiarSincronizados: limpiarSincronizados,
    listar: all,
    all: all
  };
})(window);