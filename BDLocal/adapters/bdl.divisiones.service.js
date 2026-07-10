/* =========================================================
Nombre completo: bdl.divisiones.service.js
Ruta o ubicación: /Requisitos/BDLocal/adapters/bdl.divisiones.service.js
Función o funciones:
- Centralizar lectura y normalización de divisiones para todas las pantallas.
- Resolver división directa del estudiante o por carrera asignada al período.
- Leer divisiones guardadas desde BDLocal/periodos y desde Carga.
- Exponer BLDivisionesService para Ficha, Stats, Tabla, Defensas, Reportes y otras pantallas.
- Evitar recursión con bdl.screen-deps.js leyendo localStorage directamente.
Con qué se conecta:
- bdl.screen-deps.js
- BL2Core cuando está disponible
- localStorage carga.periodos.divisiones
- localStorage carga.periodos.local
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.1";
  var LS_DIVISIONES = "carga.periodos.divisiones";
  var LS_PERIODOS = "carga.periodos.local";
  var CACHE_KEY = "REQ_BDLOCAL_CONEXIONES_CACHE_V1";
  var OLD_SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";

  function text(value){
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function key(value){
    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function safeParse(value, fallback){
    try{
      var parsed = JSON.parse(value || "");
      return parsed === null || parsed === undefined ? fallback : parsed;
    }catch(error){
      return fallback;
    }
  }

  function storageGet(name, fallback){
    try{ return safeParse(window.localStorage.getItem(name), fallback); }
    catch(error){ return fallback; }
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }

    return value.replace(/_+/g, "__");
  }

  function samePeriod(a, b){
    a = canonicalPeriodId(a);
    b = canonicalPeriodId(b);

    if(!b){ return true; }
    if(!a){ return false; }

    return a === b || key(a) === key(b);
  }

  function careerId(item){
    item = item || {};

    if(typeof item === "string"){
      return key(item);
    }

    return text(
      item.id ||
      item.codigo ||
      item.CodigoCarrera ||
      item.codigoCarrera ||
      ""
    ) || key(
      item.nombre ||
      item.NombreCarrera ||
      item.nombreCarrera ||
      item.Carrera ||
      item.carrera ||
      item.label ||
      ""
    );
  }

  function careerName(item){
    item = item || {};

    if(typeof item === "string"){
      return text(item);
    }

    return text(
      item.nombre ||
      item.NombreCarrera ||
      item.nombreCarrera ||
      item.Carrera ||
      item.carrera ||
      item.label ||
      item.codigo ||
      item.CodigoCarrera ||
      item.id ||
      ""
    );
  }

  function normalizeCareer(item){
    var id = careerId(item);
    var name = careerName(item);

    if(!id && !name){ return null; }

    return {
      id: id || key(name),
      codigo: text(item && (item.codigo || item.CodigoCarrera || item.codigoCarrera || "")),
      nombre: name || id
    };
  }

  function normalizeDivision(div){
    if(!div){ return null; }

    if(typeof div === "string"){
      return {
        id: key(div),
        nombre: text(div),
        carreras: []
      };
    }

    var name = text(div.nombre || div.label || div.name || div.id || "");
    var id = text(div.id || key(name));
    var carreras = Array.isArray(div.carreras) ? div.carreras : [];

    return {
      id: id || key(name),
      nombre: name || id,
      carreras: carreras.map(normalizeCareer).filter(Boolean),
      updatedAt: div.updatedAt || div.actualizadoEn || ""
    };
  }

  function readRawCache(){
    var cache = storageGet(CACHE_KEY, null);

    if(!cache || typeof cache !== "object"){
      cache = {
        periods: [],
        students: []
      };
    }

    if((!cache.periods || !cache.periods.length) && (!cache.students || !cache.students.length)){
      var old = storageGet(OLD_SNAPSHOT_KEY, null);
      if(old && typeof old === "object"){
        cache.periods = Array.isArray(old.periods) ? old.periods : [];
        cache.students = Array.isArray(old.students) ? old.students : [];
      }
    }

    cache.periods = Array.isArray(cache.periods) ? cache.periods : [];
    cache.students = Array.isArray(cache.students) ? cache.students : [];

    return cache;
  }

  function localPeriods(){
    var fromCarga = storageGet(LS_PERIODOS, []);
    var cache = readRawCache();
    var out = [];

    if(Array.isArray(cache.periods)){ out = out.concat(cache.periods); }
    if(Array.isArray(fromCarga)){ out = out.concat(fromCarga); }

    return out;
  }

  function storeDivisionsMap(){
    var raw = storageGet(LS_DIVISIONES, {});
    return raw && typeof raw === "object" ? raw : {};
  }

  function periodIdOf(rowOrPeriod){
    rowOrPeriod = rowOrPeriod || {};
    return canonicalPeriodId(
      rowOrPeriod.periodoCanonicoId ||
      rowOrPeriod.periodoId ||
      rowOrPeriod.periodId ||
      rowOrPeriod.ultimoPeriodoId ||
      rowOrPeriod._periodoId ||
      rowOrPeriod._bl2PeriodoId ||
      rowOrPeriod.id ||
      rowOrPeriod.value ||
      ""
    );
  }

  function divisionsFromPeriod(period){
    period = period || {};
    var periodId = periodIdOf(period);
    var fromStore = storeDivisionsMap()[periodId];
    var list = [];

    if(fromStore && Array.isArray(fromStore.divisiones)){
      list = list.concat(fromStore.divisiones);
    }

    if(Array.isArray(period.divisiones)){
      list = list.concat(period.divisiones);
    }

    var map = {};
    list.map(normalizeDivision).filter(Boolean).forEach(function(div){
      if(!map[div.id]){
        map[div.id] = div;
        return;
      }

      var existingCareers = map[div.id].carreras || [];
      var nextCareers = div.carreras || [];
      var careerMap = {};

      existingCareers.concat(nextCareers).forEach(function(career){
        if(career && career.id){ careerMap[career.id] = career; }
      });

      map[div.id] = Object.assign({}, map[div.id], div, {
        carreras: Object.keys(careerMap).map(function(id){ return careerMap[id]; })
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; });
  }

  function findPeriod(periodId){
    periodId = canonicalPeriodId(periodId);
    if(!periodId){ return null; }

    var found = localPeriods().filter(function(period){
      return samePeriod(periodIdOf(period), periodId);
    })[0];

    if(found){ return found; }

    var store = storeDivisionsMap();
    if(store[periodId]){
      return {
        id: periodId,
        periodoId: periodId,
        periodoCanonicoId: periodId,
        divisiones: store[periodId].divisiones || []
      };
    }

    return null;
  }

  function divisionsForPeriod(periodOrId){
    var period = typeof periodOrId === "string" ? findPeriod(periodOrId) : periodOrId;
    if(!period){ return []; }
    return divisionsFromPeriod(period);
  }

  function careerIdFromStudent(row){
    return careerId(row || {});
  }

  function directDivision(row){
    row = row || {};

    var value = text(
      row._division ||
      row._bl2Division ||
      row.division ||
      row.Division ||
      row["División"] ||
      row.divisionActual ||
      ""
    );

    if(value && key(value) !== "sindivision"){
      return value;
    }

    if(Array.isArray(row.divisiones) && row.divisiones.length){
      var first = text(row.divisiones[0]);
      if(first && key(first) !== "sindivision"){
        return first;
      }
    }

    return "";
  }

  function divisionByCareer(row){
    row = row || {};
    var periodId = periodIdOf(row);
    var cid = careerIdFromStudent(row);

    if(!periodId || !cid){ return ""; }

    var divisions = divisionsForPeriod(periodId);

    for(var i = 0; i < divisions.length; i += 1){
      var div = divisions[i] || {};
      var carreras = Array.isArray(div.carreras) ? div.carreras : [];

      for(var j = 0; j < carreras.length; j += 1){
        if(careerId(carreras[j]) === cid){
          return text(div.nombre || div.label || div.id);
        }
      }
    }

    return "";
  }

  function studentDivision(row){
    var byCareer = divisionByCareer(row);
    if(byCareer){ return byCareer; }

    var direct = directDivision(row);
    if(direct){ return direct; }

    return "Sin división";
  }

  function hasDivision(row, division){
    if(!text(division)){ return true; }
    return key(studentDivision(row)) === key(division);
  }

  function listDivisions(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    var map = {};
    var periodId = canonicalPeriodId(options.periodoId || options.periodId || "");

    rows.forEach(function(row){
      var div = studentDivision(row);
      if(div){ map[key(div)] = div; }
      if(!periodId){ periodId = periodIdOf(row); }
    });

    if(periodId){
      divisionsForPeriod(periodId).forEach(function(div){
        if(div && div.nombre){ map[key(div.nombre)] = div.nombre; }
      });
    }

    return Object.keys(map).map(function(id){ return map[id]; }).filter(Boolean).sort(function(a, b){
      return text(a).localeCompare(text(b), "es", { sensitivity: "base" });
    });
  }

  function listDivisionsWithEmpty(rows, emptyLabel, options){
    var list = listDivisions(rows, options);
    emptyLabel = text(emptyLabel);

    if(emptyLabel){
      return [emptyLabel].concat(list.filter(function(item){ return key(item) !== key(emptyLabel); }));
    }

    return list;
  }

  function careersForPeriod(periodOrId){
    var period = typeof periodOrId === "string" ? findPeriod(periodOrId) : periodOrId;
    var map = {};

    if(period && Array.isArray(period.carrerasDetectadas)){
      period.carrerasDetectadas.map(normalizeCareer).filter(Boolean).forEach(function(career){
        map[career.id] = career;
      });
    }

    divisionsForPeriod(period || periodOrId).forEach(function(div){
      (div.carreras || []).forEach(function(career){
        if(career && career.id){ map[career.id] = career; }
      });
    });

    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity: "base" });
    });
  }

  window.BLDivisionesService = Object.assign({}, window.BLDivisionesService || {}, {
    version: VERSION,
    key: key,
    canonicalPeriodId: canonicalPeriodId,
    samePeriod: samePeriod,
    normalizeCareer: normalizeCareer,
    normalizeDivision: normalizeDivision,
    periodIdOf: periodIdOf,
    divisionsForPeriod: divisionsForPeriod,
    careersForPeriod: careersForPeriod,
    studentDivision: studentDivision,
    hasDivision: hasDivision,
    listDivisions: listDivisions,
    listDivisionsWithEmpty: listDivisionsWithEmpty,
    divisionByCareer: divisionByCareer,
    directDivision: directDivision,
    readStore: storeDivisionsMap,
    readRawCache: readRawCache
  });

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:divisiones-service-ready", {
      detail: {
        ok: true,
        version: VERSION,
        at: new Date().toISOString()
      }
    }));
  }catch(error){}
})(window);
