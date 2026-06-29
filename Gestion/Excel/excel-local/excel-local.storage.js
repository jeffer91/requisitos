/* =========================================================
Nombre completo: excel-local.storage.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local/excel-local.storage.js
Función o funciones:
- Mantener compatibilidad del módulo Excel sin usar localStorage como base principal.
- Guardar el snapshot completo en memoria/sesión y migrarlo a BL2Storage/IndexedDB.
- Dejar en localStorage solo un marcador liviano para evitar cuota y congelamientos.
- Permitir respaldo localStorage compacto solo si BL2 no está disponible.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.6.0-bl2-primary";
  var STATUS_KEY = "REQ_EXCEL_LOCAL_V1:storageStatus";
  var DEFAULT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var MARKER_KEY = "REQ_EXCEL_LOCAL_V1:bl2Marker";
  var memory = {loaded:false, raw:"", snapshot:null, source:"none", bl2CopyPending:false, bl2CopyAt:""};

  var REQUIREMENT_KEYS = ["Academico","Documentacion","Financiero","Titulacion","PrácticasVinculacion","PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizaciónDatos","ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto","academico","documentacion","financiero","titulacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
  var CORE_FIELDS = ["cedula","Cedula","Cédula","CEDULA","numeroIdentificacion","numeroidentificacion","NumeroIdentificacion","identificacion","Identificacion","docId","_docId","id","idLocal","nombres","Nombres","nombre","Nombre","nombresCompletos","apellidos","Apellidos","nombrecarrera","nombreCarrera","NombreCarrera","carrera","Carrera","programa","Programa","CodigoCarrera","codigoCarrera","codigocarrera","Sede","sede","HorarioComplexivo","horarioComplexivo","jornada","Jornada","modalidad","Modalidad","periodoId","periodoLabel","periodo","Periodo","ultimoPeriodoId","estadoMatricula","historialEstadoMatricula","division","divisiones","CorreoPersonal","correoPersonal","CorreoInstitucional","correoInstitucional","Celular","celular","Telefono","telefono","Notart","Nart","nart","Notdef","Ndef","ndef","Notafinal","NotaFinal","nfin","updatedAt","createdAt","creadoEn","actualizadoEn"];

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function key(){return (window.ExcelLocalConfig && window.ExcelLocalConfig.keys && window.ExcelLocalConfig.keys.snapshot) || DEFAULT_KEY;}
  function normalizer(){return window.BL2StudentNormalizer || null;}
  function bl2Storage(){return window.BL2Storage || null;}
  function bl2Schema(){return window.BL2Schema || null;}

  function emptySnapshot(){return {meta:{app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:6, createdAt:now(), updatedAt:now(), totalStudents:0, totalPeriods:0}, periods:[], students:[], history:[], diagnostics:[]};}
  function saveStorageStatus(status){try{localStorage.setItem(STATUS_KEY, JSON.stringify(Object.assign({updatedAt:now(), version:VERSION}, status || {})));}catch(error){}}
  function sessionApi(){try{if(window.parent && window.parent !== window && window.parent.MAQ_BASELOCAL_SESSION){return window.parent.MAQ_BASELOCAL_SESSION;}}catch(error){}try{if(window.top && window.top !== window && window.top.MAQ_BASELOCAL_SESSION){return window.top.MAQ_BASELOCAL_SESSION;}}catch(error){}try{if(window.MAQ_BASELOCAL_SESSION){return window.MAQ_BASELOCAL_SESSION;}}catch(error){}return null;}

  function purgeHeavyLocalCopies(){
    var removed = 0, freedChars = 0;
    var prefixes = ["REQ_BL_DB_V1::", "REQ_EXCEL_LOCAL_V1:beforeFirebaseSync:", "REQ_BL2_CACHE_RESUMEN::", "REQ_EXCEL_LOCAL_V1:queue"];
    try{for(var i = localStorage.length - 1; i >= 0; i -= 1){var k = localStorage.key(i) || "";if(k === key() || k === STATUS_KEY || k === MARKER_KEY){continue;}var shouldRemove = prefixes.some(function(prefix){return k.indexOf(prefix) === 0;});if(!shouldRemove){continue;}try{freedChars += (localStorage.getItem(k) || "").length;}catch(error){}try{localStorage.removeItem(k);removed += 1;}catch(error){}}}catch(error){}
    try{sessionStorage.removeItem("REQ_BL_MIRROR_SIGNATURE_V1");}catch(error){}
    try{localStorage.removeItem("REQ_BL_MIRROR_STORAGE_VERSION_V1");}catch(error){}
    return {removed:removed, freedChars:freedChars};
  }

  function normalizeDivisiones(value){if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){return window.BLDivisionesService.normalizeDivisiones(value);}if(Array.isArray(value)){var seen = {};return value.map(function(item){return text(typeof item === "object" && item ? (item.nombre || item.name || item.label || item.id) : item);}).filter(function(item){var k = norm(item);if(!item || k === "sin division" || seen[k]){return false;}seen[k] = true;return true;});}var single = text(value);return single && norm(single) !== "sin division" ? [single] : [];}

  function normalizeStudent(student){
    var source = student && typeof student === "object" ? student : {};
    var s = normalizer() && typeof normalizer().normalize === "function" ? normalizer().normalize(source, {clone:false}) : Object.assign({}, source);
    if(bl2Schema() && bl2Schema().helpers && typeof bl2Schema().helpers.normalizeStudent === "function"){try{s = Object.assign({}, s, bl2Schema().helpers.normalizeStudent(s));}catch(error){}}
    var cedula = text(s.cedula || s.Cedula || s.CEDULA || s.numeroIdentificacion || s.numeroidentificacion || s.NumeroIdentificacion || s.identificacion || s.Identificacion || s.docId || s._docId || s._bl2Id);
    if(cedula){s.cedula = text(s.cedula || cedula);s.numeroIdentificacion = text(s.numeroIdentificacion || s.numeroidentificacion || cedula);s._docId = text(s._docId || s.docId || cedula);s.docId = text(s.docId || s._docId || cedula);}
    var periodoId = text(s.periodoId || s.ultimoPeriodoId || s.periodoLabel || s.periodo || s.Periodo || "SIN_PERIODO");
    s.periodoId = periodoId;s.ultimoPeriodoId = text(s.ultimoPeriodoId || periodoId);
    s.periodoLabel = text(s.periodoLabel || s.periodo || s.Periodo || periodoId);
    s.idLocal = text(s.idLocal || s._bl2IdLocal || ((cedula || s.docId || "sin_cedula") + "__" + periodoId));
    s.estadoMatricula = text(s.estadoMatricula || s._bl2EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    s.historialEstadoMatricula = Array.isArray(s.historialEstadoMatricula) ? s.historialEstadoMatricula : [];
    s.divisiones = normalizeDivisiones(s.divisiones || s.division || s.Division || s.División || s._bl2Division);
    if(s.divisiones.length){s.division = s.divisiones[0];}else{delete s.division;}
    s.updatedAt = text(s.updatedAt || s.actualizadoEn) || now();
    return s;
  }

  function normalizePeriod(period){if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){return window.BLPeriodosCanon.normalizePeriod(period);}if(bl2Schema() && bl2Schema().helpers && typeof bl2Schema().helpers.normalizePeriod === "function"){return bl2Schema().helpers.normalizePeriod(period);}var p = period && typeof period === "object" ? Object.assign({}, period) : {};var id = text(p.id || p.periodoId || p.value || p.label || p.periodoLabel);p.id = id;p.periodoId = text(p.periodoId || id);p.label = text(p.label || p.periodoLabel || id);p.periodoLabel = text(p.periodoLabel || p.label || id);p.updatedAt = text(p.updatedAt || p.creadoEn) || now();return p;}
  function dedupePeriods(periods){if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.dedupe === "function"){return window.BLPeriodosCanon.dedupe(periods || []);}var seen = {}, out = []; (periods || []).forEach(function(period){var p = normalizePeriod(period);var k = compact(p.label || p.id);if(!k || seen[k]){return;}seen[k] = true;out.push(p);});return out;}
  function inferPeriodsFromStudents(students){try{if(window.BLPeriodosService && typeof window.BLPeriodosService.inferFromStudents === "function"){return window.BLPeriodosService.inferFromStudents(students || []);}}catch(error){}var map = {};return (students || []).map(function(s){return normalizePeriod({id:s.periodoId || s.periodoLabel, label:s.periodoLabel || s.periodoId});}).filter(function(p){var k = compact(p.id || p.label);if(!k || map[k]){return false;}map[k]=true;return true;});}

  function normalizeSnapshot(data){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.canonicalizeSnapshot === "function"){data = window.BLPeriodosCanon.canonicalizeSnapshot(data);}
    var base = data && typeof data === "object" ? data : emptySnapshot();
    var snap = Object.assign({}, base);
    snap.meta = snap.meta && typeof snap.meta === "object" ? Object.assign({}, snap.meta) : {};
    snap.students = Array.isArray(snap.students) ? snap.students.map(normalizeStudent) : [];
    snap.periods = dedupePeriods(Array.isArray(snap.periods) && snap.periods.length ? snap.periods : inferPeriodsFromStudents(snap.students));
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    snap.meta.app = snap.meta.app || "Requisitos";snap.meta.module = snap.meta.module || "ExcelLocal";snap.meta.version = VERSION;snap.meta.schemaVersion = 6;snap.meta.updatedAt = snap.meta.updatedAt || now();snap.meta.totalStudents = snap.students.length;snap.meta.totalPeriods = snap.periods.length;
    return snap;
  }

  function compactRecord(record){var source = record && typeof record === "object" ? record : {};var out = {};Object.keys(source).forEach(function(k){var value = source[k], low = compact(k);if(low.indexOf("base64") >= 0 || low.indexOf("buffer") >= 0 || low.indexOf("blob") >= 0 || low === "raw" || low === "archivooriginal" || low === "exceloriginal"){return;}if(typeof value === "string" && value.length > 4000){out[k] = value.slice(0,4000) + "… [recortado por Base Local]";return;}out[k] = value;});return out;}
  function minimalStudent(student){var normalized = normalizeStudent(student);var out = {};CORE_FIELDS.concat(REQUIREMENT_KEYS).forEach(function(field){if(Object.prototype.hasOwnProperty.call(normalized, field) && normalized[field] != null && text(normalized[field]) !== ""){out[field] = normalized[field];}});out._bl2Id = normalized._bl2Id || normalized.cedula || normalized.numeroIdentificacion || "";out._bl2Nombre = normalized._bl2Nombre || normalized.nombres || normalized.Nombres || "";out._bl2Carrera = normalized._bl2Carrera || normalized.nombrecarrera || normalized.NombreCarrera || "";out._bl2Periodo = normalized._bl2Periodo || normalized.periodoLabel || normalized.periodoId || "";out._bl2PeriodoId = normalized._bl2PeriodoId || normalized.periodoId || "";out._bl2Division = normalized._bl2Division || normalized.division || "Sin división";out._bl2EstadoMatricula = normalized._bl2EstadoMatricula || normalized.estadoMatricula || "ACTIVO";return compactRecord(out);}
  function compactSnapshotForStorage(snapshot){var snap = normalizeSnapshot(snapshot || emptySnapshot());return {meta:Object.assign({}, snap.meta || {}, {compactedForStorage:true, compactedAt:now(), version:VERSION, schemaVersion:6}), periods:snap.periods.map(compactRecord), students:snap.students.slice(0,300).map(minimalStudent), history:snap.history.slice(-50), diagnostics:[]};}
  function emergencySnapshotForStorage(snapshot){var snap = normalizeSnapshot(snapshot || emptySnapshot());return {meta:Object.assign({}, snap.meta || {}, {app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:6, updatedAt:now(), totalStudents:snap.students.length, totalPeriods:snap.periods.length, emergencyStored:true, storageMode:"minimal_localStorage_with_requirements"}), periods:snap.periods.map(compactRecord), students:snap.students.slice(0,80).map(minimalStudent), history:snap.history.slice(-20), diagnostics:[]};}
  function markerSnapshotForStorage(snapshot){var snap = normalizeSnapshot(snapshot || emptySnapshot());return {meta:Object.assign({}, snap.meta || {}, {app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:6, updatedAt:now(), totalStudents:snap.students.length, totalPeriods:snap.periods.length, bl2Primary:true, storageMode:"marker_only", message:"Datos completos guardados en BL2/IndexedDB y memoria de sesión."}), periods:snap.periods.slice(0,20).map(compactRecord), students:[], history:snap.history.slice(-5), diagnostics:[]};}
  function looksLikeSnapshot(value){return !!(value && typeof value === "object" && value.meta && Array.isArray(value.periods) && Array.isArray(value.students));}

  function readFromSession(options){options = options || {};var api = sessionApi();if(!api || typeof api.getSnapshot !== "function"){return null;}try{var snap = api.getSnapshot({clone:false});if(looksLikeSnapshot(snap)){memory.loaded = true;memory.snapshot = normalizeSnapshot(snap);memory.source = "maq-session";return options.clone === false ? memory.snapshot : clone(memory.snapshot);}}catch(error){console.warn("[ExcelLocalStorage] sesión rápida no disponible", error);}return null;}
  function readSnapshot(options){options = options || {};if(options.session !== false){var fromSession = readFromSession(options);if(fromSession){return fromSession;}}if(memory.loaded && memory.snapshot){return options.clone === false ? memory.snapshot : clone(memory.snapshot);}try{var raw = localStorage.getItem(key()) || "";var snap = raw ? normalizeSnapshot(JSON.parse(raw)) : emptySnapshot();memory.loaded = true;memory.raw = raw;memory.snapshot = snap;memory.source = "localStorage";return options.clone === false ? snap : clone(snap);}catch(error){console.warn("[ExcelLocalStorage] lectura fallida", error);var fallback = emptySnapshot();memory.loaded = true;memory.raw = "";memory.snapshot = fallback;memory.source = "fallback";return options.clone === false ? fallback : clone(fallback);}}
  function persistRaw(raw){localStorage.setItem(key(), raw);}
  function tryPersistSnapshot(candidate){var raw = JSON.stringify(candidate);persistRaw(raw);return raw;}
  function activateMemorySnapshot(snapshot, raw, source){memory.loaded = true;memory.raw = raw || "";memory.snapshot = snapshot;memory.source = source || "writeSnapshot";try{var api = sessionApi();if(api && typeof api.setSnapshot === "function"){api.setSnapshot(snapshot,{source:"ExcelLocalStorage." + (source || "writeSnapshot"), alreadyStored:true, clone:false});}}catch(error){}}
  function invalidateEngines(){try{if(window.BL2DataEngine && typeof window.BL2DataEngine.invalidate === "function"){window.BL2DataEngine.invalidate();}}catch(error){}try{if(window.BL2 && typeof window.BL2.invalidate === "function"){window.BL2.invalidate({emit:false, source:"ExcelLocalStorage"});}}catch(error){}try{if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){window.BL2CacheResumen.invalidate();}}catch(error){}try{window.dispatchEvent(new CustomEvent("requisitos:bl:snapshot-changed", {detail:{source:"ExcelLocalStorage", at:now()}}));}catch(error){} }

  function writeMarker(snapshot){var raw = "";try{raw = tryPersistSnapshot(markerSnapshotForStorage(snapshot));localStorage.setItem(MARKER_KEY, JSON.stringify({updatedAt:now(), totalStudents:snapshot.students.length, totalPeriods:snapshot.periods.length, mode:"bl2_primary"}));return {raw:raw, mode:"marker"};}catch(error){return {raw:"", mode:"memory_only", error:error};}}
  function copySnapshotToBL2(snapshot, reason){
    if(!bl2Storage() || typeof bl2Storage().copySnapshot !== "function"){return Promise.resolve({ok:false, mode:"sin_bl2_storage"});}
    memory.bl2CopyPending = true;
    return bl2Storage().copySnapshot(snapshot, {source:reason || "ExcelLocalStorage.writeSnapshot", chunkSize:500, pauseMs:0}).then(function(result){memory.bl2CopyPending = false;memory.bl2CopyAt = now();saveStorageStatus({ok:true, mode:"bl2_primary", bl2:result, totalStudents:snapshot.students.length, totalPeriods:snapshot.periods.length, message:"Excel guardado en BL2/IndexedDB."});return result;}).catch(function(error){memory.bl2CopyPending = false;saveStorageStatus({ok:false, mode:"bl2_copy_error", errorMessage:error && error.message ? error.message : String(error)});return {ok:false, errorMessage:error && error.message ? error.message : String(error)};});
  }

  function writeSnapshot(snapshot){
    var snap = normalizeSnapshot(snapshot);snap.meta.updatedAt = now();snap.meta.version = VERSION;snap.meta.schemaVersion = 6;
    var marker = writeMarker(snap);
    activateMemorySnapshot(snap, marker.raw, marker.mode);
    var bl2Ready = !!(bl2Storage() && typeof bl2Storage().copySnapshot === "function");
    if(bl2Ready){copySnapshotToBL2(snap, "ExcelLocalStorage.writeSnapshot");}
    else{
      var savedSnap = compactSnapshotForStorage(snap), raw = "", purged = {removed:0, freedChars:0}, emergency = false;
      try{raw = tryPersistSnapshot(savedSnap);}catch(error){purged = purgeHeavyLocalCopies();try{raw = tryPersistSnapshot(savedSnap);}catch(secondError){savedSnap = emergencySnapshotForStorage(snap);emergency = true;try{raw = tryPersistSnapshot(savedSnap);}catch(thirdError){raw = marker.raw || "";}}}
      activateMemorySnapshot(snap, raw, emergency ? "emergency_localStorage" : "compact_localStorage");
      saveStorageStatus({ok:true, mode:emergency ? "saved_emergency" : "saved_compacted", bytes:raw.length, purged:purged, emergency:emergency, totalStudents:snap.students.length, totalPeriods:snap.periods.length, message:"Excel guardado en localStorage compacto porque BL2 no está disponible."});
    }
    invalidateEngines();
    return clone(snap);
  }

  function clear(){var snap = emptySnapshot();writeSnapshot(snap);return snap;}
  function invalidate(){memory.loaded = false;memory.raw = "";memory.snapshot = null;memory.source = "invalidate";invalidateEngines();}
  function status(){var stored = {};try{stored = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");}catch(error){}return Object.assign({ok:true, mode:"excel_storage_bl2_primary", version:VERSION, memoryLoaded:memory.loaded, source:memory.source, bl2Available:!!bl2Storage(), bl2CopyPending:memory.bl2CopyPending, bl2CopyAt:memory.bl2CopyAt, updatedAt:now()}, stored);}

  window.ExcelLocalStorage = {version:VERSION, emptySnapshot:emptySnapshot, normalizeSnapshot:normalizeSnapshot, readSnapshot:readSnapshot, writeSnapshot:writeSnapshot, clear:clear, clone:clone, invalidate:invalidate, purgeHeavyLocalCopies:purgeHeavyLocalCopies, status:status, compactSnapshotForStorage:compactSnapshotForStorage, emergencySnapshotForStorage:emergencySnapshotForStorage, copySnapshotToBL2:copySnapshotToBL2};
})(window);
