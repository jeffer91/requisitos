/* =========================================================
Nombre completo: bl2.backup.v2.js
Ruta o ubicación: /BDLocal/bl2.backup.v2.js
Función o funciones:
- Unificar el respaldo completo de tablas actuales y legacy.
- Exportar toda BDLocal o únicamente el período activo.
- Previsualizar y restaurar JSON mediante merge seguro.
- Crear respaldo de seguridad antes de una restauración destructiva.
- Montar Respaldos y restauración dentro del Centro de Control.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "0.2.0-control-center";
  var KIND = "BL2_BACKUP_V2";
  var selectedFile = null;
  var selectedPreview = null;
  var legacy = window.BL2Backup || {};

  function id(name){ return document.getElementById(name); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function num(value, fallback){ value = Number(value); return Number.isFinite(value) ? value : fallback; }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function now(){ return new Date().toISOString(); }
  function db(){ return window.BL2DB || null; }
  function config(){ return window.BL2Config || {}; }

  function safeName(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,100) || "BDLOCAL";
  }

  function activePeriod(){
    if(window.BL2App && typeof window.BL2App.getSelectedPeriod === "function"){
      var selected = window.BL2App.getSelectedPeriod();
      if(selected && text(selected.id)){ return Promise.resolve({ id:text(selected.id),label:text(selected.label || selected.id) }); }
    }
    if(window.BL2Core && typeof window.BL2Core.getActivePeriod === "function"){ return window.BL2Core.getActivePeriod(); }
    return Promise.resolve(null);
  }

  function physicalTables(){
    var current = db();
    var meta = current && typeof current.meta === "function" ? current.meta() : {};
    var names = Array.isArray(meta.stores) ? meta.stores.slice() : [];
    if(!names.length && config().stores){ names = Object.keys(config().stores).map(function(key){ return config().stores[key]; }); }
    var seen = Object.create(null);
    return names.filter(function(name){ name = text(name); if(!name || name === "backups" || seen[name]){ return false; } seen[name] = true; return true; });
  }

  function rowPeriod(row){ return text(row && (row.periodoId || row.periodId || row.periodoCanonicoId)); }
  function rowCedula(row){ return text(row && (row.cedula || row.numeroIdentificacion || row.idPersona)); }

  function filterPeriod(table, rows, periodoId, cedulas){
    rows = Array.isArray(rows) ? rows : [];
    if(!periodoId){ return rows; }
    if(table === "settings"){ return rows; }
    if(table === "periodos"){ return rows.filter(function(row){ return text(row.id || row.periodoId) === periodoId; }); }
    if(table === "personas"){ return rows.filter(function(row){ return !!cedulas[rowCedula(row)]; }); }
    return rows.filter(function(row){ return rowPeriod(row) === periodoId; });
  }

  function readTables(names){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    var output = {};
    var chain = Promise.resolve();
    names.forEach(function(name){
      chain = chain.then(function(){
        return current.getAll(name).then(function(rows){ output[name] = Array.isArray(rows) ? rows : []; }).catch(function(error){ output[name] = []; output[name + "__error"] = error.message || String(error); });
      });
    });
    return chain.then(function(){ return output; });
  }

  function summary(tables){
    var result = { tables:0,records:0,detail:{} };
    Object.keys(tables || {}).forEach(function(name){
      if(/__error$/.test(name)){ return; }
      var total = Array.isArray(tables[name]) ? tables[name].length : 0;
      result.tables += 1;
      result.records += total;
      result.detail[name] = total;
    });
    return result;
  }

  function createPayload(options){
    options = options || {};
    var scope = text(options.scope || "all").toLowerCase() === "period" ? "period" : "all";
    return activePeriod().then(function(period){
      period = period || {};
      var periodoId = scope === "period" ? text(options.periodoId || period.id) : "";
      var periodoLabel = scope === "period" ? text(options.periodoLabel || period.label || periodoId) : "Toda BDLocal";
      if(scope === "period" && !periodoId){ throw new Error("Seleccione un período antes de crear el respaldo."); }
      var names = physicalTables();
      return readTables(names).then(function(raw){
        var cedulas = Object.create(null);
        ["matriculas_periodo","estudiantes"].forEach(function(name){
          (raw[name] || []).forEach(function(row){ if(rowPeriod(row) === periodoId){ var cedula = rowCedula(row); if(cedula){ cedulas[cedula] = true; } } });
        });
        var tables = {};
        names.forEach(function(name){ tables[name] = scope === "period" ? filterPeriod(name,raw[name],periodoId,cedulas) : raw[name]; });
        return {
          kind:KIND,
          version:VERSION,
          schemaVersion:text(config().schemaVersion || "2"),
          dbName:text(config().dbName || "REQUISITOS_BL2"),
          type:text(options.type || "manual"),
          scope:scope,
          periodoId:periodoId,
          periodoLabel:periodoLabel,
          exportedAt:now(),
          tables:tables,
          summary:summary(tables)
        };
      });
    });
  }

  function backupStore(){ return text(config().stores && config().stores.backups || "backups"); }

  function saveRecord(payload){
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    var createdAt = now();
    var record = {
      id:"backup_v2_" + createdAt.replace(/[^0-9]/g,"") + "_" + Math.random().toString(16).slice(2),
      type:text(payload.type || "manual"),
      scope:text(payload.scope || "all"),
      periodoId:text(payload.periodoId),
      periodoLabel:text(payload.periodoLabel),
      summary:clone(payload.summary || {}),
      payload:clone(payload),
      createdAt:createdAt,
      updatedAt:createdAt
    };
    return current.put(backupStore(),record).then(function(){ return pruneBackups().then(function(){ return record; }); });
  }

  function pruneBackups(){
    var current = db();
    var keep = Math.max(1,num(config().backup && config().backup.keepLastLocalBackups,5));
    if(!current){ return Promise.resolve({ kept:0,removed:0 }); }
    return current.getAll(backupStore()).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      rows.sort(function(a,b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
      var remove = rows.slice(keep);
      var chain = Promise.resolve();
      remove.forEach(function(row){ chain = chain.then(function(){ return current.remove(backupStore(),row.id); }); });
      return chain.then(function(){ return { kept:Math.min(rows.length,keep),removed:remove.length }; });
    });
  }

  function createBackup(options){
    return createPayload(options || {}).then(function(payload){
      return saveRecord(payload).then(function(record){ return { ok:true,payload:payload,record:record }; });
    });
  }

  function downloadPayload(payload,fileName){
    var label = payload.scope === "period" ? safeName(payload.periodoLabel || payload.periodoId) : "TODA_BDLOCAL";
    var name = fileName || "BL2_RESPALDO_" + label + "_" + now().replace(/[:.]/g,"-") + ".json";
    var blob = new Blob([JSON.stringify(payload,null,2)],{ type:"application/json;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    setTimeout(function(){ URL.revokeObjectURL(link.href); link.remove(); },1000);
    return { fileName:name,size:blob.size };
  }

  function exportManual(options){
    return createBackup(Object.assign({},options || {},{ type:"manual" })).then(function(result){
      var file = downloadPayload(result.payload,options && options.fileName);
      return Object.assign({},result,{ downloaded:true,fileName:file.fileName,size:file.size });
    });
  }

  function listBackups(){
    var current = db();
    if(!current){ return Promise.resolve([]); }
    return current.getAll(backupStore()).then(function(rows){
      rows = Array.isArray(rows) ? rows : [];
      rows.sort(function(a,b){ return text(b.createdAt).localeCompare(text(a.createdAt)); });
      return rows;
    }).catch(function(){ return []; });
  }

  function readFile(file){
    return new Promise(function(resolve,reject){
      if(!file){ reject(new Error("Seleccione un archivo JSON.")); return; }
      var reader = new FileReader();
      reader.onload = function(){ try{ resolve(JSON.parse(String(reader.result || ""))); }catch(error){ reject(new Error("El archivo no contiene JSON válido.")); } };
      reader.onerror = function(){ reject(reader.error || new Error("No se pudo leer el archivo.")); };
      reader.readAsText(file,"utf-8");
    });
  }

  function validatePayload(payload){
    payload = payload || {};
    if(!payload.tables || typeof payload.tables !== "object"){ throw new Error("El respaldo no contiene tablas."); }
    if(payload.kind && payload.kind !== KIND){ throw new Error("El archivo no corresponde a un respaldo compatible de BL2."); }
    return payload;
  }

  function inspectFile(file){
    return readFile(file).then(function(payload){
      validatePayload(payload);
      var available = physicalTables();
      var included = Object.keys(payload.tables).filter(function(name){ return available.indexOf(name) >= 0 && Array.isArray(payload.tables[name]); });
      var ignored = Object.keys(payload.tables).filter(function(name){ return available.indexOf(name) < 0 && !/__error$/.test(name); });
      return { ok:true,payload:payload,scope:text(payload.scope || "desconocido"),periodoId:text(payload.periodoId),periodoLabel:text(payload.periodoLabel),exportedAt:text(payload.exportedAt),tables:included,ignored:ignored,summary:summary(included.reduce(function(out,name){ out[name] = payload.tables[name]; return out; },{})) };
    });
  }

  function sanitizedPayload(payload){
    validatePayload(payload);
    var available = physicalTables();
    var tables = {};
    Object.keys(payload.tables).forEach(function(name){ if(available.indexOf(name) >= 0 && Array.isArray(payload.tables[name])){ tables[name] = payload.tables[name]; } });
    if(!Object.keys(tables).length){ throw new Error("El respaldo no contiene tablas compatibles con esta base."); }
    return Object.assign({},payload,{ tables:tables });
  }

  function restorePayload(payload,options){
    options = options || {};
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    payload = sanitizedPayload(payload);
    var clear = !!options.clearBeforeImport;
    var safety = clear ? createBackup({ scope:"all",type:"pre_restore" }) : Promise.resolve(null);
    return safety.then(function(safetyBackup){
      return current.importAll(payload,{ clearBeforeImport:clear }).then(function(result){
        var output = Object.assign({},result,{ ok:true,clearBeforeImport:clear,safetyBackupId:safetyBackup && safetyBackup.record && safetyBackup.record.id,restoredAt:now() });
        try{ window.dispatchEvent(new CustomEvent("bl2:backup-restored",{ detail:output })); }catch(error){}
        return output;
      });
    });
  }

  function restoreFile(file,options){ return readFile(file).then(function(payload){ return restorePayload(payload,options || {}); }); }

  function autoAfterExcel(periodoId){
    if(config().backup && config().backup.automaticAfterExcel === false){ return Promise.resolve({ ok:true,skipped:true }); }
    return createBackup({ scope:"period",periodoId:periodoId,type:"excel" });
  }

  function dailyIfNeeded(options){
    options = options || {};
    var current = db();
    if(!current){ return Promise.reject(new Error("BL2DB no está disponible.")); }
    if(config().backup && config().backup.automaticDaily === false){ return Promise.resolve({ ok:true,skipped:true }); }
    var key = "lastDailyBackupAt";
    return current.getSetting(key,"").then(function(last){
      if(text(last).slice(0,10) === now().slice(0,10) && !options.force){ return { ok:true,skipped:true,lastBackupAt:last }; }
      return createBackup({ scope:options.scope || "all",periodoId:options.periodoId || "",type:"daily" }).then(function(result){ return current.setSetting(key,now()).then(function(){ return result; }); });
    });
  }

  function renderHistory(){
    var target = id("bl2-backup-history");
    if(!target){ return Promise.resolve([]); }
    return listBackups().then(function(rows){
      if(!rows.length){ target.className = "bdlc-empty"; target.textContent = "No existen respaldos locales registrados."; return rows; }
      target.className = "bdlc-table-wrap";
      target.innerHTML = '<table class="bdlc-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Alcance</th><th>Período</th><th>Registros</th><th>Acción</th></tr></thead><tbody>' + rows.map(function(row){
        return '<tr><td>' + esc(new Date(row.createdAt).toLocaleString("es-EC")) + '</td><td>' + esc(row.type) + '</td><td>' + esc(row.scope) + '</td><td>' + esc(row.periodoLabel || row.periodoId || "Toda BDLocal") + '</td><td>' + esc(row.summary && row.summary.records || "—") + '</td><td><button class="bdlc-button subtle" type="button" data-backup-download="' + esc(row.id) + '">Descargar</button></td></tr>';
      }).join("") + '</tbody></table>';
      target.__backupRows = rows;
      return rows;
    });
  }

  function renderPreview(preview){
    var target = id("bl2-backup-preview");
    if(!target){ return; }
    if(!preview){ target.className = "bdlc-empty"; target.textContent = "Seleccione un JSON para revisar su contenido antes de restaurar."; return; }
    target.className = "bdlc-table-wrap";
    target.innerHTML = '<table class="bdlc-table"><tbody><tr><th>Alcance</th><td>' + esc(preview.scope) + '</td></tr><tr><th>Período</th><td>' + esc(preview.periodoLabel || preview.periodoId || "Toda BDLocal") + '</td></tr><tr><th>Exportado</th><td>' + esc(preview.exportedAt || "Sin fecha") + '</td></tr><tr><th>Tablas compatibles</th><td>' + esc(preview.tables.length) + '</td></tr><tr><th>Registros</th><td>' + esc(preview.summary.records) + '</td></tr><tr><th>Tablas ignoradas</th><td>' + esc(preview.ignored.join(", ") || "Ninguna") + '</td></tr></tbody></table>';
  }

  function setStatus(message,type){
    var target = id("bl2-backup-status");
    if(target){ target.className = "bdlc-alert " + (type || "info"); target.textContent = message; }
  }

  function mount(container){
    if(typeof container === "string"){ container = document.querySelector(container); }
    container = container || id("bl2-backups-slot");
    if(!container){ return Promise.resolve(null); }
    if(container.getAttribute("data-backup-mounted") !== "true"){
      container.className = "";
      container.setAttribute("data-backup-mounted","true");
      container.innerHTML = '<div class="bdlc-card"><div class="bdlc-header"><div><h3>Crear respaldo</h3><p>Los respaldos incluyen tablas V2, operativas, generales y legacy.</p></div><span class="bdlc-status ok">JSON</span></div><div class="bdlc-actions"><button id="bl2-backup-all" class="bdlc-button" type="button">Exportar toda BDLocal</button><button id="bl2-backup-period" class="bdlc-button secondary" type="button">Exportar período activo</button><button id="bl2-backup-refresh" class="bdlc-button subtle" type="button">Actualizar historial</button></div><div id="bl2-backup-status" class="bdlc-alert info">Listo para crear un respaldo.</div></div><div class="bdlc-card"><h3>Respaldos locales recientes</h3><div id="bl2-backup-history" class="bdlc-empty">Consultando...</div></div><div class="bdlc-card"><div class="bdlc-header"><div><h3>Restaurar respaldo</h3><p>Primero se revisa el archivo. El merge no borra datos existentes.</p></div></div><input id="bl2-backup-file" class="bdlc-input" type="file" accept=".json,application/json"><div id="bl2-backup-preview" class="bdlc-empty">Seleccione un JSON para revisar su contenido antes de restaurar.</div><div class="bdlc-actions"><button id="bl2-backup-merge" class="bdlc-button" type="button" disabled>Restaurar mediante merge</button><button id="bl2-backup-clear" class="bdlc-button danger" type="button" disabled>Restaurar limpiando tablas incluidas</button></div></div>';

      id("bl2-backup-all").addEventListener("click",function(){ setStatus("Creando respaldo completo...","info"); exportManual({ scope:"all" }).then(function(result){ setStatus("Respaldo creado: " + result.fileName,"success"); return renderHistory(); }).catch(function(error){ setStatus(error.message || String(error),"error"); }); });
      id("bl2-backup-period").addEventListener("click",function(){ setStatus("Creando respaldo del período activo...","info"); exportManual({ scope:"period" }).then(function(result){ setStatus("Respaldo creado: " + result.fileName,"success"); return renderHistory(); }).catch(function(error){ setStatus(error.message || String(error),"error"); }); });
      id("bl2-backup-refresh").addEventListener("click",renderHistory);
      id("bl2-backup-file").addEventListener("change",function(){
        selectedFile = this.files && this.files[0] || null;
        selectedPreview = null;
        id("bl2-backup-merge").disabled = true;
        id("bl2-backup-clear").disabled = true;
        if(!selectedFile){ renderPreview(null); return; }
        inspectFile(selectedFile).then(function(preview){ selectedPreview = preview; renderPreview(preview); id("bl2-backup-merge").disabled = false; id("bl2-backup-clear").disabled = false; setStatus("Archivo válido. Revise la vista previa.","success"); }).catch(function(error){ renderPreview(null); setStatus(error.message || String(error),"error"); });
      });
      id("bl2-backup-merge").addEventListener("click",function(){ if(!selectedFile || !selectedPreview){ return; } if(!confirm("Restaurar mediante merge. Los registros del JSON actualizarán o agregarán datos. ¿Continuar?")){ return; } setStatus("Restaurando mediante merge...","info"); restoreFile(selectedFile,{ clearBeforeImport:false }).then(function(result){ setStatus("Restauración completa: " + result.imported + " registro(s).","success"); return renderHistory(); }).catch(function(error){ setStatus(error.message || String(error),"error"); }); });
      id("bl2-backup-clear").addEventListener("click",function(){ if(!selectedFile || !selectedPreview){ return; } if(!confirm("Esta operación limpiará únicamente las tablas incluidas en el JSON. Antes se creará un respaldo completo de seguridad. ¿Continuar?")){ return; } setStatus("Creando respaldo de seguridad y restaurando...","warning"); restoreFile(selectedFile,{ clearBeforeImport:true }).then(function(result){ setStatus("Restauración completa. Respaldo de seguridad: " + (result.safetyBackupId || "creado") + ".","success"); return renderHistory(); }).catch(function(error){ setStatus(error.message || String(error),"error"); }); });
      container.addEventListener("click",function(event){
        var button = event.target && event.target.closest ? event.target.closest("[data-backup-download]") : null;
        if(!button){ return; }
        var history = id("bl2-backup-history");
        var rows = history && history.__backupRows || [];
        var row = rows.filter(function(item){ return text(item.id) === text(button.getAttribute("data-backup-download")); })[0];
        if(row && row.payload){ downloadPayload(row.payload); }
      });
    }
    return renderHistory();
  }

  var api = {
    version:VERSION,
    kind:KIND,
    createPayload:createPayload,
    createBackup:createBackup,
    exportBackup:exportManual,
    exportManual:exportManual,
    downloadJSON:downloadPayload,
    listBackups:listBackups,
    inspectFile:inspectFile,
    restorePayload:restorePayload,
    restoreFromPayload:restorePayload,
    restoreFile:restoreFile,
    restoreFromFile:restoreFile,
    autoAfterExcel:autoAfterExcel,
    dailyIfNeeded:dailyIfNeeded,
    pruneBackups:pruneBackups,
    mount:mount,
    bind:function(){ return mount(id("bl2-backups-slot")); }
  };

  window.BL2BackupV2 = api;
  window.BL2Backup = Object.assign({},legacy,api);

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",function(){ api.bind(); });
  }else{
    api.bind();
  }
})(window, document);
