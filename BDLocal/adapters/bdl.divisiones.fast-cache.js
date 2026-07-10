/* =========================================================
Nombre completo: bdl.divisiones.fast-cache.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.divisiones.fast-cache.js
Función o funciones:
- Optimizar BLDivisionesService sin escanear estudiantes.
- Evitar parsear localStorage una vez por cada estudiante.
- Tomar divisiones desde configuración por período: carga.periodos.divisiones, carga.periodos.local y cache BDLocal.
- Mantener studentDivision(), hasDivision(), divisionsForPeriod(), careersForPeriod() y listDivisions().
- Reinstalarse automáticamente si otro adaptador antiguo sobrescribe BLDivisionesService durante el arranque.
Con qué se conecta:
- bdl.divisiones.service.js
- bdl.screen-deps.js
- Ficha, Stats, Carga y demás pantallas que leen divisiones.
========================================================= */
(function(window){
  "use strict";

  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var VERSION = "1.1.2-fast-cache-final";

  var memo = { sig:"", state:null };
  var api = null;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function key(value){ return norm(value).replace(/[^a-z0-9]+/g, ""); }
  function parse(raw, fallback){ try{ var value = JSON.parse(raw || ""); return value == null ? fallback : value; }catch(error){ return fallback; } }
  function raw(name){ try{ return window.localStorage.getItem(name) || ""; }catch(error){ return ""; } }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);
    return !b || !!a && (a === b || key(a) === key(b));
  }

  function periodIdOf(row){
    row = row || {};
    return canonicalPeriodId(row.periodoCanonicoId || row.periodoId || row.periodId || row.ultimoPeriodoId || row._periodoId || row._bl2PeriodoId || row.idPeriodo || row.value || "");
  }

  function careerId(item){
    item = item || {};
    if(typeof item === "string"){ return key(item); }
    return text(item.id || item.codigo || item.CodigoCarrera || item.codigoCarrera || item.codCarrera || "") || key(item.nombre || item.NombreCarrera || item.nombreCarrera || item.Carrera || item.carrera || item._carrera || item.label || "");
  }

  function careerName(item){
    item = item || {};
    if(typeof item === "string"){ return text(item); }
    return text(item.nombre || item.NombreCarrera || item.nombreCarrera || item.Carrera || item.carrera || item._carrera || item.label || item.codigo || item.CodigoCarrera || item.id || "");
  }

  function normalizeCareer(item){
    var id = careerId(item);
    var name = careerName(item);
    if(!id && !name){ return null; }
    return { id:id || key(name), codigo:text(item && (item.codigo || item.CodigoCarrera || item.codigoCarrera || "")), nombre:name || id };
  }

  function uniqueCareers(list){
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function(item){
      var career = normalizeCareer(item);
      if(career && career.id){ map[career.id] = career; }
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" }); });
  }

  function normalizeDivision(item){
    if(!item){ return null; }
    if(typeof item === "string"){
      var label = text(item);
      return label ? { id:key(label), nombre:label, carreras:[] } : null;
    }
    var nombre = text(item.nombre || item.label || item.name || item.id || "");
    var id = text(item.id || key(nombre));
    if(!id && !nombre){ return null; }
    return { id:id || key(nombre), nombre:nombre || id, carreras:uniqueCareers(item.carreras || []), updatedAt:item.updatedAt || item.actualizadoEn || "" };
  }

  function mergeDivisions(){
    var map = {};
    Array.prototype.slice.call(arguments).forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(item){
        var div = normalizeDivision(item);
        if(!div){ return; }
        if(!map[div.id]){ map[div.id] = div; return; }
        map[div.id] = Object.assign({}, map[div.id], div, { carreras:uniqueCareers([].concat(map[div.id].carreras || [], div.carreras || [])) });
      });
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" }); });
  }

  function storeMap(rawStore){
    var store = parse(rawStore, {});
    var out = {};
    if(!store || typeof store !== "object" || Array.isArray(store)){ return out; }
    Object.keys(store).forEach(function(rawPeriodId){
      var periodId = canonicalPeriodId(rawPeriodId);
      var value = store[rawPeriodId];
      var list = Array.isArray(value) ? value : value && Array.isArray(value.divisiones) ? value.divisiones : value && Array.isArray(value.items) ? value.items : [];
      if(periodId){ out[periodId] = mergeDivisions(out[periodId] || [], list); }
    });
    return out;
  }

  function periodList(rawPeriods, rawCache, rawOld){
    var local = parse(rawPeriods, []);
    local = Array.isArray(local) ? local : [];
    var cache = parse(rawCache, null);
    var fromCache = cache && Array.isArray(cache.periods) ? cache.periods : [];
    if(!local.length && !fromCache.length){
      var old = parse(rawOld, null);
      fromCache = old && Array.isArray(old.periods) ? old.periods : [];
    }
    return [].concat(fromCache, local).filter(Boolean);
  }

  function buildState(){
    var rawDiv = raw(LS_DIVISIONES);
    var rawPer = raw(LS_PERIODOS);
    var rawCache = raw(CACHE_KEY);
    var rawOld = raw(OLD_SNAPSHOT_KEY);
    var sig = rawDiv + "|#|" + rawPer + "|#|" + rawCache + "|#|" + rawOld;
    if(memo.sig === sig && memo.state){ return memo.state; }

    var store = storeMap(rawDiv);
    var periods = periodList(rawPer, rawCache, rawOld);
    var periodMap = {};
    var divisionsByPeriod = {};
    var careersByPeriod = {};

    periods.forEach(function(period){
      var id = periodIdOf(period);
      if(!id){ return; }
      periodMap[id] = Object.assign({}, periodMap[id] || {}, period, { id:id, periodoId:id, periodoCanonicoId:id });
    });

    Object.keys(store).forEach(function(periodId){
      if(!periodMap[periodId]){ periodMap[periodId] = { id:periodId, periodoId:periodId, periodoCanonicoId:periodId, divisiones:[] }; }
    });

    Object.keys(periodMap).forEach(function(periodId){
      var period = periodMap[periodId] || {};
      var divs = mergeDivisions(store[periodId] || [], period.divisiones || []);
      divisionsByPeriod[periodId] = divs;
      careersByPeriod[periodId] = uniqueCareers([].concat(period.carrerasDetectadas || [], divs.reduce(function(out, div){ return out.concat(div.carreras || []); }, [])));
    });

    memo.sig = sig;
    memo.state = { periodMap:periodMap, divisionsByPeriod:divisionsByPeriod, careersByPeriod:careersByPeriod, store:store };
    return memo.state;
  }

  function findPeriod(periodId){
    periodId = canonicalPeriodId(periodId);
    var st = buildState();
    if(st.periodMap[periodId]){ return st.periodMap[periodId]; }
    var found = Object.keys(st.periodMap).filter(function(id){ return samePeriod(id, periodId); })[0];
    return found ? st.periodMap[found] : null;
  }

  function divisionsForPeriod(periodOrId){
    var periodId = typeof periodOrId === "string" ? canonicalPeriodId(periodOrId) : periodIdOf(periodOrId);
    if(!periodId && periodOrId && typeof periodOrId === "object"){ return mergeDivisions(periodOrId.divisiones || []); }
    var st = buildState();
    return (st.divisionsByPeriod[periodId] || []).slice();
  }

  function careersForPeriod(periodOrId){
    var periodId = typeof periodOrId === "string" ? canonicalPeriodId(periodOrId) : periodIdOf(periodOrId);
    if(periodId){ return (buildState().careersByPeriod[periodId] || []).slice(); }
    if(periodOrId && typeof periodOrId === "object"){ return uniqueCareers([].concat(periodOrId.carrerasDetectadas || [], divisionsForPeriod(periodOrId).reduce(function(out, div){ return out.concat(div.carreras || []); }, []))); }
    return [];
  }

  function directDivision(row){
    row = row || {};
    var value = text(row._division || row._bl2Division || row.division || row.Division || row["División"] || row.divisionActual || "");
    if(value && key(value) !== "sindivision"){ return value; }
    if(Array.isArray(row.divisiones) && row.divisiones.length){
      value = text(row.divisiones[0]);
      if(value && key(value) !== "sindivision"){ return value; }
    }
    return "";
  }

  function divisionByCareer(row){
    var periodId = periodIdOf(row || {});
    var cid = careerId(row || {});
    if(!periodId || !cid){ return ""; }
    var divs = divisionsForPeriod(periodId);
    for(var i = 0; i < divs.length; i += 1){
      var careers = divs[i].carreras || [];
      for(var j = 0; j < careers.length; j += 1){
        if(careerId(careers[j]) === cid){ return text(divs[i].nombre || divs[i].id); }
      }
    }
    return "";
  }

  function studentDivision(row){ return divisionByCareer(row) || directDivision(row) || "Sin división"; }
  function hasDivision(row, division){ return !text(division) || key(studentDivision(row)) === key(division); }

  function listDivisions(rows, options){
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    var periodId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var map = {};
    if(periodId){ divisionsForPeriod(periodId).forEach(function(div){ if(div && div.nombre){ map[key(div.nombre)] = div.nombre; } }); }
    rows.forEach(function(row){
      if(!periodId){ periodId = periodIdOf(row); }
      var div = studentDivision(row);
      if(div){ map[key(div)] = div; }
    });
    if(periodId){ divisionsForPeriod(periodId).forEach(function(div){ if(div && div.nombre){ map[key(div.nombre)] = div.nombre; } }); }
    return Object.keys(map).map(function(id){ return map[id]; }).filter(Boolean).sort(function(a, b){ return text(a).localeCompare(text(b), "es", { sensitivity:"base" }); });
  }

  function listDivisionsWithEmpty(rows, emptyLabel, options){
    var list = listDivisions(rows, options);
    emptyLabel = text(emptyLabel);
    return emptyLabel ? [emptyLabel].concat(list.filter(function(item){ return key(item) !== key(emptyLabel); })) : list;
  }

  function invalidate(){ memo.sig = ""; memo.state = null; }

  function install(){
    api = {
      version:VERSION,
      key:key,
      canonicalPeriodId:canonicalPeriodId,
      samePeriod:samePeriod,
      periodIdOf:periodIdOf,
      findPeriod:findPeriod,
      normalizeCareer:normalizeCareer,
      normalizeDivision:normalizeDivision,
      divisionsForPeriod:divisionsForPeriod,
      careersForPeriod:careersForPeriod,
      directDivision:directDivision,
      divisionByCareer:divisionByCareer,
      studentDivision:studentDivision,
      hasDivision:hasDivision,
      listDivisions:listDivisions,
      listDivisionsWithEmpty:listDivisionsWithEmpty,
      readState:buildState,
      invalidate:invalidate
    };

    window.BLDivisionesService = Object.assign({}, window.BLDivisionesService || {}, api);
  }

  install();
  window.addEventListener("storage", function(){ invalidate(); install(); });

  var attempts = 0;
  var guard = window.setInterval(function(){
    attempts += 1;
    if(!window.BLDivisionesService || window.BLDivisionesService.version !== VERSION){ install(); }
    if(attempts >= 40){ window.clearInterval(guard); }
  }, 100);

  try{ window.dispatchEvent(new CustomEvent("bdlocal:divisiones-fast-cache-ready", { detail:{ ok:true, version:VERSION, final:true } })); }catch(error){}
})(window);
