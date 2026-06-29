/* =========================================================
Nombre completo: baselocal.core.js
Ruta o ubicación: /Requisitos/BaseLocal/baselocal.core.js
Función o funciones:
- Leer la base local desde la sesión rápida o ExcelLocalRepo.
- Preparar datos para la pantalla Base Local usando una sola foto por render.
- Usar servicios pequeños para campos, normalización, filtros, diagnóstico y divisiones.
- Mostrar estudiantes activos por defecto y retirados solo con filtro.
- Crear, editar y borrar divisiones por período asignando carreras a estudiantes activos y retirados.
- Filtrar estudiantes por división.
- Ocultar períodos borrados que siguen archivados en historial por seguridad.
- Exponer escritura controlada para servicios internos de Base Local.
- Permitir vistas livianas para que cada pantalla renderice solo lo necesario.
Con qué se conecta:
- maq-baselocal-session.js
- excel-local.repo.js
- services/bl-campos.js
- services/bl-normalizador.js
- services/bl-filtros.js
- services/bl-divisiones.service.js
- services/bl-healthcheck.js
- services/bl-borrar-periodo.service.js
- baselocal.app.js
- baselocal.divisiones.js
========================================================= */
(function(window){
  "use strict";

  var MONTHS = {enero:"Enero", febrero:"Febrero", marzo:"Marzo", abril:"Abril", mayo:"Mayo", junio:"Junio", julio:"Julio", agosto:"Agosto", septiembre:"Septiembre", setiembre:"Septiembre", octubre:"Octubre", noviembre:"Noviembre", diciembre:"Diciembre"};
  var snapshotCache = {snapshot:null, cachedAt:0};

  function repo(){if(!window.ExcelLocalRepo){throw new Error("ExcelLocalRepo no disponible.");}return window.ExcelLocalRepo;}
  function normalizador(){if(!window.BLNormalizador){throw new Error("BLNormalizador no disponible.");}return window.BLNormalizador;}
  function filtros(){if(!window.BLFiltros){throw new Error("BLFiltros no disponible.");}return window.BLFiltros;}
  function divisiones(){if(!window.BLDivisionesService){throw new Error("BLDivisionesService no disponible.");}return window.BLDivisionesService;}
  function text(value){return String(value == null ? "" : value).trim();}
  function normalizeText(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}
  function isMachinePeriodId(value){return /^20\d{2}[-_]\d{2}(_{1,2}|[-_])20\d{2}[-_]\d{2}$/.test(text(value));}

  function parentSession(){
    try{if(window.parent&&window.parent!==window&&window.parent.MAQ_BASELOCAL_SESSION){return window.parent.MAQ_BASELOCAL_SESSION;}}catch(error){}
    try{if(window.top&&window.top!==window&&window.top.MAQ_BASELOCAL_SESSION){return window.top.MAQ_BASELOCAL_SESSION;}}catch(error){}
    return null;
  }

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

  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function now(){return new Date().toISOString();}
  function clearSnapshotCache(){snapshotCache.snapshot=null;snapshotCache.cachedAt=0;}

  function normalizeSnapshotShape(snapshot){
    var snap = snapshot && typeof snapshot === "object" ? snapshot : {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snap.meta = snap.meta && typeof snap.meta === "object" ? snap.meta : {};
    snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    return snap;
  }

  function getSnapshot(options){
    options = options || {};
    var freshWindowMs = 500;
    if(options.force !== true && snapshotCache.snapshot && Date.now() - snapshotCache.cachedAt < freshWindowMs){
      return snapshotCache.snapshot;
    }
    var session = parentSession();
    var snap = null;
    try{
      if(session && typeof session.getSnapshot === "function"){
        snap = session.getSnapshot({clone:false, force:options.force === true});
      }
    }catch(error){snap = null;}
    if(!snap){snap = repo().getSnapshot();}
    snapshotCache.snapshot = normalizeSnapshotShape(snap);
    snapshotCache.cachedAt = Date.now();
    return snapshotCache.snapshot;
  }

  function samePeriod(a,b){if(!text(b)){return true;}if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}return text(a) === text(b);}

  function isDeleteHistory(row){return text(row && row.action) === "borrarPeriodo";}
  function isExpiredDeleteHistory(row){var limit = Date.parse(text(row && (row.archivadoHasta || row.expiresAt)));return Number.isFinite(limit) && Date.now() > limit;}
  function activeDeleteHistory(snapshot){return (Array.isArray(snapshot && snapshot.history) ? snapshot.history : []).filter(function(row){return isDeleteHistory(row) && !isExpiredDeleteHistory(row);});}
  function isPeriodArchived(periodId, snapshot){
    var id = text(periodId);
    if(!id){return false;}
    return activeDeleteHistory(snapshot).some(function(row){return samePeriod(row.periodoId || row.periodoLabel, id) || samePeriod(row.periodoLabel, id);});
  }

  function getAllStudentsRaw(snapshot){
    snapshot = snapshot || getSnapshot();
    var rows = Array.isArray(snapshot.students) ? snapshot.students : [];
    return rows.filter(function(row){return !isPeriodArchived(row && (row.periodoId || row.periodoLabel || row.ultimoPeriodoId), snapshot);});
  }

  function getPeriods(snapshot){
    snapshot = snapshot || getSnapshot();
    var map = {};var result = [];
    (Array.isArray(snapshot.periods) ? snapshot.periods : []).forEach(function(period){
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

  function rowPeriod(row){return text(row && (row.periodoId || row.ultimoPeriodoId || row.periodId || row.PeriodoId || row.periodo || row.Periodo || row.periodoLabel));}
  function careerOf(row){return text(row && (row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa)) || "SIN CARRERA";}
  function divisionOf(row){return divisiones().studentDivision(row);}

  function getStudents(periodId, search, estadoMatricula, snapshot){return filtros().filterStudents(getAllStudentsRaw(snapshot), {periodoId:periodId || "", search:search || "", estadoMatricula:estadoMatricula == null ? "ACTIVO" : estadoMatricula});}
  function getStudentsForPeriod(periodId, snapshot){return filtros().filterStudents(getAllStudentsRaw(snapshot), {periodoId:periodId || "", search:"", estadoMatricula:""});}
  function filterByDivisionRows(rows, division){return text(division) ? divisiones().filterByDivision(rows || [], division) : (rows || []);}
  function getHistory(snapshot){snapshot = snapshot || getSnapshot();return (Array.isArray(snapshot.history) ? snapshot.history : []).slice().reverse();}

  function getDiagnostics(snapshot){
    snapshot = snapshot || getSnapshot();
    var allStudents = getAllStudentsRaw(snapshot);
    var careers = {};
    allStudents.forEach(function(student){var career = text(student.nombrecarrera || student.NombreCarrera || student.carrera) || "SIN CARRERA";careers[career] = (careers[career] || 0) + 1;});
    var diagnostics = {
      ok:true,
      updatedAt:snapshot.meta && snapshot.meta.updatedAt,
      totalPeriods:Array.isArray(snapshot.periods) ? snapshot.periods.length : 0,
      totalStudents:Array.isArray(snapshot.students) ? snapshot.students.length : 0,
      totalHistory:Array.isArray(snapshot.history) ? snapshot.history.length : 0,
      careers:careers,
      meta:snapshot.meta || {}
    };
    diagnostics.periodsFiltered = true;
    diagnostics.periodsVisible = getPeriods(snapshot).length;
    diagnostics.periodosArchivados = activeDeleteHistory(snapshot).map(function(row){return {periodoId:row.periodoId, periodoLabel:row.periodoLabel, archivadoHasta:row.archivadoHasta, backupFileName:row.backupFileName};});
    diagnostics.statusCounts = filtros().countByStatus(allStudents);
    diagnostics.divisiones = getDivisionsSummary("", snapshot);
    diagnostics.baseLocalServices = window.BLHealthCheck && typeof window.BLHealthCheck.serviceStatus === "function" ? window.BLHealthCheck.serviceStatus() : {campos:!!window.BLCampos, normalizador:!!window.BLNormalizador, filtros:!!window.BLFiltros, divisiones:!!window.BLDivisionesService};
    diagnostics.health = window.BLHealthCheck && typeof window.BLHealthCheck.run === "function" ? window.BLHealthCheck.run(snapshot) : {ok:false, issues:["BLHealthCheck no cargado"]};
    return diagnostics;
  }

  function getCareersCount(students){return filtros().uniqueCareers(students || []).length;}

  function getDivisions(periodId, snapshot){return divisiones().listDivisions(getAllStudentsRaw(snapshot), periodId || "");}
  function getDivisionsWithEmpty(periodId, snapshot){return divisiones().listDivisionsWithEmpty(getAllStudentsRaw(snapshot), periodId || "");}
  function getAvailableDivisionCareers(periodId, snapshot){return divisiones().availableCareers(getAllStudentsRaw(snapshot), periodId || "");}
  function getDivisionsSummary(periodId, snapshot){return divisiones().divisionsSummary(getAllStudentsRaw(snapshot), periodId || "");}

  function getDivisionDetail(periodId, divisionName, snapshot){
    snapshot = snapshot || getSnapshot();
    var wanted = normalizeText(divisionName);
    var carreras = {};
    var total = 0;
    getAllStudentsRaw(snapshot).forEach(function(row){
      if(periodId && !samePeriod(rowPeriod(row), periodId)){return;}
      if(normalizeText(divisionOf(row)) !== wanted){return;}
      carreras[careerOf(row)] = true;
      total += 1;
    });
    return {periodId:periodId || "", division:divisionName || "", carreras:Object.keys(carreras).sort(function(a,b){return a.localeCompare(b,"es");}), total:total};
  }

  function writeSnapshot(snapshot, options){
    options = options || {};
    var clean = snapshot || {};
    clean.meta = Object.assign({}, clean.meta || {}, {updatedAt:now(), totalStudents:Array.isArray(clean.students) ? clean.students.length : 0, totalPeriods:Array.isArray(clean.periods) ? clean.periods.length : 0});
    clean.history = Array.isArray(clean.history) ? clean.history : [];
    clean.diagnostics = Array.isArray(clean.diagnostics) ? clean.diagnostics : [];
    if(window.RequisitosBL && typeof window.RequisitosBL.writeSnapshot === "function"){
      window.RequisitosBL.writeSnapshot(clean);
    }else if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.writeSnapshot === "function"){
      window.ExcelLocalStorage.writeSnapshot(clean);
    }else{
      throw new Error("No hay escritura disponible para Base Local.");
    }
    clearSnapshotCache();
    if(window.RequisitosBL && typeof window.RequisitosBL.rebuildSnapshotToCollections === "function"){
      window.RequisitosBL.rebuildSnapshotToCollections({force:true});
    }
    if(window.RequisitosBL && typeof window.RequisitosBL.notificar === "function"){
      window.RequisitosBL.notificar("snapshot-changed", {source:options.source || "baseLocalCore", updatedAt:now()});
    }
    return clean;
  }

  function periodLabelForHistory(snapshot, periodId){
    return (getPeriods(snapshot).find(function(p){return samePeriod(p.id, periodId);}) || {}).label || periodId;
  }

  function validateDivisionCareers(snapshot, periodId, divisionName, oldDivisionName, careers){
    var selected = Array.isArray(careers) ? careers : [];
    var assigned = divisiones().assignedCareers(snapshot.students, periodId);
    var valid = [];
    var seen = {};
    selected.forEach(function(career){
      var key = normalizeText(career);
      if(!key || seen[key]){return;}
      var currentDivision = assigned[career] || assigned[Object.keys(assigned).find(function(k){return normalizeText(k) === key;})];
      if(currentDivision && normalizeText(currentDivision) !== normalizeText(oldDivisionName || "") && normalizeText(currentDivision) !== normalizeText(divisionName || "")){
        throw new Error("La carrera ya pertenece a otra división: " + career + " → " + currentDivision);
      }
      seen[key] = true;
      valid.push(career);
    });
    return valid;
  }

  function applyDivisionToCareers(periodId, divisionName, careers){
    periodId = text(periodId);divisionName = text(divisionName);
    if(!periodId){throw new Error("Selecciona un período antes de crear la división.");}
    if(!divisionName){throw new Error("Escribe el nombre de la división.");}
    if(!Array.isArray(careers) || !careers.length){throw new Error("Selecciona al menos una carrera.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var available = divisiones().availableCareers(snapshot.students, periodId);
    var availableMap = {};
    available.forEach(function(career){availableMap[normalizeText(career)] = true;});
    var validCareers = careers.filter(function(career){return availableMap[normalizeText(career)];});
    if(!validCareers.length){throw new Error("Las carreras seleccionadas ya tienen división o no pertenecen al período.");}
    var applied = divisiones().applyDivision(snapshot.students, periodId, divisionName, validCareers);
    snapshot.students = applied.students;
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_" + Date.now(), action:"crearDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:divisionName, carreras:validCareers, totalRows:applied.updated || 0, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division"});
    return {ok:true, action:"crearDivision", periodId:periodId, division:divisionName, careers:validCareers, updated:applied.updated || 0, snapshot:saved};
  }

  function replaceDivisionToCareers(periodId, oldDivisionName, newDivisionName, careers){
    periodId = text(periodId);oldDivisionName = text(oldDivisionName);newDivisionName = text(newDivisionName);
    if(!periodId){throw new Error("Selecciona un período antes de editar la división.");}
    if(!newDivisionName){throw new Error("Escribe el nombre de la división.");}
    if(!Array.isArray(careers) || !careers.length){throw new Error("La división debe tener al menos una carrera.");}
    var snapshot = clone(getSnapshot({force:true})) || {meta:{},periods:[],students:[],history:[],diagnostics:[]};
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var validCareers = validateDivisionCareers(snapshot, periodId, newDivisionName, oldDivisionName, careers);
    var selected = {};
    validCareers.forEach(function(career){selected[normalizeText(career)] = true;});
    var updated = 0;
    snapshot.students = snapshot.students.map(function(student){
      var row = divisiones().normalizeStudent(student);
      if(periodId && !samePeriod(rowPeriod(row), periodId)){return row;}
      var careerKey = normalizeText(careerOf(row));
      var currentDivision = divisionOf(row);
      var isCurrentDivision = oldDivisionName ? normalizeText(currentDivision) === normalizeText(oldDivisionName) : normalizeText(currentDivision) === normalizeText(divisiones().sinDivision);
      var shouldBeInDivision = !!selected[careerKey];

      if(shouldBeInDivision){
        if(normalizeText(currentDivision) !== normalizeText(newDivisionName)){
          row.divisiones = [newDivisionName];
          row.division = newDivisionName;
          row.divisionActualizadaEn = now();
          row.updatedAt = now();
          row.ultimaSincronizacion = now();
          updated += 1;
        }
        return row;
      }

      if(isCurrentDivision){
        row.divisiones = [];
        delete row.division;
        row.divisionActualizadaEn = now();
        row.updatedAt = now();
        row.ultimaSincronizacion = now();
        updated += 1;
      }
      return row;
    });
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    snapshot.history.unshift({id:"division_edit_" + Date.now(), action:oldDivisionName ? "editarDivision" : "crearDivision", periodoId:periodId, periodoLabel:periodLabelForHistory(snapshot, periodId), fileName:"Base Local", division:newDivisionName, divisionAnterior:oldDivisionName, carreras:validCareers, totalRows:updated, createdAt:now()});
    var saved = writeSnapshot(snapshot, {source:"division-edit"});
    return {ok:true, action:oldDivisionName ? "editarDivision" : "crearDivision", periodId:periodId, division:newDivisionName, oldDivision:oldDivisionName, careers:validCareers, updated:updated, snapshot:saved};
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
    var students = options.skipStudents === true ? [] : getStudents(periodId, search, estadoMatricula, snapshot);
    if(division){students = filterByDivisionRows(students, division);}
    var needsStatus = options.includeStatusCounts !== false;
    var studentsForPeriod = needsStatus ? getStudentsForPeriod(periodId, snapshot) : [];
    if(division){studentsForPeriod = filterByDivisionRows(studentsForPeriod, division);}
    var statusCounts = needsStatus ? filtros().countByStatus(studentsForPeriod) : {ACTIVO:0, RETIRADO:0, TOTAL:0};
    var historyCount = Array.isArray(snapshot.history) ? snapshot.history.length : 0;
    return {
      periods:getPeriods(snapshot),
      students:students,
      allStudentsForPeriod:options.includeAllStudentsForPeriod === true ? studentsForPeriod : [],
      statusCounts:statusCounts,
      totalStudentsPeriod:statusCounts.TOTAL || studentsForPeriod.length,
      history:options.includeHistory === true ? getHistory(snapshot) : [],
      historyCount:historyCount,
      diagnostics:options.includeDiagnostics === true ? getDiagnostics(snapshot) : {ok:true, lazy:true, message:"Diagnóstico cargará al abrir la pestaña Diagnóstico."},
      careersCount:getCareersCount(students),
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
    getHistory:function(){return getHistory(getSnapshot());},
    getDiagnostics:function(){return getDiagnostics(getSnapshot());},
    buildView:buildView,
    getDivisions:function(periodId){return getDivisions(periodId, getSnapshot());},
    getDivisionsWithEmpty:function(periodId){return getDivisionsWithEmpty(periodId, getSnapshot());},
    getAvailableDivisionCareers:function(periodId){return getAvailableDivisionCareers(periodId, getSnapshot());},
    getDivisionsSummary:function(periodId){return getDivisionsSummary(periodId, getSnapshot());},
    getDivisionDetail:function(periodId, divisionName){return getDivisionDetail(periodId, divisionName, getSnapshot());},
    applyDivisionToCareers:applyDivisionToCareers,
    replaceDivisionToCareers:replaceDivisionToCareers,
    deleteDivision:deleteDivision,
    isPeriodArchived:function(periodId){return isPeriodArchived(periodId, getSnapshot());},
    clearSnapshotCache:clearSnapshotCache
  };
})(window);
