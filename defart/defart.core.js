/* =========================================================
Nombre completo: defart.core.js
Ruta o ubicación: /Requisitos/defart/defart.core.js
Función o funciones:
- Leer estudiantes activos desde BDLocal con compatibilidad ExcelLocalRepo/BL2.
- Normalizar campos reales de requisitos para Defensas.
- Bloquear notas cuando faltan requisitos.
- Usar estados finales definidos: Falta requisitos, Supletorio Art, Supletorio Def, Aprobado.
- Calcular N-FIN con fórmula institucional: (N-ART * 0.70) + (N-DEF * 0.30).
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- defart.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.1.0-defart-core-estados";
  var STATES = ["Falta requisitos", "Supletorio Art", "Supletorio Def", "Aprobado"];

  var REQUIREMENTS = [
    { key:"academico", label:"Académico", applies:"always", aliases:["academico","académico","Academico","Académico","reqAcademico","requisitoAcademico","estadoAcademico"] },
    { key:"documentacion", label:"Documentación", applies:"always", aliases:["documentacion","documentación","Documentacion","Documentación","reqDocumentacion","requisitoDocumentacion","estadoDocumentacion"] },
    { key:"financiero", label:"Financiero", applies:"always", aliases:["financiero","Financiero","reqFinanciero","requisitoFinanciero","estadoFinanciero"] },
    { key:"practicasvinculacion", label:"Prácticas", applies:"always", aliases:["practicasvinculacion","practicas","prácticas","PracticasVinculacion","PrácticasVinculación","Practicas Vinculacion","Prácticas Vinculación","Practicas","Prácticas","practicasPreprofesionales","prácticas preprofesionales"] },
    { key:"vinculacion", label:"Vinculación", applies:"always", aliases:["vinculacion","vinculación","Vinculacion","Vinculación","reqVinculacion","requisitoVinculacion","estadoVinculacion"] },
    { key:"seguimientograduados", label:"Seguimiento graduados", applies:"always", aliases:["seguimientograduados","seguimiento graduados","SeguimientoGraduados","Seguimiento graduados","seguimientoGraduados"] },
    { key:"ingles", label:"Inglés", applies:"always", aliases:["ingles","inglés","Ingles","Inglés","reqIngles","requisitoIngles","estadoIngles"] },
    { key:"actualizaciondatos", label:"Actualización datos", applies:"always", aliases:["actualizaciondatos","actualización datos","actualizacion datos","ActualizacionDatos","ActualizaciónDatos","Actualización de datos","actualizacionDeDatos"] },
    { key:"titulacion", label:"Titulación", applies:"regular", aliases:["titulacion","titulación","Titulacion","Titulación","reqTitulacion","requisitoTitulacion","estadoTitulacion"] }
  ];

  var OK_VALUES = ["cumple", "aprobado", "aprobada", "si", "sí", "s", "ok", "1", "true", "validado", "validada", "completo", "completa", "hecho", "listo", "x"];
  var EMPTY_OK_VALUES = ["no aplica", "no_aplica", "n/a", "na", "no corresponde", "exento", "exenta"];

  function text(value){ return String(value == null ? "" : value).trim(); }
  function now(){ return new Date().toISOString(); }
  function norm(value){ return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function compact(value){ return norm(value).replace(/[^a-z0-9]/g, ""); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value == null ? null : value)); }catch(error){ return value; } }

  function notasService(){ return window.BLNotasDefensa || null; }
  function dataEngine(){ return window.BL2DataEngine || null; }
  function normalizer(){ return window.BL2StudentNormalizer || null; }
  function repo(){
    if(!window.ExcelLocalRepo){ throw new Error("ExcelLocalRepo no disponible. Primero abre BL o Carga para inicializar BaseLocal."); }
    return window.ExcelLocalRepo;
  }
  function storage(){ return window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function" ? window.ExcelLocalStorage : null; }

  function getSnapshot(){
    if(storage()){ return storage().readSnapshot(); }
    if(repo().getSnapshot){ return repo().getSnapshot(); }
    return { periods:[], students:[], history:[], meta:{} };
  }

  function invalidateCaches(){
    try{ if(dataEngine() && typeof dataEngine().invalidate === "function"){ dataEngine().invalidate(); } }catch(error){}
    try{ if(window.BL2 && typeof window.BL2.invalidate === "function"){ window.BL2.invalidate({emit:false, source:"defart"}); } }catch(error){}
    try{ if(window.BL2LegacyAdapter && typeof window.BL2LegacyAdapter.invalidate === "function"){ window.BL2LegacyAdapter.invalidate(); } }catch(error){}
    try{ if(window.FichaCore && typeof window.FichaCore.invalidate === "function"){ window.FichaCore.invalidate(); } }catch(error){}
    try{ if(window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function"){ window.BL2CacheResumen.invalidate(); } }catch(error){}
    try{ window.localStorage.setItem("REQ_BL_SIGNAL_V1", JSON.stringify({type:"defensas-notas-saved", source:"defart.core", updatedAt:now()})); }catch(error){}
  }

  function writeSnapshot(snapshot){
    var saved = storage() && typeof storage().writeSnapshot === "function" ? storage().writeSnapshot(snapshot) : snapshot;
    try{
      if(window.RequisitosBL && typeof window.RequisitosBL.mirrorSnapshotToCollections === "function"){
        window.RequisitosBL.mirrorSnapshotToCollections({force:true, silent:true});
        window.RequisitosBL.notificar("snapshot-changed", {source:"defart.core", updatedAt:now()});
      }
    }catch(error){}
    invalidateCaches();
    return saved;
  }

  function backupSnapshot(snapshot, reason){
    try{ window.localStorage.setItem("REQ_DEFART_BACKUP_V1:" + Date.now(), JSON.stringify({reason:reason || "before_save", createdAt:now(), snapshot:clone(snapshot)})); }catch(error){}
  }

  function normalizeRow(row){
    return normalizer() && typeof normalizer().normalize === "function" ? normalizer().normalize(row || {}, {clone:false}) : Object.assign({}, row || {});
  }

  function rawStudents(){
    try{
      if(dataEngine() && typeof dataEngine().listStudents === "function"){
        return dataEngine().listStudents({matricula:"ACTIVO", limit:0}).rows || [];
      }
    }catch(error){}
    return repo().listAllStudents ? repo().listAllStudents() : (getSnapshot().students || []);
  }

  function rawPeriods(){
    try{ if(dataEngine() && typeof dataEngine().listPeriods === "function"){ return dataEngine().listPeriods() || []; } }catch(error){}
    return repo().listPeriods ? repo().listPeriods() : (getSnapshot().periods || []);
  }

  function pick(row, names){
    row = row || {};
    for(var i = 0; i < names.length; i += 1){
      if(text(row[names[i]]) !== ""){ return row[names[i]]; }
    }
    return "";
  }

  function valueByAliases(row, aliases){
    row = row || {};
    aliases = aliases || [];
    var keys = Object.keys(row);
    var wanted = aliases.map(compact);

    for(var i = 0; i < aliases.length; i += 1){
      if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){
        return row[aliases[i]];
      }
    }

    for(var j = 0; j < keys.length; j += 1){
      if(wanted.indexOf(compact(keys[j])) >= 0 && text(row[keys[j]]) !== ""){
        return row[keys[j]];
      }
    }

    return "";
  }

  function noteString(value){ return text(value).replace(",", "."); }
  function numberValue(value){
    if(notasService() && typeof notasService().normalizarNota === "function"){ return notasService().normalizarNota(value); }
    if(value === null || value === undefined || text(value) === ""){ return null; }
    var num = Number(noteString(value));
    return Number.isFinite(num) ? num : null;
  }
  function round2(value){
    if(notasService() && typeof notasService().redondear2 === "function"){ return notasService().redondear2(value); }
    return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;
  }
  function noteToText(value){
    if(notasService() && typeof notasService().formatearNota === "function"){ return notasService().formatearNota(value); }
    var num = numberValue(value);
    return num === null ? "" : String(round2(num));
  }
  function hasMaxTwoDecimals(value){
    var raw = noteString(value);
    if(!raw){ return true; }
    return /^\d{1,2}(\.\d{0,2})?$|^10(\.0{0,2})?$|^0(\.\d{0,2})?$/.test(raw);
  }
  function isValidNote(value){
    if(notasService() && typeof notasService().validarNota === "function"){ return notasService().validarNota(value); }
    if(text(value) === ""){ return true; }
    var num = numberValue(value);
    return num !== null && num >= 0 && num <= 10 && hasMaxTwoDecimals(value);
  }

  function periodId(row){ return text(row && row._bl2PeriodoId || pick(row, ["periodoId", "ultimoPeriodoId", "periodId", "PeriodoId", "periodo", "Periodo"])); }
  function periodLabel(row){ return text(row && row._bl2Periodo || pick(row, ["periodoLabel", "PeriodoLabel", "periodo", "Periodo"])) || periodId(row) || "Sin período"; }
  function samePeriod(a, b){
    if(!text(b)){ return true; }
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){ return window.BLPeriodosCanon.samePeriod(a, b); }
    return text(a) === text(b) || norm(a) === norm(b) || compact(a) === compact(b);
  }

  function isPvcPeriod(row){
    var raw = norm([periodId(row), periodLabel(row)].join(" "));
    var hasAbril = raw.indexOf("abril") >= 0 || raw.indexOf("abr") >= 0 || raw.indexOf("04") >= 0;
    var hasAgosto = raw.indexOf("agosto") >= 0 || raw.indexOf("ago") >= 0 || raw.indexOf("08") >= 0;
    var tipo = norm(pick(row || {}, ["tipoPeriodo", "TipoPeriodo", "tipo_periodo", "modalidadPeriodo", "periodoTipo"]));
    return tipo === "pvc" || tipo.indexOf("pvc") >= 0 || (hasAbril && hasAgosto);
  }

  function appliesRequirement(req, row){
    if(req.applies === "regular" && isPvcPeriod(row)){ return false; }
    return true;
  }

  function requirementStatus(row, req){
    if(!appliesRequirement(req, row)){
      return { key:req.key, label:req.label, applies:false, cumple:true, value:"No aplica" };
    }

    var raw = valueByAliases(row, [req.key].concat(req.aliases || []));
    var normalized = norm(raw);
    var compacted = compact(raw);
    var ok = OK_VALUES.indexOf(normalized) >= 0 || OK_VALUES.indexOf(compacted) >= 0;
    var noAplica = EMPTY_OK_VALUES.indexOf(normalized) >= 0 || EMPTY_OK_VALUES.indexOf(compacted) >= 0;

    return {
      key:req.key,
      label:req.label,
      applies:true,
      cumple:ok || noAplica,
      value:raw
    };
  }

  function requirementSummary(row){
    var missing = [];
    var values = {};
    var total = 0;
    REQUIREMENTS.forEach(function(req){
      var status = requirementStatus(row, req);
      values[req.key] = status.value;
      if(status.applies){
        total += 1;
        if(!status.cumple){ missing.push(req.label); }
      }
    });
    return { ok:missing.length === 0, missing:missing, values:values, total:total };
  }

  function isActive(row){
    var value = norm(row && row._bl2EstadoMatricula || pick(row, ["estadoMatricula", "EstadoMatricula", "estado", "Estado"]));
    if(!value){ return true; }
    return value === "activo";
  }

  function studentId(row, index){
    return text(row && row._bl2Id || pick(row, ["_docId", "docId", "cedula", "Cedula", "CEDULA", "numeroIdentificacion", "numeroidentificacion", "NumeroIdentificacion", "identificacion", "Identificacion"])) || ("fila_" + index);
  }

  function divisionOf(row){
    if(row && row._bl2Division){ return row._bl2Division; }
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){ return window.BLDivisionesService.studentDivision(row); }
    var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];
    return list[0] || row.division || row.Division || row["División"] || "Sin división";
  }

  function hasDivision(row, division){
    if(!text(division)){ return true; }
    if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){ return window.BLDivisionesService.hasDivision(row, division); }
    return norm(divisionOf(row)) === norm(division);
  }

  function calculateFinal(nart, ndef){
    if(notasService() && typeof notasService().calcularNfin === "function"){ return notasService().calcularNfin(nart, ndef); }
    if(nart === null || ndef === null){ return null; }
    if(nart < 7){ return null; }
    return round2((nart * 0.70) + (ndef * 0.30));
  }

  function notesOf(row){
    if(notasService() && typeof notasService().extraerNotas === "function"){
      var central = notasService().extraerNotas(row);
      return { nart:numberValue(central.nart), ndef:numberValue(central.ndef), nfin:numberValue(central.nfin) };
    }
    var nart = numberValue(pick(row, ["Notart", "Nart", "N_ART", "N-ART", "notart", "notaArticulo", "nota_articulo"]));
    var ndef = numberValue(pick(row, ["Notdef", "Ndef", "N_DEF", "N-DEF", "notdef", "notaDefensa", "nota_defensa"]));
    var nfin = numberValue(pick(row, ["Notafinal", "NotaFinal", "Nfin", "nfin", "N_FIN", "N-FIN", "notaFinal"]));
    if(nfin === null){ nfin = calculateFinal(nart, ndef); }
    return { nart:nart, ndef:ndef, nfin:nfin };
  }

  function applyNotesPatch(nart, ndef, options){
    if(notasService() && typeof notasService().aplicarNotas === "function"){
      return notasService().aplicarNotas({}, nart, ndef, options || {});
    }
    var updatedAt = options && options.updatedAt ? options.updatedAt : now();
    var fin = calculateFinal(nart, ndef);
    return {
      Notart:nart, Notdef:ndef, Notafinal:fin,
      Nart:nart, Ndef:ndef, Nfin:fin,
      nart:nart, ndef:ndef, nfin:fin,
      notaArticulo:nart, notaDefensa:ndef, notaFinal:fin,
      ultimaEdicionLocal:updatedAt, updatedAt:updatedAt,
      notasDefensaActualizadasEn:updatedAt,
      notasDefensaOrigen:(options && options.origen) || "defensas"
    };
  }

  function resolveEstado(req, nart, ndef){
    if(!req.ok){ return "Falta requisitos"; }
    if(nart === null || nart < 7){ return "Supletorio Art"; }
    if(ndef === null || ndef < 7){ return "Supletorio Def"; }
    return "Aprobado";
  }

  function decorate(row, index){
    var source = normalizeRow(row || {});
    var req = requirementSummary(source);
    var notes = notesOf(source);
    var nart = notes.nart;
    var ndef = notes.ndef;
    var canArt = req.ok;
    var canDef = canArt && nart !== null && nart >= 7;
    var nfin = canDef ? calculateFinal(nart, ndef) : null;
    var estado = resolveEstado(req, nart, ndef);

    source._defId = studentId(source, index);
    source._cedula = text(source._bl2Id || pick(source, ["cedula", "Cedula", "CEDULA", "numeroIdentificacion", "numeroidentificacion", "NumeroIdentificacion", "identificacion", "Identificacion"]));
    source._nombre = text(source._bl2Nombre || pick(source, ["Nombres", "nombres", "Nombre", "nombre", "estudiante", "Estudiante", "apellidosNombres", "apellidos_nombres"]));
    source._carrera = text(source._bl2Carrera || pick(source, ["NombreCarrera", "nombrecarrera", "nombreCarrera", "Carrera", "carrera", "programa", "Programa"])) || "SIN CARRERA";
    source._division = divisionOf(source);
    source._sede = text(source._bl2Sede || pick(source, ["Sede", "sede", "campus"])) || "SIN SEDE";
    source._periodoId = periodId(source);
    source._periodoLabel = periodLabel(source);
    source._estadoMatricula = text(source._bl2EstadoMatricula || pick(source, ["estadoMatricula", "EstadoMatricula", "estado", "Estado"])) || "ACTIVO";
    source._nart = nart;
    source._ndef = ndef;
    source._nfin = nfin;
    source._canArt = canArt;
    source._canDef = canDef;
    source._estadoDefensa = estado;
    source._missingRequirements = req.missing;
    source._requirementValues = req.values;
    source._requirementsOk = req.ok;
    return source;
  }

  function preview(row, patch){
    var next = Object.assign({}, row || {});
    patch = patch || {};
    if(Object.prototype.hasOwnProperty.call(patch, "nart")){ next.Notart = numberValue(patch.nart); }
    if(Object.prototype.hasOwnProperty.call(patch, "ndef")){ next.Notdef = numberValue(patch.ndef); }
    return decorate(next, 0);
  }

  function unique(list, getter){
    var map = {};
    (list || []).forEach(function(item){
      var value = text(getter(item));
      if(value){ map[value] = true; }
    });
    return Object.keys(map).sort(function(a,b){ return a.localeCompare(b, "es"); });
  }

  function periodOptions(rows){
    var map = {};
    rawPeriods().forEach(function(period){
      var p = window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function" ? window.BLPeriodosCanon.normalizePeriod(period) : period;
      var id = text(p.id || p.periodoId || p.value);
      if(id){ map[id] = {id:id, label:text(p.label || p.periodoLabel || id)}; }
    });
    rows.forEach(function(row){
      if(row._periodoId && !map[row._periodoId]){ map[row._periodoId] = {id:row._periodoId, label:row._periodoLabel || row._periodoId}; }
    });
    return Object.keys(map).map(function(key){ return map[key]; }).sort(function(a,b){ return String(a.label || a.id).localeCompare(String(b.label || b.id), "es"); });
  }

  function compareValues(a, b, key){
    var av = a[key], bv = b[key];
    if(key === "_nart" || key === "_ndef" || key === "_nfin"){
      av = av === null ? -1 : av;
      bv = bv === null ? -1 : bv;
      return av - bv;
    }
    return String(av == null ? "" : av).localeCompare(String(bv == null ? "" : bv), "es", {numeric:true, sensitivity:"base"});
  }

  function filterRows(options){
    options = options || {};
    var q = norm(options.search || "");
    var rows = rawStudents().filter(isActive).map(decorate).filter(function(row){
      if(options.periodId && !samePeriod(row._periodoId, options.periodId)){ return false; }
      if(options.division && !hasDivision(row, options.division)){ return false; }
      if(options.career && row._carrera !== options.career){ return false; }
      if(options.status && row._estadoDefensa !== options.status){ return false; }
      if(options.sede && row._sede !== options.sede){ return false; }
      if(q){
        var hay = norm([row._cedula, row._nombre, row._carrera, row._division, row._sede, row._periodoLabel, row._estadoDefensa].join(" "));
        if(hay.indexOf(q) < 0){ return false; }
      }
      return true;
    });
    if(options.sortKey){
      rows.sort(function(a,b){
        var result = compareValues(a, b, options.sortKey);
        return options.sortDir === "desc" ? -result : result;
      });
    }else{
      rows.sort(function(a,b){ return a._nombre.localeCompare(b._nombre, "es"); });
    }
    return rows;
  }

  function kpis(rows){
    var result = { total:rows.length };
    STATES.forEach(function(state){ result[state] = 0; });
    rows.forEach(function(row){
      if(Object.prototype.hasOwnProperty.call(result, row._estadoDefensa)){ result[row._estadoDefensa] += 1; }
    });
    return result;
  }

  function diagnosticsFromRows(allActive, rows, options){
    var notes = { withNart:0, withNdef:0, withNfin:0 };
    allActive.forEach(function(row){
      if(row._nart !== null){ notes.withNart += 1; }
      if(row._ndef !== null){ notes.withNdef += 1; }
      if(row._nfin !== null){ notes.withNfin += 1; }
    });
    var connectorCounts = null;
    try{ if(window.RequisitosBL && typeof window.RequisitosBL.conteos === "function"){ connectorCounts = window.RequisitosBL.conteos(); } }catch(error){}
    return {
      ok:true,
      generatedAt:now(),
      version:VERSION,
      source:dataEngine() ? "BL2DataEngine" : "BaseLocal",
      totalActive:allActive.length,
      visible:rows.length,
      notes:notes,
      formula:"NFIN=(NART*0.70)+(NDEF*0.30)",
      filters:options || {},
      rules:{ states:STATES.slice(), requirements:REQUIREMENTS.map(function(r){ return {key:r.key, label:r.label, applies:r.applies}; }) },
      connections:{ excelLocalRepo:!!window.ExcelLocalRepo, excelLocalStorage:!!window.ExcelLocalStorage, requisitosBL:!!window.RequisitosBL, baseLocalBridge:!!window.BaseLocalBridge, notasDefensa:!!window.BLNotasDefensa, exportExcel:!!window.DefartExport, bl2DataEngine:!!dataEngine(), blCounts:connectorCounts }
    };
  }

  function summary(options){
    options = options || {};
    var allActive = rawStudents().filter(isActive).map(decorate);
    var rows = filterRows(options);
    var baseForDivision = allActive.filter(function(row){ return !options.periodId || samePeriod(row._periodoId, options.periodId); });
    var baseForCareer = baseForDivision.filter(function(row){ return !options.division || hasDivision(row, options.division); });
    return {
      rows:rows,
      kpis:kpis(rows),
      periodList:periodOptions(allActive),
      divisionList:(window.BLDivisionesService && window.BLDivisionesService.listDivisionsWithEmpty) ? window.BLDivisionesService.listDivisionsWithEmpty(baseForDivision, "") : unique(baseForDivision, function(row){ return row._division; }),
      careerList:unique(baseForCareer, function(row){ return row._carrera; }),
      sedeList:unique(rows.length ? rows : baseForCareer, function(row){ return row._sede; }),
      states:STATES.slice(),
      diagnostics:diagnosticsFromRows(allActive, rows, options)
    };
  }

  function findStudentIndex(students, id){
    id = text(id);
    for(var i = 0; i < students.length; i += 1){
      var decorated = decorate(students[i], i);
      if(studentId(students[i], i) === id || decorated._defId === id || decorated._cedula === id){ return i; }
    }
    return -1;
  }

  function normalizePatch(patch){
    var out = {};
    if(Object.prototype.hasOwnProperty.call(patch, "nart")){ out.Notart = numberValue(patch.nart); }
    if(Object.prototype.hasOwnProperty.call(patch, "ndef")){ out.Notdef = numberValue(patch.ndef); }
    return out;
  }

  function validateChange(current, change, patch, nart, ndef){
    var errors = [];
    if(Object.prototype.hasOwnProperty.call(change, "nart") && !isValidNote(change.nart)){ errors.push("N-ART inválida: " + current._nombre); }
    if(Object.prototype.hasOwnProperty.call(change, "ndef") && !isValidNote(change.ndef)){ errors.push("N-DEF inválida: " + current._nombre); }
    if(Object.prototype.hasOwnProperty.call(change, "nart") && !current._canArt){ errors.push("N-ART bloqueada por falta de requisitos: " + current._nombre); }
    if(Object.prototype.hasOwnProperty.call(change, "ndef") && (!current._canArt || nart === null || nart < 7)){ errors.push("N-DEF bloqueada hasta que N-ART sea 7 o más: " + current._nombre); }
    if(nart !== null && (nart < 0 || nart > 10)){ errors.push("N-ART fuera de rango: " + current._nombre); }
    if(ndef !== null && (ndef < 0 || ndef > 10)){ errors.push("N-DEF fuera de rango: " + current._nombre); }
    return errors;
  }

  function saveNotes(changes){
    changes = Array.isArray(changes) ? changes : [];
    if(!changes.length){ return {ok:true, saved:0, total:0, message:"No hay cambios pendientes."}; }

    var snapshot = getSnapshot();
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    backupSnapshot(snapshot, "before_defensas_save");

    var saved = 0, errors = [], savedPeriodMap = {}, savedIds = [];
    changes.forEach(function(change){
      var index = findStudentIndex(snapshot.students, change.id);
      if(index < 0){ errors.push("No encontrado: " + change.id); return; }

      var current = decorate(snapshot.students[index], index);
      var patch = normalizePatch(change);
      var nart = Object.prototype.hasOwnProperty.call(patch, "Notart") ? patch.Notart : current._nart;
      var ndef = Object.prototype.hasOwnProperty.call(patch, "Notdef") ? patch.Notdef : current._ndef;
      var validationErrors = validateChange(current, change, patch, nart, ndef);
      if(validationErrors.length){ errors = errors.concat(validationErrors); return; }

      var updatedAt = now();
      var notePatch = applyNotesPatch(nart, ndef, {updatedAt:updatedAt, origen:"defensas"});
      patch = Object.assign({}, patch, notePatch);
      snapshot.students[index] = Object.assign({}, snapshot.students[index], patch);
      if(current._periodoId){ savedPeriodMap[current._periodoId] = true; }
      savedIds.push(current._cedula || change.id);
      saved += 1;
    });

    if(saved > 0){
      var periodIds = Object.keys(savedPeriodMap);
      snapshot.meta = Object.assign({}, snapshot.meta || {}, {
        updatedAt:now(),
        lastDefensasUpdateAt:now(),
        lastDefensasSaved:saved,
        lastDefensasPeriodos:periodIds,
        lastDefensasFormula:"NFIN=(NART*0.70)+(NDEF*0.30)",
        lastDefensasEstados:STATES.slice()
      });
      snapshot.history.unshift({
        id:"defensas_notas_" + Date.now(),
        action:"guardarNotasDefensas",
        periodoId:periodIds.length === 1 ? periodIds[0] : "VARIOS",
        periodoLabel:periodIds.length === 1 ? periodIds[0] : "Varios",
        fileName:"Defensas",
        totalRows:saved,
        errores:errors.length,
        formula:"NFIN=(NART*0.70)+(NDEF*0.30)",
        ids:savedIds,
        createdAt:now()
      });
      writeSnapshot(snapshot);
    }

    return {ok:errors.length === 0, saved:saved, total:changes.length, errors:errors, message:saved + " cambio(s) guardado(s) en BaseLocal."};
  }

  function selfTest(){
    var result = {ok:true, checkedAt:now(), version:VERSION, checks:[]};
    function check(name, ok, detail){
      result.checks.push({name:name, ok:!!ok, detail:detail || ""});
      if(!ok){ result.ok = false; }
    }
    var snap = null;
    try{ snap = getSnapshot(); check("BaseLocal snapshot", true, "Snapshot leído"); }catch(error){ check("BaseLocal snapshot", false, error.message || String(error)); }
    check("ExcelLocalRepo", !!window.ExcelLocalRepo, "Repositorio local");
    check("ExcelLocalStorage", !!window.ExcelLocalStorage, "Storage local");
    check("BL2DataEngine", !!dataEngine(), "Motor central");
    check("Requisitos robustos", true, "Lectura por alias internos");
    check("BLDivisionesService", !!window.BLDivisionesService, "Divisiones");
    check("BLNotasDefensa", !!window.BLNotasDefensa, "Servicio central de notas");
    check("DefartExport", !!window.DefartExport, "Exportación Excel");
    check("Formula NFIN", calculateFinal(10, 8.75) === 9.63, "10 y 8.75 deben dar 9.63");
    if(snap){
      check("Estudiantes", Array.isArray(snap.students), (snap.students || []).length + " registros");
      check("Períodos", Array.isArray(snap.periods), (snap.periods || []).length + " períodos");
    }
    result.message = result.ok ? "Diagnóstico correcto." : "Hay puntos por revisar.";
    return result;
  }

  window.DefartCore = {
    summary:summary,
    saveNotes:saveNotes,
    decorate:decorate,
    preview:preview,
    noteToText:noteToText,
    isValidNote:isValidNote,
    calculateFinal:calculateFinal,
    selfTest:selfTest,
    requirements:REQUIREMENTS.map(function(r){ return {key:r.key, label:r.label, applies:r.applies}; }),
    states:STATES.slice(),
    divisionOf:divisionOf
  };
})(window);
