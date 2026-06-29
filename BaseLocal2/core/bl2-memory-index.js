/* =========================================================
Nombre completo: bl2-memory-index.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-memory-index.js
Función o funciones:
- Crear índices rápidos en memoria para estudiantes normalizados.
- Filtrar por período, división, carrera, matrícula, estado, requisito y búsqueda.
- Evitar recorrer toda la base muchas veces en cada pantalla.
Con qué se conecta:
- bl2-student-normalizer.js
- bl2-requirements-engine.js
- bl2-data-engine.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-core.1";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function key(value){return norm(value) || "__empty__";}
  function samePeriod(a,b){
    if(!text(b)){return true;}
    try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}
    return text(a) === text(b) || norm(a) === norm(b);
  }
  function unique(values){var map = {}, out = []; (values || []).forEach(function(value){value = text(value); if(value && !map[norm(value)]){map[norm(value)] = true; out.push(value);}}); return out.sort(function(a,b){return a.localeCompare(b,"es");});}
  function add(map, k, row){k = key(k); if(!map[k]){map[k] = [];} map[k].push(row);}
  function normalizer(){return window.BL2StudentNormalizer || null;}
  function reqEngine(){return window.BL2RequirementsEngine || null;}

  function normalizeRows(rows){
    if(normalizer() && typeof normalizer().normalizeList === "function"){return normalizer().normalizeList(rows || [], {clone:false});}
    return (Array.isArray(rows) ? rows : []).map(function(row){return Object.assign({}, row || {});});
  }

  function decorate(row){
    var out = row || {};
    if(reqEngine() && typeof reqEngine().studentApproval === "function"){
      out._bl2Approval = reqEngine().studentApproval(out);
      out._bl2FinalApproval = reqEngine().finalApproval(out);
    }
    return out;
  }

  function create(rows, periods, options){
    options = options || {};
    var started = Date.now();
    var normalized = normalizeRows(rows).map(decorate);
    var index = {byId:{}, byPeriod:{}, byDivision:{}, byCareer:{}, byMatricula:{}, rows:normalized, periods:Array.isArray(periods) ? periods.slice() : [], createdAt:new Date().toISOString(), signature:options.signature || "", version:VERSION};

    normalized.forEach(function(row){
      if(row._bl2Id){index.byId[String(row._bl2Id)] = row;}
      add(index.byPeriod, row._bl2PeriodoId || row.periodoId || row._bl2Periodo, row);
      add(index.byDivision, row._bl2Division || row.division || "Sin división", row);
      add(index.byCareer, row._bl2Carrera || row.nombrecarrera || row.carrera || "SIN CARRERA", row);
      add(index.byMatricula, row._bl2EstadoMatricula || row.estadoMatricula || "ACTIVO", row);
    });

    index.buildMs = Date.now() - started;
    return index;
  }

  function baseRows(index, filters){
    filters = filters || {};
    var rows = index && Array.isArray(index.rows) ? index.rows : [];
    if(text(filters.matricula || filters.estadoMatricula)){
      var mat = text(filters.matricula || filters.estadoMatricula);
      rows = (index.byMatricula[key(mat)] || []).slice();
    }
    return rows;
  }

  function filter(index, filters){
    filters = filters || {};
    var rows = baseRows(index, filters);
    var periodId = text(filters.periodId || filters.periodoId || "");
    var division = text(filters.division || "");
    var career = text(filters.career || filters.carrera || "");
    var search = norm(filters.search || filters.q || "");
    var status = text(filters.status || filters.estado || "");
    var requirementKey = text(filters.requirementKey || filters.requisito || "");

    rows = rows.filter(function(row){
      if(periodId && !samePeriod(row._bl2PeriodoId || row.periodoId || row._bl2Periodo, periodId)){return false;}
      if(division && norm(row._bl2Division || row.division || "Sin división") !== norm(division)){return false;}
      if(career && text(row._bl2Carrera || row.nombrecarrera || row.carrera) !== career){return false;}
      if(search && String(row._bl2Search || "").indexOf(search) < 0){return false;}
      if(status){
        var approvalId = row._bl2Approval && row._bl2Approval.approved ? "cumple" : "no_cumple";
        if(status !== approvalId){return false;}
      }
      if(requirementKey && reqEngine() && typeof reqEngine().requirementStatus === "function"){
        var r = reqEngine().requirementStatus(row, requirementKey);
        if(filters.requirementStatus === "cumple" && !r.cumple){return false;}
        if(filters.requirementStatus === "no_cumple" && (r.cumple || !r.applies)){return false;}
      }
      return true;
    });

    var total = rows.length;
    var offset = Math.max(0, Number(filters.offset || 0) || 0);
    var limit = Math.max(0, Number(filters.limit || 0) || 0);
    if(limit){rows = rows.slice(offset, offset + limit);}
    return {rows:rows,total:total,offset:offset,limit:limit || total};
  }

  function optionsFromRows(rows){
    rows = Array.isArray(rows) ? rows : [];
    return {
      carreras:unique(rows.map(function(row){return row._bl2Carrera || row.nombrecarrera || row.carrera || "SIN CARRERA";})),
      divisiones:unique(rows.map(function(row){return row._bl2Division || row.division || "Sin división";})),
      periodos:unique(rows.map(function(row){return row._bl2Periodo || row.periodoLabel || row.periodoId || "SIN PERÍODO";})),
      matriculas:unique(rows.map(function(row){return row._bl2EstadoMatricula || row.estadoMatricula || "ACTIVO";}))
    };
  }

  function byKey(rows, getter){
    var out = {};
    (rows || []).forEach(function(row){var k = getter(row) || "Sin dato"; if(!out[k]){out[k] = {key:k,total:0,cumple:0,no_cumple:0,avance:0};} out[k].total += 1; if(row._bl2Approval && row._bl2Approval.approved){out[k].cumple += 1;}else{out[k].no_cumple += 1;}});
    return Object.keys(out).map(function(k){var item = out[k]; item.avance = item.total ? Math.round((item.cumple * 10000) / item.total) / 100 : 0; return item;}).sort(function(a,b){return b.total - a.total || a.key.localeCompare(b.key,"es");});
  }

  window.BL2MemoryIndex = {version:VERSION,create:create,filter:filter,optionsFromRows:optionsFromRows,byKey:byKey,helpers:{text:text,norm:norm,samePeriod:samePeriod,unique:unique}};
})(window);
