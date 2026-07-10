/* =========================================================
Nombre completo: bdl.repo.cambios.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.cambios.js
Función o funciones:
- Administrar cambios_pendientes con claves lógicas estables.
- Mantener un único pendiente por tabla, período y registro.
- Actualizar el pendiente si cambia el contenido.
- Ignorar duplicados legacy antiguos cuando ya existe un cambio V2 más reciente.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "0.4.0-idempotent";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function upper(value){ return text(value).toUpperCase(); }
  function now(){ return new Date().toISOString(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }
  function number(value){ value = Number(value || 0); return Number.isFinite(value) ? value : 0; }
  function outboxStore(){ return Repos.storeName("cambiosPendientes","cambios_pendientes"); }
  function legacyStore(){ return Repos.storeName("cambios","cambios"); }

  function cedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g,"");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function part(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"") || "sin_valor";
  }

  function stable(value){
    if(value == null){ return ""; }
    if(typeof value !== "object"){ return String(value); }
    if(Array.isArray(value)){ return "[" + value.map(stable).join(",") + "]"; }
    return "{" + Object.keys(value).sort().map(function(key){ return JSON.stringify(key) + ":" + stable(value[key]); }).join(",") + "}";
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

  function payload(row){ return clone((row || {}).payload || (row || {}).data || (row || {}).registro || {}); }

  function table(row){
    row = row || {};
    if(text(row.tabla || row.table)){ return text(row.tabla || row.table); }
    var type = upper(row.tipo || row.type);
    if(type.indexOf("REQUISITO") >= 0){ return "requisitos_estudiante"; }
    if(type.indexOf("NOTA") >= 0){ return "notas_titulacion"; }
    if(type.indexOf("CONTACT") >= 0){ return "contactos_estudiante"; }
    if(type.indexOf("STUDENT") >= 0 || type.indexOf("ESTUDIANTE") >= 0 || type.indexOf("MATRIC") >= 0){ return "matriculas_periodo"; }
    return text(row.tipo || "registro");
  }

  function periodo(row){
    var data = payload(row);
    return text((row || {}).periodoId || (row || {}).periodId || data.periodoId || data.periodId || "global");
  }

  function registro(row){
    row = row || {};
    var data = payload(row);
    var identification = cedula(row.cedula || row.numeroIdentificacion || data.cedula || data.numeroIdentificacion);
    var key = text(row.registroId || row.idEstudiantePeriodo || row.studentId || data.idEstudiantePeriodo || data.studentId || data.id || identification);
    var requirement = text(row.requisitoKey || data.requisitoKey || data.key);
    return key + (requirement ? "__" + requirement : "");
  }

  function logicalKey(row){ return [part(table(row)),part(periodo(row)),part(registro(row))].join("__"); }
  function stableId(row){ return "outbox__" + hash(logicalKey(row)); }

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

  function normalize(row,options){
    row = Object.assign({},clone(row || {}));
    if(window.BDLRulesSync && typeof window.BDLRulesSync.build === "function"){
      try{ row = window.BDLRulesSync.build(row,options || {}) || row; }catch(error){}
    }
    var sourceId = text(row.sourceChangeId || row.id || row.cambioId);
    row.tabla = table(row);
    row.periodoId = periodo(row);
    row.cedula = cedula(row.cedula || row.numeroIdentificacion || payload(row).cedula || payload(row).numeroIdentificacion);
    row.registroId = text(row.registroId || row.idEstudiantePeriodo || row.studentId || registro(row));
    row.logicalKey = logicalKey(row);
    row.contentHash = contentHash(row);
    row.id = stableId(row);
    row.cambioId = row.id;
    row.sourceChangeId = sourceId && sourceId !== row.id ? sourceId : text(row.sourceChangeId);
    row.createdAt = text(row.createdAt) || now();
    row.updatedAt = text(row.updatedAt) || now();
    row.estadoSheets = status(row.estadoSheets || row.statusGoogle); row.statusGoogle = row.estadoSheets;
    row.estadoFirebase = status(row.estadoFirebase || row.statusFirebase); row.statusFirebase = row.estadoFirebase;
    row.estadoSupabase = status(row.estadoSupabase || row.statusSupabase); row.statusSupabase = row.estadoSupabase;
    row.outboxIdempotent = true;
    row.outboxRepositoryVersion = VERSION;
    return row;
  }

  function reset(row,target){
    var fields = target === "google"
      ? ["estadoSheets","statusGoogle","ultimoErrorSheets","nextRetryAtSheets","bloqueadoSheets","intentosSheets"]
      : target === "firebase"
        ? ["estadoFirebase","statusFirebase","ultimoErrorFirebase","nextRetryAtFirebase","bloqueadoFirebase","intentosFirebase"]
        : ["estadoSupabase","statusSupabase","ultimoErrorSupabase","nextRetryAtSupabase","bloqueadoSupabase","intentosSupabase"];
    row[fields[0]] = "PENDIENTE"; row[fields[1]] = "PENDIENTE"; row[fields[2]] = ""; row[fields[3]] = ""; row[fields[4]] = false; row[fields[5]] = 0;
  }

  function merge(existing,incoming){
    incoming = normalize(incoming || {});
    if(!existing){ incoming.payloadRevision = number(incoming.payloadRevision || 1); return incoming; }
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
      result.payloadRevision = number(existing.payloadRevision || 1);
    }
    return result;
  }

  function time(row){ return Date.parse(text(row && (row.updatedAt || row.createdAt))) || 0; }

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
      if(group.outbox && group.legacy && time(group.legacy) > time(group.outbox) && group.legacy.contentHash !== group.outbox.contentHash){
        selected = merge(group.outbox,group.legacy);
      }
      selected._repoCambiosSource = group.outbox ? "cambios_pendientes" : "cambios_legacy";
      return selected;
    }).sort(function(a,b){ return time(a) - time(b); });
  }

  function filter(rows,options){
    options = options || {};
    rows = Repos.byPeriodo(rows || [],options.periodoId);
    if(text(options.cedula)){ rows = Repos.byCedula(rows,options.cedula); }
    if(text(options.tabla)){ rows = rows.filter(function(row){ return text(row.tabla) === text(options.tabla); }); }
    return rows;
  }

  function list(options){
    return Promise.all([Repos.safeGetAll(outboxStore()),Repos.safeGetAll(legacyStore())]).then(function(values){ return filter(mergeRows(values[0],values[1]),options || {}); });
  }

  function getExisting(key){
    return Repos.requireDB().then(function(current){ return current && current.get ? current.get(outboxStore(),key) : null; }).catch(function(){ return null; });
  }

  function save(row,options){
    var incoming = normalize(row || {},options || {});
    return getExisting(incoming.id).then(function(existing){ return Repos.safePut(outboxStore(),options && options.replace === true ? incoming : merge(existing,incoming)); });
  }

  function saveMany(rows,options){
    var result = [];
    var chain = Promise.resolve();
    (rows || []).forEach(function(row){ chain = chain.then(function(){ return save(row,options || {}).then(function(saved){ if(saved){ result.push(saved); } }); }); });
    return chain.then(function(){ return result; });
  }

  function pending(target,options){
    target = text(target).toLowerCase();
    return list(options || {}).then(function(rows){
      return rows.filter(function(row){
        if(target === "firebase"){ return status(row.estadoFirebase || row.statusFirebase) !== "SINCRONIZADO"; }
        if(target === "supabase"){ return status(row.estadoSupabase || row.statusSupabase) !== "SINCRONIZADO"; }
        if(target === "google" || target === "sheets"){ return status(row.estadoSheets || row.statusGoogle) !== "SINCRONIZADO"; }
        return true;
      });
    });
  }

  var api = { version:VERSION,list:list,pending:pending,save:save,saveMany:saveMany,normalize:normalize,logicalKey:logicalKey,stableId:stableId,contentHash:contentHash,mergeExisting:merge,mergeRows:mergeRows };
  Repos.register("cambios",api);
  Repos.register("cambios_pendientes",api);
  window.BDLRepoCambios = api;
})(window);
