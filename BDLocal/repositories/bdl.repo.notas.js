/* =========================================================
Nombre completo: bdl.repo.notas.js
Ruta o ubicación: /BDLocal/repositories/bdl.repo.notas.js
Función o funciones:
- Administrar notas_titulacion como fuente principal.
- Leer y fusionar notas legacy sin permitir que un registro vacío oculte uno válido.
- Aceptar IDs locales canónicos y IDs antiguos invertidos.
- Forzar idEstudiantePeriodo = cedula__periodoId al guardar.
- Consultar por clave e índices antes de recorrer tablas completas.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.3.0-legacy-merge-safe";
  var Repos = window.BDLRepositories;
  if(!Repos){ return; }

  function text(value){ return String(value == null ? "" : value).trim(); }
  function hasValue(value){ return value !== undefined && value !== null && text(value) !== ""; }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(error){ return value; } }

  function normalizeCedula(value){
    var rules = window.BDLRulesPersona;
    if(rules && typeof rules.normalizeCedula === "function"){
      return rules.normalizeCedula(value);
    }
    var utils = window.BL2Config && window.BL2Config.utils;
    return utils && typeof utils.normalizeCedula === "function"
      ? utils.normalizeCedula(value)
      : text(value).replace(/[^0-9A-Za-z]/g,"").toUpperCase();
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match
      ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]
      : value.replace(/_+/g,"__");
  }

  function parseIdentity(value){
    value = text(value);
    var canonical = value.match(/^([0-9A-Za-z]{9,20})__(\d{4}-\d{2}__\d{4}-\d{2})$/);
    if(canonical){
      return { cedula:normalizeCedula(canonical[1]), periodoId:canonicalPeriodId(canonical[2]), format:"canonical" };
    }
    var legacy = value.match(/^(\d{4}-\d{2}__\d{4}-\d{2})__([0-9A-Za-z]{9,20})$/);
    if(legacy){
      return { cedula:normalizeCedula(legacy[2]), periodoId:canonicalPeriodId(legacy[1]), format:"legacy" };
    }
    return { cedula:"", periodoId:"", format:"unknown" };
  }

  function makeId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? cedula + "__" + periodoId : "";
  }

  function legacyId(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    return periodoId && cedula ? periodoId + "__" + cedula : "";
  }

  function store(){ return Repos.storeName("notasTitulacion","notas_titulacion"); }
  function legacyStore(){ return Repos.storeName("notas","notas"); }

  function firstValue(row,names){
    row = row || {};
    for(var index = 0; index < names.length; index += 1){
      if(hasValue(row[names[index]])){ return row[names[index]]; }
    }
    return null;
  }

  function numberOrNull(value){
    if(!hasValue(value)){ return null; }
    var number = Number(text(value).replace(",","."));
    if(!Number.isFinite(number)){ return null; }
    return Math.max(0,Math.min(10,Math.round(number * 100) / 100));
  }

  function finalNote(article,defense){
    article = numberOrNull(article);
    defense = numberOrNull(defense);
    if(article == null || defense == null || article < 7){ return null; }
    return Math.round(((article * 0.70) + (defense * 0.30)) * 100) / 100;
  }

  function timestamp(row){
    var value = Date.parse(text(row && (row.updatedAt || row.fechaRegistroNotas || row.fechaRegistro || row.createdAt)));
    return Number.isFinite(value) ? value : 0;
  }

  function noteValues(row){
    row = row || {};
    var article = numberOrNull(firstValue(row,["Notart","Nart","notart","nart","_nart","notaArticulo","articulo"]));
    var defense = numberOrNull(firstValue(row,["Notdef","Ndef","notdef","ndef","_ndef","notaDefensa","defensa"]));
    var finalValue = numberOrNull(firstValue(row,["Notafinal","Nfinal","notafinal","nfinal","nfin","_nfin","notaFinal","final"]));
    if(finalValue == null){ finalValue = finalNote(article,defense); }
    return { article:article, defense:defense, finalValue:finalValue };
  }

  function estadoNota(article,defense,finalValue){
    if(article == null){ return "SIN_ARTICULO"; }
    if(article < 7){ return "ARTICULO_NO_APROBADO"; }
    if(defense == null){ return "PENDIENTE_DEFENSA"; }
    if(finalValue == null){ return "PENDIENTE_FINAL"; }
    return finalValue >= 7 ? "APROBADO" : "NO_APROBADO";
  }

  function normalize(row){
    row = Object.assign({},row || {});
    var originalId = text(row.idEstudiantePeriodo || row.studentId || row.notaId || row.id || "");
    var parsed = parseIdentity(originalId);
    var periodoId = canonicalPeriodId(row.periodoId || row.periodId || row.periodoCanonicoId || parsed.periodoId || "");
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || parsed.cedula || "");
    var canonicalId = makeId(periodoId,cedula);

    if(window.BDLRulesNotas && typeof window.BDLRulesNotas.build === "function"){
      row = Object.assign({},row,window.BDLRulesNotas.build(row,{ periodoId:periodoId, cedula:cedula }) || {});
    }

    periodoId = canonicalPeriodId(row.periodoId || row.periodId || periodoId);
    cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || cedula);
    canonicalId = makeId(periodoId,cedula) || canonicalId;

    var values = noteValues(row);
    return Object.assign({},row,{
      id:canonicalId,
      notaId:canonicalId,
      studentId:canonicalId,
      idEstudiantePeriodo:canonicalId,
      periodoId:periodoId,
      periodId:periodoId,
      periodoCanonicoId:periodoId,
      cedula:cedula,
      numeroIdentificacion:cedula,
      Notart:values.article,
      Nart:values.article,
      notart:values.article,
      nart:values.article,
      Notdef:values.defense,
      Ndef:values.defense,
      notdef:values.defense,
      ndef:values.defense,
      Notafinal:values.finalValue,
      Nfinal:values.finalValue,
      notafinal:values.finalValue,
      nfinal:values.finalValue,
      estadoNota:estadoNota(values.article,values.defense,values.finalValue),
      updatedAt:text(row.updatedAt) || new Date().toISOString(),
      _bdlOriginalNoteId:text(row._bdlOriginalNoteId || originalId),
      _bdlNoteIdentityFormat:parsed.format
    });
  }

  function mergeGeneric(base,incoming){
    var output = Object.assign({},base || {});
    Object.keys(incoming || {}).forEach(function(name){
      var value = incoming[name];
      if(hasValue(value)){ output[name] = clone(value); }
      else if(output[name] === undefined){ output[name] = clone(value); }
    });
    return output;
  }

  function mergeNoteRows(base,incoming){
    if(!base){ return normalize(incoming); }
    if(!incoming){ return normalize(base); }

    var left = normalize(base);
    var right = normalize(incoming);
    var leftTime = timestamp(left);
    var rightTime = timestamp(right);
    var older = rightTime >= leftTime ? left : right;
    var newer = rightTime >= leftTime ? right : left;
    var output = mergeGeneric(older,newer);
    var olderValues = noteValues(older);
    var newerValues = noteValues(newer);
    var article = newerValues.article != null ? newerValues.article : olderValues.article;
    var defense = newerValues.defense != null ? newerValues.defense : olderValues.defense;
    var finalValue = newerValues.finalValue != null ? newerValues.finalValue : olderValues.finalValue;
    if(finalValue == null){ finalValue = finalNote(article,defense); }

    output.Notart = output.Nart = output.notart = output.nart = article;
    output.Notdef = output.Ndef = output.notdef = output.ndef = defense;
    output.Notafinal = output.Nfinal = output.notafinal = output.nfinal = finalValue;
    output.estadoNota = estadoNota(article,defense,finalValue);
    output.updatedAt = text(newer.updatedAt || older.updatedAt) || new Date().toISOString();
    return normalize(output);
  }

  function mergeRows(rows){
    rows = (Array.isArray(rows) ? rows : []).filter(Boolean).map(normalize)
      .filter(function(row){ return !!row.idEstudiantePeriodo; })
      .sort(function(a,b){ return timestamp(a) - timestamp(b); });
    return rows.reduce(function(current,row){ return mergeNoteRows(current,row); },null);
  }

  function applyFilters(rows,options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var cedula = normalizeCedula(options.cedula || "");
    var wantedId = text(options.idEstudiantePeriodo || "");
    return (Array.isArray(rows) ? rows : []).filter(function(row){
      if(periodoId && canonicalPeriodId(row.periodoId || row.periodId) !== periodoId){ return false; }
      if(cedula && normalizeCedula(row.cedula || row.numeroIdentificacion) !== cedula){ return false; }
      if(wantedId && text(row.idEstudiantePeriodo || row.studentId || row.id) !== wantedId){ return false; }
      return true;
    });
  }

  function directGet(storeNameValue,key){
    var db = Repos.db && Repos.db();
    if(!db || typeof db.get !== "function" || !text(key)){ return Promise.resolve(null); }
    return Promise.resolve(db.get(storeNameValue,key)).catch(function(error){
      try{ console.warn("[BDLRepoNotas] Lectura directa falló",storeNameValue,error); }catch(innerError){}
      return null;
    });
  }

  function indexedPair(storeNameValue,periodoId,cedula){
    if(!Repos.safeQueryByIndex || !periodoId || !cedula){ return Promise.resolve([]); }
    return Repos.safeQueryByIndex(storeNameValue,"periodo_cedula",[periodoId,cedula]);
  }

  function readStoreRows(storeNameValue,options){
    options = options || {};
    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    if(periodoId && typeof Repos.safeQueryByIndex === "function"){
      return Repos.safeQueryByIndex(storeNameValue,"periodoId",periodoId).then(function(rows){
        rows = Array.isArray(rows) ? rows : [];
        return rows.length ? rows : Repos.safeGetAll(storeNameValue);
      });
    }
    return Repos.safeGetAll(storeNameValue);
  }

  function combineRows(primaryRows,legacyRows,options){
    var grouped = Object.create(null);
    (primaryRows || []).concat(legacyRows || []).forEach(function(source){
      var row = normalize(source);
      var id = row.idEstudiantePeriodo;
      if(!id){ return; }
      grouped[id] = grouped[id] ? mergeNoteRows(grouped[id],row) : row;
    });
    return applyFilters(Object.keys(grouped).map(function(id){ return grouped[id]; }),options);
  }

  function list(options){
    options = options || {};
    return Promise.all([
      readStoreRows(store(),options).catch(function(){ return []; }),
      readStoreRows(legacyStore(),options).catch(function(){ return []; })
    ]).then(function(results){ return combineRows(results[0],results[1],options); });
  }

  function getByPeriodoCedula(periodoId,cedula){
    periodoId = canonicalPeriodId(periodoId);
    cedula = normalizeCedula(cedula);
    var canonicalId = makeId(periodoId,cedula);
    var oldId = legacyId(periodoId,cedula);
    if(!canonicalId){ return Promise.resolve(null); }

    return Promise.all([
      directGet(store(),canonicalId),
      indexedPair(store(),periodoId,cedula),
      directGet(legacyStore(),canonicalId),
      directGet(legacyStore(),oldId),
      indexedPair(legacyStore(),periodoId,cedula)
    ]).then(function(results){
      var rows = [];
      results.forEach(function(result){
        if(Array.isArray(result)){ rows = rows.concat(result); }
        else if(result){ rows.push(result); }
      });
      var merged = mergeRows(rows);
      if(merged){ return merged; }
      return list({ periodoId:periodoId, cedula:cedula }).then(function(listRows){ return listRows[0] || null; });
    });
  }

  function save(row){
    var item = normalize(row);
    if(!item.idEstudiantePeriodo){ return Promise.reject(new Error("Nota sin identificación y período.")); }
    return Repos.safePut(store(),item);
  }

  function saveMany(rows){
    var grouped = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function(source){
      var row = normalize(source);
      if(!row.idEstudiantePeriodo){ return; }
      grouped[row.idEstudiantePeriodo] = grouped[row.idEstudiantePeriodo]
        ? mergeNoteRows(grouped[row.idEstudiantePeriodo],row)
        : row;
    });
    var items = Object.keys(grouped).map(function(id){ return grouped[id]; });
    return items.length ? Repos.bulkPut(store(),items) : Promise.resolve([]);
  }

  var api = {
    version:VERSION,
    list:list,
    getByPeriodoCedula:getByPeriodoCedula,
    save:save,
    saveMany:saveMany,
    normalize:normalize,
    makeId:makeId,
    parseIdentity:parseIdentity,
    mergeNoteRows:mergeNoteRows,
    mergeRows:mergeRows,
    noteValues:noteValues
  };

  Repos.register("notas",api);
  Repos.register("notas_titulacion",api);
  window.BDLRepoNotas = api;
})(window);