/* =========================================================
Nombre completo: bl2-data-engine.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-data-engine.js
Función o funciones:
- Ser la fuente central rápida para estudiantes y períodos normalizados.
- Construir y reutilizar un índice en memoria.
- Evitar que cada pantalla lea localStorage, sesión o Excel por separado.
- Mantener compatibilidad con BL2LegacyAdapter mientras se migra a SQLite/IndexedDB.
Con qué se conecta:
- bl2-student-normalizer.js
- bl2-requirements-engine.js
- bl2-memory-index.js
- bl2-legacy-adapter.js
- bl2-api.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-core.1";
  var cache = {snapshot:null,index:null,signature:"",source:"",builtAt:0};
  var CACHE_MS = 10000;

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function indexer(){return window.BL2MemoryIndex || null;}
  function reqEngine(){return window.BL2RequirementsEngine || null;}
  function normalizer(){return window.BL2StudentNormalizer || null;}

  function emptySnapshot(){return {meta:{app:"Requisitos",module:"BL2DataEngine",source:"empty",updatedAt:now(),totalStudents:0,totalPeriods:0},periods:[],students:[],history:[],diagnostics:[]};}

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
    try{if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){return normalizeSnapshot(window.ExcelLocalStorage.readSnapshot(), "ExcelLocalStorage");}}catch(error){}
    try{if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.getSnapshot === "function"){return normalizeSnapshot(window.ExcelLocalRepo.getSnapshot(), "ExcelLocalRepo");}}catch(error){}
    return emptySnapshot();
  }

  function signatureOf(snapshot){
    snapshot = normalizeSnapshot(snapshot, "signature");
    var students = snapshot.students || [];
    var meta = snapshot.meta || {};
    var first = students[0] || {};
    var last = students[students.length - 1] || {};
    var normalizerSignature = normalizer() && typeof normalizer().signature === "function" ? normalizer().signature(students) : "";
    return [meta.updatedAt || meta.pulledAt || meta.createdAt || "", snapshot.periods.length, students.length, first.cedula || first.numeroIdentificacion || "", last.cedula || last.numeroIdentificacion || "", normalizerSignature].join("|");
  }

  function build(options){
    options = options || {};
    var snap = readRawSnapshot();
    var signature = signatureOf(snap);
    if(options.force !== true && cache.index && cache.signature === signature && Date.now() - cache.builtAt < CACHE_MS){return cache;}
    var idx = indexer() && typeof indexer().create === "function" ? indexer().create(snap.students, snap.periods, {signature:signature}) : {rows:snap.students || [],periods:snap.periods || [],createdAt:now(),signature:signature};
    cache.snapshot = snap;
    cache.index = idx;
    cache.signature = signature;
    cache.source = snap.meta && snap.meta.source ? snap.meta.source : "unknown";
    cache.builtAt = Date.now();
    return cache;
  }

  function invalidate(){cache.snapshot=null;cache.index=null;cache.signature="";cache.source="";cache.builtAt=0;}
  function snapshot(options){options = options || {};var current = build({force:options.force === true}).snapshot || emptySnapshot();return options.clone === false ? current : clone(current);}
  function listPeriods(options){return snapshot(options || {}).periods || [];}
  function listStudents(options){
    options = options || {};
    var current = build({force:options.force === true});
    if(indexer() && typeof indexer().filter === "function"){return indexer().filter(current.index, options);}
    return {rows:(current.snapshot.students || []),total:(current.snapshot.students || []).length,offset:0,limit:(current.snapshot.students || []).length};
  }
  function getStudentById(id, options){
    id = text(id);
    if(!id){return null;}
    var current = build({force:options && options.force === true});
    if(current.index && current.index.byId && current.index.byId[id]){return current.index.byId[id];}
    var rows = current.index && current.index.rows ? current.index.rows : [];
    return rows.filter(function(row){return text(row._bl2Id || row.cedula || row.numeroIdentificacion || row.docId) === id;})[0] || null;
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
    return {
      total:rows.length,
      estados:estados,
      avanceGeneral:totalReq ? Math.round((okReq * 10000) / totalReq) / 100 : 0,
      requisitos:requirements,
      periodList:current.index.periods || [],
      divisionList:indexer() && indexer().optionsFromRows ? indexer().optionsFromRows(rows).divisiones : [],
      careerList:indexer() && indexer().optionsFromRows ? indexer().optionsFromRows(rows).carreras : [],
      rows:rows,
      estudiantes:rows,
      carreras:by ? by(rows,function(row){return row._bl2Carrera;}) : [],
      periodos:by ? by(rows,function(row){return row._bl2Periodo;}) : [],
      divisiones:by ? by(rows,function(row){return row._bl2Division;}) : [],
      diagnostics:{source:"BL2DataEngine",generatedAt:now(),signature:cache.signature,buildMs:current.index.buildMs || 0,students:rows.length,totalRequirements:totalReq,fulfilledRequirements:okReq,filters:options}
    };
  }

  function status(options){
    options = options || {};
    var current = build({force:options.force === true});
    return {ok:true,mode:"bl2_data_engine",version:VERSION,source:current.source,students:current.index && current.index.rows ? current.index.rows.length : 0,periods:current.index && current.index.periods ? current.index.periods.length : 0,signature:current.signature,builtAt:current.builtAt,updatedAt:now()};
  }

  window.BL2DataEngine = {version:VERSION,build:build,invalidate:invalidate,snapshot:snapshot,listPeriods:listPeriods,listStudents:listStudents,getStudentById:getStudentById,statsSummary:statsSummary,status:status};
})(window);
