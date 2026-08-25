/* =========================================================
Nombre completo: bdl.divisiones.fast-cache.js
Ruta o ubicación: /BDLocal/adapters/bdl.divisiones.fast-cache.js
Función o funciones:
- Mantener compatibilidad con pantallas que todavía cargan este archivo.
- Reforzar BLDivisionesService con aislamiento estricto por período.
- Derivar carreras desde estudiantes reales del período cuando la caché compartida los contiene.
- Corregir la prioridad de identidad de carrera: código/nombre antes que ID de estudiante.
- Garantizar una sola división por carrera al entregar datos a las pantallas.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "3.0.0-period-integrity-bridge";
  var PATCH_FLAG = "__divisionPeriodIntegrityPatched";

  function service(){ return window.BLDivisionesService || null; }
  function U(){ return window.BDLocalConUtils || null; }
  function text(value){
    var utils = U();
    return utils && typeof utils.text === "function" ? utils.text(value) : String(value == null ? "" : value).trim();
  }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function key(value){
    var utils = U();
    return utils && typeof utils.normalizeKey === "function" ? utils.normalizeKey(value) : norm(value).replace(/[^a-z0-9]+/g, "");
  }
  function canon(value){
    var utils = U();
    if(utils && typeof utils.canonicalPeriodId === "function"){ return utils.canonicalPeriodId(value); }
    value = text(value);
    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    return match ? match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4] : value.replace(/_+/g, "__");
  }
  function samePeriod(a, b){
    var utils = U();
    if(utils && typeof utils.samePeriod === "function"){ return utils.samePeriod(a, b); }
    a = canon(a); b = canon(b);
    return !b || (!!a && (a === b || key(a) === key(b)));
  }
  function periodIdOf(row){
    row = row || {};
    return canon(row.periodoCanonicoId || row.periodoId || row.periodId || row.ultimoPeriodoId || row._periodoId || row._bl2PeriodoId || "");
  }
  function isStudentRow(item){
    item = item || {};
    return !!text(item.idEstudiantePeriodo || item.studentId || item.numeroIdentificacion || item.NumeroIdentificacion || item.cedula || item.identificacion || "");
  }
  function career(item){
    item = item || {};
    if(typeof item === "string"){ item = { nombre:item }; }
    var code = text(item.codigo || item.codigoCarrera || item.CodigoCarrera || item.codCarrera || "");
    var name = text(item.nombre || item.nombreCarrera || item.NombreCarrera || item.Carrera || item.carrera || item._carrera || item.label || code);
    var id = key(code || name);
    if(!id && !isStudentRow(item)){ id = key(item.id || ""); }
    if(!id || !name){ return null; }
    return { id:id, codigo:code, nombre:name, total:Math.max(0, Number(item.total || item.estudiantes || 0) || 0) };
  }
  function uniqueCareers(list){
    var map = Object.create(null);
    (Array.isArray(list) ? list : []).forEach(function(item){
      var current = career(item);
      if(!current){ return; }
      if(!map[current.id]){ map[current.id] = current; }
      else{ map[current.id] = Object.assign({}, map[current.id], current, { total:Math.max(Number(map[current.id].total || 0), Number(current.total || 0)) }); }
    });
    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity:"base" });
    });
  }
  function rowsForPeriod(periodId){
    periodId = canon(periodId);
    var utils = U();
    var cache = utils && typeof utils.readCache === "function" ? (utils.readCache() || {}) : {};
    var rows = Array.isArray(cache.students) ? cache.students : [];
    return rows.filter(function(row){ return samePeriod(periodIdOf(row), periodId); });
  }
  function careersFromStudents(rows){
    var counts = Object.create(null);
    var list = [];
    (rows || []).forEach(function(row){
      var current = career(row);
      if(!current){ return; }
      counts[current.id] = (counts[current.id] || 0) + 1;
      list.push(current);
    });
    return uniqueCareers(list).map(function(item){ return Object.assign({}, item, { total:counts[item.id] || 0 }); });
  }
  function sanitizeDivisions(list, allowedCareers){
    var allowed = Object.create(null);
    uniqueCareers(allowedCareers || []).forEach(function(item){ allowed[item.id] = item; });
    var owner = Object.create(null);
    return (Array.isArray(list) ? list : []).map(function(item){
      item = item || {};
      var result = Object.assign({}, item);
      var careers = [];
      (Array.isArray(item.carreras) ? item.carreras : []).forEach(function(value){
        var current = career(value);
        if(!current || !allowed[current.id] || owner[current.id]){ return; }
        owner[current.id] = text(item.id || item.nombre || item.label || "division");
        careers.push(allowed[current.id]);
      });
      result.carreras = uniqueCareers(careers);
      return result;
    });
  }
  function strictMap(periodId, divisions){
    var map = Object.create(null);
    (divisions || []).forEach(function(division){
      (division && Array.isArray(division.carreras) ? division.carreras : []).forEach(function(item){
        var current = career(item);
        if(current && !map[current.id]){ map[current.id] = text(division.nombre || division.label || division.id); }
      });
    });
    return map;
  }
  function patchService(){
    var current = service();
    if(!current){ return null; }
    if(current[PATCH_FLAG]){ return current; }

    var originalCareersForPeriod = typeof current.careersForPeriod === "function" ? current.careersForPeriod.bind(current) : function(){ return []; };
    var originalDivisionsForPeriod = typeof current.divisionsForPeriod === "function" ? current.divisionsForPeriod.bind(current) : function(){ return []; };
    var originalStudentDivision = typeof current.studentDivision === "function" ? current.studentDivision.bind(current) : function(){ return "Sin división"; };
    var originalListDivisions = typeof current.listDivisions === "function" ? current.listDivisions.bind(current) : function(){ return []; };

    current.careerKey = function(item){ var value = career(item); return value ? value.id : ""; };
    current.careerId = current.careerKey;
    current.normalizeCareer = career;
    current.uniqueCareers = uniqueCareers;
    current.sanitizeDivisions = sanitizeDivisions;

    current.careersForPeriod = function(periodOrId){
      var periodId = typeof periodOrId === "string" ? canon(periodOrId) : periodIdOf(periodOrId || {});
      var rows = periodId ? rowsForPeriod(periodId) : [];
      if(rows.length){ return careersFromStudents(rows); }
      return uniqueCareers(originalCareersForPeriod(periodOrId) || []);
    };

    current.divisionsForPeriod = function(periodOrId){
      var periodId = typeof periodOrId === "string" ? canon(periodOrId) : periodIdOf(periodOrId || {});
      var raw = originalDivisionsForPeriod(periodOrId) || [];
      var rows = periodId ? rowsForPeriod(periodId) : [];
      return rows.length ? sanitizeDivisions(raw, careersFromStudents(rows)) : raw;
    };

    current.divisionByCareer = function(row){
      row = row || {};
      var periodId = periodIdOf(row);
      var currentCareer = career(row);
      if(!periodId || !currentCareer){ return ""; }
      var rows = rowsForPeriod(periodId);
      if(!rows.length){
        var fallback = originalStudentDivision(row);
        return key(fallback) === "sindivision" ? "" : text(fallback);
      }
      return strictMap(periodId, current.divisionsForPeriod(periodId))[currentCareer.id] || "";
    };

    current.studentDivision = function(row){
      row = row || {};
      var periodId = periodIdOf(row);
      var currentCareer = career(row);
      var rows = periodId ? rowsForPeriod(periodId) : [];
      if(rows.length && currentCareer){
        return strictMap(periodId, current.divisionsForPeriod(periodId))[currentCareer.id] || "Sin división";
      }
      return originalStudentDivision(row) || "Sin división";
    };

    current.listDivisions = function(rows, options){
      rows = Array.isArray(rows) ? rows : [];
      options = options || {};
      var periodId = canon(options.periodoId || options.periodId || "");
      if(!periodId){ return originalListDivisions(rows, options); }
      var map = Object.create(null);
      current.divisionsForPeriod(periodId).forEach(function(division){
        var label = text(division && (division.nombre || division.label || division.id));
        if(label){ map[key(label)] = label; }
      });
      rows.forEach(function(row){
        if(!samePeriod(periodIdOf(row), periodId)){ return; }
        var label = current.studentDivision(row);
        if(label && key(label) !== "sindivision"){ map[key(label)] = label; }
      });
      return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){ return a.localeCompare(b, "es", { sensitivity:"base" }); });
    };

    current.listDivisionsWithEmpty = function(rows, emptyLabel, options){
      var list = current.listDivisions(rows, options || {});
      emptyLabel = text(emptyLabel);
      return emptyLabel ? [emptyLabel].concat(list.filter(function(item){ return key(item) !== key(emptyLabel); })) : list;
    };

    current[PATCH_FLAG] = true;
    current.periodIntegrityVersion = VERSION;
    return current;
  }
  function requireService(){
    var current = patchService();
    if(!current){ throw new Error("BLDivisionesService no está cargado. Incluya bdl.divisiones.service.js antes de bdl.divisiones.fast-cache.js."); }
    return current;
  }
  function call(method, args, fallback){
    var current = patchService();
    if(!current || typeof current[method] !== "function"){ return fallback; }
    return current[method].apply(current, Array.prototype.slice.call(args || []));
  }

  var api = {
    version:VERSION,
    source:"BDLocal/adapters/bdl.divisiones.fast-cache.js",
    mode:"period-integrity-bridge",
    ready:function(){ return Promise.resolve(requireService()); },
    install:function(){ return requireService(); },
    invalidate:function(){ return call("invalidate", arguments, true); },
    readState:function(){ return call("readState", arguments, { periodMap:{}, divisionsByPeriod:{}, careersByPeriod:{}, careerDivisionByPeriod:{}, store:{} }); },
    divisionsForPeriod:function(){ return call("divisionsForPeriod", arguments, []); },
    careersForPeriod:function(){ return call("careersForPeriod", arguments, []); },
    studentDivision:function(){ return call("studentDivision", arguments, "Sin división"); },
    hasDivision:function(){ return call("hasDivision", arguments, false); },
    listDivisions:function(){ return call("listDivisions", arguments, []); },
    listDivisionsWithEmpty:function(){ return call("listDivisionsWithEmpty", arguments, []); },
    status:function(){
      var current = patchService();
      var base = current && typeof current.status === "function" ? current.status() : null;
      return { ok:!!current, version:VERSION, mode:"period-integrity-bridge", serviceVersion:current && current.version || "", serviceStatus:base, strictPeriod:true };
    }
  };

  window.BLDivisionesFastCache = api;
  patchService();
  window.addEventListener("bdlocal:divisiones-service-ready", patchService);
  window.addEventListener("bdlocal:screen-data-updated", function(){ var current = patchService(); if(current && typeof current.invalidate === "function"){ current.invalidate(); } });
  window.addEventListener("carga:divisions-saved", function(){ var current = patchService(); if(current && typeof current.invalidate === "function"){ current.invalidate(); } });

  try{
    window.dispatchEvent(new CustomEvent("bdlocal:divisiones-fast-cache-ready", {
      detail:{ ok:!!service(), version:VERSION, bridge:true, final:true, strictPeriod:true, serviceVersion:service() && service().version || "", at:new Date().toISOString() }
    }));
  }catch(error){}
})(window);
