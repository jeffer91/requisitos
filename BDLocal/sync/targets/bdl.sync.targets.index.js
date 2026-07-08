/* =========================================================
Archivo: bdl.sync.targets.index.js
Ruta: /BDLocal/sync/targets/bdl.sync.targets.index.js
Función:
- Registro de destinos de sincronización.
- Adaptador Google Sheets para cambios_pendientes genéricos.
- Adaptador Supabase para cambios_pendientes genéricos.
- Mantener Firebase registrable desde bdl.sync.target.firebase.js.
- Devolver processedIds para marcar solo cambios confirmados.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.5.0-manual-targets";
  var targets = Object.create(null);

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function rowId(row){ return text(row && (row.id || row.cambioId)); }
  function tableOf(row){ return text(row && (row.tabla || row.tipo || row.tableKey || "registro")).toLowerCase() || "registro"; }
  function actionOf(row){ return text(row && (row.accion || row.action || "UPSERT")).toUpperCase() || "UPSERT"; }
  function payloadOf(row){ return Object.assign({}, row && row.payload ? row.payload : row || {}); }
  function store(){ return window.BDLocalConfigStore || null; }

  function normalizeTarget(name){
    name = text(name).toLowerCase();
    if(name === "sheets" || name === "sheet" || name === "google_sheets"){ return "google"; }
    if(name === "firestore"){ return "firebase"; }
    return name;
  }

  function register(name, adapter){
    name = normalizeTarget(name);
    if(!name || !adapter){ return false; }
    targets[name] = adapter;
    return true;
  }

  function get(name){ return targets[normalizeTarget(name)] || null; }
  function list(){ return Object.keys(targets).sort(); }
  function unregister(name){ name = normalizeTarget(name); if(targets[name]){ delete targets[name]; return true; } return false; }

  function groupByTable(rows){
    var grouped = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var table = tableOf(row);
      if(!grouped[table]){ grouped[table] = []; }
      grouped[table].push(row);
    });
    return grouped;
  }

  function fetchJson(url, options, timeoutMs){
    if(!window.fetch){ return Promise.reject(new Error("fetch no disponible en este entorno.")); }
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? window.setTimeout(function(){ controller.abort(); }, timeoutMs || 60000) : null;
    options = options || {};
    if(controller){ options.signal = controller.signal; }

    return fetch(url, options).then(function(response){
      return response.text().then(function(raw){
        var data = {};
        try{ data = raw ? JSON.parse(raw) : {}; }catch(error){ data = { ok:response.ok, raw:raw }; }
        if(!response.ok){ throw new Error(data.message || data.error || ("HTTP " + response.status)); }
        if(data && data.ok === false){ throw new Error(data.message || data.error || "Respuesta ok=false."); }
        return data;
      });
    }).catch(function(error){
      if(error && error.name === "AbortError"){ throw new Error("Tiempo agotado en sincronización externa."); }
      throw error;
    }).finally(function(){ if(timer){ window.clearTimeout(timer); } });
  }

  function readConfigPath(path, fallback){
    var cfgStore = store();
    if(cfgStore && typeof cfgStore.getPath === "function"){
      try{
        var value = cfgStore.getPath(path);
        if(value != null && value !== ""){ return value; }
      }catch(error){}
    }
    return fallback;
  }

  function readConfigObject(key){
    var cfgStore = store();
    if(cfgStore && typeof cfgStore.get === "function"){
      try{ return cfgStore.get(key) || {}; }catch(error){}
    }
    return {};
  }

  function googleEndpoint(){
    var direct = text(readConfigPath("google.webAppUrl", "")) || text(readConfigPath("googleSheets.webAppUrl", ""));
    if(direct){ return direct; }
    var obj = readConfigObject("google") || readConfigObject("googleSheets") || {};
    return text(obj.webAppUrl || obj.endpoint || obj.url || "");
  }

  function supabaseConfig(){
    var obj = readConfigObject("supabase") || {};
    return {
      url:text(readConfigPath("supabase.url", obj.url || obj.projectUrl || "")),
      anonKey:text(readConfigPath("supabase.anonKey", obj.anonKey || obj.key || "")),
      serviceKey:text(readConfigPath("supabase.serviceKey", obj.serviceKey || obj.serviceRoleKey || "")),
      restPath:text(readConfigPath("supabase.restPath", obj.restPath || "/rest/v1/")) || "/rest/v1/",
      schema:text(readConfigPath("supabase.schema", obj.schema || "public")) || "public"
    };
  }

  function normalizeGoogleRow(row){
    var payload = payloadOf(row);
    return {
      id:rowId(row),
      cambioId:rowId(row),
      tabla:tableOf(row),
      accion:actionOf(row),
      periodoId:text(row && (row.periodoId || payload.periodoId)),
      cedula:text(row && (row.cedula || payload.cedula || payload.numeroIdentificacion)),
      payload:payload,
      updatedAt:text((row && row.updatedAt) || payload.updatedAt || now())
    };
  }

  function pushGoogleWithBridge(rows, options){
    if(window.BDLocalGoogleBridge && typeof window.BDLocalGoogleBridge.pushChanges === "function"){
      return Promise.resolve(window.BDLocalGoogleBridge.pushChanges(rows, options || {}));
    }
    if(window.BL2GooglePush && typeof window.BL2GooglePush.pushChanges === "function"){
      return Promise.resolve(window.BL2GooglePush.pushChanges(rows, options || {}));
    }
    return null;
  }

  function pushGoogleRows(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    if(!rows.length){
      return Promise.resolve({ ok:true, target:"google", processedIds:[], message:"Google Sheets: no hay cambios para enviar." });
    }

    var bridgeResult = pushGoogleWithBridge(rows, options);
    if(bridgeResult){
      return bridgeResult.then(function(result){
        result = result || {};
        return Object.assign({ ok:result.ok !== false, target:"google", processedIds:result.processedIds || result.ids || rows.map(rowId).filter(Boolean) }, result);
      });
    }

    var url = googleEndpoint();
    if(!url){
      return Promise.resolve({
        ok:false,
        target:"google",
        processedIds:[],
        message:"Google Sheets no está configurado. Falta Web App URL o bridge."
      });
    }

    var payload = {
      action:"syncChanges",
      target:"google",
      source:"BDLocal",
      sentAt:now(),
      rows:rows.map(normalizeGoogleRow)
    };

    return fetchJson(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(payload)
    }, options.timeoutMs || 90000).then(function(data){
      var processed = data.processedIds || data.ids || data.syncedIds || rows.map(rowId).filter(Boolean);
      return {
        ok:data.ok !== false,
        target:"google",
        response:data,
        processedIds:processed,
        message:data.message || ("Google Sheets: " + processed.length + " cambio(s) enviados.")
      };
    });
  }

  function supabaseTableName(table){
    table = text(table || "registro").toLowerCase();
    var map = {
      estudiante:"estudiantes",
      estudiantes:"estudiantes",
      matricula:"matriculas_periodo",
      matriculas:"matriculas_periodo",
      requisito:"requisitos_estudiante",
      requisitos:"requisitos_estudiante",
      nota:"notas_titulacion",
      notas:"notas_titulacion",
      persona:"personas",
      personas:"personas",
      periodo:"periodos",
      periodos:"periodos"
    };
    return map[table] || table;
  }

  function supabaseRecord(row){
    var payload = payloadOf(row);
    var record = Object.assign({}, payload);
    record.id = text(payload.id || payload.registroId || row.registroId || rowId(row));
    record.periodo_id = text(payload.periodoId || payload.periodo_id || row.periodoId || "");
    record.cedula = text(payload.cedula || payload.numeroIdentificacion || row.cedula || "");
    record.updated_at = text(payload.updatedAt || payload.updated_at || row.updatedAt || now());
    record.sync_source = "bdlocal";
    record.sync_change_id = rowId(row);
    return record;
  }

  function pushSupabaseRows(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};

    if(!rows.length){
      return Promise.resolve({ ok:true, target:"supabase", processedIds:[], message:"Supabase: no hay cambios para enviar." });
    }

    if(window.BDLocalSupabaseBridge && typeof window.BDLocalSupabaseBridge.pushChanges === "function"){
      return Promise.resolve(window.BDLocalSupabaseBridge.pushChanges(rows, options)).then(function(result){
        result = result || {};
        return Object.assign({ ok:result.ok !== false, target:"supabase", processedIds:result.processedIds || rows.map(rowId).filter(Boolean) }, result);
      });
    }

    var cfg = supabaseConfig();
    var key = cfg.serviceKey || cfg.anonKey;
    if(!cfg.url || !key){
      return Promise.resolve({
        ok:false,
        target:"supabase",
        processedIds:[],
        message:"Supabase no está configurado. Falta URL y anon/service key."
      });
    }

    var grouped = groupByTable(rows);
    var processedIds = [];
    var chain = Promise.resolve();

    Object.keys(grouped).forEach(function(table){
      chain = chain.then(function(){
        var records = grouped[table].map(supabaseRecord).filter(function(record){ return !!record.id; });
        if(!records.length){ return null; }

        var endpoint = cfg.url.replace(/\/+$/, "") + cfg.restPath + encodeURIComponent(supabaseTableName(table));

        return fetchJson(endpoint, {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "apikey":key,
            "Authorization":"Bearer " + key,
            "Prefer":"resolution=merge-duplicates,return=minimal"
          },
          body:JSON.stringify(records)
        }, options.timeoutMs || 90000).then(function(){
          grouped[table].forEach(function(row){
            if(rowId(row)){ processedIds.push(rowId(row)); }
          });
        });
      });
    });

    return chain.then(function(){
      return {
        ok:true,
        target:"supabase",
        processedIds:processedIds,
        message:"Supabase: " + processedIds.length + " cambio(s) enviados."
      };
    });
  }

  var googleAdapter = { version:VERSION, target:"google", push:pushGoogleRows };
  var supabaseAdapter = { version:VERSION, target:"supabase", push:pushSupabaseRows };

  register("google", googleAdapter);
  register("sheets", googleAdapter);
  register("supabase", supabaseAdapter);

  window.BDLSyncTargets = {
    version:VERSION,
    register:register,
    unregister:unregister,
    get:get,
    list:list,
    normalizeTarget:normalizeTarget,
    groupByTable:groupByTable,
    payloadOf:payloadOf,
    rowId:rowId,
    fetchJson:fetchJson
  };
})(window);