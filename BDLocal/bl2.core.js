/* =========================================================
Archivo: bl2.core.js
Ruta: /BDLocal/bl2.core.js
Función:
- Núcleo principal de BL2.
- Conecta IndexedDB, importación, respaldos y sincronización.
- Guarda estudiantes por período en tablas distribuidas inteligentes.
- Conserva campos manuales.
- Marca RETIRADO si un estudiante ya no aparece en el nuevo Excel.
- Reactiva como ACTIVO si vuelve a aparecer.
- Expone API compatible para Carga, Tabla, Ficha, Stats, Coordi, Repor, Infor y Sync.
========================================================= */
(function(window){
  "use strict";

  var config = window.BL2Config || {};
  var db = window.BL2DB;
  var utils = config.utils || {};
  var stores = config.stores || {};
  var settingsKeys = config.settingsKeys || {};
  var changeStatus = config.changeStatus || {};
  var changeTypes = config.changeTypes || {};
  var logLevels = config.logLevels || {};

  var STORE = {
    settings: stores.settings || "settings",
    periodos: stores.periodos || "periodos",
    estudiantes: stores.estudiantes || "estudiantes",
    requisitos: stores.requisitos || "requisitos",
    contactos: stores.contactos || "contactos",
    notas: stores.notas || "notas",
    cambios: stores.cambios || "cambios",
    logs: stores.logs || "logs",
    resumen: stores.resumen || "resumen",
    errores: stores.errores || "errores",
    syncMeta: stores.syncMeta || "sync_meta",
    backups: stores.backups || "backups"
  };

  var STUDENT_STATUS = {
    active: "ACTIVO",
    retired: "RETIRADO"
  };

  var REQUIREMENT_FIELDS = [
    { key:"Academico", label:"Académico", aliases:["Academico","Académico","academico"] },
    { key:"Documentacion", label:"Documentación", aliases:["Documentacion","Documentación","documentacion"] },
    { key:"Financiero", label:"Financiero", aliases:["Financiero","financiero"] },
    { key:"Titulacion", label:"Titulación", aliases:["Titulacion","Titulación","titulacion"] },
    { key:"PracticasVinculacion", label:"Prácticas/Vinculación", aliases:["PrácticasVinculacion","PracticasVinculacion","practicasVinculacion","Prácticas/Vinculación","Practicas/Vinculacion"] },
    { key:"Vinculacion", label:"Vinculación", aliases:["Vinculacion","Vinculación","vinculacion"] },
    { key:"SeguimientoGraduados", label:"Seguimiento graduados", aliases:["SeguimientoGraduados","seguimientoGraduados"] },
    { key:"Ingles", label:"Inglés", aliases:["Ingles","Inglés","ingles"] },
    { key:"ActualizacionDatos", label:"Actualización de datos", aliases:["ActualizaciónDatos","ActualizacionDatos","actualizacionDatos"] },
    { key:"AprobacionTitulacion", label:"Aprobación titulación", aliases:["AprobacionTitulacion","AprobaciónTitulacion","aprobacionTitulacion"] },
    { key:"AprobacionComplexivoProyecto", label:"Aprobación complexivo/proyecto", aliases:["AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","aprobacionComplexivoProyecto"] }
  ];

  var NOTE_FIELDS = [
    { key:"Notart", label:"Nart", aliases:["Notart","Nart","notart","notaArticulo","NotaArticulo"] },
    { key:"Notdef", label:"Ndef", aliases:["Notdef","Ndef","notdef","notaDefensa","NotaDefensa"] },
    { key:"Notafinal", label:"Nfinal", aliases:["Notafinal","NotaFinal","Nfinal","notafinal","calificacionFinalProyecto"] }
  ];

  var MANUAL_FIELDS = [
    "division",
    "divisiones",
    "divisionActualizadaEn",
    "observacion",
    "observaciones",
    "telegram",
    "telegramUser",
    "telegramChatId",
    "_telegramUser",
    "_telegramChatId",
    "ultimaEdicionLocal",
    "forceUploadedAt",
    "modalidadTitulacion",
    "modalidadTitulacionActualizadaEn"
  ];

  var state = {
    initialized: false,
    activePeriod: null,
    lastSummary: null
  };

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function nowISO(){
    return utils.nowISO ? utils.nowISO() : new Date().toISOString();
  }

  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: clone(detail || {}) }));
    }catch(error){}
  }

  function requireDB(){
    if(!db){ return Promise.reject(new Error("BL2DB no está cargado.")); }
    return Promise.resolve(db);
  }

  function normalizeBasic(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function normalizeCedula(value){
    if(utils.normalizeCedula){ return utils.normalizeCedula(value); }
    var raw = text(value).replace(/[^\dA-Za-z]/g, "");
    if(/^\d{9}$/.test(raw)){ return "0" + raw; }
    return raw;
  }

  function canonicalPeriodId(value){
    value = text(value);
    if(!value){ return ""; }

    var match = value.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);
    if(match){ return match[1] + "-" + match[2] + "__" + match[3] + "-" + match[4]; }

    return value.replace(/_+/g, "__");
  }

  function normalizePeriod(period){
    period = period || {};
    var id = canonicalPeriodId(period.periodoCanonicoId || period.periodoId || period.id || period.value || "");
    if(!id){ return null; }

    var label = text(
      period.periodoCanonicoLabel ||
      period.periodoLabel ||
      period.label ||
      period.nombre ||
      id
    );

    return Object.assign({}, period, {
      id: id,
      label: label,
      periodoId: id,
      periodoLabel: label,
      periodoCanonicoId: id,
      periodoCanonicoLabel: label,
      estadoDepuracion: text(period.estadoDepuracion || "OK"),
      requiereRevision: !!period.requiereRevision,
      carrerasDetectadas: Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : [],
      divisiones: Array.isArray(period.divisiones) ? period.divisiones : [],
      creadoEn: period.creadoEn || period.createdAt || nowISO(),
      createdAt: period.createdAt || period.creadoEn || nowISO(),
      updatedAt: period.updatedAt || nowISO()
    });
  }

  function studentKey(cedula, periodoId){
    if(utils.makeStudentKey){ return utils.makeStudentKey(cedula, periodoId); }
    return normalizeCedula(cedula) + "__" + canonicalPeriodId(periodoId);
  }

  function requirementKey(cedula, periodoId, requisito){
    if(utils.makeRequirementKey){ return utils.makeRequirementKey(cedula, periodoId, requisito); }
    return studentKey(cedula, periodoId) + "__" + normalizeKey(requisito);
  }

  function firstValue(row, aliases){
    row = row || {};
    aliases = Array.isArray(aliases) ? aliases : [];

    var keys = Object.keys(row);
    var wanted = aliases.map(normalizeKey);

    for(var i = 0; i < keys.length; i += 1){
      if(wanted.indexOf(normalizeKey(keys[i])) >= 0){
        var value = row[keys[i]];
        if(value !== undefined && value !== null && text(value) !== ""){
          return value;
        }
      }
    }

    return "";
  }

  function hasField(row, aliases){
    row = row || {};
    aliases = Array.isArray(aliases) ? aliases : [];

    var keys = Object.keys(row);
    var wanted = aliases.map(normalizeKey);

    for(var i = 0; i < keys.length; i += 1){
      if(wanted.indexOf(normalizeKey(keys[i])) >= 0){
        return true;
      }
    }

    return false;
  }

  function stableString(value){
    if(value === null || value === undefined){ return ""; }
    if(typeof value !== "object"){ return String(value); }
    if(Array.isArray(value)){ return "[" + value.map(stableString).join(",") + "]"; }

    return "{" + Object.keys(value).sort().map(function(key){
      return JSON.stringify(key) + ":" + stableString(value[key]);
    }).join(",") + "}";
  }

  function dataHash(value){
    var str = stableString(value);
    var h = 5381;

    for(var i = 0; i < str.length; i += 1){
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h & h;
    }

    return "h" + Math.abs(h);
  }

  function isManualField(field){
    return MANUAL_FIELDS.indexOf(field) >= 0;
  }

  function log(level, message, payload){
    level = text(level || logLevels.info || "INFO").toUpperCase();

    var row = {
      id: "log_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      level: level,
      message: text(message),
      payload: clone(payload || null),
      createdAt: nowISO()
    };

    try{
      console[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log"]("[BL2]", message, payload || "");
    }catch(error){}

    if(!db || !db.put){ return Promise.resolve(row); }

    return db.put(STORE.logs, row).catch(function(){ return row; });
  }

  function saveBasePeriods(){
    var base = Array.isArray(config.periodosBase) ? config.periodosBase : [];
    if(!base.length){ return Promise.resolve([]); }

    return db.getAll(STORE.periodos).then(function(existing){
      existing = existing || [];
      var map = {};

      existing.forEach(function(period){
        var p = normalizePeriod(period);
        if(p){ map[p.id] = true; }
      });

      var rows = base.map(normalizePeriod).filter(function(period){
        return period && !map[period.id];
      });

      if(!rows.length){ return []; }
      return db.bulkPut(STORE.periodos, rows);
    });
  }

  function init(){
    return requireDB()
      .then(function(){ return db.open(); })
      .then(function(){ return saveBasePeriods(); })
      .then(function(){ return correctPeriodDuplicates({ silent:true }); })
      .then(function(){ return getActivePeriod(); })
      .then(function(period){
        state.initialized = true;
        state.activePeriod = period;
        dispatch("bl2:ready", { activePeriod:period });
        return { ok:true, activePeriod:period };
      });
  }

  function getState(){
    return clone(state);
  }

  function getPeriods(){
    return db.getAll(STORE.periodos).then(function(rows){
      rows = (rows || []).map(normalizePeriod).filter(Boolean);

      var map = {};
      rows.forEach(function(period){
        if(!map[period.id]){
          map[period.id] = period;
          return;
        }

        map[period.id] = Object.assign({}, map[period.id], period, {
          carrerasDetectadas: uniqueCareers([].concat(map[period.id].carrerasDetectadas || [], period.carrerasDetectadas || [])),
          divisiones: period.divisiones && period.divisiones.length ? period.divisiones : (map[period.id].divisiones || []),
          estadoDepuracion: "OK",
          requiereRevision: false
        });
      });

      return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
        return text(b.id).localeCompare(text(a.id), "es");
      });
    });
  }

  function savePeriod(period){
    period = normalizePeriod(period);
    if(!period){ return Promise.reject(new Error("Período inválido.")); }
    return db.put(STORE.periodos, period).then(function(){ return period; });
  }

  function setActivePeriod(periodoId, periodoLabel){
    periodoId = canonicalPeriodId(periodoId);
    periodoLabel = text(periodoLabel || periodoId);

    if(!periodoId){
      return Promise.reject(new Error("Seleccione un período válido."));
    }

    var period = normalizePeriod({
      id: periodoId,
      label: periodoLabel
    });

    return savePeriod(period)
      .then(function(){ return db.setSetting(settingsKeys.activePeriodId || "activePeriodId", period.id); })
      .then(function(){ return db.setSetting(settingsKeys.activePeriodLabel || "activePeriodLabel", period.label); })
      .then(function(){
        state.activePeriod = {
          id: period.id,
          label: period.label,
          periodoCanonicoId: period.id,
          periodoCanonicoLabel: period.label
        };

        dispatch("bl2:period-change", clone(state.activePeriod));
        return clone(state.activePeriod);
      });
  }

  function getActivePeriod(){
    return Promise.all([
      db.getSetting(settingsKeys.activePeriodId || "activePeriodId", ""),
      db.getSetting(settingsKeys.activePeriodLabel || "activePeriodLabel", "")
    ]).then(function(values){
      var id = canonicalPeriodId(values[0]);
      var label = text(values[1] || id);

      if(id){
        return {
          id: id,
          label: label,
          periodoCanonicoId: id,
          periodoCanonicoLabel: label
        };
      }

      var base = Array.isArray(config.periodosBase) && config.periodosBase[0]
        ? normalizePeriod(config.periodosBase[0])
        : null;

      if(base){
        return setActivePeriod(base.id, base.label);
      }

      return null;
    });
  }

  function uniqueCareers(careers){
    var map = {};

    (Array.isArray(careers) ? careers : []).forEach(function(item){
      if(!item){ return; }

      if(typeof item === "string"){
        item = { id:normalizeKey(item), nombre:item, codigo:"" };
      }

      var id = text(item.id || item.codigo || item.CodigoCarrera || normalizeKey(item.nombre || item.NombreCarrera || item.label));
      if(!id){ return; }

      map[id] = {
        id: id,
        codigo: text(item.codigo || item.CodigoCarrera || ""),
        nombre: text(item.nombre || item.NombreCarrera || item.label || id)
      };
    });

    return Object.keys(map).map(function(id){ return map[id]; }).sort(function(a, b){
      return text(a.nombre).localeCompare(text(b.nombre), "es", { sensitivity:"base" });
    });
  }

  function detectCareer(row){
    var nombre = text(firstValue(row, ["NombreCarrera", "nombreCarrera", "Carrera", "carrera"]));
    var codigo = text(firstValue(row, ["CodigoCarrera", "codigoCarrera", "CódigoCarrera", "codigo_carrera"]));

    if(!nombre && !codigo){ return null; }

    return {
      id: codigo || normalizeKey(nombre),
      codigo: codigo,
      nombre: nombre || codigo
    };
  }

  function divisionForCareer(period, career){
    period = period || {};
    career = career || {};

    var id = text(career.id || career.codigo || normalizeKey(career.nombre));
    if(!id){ return ""; }

    var divisions = Array.isArray(period.divisiones) ? period.divisiones : [];

    for(var i = 0; i < divisions.length; i += 1){
      var division = divisions[i] || {};
      var careers = Array.isArray(division.carreras) ? division.carreras : [];

      for(var j = 0; j < careers.length; j += 1){
        var item = careers[j] || {};
        var cid = text(item.id || item.codigo || normalizeKey(item.nombre));

        if(cid === id){
          return text(division.nombre || division.label || division.id);
        }
      }
    }

    return "";
  }

  function requirementValue(value){
    var raw = text(value);
    var clean = normalizeBasic(raw).toUpperCase();

    if(clean === "SI" || clean === "SÍ" || clean === "OK" || clean === "APROBADO" || clean === "APROBADA"){
      return "CUMPLE";
    }

    if(clean === "NO" || clean === "NO CUMPLE" || clean === "REPROBADO" || clean === "REPROBADA"){
      return "NO CUMPLE";
    }

    if(clean === ""){
      return "PENDIENTE";
    }

    return raw;
  }

  function detectRequirements(row, student){
    row = row || {};
    student = student || {};

    return REQUIREMENT_FIELDS.map(function(def){
      if(!hasField(row, def.aliases)){ return null; }

      var value = requirementValue(firstValue(row, def.aliases));

      return {
        id: requirementKey(student.cedula, student.periodoId, def.key),
        studentId: student.id,
        cedula: student.cedula,
        periodoId: student.periodoId,
        periodoLabel: student.periodoLabel,
        key: def.key,
        nombre: def.key,
        label: def.label,
        valor: value,
        estado: value,
        updatedAt: nowISO()
      };
    }).filter(Boolean);
  }

  function detectContact(row, student){
    return {
      id: student.id,
      studentId: student.id,
      cedula: student.cedula,
      periodoId: student.periodoId,
      periodoLabel: student.periodoLabel,
      CorreoPersonal: text(firstValue(row, ["CorreoPersonal", "correoPersonal", "correo_personal"])),
      CorreoInstitucional: text(firstValue(row, ["CorreoInstitucional", "correoInstitucional", "correo_institucional"])),
      Celular: text(firstValue(row, ["Celular", "celular", "Telefono", "Teléfono", "telefono"])),
      updatedAt: nowISO()
    };
  }

  function toNumberOrText(value){
    if(value === "" || value === null || value === undefined){ return ""; }
    var normalized = text(value).replace(",", ".");
    var num = Number(normalized);
    return Number.isFinite(num) ? num : value;
  }

  function detectNotes(row, student){
    var note = {
      id: student.id,
      studentId: student.id,
      cedula: student.cedula,
      periodoId: student.periodoId,
      periodoLabel: student.periodoLabel,
      updatedAt: nowISO()
    };

    NOTE_FIELDS.forEach(function(def){
      if(hasField(row, def.aliases)){
        note[def.key] = toNumberOrText(firstValue(row, def.aliases));
      }
    });

    return note;
  }

  function buildStudent(row, options, period){
    row = row || {};
    options = options || {};
    period = normalizePeriod(period || {}) || normalizePeriod({
      id: options.periodoId,
      label: options.periodoLabel || options.periodoId
    });

    var periodoId = canonicalPeriodId(
      row.periodoCanonicoId ||
      row.periodoId ||
      options.periodoCanonicoId ||
      options.periodoId ||
      period.id
    );

    var periodoLabel = text(
      row.periodoCanonicoLabel ||
      row.periodoLabel ||
      options.periodoCanonicoLabel ||
      options.periodoLabel ||
      period.label ||
      periodoId
    );

    var cedula = normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      firstValue(row, ["numeroIdentificacion", "NumeroIdentificacion", "cedula", "Cedula", "Cédula"])
    );

    var career = detectCareer(row) || { id:"", codigo:"", nombre:"" };
    var division = divisionForCareer(period, career);
    var existingDivision = text(row.division || row.Division || "");

    if(!division && existingDivision){
      division = existingDivision;
    }

    var nombres = text(firstValue(row, ["Nombres", "nombres", "Nombre", "nombre", "Estudiante"]));

    var student = {
      id: studentKey(cedula, periodoId),
      cedula: cedula,
      numeroIdentificacion: text(row.numeroIdentificacion || cedula),
      Nombres: nombres,
      nombres: nombres,
      CodigoCarrera: text(career.codigo || firstValue(row, ["CodigoCarrera", "codigoCarrera"])),
      NombreCarrera: text(career.nombre || firstValue(row, ["NombreCarrera", "nombreCarrera", "Carrera", "carrera"])),
      HorarioComplexivo: text(firstValue(row, ["HorarioComplexivo", "horarioComplexivo", "Horario"])),
      Sede: text(firstValue(row, ["Sede", "sede"])),
      periodoId: periodoId,
      periodoLabel: periodoLabel,
      periodoCanonicoId: periodoId,
      periodoCanonicoLabel: periodoLabel,
      ultimoPeriodoId: periodoId,
      estadoMatricula: STUDENT_STATUS.active,
      division: division,
      divisiones: division ? [division] : [],
      divisionActualizadaEn: division ? nowISO() : "",
      source: options.source || "carga_excel"
    };

    student._sourceRow = clone(row);
    student._career = career;
    student._requirements = detectRequirements(row, student);
    student._contact = detectContact(row, student);
    student._notes = detectNotes(row, student);

    student.dataHash = dataHash({
      cedula: student.cedula,
      numeroIdentificacion: student.numeroIdentificacion,
      Nombres: student.Nombres,
      CodigoCarrera: student.CodigoCarrera,
      NombreCarrera: student.NombreCarrera,
      HorarioComplexivo: student.HorarioComplexivo,
      Sede: student.Sede,
      periodoId: student.periodoId,
      estadoMatricula: student.estadoMatricula,
      division: student.division,
      divisiones: student.divisiones,
      requirements: student._requirements.map(function(item){
        return { key:item.key, valor:item.valor };
      }),
      contact: student._contact,
      notes: student._notes
    });

    return student;
  }

  function cleanStudentForStore(student){
    var clean = clone(student || {});
    delete clean._sourceRow;
    delete clean._career;
    delete clean._requirements;
    delete clean._contact;
    delete clean._notes;
    return clean;
  }

  function hydrateStudent(student, reqs, contact, notes){
    var row = Object.assign({}, student || {});

    (reqs || []).forEach(function(req){
      row[req.key || req.nombre] = req.valor || req.estado || "";
    });

    if(contact){
      ["CorreoPersonal", "CorreoInstitucional", "Celular"].forEach(function(key){
        if(contact[key] !== undefined && contact[key] !== null && contact[key] !== ""){
          row[key] = contact[key];
        }
      });
    }

    if(notes){
      ["Notart", "Notdef", "Notafinal"].forEach(function(key){
        if(notes[key] !== undefined && notes[key] !== null && notes[key] !== ""){
          row[key] = notes[key];
        }
      });
    }

    row._id = row._id || row.id;
    row._cedula = row._cedula || row.cedula;
    row._nombres = row._nombres || row.Nombres || row.nombres;
    row._nombre = row._nombre || row.Nombres || row.nombres;
    row._carrera = row._carrera || row.NombreCarrera;
    row._division = row._division || row.division;
    row._periodo = row._periodo || row.periodoLabel;
    row._periodoId = row._periodoId || row.periodoId;
    row._periodoNormalizado = row._periodoNormalizado || row.periodoId;
    row._estadoMatricula = row._estadoMatricula || row.estadoMatricula;

    return row;
  }

  function hasStudentChanged(existing, incoming){
    if(!existing){ return true; }

    var existingStatus = text(existing.estadoMatricula).toUpperCase();
    var incomingStatus = text(incoming.estadoMatricula).toUpperCase();

    if(existingStatus === STUDENT_STATUS.retired && incomingStatus === STUDENT_STATUS.active){
      return true;
    }

    return text(existing.dataHash) !== text(incoming.dataHash);
  }

  function mergeStudent(existing, incoming){
    existing = existing || {};
    incoming = incoming || {};

    var merged = Object.assign({}, existing);

    Object.keys(incoming).forEach(function(field){
      if(field === "id"){ return; }
      if(field.charAt(0) === "_"){ return; }

      var value = incoming[field];

      if(field === "estadoMatricula" && text(value).toUpperCase() === STUDENT_STATUS.active){
        merged.estadoMatricula = STUDENT_STATUS.active;
        merged.retirado = false;
        return;
      }

      if(isManualField(field) && existing[field] !== undefined && existing[field] !== null && text(existing[field]) !== ""){
        return;
      }

      merged[field] = clone(value);
    });

    merged.id = incoming.id || existing.id || studentKey(incoming.cedula || existing.cedula, incoming.periodoId || existing.periodoId);
    merged.createdAt = existing.createdAt || incoming.createdAt || nowISO();
    merged.updatedAt = nowISO();
    merged.ultimoPeriodoId = incoming.periodoId || existing.ultimoPeriodoId || existing.periodoId || "";

    return merged;
  }

  function addChange(payload){
    payload = payload || {};

    var row = Object.assign({
      id: "chg_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      tipo: changeTypes.updateStudent || "UPDATE_STUDENT",
      statusGoogle: changeStatus.pending || "PENDIENTE",
      statusFirebase: changeStatus.pending || "PENDIENTE",
      createdAt: nowISO(),
      updatedAt: nowISO()
    }, clone(payload));

    return db.put(STORE.cambios, row).then(function(saved){
      dispatch("bl2:change", saved);
      return saved;
    });
  }

  function saveRequirement(req){
    if(!req || !text(req.cedula) || !text(req.periodoId) || !text(req.key || req.nombre)){
      return Promise.resolve(null);
    }

    req.id = req.id || requirementKey(req.cedula, req.periodoId, req.key || req.nombre);
    req.updatedAt = nowISO();

    return db.put(STORE.requisitos, req);
  }

  function saveContact(contact){
    if(!contact || !text(contact.cedula) || !text(contact.periodoId)){
      return Promise.resolve(null);
    }

    contact.id = contact.id || studentKey(contact.cedula, contact.periodoId);
    contact.updatedAt = nowISO();

    return db.put(STORE.contactos, contact);
  }

  function saveNotes(note){
    if(!note || !text(note.cedula) || !text(note.periodoId)){
      return Promise.resolve(null);
    }

    note.id = note.id || studentKey(note.cedula, note.periodoId);
    note.updatedAt = nowISO();

    return db.put(STORE.notas, note);
  }

  function saveDistributed(student){
    student = student || {};

    var reqs = Array.isArray(student._requirements) ? student._requirements : [];
    var validReqs = reqs.filter(function(req){
      return req && text(req.cedula) && text(req.periodoId) && text(req.key || req.nombre);
    }).map(function(req){
      req = clone(req);
      req.id = req.id || requirementKey(req.cedula, req.periodoId, req.key || req.nombre);
      req.updatedAt = nowISO();
      return req;
    });

    var tasks = [];

    if(validReqs.length){
      tasks.push(db.bulkPut(STORE.requisitos, validReqs));
    }

    tasks.push(saveContact(student._contact));
    tasks.push(saveNotes(student._notes));

    return Promise.all(tasks).then(function(){
      return true;
    });
  }

  function chooseMoreComplete(a, b){
    function score(row){
      row = row || {};
      return Object.keys(row).reduce(function(total, key){
        return total + (text(row[key]) ? 1 : 0);
      }, 0);
    }

    return score(b) >= score(a) ? b : a;
  }

  function updatePeriodCareers(periodoId, carreras, total){
    periodoId = canonicalPeriodId(periodoId);
    carreras = uniqueCareers(carreras || []);

    return db.get(STORE.periodos, periodoId).then(function(period){
      period = normalizePeriod(period || { id:periodoId, label:periodoId });
      period.carrerasDetectadas = uniqueCareers([].concat(period.carrerasDetectadas || [], carreras));
      period.estudiantes = Number(total || period.estudiantes || 0);
      period.totalEstudiantes = period.estudiantes;
      period.updatedAt = nowISO();
      return savePeriod(period);
    });
  }

  function saveSummary(summary){
    summary = summary || {};
    var periodoId = canonicalPeriodId(summary.periodoId || summary.id || "");

    if(!periodoId){
      return Promise.resolve(summary);
    }

    var row = Object.assign({}, summary, {
      id: periodoId,
      periodoId: periodoId,
      updatedAt: nowISO()
    });

    return db.put(STORE.resumen, row).then(function(saved){
      state.lastSummary = saved;
      return saved;
    });
  }

  function getSummary(periodoId){
    periodoId = canonicalPeriodId(periodoId || (state.activePeriod && state.activePeriod.id) || "");

    if(!periodoId){
      return Promise.resolve({
        totalEstudiantes: 0,
        pendientesGoogle: 0,
        pendientesFirebase: 0
      });
    }

    return Promise.all([
      db.queryByIndex(STORE.estudiantes, "periodoId", periodoId).catch(function(){ return []; }),
      db.getAll(STORE.cambios).catch(function(){ return []; }),
      db.get(STORE.resumen, periodoId).catch(function(){ return null; })
    ]).then(function(values){
      var students = values[0] || [];
      var changes = values[1] || [];
      var saved = values[2] || {};

      var active = students.filter(function(row){
        return text(row.estadoMatricula).toUpperCase() !== STUDENT_STATUS.retired;
      }).length;

      var retired = students.length - active;

      var pendingGoogle = changes.filter(function(change){
        return change.periodoId === periodoId && text(change.statusGoogle).toUpperCase() !== "SINCRONIZADO";
      }).length;

      var pendingFirebase = changes.filter(function(change){
        return change.periodoId === periodoId && text(change.statusFirebase).toUpperCase() !== "SINCRONIZADO";
      }).length;

      return Object.assign({}, saved, {
        id: periodoId,
        periodoId: periodoId,
        totalEstudiantes: students.length,
        totalActivos: active,
        totalRetirados: retired,
        pendientesGoogle: pendingGoogle,
        pendientesFirebase: pendingFirebase,
        updatedAt: saved.updatedAt || nowISO()
      });
    });
  }

  function saveStudents(rows, options){
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];

    if(window.BL2Import && typeof window.BL2Import.normalizeRows === "function" && options.normalized !== true){
      return window.BL2Import.normalizeRows(rows, options).then(function(result){
        return saveStudents(result.students || result.rows || [], Object.assign({}, options, {
          normalized: true,
          importResult: result
        }));
      });
    }

    var importResult = options.importResult || {};
    var periodoId = canonicalPeriodId(options.periodoCanonicoId || options.periodoId || importResult.periodoId || "");
    var periodoLabel = text(options.periodoCanonicoLabel || options.periodoLabel || importResult.periodoLabel || periodoId);

    if(!periodoId){
      return Promise.reject(new Error("No hay período seleccionado para guardar."));
    }

    var summary = {
      ok: true,
      periodoId: periodoId,
      periodoLabel: periodoLabel,
      periodoCanonicoId: periodoId,
      periodoCanonicoLabel: periodoLabel,
      totalEntrada: rows.length,
      guardados: 0,
      actualizados: 0,
      sinCambios: 0,
      retirados: 0,
      reactivados: 0,
      duplicados: Number(importResult.duplicados || 0),
      advertencias: Array.isArray(importResult.advertencias) ? importResult.advertencias.slice() : [],
      errores: Array.isArray(importResult.errores) ? importResult.errores.slice() : [],
      changes: [],
      startedAt: nowISO(),
      finishedAt: ""
    };

    return db.get(STORE.periodos, periodoId).then(function(savedPeriod){
      var period = normalizePeriod(savedPeriod || {
        id: periodoId,
        label: periodoLabel
      });

      period.label = periodoLabel || period.label;
      period.periodoLabel = period.label;
      period.periodoCanonicoLabel = period.label;

      var incomingByCedula = {};
      var duplicatedCedulas = {};
      var carreras = [];

      rows.forEach(function(row, index){
        var student = buildStudent(row, options, period);

        if(!student.cedula){
          summary.advertencias.push("Fila " + (index + 1) + ": estudiante sin identificación, no se guardó.");
          return;
        }

        if(student._career){ carreras.push(student._career); }

        if(incomingByCedula[student.cedula]){
          duplicatedCedulas[student.cedula] = true;
          incomingByCedula[student.cedula] = chooseMoreComplete(incomingByCedula[student.cedula], student);
        }else{
          incomingByCedula[student.cedula] = student;
        }
      });

      Object.keys(duplicatedCedulas).forEach(function(){ summary.duplicados += 1; });

      var prepared = Object.keys(incomingByCedula).map(function(cedula){
        return incomingByCedula[cedula];
      });

      return savePeriod(period)
        .then(function(){ return updatePeriodCareers(periodoId, carreras, prepared.length); })
        .then(function(){ return db.queryByIndex(STORE.estudiantes, "periodoId", periodoId).catch(function(){ return []; }); })
        .then(function(existingRows){
          existingRows = existingRows || [];

          var existingById = {};
          existingRows.forEach(function(row){
            existingById[row.id] = row;
          });

          var incomingIds = {};
          prepared.forEach(function(student){
            incomingIds[student.id] = true;
          });

          var chain = Promise.resolve();

          prepared.forEach(function(student){
            chain = chain.then(function(){
              var existing = existingById[student.id];
              var changed = hasStudentChanged(existing, student);
              var wasRetired = existing && text(existing.estadoMatricula).toUpperCase() === STUDENT_STATUS.retired;

              if(!changed){
                summary.sinCambios += 1;
                return saveDistributed(student);
              }

              var merged = mergeStudent(existing, student);

              if(wasRetired){
                summary.reactivados += 1;
              }

              return db.put(STORE.estudiantes, cleanStudentForStore(merged))
                .then(function(){
                  if(existing){ summary.actualizados += 1; }
                  else{ summary.guardados += 1; }

                  return saveDistributed(student);
                })
                .then(function(){
                  var flat = hydrateStudent(merged, student._requirements, student._contact, student._notes);

                  return addChange({
                    tipo: existing ? (changeTypes.updateStudent || "UPDATE_STUDENT") : (changeTypes.importStudent || "IMPORT_STUDENT"),
                    periodoId: periodoId,
                    periodoLabel: periodoLabel,
                    cedula: merged.cedula,
                    studentId: merged.id,
                    action: wasRetired ? "reactivated" : (existing ? "updated" : "created"),
                    data: flat
                  }).then(function(change){
                    summary.changes.push(change);
                  });
                });
            });
          });

          return chain.then(function(){
            if(options.markRetired === false){
              return null;
            }

            var retireChain = Promise.resolve();

            existingRows.forEach(function(existing){
              if(incomingIds[existing.id]){ return; }

              if(text(existing.estadoMatricula).toUpperCase() === STUDENT_STATUS.retired){
                return;
              }

              retireChain = retireChain.then(function(){
                var retired = Object.assign({}, existing, {
                  estadoMatricula: STUDENT_STATUS.retired,
                  retirado: true,
                  retiradoEn: nowISO(),
                  updatedAt: nowISO()
                });

                return db.put(STORE.estudiantes, retired)
                  .then(function(){
                    summary.retirados += 1;

                    return addChange({
                      tipo: changeTypes.updateStudent || "UPDATE_STUDENT",
                      periodoId: periodoId,
                      periodoLabel: periodoLabel,
                      cedula: retired.cedula,
                      studentId: retired.id,
                      action: "retired",
                      data: retired
                    });
                  })
                  .then(function(change){
                    summary.changes.push(change);
                  });
              });
            });

            return retireChain;
          });
        })
        .then(function(){
          summary.finishedAt = nowISO();

          return saveSummary({
            id: periodoId,
            periodoId: periodoId,
            periodoLabel: periodoLabel,
            totalEntrada: summary.totalEntrada,
            totalEstudiantes: prepared.length + summary.retirados,
            guardados: summary.guardados,
            actualizados: summary.actualizados,
            sinCambios: summary.sinCambios,
            retirados: summary.retirados,
            reactivados: summary.reactivados,
            duplicados: summary.duplicados,
            advertencias: summary.advertencias.length,
            errores: summary.errores.length,
            lastImportAt: summary.finishedAt
          });
        })
        .then(function(){
          dispatch("bl2:students-saved", summary);
          dispatch("bdlocal:changes-created", {
            source: "BL2Core.saveStudents",
            periodoId: periodoId,
            periodoLabel: periodoLabel,
            total: summary.changes.length
          });

          if(options.sync !== false){
            dispatch("bdlocal:sync-requested", {
              source: "BL2Core.saveStudents",
              reason: "students_saved",
              periodoId: periodoId,
              periodoLabel: periodoLabel,
              pending: summary.changes.length,
              lowCost: true,
              idleOnly: true,
              batchSize: 50
            });
          }

          return summary;
        });
    });
  }

  function getRequirements(filter){
    filter = filter || {};
    var periodoId = canonicalPeriodId(filter.periodoId || filter.periodId || "");
    var cedula = normalizeCedula(filter.cedula || filter.numeroIdentificacion || "");

    if(periodoId){
      return db.queryByIndex(STORE.requisitos, "periodoId", periodoId).then(function(rows){
        rows = rows || [];
        if(cedula){
          rows = rows.filter(function(row){ return normalizeCedula(row.cedula) === cedula; });
        }
        return rows;
      }).catch(function(){ return []; });
    }

    return db.getAll(STORE.requisitos).then(function(rows){
      rows = rows || [];
      if(cedula){
        rows = rows.filter(function(row){ return normalizeCedula(row.cedula) === cedula; });
      }
      return rows;
    });
  }

  function getContactMap(periodoId){
    return db.queryByIndex(STORE.contactos, "periodoId", periodoId).catch(function(){ return []; }).then(function(rows){
      var map = {};
      (rows || []).forEach(function(row){ map[row.id] = row; });
      return map;
    });
  }

  function getNotesMap(periodoId){
    return db.queryByIndex(STORE.notas, "periodoId", periodoId).catch(function(){ return []; }).then(function(rows){
      var map = {};
      (rows || []).forEach(function(row){ map[row.id] = row; });
      return map;
    });
  }

  function getRequirementsMap(periodoId){
    return db.queryByIndex(STORE.requisitos, "periodoId", periodoId).catch(function(){ return []; }).then(function(rows){
      var map = {};
      (rows || []).forEach(function(row){
        var id = row.studentId || studentKey(row.cedula, row.periodoId);
        if(!map[id]){ map[id] = []; }
        map[id].push(row);
      });
      return map;
    });
  }

  function getStudents(options){
    options = options || {};

    var periodoId = canonicalPeriodId(options.periodoId || options.periodId || "");
    var matricula = text(options.matricula || options.estadoMatricula || "");
    var division = text(options.division || "");
    var career = text(options.career || options.carrera || "");
    var search = normalizeBasic(options.search || options.busqueda || "").toLowerCase();
    var limit = Number(options.limit || 0);

    var basePromise = periodoId
      ? db.queryByIndex(STORE.estudiantes, "periodoId", periodoId).catch(function(){ return []; })
      : db.getAll(STORE.estudiantes);

    return basePromise.then(function(students){
      students = students || [];

      var idsPeriod = periodoId || (students[0] && students[0].periodoId) || "";

      return Promise.all([
        Promise.resolve(students),
        idsPeriod ? getRequirementsMap(idsPeriod) : Promise.resolve({}),
        idsPeriod ? getContactMap(idsPeriod) : Promise.resolve({}),
        idsPeriod ? getNotesMap(idsPeriod) : Promise.resolve({})
      ]);
    }).then(function(values){
      var students = values[0] || [];
      var reqMap = values[1] || {};
      var contactMap = values[2] || {};
      var notesMap = values[3] || {};

      var rows = students.map(function(student){
        return hydrateStudent(student, reqMap[student.id] || [], contactMap[student.id], notesMap[student.id]);
      });

      if(matricula){
        rows = rows.filter(function(row){
          return text(row.estadoMatricula).toUpperCase() === matricula.toUpperCase();
        });
      }

      if(division){
        rows = rows.filter(function(row){
          return text(row.division).toLowerCase() === division.toLowerCase() ||
            (Array.isArray(row.divisiones) && row.divisiones.map(function(x){ return text(x).toLowerCase(); }).indexOf(division.toLowerCase()) >= 0);
        });
      }

      if(career){
        rows = rows.filter(function(row){
          return text(row.NombreCarrera).toLowerCase() === career.toLowerCase() ||
            text(row.CodigoCarrera).toLowerCase() === career.toLowerCase();
        });
      }

      if(search){
        rows = rows.filter(function(row){
          var source = [
            row.cedula,
            row.numeroIdentificacion,
            row.Nombres,
            row.nombres,
            row.NombreCarrera,
            row.CodigoCarrera,
            row.CorreoPersonal,
            row.CorreoInstitucional,
            row.Celular
          ].join(" ").toLowerCase();

          return normalizeBasic(source).toLowerCase().indexOf(search) >= 0;
        });
      }

      rows.sort(function(a, b){
        return text(a.Nombres || a.nombres).localeCompare(text(b.Nombres || b.nombres), "es", { sensitivity:"base" });
      });

      if(limit > 0){
        rows = rows.slice(0, limit);
      }

      return rows;
    });
  }

  function getStudentsByPeriod(periodoId, options){
    return getStudents(Object.assign({}, options || {}, { periodoId:periodoId }));
  }

  function getAllStudents(){
    return getStudents({});
  }

  function getStudentByCedula(cedula, periodoId){
    cedula = normalizeCedula(cedula);
    periodoId = canonicalPeriodId(periodoId || "");

    if(!cedula){
      return Promise.resolve(null);
    }

    if(periodoId){
      return getStudents({ periodoId:periodoId }).then(function(rows){
        return rows.filter(function(row){ return normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula; })[0] || null;
      });
    }

    return getStudents({}).then(function(rows){
      return rows.filter(function(row){ return normalizeCedula(row.cedula || row.numeroIdentificacion) === cedula; })[0] || null;
    });
  }

  function searchStudents(options){
    options = options || {};
    return getStudents(options).then(function(rows){
      return {
        ok: true,
        rows: rows,
        total: rows.length,
        periodList: [],
        source: "BL2Core"
      };
    });
  }

  function updateStudent(id, changes, options){
    options = options || {};
    changes = changes || {};

    if(!text(id)){
      return Promise.reject(new Error("No se puede actualizar estudiante sin id."));
    }

    return db.get(STORE.estudiantes, id).then(function(existing){
      if(!existing){
        throw new Error("No se encontró el estudiante " + id + ".");
      }

      var updated = Object.assign({}, existing, changes, {
        id: existing.id,
        updatedAt: nowISO(),
        ultimaEdicionLocal: nowISO()
      });

      return db.put(STORE.estudiantes, updated).then(function(){
        return addChange({
          tipo: changeTypes.updateStudent || "UPDATE_STUDENT",
          periodoId: updated.periodoId,
          periodoLabel: updated.periodoLabel,
          cedula: updated.cedula,
          studentId: updated.id,
          action: options.action || "manual_update",
          data: updated
        });
      }).then(function(){
        dispatch("bl2:student-updated", updated);
        return updated;
      });
    });
  }

  function getPendingChanges(target){
    target = text(target || "firebase").toLowerCase();

    return db.getAll(STORE.cambios).then(function(rows){
      rows = rows || [];

      return rows.filter(function(row){
        if(target === "google"){
          return text(row.statusGoogle).toUpperCase() !== "SINCRONIZADO";
        }

        return text(row.statusFirebase).toUpperCase() !== "SINCRONIZADO";
      });
    });
  }

  function exportBackup(options){
    options = options || {};
    var payload = {
      ok: true,
      source: "BL2Core",
      exportedAt: nowISO(),
      scope: options.scope || "all",
      tables: {}
    };

    var tableNames = [
      STORE.periodos,
      STORE.estudiantes,
      STORE.requisitos,
      STORE.contactos,
      STORE.notas,
      STORE.cambios,
      STORE.logs,
      STORE.resumen,
      STORE.syncMeta,
      STORE.backups
    ];

    var chain = Promise.resolve();

    tableNames.forEach(function(name){
      chain = chain.then(function(){
        return db.getAll(name).then(function(rows){
          payload.tables[name] = rows || [];
        });
      });
    });

    return chain.then(function(){
      return payload;
    });
  }

  function importBackup(payload, options){
    payload = payload || {};
    options = options || {};

    var tables = payload.tables || {};
    var names = Object.keys(tables);
    var imported = 0;
    var chain = Promise.resolve();

    names.forEach(function(name){
      chain = chain.then(function(){
        var rows = Array.isArray(tables[name]) ? tables[name] : [];

        if(options.clearBeforeImport){
          return db.clear(name).then(function(){
            return db.bulkPut(name, rows);
          }).then(function(saved){
            imported += saved.length;
          });
        }

        return db.bulkPut(name, rows).then(function(saved){
          imported += saved.length;
        });
      });
    });

    return chain.then(function(){
      return {
        ok: true,
        imported: imported,
        tables: names.length,
        importedAt: nowISO()
      };
    });
  }

  function compareRecords(local, remote){
    local = local || {};
    remote = remote || {};

    var localUpdated = new Date(local.updatedAt || local.ultimaEdicionLocal || 0).getTime();
    var remoteUpdated = new Date(remote.updatedAt || remote.ultimaSincronizacion || 0).getTime();

    if(!Number.isFinite(localUpdated)){ localUpdated = 0; }
    if(!Number.isFinite(remoteUpdated)){ remoteUpdated = 0; }

    if(localUpdated > remoteUpdated){ return "local"; }
    if(remoteUpdated > localUpdated){ return "remote"; }

    var localHash = dataHash(local);
    var remoteHash = dataHash(remote);

    return localHash === remoteHash ? "equal" : "different";
  }

  function getRawTable(name){
    return db.getAll(name);
  }

  function correctPeriodDuplicates(options){
    options = options || {};

    return db.getAll(STORE.periodos).then(function(periods){
      periods = periods || [];

      var groups = {};
      periods.forEach(function(period){
        var normalized = normalizePeriod(period);
        if(!normalized){ return; }

        var id = normalized.id;
        if(!groups[id]){ groups[id] = []; }
        groups[id].push(period);
      });

      var removed = 0;
      var chain = Promise.resolve();

      Object.keys(groups).forEach(function(id){
        var group = groups[id];
        if(group.length <= 1){
          return;
        }

        var canonical = group.map(normalizePeriod).filter(Boolean).filter(function(item){
          return text(item.id).indexOf("__") >= 0;
        })[0] || normalizePeriod(group[0]);

        canonical.estadoDepuracion = "OK";
        canonical.requiereRevision = false;
        canonical.periodoCanonicoId = canonical.id;
        canonical.periodoCanonicoLabel = canonical.label;

        chain = chain.then(function(){
          return db.put(STORE.periodos, canonical);
        }).then(function(){
          var deleteChain = Promise.resolve();

          group.forEach(function(original){
            var originalId = text(original.id || original.periodoId || "");
            if(originalId && originalId !== canonical.id){
              deleteChain = deleteChain.then(function(){
                removed += 1;
                return db.remove(STORE.periodos, originalId).catch(function(){ return false; });
              });
            }
          });

          return deleteChain;
        });
      });

      return chain.then(function(){
        if(!options.silent){
          log("INFO", "Corrección de períodos duplicados finalizada.", { removed:removed });
        }

        return {
          ok: true,
          removed: removed
        };
      });
    });
  }

  window.BL2Core = {
    init: init,
    getState: getState,
    log: log,
    addChange: addChange,

    getPeriods: getPeriods,
    listarPeriodos: getPeriods,
    periodos: getPeriods,
    savePeriod: savePeriod,
    guardarPeriodo: savePeriod,
    correctPeriodDuplicates: correctPeriodDuplicates,

    getActivePeriod: getActivePeriod,
    setActivePeriod: setActivePeriod,

    saveStudents: saveStudents,
    guardarEstudiantes: saveStudents,

    getStudents: getStudents,
    getAllStudents: getAllStudents,
    getStudentsByPeriod: getStudentsByPeriod,
    listarEstudiantes: getStudents,
    obtenerEstudiantes: getStudents,
    estudiantes: getStudents,

    getStudentByCedula: getStudentByCedula,
    buscarPorCedula: getStudentByCedula,
    buscarEstudiante: getStudentByCedula,
    searchStudents: searchStudents,
    buscar: searchStudents,

    updateStudent: updateStudent,
    actualizarEstudiante: updateStudent,

    getRequirements: getRequirements,
    obtenerRequisitos: getRequirements,

    saveSummary: saveSummary,
    getSummary: getSummary,
    resumen: getSummary,

    getPendingChanges: getPendingChanges,

    exportBackup: exportBackup,
    importBackup: importBackup,

    compareRecords: compareRecords,
    getRawTable: getRawTable,

    helpers: {
      normalizeCedula: normalizeCedula,
      canonicalPeriodId: canonicalPeriodId,
      normalizePeriod: normalizePeriod,
      studentKey: studentKey,
      requirementKey: requirementKey,
      hydrateStudent: hydrateStudent,
      dataHash: dataHash
    }
  };
})(window);