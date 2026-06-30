(function(window){
  "use strict";

  var KEY = "REQ_BDLOCAL_LEGACY_SNAPSHOT_V1";
  var cache = readSnapshot();

  function text(value){ return String(value == null ? "" : value).trim(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]/g, ""); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }
  function number(value){ if(value == null || text(value) === ""){ return null; } var n = Number(text(value).replace(",", ".")); return Number.isFinite(n) ? n : null; }
  function round2(value){ return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null; }

  function readSnapshot(){
    try{
      var raw = window.localStorage.getItem(KEY) || "";
      if(raw){
        var parsed = JSON.parse(raw);
        return normalizeSnapshot(parsed);
      }
    }catch(error){}
    return normalizeSnapshot({ periods:[], students:[], history:[], diagnostics:[], meta:{} });
  }

  function writeSnapshot(snapshot){
    cache = normalizeSnapshot(snapshot);
    try{ window.localStorage.setItem(KEY, JSON.stringify(cache)); }catch(error){}
    try{ window.localStorage.setItem("REQ_EXCEL_LOCAL_V1:snapshot", JSON.stringify(cache)); }catch(error){}
    try{ window.dispatchEvent(new CustomEvent("bdlocal:legacy-ready", { detail:{ source:"writeSnapshot", totalStudents:cache.students.length, totalPeriods:cache.periods.length, at:new Date().toISOString() } })); }catch(error){}
    if(window.BDLRepoEstudiantes && Array.isArray(cache.students) && cache.students.length){
      window.BDLRepoEstudiantes.guardarMuchos(cache.students).catch(function(error){ console.warn("[BDLLegacyAdapter] No se pudo guardar snapshot en BDLocal", error); });
    }
    return clone(cache);
  }

  function normalizeSnapshot(snapshot){
    snapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    snapshot.periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
    snapshot.meta = Object.assign({}, snapshot.meta || {}, {
      source:"BDLocalLegacyAdapter",
      updatedAt:new Date().toISOString(),
      totalPeriods:snapshot.periods.length,
      totalStudents:snapshot.students.length
    });
    return snapshot;
  }

  function periodIdOf(row){ row = row || {}; return text(row.periodoId || row.PeriodoId || row.periodId || row.idPeriodo || row.periodo || row.Periodo || row.periodoLabel || row.PeriodoLabel || row._periodoId || row._periodo); }
  function periodLabelOf(item){ item = item || {}; return text(item.periodoLabel || item.label || item.nombre || item.name || item.periodo || item.Periodo || item.periodoId || item.id || item.value); }
  function normalizePeriod(item){
    if(typeof item === "string"){ return { id:item, periodoId:item, label:item, periodoLabel:item }; }
    item = item || {};
    var id = text(item.id || item.periodoId || item.periodId || item.value || item.key || periodLabelOf(item));
    var label = periodLabelOf(item) || id;
    return Object.assign({}, item, { id:id, periodoId:id, value:id, label:label, periodoLabel:label });
  }

  function samePeriod(a, b){
    if(!text(b)){ return true; }
    if(!text(a)){ return false; }
    return text(a) === text(b) || norm(a) === norm(b) || compact(a) === compact(b);
  }

  function pick(row, names){
    row = row || {};
    for(var i = 0; i < names.length; i += 1){
      if(text(row[names[i]]) !== ""){ return row[names[i]]; }
    }
    return "";
  }

  function estadoMatricula(row){
    var value = norm(pick(row, ["estadoMatricula", "EstadoMatricula", "estado", "Estado", "_estadoMatricula", "_bl2EstadoMatricula"]));
    if(value.indexOf("retir") >= 0 || value.indexOf("inactivo") >= 0){ return "RETIRADO"; }
    return "ACTIVO";
  }

  function studentDivision(row){
    row = row || {};
    if(row._bl2Division){ return row._bl2Division; }
    if(row.divisionPrincipal){ return row.divisionPrincipal; }
    if(row.division){ return row.division; }
    if(row.Division){ return row.Division; }
    if(row["División"]){ return row["División"]; }
    if(Array.isArray(row.divisiones) && row.divisiones.length){ return row.divisiones[0]; }
    return "Sin división";
  }

  function hasDivision(row, division){
    if(!text(division)){ return true; }
    var list = Array.isArray(row && row.divisiones) ? row.divisiones.map(norm) : [];
    return norm(studentDivision(row)) === norm(division) || list.indexOf(norm(division)) >= 0;
  }

  function rowSearch(row){
    row = row || {};
    return norm([row.searchKey, row.numeroIdentificacion, row.cedula, row.Cedula, row.Nombres, row.nombres, row.nombreCarrera, row.NombreCarrera, row.carrera, row.Carrera, row.sede, row.Sede, studentDivision(row)].join(" "));
  }

  function filterStudents(options){
    options = options || {};
    var periodId = text(options.periodoId || options.periodId || options.period || "");
    var division = text(options.division || "");
    var matricula = options.estadoMatricula == null && options.matricula == null ? "" : text(options.estadoMatricula || options.matricula || "");
    var career = text(options.carrera || options.career || "");
    var search = norm(options.search || "");
    var rows = cache.students.slice();
    rows = rows.filter(function(row){
      if(periodId && !samePeriod(periodIdOf(row), periodId)){ return false; }
      if(division && !hasDivision(row, division)){ return false; }
      if(matricula && estadoMatricula(row) !== matricula){ return false; }
      if(career && text(row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera) !== career){ return false; }
      if(search && rowSearch(row).indexOf(search) < 0){ return false; }
      return true;
    });
    return rows;
  }

  function listPeriods(){
    var map = {};
    cache.periods.forEach(function(p){ var n = normalizePeriod(p); if(n.id){ map[n.id] = n; } });
    cache.students.forEach(function(row){
      var id = periodIdOf(row);
      if(id && !map[id]){ map[id] = normalizePeriod({ periodoId:id, periodoLabel:periodLabelOf(row) || id }); }
    });
    return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return text(b.label).localeCompare(text(a.label), "es"); });
  }

  function refresh(){
    if(!window.BDLRepoPeriodos || !window.BDLRepoEstudiantes){ return Promise.resolve(clone(cache)); }
    return Promise.all([
      window.BDLRepoPeriodos.listar().catch(function(){ return []; }),
      window.BDLRepoEstudiantes.listarResumen("", { limit:0 }).catch(function(){ return []; })
    ]).then(function(parts){
      cache = normalizeSnapshot({ periods:parts[0] || [], students:parts[1] || [], history:cache.history || [], diagnostics:cache.diagnostics || [] });
      try{ window.localStorage.setItem(KEY, JSON.stringify(cache)); }catch(error){}
      try{ window.localStorage.setItem("REQ_EXCEL_LOCAL_V1:snapshot", JSON.stringify(cache)); }catch(error){}
      try{ window.dispatchEvent(new CustomEvent("bdlocal:legacy-ready", { detail:{ source:"BDLocal", totalStudents:cache.students.length, totalPeriods:cache.periods.length, at:new Date().toISOString() } })); }catch(error){}
      return clone(cache);
    });
  }

  function notePatch(nart, ndef, options){
    options = options || {};
    var art = number(nart);
    var def = number(ndef);
    var fin = art !== null && def !== null && art >= 7 ? round2((art * 0.7) + (def * 0.3)) : null;
    var at = options.updatedAt || new Date().toISOString();
    return { Notart:art, Notdef:def, Notafinal:fin, Nart:art, Ndef:def, Nfin:fin, nart:art, ndef:def, nfin:fin, notaArticulo:art, notaDefensa:def, notaFinal:fin, updatedAt:at, ultimaEdicionLocal:at };
  }

  function install(){
    window.ExcelLocalConfig = window.ExcelLocalConfig || { keys:{ snapshot:"REQ_EXCEL_LOCAL_V1:snapshot" } };
    window.ExcelLocalStorage = window.ExcelLocalStorage || { readSnapshot:function(){ return clone(cache); }, writeSnapshot:writeSnapshot };
    window.ExcelLocalRepo = window.ExcelLocalRepo || {
      getSnapshot:function(){ return clone(cache); },
      listPeriods:listPeriods,
      listAllStudents:function(){ return clone(cache.students); },
      filterStudents:filterStudents,
      listStudentsByStatus:function(status, periodId){ return filterStudents({ matricula:status, periodId:periodId }); }
    };

    window.BLCampos = window.BLCampos || { requirementLabel:function(key, fallback){ return fallback || key; } };
    window.BLPeriodosCanon = window.BLPeriodosCanon || { samePeriod:samePeriod, normalizePeriod:normalizePeriod };
    window.BLDivisionesService = window.BLDivisionesService || { studentDivision:studentDivision, hasDivision:hasDivision, listDivisionsWithEmpty:function(rows, empty){ var map={}; if(empty !== undefined){ map[empty] = true; } (rows || []).forEach(function(row){ map[studentDivision(row)] = true; }); return Object.keys(map).filter(function(x){ return x !== ""; }).sort(); } };
    window.BLNotasDefensa = window.BLNotasDefensa || { normalizarNota:number, redondear2:round2, calcularNfin:function(a,b){ var p = notePatch(a,b); return p.Notafinal; }, formatearNota:function(v){ var n=number(v); return n === null ? "" : String(round2(n)); }, validarNota:function(v){ var n=number(v); return text(v) === "" || (n !== null && n >= 0 && n <= 10); }, aplicarNotas:notePatch, extraerNotas:function(row){ return { nart:number(pick(row,["Notart","Nart","nart","notaArticulo"])), ndef:number(pick(row,["Notdef","Ndef","ndef","notaDefensa"])), nfin:number(pick(row,["Notafinal","Nfin","nfin","notaFinal"])), completo:text(pick(row,["Notafinal","Nfin","nfin","notaFinal"])) !== "" }; } };

    window.BL2StudentNormalizer = window.BL2StudentNormalizer || { normalize:function(row){ return Object.assign({}, row || {}); } };
    window.BL2RequirementsEngine = window.BL2RequirementsEngine || window.StatsRules || null;
    window.BL2DataEngine = window.BL2DataEngine || { invalidate:function(){ refresh(); }, listPeriods:listPeriods, listStudents:function(options){ var rows = filterStudents(options || {}); return { rows:rows, total:rows.length }; } };
    window.BL2EstudiantesRepo = window.BL2EstudiantesRepo || { buscar:function(options){ var rows = filterStudents(options || {}); return { rows:rows, total:rows.length }; } };
    window.BL2CacheResumen = window.BL2CacheResumen || { invalidate:function(){ refresh(); } };
    window.BL2LegacyAdapter = window.BL2LegacyAdapter || { invalidate:function(){ refresh(); } };
    window.BL2 = window.BL2 || { invalidate:function(){ refresh(); } };
    window.BaseLocalConnector = window.BaseLocalConnector || { status:function(){ return { ok:true, source:"BDLocalLegacyAdapter" }; } };
    window.RequisitosBL = window.RequisitosBL || { mirrorSnapshotToCollections:function(){ return true; }, notificar:function(){} };
  }

  install();
  setTimeout(refresh, 0);

  window.BDLLegacyAdapter = { version:"1.0.0", refresh:refresh, snapshot:function(){ return clone(cache); }, filterStudents:filterStudents, listPeriods:listPeriods, writeSnapshot:writeSnapshot };
})(window);
