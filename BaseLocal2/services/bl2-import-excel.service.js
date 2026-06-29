/* =========================================================
Nombre completo: bl2-import-excel.service.js
Ruta o ubicación: /Requisitos/BaseLocal2/services/bl2-import-excel.service.js
Función o funciones:
- Coordinar la importación Excel hacia Base Local V1 y copia BL2.
- Procesar filas en Web Worker cuando esté disponible.
- Mantener la app funcional si Worker, IndexedDB o BL2 fallan.
- Copiar hacia BL2 en segundo plano después de guardar la Base Local V1.
Con qué se conecta:
- workers/bl2-import.worker.js
- bl2-matricula.service.js
- BL2Storage
- ExcelLocalRepo
- excel-ui.cargar.js
========================================================= */
(function(window, document){
  "use strict";

  var STATUS_KEY = "REQ_BL2_IMPORT_EXCEL_STATUS";
  var copyTimer = null;
  var currentScriptUrl = (document.currentScript && document.currentScript.src) || "";

  function text(value){return String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function writeStatus(status){
    var payload = Object.assign({updatedAt:now()}, status || {});
    try{window.localStorage.setItem(STATUS_KEY, JSON.stringify(payload));}catch(error){}
    try{window.dispatchEvent(new CustomEvent("bl2:import:status", {detail:payload}));}catch(error){}
    return payload;
  }
  function readStatus(){try{var raw=window.localStorage.getItem(STATUS_KEY);return raw?JSON.parse(raw):{mode:"idle"};}catch(error){return {mode:"idle"};}}
  function yieldUi(){return new Promise(function(resolve){setTimeout(resolve, 0);});}
  function workerUrl(){try{return new URL("../workers/bl2-import.worker.js", currentScriptUrl || window.location.href).href;}catch(error){return "../workers/bl2-import.worker.js";}}

  function processInWorker(payload){
    return new Promise(function(resolve, reject){
      if(!window.Worker){reject(new Error("Worker no disponible."));return;}
      var worker;
      try{worker = new Worker(workerUrl());}catch(error){reject(error);return;}
      var finished = false;
      var timeout = setTimeout(function(){if(!finished){finished=true;try{worker.terminate();}catch(error){}reject(new Error("Worker de importación tardó demasiado."));}}, 120000);
      worker.onmessage = function(event){
        var data = event.data || {};
        if(data.type === "progress"){
          writeStatus({mode:"processing", source:"worker", done:data.done, total:data.total});
          return;
        }
        if(data.type === "done"){
          finished = true;
          clearTimeout(timeout);
          try{worker.terminate();}catch(error){}
          resolve(data.result || {rows:[], stats:{}});
          return;
        }
        if(data.type === "error"){
          finished = true;
          clearTimeout(timeout);
          try{worker.terminate();}catch(error){}
          reject(new Error(data.message || "Error en worker de importación."));
        }
      };
      worker.onerror = function(error){
        if(finished){return;}
        finished = true;
        clearTimeout(timeout);
        try{worker.terminate();}catch(e){}
        reject(error && error.message ? new Error(error.message) : new Error("Error en worker de importación."));
      };
      worker.postMessage({type:"PROCESS_ANALYSIS", payload:payload});
    });
  }

  function processFallback(payload){
    var svc = window.BL2MatriculaService;
    if(!svc || typeof svc.normalizeRows !== "function"){
      return Promise.resolve({rows:Array.isArray(payload.rows)?payload.rows:[], stats:{totalIncoming:(payload.rows||[]).length, normalized:(payload.rows||[]).length, fallback:true}, processedAt:now()});
    }
    return yieldUi().then(function(){return svc.normalizeRows(payload.rows || [], payload.period || {id:payload.periodoId, label:payload.periodoLabel});});
  }

  function processRows(payload){
    payload = payload || {};
    writeStatus({mode:"processing", source:"worker_or_fallback", total:(payload.rows || []).length});
    return processInWorker(payload).catch(function(error){
      console.warn("[BL2ImportExcel] Worker no usado, se procesa con fallback", error);
      writeStatus({mode:"processing", source:"fallback", warning:error.message || String(error), total:(payload.rows || []).length});
      return processFallback(payload);
    });
  }

  function copyToBL2Later(reason){
    if(copyTimer){clearTimeout(copyTimer);}
    copyTimer = setTimeout(function(){
      copyTimer = null;
      try{
        if(window.BL2Storage && typeof window.BL2Storage.copyFromLegacy === "function"){
          writeStatus({mode:"copying_bl2", reason:reason || "excel_import"});
          window.BL2Storage.copyFromLegacy({force:true}).then(function(result){
            writeStatus({mode:"copied_bl2", ok:result && result.ok !== false, result:result});
            try{if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){window.BL2CacheResumen.invalidate();}}catch(error){}
          }).catch(function(error){writeStatus({mode:"copy_bl2_error", ok:false, message:error.message || String(error)});});
        }
      }catch(error){writeStatus({mode:"copy_bl2_error", ok:false, message:error.message || String(error)});}
    }, 900);
  }

  async function importAnalysis(payload, options){
    payload = payload || {};
    options = options || {};
    var period = {id:payload.periodoId || payload.periodId || "", label:payload.periodoLabel || payload.periodLabel || payload.periodoId || ""};
    var rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    writeStatus({mode:"started", fileName:text(payload.fileName), periodoId:period.id, rows:rawRows.length});
    var processed = await processRows(Object.assign({}, payload, {period:period, rows:rawRows}));
    var finalPayload = Object.assign({}, payload, {rows:processed.rows || rawRows, bl2ImportStats:processed.stats || null});
    await yieldUi();
    var saved = null;
    if(options.saveLegacy !== false){
      if(!window.ExcelLocalRepo || typeof window.ExcelLocalRepo.saveAnalysis !== "function"){throw new Error("ExcelLocalRepo.saveAnalysis no disponible.");}
      writeStatus({mode:"saving_legacy", fileName:text(payload.fileName), periodoId:period.id, rows:finalPayload.rows.length, workerStats:processed.stats || null});
      saved = window.ExcelLocalRepo.saveAnalysis(finalPayload);
    }
    writeStatus({mode:"saved_legacy", ok:true, fileName:text(payload.fileName), periodoId:period.id, rows:finalPayload.rows.length, workerStats:processed.stats || null});
    copyToBL2Later("excel_import");
    return {ok:true, saved:saved, processed:processed, payload:finalPayload};
  }

  window.BL2ImportExcelService = {version:"2.0.0-alpha.1",status:readStatus,writeStatus:writeStatus,processRows:processRows,importAnalysis:importAnalysis,copyToBL2Later:copyToBL2Later};
})(window, document);
