/* =========================================================
Nombre completo: excel-local.storage.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-local/excel-local.storage.js
Función o funciones:
- Persistir snapshot local de Requisitos en localStorage con respaldo en memoria.
- Reutilizar sesión rápida de Maqueta cuando exista.
- Normalizar estudiantes con BL2StudentNormalizer cuando esté disponible.
- Conservar requisitos, identidad, período, división, contacto y notas incluso en modo reducido.
- Evitar que localStorage se llene por copias espejo o respaldos pesados.
- Invalidar BL2DataEngine/BL2 cuando cambia la Base Local.
Con qué se conecta:
- maq-baselocal-session.js
- excel-local.bridge.js
- excel-local.repo.js
- BaseLocal2/core/bl2-student-normalizer.js
- BaseLocal2/core/bl2-data-engine.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.5.0-bl2";
  var STATUS_KEY = "REQ_EXCEL_LOCAL_V1:storageStatus";
  var DEFAULT_KEY = "REQ_EXCEL_LOCAL_V1:snapshot";
  var memory = {loaded:false, raw:"", snapshot:null, source:"none"};

  var REQUIREMENT_KEYS = ["Academico","Documentacion","Financiero","Titulacion","PrácticasVinculacion","PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizaciónDatos","ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto","academico","documentacion","financiero","titulacion","practicasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","aprobaciontitulacion","aprobacioncomplexivoproyecto"];
  var CORE_FIELDS = ["cedula","Cedula","Cédula","CEDULA","numeroIdentificacion","numeroidentificacion","NumeroIdentificacion","identificacion","Identificacion","docId","_docId","id","nombres","Nombres","nombre","Nombre","nombresCompletos","apellidos","Apellidos","nombrecarrera","nombreCarrera","NombreCarrera","carrera","Carrera","programa","Programa","CodigoCarrera","codigoCarrera","codigocarrera","Sede","sede","HorarioComplexivo","horarioComplexivo","jornada","Jornada","modalidad","Modalidad","periodoId","periodoLabel","periodo","Periodo","ultimoPeriodoId","estadoMatricula","historialEstadoMatricula","division","divisiones","CorreoPersonal","correoPersonal","CorreoInstitucional","correoInstitucional","Celular","celular","Telefono","telefono","Notart","Nart","nart","Notdef","Ndef","ndef","Notafinal","NotaFinal","nfin","updatedAt","createdAt","creadoEn","actualizadoEn"];

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}
  function key(){return (window.ExcelLocalConfig && window.ExcelLocalConfig.keys && window.ExcelLocalConfig.keys.snapshot) || DEFAULT_KEY;}
  function normalizer(){return window.BL2StudentNormalizer || null;}

  function emptySnapshot(){return {meta:{app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:5, createdAt:now(), updatedAt:now(), totalStudents:0, totalPeriods:0}, periods:[], students:[], history:[], diagnostics:[]};}
  function isQuotaError(error){var msg = text(error && (error.message || error.name || error));return !!(error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014 || /quota|exceeded/i.test(msg)));}
  function saveStorageStatus(status){try{localStorage.setItem(STATUS_KEY, JSON.stringify(Object.assign({updatedAt:now(), version:VERSION}, status || {})));}catch(error){}}

  function sessionApi(){
    try{if(window.parent && window.parent !== window && window.parent.MAQ_BASELOCAL_SESSION){return window.parent.MAQ_BASELOCAL_SESSION;}}catch(error){}
    try{if(window.top && window.top !== window && window.top.MAQ_BASELOCAL_SESSION){return window.top.MAQ_BASELOCAL_SESSION;}}catch(error){}
    try{if(window.MAQ_BASELOCAL_SESSION){return window.MAQ_BASELOCAL_SESSION;}}catch(error){}
    return null;
  }

  function purgeHeavyLocalCopies(){
    var removed = 0, freedChars = 0;
    var prefixes = ["REQ_BL_DB_V1::", "REQ_EXCEL_LOCAL_V1:beforeFirebaseSync:", "REQ_BL2_CACHE_RESUMEN::"];
    try{
      for(var i = localStorage.length - 1; i >= 0; i -= 1){
        var k = localStorage.key(i) || "";
        if(k === key() || k === STATUS_KEY){continue;}
        var shouldRemove = prefixes.some(function(prefix){return k.indexOf(prefix) === 0;});
        if(!shouldRemove){continue;}
        try{freedChars += (localStorage.getItem(k) || "").length;}catch(error){}
        try{localStorage.removeItem(k);removed += 1;}catch(error){}
      }
    }catch(error){}
    try{sessionStorage.removeItem("REQ_BL_MIRROR_SIGNATURE_V1");}catch(error){}
    try{localStorage.removeItem("REQ_BL_MIRROR_STORAGE_VERSION_V1");}catch(error){}
    return {removed:removed, freedChars:freedChars};
  }

  function normalizeDivisiones(value){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){return window.BLDivisionesService.normalizeDivisiones(value);}
    if(Array.isArray(value)){var seen = {};return value.map(function(item){return text(typeof item === "object" && item ? (item.nombre || item.name || item.label || item.id) : item);}).filter(function(item){var k = norm(item);if(!item || k === "sin division" || seen[k]){return false;}seen[k] = true;return true;});}
    var single = text(value);return single && norm(single) !== "sin division" ? [single] : [];
  }

  function normalizeStudent(student){
    var source = student && typeof student === "object" ? student : {};
    var s = normalizer() && typeof normalizer().normalize === "function" ? normalizer().normalize(source, {clone:false}) : Object.assign({}, source);
    var cedula = text(s.cedula || s.Cedula || s.CEDULA || s.numeroIdentificacion || s.numeroidentificacion || s.NumeroIdentificacion || s.identificacion || s.Identificacion || s.docId || s._docId || s._bl2Id);
    if(cedula){s.cedula = text(s.cedula || cedula);s.numeroIdentificacion = text(s.numeroIdentificacion || s.numeroidentificacion || cedula);s._docId = text(s._docId || s.docId || cedula);s.docId = text(s.docId || s._docId || cedula);}
    s.estadoMatricula = text(s.estadoMatricula || s._bl2EstadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO";
    s.historialEstadoMatricula = Array.isArray(s.historialEstadoMatricula) ? s.historialEstadoMatricula : [];
    s.divisiones = normalizeDivisiones(s.divisiones || s.division || s.Division || s.División || s._bl2Division);
    if(s.divisiones.length){s.division = s.divisiones[0];}else{delete s.division;}
    s.updatedAt = text(s.updatedAt || s.actualizadoEn) || now();
    return s;
  }

  function normalizePeriod(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"){return window.BLPeriodosCanon.normalizePeriod(period);}
    var p = period && typeof period === "object" ? Object.assign({}, period) : {};
    var id = text(p.id || p.periodoId || p.value || p.label || p.periodoLabel);
    p.id = id;p.periodoId = text(p.periodoId || id);p.label = text(p.label || p.periodoLabel || id);p.periodoLabel = text(p.periodoLabel || p.label || id);p.updatedAt = text(p.updatedAt || p.creadoEn) || now();
    return p;
  }

  function dedupePeriods(periods){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.dedupe === "function"){return window.BLPeriodosCanon.dedupe(periods || []);}
    var seen = {}, out = [];
    (periods || []).forEach(function(period){var p = normalizePeriod(period);var k = compact(p.label || p.id);if(!k || seen[k]){return;}seen[k] = true;out.push(p);});
    return out;
  }

  function normalizeSnapshot(data){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.canonicalizeSnapshot === "function"){data = window.BLPeriodosCanon.canonicalizeSnapshot(data);}
    var base = data && typeof data === "object" ? data : emptySnapshot();
    var snap = Object.assign({}, base);
    snap.meta = snap.meta && typeof snap.meta === "object" ? Object.assign({}, snap.meta) : {};
    snap.periods = dedupePeriods(Array.isArray(snap.periods) ? snap.periods : []);
    snap.students = Array.isArray(snap.students) ? snap.students.map(normalizeStudent) : [];
    snap.history = Array.isArray(snap.history) ? snap.history : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics : [];
    snap.meta.app = snap.meta.app || "Requisitos";
    snap.meta.module = snap.meta.module || "ExcelLocal";
    snap.meta.version = VERSION;
    snap.meta.schemaVersion = 5;
    snap.meta.updatedAt = snap.meta.updatedAt || now();
    snap.meta.totalStudents = snap.students.length;
    snap.meta.totalPeriods = snap.periods.length;
    return snap;
  }

  function compactRecord(record){
    var source = record && typeof record === "object" ? record : {};
    var out = {};
    Object.keys(source).forEach(function(k){
      var value = source[k], low = compact(k);
      if(low.indexOf("base64") >= 0 || low.indexOf("buffer") >= 0 || low.indexOf("blob") >= 0 || low === "raw" || low === "archivooriginal" || low === "exceloriginal"){return;}
      if(typeof value === "string" && value.length > 8000){out[k] = value.slice(0,8000) + "… [recortado por Base Local]";return;}
      out[k] = value;
    });
    return out;
  }

  function minimalStudent(student){
    var normalized = normalizeStudent(student);
    var out = {};
    CORE_FIELDS.concat(REQUIREMENT_KEYS).forEach(function(field){if(Object.prototype.hasOwnProperty.call(normalized, field) && normalized[field] != null && text(normalized[field]) !== ""){out[field] = normalized[field];}});
    if(normalizer() && typeof normalizer().REQUIREMENT_ALIASES === "object"){
      Object.keys(normalizer().REQUIREMENT_ALIASES).forEach(function(keyName){var value = normalizer().value(normalized, keyName);if(text(value) !== ""){out[keyName] = value;}});
    }
    out._bl2Id = normalized._bl2Id || normalized.cedula || normalized.numeroIdentificacion || "";
    out._bl2Nombre = normalized._bl2Nombre || normalized.nombres || normalized.Nombres || "";
    out._bl2Carrera = normalized._bl2Carrera || normalized.nombrecarrera || normalized.NombreCarrera || "";
    out._bl2Periodo = normalized._bl2Periodo || normalized.periodoLabel || normalized.periodoId || "";
    out._bl2PeriodoId = normalized._bl2PeriodoId || normalized.periodoId || "";
    out._bl2Division = normalized._bl2Division || normalized.division || "Sin división";
    out._bl2EstadoMatricula = normalized._bl2EstadoMatricula || normalized.estadoMatricula || "ACTIVO";
    return compactRecord(out);
  }

  function compactSnapshotForStorage(snapshot){
    var snap = normalizeSnapshot(snapshot || emptySnapshot());
    snap.meta = Object.assign({}, snap.meta || {}, {compactedForStorage:true, compactedAt:now(), version:VERSION, schemaVersion:5});
    snap.history = Array.isArray(snap.history) ? snap.history.slice(-80) : [];
    snap.diagnostics = Array.isArray(snap.diagnostics) ? snap.diagnostics.slice(-30) : [];
    snap.students = Array.isArray(snap.students) ? snap.students.map(compactRecord) : [];
    snap.periods = Array.isArray(snap.periods) ? snap.periods.map(compactRecord) : [];
    return snap;
  }

  function emergencySnapshotForStorage(snapshot){
    var snap = normalizeSnapshot(snapshot || emptySnapshot());
    return {meta:Object.assign({}, snap.meta || {}, {app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:5, updatedAt:now(), totalStudents:snap.students.length, totalPeriods:snap.periods.length, emergencyStored:true, storageMode:"minimal_localStorage_with_requirements", message:"Snapshot reducido por cuota. Se conservaron identidad, período, división, contacto, notas y requisitos."}), periods:snap.periods.map(compactRecord), students:snap.students.map(minimalStudent), history:Array.isArray(snap.history) ? snap.history.slice(-20) : [], diagnostics:[]};
  }

  function markerSnapshotForStorage(snapshot){var snap = normalizeSnapshot(snapshot || emptySnapshot());return {meta:Object.assign({}, snap.meta || {}, {app:"Requisitos", module:"ExcelLocal", version:VERSION, schemaVersion:5, updatedAt:now(), totalStudents:snap.students.length, totalPeriods:snap.periods.length, memoryOnly:true, storageMode:"memory_only", message:"Base Local completa activa en memoria. Si recargas, baja Firebase nuevamente."}), periods:snap.periods.slice(0,10).map(compactRecord), students:[], history:[], diagnostics:[]};}

  function looksLikeSnapshot(value){return !!(value && typeof value === "object" && value.meta && Array.isArray(value.periods) && Array.isArray(value.students));}
  function readFromSession(options){
    options = options || {};
    var api = sessionApi();
    if(!api || typeof api.getSnapshot !== "function"){return null;}
    try{
      var snap = api.getSnapshot({clone:false});
      if(looksLikeSnapshot(snap)){
        memory.loaded = true;
        memory.snapshot = normalizeSnapshot(snap);
        memory.source = "maq-session";
        return options.clone === false ? memory.snapshot : clone(memory.snapshot);
      }
    }catch(error){console.warn("[ExcelLocalStorage] sesión rápida no disponible", error);}
    return null;
  }

  function readSnapshot(options){
    options = options || {};
    if(options.session !== false){
      var fromSession = readFromSession(options);
      if(fromSession){return fromSession;}
    }
    try{
      var raw = localStorage.getItem(key()) || "";
      if(memory.loaded && memory.raw === raw && memory.snapshot){return options.clone === false ? memory.snapshot : clone(memory.snapshot);}
      var snap = raw ? normalizeSnapshot(JSON.parse(raw)) : emptySnapshot();
      memory.loaded = true;
      memory.raw = raw;
      memory.snapshot = snap;
      memory.source = "localStorage";
      return options.clone === false ? snap : clone(snap);
    }catch(error){console.warn("[ExcelLocalStorage] lectura fallida", error);var fallback = emptySnapshot();memory.loaded = true;memory.raw = "";memory.snapshot = fallback;memory.source = "fallback";return options.clone === false ? fallback : clone(fallback);}
  }

  function persistRaw(raw){localStorage.setItem(key(), raw);}
  function tryPersistSnapshot(candidate){var raw = JSON.stringify(candidate);persistRaw(raw);return raw;}
  function activateMemorySnapshot(snapshot, raw, source){
    memory.loaded = true;memory.raw = raw || "";memory.snapshot = snapshot;memory.source = source || "writeSnapshot";
    try{var api = sessionApi();if(api && typeof api.setSnapshot === "function"){api.setSnapshot(snapshot,{source:"ExcelLocalStorage." + (source || "writeSnapshot"), alreadyStored:true, clone:false});}}catch(error){}
  }
  function invalidateEngines(){try{if(window.BL2DataEngine && typeof window.BL2DataEngine.invalidate === "function"){window.BL2DataEngine.invalidate();}}catch(error){}try{if(window.BL2 && typeof window.BL2.invalidate === "function"){window.BL2.invalidate({emit:false, source:"ExcelLocalStorage"});}}catch(error){}try{if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){window.BL2CacheResumen.invalidate();}}catch(error){}try{window.dispatchEvent(new CustomEvent("requisitos:bl:snapshot-changed", {detail:{source:"ExcelLocalStorage", at:now()}}));}catch(error){} }

  function writeSnapshot(snapshot){
    var snap = normalizeSnapshot(snapshot);snap.meta.updatedAt = now();snap.meta.version = VERSION;snap.meta.schemaVersion = 5;
    var savedSnap = snap, raw = "", purged = {removed:0, freedChars:0}, compacted = false, emergency = false, memoryOnly = false;
    try{raw = tryPersistSnapshot(savedSnap);}catch(error){
      if(!isQuotaError(error)){throw error;}
      purged = purgeHeavyLocalCopies();
      try{raw = tryPersistSnapshot(savedSnap);}catch(secondError){
        if(!isQuotaError(secondError)){throw secondError;}
        savedSnap = compactSnapshotForStorage(snap);compacted = true;
        try{raw = tryPersistSnapshot(savedSnap);}catch(thirdError){
          if(!isQuotaError(thirdError)){throw thirdError;}
          savedSnap = emergencySnapshotForStorage(snap);emergency = true;purgeHeavyLocalCopies();
          try{raw = tryPersistSnapshot(savedSnap);}catch(fourthError){
            if(!isQuotaError(fourthError)){throw fourthError;}
            memoryOnly = true;savedSnap = snap;var marker = markerSnapshotForStorage(snap);try{raw = JSON.stringify(marker);persistRaw(raw);}catch(markerError){raw = "";try{localStorage.removeItem(key());}catch(removeError){}}
          }
        }
      }
    }
    activateMemorySnapshot(savedSnap, raw, memoryOnly ? "memory_only" : (emergency ? "writeSnapshot_emergency" : (compacted ? "writeSnapshot_compacted" : "writeSnapshot")));
    saveStorageStatus({ok:true, mode:memoryOnly ? "memory_only" : (emergency ? "saved_emergency" : (compacted ? "saved_compacted" : "saved")), bytes:raw.length, purged:purged, compacted:compacted, emergency:emergency, memoryOnly:memoryOnly, totalStudents:snap.students.length, totalPeriods:snap.periods.length, message:memoryOnly ? "Base Local activa en memoria." : "Base Local guardada."});
    invalidateEngines();
    return clone(savedSnap);
  }

  function clear(){var snap = emptySnapshot();writeSnapshot(snap);return snap;}
  function invalidate(){memory.loaded = false;memory.raw = "";memory.snapshot = null;memory.source = "invalidate";invalidateEngines();}
  function status(){return Object.assign({ok:true, mode:"excel_local_storage", version:VERSION, memoryLoaded:memory.loaded, source:memory.source, updatedAt:now()}, (function(){try{return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");}catch(error){return {};}})());}

  window.ExcelLocalStorage = {version:VERSION, emptySnapshot:emptySnapshot, normalizeSnapshot:normalizeSnapshot, readSnapshot:readSnapshot, writeSnapshot:writeSnapshot, clear:clear, clone:clone, invalidate:invalidate, purgeHeavyLocalCopies:purgeHeavyLocalCopies, status:status, compactSnapshotForStorage:compactSnapshotForStorage, emergencySnapshotForStorage:emergencySnapshotForStorage};
})(window);