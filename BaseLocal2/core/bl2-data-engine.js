/* =========================================================
Nombre completo: bl2-data-engine.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-data-engine.js
Función o funciones:
- Ser la fuente central rápida para estudiantes y períodos normalizados.
- Construir y reutilizar un índice en memoria solo cuando realmente se consultan estudiantes.
- Evitar que cada pantalla lea localStorage, sesión o Excel por separado.
- Mantener compatibilidad con BL2LegacyAdapter mientras se migra a IndexedDB/SQLite.
Con qué se conecta:
- bl2-student-normalizer.js
- bl2-requirements-engine.js
- bl2-memory-index.js
- bl2-legacy-adapter.js
- bl2-api.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-data-fast.1";
  var CACHE_MS = 30000;
  var DEFAULT_LIMIT = 100;
  var cache = {snapshot:null,index:null,signature:"",source:"",builtAt:0,lastStatus:null};

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function indexer(){return window.BL2MemoryIndex || null;}
  function reqEngine(){return window.BL2RequirementsEngine || null;}
  function normalizer(){return window.BL2StudentNormalizer || null;}
  function schema(){return window.BL2Schema || null;}
  function search(){return window.BL2SearchService || null;}

  function emptySnapshot(){return {meta:{app:"Requisitos",module:"BL2DataEngine",source:"empty",updatedAt:now(),totalStudents:0,totalPeriods:0},periods:[],students:[],history:[],diagnostics:[]};}

  function normalizeStudent(row){
    try{if(schema() && schema().helpers && typeof schema().helpers.normalizeStudent === "function"){return schema().helpers.normalizeStudent(row);}}catch(error){}
    try{if(normalizer() && typeof normalizer().normalize === "function"){return normalizer().normalize(row || {}, {clone:false});}}catch(error){}
    return Object.assign({}, row || {});
  }

  function normalizePeriod(row){
    try{if(schema() && schema().helpers && typeof schema().helpers.normalizePeriod === "function"){return schema().helpers.normalizePeriod(row);}}catch(error){}
    return Object.assign({}, row || {});
  }

  function normalizeSnapshot(snapshot, source){
    var snap = snapshot && typeof snapshot === "object" ? snapshot : emptySnapshot();
    snap.meta = snap.meta && typeof snap.meta === "object" ? Object.assign({}, snap.meta) : {};
    snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    snap.meta.totalStudents = snap.students.length;
    snap.meta.totalPeriods = snap.periods.length;
    snap.meta.source = source || snap.meta.source || "unknown";
    return snap;
  }

  function readRawSnapshot(){
    try{if(window.BL2LegacyAdapter && typeof window.BL2LegacyAdapter.readSnapshot === "function"){return normalizeSnapshot(window.BL2LegacyAdapter.readSnapshot({clone:false}), "BL2LegacyAdapter");}}catch(error){}
    try{if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){return normalizeSnapshot(window.ExcelLocalStorage.readSnapshot({session:false, clone:false}), "ExcelLocalStorage");}}catch(error){}
    try{if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.getSnapshot === "function"){return normalizeSnapshot(window.ExcelLocalRepo.getSnapshot(), "ExcelLocalRepo");}}catch(error){}
    return emptySnapshot();
  }

  function signatureOf(snapshot){
    snapshot = normalizeSnapshot(snapshot, "signature");
    var students = snapshot.students || [];
    var periods = snapshot.periods || [];
    var meta = snapshot.meta || {};
    var first = students[0] || {};
    var last = students[students.length - 1] || {};
    return [
      meta.updatedAt || meta.pulledAt || meta.createdAt || "",
      periods.length,
      students.length,
      first.cedula || first.numeroIdentificacion || first._docId || "",
      last.cedula || last.numeroIdentificacion || last._docId || ""
    ].join("|");
  }

  function snapshotOnly(options){
    options = options || {};
    var snap = readRawSnapshot();
    var signature = signatureOf(snap);
    if(options.force !== true && cache.snapshot && cache.signature === signature && Date.now() - cache.builtAt < CACHE_MS){return cache;}
    cache.snapshot = snap;
    cache.signature = signature;
    cache.source = snap.meta && snap.meta.source ? snap.meta.source : "unknown";
    cache.builtAt = Date.now();
    return cache;
  }

  function build(options){
    options = options || {};
    var current = snapshotOnly(options);
    if(options.force !== true && cache.index && cache.signature === current.signature && Date.now() - cache.builtAt < CACHE_MS){return cache;}

    var snap = current.snapshot || emptySnapshot();
    var started = Date.now();
    var students = (snap.students || []).map(normalizeStudent);
    var periods = (snap.periods || []).map(normalizePeriod);
    var idx = indexer() && typeof indexer().create === "function"
      ? indexer().create(students, periods, {signature:current.signature})
      : {rows:students, periods:periods, createdAt:now(), signature:current.signature, buildMs:Date.now() - started};

    cache.snapshot = Object.assign({}, snap, {students:students, periods:periods});
    cache.index = idx;
    cache.signature = current.signature;
    cache.source = snap.meta && snap.meta.source ? snap.meta.source : "unknown";
    cache.builtAt = Date.now();
    return cache;
  }

  function invalidate(){cache = {snapshot:null,index:null,signature:"",source:"",builtAt:0,lastStatus:null};}

  function snapshot(options){
    options = options || {};
    var current = options.withIndex === true ? build(options) : snapshotOnly(options);
    var snap = current.snapshot || emptySnapshot();
    return options.clone === false ? snap : clone(snap);
  }

  function listPeriods(options){
    options = options || {};
    var snap = snapshotOnly(options).snapshot || emptySnapshot();
    var rows = (snap.periods || []).map(normalizePeriod);
    return rows;
  }

  function fallbackFilter(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    var searchText = text(options.search || options.q || "");
    var periodId = text(options.periodId || options.periodoId || "");
    var estado = text(options.estadoMatricula || options.matricula || "");
    var division = text(options.division || "");
    var carrera = text(options.career || options.carrera || "");
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit == null ? DEFAULT_LIMIT : options.limit) || 0);

    var norm = search() && search().normalize ? search().normalize : function(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();};
    function same(a,b){try{if(window.BLPeriodosCanon && window.BLPeriodosCanon.samePeriod){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}return !text(b) || text(a) === text(b) || norm(a) === norm(b);}

    var filtered = rows.filter(function(row){
      row = normalizeStudent(row);
      if(periodId && !same(row.periodoId || row._bl2PeriodoId || row.periodoLabel, periodId)){return false;}
      if(estado && text(row.estadoMatricula || row._bl2EstadoMatricula).toUpperCase() !== estado.toUpperCase()){return false;}
      if(division && norm(row.division || row._bl2Division || "Sin división") !== norm(division)){return false;}
      if(carrera && norm(row.nombreCarrera || row._bl2Carrera || row.carrera) !== norm(carrera)){return false;}
      if(searchText && search() && search().matches){return search().matches(row, searchText);}
      if(searchText){return norm([row.searchText, row._bl2Search, row.cedula, row.numeroIdentificacion, row.nombres, row.nombreCarrera, row.periodoLabel].join(" ")).indexOf(norm(searchText)) >= 0;}
      return true;
    });

    var total = filtered.length;
    if(limit){filtered = filtered.slice(offset, offset + limit);}
    return {rows:filtered, total:total, offset:offset, limit:limit || total, source:"BL2DataEngineFallback"};
  }

  function listStudents(options){
    options = options || {};
    var current = build({force:options.force === true});
    if(indexer() && typeof indexer().filter === "function"){return indexer().filter(current.index, options);}
    return fallbackFilter((current.snapshot && current.snapshot.students) || [], options);
  }

  function getStudentById(id, options){
    id = text(id);
    if(!id){return null;}
    var current = build({force:options && options.force === true});
    if(current.index && current.index.byId && current.index.byId[id]){return current.index.byId[id];}
    var rows = current.index && current.index.rows ? current.index.rows : ((current.snapshot && current.snapshot.students) || []);
    return rows.filter(function(row){return text(row._bl2Id || row.cedula || row.numeroIdentificacion || row.docId || row.id) === id;})[0] || null;
  }

  function countByStatus(rows){
    var out = {ACTIVO:0, RETIRADO:0, TOTAL:0};
    (rows || []).forEach(function(row){
      var estado = text(row._bl2EstadoMatricula || row.estadoMatricula || "ACTIVO").toUpperCase();
      if(estado.indexOf("RETIR") >= 0){out.RETIRADO += 1;}else{out.ACTIVO += 1;}
      out.TOTAL += 1;
    });
    return out;
  }

  function statsSummary(options){
    options = options || {};
    var result = listStudents(Object.assign({}, options, {limit:0}));
    var rows = result.rows || [];
    var estados = {cumple:0,no_cumple:0,pendiente:0};
    rows.forEach(function(row){if(row._bl2Approval && row._bl2Approval.approved){estados.cumple += 1;}else{estados.no_cumple += 1;}});
    var requirements = reqEngine() && typeof reqEngine().requirementTotals === "function" ? reqEngine().requirementTotals(rows) : [];
    var totalReq = 0, okReq = 0;
    requirements.forEach(function(item){totalReq += item.aplica || item.total || 0;okReq += item.cumple || 0;});
    var by = indexer() && typeof indexer().byKey === "function" ? indexer().byKey : null;
    var current = build({force:options.force === true});
    var optionLists = indexer() && indexer().optionsFromRows ? indexer().optionsFromRows(rows) : {divisiones:[], carreras:[]};

    return {
      total:rows.length,
      estudiantes:rows,
      rows:rows,
      statusCounts:countByStatus(rows),
      estados:estados,
      avanceGeneral:totalReq ? Math.round((okReq * 10000) / totalReq) / 100 : 0,
      requisitos:requirements,
      periodList:(current.index && current.index.periods) || listPeriods(options),
      divisionList:optionLists.divisiones || [],
      careerList:optionLists.carreras || [],
      carreras:by ? by(rows,function(row){return row._bl2Carrera || row.nombreCarrera;}) : [],
      periodos:by ? by(rows,function(row){return row._bl2Periodo || row.periodoLabel;}) : [],
      divisiones:by ? by(rows,function(row){return row._bl2Division || row.division;}) : [],
      diagnostics:{source:"BL2DataEngine",generatedAt:now(),signature:cache.signature,buildMs:current.index && current.index.buildMs || 0,students:rows.length,totalRequirements:totalReq,fulfilledRequirements:okReq,filters:options}
    };
  }

  function status(options){
    options = options || {};
    if(options.deep !== true && options.force !== true && cache.lastStatus && Date.now() - cache.lastStatus.at < CACHE_MS){return Object.assign({}, cache.lastStatus.data, {cached:true, updatedAt:now()});}
    var current = options.deep === true || options.force === true ? build({force:options.force === true}) : snapshotOnly(options);
    var snap = current.snapshot || emptySnapshot();
    var data = {ok:true, mode:"bl2_data_engine", version:VERSION, source:current.source, students:(snap.students || []).length, periods:(snap.periods || []).length, indexed:!!current.index, signature:current.signature, builtAt:current.builtAt, updatedAt:now()};
    cache.lastStatus = {at:Date.now(), data:data};
    return data;
  }

  window.BL2DataEngine = {version:VERSION, build:build, invalidate:invalidate, snapshot:snapshot, listPeriods:listPeriods, listStudents:listStudents, getStudentById:getStudentById, statsSummary:statsSummary, status:status};
})(window);
