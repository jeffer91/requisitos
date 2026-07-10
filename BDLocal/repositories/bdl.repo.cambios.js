/* =========================================================
Nombre completo: bdl.repo.cambios.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.cambios.js
Función o funciones:
- Administrar cambios_pendientes con claves lógicas estables.
- Consultar por período o cédula mediante índices antes de leer tablas completas.
- Mantener caché breve e invalidarla al guardar para evitar escaneos repetidos.
- Conservar compatibilidad con cambios legacy sin reprocesarlos innecesariamente.
- Exponer paginación y lectura directa por identificadores.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.5.0-indexed-cache";
  var CACHE_TTL_MS = 1800;
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  var cache = Object.create(null);
  var cacheGeneration = 0;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function outboxStore(){ return Repos.storeName("cambiosPendientes","cambios_pendientes"); }
  function legacyStore(){ return Repos.storeName("cambios","cambios"); }

  function dispatch(name,detail){
    try{ window.dispatchEvent(new CustomEvent(name,{ detail:detail || {} })); }catch(error){}
  }

  function invalidateCache(){
    cache = Object.create(null);
    cacheGeneration += 1;
  }

  function cedula(value){
    var utils = window.BL2Config && window.BL2Config.utils;
    if(utils && typeof utils.normalizeCedula === "function"){
      try{ return text(utils.normalizeCedula(value)); }catch(error){}
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function part(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g,"_")
      .replace(/^_+|_+$/g,"") || "sin_valor";
  }

  function stable(value){
    if(value == null){ return ""; }
    if(typeof value !== "object"){ return String(value); }
    if(Array.isArray(value)){ return "[" + value.map(stable).join(",") + "]"; }
    return "{" + Object.keys(value).sort().map(function(key){
      return JSON.stringify(key) + ":" + stable(value[key]);
    }).join(",") + "}";
  }

  function hash(value){
    var source = stable(value);
    var result = 2166136261;
    for(var index = 0; index < source.length; index += 1){
      result ^= source.charCodeAt(index);
      result += (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
    }
    return (result >>> 0).toString(16);
  }

  function payload(row){
    return clone((row || {}).payload || (row || {}).data || (row || {}).registro || {});
  }

  function table(row){
    row = row || {};
    if(text(row.tabla || row.table)){ return text(row.tabla || row.table); }
    var type = upper(row.tipo || row.type);
    if(type.indexOf("REQUISITO") >= 0){ return "requisitos_estudiante"; }
    if(type.indexOf("NOTA") >= 0){ return "notas_titulacion"; }
    if(type.indexOf("CONTACT") >= 0){ return "contactos_estudiante"; }
    if(type.indexOf("STUDENT") >= 0 || type.indexOf("ESTUDIANTE") >= 0 || type.indexOf("MATRIC") >= 0){
      return "matriculas_periodo";
    }
    return text(row.tipo || "registro");
  }

  function periodo(row){
    var data = payload(row);
    return text((row || {}).periodoId || (row || {}).periodId || data.periodoId || data.periodId || "global");
  }

  function registro(row){
    row = row || {};
    var data = payload(row);
    var identification = cedula(
      row.cedula ||
      row.numeroIdentificacion ||
      data.cedula ||
      data.numeroIdentificacion
    );
    var key = text(
      row.registroId ||
      row.idEstudiantePeriodo ||
      row.studentId ||
      data.idEstudiantePeriodo ||
      data.studentId ||
      data.id ||
      identification
    );
    var requirement = text(row.requisitoKey || data.requisitoKey || data.key);
    return key + (requirement ? "__" + requirement : "");
  }

  function logicalKey(row){
    return [part(table(row)),part(periodo(row)),part(registro(row))].join("__");
  }

  function stableId(row){
    return "outbox__" + hash(logicalKey(row));
  }

  function contentHash(row){
    return "payload__" + hash({
      tabla:table(row),
      periodoId:periodo(row),
      registroId:registro(row),
      action:upper((row || {}).accion || (row || {}).action || "UPSERT"),
      payload:payload(row)
    });
  }

  function status(value){
    value = upper(value || "PENDIENTE");
    if(value === "OK" || value === "DONE" || value === "SYNCED"){ return "SINCRONIZADO"; }
    return value === "PENDING" || !value ? "PENDIENTE" : value;
  }

  function targetFields(target){
    target = text(target).toLowerCase();
    if(target === "google" || target === "sheets"){
      return ["estadoSheets","statusGoogle","sincronizadoEnSheets","ultimoErrorSheets","nextRetryAtSheets","bloqueadoSheets","intentosSheets"];
    }
    if(target === "firebase" || target === "firestore"){
      return ["estadoFirebase","statusFirebase","sincronizadoEnFirebase","ultimoErrorFirebase","nextRetryAtFirebase","bloqueadoFirebase","intentosFirebase"];
    }
    return ["estadoSupabase","statusSupabase","sincronizadoEnSupabase","ultimoErrorSupabase","nextRetryAtSupabase","bloqueadoSupabase","intentosSupabase"];
  }

  function normalize(row,options){
    var original = clone(row || {});
    var originalId = text(original.sourceChangeId || original.id || original.cambioId);
    var originalCreatedAt = text(original.createdAt);
    var originalUpdatedAt = text(original.updatedAt);
    var originalTable = table(original);
    var originalPeriod = periodo(original);
    var originalRecord = registro(original);
    var originalPayload = payload(original);
    var originalCedula = cedula(
      original.cedula ||
      original.numeroIdentificacion ||
      originalPayload.cedula ||
      originalPayload.numeroIdentificacion
    );

    row = original;
    if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
      try{
        row = window.BDLRulesSync.build(original,Object.assign({},options || {},{
          tabla:originalTable,
          periodoId:originalPeriod,
          cedula:originalCedula,
          registroId:originalRecord,
          payload:originalPayload
        })) || original;
      }catch(error){
        row = original;
      }
    }

    row = Object.assign({},row);
    row.tabla = originalTable;
    row.periodoId = originalPeriod;
    row.cedula = originalCedula;
    row.registroId = originalRecord;
    row.payload = clone(originalPayload);
    row.logicalKey = [part(originalTable),part(originalPeriod),part(originalRecord)].join("__");
    row.contentHash = "payload__" + hash({
      tabla:originalTable,
      periodoId:originalPeriod,
      registroId:originalRecord,
      action:upper(original.accion || original.action || row.accion || "UPSERT"),
      payload:originalPayload
    });
    row.id = "outbox__" + hash(row.logicalKey);
    row.cambioId = row.id;
    row.sourceChangeId = originalId && originalId !== row.id ? originalId : text(original.sourceChangeId);
    row.createdAt = originalCreatedAt || text(row.createdAt) || now();
    row.updatedAt = originalUpdatedAt || originalCreatedAt || text(row.updatedAt) || now();

    row.estadoSheets = status(original.estadoSheets || original.statusGoogle || row.estadoSheets || row.statusGoogle);
    row.statusGoogle = row.estadoSheets;
    row.estadoFirebase = status(original.estadoFirebase || original.statusFirebase || row.estadoFirebase || row.statusFirebase);
    row.statusFirebase = row.estadoFirebase;
    row.estadoSupabase = status(original.estadoSupabase || original.statusSupabase || row.estadoSupabase || row.statusSupabase);
    row.statusSupabase = row.estadoSupabase;

    row.outboxIdempotent = true;
    row.outboxRepositoryVersion = VERSION;
    return row;
  }

  function reset(row,target){
    var fields = targetFields(target);
    row[fields[0]] = "PENDIENTE";
    row[fields[1]] = "PENDIENTE";
    row[fields[2]] = "";
    row[fields[3]] = "";
    row[fields[4]] = "";
    row[fields[5]] = false;
    row[fields[6]] = 0;
  }

  function preserveSynced(existing,incoming,result,target){
    var fields = targetFields(target);
    var existingStatus = status(existing[fields[0]] || existing[fields[1]]);
    var incomingStatus = status(incoming[fields[0]] || incoming[fields[1]]);

    if(existingStatus === "SINCRONIZADO" && incomingStatus === "PENDIENTE"){
      fields.forEach(function(field){
        if(existing[field] !== undefined){ result[field] = clone(existing[field]); }
      });
      result[fields[0]] = "SINCRONIZADO";
      result[fields[1]] = "SINCRONIZADO";
    }
  }

  function merge(existing,incoming){
    incoming = normalize(incoming || {});
    if(!existing){
      incoming.payloadRevision = number(incoming.payloadRevision || 1);
      return incoming;
    }

    existing = normalize(existing);
    var changed = text(existing.contentHash) !== text(incoming.contentHash);
    var result = Object.assign({},existing,incoming,{
      id:existing.id,
      cambioId:existing.id,
      logicalKey:existing.logicalKey,
      createdAt:existing.createdAt || incoming.createdAt,
      updatedAt:now(),
      sourceChangeId:incoming.sourceChangeId || existing.sourceChangeId
    });

    if(changed){
      ["google","firebase","supabase"].forEach(function(target){ reset(result,target); });
      result.payloadRevision = number(existing.payloadRevision || 1) + 1;
      result.lastContentChangedAt = now();
    }else{
      ["google","firebase","supabase"].forEach(function(target){
        preserveSynced(existing,incoming,result,target);
      });
      result.payloadRevision = number(existing.payloadRevision || 1);
    }

    return result;
  }

  function time(row){
    return Date.parse(text(row && (row.updatedAt || row.createdAt))) || 0;
  }

  function mergeRows(outboxRows,legacyRows){
    var groups = Object.create(null);

    function add(row,source){
      var item = normalize(row || {});
      var key = item.logicalKey;
      if(!groups[key]){ groups[key] = { outbox:null,legacy:null }; }
      var current = groups[key][source];
      groups[key][source] = !current || time(item) >= time(current) ? item : current;
    }

    (outboxRows || []).forEach(function(row){ add(row,"outbox"); });
    (legacyRows || []).forEach(function(row){ add(row,"legacy"); });

    return Object.keys(groups).map(function(key){
      var group = groups[key];
      var selected = group.outbox || group.legacy;
      if(
        group.outbox &&
        group.legacy &&
        time(group.legacy) > time(group.outbox) &&
        group.legacy.contentHash !== group.outbox.contentHash
      ){
        selected = merge(group.outbox,group.legacy);
      }
      selected._repoCambiosSource = group.outbox ? "cambios_pendientes" : "cambios_legacy";
      return selected;
    }).sort(function(a,b){
      return time(a) - time(b);
    });
  }

  function filter(rows,options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    if(text(options.periodoId)){
      rows = rows.filter(function(row){ return text(row.periodoId) === text(options.periodoId); });
    }
    if(text(options.cedula)){
      rows = rows.filter(function(row){ return text(row.cedula) === text(options.cedula); });
    }
    if(text(options.tabla)){
      rows = rows.filter(function(row){ return text(row.tabla) === text(options.tabla); });
    }
    return rows;
  }

  function cacheKey(options){
    options = options || {};
    return [
      cacheGeneration,
      text(options.periodoId) || "*",
      text(options.cedula) || "*",
      text(options.tabla) || "*",
      options.includeLegacy === false ? "outbox" : "both"
    ].join("|");
  }

  function readCache(options){
    var key = cacheKey(options);
    var item = cache[key];
    if(!item || (Date.now() - item.at) > CACHE_TTL_MS){ return null; }
    return clone(item.rows);
  }

  function writeCache(options,rows){
    cache[cacheKey(options)] = {
      at:Date.now(),
      rows:clone(rows || [])
    };
  }

  function queryStore(storeNameValue,options){
    options = options || {};
    var indexName = "";
    var indexValue = "";

    if(text(options.periodoId)){
      indexName = "periodoId";
      indexValue = text(options.periodoId);
    }else if(text(options.cedula)){
      indexName = "cedula";
      indexValue = text(options.cedula);
    }

    if(indexName && typeof Repos.queryByIndex === "function"){
      return Repos.queryByIndex(storeNameValue,indexName,indexValue).catch(function(){
        return Repos.safeGetAll(storeNameValue);
      });
    }

    return Repos.safeGetAll(storeNameValue);
  }

  function list(options){
    options = options || {};
    var cached = !options.force ? readCache(options) : null;
    if(cached){ return Promise.resolve(cached); }

    var includeLegacy = options.includeLegacy !== false;
    var reads = [queryStore(outboxStore(),options)];
    if(includeLegacy){ reads.push(queryStore(legacyStore(),options)); }

    return Promise.all(reads).then(function(values){
      var merged = mergeRows(values[0] || [],includeLegacy ? values[1] || [] : []);
      var result = filter(merged,options);
      writeCache(options,result);
      return clone(result);
    });
  }

  function listPage(options){
    options = options || {};
    var page = Math.max(1,Number(options.page || 1));
    var pageSize = Math.max(1,Math.min(250,Number(options.pageSize || options.limit || 75)));

    return list(options).then(function(rows){
      var total = rows.length;
      var totalPages = Math.max(1,Math.ceil(total / pageSize));
      page = Math.min(page,totalPages);
      var start = (page - 1) * pageSize;

      return {
        rows:rows.slice(start,start + pageSize),
        page:page,
        pageSize:pageSize,
        total:total,
        totalPages:totalPages,
        hasPrev:page > 1,
        hasNext:page < totalPages
      };
    });
  }

  function getExisting(key){
    return Repos.requireDB().then(function(current){
      return current && current.get ? current.get(outboxStore(),key) : null;
    }).catch(function(){ return null; });
  }

  function getByIds(ids){
    var wanted = Object.create(null);
    (Array.isArray(ids) ? ids : []).forEach(function(value){
      value = text(value);
      if(value){ wanted[value] = true; }
    });
    var keys = Object.keys(wanted);
    if(!keys.length){ return Promise.resolve([]); }

    return Repos.requireDB().then(function(current){
      var tasks = keys.map(function(key){
        return current.get(outboxStore(),key).then(function(row){
          if(row){ return normalize(row); }
          return current.get(legacyStore(),key).then(function(legacy){
            return legacy ? normalize(legacy) : null;
          }).catch(function(){ return null; });
        }).catch(function(){ return null; });
      });
      return Promise.all(tasks);
    }).then(function(rows){
      return rows.filter(Boolean);
    });
  }

  function save(row,options){
    var incoming = normalize(row || {},options || {});
    return getExisting(incoming.id).then(function(existing){
      var next = options && options.replace === true
        ? incoming
        : merge(existing,incoming);
      return Repos.safePut(outboxStore(),next);
    }).then(function(saved){
      invalidateCache();
      if(saved){
        dispatch("bdlocal:changes-repository-updated",{
          count:1,
          periodoId:saved.periodoId,
          id:saved.id,
          source:options && options.source || "save"
        });
      }
      return saved;
    });
  }

  function saveMany(rows,options){
    rows = Array.isArray(rows) ? rows : [];
    var unique = Object.create(null);

    rows.forEach(function(row){
      var normalized = normalize(row || {},options || {});
      unique[normalized.id] = normalized;
    });

    var result = [];
    var chain = Promise.resolve();

    Object.keys(unique).forEach(function(key){
      chain = chain.then(function(){
        return save(unique[key],options || {}).then(function(saved){
          if(saved){ result.push(saved); }
        });
      });
    });

    return chain.then(function(){
      invalidateCache();
      return result;
    });
  }

  function pending(target,options){
    target = text(target).toLowerCase();
    return list(options || {}).then(function(rows){
      return rows.filter(function(row){
        if(target === "firebase" || target === "firestore"){
          return status(row.estadoFirebase || row.statusFirebase) !== "SINCRONIZADO";
        }
        if(target === "supabase"){
          return status(row.estadoSupabase || row.statusSupabase) !== "SINCRONIZADO";
        }
        if(target === "google" || target === "sheets"){
          return status(row.estadoSheets || row.statusGoogle) !== "SINCRONIZADO";
        }
        return true;
      });
    });
  }

  var api = {
    version:VERSION,
    list:list,
    listPage:listPage,
    getByIds:getByIds,
    pending:pending,
    save:save,
    saveMany:saveMany,
    normalize:normalize,
    logicalKey:logicalKey,
    stableId:stableId,
    contentHash:contentHash,
    mergeExisting:merge,
    mergeRows:mergeRows,
    invalidateCache:invalidateCache
  };

  Repos.register("cambios",api);
  Repos.register("cambios_pendientes",api);
  window.BDLRepoCambios = api;
})(window);
