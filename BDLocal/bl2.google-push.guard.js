/* =========================================================
Nombre completo: bl2.google-push.guard.js
Ruta o ubicación: /BDLocal/bl2.google-push.guard.js
Función o funciones:
- Proteger las rutas legacy de Google Sheets y Firebase.
- Bloquear sincronizaciones automáticas y ejecuciones paralelas.
- Traer Firebase por período con comparación previa.
- No sobrescribir cambios locales pendientes o más recientes.
- Crear respaldo antes de aplicar datos remotos.
- Mantener la comparación Firebase en modo de solo lectura.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.1.0-external-sync-guard";
  var PAUSE_KEY = "REQ_BDLOCAL_PAUSE_GOOGLE_PUSH";
  var googleRunning = false;
  var firebasePulling = false;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function store(){ return window.BDLocalConfigStore || null; }
  function core(){ return window.BL2Core || null; }
  function sync(){ return window.BL2Sync || null; }
  function manager(){ return window.BDLocalSyncManager || null; }
  function outbox(){ return window.BDLSyncOutbox || null; }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePeriod(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g,"__");
  }

  function log(channel,message,level,data){
    try{
      if(store() && typeof store().addLog === "function"){
        store().addLog(channel,message,level === "error" ? "error" : level === "warn" ? "warning" : "success",data || {});
      }
    }catch(error){}
  }

  function progress(target,percent,detail){
    try{
      window.dispatchEvent(new CustomEvent("bl2:sync-progress",{
        detail:{ target:target,percent:Math.max(0,Math.min(100,Number(percent || 0))),detail:detail || "",at:now() }
      }));
    }catch(error){}
    try{
      if(window.BDLocalConfigUI && typeof window.BDLocalConfigUI.setProgress === "function"){
        window.BDLocalConfigUI.setProgress(percent > 0 && percent < 100,percent,detail || "");
      }
    }catch(error2){}
  }

  function readJson(name,fallback){
    try{
      var value = JSON.parse(window.localStorage.getItem(name) || "");
      return value == null ? fallback : value;
    }catch(error){ return fallback; }
  }

  function googlePaused(){
    if(window.BL2_GOOGLE_PUSH_PAUSED){ return true; }
    var value = readJson(PAUSE_KEY,null);
    return !!(value && value.paused);
  }

  function getActivePeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
        var selected = window.BL2App.getSelectedPeriod();
        if(selected && text(selected.id)){ return Promise.resolve({ id:normalizePeriod(selected.id),label:text(selected.label || selected.id) }); }
      }
      if(window.BL2App && typeof window.BL2App.getState === "function"){
        var state = window.BL2App.getState() || {};
        if(state.activePeriod && text(state.activePeriod.id)){ return Promise.resolve({ id:normalizePeriod(state.activePeriod.id),label:text(state.activePeriod.label || state.activePeriod.id) }); }
      }
    }catch(error){}
    if(core() && typeof core().getActivePeriod === "function"){
      return core().getActivePeriod().then(function(period){
        return period && text(period.id) ? { id:normalizePeriod(period.id),label:text(period.label || period.periodoLabel || period.id) } : null;
      });
    }
    return Promise.resolve(null);
  }

  function skipped(target,message,data){
    log(target + "_guard",message,"warn",data || {});
    progress(target,100,message);
    return Promise.resolve({ ok:true,skipped:true,target:target,message:message,data:data || {} });
  }

  function periodUploadMap(config){
    var sheets = config && config.sheets || {};
    var map = sheets.fullUploadByPeriod || sheets.fullUploadsByPeriod || {};
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  }

  function periodHasFullUpload(periodoId){
    var config = store() && typeof store().loadConfig === "function" ? store().loadConfig() || {} : {};
    var sheets = config.sheets || {};
    return !!periodUploadMap(config)[periodoId] || text(sheets.lastFullUploadPeriodId) === text(periodoId);
  }

  function markPeriodFullUpload(periodoId,result){
    if(!store() || typeof store().patchConfig !== "function"){ return; }
    var config = store().loadConfig() || {};
    var map = Object.assign({},periodUploadMap(config));
    map[periodoId] = { ok:true,at:now(),source:"ExternalSyncGuard",changes:Number(result && result.changes || 0) };
    store().patchConfig({ sheets:{ firstFullUploadDone:true,lastFullUploadAt:now(),lastFullUploadPeriodId:periodoId,fullUploadByPeriod:map,connected:true,status:"ok",lastError:"" } });
  }

  function pendingGoogle(periodoId){
    if(!outbox() || typeof outbox().list !== "function"){ return Promise.resolve([]); }
    return outbox().list({ periodoId:periodoId }).then(function(rows){
      return (rows || []).filter(function(row){ return !outbox().isDone(row,"google"); });
    }).catch(function(){ return []; });
  }

  function installGoogleGuard(m){
    if(!m || m.__externalGoogleGuardInstalled || typeof m.pushLocalToSheets !== "function"){ return; }
    var originalPush = m.pushLocalToSheets;
    var originalQueue = typeof m.syncQueue === "function" ? m.syncQueue : null;
    var originalAll = typeof m.syncAll === "function" ? m.syncAll : null;

    m.pushLocalToSheets = function(options){
      options = options || {};
      if(options.manual !== true){ return skipped("google","Solicitud automática de Google Sheets bloqueada.",{ source:options.source || "legacy" }); }
      if(googlePaused()){ return skipped("google","Google Sheets está pausado mientras se traen datos.",{}); }
      if(googleRunning){ return skipped("google","Ya existe una subida a Google Sheets en curso.",{}); }

      return getActivePeriod().then(function(period){
        if(!period){ throw new Error("Seleccione un período antes de sincronizar Google Sheets."); }
        return pendingGoogle(period.id).then(function(changes){
          var forceFull = options.forceFull === true || options.manualFull === true;
          var hasFull = periodHasFullUpload(period.id);
          if(!forceFull && !changes.length && hasFull){ return skipped("google","No hay cambios pendientes para este período.",{ periodoId:period.id }); }
          var safeOptions = Object.assign({},options,{ manual:true,fullPeriod:forceFull || !hasFull,mode:forceFull || !hasFull ? "full_period" : "changes" });
          googleRunning = true;
          return originalPush.call(m,safeOptions).then(function(result){
            if(result && result.ok !== false && safeOptions.fullPeriod){ markPeriodFullUpload(period.id,result); }
            return result;
          }).finally(function(){ googleRunning = false; });
        });
      });
    };

    if(originalQueue){
      m.syncQueue = function(options){
        options = options || {};
        if(options.manual !== true){ return skipped("google","Cola automática legacy bloqueada.",{}); }
        return originalQueue.call(m,options);
      };
    }
    if(originalAll){
      m.syncAll = function(options){
        options = options || {};
        if(options.manual !== true){ return skipped("google","Sincronización total automática bloqueada.",{}); }
        return originalAll.call(m,options);
      };
    }
    m.__externalGoogleGuardInstalled = true;
  }

  function firebaseCollection(){
    var config = window.BL2Config && window.BL2Config.firebase || {};
    return text(config.collection || "Estudiantes") || "Estudiantes";
  }

  function ensureFirebase(){
    if(!sync() || typeof sync().ensureFirebase !== "function"){ return Promise.reject(new Error("Firebase no está disponible.")); }
    return sync().ensureFirebase();
  }

  function remoteTime(row){
    var value = Date.parse(text(row && (row.updatedAt || row.ultimaSincronizacion || row.createdAt)));
    return Number.isFinite(value) ? value : 0;
  }

  function readFirebasePeriod(period){
    return ensureFirebase().then(function(firestore){
      return firestore.collection(firebaseCollection()).where("periodoId","==",period.id).get();
    }).then(function(snapshot){
      var map = Object.create(null);
      var duplicates = 0;

      snapshot.forEach(function(doc){
        var data = Object.assign({},doc.data() || {});
        var documentId = text(doc.id);
        var prefix = period.id + "__";
        var fallbackCedula = documentId.indexOf(prefix) === 0 ? documentId.slice(prefix.length) : documentId;
        var identification = normalizeCedula(data.cedula || data.numeroIdentificacion || fallbackCedula);
        if(!identification){ return; }

        data.cedula = identification;
        data.numeroIdentificacion = text(data.numeroIdentificacion || identification);
        data.periodoId = period.id;
        data.periodoCanonicoId = period.id;
        data.periodoLabel = text(data.periodoLabel || data.periodoCanonicoLabel || period.label || period.id);
        data.firebaseDocumentId = documentId;
        data.source = "firebase_pull";

        if(map[identification]){
          duplicates += 1;
          var currentStable = map[identification].firebaseDocumentId === prefix + identification;
          var incomingStable = documentId === prefix + identification;
          if(remoteTime(data) < remoteTime(map[identification])){ return; }
          if(remoteTime(data) === remoteTime(map[identification]) && currentStable && !incomingStable){ return; }
        }
        map[identification] = data;
      });

      return { rows:Object.keys(map).map(function(key){ return map[key]; }),rawCount:snapshot.size || 0,duplicates:duplicates };
    });
  }

  function localPendingMap(periodoId){
    if(!outbox() || typeof outbox().list !== "function"){ return Promise.resolve({}); }
    return outbox().list({ periodoId:periodoId }).then(function(rows){
      var map = Object.create(null);
      (rows || []).forEach(function(row){
        var identification = normalizeCedula(row.cedula || row.numeroIdentificacion || (row.payload || {}).cedula);
        if(!identification){ return; }
        if(["google","firebase","supabase"].some(function(target){ return !outbox().isDone(row,target); })){
          map[identification] = true;
        }
      });
      return map;
    }).catch(function(){ return {}; });
  }

  function buildFirebasePreview(period){
    if(!core() || typeof core().getStudents !== "function"){ return Promise.reject(new Error("BL2Core.getStudents no está disponible.")); }
    progress("firebase",15,"Leyendo Firebase del período " + period.label + "...");

    return Promise.all([readFirebasePeriod(period),core().getStudents({ periodoId:period.id }),localPendingMap(period.id)]).then(function(values){
      var remote = values[0];
      var localRows = values[1] || [];
      var pending = values[2] || {};
      var localMap = Object.create(null);
      localRows.forEach(function(row){ localMap[normalizeCedula(row.cedula || row.numeroIdentificacion)] = row; });

      var apply = [];
      var equal = [];
      var localNewer = [];
      var pendingConflict = [];
      var ambiguous = [];

      remote.rows.forEach(function(remoteRow){
        var identification = normalizeCedula(remoteRow.cedula || remoteRow.numeroIdentificacion);
        var local = localMap[identification];
        if(pending[identification]){ pendingConflict.push(identification); return; }
        if(!local){ apply.push(remoteRow); return; }

        var winner = core() && typeof core().compareRecords === "function" ? core().compareRecords(local,remoteRow) : "different";
        if(winner === "remote"){ apply.push(remoteRow); }
        else if(winner === "equal"){ equal.push(identification); }
        else if(winner === "local"){ localNewer.push(identification); }
        else{ ambiguous.push(identification); }
      });

      return {
        ok:true,
        period:period,
        remoteRows:remote.rows,
        rowsToApply:apply,
        remoteDocuments:remote.rawCount,
        remoteUnique:remote.rows.length,
        duplicateDocumentsIgnored:remote.duplicates,
        local:localRows.length,
        apply:apply.length,
        equal:equal.length,
        localNewer:localNewer.length,
        pendingConflict:pendingConflict.length,
        ambiguous:ambiguous.length,
        detail:{ equal:equal,localNewer:localNewer,pendingConflict:pendingConflict,ambiguous:ambiguous }
      };
    });
  }

  function publicPreview(preview){
    return Object.assign({},preview,{ rowsToApply:undefined,remoteRows:undefined,previewOnly:true,message:"Comparación Firebase finalizada sin modificar Base Local." });
  }

  function createSafetyBackup(period){
    if(window.BL2Backup && typeof window.BL2Backup.createBackup === "function"){
      return window.BL2Backup.createBackup({ scope:"period",periodoId:period.id,periodoLabel:period.label,type:"pre_firebase_pull" });
    }
    return Promise.resolve(null);
  }

  function markImportedChanges(changes){
    changes = Array.isArray(changes) ? changes : [];
    if(!changes.length || !outbox() || typeof outbox().markSynced !== "function"){ return Promise.resolve(); }
    var chain = Promise.resolve();
    ["firebase","google","supabase"].forEach(function(target){
      chain = chain.then(function(){ return outbox().markSynced(changes,target,{ syncedAt:now(),source:"firebase_pull",imported:true }); });
    });
    return chain;
  }

  function applyFirebasePreview(preview){
    if(!preview.rowsToApply.length){
      return Promise.resolve(Object.assign({},publicPreview(preview),{ previewOnly:false,applied:0,message:"Firebase no tiene cambios seguros para aplicar." }));
    }

    var applied = preview.rowsToApply.length;
    progress("firebase",55,"Creando respaldo antes de aplicar Firebase...");
    return createSafetyBackup(preview.period).then(function(backup){
      progress("firebase",70,"Guardando cambios seguros en Base Local...");
      return core().saveStudents(preview.rowsToApply,{
        normalized:true,
        periodoId:preview.period.id,
        periodoLabel:preview.period.label,
        source:"firebase_pull",
        markRetired:false,
        sync:false,
        localOnly:true,
        cloudSync:false,
        manualCloudSync:true,
        importResult:{ advertencias:[],errores:[],duplicados:preview.duplicateDocumentsIgnored }
      }).then(function(summary){
        return markImportedChanges(summary.changes).then(function(){
          return Object.assign({},publicPreview(preview),{
            previewOnly:false,
            applied:applied,
            summary:summary,
            safetyBackupId:backup && backup.record && backup.record.id || "",
            message:"Firebase → Base Local completado sin generar reenvíos. Aplicados: " + applied + "."
          });
        });
      });
    });
  }

  function pullFirebaseToLocalSafe(period,options){
    options = options || {};
    if(firebasePulling){ return skipped("firebase","Ya existe una descarga Firebase en curso.",{}); }
    var periodPromise = period && period.id ? Promise.resolve({ id:normalizePeriod(period.id),label:text(period.label || period.id) }) : getActivePeriod();

    firebasePulling = true;
    window.BL2_FIREBASE_PULLING = true;

    return periodPromise.then(function(current){
      if(!current){ throw new Error("Seleccione un período antes de traer Firebase."); }
      return buildFirebasePreview(current).then(function(preview){
        if(options.previewOnly === true){ return publicPreview(preview); }

        var approved = true;
        if(options.confirm !== false){
          approved = window.confirm(
            "Firebase → Base Local\n\n" +
            "Período: " + current.label + "\n" +
            "Documentos leídos: " + preview.remoteDocuments + "\n" +
            "Registros únicos: " + preview.remoteUnique + "\n" +
            "Cambios seguros para aplicar: " + preview.apply + "\n" +
            "Cambios locales protegidos: " + preview.pendingConflict + "\n" +
            "Locales más recientes: " + preview.localNewer + "\n" +
            "Duplicados remotos ignorados: " + preview.duplicateDocumentsIgnored + "\n\n" +
            "Se creará un respaldo y no se marcarán estudiantes como retirados. ¿Continuar?"
          );
        }

        if(!approved){ return Object.assign({},publicPreview(preview),{ previewOnly:false,cancelled:true,message:"Descarga cancelada." }); }
        return applyFirebasePreview(preview);
      });
    }).then(function(result){
      if(store() && typeof store().registerFirebaseUsage === "function"){
        store().registerFirebaseUsage({ reads:Number(result.remoteDocuments || 0),label:result.previewOnly ? "Comparación Firebase." : "Descarga segura Firebase → BDLocal." });
      }
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("firebase",{ connected:true,status:"ok",lastError:"" });
      }
      progress("firebase",100,result.message || "Firebase procesado.");
      log("firebase_guard",result.message || "Firebase procesado.","info",result);
      return result;
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("firebase",{ connected:false,status:"error",lastError:error.message || String(error) });
      }
      progress("firebase",0,"Error al traer Firebase.");
      throw error;
    }).finally(function(){ firebasePulling = false; window.BL2_FIREBASE_PULLING = false; });
  }

  function installFirebaseGuard(m){
    if(!m || m.__externalFirebaseGuardInstalled){ return; }

    m.pullFirebaseToLocal = function(options){
      options = options || {};
      return pullFirebaseToLocalSafe(options.period || null,{ confirm:options.confirm !== false,previewOnly:options.previewOnly === true });
    };

    m.pushLocalToFirebase = function(options){
      options = options || {};
      if(options.manual !== true){ return skipped("firebase","Solicitud automática de Firebase bloqueada.",{ source:options.source || "legacy" }); }
      return getActivePeriod().then(function(period){
        if(!period){ throw new Error("Seleccione un período antes de subir Firebase."); }
        if(!window.BDLSyncOrchestrator || typeof window.BDLSyncOrchestrator.syncTarget !== "function"){
          throw new Error("El orquestador seguro de Firebase no está disponible.");
        }
        return window.BDLSyncOrchestrator.syncTarget("firebase",{
          manual:true,
          source:"ExternalSyncGuard.manual.firebase",
          periodoId:period.id,
          periodoLabel:period.label,
          limit:25,
          batchSize:25
        });
      });
    };

    m.__externalFirebaseGuardInstalled = true;
  }

  function installLegacySyncGuard(){
    var current = sync();
    if(!current || current.__externalSyncGuardInstalled){ return; }

    current.__originalMaybeSyncFirebaseDaily = current.maybeSyncFirebaseDaily;
    current.__originalSyncFirebase = current.syncFirebase;
    current.__originalSyncBeforeClose = current.syncBeforeClose;

    current.maybeSyncFirebaseDaily = function(){
      return skipped("firebase","La sincronización diaria automática de Firebase está desactivada.",{ manualOnly:true });
    };

    current.syncFirebase = function(options){
      options = options || {};
      var action = text(options.action || "upload").toLowerCase();
      if(options.manual !== true){ return skipped("firebase","Ruta legacy automática de Firebase bloqueada.",{ action:action }); }

      if(action === "compare"){
        return pullFirebaseToLocalSafe({ id:options.periodoId,label:options.periodoLabel || options.periodoId },{ confirm:false,previewOnly:true });
      }
      if(action === "download"){
        return pullFirebaseToLocalSafe({ id:options.periodoId,label:options.periodoLabel || options.periodoId },{ confirm:options.confirm !== false,previewOnly:false });
      }
      if(!window.BDLSyncOrchestrator || typeof window.BDLSyncOrchestrator.syncTarget !== "function"){
        return Promise.reject(new Error("El orquestador seguro no está disponible."));
      }
      return window.BDLSyncOrchestrator.syncTarget("firebase",{
        manual:true,
        source:"BL2Sync.legacy.guard",
        periodoId:options.periodoId,
        periodoLabel:options.periodoLabel,
        limit:25,
        batchSize:25
      });
    };

    current.syncBeforeClose = function(){
      return Promise.resolve({ ok:true,skipped:true,manualOnly:true,message:"Sincronización externa al cerrar desactivada. Los pendientes permanecen guardados." });
    };

    current.__externalSyncGuardInstalled = true;
  }

  function install(){
    var m = manager();
    if(m){ installGoogleGuard(m); installFirebaseGuard(m); }
    installLegacySyncGuard();
    if(window.BL2CloudPull){ window.BL2CloudPull.pullFirebaseToLocal = pullFirebaseToLocalSafe; }
    if(window.BL2CloudPullSafe){ window.BL2CloudPullSafe.pullFirebaseToLocal = pullFirebaseToLocalSafe; }
    return !!m && !!sync();
  }

  function boot(){
    install();
    var attempts = 0;
    var timer = window.setInterval(function(){
      attempts += 1;
      if(install() || attempts >= 60){ window.clearInterval(timer); }
    },150);
  }

  window.BL2GooglePushGuard = {
    version:VERSION,
    install:install,
    pausedByPull:googlePaused,
    periodHasFullUpload:periodHasFullUpload,
    markPeriodFullUpload:markPeriodFullUpload
  };

  window.BL2FirebaseGuard = {
    version:VERSION,
    install:install,
    pullFirebaseToLocal:pullFirebaseToLocalSafe,
    previewFirebase:function(period){ return pullFirebaseToLocalSafe(period || null,{ confirm:false,previewOnly:true }); },
    documentId:function(periodoId,identification){ return normalizePeriod(periodoId) + "__" + normalizeCedula(identification); },
    isPulling:function(){ return firebasePulling; }
  };

  if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded",boot); }
  else{ boot(); }
})(window);
