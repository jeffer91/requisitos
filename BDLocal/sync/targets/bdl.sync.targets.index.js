/* =========================================================
Nombre completo: bdl.sync.targets.index.js
Ruta o ubicación: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función o funciones:
- Registrar los destinos Google Sheets, Firebase y Supabase.
- Enviar Google mediante el protocolo real sync_bl2 de Apps Script.
- Leer la configuración protegida desde BDLocalConfigStore.
- Consolidar una versión completa del estudiante para Google Sheets.
- Enviar Supabase a la tabla app_records mediante upsert estable.
- Mantener pendientes sin consumir intentos cuando falta configuración.
- Procesar exclusivamente órdenes manuales y máximo 25 cambios.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.6.1-config-deferred";
  var MAX_BATCH_SIZE = 25;
  var targets = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function normalizeTarget(name){
    name = text(name).toLowerCase();
    if(name === "sheets" || name === "sheet" || name === "google_sheets"){ return "google"; }
    if(name === "firestore"){ return "firebase"; }
    return name;
  }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function tableOf(row){ return text(row && (row.tabla || row.tipo || row.tableKey || "registro")).toLowerCase() || "registro"; }
  function actionOf(row){ return text(row && (row.accion || row.action || "UPSERT")).toUpperCase() || "UPSERT"; }
  function payloadOf(row){ return clone(row && (row.payload || row.data || row.registro) || {}); }
  function store(){ return window.BDLocalConfigStore || null; }
  function core(){ return window.BL2Core || null; }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePeriod(value){
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g,"__");
  }

  function safeRows(rows,options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var limit = Number(options.limit || options.batchSize || MAX_BATCH_SIZE);
    if(!Number.isFinite(limit) || limit <= 0){ limit = MAX_BATCH_SIZE; }
    return rows.slice(0,Math.min(MAX_BATCH_SIZE,Math.floor(limit)));
  }

  function register(name,adapter){
    name = normalizeTarget(name);
    if(!name || !adapter){ return false; }
    targets[name] = adapter;
    return true;
  }
  function get(name){ return targets[normalizeTarget(name)] || null; }
  function list(){ return Object.keys(targets).sort(); }
  function unregister(name){ name = normalizeTarget(name); if(targets[name]){ delete targets[name]; return true; } return false; }

  function fetchJson(url,options,timeoutMs){
    if(!window.fetch){ return Promise.reject(new Error("fetch no disponible en este entorno.")); }
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); },Number(timeoutMs || 90000)) : null;
    options = Object.assign({},options || {});
    if(controller){ options.signal = controller.signal; }
    return fetch(url,options).then(function(response){
      return response.text().then(function(raw){
        var data = {};
        try{ data = raw ? JSON.parse(raw) : {}; }catch(error){ data = { ok:response.ok,raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw new Error(data.message || data.error || "Respuesta ok=false."); }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){ throw new Error("Tiempo agotado en sincronización externa."); }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function sheetsConfig(){
    var current = store();
    if(!current || typeof current.getSheetsConfig !== "function"){
      throw new Error("BDLocalConfigStore.getSheetsConfig no está disponible.");
    }
    var config = current.getSheetsConfig({ includeSecret:true }) || {};
    if(!config.enabled){ throw new Error("Google Sheets está desactivado en la configuración."); }
    if(!text(config.appsScriptUrl)){ throw new Error("Falta la URL de Apps Script."); }
    if(!text(config.token)){ throw new Error("Falta la credencial de Apps Script."); }
    if(!text(config.spreadsheetId)){ throw new Error("Falta el ID de Google Sheets."); }
    return {
      url:text(config.appsScriptUrl),
      token:text(config.token),
      spreadsheetId:text(config.spreadsheetId),
      sheetName:text(config.sheetName || "Requisitos")
    };
  }

  function supabaseConfig(){
    var current = store();
    if(!current || typeof current.getSupabaseConfig !== "function"){
      throw new Error("BDLocalConfigStore.getSupabaseConfig no está disponible.");
    }
    var config = current.getSupabaseConfig({ includeSecret:true }) || {};
    if(!config.enabled){ throw new Error("Supabase está desactivado en la configuración."); }
    if(!text(config.url)){ throw new Error("Falta la URL de Supabase."); }
    if(!text(config.anonKey)){ throw new Error("Falta la clave de acceso de Supabase."); }
    return {
      url:text(config.url).replace(/\/+$/, ""),
      anonKey:text(config.anonKey),
      tableName:text(config.tableName || "app_records") || "app_records"
    };
  }

  function configurationResult(target,error){
    return {
      ok:false,
      blocked:true,
      configurationBlocked:true,
      deferWithoutAttempt:true,
      target:target,
      processedIds:[],
      message:error && error.message ? error.message : String(error)
    };
  }

  function normalizeGoogleChange(row){
    var payload = payloadOf(row);
    return {
      id:rowId(row),
      cambioId:rowId(row),
      tabla:tableOf(row),
      accion:actionOf(row),
      periodoId:normalizePeriod(row && (row.periodoId || payload.periodoId)),
      cedula:normalizeCedula(row && (row.cedula || payload.cedula || payload.numeroIdentificacion)),
      payload:payload,
      updatedAt:text((row && row.updatedAt) || payload.updatedAt || now())
    };
  }

  function googleTable(table){
    table = tableOf({ tabla:table });
    if(["estudiantes","estudiante","matriculas_periodo","matriculas","matricula","personas","persona"].indexOf(table) >= 0){ return "estudiantes"; }
    if(["requisitos_estudiante","requisitos","requisito"].indexOf(table) >= 0){ return "requisitos"; }
    if(["contactos_estudiante","contactos","contacto"].indexOf(table) >= 0){ return "contactos"; }
    if(["notas_titulacion","notas","nota"].indexOf(table) >= 0){ return "notas"; }
    if(["periodos","periodo"].indexOf(table) >= 0){ return "periodos"; }
    return "";
  }

  function uniqueBy(rows,keyFn){
    var map = Object.create(null);
    (rows || []).forEach(function(row){
      var key = text(keyFn(row));
      if(key){ map[key] = row; }
    });
    return Object.keys(map).map(function(key){ return map[key]; });
  }

  function buildGoogleTables(rows,options){
    options = options || {};
    var tables = { periodos:[],estudiantes:[],requisitos:[],contactos:[],notas:[] };
    var studentKeys = Object.create(null);

    rows.forEach(function(row){
      var payload = payloadOf(row);
      var table = googleTable(tableOf(row));
      var cedula = normalizeCedula(row.cedula || payload.cedula || payload.numeroIdentificacion);
      var periodoId = normalizePeriod(row.periodoId || payload.periodoId || options.periodoId);
      if(table && table !== "estudiantes"){
        var item = Object.assign({},payload,{
          periodoId:periodoId || payload.periodoId,
          cedula:cedula || payload.cedula,
          updatedAt:text(payload.updatedAt || row.updatedAt || now())
        });
        tables[table].push(item);
      }
      if(cedula && periodoId){ studentKeys[periodoId + "__" + cedula] = { periodoId:periodoId,cedula:cedula,fallback:payload }; }
    });

    var keys = Object.keys(studentKeys);
    var currentCore = core();
    return Promise.all(keys.map(function(key){
      var item = studentKeys[key];
      if(currentCore && typeof currentCore.getStudentByCedula === "function"){
        return currentCore.getStudentByCedula(item.cedula,item.periodoId).then(function(student){ return student || item.fallback || null; }).catch(function(){ return item.fallback || null; });
      }
      return Promise.resolve(item.fallback || null);
    })).then(function(students){
      tables.estudiantes = students.filter(function(student){ return student && normalizeCedula(student.cedula || student.numeroIdentificacion); });
      tables.estudiantes = uniqueBy(tables.estudiantes,function(row){ return normalizePeriod(row.periodoId || options.periodoId) + "__" + normalizeCedula(row.cedula || row.numeroIdentificacion); });
      tables.periodos = uniqueBy(tables.periodos,function(row){ return normalizePeriod(row.id || row.periodoId || options.periodoId); });
      tables.requisitos = uniqueBy(tables.requisitos,function(row){ return text(row.id || ((row.periodoId || options.periodoId) + "__" + (row.cedula || "") + "__" + (row.requisitoKey || row.key || row.nombre || "requisito"))); });
      tables.contactos = uniqueBy(tables.contactos,function(row){ return text(row.id || ((row.periodoId || options.periodoId) + "__" + (row.cedula || "") + "__" + (row.tipoKey || row.tipo || "contacto"))); });
      tables.notas = uniqueBy(tables.notas,function(row){ return text(row.idEstudiantePeriodo || row.id || ((row.periodoId || options.periodoId) + "__" + (row.cedula || ""))); });
      return tables;
    });
  }

  function pushGoogleRows(pendingRows,options){
    options = Object.assign({},options || {});
    if(options.manual !== true){ return Promise.resolve({ ok:false,blocked:true,deferWithoutAttempt:true,target:"google",processedIds:[],message:"Google Sheets solo admite subida manual." }); }
    var rows = safeRows(pendingRows,options);
    if(!rows.length){ return Promise.resolve({ ok:true,target:"google",processedIds:[],message:"Google Sheets: no hay cambios para enviar." }); }
    if(!text(options.periodoId)){ return Promise.resolve({ ok:false,blocked:true,deferWithoutAttempt:true,target:"google",processedIds:[],message:"Seleccione un período antes de subir a Google Sheets." }); }

    var cfg;
    try{ cfg = sheetsConfig(); }
    catch(error){ return Promise.resolve(configurationResult("google",error)); }

    return buildGoogleTables(rows,options).then(function(tables){
      var changes = rows.map(normalizeGoogleChange);
      var payload = {
        action:"sync_bl2",
        target:"google_sheets",
        source:text(options.source || "BDLSyncTargets.google"),
        token:cfg.token,
        spreadsheetId:cfg.spreadsheetId,
        sheetName:cfg.sheetName,
        mode:"changes",
        periodoId:normalizePeriod(options.periodoId),
        periodoLabel:text(options.periodoLabel || options.periodoId),
        generatedAt:now(),
        commonFields:["periodoId","cedula","updatedAt"],
        changes:changes,
        tables:tables
      };
      return fetchJson(cfg.url,{
        method:"POST",
        mode:"cors",
        redirect:"follow",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body:JSON.stringify(payload)
      },options.timeoutMs || 120000).then(function(response){
        var processedIds = rows.map(rowId).filter(Boolean);
        if(store() && typeof store().patchConfig === "function"){
          store().patchConfig({ sheets:{ connected:true,status:"ok",lastSyncAt:now(),lastDeltaUploadAt:now(),lastError:"" } });
        }
        return { ok:true,target:"google",processedIds:processedIds,response:response,message:"Google Sheets actualizado: " + processedIds.length + " cambio(s) confirmado(s)." };
      });
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("sheets",{ connected:false,status:"error",lastError:error.message || String(error) });
      }
      return { ok:false,target:"google",processedIds:[],message:error.message || String(error) };
    });
  }

  function supabaseRecord(row,options){
    var payload = payloadOf(row);
    var table = tableOf(row);
    var changeId = rowId(row);
    var periodoId = normalizePeriod(row.periodoId || payload.periodoId || options.periodoId);
    var cedula = normalizeCedula(row.cedula || payload.cedula || payload.numeroIdentificacion);
    var recordKey = text(row.registroId || payload.idEstudiantePeriodo || payload.id || cedula || changeId);
    return {
      id:table + "__" + periodoId + "__" + recordKey,
      module_key:"requisitos",
      table_key:table,
      record_key:recordKey,
      periodo_id:periodoId,
      estudiante_id:text(payload.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : "")),
      source:"bdlocal",
      sync_status:"sincronizado",
      schema_version:"2",
      payload:Object.assign({},payload,{
        periodoId:periodoId,
        cedula:cedula || payload.cedula,
        updatedAt:text(payload.updatedAt || row.updatedAt || now()),
        syncChangeId:changeId,
        syncSource:"BDLocal"
      })
    };
  }

  function pushSupabaseRows(pendingRows,options){
    options = Object.assign({},options || {});
    if(options.manual !== true){ return Promise.resolve({ ok:false,blocked:true,deferWithoutAttempt:true,target:"supabase",processedIds:[],message:"Supabase solo admite subida manual." }); }
    var rows = safeRows(pendingRows,options);
    if(!rows.length){ return Promise.resolve({ ok:true,target:"supabase",processedIds:[],message:"Supabase: no hay cambios para enviar." }); }
    if(!text(options.periodoId)){ return Promise.resolve({ ok:false,blocked:true,deferWithoutAttempt:true,target:"supabase",processedIds:[],message:"Seleccione un período antes de subir a Supabase." }); }

    var cfg;
    try{ cfg = supabaseConfig(); }
    catch(error){ return Promise.resolve(configurationResult("supabase",error)); }

    var records = rows.map(function(row){ return supabaseRecord(row,options); }).filter(function(record){ return !!text(record.id); });
    if(!records.length){ return Promise.resolve({ ok:false,target:"supabase",processedIds:[],message:"No existen registros válidos para Supabase." }); }

    var endpoint = cfg.url + "/rest/v1/" + encodeURIComponent(cfg.tableName) + "?on_conflict=id";
    return fetchJson(endpoint,{
      method:"POST",
      mode:"cors",
      headers:{
        "Content-Type":"application/json",
        "apikey":cfg.anonKey,
        "Authorization":"Bearer " + cfg.anonKey,
        "Prefer":"resolution=merge-duplicates,return=minimal"
      },
      body:JSON.stringify(records)
    },options.timeoutMs || 90000).then(function(response){
      var processedIds = rows.map(rowId).filter(Boolean);
      if(store() && typeof store().patchConfig === "function"){
        store().patchConfig({ supabase:{ connected:true,status:"ok",lastSyncAt:now(),lastError:"" } });
      }
      return { ok:true,target:"supabase",processedIds:processedIds,response:response,message:"Supabase actualizado: " + processedIds.length + " cambio(s) confirmado(s)." };
    }).catch(function(error){
      if(store() && typeof store().updateConnectionStatus === "function"){
        store().updateConnectionStatus("supabase",{ connected:false,status:"error",lastError:error.message || String(error) });
      }
      return { ok:false,target:"supabase",processedIds:[],message:error.message || String(error) };
    });
  }

  var googleAdapter = { version:VERSION,target:"google",push:pushGoogleRows };
  var supabaseAdapter = { version:VERSION,target:"supabase",push:pushSupabaseRows };
  register("google",googleAdapter);
  register("sheets",googleAdapter);
  register("supabase",supabaseAdapter);

  window.BDLSyncTargets = {
    version:VERSION,
    maxBatchSize:MAX_BATCH_SIZE,
    register:register,
    unregister:unregister,
    get:get,
    list:list,
    normalizeTarget:normalizeTarget,
    payloadOf:payloadOf,
    rowId:rowId,
    safeRows:safeRows,
    fetchJson:fetchJson,
    diagnostics:{ sheetsConfig:sheetsConfig,supabaseConfig:supabaseConfig,buildGoogleTables:buildGoogleTables,supabaseRecord:supabaseRecord,configurationResult:configurationResult }
  };
})(window);
