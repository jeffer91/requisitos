/* =========================================================
Nombre completo: bl2-legacy-adapter.js
Ruta o ubicación: /Requisitos/BaseLocal2/bl2-legacy-adapter.js
Función o funciones:
- Adaptar la Base Local actual V1 a la API BL2 sin romper pantallas existentes.
- Leer snapshot desde MAQ_BASELOCAL_SESSION, localStorage crudo, ExcelLocalStorage o ExcelLocalRepo solo cuando una consulta lo necesita.
- Escoger la mejor fuente disponible cuando una sesión antigua perdió campos de requisitos por cuota localStorage.
- Entregar consultas simples de períodos, estudiantes, búsqueda y resumen.
- Servir como puente temporal hasta que SQLite/IndexedDB quede implementado.
Con qué se conecta:
- bl2-config.js
- bl2-api.js
- maq-baselocal-session.js
- excel-local.storage.js
- excel-local.repo.js
========================================================= */
(function(window){
  "use strict";

  var cache = {snapshot:null, readAt:0, signature:"", source:"", score:null};
  var CACHE_MS = 10000;
  var SNAPSHOT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var REQUIREMENT_ALIASES = {
    academico:["Academico","Académico","academico","académico"],
    documentacion:["Documentacion","Documentación","documentacion","documentación"],
    financiero:["Financiero","financiero"],
    titulacion:["Titulacion","Titulación","titulacion","titulación"],
    practicasvinculacion:["PrácticasVinculacion","PracticasVinculacion","practicasVinculacion","prácticasVinculacion","Prácticas Vinculación","Practicas Vinculacion","Prácticas/Vinculación","Practicas/Vinculacion","practicasvinculacion"],
    vinculacion:["Vinculacion","Vinculación","vinculacion","vinculación"],
    seguimientograduados:["SeguimientoGraduados","seguimientoGraduados","seguimientograduados","Seguimiento graduados"],
    ingles:["Ingles","Inglés","ingles","inglés"],
    actualizaciondatos:["ActualizaciónDatos","ActualizacionDatos","actualizacionDatos","actualizaciónDatos","actualizaciondatos","Actualización de datos","Actualizacion de datos"],
    aprobaciontitulacion:["AprobacionTitulacion","AprobaciónTitulacion","Aprobacion Titulacion","aprobacionTitulacion","aprobaciontitulacion"],
    aprobacioncomplexivoproyecto:["AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","Aprobacion Complexivo Proyecto","Aprobacion Complexivo/Proyecto","aprobacionComplexivoProyecto","aprobacioncomplexivoproyecto"]
  };

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function keyNorm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function emptySnapshot(){return {meta:{app:"Requisitos", module:"BL2LegacyAdapter", source:"empty", updatedAt:now(), totalPeriods:0, totalStudents:0}, periods:[], students:[], history:[], diagnostics:[]};}

  function normalizeSnapshot(snapshot, source){
    var snap = snapshot && typeof snapshot === "object" ? snapshot : emptySnapshot();
    snap.meta = snap.meta && typeof snap.meta === "object" ? snap.meta : {};
    snap.periods = Array.isArray(snap.periods) ? snap.periods : [];
    snap.students = Array.isArray(snap.students) ? snap.students : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    snap.meta.totalPeriods = snap.periods.length;
    snap.meta.totalStudents = snap.students.length;
    snap.meta.source = snap.meta.source || source || "legacy";
    return snap;
  }

  function getRawSnapshotKey(){
    try{
      if(window.ExcelLocalConfig && window.ExcelLocalConfig.keys && window.ExcelLocalConfig.keys.snapshot){return window.ExcelLocalConfig.keys.snapshot;}
    }catch(error){}
    return SNAPSHOT_KEY;
  }

  function sessionCandidates(){
    var list = [];
    try{if(window.MAQ_BASELOCAL_SESSION){list.push({api:window.MAQ_BASELOCAL_SESSION, source:"session_self"});}}catch(error){}
    try{if(window.parent && window.parent !== window && window.parent.MAQ_BASELOCAL_SESSION){list.push({api:window.parent.MAQ_BASELOCAL_SESSION, source:"session_parent"});}}catch(error){}
    try{if(window.top && window.top !== window && window.top.MAQ_BASELOCAL_SESSION){list.push({api:window.top.MAQ_BASELOCAL_SESSION, source:"session_top"});}}catch(error){}
    return list;
  }

  function fromSession(){
    var list = sessionCandidates();
    var out = [];
    for(var i = 0; i < list.length; i += 1){
      try{
        if(list[i].api && typeof list[i].api.getSnapshot === "function"){
          var snap = list[i].api.getSnapshot({clone:false});
          if(snap && typeof snap === "object"){out.push({snapshot:normalizeSnapshot(snap, list[i].source), source:list[i].source});}
        }
      }catch(error){}
    }
    return out;
  }

  function fromRawStorage(){
    try{
      var raw = window.localStorage.getItem(getRawSnapshotKey()) || "";
      if(!raw){return null;}
      var parsed = JSON.parse(raw);
      return {snapshot:normalizeSnapshot(parsed, "localStorage_raw"), source:"localStorage_raw"};
    }catch(error){return null;}
  }

  function fromStorageApi(){
    try{if(window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"){return {snapshot:normalizeSnapshot(window.ExcelLocalStorage.readSnapshot(), "ExcelLocalStorage"), source:"ExcelLocalStorage"};}}catch(error){}
    try{if(window.parent && window.parent !== window && window.parent.ExcelLocalStorage && typeof window.parent.ExcelLocalStorage.readSnapshot === "function"){return {snapshot:normalizeSnapshot(window.parent.ExcelLocalStorage.readSnapshot(), "parent.ExcelLocalStorage"), source:"parent.ExcelLocalStorage"};}}catch(error){}
    return null;
  }

  function fromRepo(){
    try{if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.getSnapshot === "function"){return {snapshot:normalizeSnapshot(window.ExcelLocalRepo.getSnapshot(), "ExcelLocalRepo"), source:"ExcelLocalRepo"};}}catch(error){}
    try{if(window.parent && window.parent !== window && window.parent.ExcelLocalRepo && typeof window.parent.ExcelLocalRepo.getSnapshot === "function"){return {snapshot:normalizeSnapshot(window.parent.ExcelLocalRepo.getSnapshot(), "parent.ExcelLocalRepo"), source:"parent.ExcelLocalRepo"};}}catch(error){}
    return null;
  }

  function getOwnKey(row, wanted){
    row = row || {};
    var keys = Object.keys(row);
    var wantedNorm = keyNorm(wanted);
    for(var i = 0; i < keys.length; i += 1){
      if(keys[i] === wanted || keyNorm(keys[i]) === wantedNorm){return keys[i];}
    }
    return "";
  }

  function valueFromAliases(row, aliases){
    aliases = aliases || [];
    for(var i = 0; i < aliases.length; i += 1){
      var key = getOwnKey(row, aliases[i]);
      if(key && row[key] != null && text(row[key]) !== ""){return row[key];}
    }
    return "";
  }

  function getRequirementValue(row, canonical){
    try{
      if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
        var value = window.BLCampos.getValue(row || {}, canonical, "");
        if(text(value)){return value;}
      }
    }catch(error){}
    return valueFromAliases(row || {}, REQUIREMENT_ALIASES[canonical] || [canonical]);
  }

  function scoreSnapshot(snapshot){
    snapshot = normalizeSnapshot(snapshot || emptySnapshot(), "score");
    var students = snapshot.students || [];
    var periods = snapshot.periods || [];
    var requirementValues = 0;
    var fullRequirementRows = 0;

    /*
      No se recorre toda la base para decidir la fuente.
      Con Excel grandes, el recorrido completo se repetía por iframe/pantalla y provocaba lentitud.
      Una muestra es suficiente para saber si la fuente conserva requisitos.
    */
    students.slice(0, 40).forEach(function(row){
      var rowValues = 0;
      Object.keys(REQUIREMENT_ALIASES).forEach(function(key){
        if(text(getRequirementValue(row, key))){rowValues += 1;}
      });
      requirementValues += rowValues;
      if(rowValues >= 8){fullRequirementRows += 1;}
    });

    return {
      students:students.length,
      periods:periods.length,
      requirementValues:requirementValues,
      fullRequirementRows:fullRequirementRows,
      sampledStudents:Math.min(40, students.length),
      total:(requirementValues * 1000000) + (fullRequirementRows * 10000) + (students.length * 10) + periods.length
    };
  }

  function deepSourceSelectionAllowed(){
    try{return window.localStorage.getItem("REQ_BL2_DEEP_SOURCE_SELECT") === "true";}catch(error){return false;}
  }

  function firstUsableSnapshot(){
    var sessions = fromSession();
    if(sessions.length && sessions[0] && sessions[0].snapshot){return sessions[0];}
    var raw = fromRawStorage();
    if(raw && raw.snapshot){return raw;}
    var api = fromStorageApi();
    if(api && api.snapshot){return api;}
    var repo = fromRepo();
    if(repo && repo.snapshot){return repo;}
    return null;
  }

  function chooseBestSnapshot(){
    var fast = firstUsableSnapshot();
    if(fast && !deepSourceSelectionAllowed()){
      fast.score = scoreSnapshot(fast.snapshot);
      return fast;
    }

    var candidates = [];
    candidates = candidates.concat(fromSession());
    [fromRawStorage(), fromStorageApi(), fromRepo()].forEach(function(item){if(item && item.snapshot){candidates.push(item);}});
    if(!candidates.length){return {snapshot:emptySnapshot(), source:"empty", score:scoreSnapshot(emptySnapshot())};}
    candidates.forEach(function(item){item.score = scoreSnapshot(item.snapshot);});
    candidates.sort(function(a,b){return b.score.total - a.score.total;});
    return candidates[0];
  }

  function signatureOf(snapshot){
    snapshot = snapshot || {};
    var students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    var meta = snapshot.meta || {};
    var first = students[0] || {};
    var last = students[students.length - 1] || {};
    var score = scoreSnapshot(snapshot);
    return [meta.updatedAt || meta.pulledAt || "", periods.length, students.length, score.requirementValues, first.cedula || first.numeroIdentificacion || first._docId || "", last.cedula || last.numeroIdentificacion || last._docId || ""].join("|");
  }

  function readSnapshot(options){
    options = options || {};
    if(options.force !== true && cache.snapshot && Date.now() - cache.readAt < CACHE_MS){return options.clone === false ? cache.snapshot : clone(cache.snapshot);}
    var chosen = chooseBestSnapshot();
    var snap = normalizeSnapshot(chosen.snapshot, chosen.source);
    cache.snapshot = snap;
    cache.readAt = Date.now();
    cache.signature = signatureOf(snap);
    cache.source = chosen.source;
    cache.score = chosen.score || scoreSnapshot(snap);
    return options.clone === false ? snap : clone(snap);
  }

  function invalidate(){cache.snapshot=null;cache.readAt=0;cache.signature="";cache.source="";cache.score=null;}
  function samePeriod(a,b){if(!text(b)){return true;}try{if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){return window.BLPeriodosCanon.samePeriod(a,b);}}catch(error){}return text(a) === text(b) || norm(a) === norm(b);}
  function estadoOf(row){var raw = norm(row && (row.estadoMatricula || row.EstadoMatricula || row.estado || row.Estado || "ACTIVO"));return raw === "retirado" ? "RETIRADO" : "ACTIVO";}
  function cedulaOf(row){return text(row && (row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.numeroidentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row._docId || row.docId || row.id));}
  function nombreOf(row){return text(row && (row.nombres || row.Nombres || row.nombre || row.Nombre || row.estudiante || row.Estudiante));}
  function carreraOf(row){return text(row && (row.nombrecarrera || row.nombreCarrera || row.NombreCarrera || row.carrera || row.Carrera || row.programa || row.Programa));}
  function periodoOf(row){return text(row && (row.periodoId || row.ultimoPeriodoId || row.periodoLabel || row.periodo || row.Periodo));}
  function divisionOf(row){var divs = Array.isArray(row && row.divisiones) ? row.divisiones : [];return text(divs[0] || row.division || row.Division || row.División || "Sin división");}
  function correoOf(row){return text(row && (row.CorreoPersonal || row.correoPersonal || row.CorreoInstitucional || row.correoInstitucional || row.email || row.correo));}
  function celularOf(row){return text(row && (row.Celular || row.celular || row.Telefono || row.telefono));}

  function hydrateRequirementAliases(copy, source){
    Object.keys(REQUIREMENT_ALIASES).forEach(function(key){
      var value = getRequirementValue(source || copy, key);
      if(text(value) === ""){return;}
      if(!text(copy[key])){copy[key] = value;}
      var normalizedKey = keyNorm(key);
      if(!text(copy[normalizedKey])){copy[normalizedKey] = value;}
    });
    return copy;
  }

  function studentSearchText(row){return norm([cedulaOf(row), nombreOf(row), carreraOf(row), periodoOf(row), divisionOf(row), correoOf(row), celularOf(row), estadoOf(row)].join(" "));}

  function normalizeStudentView(row){
    var copy = Object.assign({}, row || {});
    hydrateRequirementAliases(copy, row || {});
    copy._bl2Id = cedulaOf(copy) || text(copy._docId || copy.docId || copy.id);
    copy._bl2Search = studentSearchText(copy);
    copy._bl2EstadoMatricula = estadoOf(copy);
    copy._bl2Nombre = nombreOf(copy);
    copy._bl2Carrera = carreraOf(copy);
    copy._bl2Periodo = periodoOf(copy);
    copy._bl2Division = divisionOf(copy);
    return copy;
  }

  function listPeriods(){return readSnapshot({clone:false}).periods.slice();}

  function listStudents(options){
    options = options || {};
    var snap = readSnapshot({clone:false, force:options.force === true});
    var search = norm(options.search || options.q || "");
    var periodId = text(options.periodoId || options.periodId || "");
    var division = text(options.division || "");
    var estado = options.matricula == null ? (options.estadoMatricula == null ? "ACTIVO" : text(options.estadoMatricula)) : text(options.matricula);
    var offset = Math.max(0, Number(options.offset || 0) || 0);
    var limit = Math.max(0, Number(options.limit || 0) || 0);
    var rows = (snap.students || []).map(normalizeStudentView).filter(function(row){
      if(estado && row._bl2EstadoMatricula !== estado){return false;}
      if(periodId && !samePeriod(row.periodoId || row.ultimoPeriodoId || row.periodoLabel, periodId)){return false;}
      if(division && norm(row._bl2Division) !== norm(division)){return false;}
      if(search && row._bl2Search.indexOf(search) < 0){return false;}
      return true;
    });
    var total = rows.length;
    if(limit){rows = rows.slice(offset, offset + limit);}
    return {rows:rows, total:total, offset:offset, limit:limit || total, source:cache.source, score:cache.score};
  }

  function searchStudents(query, options){options = Object.assign({}, options || {}, {search:query || (options && options.search) || ""});return listStudents(options);}
  function getStudentById(id, options){
    var wanted = text(id);
    if(!wanted){return null;}
    var result = listStudents(Object.assign({}, options || {}, {estadoMatricula:"", matricula:"", limit:0}));
    return result.rows.find(function(row){return text(row._bl2Id) === wanted || cedulaOf(row) === wanted || text(row._docId || row.docId || row.id) === wanted;}) || null;
  }

  function resumen(options){
    options = options || {};
    var rows = listStudents(Object.assign({}, options, {matricula:"", estadoMatricula:"", limit:0})).rows;
    var out = {total:0, activos:0, retirados:0, carreras:{}, periodos:{}, updatedAt:now(), source:cache.source, score:cache.score};
    rows.forEach(function(row){
      out.total += 1;
      if(row._bl2EstadoMatricula === "RETIRADO"){out.retirados += 1;}else{out.activos += 1;}
      var carrera = carreraOf(row) || "SIN CARRERA";
      var periodo = periodoOf(row) || "SIN PERIODO";
      out.carreras[carrera] = (out.carreras[carrera] || 0) + 1;
      out.periodos[periodo] = (out.periodos[periodo] || 0) + 1;
    });
    return out;
  }

  function status(options){
    options = options || {};
    if(options.deep === true){
      var snap = readSnapshot({clone:false, force:options.force === true});
      return {ok:true, mode:"legacy_bridge", source:cache.source || (snap.meta && snap.meta.source) || "legacy", lazy:false, periods:snap.periods.length, students:snap.students.length, history:snap.history.length, requirementValues:cache.score ? cache.score.requirementValues : 0, fullRequirementRows:cache.score ? cache.score.fullRequirementRows : 0, signature:cache.signature, updatedAt:now()};
    }
    return {ok:true, mode:"legacy_bridge", source:cache.source || "legacy", lazy:true, cacheReady:!!cache.snapshot, requirementValues:cache.score ? cache.score.requirementValues : 0, fullRequirementRows:cache.score ? cache.score.fullRequirementRows : 0, signature:cache.signature, updatedAt:now()};
  }

  window.BL2LegacyAdapter = {version:"2.0.0-alpha.2-requirements-source",readSnapshot:readSnapshot,invalidate:invalidate,listPeriods:listPeriods,listStudents:listStudents,searchStudents:searchStudents,getStudentById:getStudentById,resumen:resumen,status:status,helpers:{cedulaOf:cedulaOf,nombreOf:nombreOf,carreraOf:carreraOf,periodoOf:periodoOf,divisionOf:divisionOf,estadoOf:estadoOf,getRequirementValue:getRequirementValue,scoreSnapshot:scoreSnapshot}};
})(window);