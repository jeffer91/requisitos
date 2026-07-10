/* =========================================================
Nombre completo: bl2.google-push.guard.js
Ruta o ubicación: /BDLocal/bl2.google-push.guard.js
Función o funciones:
- Proteger las rutas legacy de Firebase sin crear una segunda puerta de salida.
- Delegar toda subida manual a BDLSyncV2.
- Bloquear sincronizaciones automáticas, al cerrar o en paralelo.
- Traer Firebase por período con comparación previa y respaldo obligatorio.
- Proteger cambios locales pendientes o más recientes.
- Controlar la cuota antes y después de leer Firebase.
- Impedir aplicar una lectura parcial causada por el límite de cuota.
- No usar intervalos ni iniciar procesos externos durante el arranque.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "4.1.0-read-quota-safe";
  var firebasePulling = false;
  var installed = false;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
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

  function skipped(target,message,data){
    log(target + "_guard",message,"warn",data || {});
    return Promise.resolve({ ok:true,skipped:true,blocked:true,target:target,message:message,data:data || {},at:now() });
  }

  function getActivePeriod(){
    try{
      if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
        var selected = window.BL2App.getSelectedPeriod();
        if(selected && text(selected.id)){
          return Promise.resolve({ id:normalizePeriod(selected.id),label:text(selected.label || selected.id) });
        }
      }
    }catch(error){}

    if(core() && typeof core().getActivePeriod === "function"){
      return core().getActivePeriod().then(function(period){
        return period && text(period.id)
          ? { id:normalizePeriod(period.id),label:text(period.label || period.periodoLabel || period.id) }
          : null;
      });
    }
    return Promise.resolve(null);
  }

  function requestManualTarget(target,options){
    options = Object.assign({},options || {});
    if(options.manual !== true){
      return skipped(target,"Solicitud automática bloqueada. La sincronización externa es manual.",{ source:options.source || "legacy" });
    }
    if(!window.BDLSyncV2 || typeof window.BDLSyncV2.request !== "function"){
      return Promise.reject(new Error("BDLSyncV2 no está disponible."));
    }

    var periodPromise = text(options.periodoId)
      ? Promise.resolve({ id:normalizePeriod(options.periodoId),label:text(options.periodoLabel || options.periodoId) })
      : getActivePeriod();

    return periodPromise.then(function(period){
      if(!period){ throw new Error("Seleccione un período antes de sincronizar."); }
      return window.BDLSyncV2.request({
        manual:true,
        automatic:false,
        source:text(options.source || "ExternalSyncGuard.manual." + target),
        targets:[target],
        periodoId:period.id,
        periodoLabel:period.label,
        cedula:text(options.cedula),
        tabla:text(options.tabla),
        forceRetry:options.forceRetry === true,
        ignoreRetry:options.ignoreRetry === true || options.forceRetry === true,
        limit:Math.min(25,Math.max(1,Number(options.limit || options.batchSize || 25))),
        batchSize:Math.min(25,Math.max(1,Number(options.limit || options.batchSize || 25)))
      });
    });
  }

  function firebaseCollection(){
    var cfg = window.BL2Config && window.BL2Config.firebase || {};
    return text(cfg.collection || "Estudiantes") || "Estudiantes";
  }

  function ensureFirebase(){
    if(!sync() || typeof sync().ensureFirebase !== "function"){
      return Promise.reject(new Error("Firebase no está disponible."));
    }
    return sync().ensureFirebase();
  }

  function firebaseReadBudget(){
    var currentStore = store();
    if(!currentStore || typeof currentStore.getFirebaseQuotaStatus !== "function"){
      return { controlled:false,allowed:true,readLimit:500,used:0,limit:500,stopPercent:100 };
    }

    var firstCheck = currentStore.getFirebaseQuotaStatus(1) || {};
    if(firstCheck.allowed === false){
      throw new Error("Lectura Firebase bloqueada por cuota manual: " + Number(firstCheck.used || 0) + " / " + Number(firstCheck.limit || 0) + ".");
    }

    var config = typeof currentStore.loadConfig === "function" ? currentStore.loadConfig() || {} : {};
    var firebase = config.firebase || {};
    var limit = Math.max(1,Number(firstCheck.limit || firebase.dailyLimit || 500));
    var used = Math.max(0,Number(firstCheck.used || 0));
    var stopPercent = Math.max(1,Math.min(100,Number(firebase.stopPercent || 95)));
    var stopAt = Math.max(1,Math.floor(limit * stopPercent / 100));
    var available = Math.max(0,stopAt - used - 1);

    if(available < 1){
      throw new Error("No existe cuota segura disponible para consultar Firebase. Uso actual: " + used + " / " + limit + ".");
    }

    return {
      controlled:true,
      allowed:true,
      readLimit:Math.min(500,available),
      used:used,
      limit:limit,
      stopPercent:stopPercent,
      stopAt:stopAt,
      available:available
    };
  }

  function registerReadUsage(reads,label){
    var currentStore = store();
    if(currentStore && typeof currentStore.registerFirebaseUsage === "function"){
      currentStore.registerFirebaseUsage({ reads:Number(reads || 0),label:label || "Lectura Firebase por período." });
    }
  }

  function remoteTime(row){
    var value = Date.parse(text(row && (row.updatedAt || row.ultimaSincronizacion || row.createdAt)));
    return Number.isFinite(value) ? value : 0;
  }

  function readFirebasePeriod(period){
    var budget;
    try{ budget = firebaseReadBudget(); }
    catch(error){ return Promise.reject(error); }

    return ensureFirebase().then(function(firestore){
      var query = firestore.collection(firebaseCollection()).where("periodoId","==",period.id);
      if(budget.readLimit && typeof query.limit === "function"){ query = query.limit(budget.readLimit); }
      return query.get();
    }).then(function(snapshot){
      var reads = Number(snapshot.size || 0);
      registerReadUsage(reads,"Consulta segura Firebase del período " + period.id + ".");

      var map = Object.create(null);
      var duplicates = 0;
      snapshot.forEach(function(doc){
        var data = Object.assign({},doc.data() || {});
        var documentId = text(doc.id);
        var prefix = period.id + "__";
        var fallbackCedula = documentId.indexOf(prefix) === 0 ? documentId.slice(prefix.length) : documentId;
        var cedula = normalizeCedula(data.cedula || data.numeroIdentificacion || fallbackCedula);
        if(!cedula){ return; }

        data.cedula = cedula;
        data.numeroIdentificacion = text(data.numeroIdentificacion || cedula);
        data.periodoId = period.id;
        data.periodoCanonicoId = period.id;
        data.periodoLabel = text(data.periodoLabel || data.periodoCanonicoLabel || period.label || period.id);
        data.firebaseDocumentId = documentId;
        data.source = "firebase_pull";

        if(map[cedula]){
          duplicates += 1;
          var currentStable = map[cedula].firebaseDocumentId === prefix + cedula;
          var incomingStable = documentId === prefix + cedula;
          if(remoteTime(data) < remoteTime(map[cedula])){ return; }
          if(remoteTime(data) === remoteTime(map[cedula]) && currentStable && !incomingStable){ return; }
        }
        map[cedula] = data;
      });

      var truncated = !!(budget.controlled && reads >= budget.readLimit);
      return {
        rows:Object.keys(map).map(function(cedula){ return map[cedula]; }),
        rawCount:reads,
        duplicates:duplicates,
        truncated:truncated,
        readLimit:budget.readLimit,
        quotaBefore:budget
      };
    });
  }

  function localPendingMap(periodoId){
    if(!outbox() || typeof outbox().list !== "function"){ return Promise.resolve({}); }
    return outbox().list({ periodoId:periodoId }).then(function(rows){
      var map = Object.create(null);
      (rows || []).forEach(function(row){
        var payload = row.payload || row.data || row.registro || {};
        var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || payload.cedula || payload.numeroIdentificacion);
        if(!cedula){ return; }
        var open = ["google","firebase","supabase"].some(function(target){
          return typeof outbox().isDone !== "function" || !outbox().isDone(row,target);
        });
        if(open){ map[cedula] = true; }
      });
      return map;
    }).catch(function(){ return {}; });
  }

  function compareRecords(local,remote){
    if(core() && typeof core().compareRecords === "function"){
      var result = core().compareRecords(local,remote);
      if(result === "remote" || result === "local" || result === "equal"){ return result; }
    }
    var localAt = remoteTime(local);
    var remoteAt = remoteTime(remote);
    if(localAt && remoteAt){
      if(remoteAt > localAt){ return "remote"; }
      if(localAt > remoteAt){ return "local"; }
      return "equal";
    }
    return "ambiguous";
  }

  function buildFirebasePreview(period){
    if(!core() || typeof core().getStudents !== "function"){
      return Promise.reject(new Error("BL2Core.getStudents no está disponible."));
    }
    progress("firebase",15,"Leyendo Firebase del período " + period.label + "...");

    return Promise.all([
      readFirebasePeriod(period),
      core().getStudents({ periodoId:period.id }),
      localPendingMap(period.id)
    ]).then(function(values){
      var remote = values[0];
      var localRows = values[1] || [];
      var pending = values[2] || {};
      var localMap = Object.create(null);
      localRows.forEach(function(row){
        var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion);
        if(cedula){ localMap[cedula] = row; }
      });

      var apply = [];
      var equal = [];
      var localNewer = [];
      var pendingConflict = [];
      var ambiguous = [];

      remote.rows.forEach(function(remoteRow){
        var cedula = normalizeCedula(remoteRow.cedula || remoteRow.numeroIdentificacion);
        var local = localMap[cedula];
        if(pending[cedula]){ pendingConflict.push(cedula); return; }
        if(!local){ apply.push(remoteRow); return; }

        var winner = compareRecords(local,remoteRow);
        if(winner === "remote"){ apply.push(remoteRow); }
        else if(winner === "equal"){ equal.push(cedula); }
        else if(winner === "local"){ localNewer.push(cedula); }
        else{ ambiguous.push(cedula); }
      });

      return {
        ok:true,
        period:period,
        rowsToApply:apply,
        remoteDocuments:remote.rawCount,
        remoteUnique:remote.rows.length,
        duplicateDocumentsIgnored:remote.duplicates,
        truncated:remote.truncated,
        readLimit:remote.readLimit,
        quotaBefore:remote.quotaBefore,
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
    return Object.assign({},preview,{
      rowsToApply:undefined,
      previewOnly:true,
      message:preview.truncated
        ? "Comparación Firebase incompleta por límite de cuota. No se puede aplicar esta lectura."
        : "Comparación Firebase finalizada sin modificar Base Local."
    });
  }

  function createSafetyBackup(period){
    var backup = window.BL2BackupV2 || window.BL2Backup;
    if(!backup || typeof backup.createBackup !== "function"){
      return Promise.reject(new Error("No se puede aplicar Firebase sin crear un respaldo de seguridad."));
    }
    return backup.createBackup({ scope:"period",periodoId:period.id,periodoLabel:period.label,type:"pre_firebase_pull" });
  }

  function markImportedChanges(changes){
    changes = Array.isArray(changes) ? changes : [];
    if(!changes.length || !outbox() || typeof outbox().markSynced !== "function"){ return Promise.resolve(); }
    var chain = Promise.resolve();
    ["firebase","google","supabase"].forEach(function(target){
      chain = chain.then(function(){
        return outbox().markSynced(changes,target,{ syncedAt:now(),source:"firebase_pull",imported:true });
      });
    });
    return chain;
  }

  function applyFirebasePreview(preview){
    if(preview.truncated){
      return Promise.reject(new Error("Firebase no se aplicó porque la cuota solo permitió una lectura parcial del período."));
    }
    if(!preview.rowsToApply.length){
      return Promise.resolve(Object.assign({},publicPreview(preview),{
        previewOnly:false,
        applied:0,
        message:"Firebase no tiene cambios seguros para aplicar."
      }));
    }

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
            applied:preview.rowsToApply.length,
            summary:summary,
            safetyBackupId:backup && backup.record && backup.record.id || "",
            message:"Firebase → Base Local completado sin generar reenvíos. Aplicados: " + preview.rowsToApply.length + "."
          });
        });
      });
    });
  }

  function pullFirebaseToLocalSafe(period,options){
    options = options || {};
    if(firebasePulling){ return skipped("firebase","Ya existe una descarga Firebase en curso.",{}); }

    var periodPromise = period && period.id
      ? Promise.resolve({ id:normalizePeriod(period.id),label:text(period.label || period.id) })
      : getActivePeriod();

    firebasePulling = true;
    window.BL2_FIREBASE_PULLING = true;

    return periodPromise.then(function(current){
      if(!current){ throw new Error("Seleccione un período antes de traer Firebase."); }
      return buildFirebasePreview(current).then(function(preview){
        if(options.previewOnly === true){ return publicPreview(preview); }
        if(preview.truncated){
          return Object.assign({},publicPreview(preview),{
            previewOnly:false,
            blocked:true,
            applied:0,
            message:"Lectura parcial por cuota. No se aplicó ningún dato de Firebase."
          });
        }

        var approved = options.confirm === false || window.confirm(
          "Firebase → Base Local\n\n" +
          "Período: " + current.label + "\n" +
          "Documentos leídos: " + preview.remoteDocuments + "\n" +
          "Registros únicos: " + preview.remoteUnique + "\n" +
          "Cambios seguros para aplicar: " + preview.apply + "\n" +
          "Cambios locales protegidos: " + preview.pendingConflict + "\n" +
          "Locales más recientes: " + preview.localNewer + "\n" +
          "Casos ambiguos protegidos: " + preview.ambiguous + "\n" +
          "Duplicados remotos ignorados: " + preview.duplicateDocumentsIgnored + "\n\n" +
          "Se creará un respaldo y no se marcarán estudiantes como retirados. ¿Continuar?"
        );

        if(!approved){
          return Object.assign({},publicPreview(preview),{ previewOnly:false,cancelled:true,message:"Descarga cancelada." });
        }
        return applyFirebasePreview(preview);
      });
    }).then(function(result){
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("firebase",{ connected:true,status:result.blocked ? "warning" : "ok",lastError:result.blocked ? result.message : "" });
      }
      progress("firebase",100,result.message || "Firebase procesado.");
      log("firebase_guard",result.message || "Firebase procesado.",result.blocked ? "warn" : "info",result);
      return result;
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("firebase",{ connected:false,status:"error",lastError:error.message || String(error) });
      }
      progress("firebase",0,"Error al traer Firebase.");
      throw error;
    }).finally(function(){
      firebasePulling = false;
      window.BL2_FIREBASE_PULLING = false;
    });
  }

  function installManagerGuard(currentManager){
    if(!currentManager){ return false; }
    currentManager.pullFirebaseToLocal = function(options){
      options = options || {};
      return pullFirebaseToLocalSafe(options.period || null,{
        confirm:options.confirm !== false,
        previewOnly:options.previewOnly === true
      });
    };

    /*
     * No se reemplazan pushLocalToSheets, pushLocalToFirebase ni syncQueue.
     * Esas rutas pertenecen exclusivamente a BDLocalSyncFixups -> BDLSyncV2.
     */
    currentManager.__externalFirebasePullGuardInstalled = true;
    return true;
  }

  function installLegacySyncGuard(){
    var current = sync();
    if(!current){ return false; }

    current.maybeSyncFirebaseDaily = function(){
      return skipped("firebase","La sincronización diaria automática de Firebase está desactivada.",{ manualOnly:true });
    };

    current.syncBeforeClose = function(){
      return Promise.resolve({ ok:true,skipped:true,manualOnly:true,message:"Sincronización externa al cerrar desactivada. Los pendientes permanecen guardados." });
    };

    current.syncFirebase = function(options){
      options = options || {};
      var action = text(options.action || "upload").toLowerCase();
      if(action === "compare"){
        return pullFirebaseToLocalSafe({ id:options.periodoId,label:options.periodoLabel || options.periodoId },{ confirm:false,previewOnly:true });
      }
      if(action === "download"){
        return pullFirebaseToLocalSafe({ id:options.periodoId,label:options.periodoLabel || options.periodoId },{ confirm:options.confirm !== false,previewOnly:false });
      }
      return requestManualTarget("firebase",Object.assign({},options,{ source:"BL2Sync.legacy.single-gate" }));
    };

    current.__externalSyncGuardInstalled = true;
    return true;
  }

  function install(){
    var managerReady = installManagerGuard(manager());
    var syncReady = installLegacySyncGuard();
    if(window.BL2CloudPull){ window.BL2CloudPull.pullFirebaseToLocal = pullFirebaseToLocalSafe; }
    if(window.BL2CloudPullSafe){ window.BL2CloudPullSafe.pullFirebaseToLocal = pullFirebaseToLocalSafe; }
    installed = managerReady && syncReady;
    return installed;
  }

  window.BL2GooglePushGuard = {
    version:VERSION,
    manualOnly:true,
    singleGate:true,
    install:install,
    requestManualTarget:requestManualTarget,
    status:function(){ return { version:VERSION,installed:installed,singleGate:true,intervals:false,readQuota:true }; }
  };

  window.BL2FirebaseGuard = {
    version:VERSION,
    manualOnly:true,
    singleGate:true,
    install:install,
    pullFirebaseToLocal:pullFirebaseToLocalSafe,
    previewFirebase:function(period){ return pullFirebaseToLocalSafe(period || null,{ confirm:false,previewOnly:true }); },
    documentId:function(periodoId,cedula){ return normalizePeriod(periodoId) + "__" + normalizeCedula(cedula); },
    isPulling:function(){ return firebasePulling; },
    readBudget:firebaseReadBudget,
    status:function(){ return { version:VERSION,installed:installed,pulling:firebasePulling,singleGate:true,readQuota:true }; }
  };

  window.addEventListener("bdlocal:bl2-html-scripts-loaded",install,{ once:true });
  if(!document.querySelector("script[data-bl2-loader-src]")){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded",install,{ once:true });
    }else{
      install();
    }
  }
})(window,document);
