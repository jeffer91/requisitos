/* =========================================================
Nombre completo: baselocal.core.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.core.js
Función o funciones:
- Leer Base Local desde sesión rápida, BL2 o ExcelLocalRepo.
- Preparar vistas livianas para Base Local.
- Paginar estudiantes antes de renderizar para evitar cuelgues.
- Usar BL2DataEngine/BL2MemoryIndex cuando esté disponible.
- Mantener API de divisiones y diagnóstico para pantallas existentes.
Con qué se conecta:
- maq-baselocal-session.js
- excel-local.repo.js
- services/bl-campos.js
- services/bl-normalizador.js
- services/bl-filtros.js
- services/bl-divisiones.service.js
- services/bl-healthcheck.js
- baselocal.app.js
- baselocal.divisiones.js
========================================================= */
(function(window){
  "use strict";

  var MONTHS = {enero:"Enero", febrero:"Febrero", marzo:"Marzo", abril:"Abril", mayo:"Mayo", junio:"Junio", julio:"Julio", agosto:"Agosto", septiembre:"Septiembre", setiembre:"Septiembre", octubre:"Octubre", noviembre:"Noviembre", diciembre:"Diciembre"};
  var snapshotCache = {snapshot:null, cachedAt:0, signature:""};
  var CACHE_MS = 1500;

  function repo(){if(!window.ExcelLocalRepo){throw new Error("ExcelLocalRepo no disponible.");}return window.ExcelLocalRepo;}
  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function filtros(){if(!window.BLFiltros){throw new Error("BLFiltros no disponible.");}return window.BLFiltros;}
  function divisiones(){if(!window.BLDivisionesService){throw new Error("BLDivisionesService no disponible.");}return window.BLDivisionesService;}
  function text(value){return String(value == null ? "" : value).trim();}
  function normalizeText(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}
  function isMachinePeriodId(value){return /^20\d{2}[-_]\d{2}(_{1,2}|[-_])20\d{2}[-_]\d{2}$/.test(text(value));}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}

  function parentSession(){
    try{if(window.parent&&window.parent!==window&&window.parent.MAQ_BASELOCAL_SESSION){return window.parent.MAQ_BASELOCAL_SESSION;}}catch(error){}
    try{if(window.top&&window.top!==window&&window.top.MAQ_BASELOCAL_SESSION){return window.top.MAQ_BASELOCAL_SESSION;}}catch(error){}
    try{if(window.MAQ_BASELOCAL_SESSION){return window.MAQ_BASELOCAL_SESSION;}}catch(error){}
    return null;
  }

  function bl2(){return window.BL2 || null;}
  function bl2Engine(){return window.BL2DataEngine || null;}

  function isValidPeriod(value){
    var raw = text(value);var clean = normalizeText(raw);
    if(!raw || isCedulaLike(raw)){return false;}
    if(clean === "sin_periodo" || clean === "sin periodo"){return true;}
    if(isMachinePeriodId(raw)){return true;}
    return /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.test(clean) && /20\d{2}/.test(clean);
  }

  function periodKey(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.keyFromPeriod === "function"){return window.BLPeriodosCanon.keyFromPeriod(period);}
    var label = text(period && (period.label || period.periodoLabel || period.periodo || period.id));
    return normalizeText(label || (period && period.id));
  }

  function prettyPeriodLabel(value){
    var raw = text(value);var clean = normalizeText(raw);
    if(!clean){return raw;}
    Object.keys(MONTHS).forEach(function(month){var reg = new RegExp("\\b" + month + "\\b", "g");clean = clean.replace(reg, MONTHS[month]);});
    clean = clean.replace(/\ba\b/g, "a").replace(/\s+/g, " ").trim();
    return clean || raw;
  }

  function clearSnapshotCache(){
    snapshotCache = {snapshot:null, cachedAt:0, signature:""};
    try{if(filtros().clearCache){filtros().clearCache();}}catch(error){}
  }

  function normalizeSnapshotShape(snapshot){
    var snap = snapshot && typeof snapshot === "object" ? snapshot : {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snap.meta = snap.meta && typeof snap.meta === "object" ? snap.meta : {};
    snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    return snap;
  }

  function snapshotSignature(snapshot){
    snapshot = snapshot || {};
    var students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    var meta = snapshot.meta || {};
    var first = students[0] || {}, last = students[students.length - 1] || {};
    return [meta.updatedAt || meta.pulledAt || meta.createdAt || "", periods.length, students.length, first.cedula || first.numeroIdentificacion || "", last.cedula || last.numeroIdentificacion || ""].join("|");
  }

  function getSnapshot(options){
    options = options || {};
    if(options.force !== true && snapshotCache.snapshot && Date.now() - snapshotCache.cachedAt < CACHE_MS){return snapshotCache.snapshot;}
    var session = parentSession();
    var snap = null;
    try{if(session && typeof session.getSnapshot === "function"){snap = session.getSnapshot({clone:false, force:options.force === true});}}catch(error){snap = null;}
    try{if(!snap && bl2Engine() && typeof bl2Engine().snapshot === "function"){snap = bl2Engine().snapshot({clone:false, force:options.force === true});}}catch(error){snap = null;}
    if(!snap){snap = repo().getSnapshot();}
    snapshotCache.snapshot = normalizeSnapshotShape(snap);
    snapshotCache.signature = snapshotSignature(snapshotCache.snapshot);
    snapshotCache.cachedAt = Date.now();
    return snapshotCache.snapshot;
  }

  function samePeriod(a,b){if(!text(b)){return true;}if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}return normalizeText(a) === normalizeText(b);}
  function isDeleteHistory(row){return text(row && row.action) === "borrarPeriodo";}
  function isExpiredDeleteHistory(row){var limit = Date.parse(text(row && (row.archivadoHasta || row.expiresAt)));return Number.isFinite(limit) && Date.now() > limit;}
  function activeDeleteHistory(snapshot){return (Array.isArray(snapshot && snapshot.history) ? snapshot.history : []).filter(function(row){return isDeleteHistory(row) && !isExpiredDeleteHistory(row);});}
  function isPeriodArchived(periodId, snapshot){
    var id = text(periodId);
    if(!id){return false;}
    return activeDeleteHistory(snapshot).some(function(row){return samePeriod(row.periodoId || row.periodoLabel, id) || samePeriod(row.periodoLabel, id);});
  }

  function rowPeriod(row){return text(row && (row._bl2PeriodoId || row.periodoId || row.ultimoPeriodoId || row.periodId || row.PeriodoId || row.periodo || row.Periodo || row.periodoLabel));}
  function careerOf(row){return text(row && (row._bl2Carrera || row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa)) || "SIN CARRERA";}
  function divisionOf(row){return divisiones().studentDivision(row);}

  function getAllStudentsRaw(snapshot){
    snapshot = snapshot || getSnapshot();
    var rows = Array.isArray(snapshot.students) ? snapshot.students : [];
    return rows.filter(function(row){return !isPeriodArchived(row && (row.periodoId || row.periodoLabel || row.ultimoPeriodoId), snapshot);});
  }

  function getPeriods(snapshot){
    snapshot = snapshot || getSnapshot();
    var sourcePeriods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    if((!sourcePeriods.length) && bl2() && bl2().periodos && typeof bl2().periodos.listar === "function"){
      try{sourcePeriods = bl2().periodos.listar() || [];}catch(error){}
    }
    var map = {};var result = [];
    sourcePeriods.forEach(function(period){
      var normalized = normalizador().normalizePeriod(period);
      var label = text(normalized.label || normalized.periodoLabel || normalized.id);
      var id = text(normalized.id || normalized.periodoId || label);
      var key = periodKey(normalized);
      if(!isValidPeriod(label || id) || !key || map[key] || isPeriodArchived(id || label, snapshot) || isPeriodArchived(label, snapshot)){return;}
      map[key] = true;
      result.push(Object.assign({}, normalized, {id:id || key.replace(/\s+/g, "_"), label:prettyPeriodLabel(label || id), updatedAt:text(normalized.updatedAt)}));
    });
    return result;
  }

  function getStudents(periodId, search, estadoMatricula, snapshot){return filtros().filterStudents(getAllStudentsRaw(snapshot), {periodoId:periodId || "", search:search || "", estadoMatricula:estadoMatricula == null ? "ACTIVO" : estadoMatricula});}
  function getStudentsPage(periodId, search, estadoMatricula, options, snapshot){
    options = options || {};
    var filters = {periodoId:periodId || "", search:search || "", estadoMatricula:estadoMatricula == null ? "ACTIVO" : estadoMatricula, division:options.division || "", offset:options.offset || 0, limit:options.limit || 0};
    try{
      if(bl2() && bl2().estudiantes && typeof bl2().estudiantes.listarPagina === "function"){
        var result = bl2().estudiantes.listarPagina({periodId:filters.periodoId, periodoId:filters.periodoId, search:filters.search, estadoMatricula:filters.estadoMatricula, matricula:filters.estadoMatricula, division:filters.division, offset:filters.offset, limit:filters.limit});
        if(result && Array.isArray(result.rows)){return {rows:result.rows,total:Number(result.total || result.rows.length || 0) || 0,offset:filters.offset,limit:filters.limit};}
      }
    }catch(error){}
    return filtros().filterStudentsPage(getAllStudentsRaw(snapshot), filters);
  }
  function getStudentsForPeriod(periodId, snapshot){return filtros().filterStudents(getAllStudentsRaw(snapshot), {periodoId:periodId || "", search:"", estadoMatricula:""});}
  function filterByDivisionRows(rows, division){return text(division) ? divisiones().filterByDivision(rows || [], division) : (rows || []);}
  function getHistory(snapshot){snapshot = snapshot || getSnapshot();return (Array.isArray(snapshot.history) ? snapshot.history : []).slice().reverse();}
  function getCareersCount(students){return filtros().uniqueCareers(students || []).length;}
  function getDivisions(periodId, snapshot){return divisiones().listDivisions(getAllStudentsRaw(snapshot), periodId || "");}
  function getDivisionsWithEmpty(periodId, snapshot){return divisiones().listDivisionsWithEmpty(getAllStudentsRaw(snapshot), periodId || "");}
  function getAvailableDivisionCareers(periodId, snapshot){return divisiones().availableCareers(getAllStudentsRaw(snapshot), periodId || "");}
  function getDivisionsSummary(periodId, snapshot){return divisiones().divisionsSummary(getAllStudentsRaw(snapshot), periodId || "");}

  function getDivisionDetail(periodId, divisionName, snapshot){
    snapshot = snapshot || getSnapshot();
    var wanted = normalizeText(divisionName);
    var carreras = {}, total = 0;
    getAllStudentsRaw(snapshot).forEach(function(row){
      if(periodId && !samePeriod(rowPeriod(row), periodId)){return;}
      if(normalizeText(divisionOf(row)) !== wanted){return;}
      carreras[careerOf(row)] = true;
      total += 1;
    });
    return {periodId:periodId || "", division:divisionName || "", carreras:Object.keys(carreras).sort(function(a,b){return a.localeCompare(b,"es");}), total:total};
  }

  function getDiagnostics(snapshot){
    snapshot = snapshot || getSnapshot();
    var allStudents = getAllStudentsRaw(snapshot);
    var careers = {};
    allStudents.forEach(function(student){careers[careerOf(student)] = (careers[careerOf(student)] || 0) + 1;});
    return {
      ok:true,
      updatedAt:snapshot.meta && snapshot.meta.updatedAt,
      totalPeriods:Array.isArray(snapshot.periods) ? snapshot.periods.length : 0,
      totalStudents:Array.isArray(snapshot.students) ? snapshot.students.length : 0,
      totalHistory:Array.isArray(snapshot.history) ? snapshot.history.length : 0,
      careers:careers,
      meta:snapshot.meta || {},
      periodsFiltered:true,
      periodsVisible:getPeriods(snapshot).length,
      periodosArchivados:activeDeleteHistory(snapshot).map(function(row){return {periodoId:row.periodoId, periodoLabel:row.periodoLabel, archivadoHasta:row.archivadoHasta, backupFileName:row.backupFileName};}),
      statusCounts:filtros().countByStatus(allStudents),
      divisiones:getDivisionsSummary("", snapshot),
      baseLocalServices:window.BLHealthCheck && typeof window.BLHealthCheck.serviceStatus === "function" ? window.BLHealthCheck.serviceStatus() : {campos:!!window.BLCampos, normalizador:!!window.BLNormalizador, filtros:!!window.BLFiltros, divisiones:!!window.BLDivisionesService},
      health:window.BLHealthCheck && typeof window.BLHealthCheck.run === "function" ? window.BLHealthCheck.run(snapshot) : {ok:false, issues:["BLHealthCheck no cargado"]}
    };
  }

  function writeSnapshot(snapshot, options){
    options = options || {};
    var clean = snapshot || {};
    clean.meta = Object.assign({}, clean.meta || {}, {updatedAt:now(), totalStudents:Array.isArray(clean.students) ? clean.students.length : 0, totalPeriods:Array.isArray(clean.periods) ? clean.periods.length : 0});
    clean.history = Array.isArray(clean.history) ? clean.history : [];
    clean.diagnostics = Array.isArray(clean.diagnostics) ? clean.diagnostics : [];
    if(window.RequisitosBL && typeof window.RequisitosBL.writeSnapshot === "function"){window.RequisitosBL.writeSnapshot(clean);}
    else if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.writeSnapshot === "function"){window.ExcelLocalStorage.writeSnapshot(clean);}
    else{throw new Error("No hay escritura disponible para Base Local.");}
    clearSnapshotCache();
    if(window.RequisitosBL && typeof window.RequisitosBL.notificar === "function"){window.RequisitosBL.notificar("snapshot-changed", {source:options.source || "baseLocalCore", updatedAt:now()});}
    return clean;
  }

  function periodLabelForHistory(snapshot, periodId){return (getPeriods(snapshot).find(function(p){return samePeriod(p.id, periodId);}) || {}).label || periodId;}

  function createDivision(periodId, divisionName){
    periodId = text(periodId);divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de crear la división.");}
    if(!divisionName){throw new Error("Escribe el nombre de la división.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    var existing = getDivisions(periodId, snapshot).some(function(name){return normalizeText(name) === normalizeText(divisionName);});
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_create_" + Date.now(), action:"crearDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:divisionName, totalRows:0, alreadyExists:existing, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division-create"});
    return {ok:true, action:"crearDivision", periodId:periodId, division:divisionName, updated:0, alreadyExists:existing, snapshot:saved, message:(existing ? "La división ya existía: " : "División creada: ") + divisionName};
  }

  function applyDivisionToCareers(periodId, divisionName, careers){
    periodId = text(periodId);divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de guardar la división.");}
    if(!divisionName){throw new Error("Escribe el nombre de la división.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var applied = divisiones().applyDivision(snapshot.students, periodId, divisionName, careers || []);
    snapshot.students = applied.students;
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_apply_" + Date.now(), action:"aplicarDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:divisionName, carreras:(careers || []).slice(), totalRows:applied.updated || 0, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division-apply"});
    return {ok:true, action:"aplicarDivision", periodId:periodId, division:divisionName, careers:(careers || []).slice(), updated:applied.updated || 0, snapshot:saved, message:"División guardada: " + divisionName};
  }

  function replaceDivisionToCareers(periodId, oldDivisionName, divisionName, careers){
    periodId = text(periodId);oldDivisionName = text(oldDivisionName);divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de editar la división.");}
    if(!divisionName){throw new Error("Escribe el nombre de la división.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    if(oldDivisionName){snapshot.students = divisiones().clearDivision(snapshot.students, periodId, oldDivisionName).students;}
    var applied = divisiones().applyDivision(snapshot.students, periodId, divisionName, careers || []);
    snapshot.students = applied.students;
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_replace_" + Date.now(), action:"editarDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:divisionName, divisionAnterior:oldDivisionName, carreras:(careers || []).slice(), totalRows:applied.updated || 0, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division-replace"});
    return {ok:true, action:"editarDivision", periodId:periodId, division:divisionName, oldDivision:oldDivisionName, careers:(careers || []).slice(), updated:applied.updated || 0, snapshot:saved, message:"Carreras actualizadas en " + divisionName};
  }

  function deleteDivision(periodId, divisionName){
    periodId = text(periodId);divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de borrar la división.");}
    if(!divisionName){throw new Error("Selecciona la división que deseas borrar.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var cleared = divisiones().clearDivision(snapshot.students, periodId, divisionName);
    snapshot.students = cleared.students;
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_delete_" + Date.now(), action:"borrarDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:divisionName, totalRows:cleared.updated || 0, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division-delete"});
    return {ok:true, action:"borrarDivision", periodId:periodId, division:divisionName, updated:cleared.updated || 0, snapshot:saved};
  }

  function buildView(periodId, search, estadoMatricula, options){
    options = options || {};
    var snapshot = getSnapshot({force:options.force === true});
    var division = text(options.division || "");
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    var studentsResult = options.skipStudents === true ? {rows:[],total:0,offset:offset,limit:limit} : getStudentsPage(periodId, search, estadoMatricula, {division:division, offset:offset, limit:limit}, snapshot);
    var studentsForPeriod = [];
    var needsStatus = options.includeStatusCounts !== false;
    if(needsStatus){studentsForPeriod = getStudentsForPeriod(periodId, snapshot);if(division){studentsForPeriod = filterByDivisionRows(studentsForPeriod, division);}}
    var statusCounts = needsStatus ? filtros().countByStatus(studentsForPeriod) : {ACTIVO:0, RETIRADO:0, TOTAL:0};
    var historyCount = Array.isArray(snapshot.history) ? snapshot.history.length : 0;
    return {
      periods:getPeriods(snapshot),
      students:studentsResult.rows || [],
      studentsPage:{offset:studentsResult.offset || offset, limit:studentsResult.limit || limit, total:studentsResult.total || 0},
      totalStudentsVisible:studentsResult.total || 0,
      allStudentsForPeriod:options.includeAllStudentsForPeriod === true ? studentsForPeriod : [],
      statusCounts:statusCounts,
      totalStudentsPeriod:statusCounts.TOTAL || studentsForPeriod.length,
      history:options.includeHistory === true ? getHistory(snapshot) : [],
      historyCount:historyCount,
      diagnostics:options.includeDiagnostics === true ? getDiagnostics(snapshot) : {ok:true, lazy:true, message:"Diagnóstico cargará al abrir la pestaña Diagnóstico."},
      careersCount:getCareersCount(studentsResult.rows || []),
      divisions:options.includeDivisions === true ? getDivisionsWithEmpty(periodId || "", snapshot) : [],
      divisionsSummary:options.includeDivisionsSummary === true ? getDivisionsSummary(periodId || "", snapshot) : {},
      snapshot:options.includeSnapshot === true ? snapshot : null
    };
  }

  window.BaseLocalAPI = {
    getSnapshot:getSnapshot,
    writeSnapshot:writeSnapshot,
    getPeriods:function(){return getPeriods(getSnapshot());},
    getStudents:function(periodId, search, estadoMatricula, division){return filterByDivisionRows(getStudents(periodId, search, estadoMatricula, getSnapshot()), division || "");},
    getStudentsPage:function(periodId, search, estadoMatricula, options){return getStudentsPage(periodId, search, estadoMatricula, options || {}, getSnapshot());},
    getHistory:function(){return getHistory(getSnapshot());},
    getDiagnostics:function(){return getDiagnostics(getSnapshot());},
    buildView:buildView,
    getDivisions:function(periodId){return getDivisions(periodId, getSnapshot());},
    getDivisionsWithEmpty:function(periodId){return getDivisionsWithEmpty(periodId, getSnapshot());},
    getAvailableDivisionCareers:function(periodId){return getAvailableDivisionCareers(periodId, getSnapshot());},
    getDivisionsSummary:function(periodId){return getDivisionsSummary(periodId, getSnapshot());},
    getDivisionDetail:function(periodId, divisionName){return getDivisionDetail(periodId, divisionName, getSnapshot());},
    createDivision:createDivision,
    applyDivisionToCareers:applyDivisionToCareers,
    replaceDivisionToCareers:replaceDivisionToCareers,
    deleteDivision:deleteDivision,
    isPeriodArchived:function(periodId){return isPeriodArchived(periodId, getSnapshot());},
    clearSnapshotCache:clearSnapshotCache,
    status:function(){var snap=getSnapshot();return {ok:true, mode:"baselocal_core_paged", students:(snap.students||[]).length, periods:(snap.periods||[]).length, cachedAt:snapshotCache.cachedAt, signature:snapshotCache.signature};}
  };
})(window);
