/* =========================================================
Nombre completo: bdl.repo.cambios.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.cambios.js
Función o funciones:
- Administrar la cola real cambios_pendientes.
- Unificar cambios V2 y legacy mediante una clave lógica estable.
- Mantener un solo pendiente por tabla, período y registro.
- Actualizar el pendiente existente en lugar de crear duplicados.
- Conservar estados de sincronización y la última versión del payload.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.3.1-idempotent-outbox";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function nowISO(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function num(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function store(){ return Repos.storeName("cambiosPendientes","cambios_pendientes"); }
  function legacyStore(){ return Repos.storeName("cambios","cambios"); }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizePart(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g,"_")
      .replace(/^_+|_+$/g,"") || "sin_valor";
  }

  function stableString(value){
    if(value === null || value === undefined){ return ""; }
    if(typeof value !== "object"){ return String(value); }
    if(Array.isArray(value)){ return "[" + value.map(stableString).join(",") + "]"; }
    return "{" + Object.keys(value).sort().map(function(key){ return JSON.stringify(key) + ":" + stableString(value[key]); }).join(",") + "}";
  }

  function hash(value){
    var source = stableString(value);
    var result = 2166136261;
    for(var index = 0; index < source.length; index += 1){
      result ^= source.charCodeAt(index);
      result += (result << 1) + (result << 4) + (result << 7) + (result << 8) + (result << 24);
    }
    return (result >>> 0).toString(16);
  }

  function payloadOf(row){
    row = row || {};
    return clone(row.payload || row.data || row.registro || row.documento || {});
  }

  function tableOf(row){
    row = row || {};
    var table = text(row.tabla || row.table || "");
    if(table){ return table; }
    var type = upper(row.tipo || row.type);
    if(type.indexOf("REQUISITO") >= 0){ return "requisitos_estudiante"; }
    if(type.indexOf("NOTA") >= 0){ return "notas_titulacion"; }
    if(type.indexOf("CONTACT") >= 0){ return "contactos_estudiante"; }
    if(type.indexOf("MATRIC") >= 0 || type.indexOf("STUDENT") >= 0 || type.indexOf("ESTUDIANTE") >= 0){ return "matriculas_periodo"; }
    return text(row.tipo || "registro");
  }

  function periodOf(row){
    row = row || {};
    var payload = payloadOf(row);
    return text(row.periodoId || row.periodId || payload.periodoId || payload.periodId || "global");
  }

  function recordOf(row){
    row = row || {};
    var payload = payloadOf(row);
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || payload.cedula || payload.numeroIdentificacion);
    var record = text(
      row.registroId || row.recordId || row.idEstudiantePeriodo || row.studentId ||
      payload.idEstudiantePeriodo || payload.studentId || payload.id || cedula
    );
    var requirement = text(row.requisitoKey || payload.requisitoKey || payload.key || "");
    return record + (requirement ? "__" + requirement : "");
  }

  function logicalKey(row){
    return [normalizePart(tableOf(row)),normalizePart(periodOf(row)),normalizePart(recordOf(row))].join("__");
  }

  function stableId(row){ return "outbox__" + hash(logicalKey(row)); }

  function contentHash(row){
    row = row || {};
    return "payload__" + hash({
      tabla:tableOf(row),
      periodoId:periodOf(row),
      registroId:recordOf(row),
      action:text(row.accion || row.action || "UPSERT").toUpperCase(),
      payload:payloadOf(row)
    });
  }

  function normalizeStatus(value){
    value = upper(value || "PENDIENTE");
    if(value === "OK" || value === "DONE" || value === "SYNCED"){ return "SINCRONIZADO"; }
    if(value === "PENDING"){ return "PENDIENTE"; }
    return value || "PENDIENTE";
  }

  function normalize(row,options){
    row = Object.assign({},clone(row || {}));
    options = options || {};

    if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
      try{ row = window.BDLRulesSync.build(row,options) || row; }catch(error){}
    }

    var sourceId = text(row.sourceChangeId || row.id || row.cambioId);
    row.tabla = tableOf(row);
    row.periodoId = periodOf(row);
    row.cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || payloadOf(row).cedula || payloadOf(row).numeroIdentificacion);
    row.registroId = text(row.registroId || row.idEstudiantePeriodo || row.studentId || recordOf(row));
    row.logicalKey = logicalKey(row);
    row.contentHash = contentHash(row);
    row.sourceChangeId = sourceId && sourceId !== stableId(row) ? sourceId : text(row.sourceChangeId);
    row.id = stableId(row);
    row.cambioId = row.id;
    row.createdAt = text(row.createdAt) || nowISO();
    row.updatedAt = text(row.updatedAt) || nowISO();

    row.estadoSheets = normalizeStatus(row.estadoSheets || row.statusGoogle);
    row.statusGoogle = row.estadoSheets;
    row.estadoFirebase = normalizeStatus(row.estadoFirebase || row.statusFirebase);
    row.statusFirebase = row.estadoFirebase;
    row.estadoSupabase = normalizeStatus(row.estadoSupabase || row.statusSupabase);
    row.statusSupabase = row.estadoSupabase;
    row.outboxIdempotent = true;
    row.outboxRepositoryVersion = VERSION;
    return row;
  }

  function resetTarget(row,target){
    var map = {
      google:["estadoSheets","statusGoogle","ultimoErrorSheets","nextRetryAtSheets","bloqueadoSheets","intentosSheets"],
      firebase:["estadoFirebase","statusFirebase","ultimoErrorFirebase","nextRetryAtFirebase","bloqueadoFirebase","intentosFirebase"],
      supabase:["estadoSupabase","statusSupabase","ultimoErrorSupabase","nextRetryAtSupabase","bloqueadoSupabase","intentosSupabase"]
    };
    var fields = map[target];
    row[fields[0]] = "PENDIENTE";
    row[fields[1]] = "PENDIENTE";
    row[fields[2]] = "";
    row[fields[3]] = "";
    row[fields[4]] = false;
    row[fields[5]] = 0;
  }

  function mergeExisting(existing,incoming){
    existing = existing || null;
    incoming = normalize(incoming || {});
    if(!existing){
      incoming.payloadRevision = num(incoming.payloadRevision || 1);
      return incoming;
    }

    existing = normalize(existing);
    var changed = text(existing.contentHash) !== text(incoming.contentHash);
    var merged = Object.assign({},existing,incoming,{
      id:existing.id,
      cambioId:existing.id,
      logicalKey:existing.logicalKey,
      createdAt:existing.createdAt || incoming.createdAt,
      updatedAt:nowISO(),
      sourceChangeId:incoming.sourceChangeId || existing.sourceChangeId
    });

    if(changed){
      ["google","firebase","supabase"].forEach(function(target){ resetTarget(merged,target); });
      merged.payloadRevision = num(existing.payloadRevision || 1) + 1;
      merged.lastContentChangedAt = nowISO();
    }else{
      merged.payloadRevision = num(existing.payloadRevision || 1);
    }

    return merged;
  }

  function newer(a,b){
    var aTime = Date.parse(text(a && (a.updatedAt || a.createdAt))) || 0;
    var bTime = Date.parse(text(b && (b.updatedAt || b.createdAt))) || 0;
    return bTime >= aTime ? b : a;
  }

  function mergeRows(outboxRows,legacyRows){
    var groups = Object.create(null);

    function push(row,source){
      var normalized = normalize(row || {});
      var key = normalized.logicalKey;
      if(!groups[key]){ groups[key] = { outbox:null,legacy:null }; }
      if(source === "cambios_pendientes"){
        groups[key].outbox = groups[key].outbox ? newer(groups[key].outbox,normalized) : normalized;
      }else{
        groups[key].legacy = groups[key].legacy ? newer(groups[key].legacy,normalized) : normalized;
      }
    }

    (Array.isArray(outboxRows) ? outboxRows : []).forEach(function(row){ push(row,"cambios_pendientes"); });
    (Array.isArray(legacyRows) ? legacyRows : []).forEach(function(row){ push(row,"cambios_legacy"); });

    return Object.keys(groups).map(function(key){
      var group = groups[key];
      var selected = group.outbox || group.legacy;
      if(group.outbox && group.legacy && text(group.legacy.contentHash) !== text(group.outbox.contentHash)){
        selected = mergeExisting(group.outbox,group.legacy);
      }
      selected._repoCambiosSource = group.outbox ? "cambios_pendientes" : "cambios_legacy";
      return selected;
    }).sort(function(a,b){ return text(a.createdAt).localeCompare(text(b.createdAt)); });
  }

  function applyFilters(rows,options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [],options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows,options.cedula); }
    if(text(options.tabla)){ rows = rows.filter(function(row){ return text(row.tabla) === text(options.tabla); }); }
    return rows;
  }

  function list(options){
    options = options || {};
    return Promise.all([
      Repos.safeGetAll(store()).catch(function(){ return []; }),
      Repos.safeGetAll(legacyStore()).catch(function(){ return []; })
    ]).then(function(values){ return applyFilters(mergeRows(values[0],values[1]),options); });
  }

  function pending(target,options){
    target = text(target).toLowerCase();
    return list(options || {}).then(function(rows){
      return rows.filter(function(row){
        if(target === "firebase"){ return normalizeStatus(row.estadoFirebase || row.statusFirebase) !== "SINCRONIZADO"; }
        if(target === "supabase"){ return normalizeStatus(row.estadoSupabase || row.statusSupabase) !== "SINCRONIZADO"; }
        if(target === "sheets" || target === "google"){ return normalizeStatus(row.estadoSheets || row.statusGoogle) !== "SINCRONIZADO"; }
        return true;
      });
    });
  }

  function getExisting(key){
    return Repos.requireDB().then(function(current){
      if(!current || typeof current.get !== "function"){ return null; }
      return current.get(store(),key);
    }).catch(function(){ return null; });
  }

  function save(row,options){
    options = options || {};
    var incoming = normalize(row || {},options);
    return getExisting(incoming.id).then(function(existing){
      var merged = options.replace === true ? incoming : mergeExisting(existing,incoming);
      return Repos.safePut(store(),merged);
    });
  }

  function saveMany(rows,options){
    rows = Array.isArray(rows) ? rows : [];
    var saved = [];
    var chain = Promise.resolve();
    rows.forEach(function(row){
      chain = chain.then(function(){ return save(row,options || {}).then(function(item){ if(item){ saved.push(item); } }); });
    });
    return chain.then(function(){ return saved; });
  }

  var api = {
    version:VERSION,
    list:list,
    pending:pending,
    save:save,
    saveMany:saveMany,
    normalize:normalize,
    logicalKey:logicalKey,
    stableId:stableId,
    contentHash:contentHash,
    mergeExisting:mergeExisting,
    mergeRows:mergeRows
  };

  Repos.register("cambios",api);
  Repos.register("cambios_pendientes",api);
  window.BDLRepoCambios = api;
})(window);
