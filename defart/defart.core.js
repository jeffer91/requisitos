/* =========================================================
Nombre completo: defart.core.js
Ruta o ubicación: /Requisitos/defart/defart.core.js
Función o funciones:
- Leer estudiantes activos desde BL2DataEngine y usar ExcelLocalRepo como respaldo.
- Normalizar campos reales de Firebase/Base Local para Defensas.
- Filtrar por período, división, carrera, estado, sede y búsqueda.
- Habilitar N-ART según requisitos aplicables cumplidos con regla PVC/Regular.
- No exigir Titulación para PVC.
- Habilitar N-DEF solo si N-ART es igual o mayor a 7.
- Guardar Notart, Notdef, Notafinal y alias nart/ndef/nfin en BaseLocal.
- Calcular N-FIN con fórmula institucional: (N-ART * 0.70) + (N-DEF * 0.30).
- Leer requisitos aunque vengan con mayúsculas, tildes, espacios, nombres de Ficha o claves de BDLocal.
Con qué se conecta:
- ../BDLocal/adapters/bdl.screen-deps.js
- defart.app.js
- defart.table.js
- defart.continuity.js
- defart.export.js
========================================================= */
(function (window) {
  "use strict";

  var VERSION = "2.0.1-defart-core.requirements-fix";

  var STATES = [
    "Sin requisitos",
    "Pendiente Art",
    "Supletorio Art",
    "Pendiente Def",
    "Supletorio Def",
    "Completo"
  ];

  var FALLBACK_REQUIREMENTS = [
    {
      key: "academico",
      canonical: "Academico",
      label: "Académico",
      aliases: ["Academico", "Académico", "academico", "Académico cumple", "Academico cumple"]
    },
    {
      key: "documentacion",
      canonical: "Documentacion",
      label: "Documentación",
      aliases: ["Documentacion", "Documentación", "documentacion", "Documentos", "Documentos completos"]
    },
    {
      key: "financiero",
      canonical: "Financiero",
      label: "Financiero",
      aliases: ["Financiero", "financiero", "Pago", "Pagos", "Estado financiero"]
    },
    {
      key: "practicasvinculacion",
      canonical: "PrácticasVinculacion",
      label: "Prácticas",
      aliases: [
        "PracticasVinculacion",
        "PrácticasVinculacion",
        "PrácticasVinculación",
        "Practicas",
        "Prácticas",
        "Practicas / Vinculacion",
        "Prácticas / Vinculación",
        "Prácticas Vinculación"
      ]
    },
    {
      key: "vinculacion",
      canonical: "Vinculacion",
      label: "Vinculación",
      aliases: ["Vinculacion", "Vinculación", "vinculacion"]
    },
    {
      key: "seguimientograduados",
      canonical: "SeguimientoGraduados",
      label: "Seguimiento graduados",
      aliases: [
        "SeguimientoGraduados",
        "Seguimiento graduados",
        "Seguimiento a graduados",
        "SeguimientoGraduado",
        "Seguimiento"
      ]
    },
    {
      key: "ingles",
      canonical: "Ingles",
      label: "Inglés",
      aliases: ["Ingles", "Inglés", "ingles", "Idioma Ingles", "Idioma Inglés"]
    },
    {
      key: "actualizaciondatos",
      canonical: "ActualizaciónDatos",
      label: "Actualización de datos",
      aliases: [
        "ActualizaciónDatos",
        "ActualizacionDatos",
        "Actualización de datos",
        "Actualizacion de datos",
        "Actualización datos",
        "Actualizacion datos"
      ]
    }
  ];

  var OK_VALUES = [
    "cumple",
    "aprobado",
    "aprobada",
    "si",
    "sí",
    "ok",
    "1",
    "true",
    "validado",
    "validada",
    "completo",
    "completa"
  ];

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function now() {
    return new Date().toISOString();
  }

  function norm(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function keyNorm(value) {
    return norm(value).replace(/[^a-z0-9]+/g, "");
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value === null || value === undefined ? null : value));
    } catch (error) {
      return value;
    }
  }

  function notasService() {
    return window.BLNotasDefensa || null;
  }

  function dataEngine() {
    return window.BL2DataEngine || null;
  }

  function normalizer() {
    return window.BL2StudentNormalizer || null;
  }

  function reqEngine() {
    return window.BL2RequirementsEngine || window.StatsRules || null;
  }

  function repo() {
    if (!window.ExcelLocalRepo) {
      throw new Error("ExcelLocalRepo no disponible. Primero abre BL o Carga para inicializar BaseLocal.");
    }
    return window.ExcelLocalRepo;
  }

  function storage() {
    return window.ExcelLocalStorage && typeof window.ExcelLocalStorage.readSnapshot === "function"
      ? window.ExcelLocalStorage
      : null;
  }

  function getSnapshot() {
    if (storage()) return storage().readSnapshot();
    if (repo().getSnapshot) return repo().getSnapshot();
    return { periods: [], students: [], history: [], meta: {} };
  }

  function invalidateCaches() {
    try { if (dataEngine() && typeof dataEngine().invalidate === "function") dataEngine().invalidate(); } catch (error) {}
    try { if (window.BL2 && typeof window.BL2.invalidate === "function") window.BL2.invalidate({ emit: false, source: "defart" }); } catch (error) {}
    try { if (window.BL2LegacyAdapter && typeof window.BL2LegacyAdapter.invalidate === "function") window.BL2LegacyAdapter.invalidate(); } catch (error) {}
    try { if (window.FichaCore && typeof window.FichaCore.invalidate === "function") window.FichaCore.invalidate(); } catch (error) {}
    try { if (window.BL2CacheResumen && typeof window.BL2CacheResumen.invalidate === "function") window.BL2CacheResumen.invalidate(); } catch (error) {}
    try {
      window.localStorage.setItem("REQ_BL_SIGNAL_V1", JSON.stringify({
        type: "defensas-notas-saved",
        source: "defart.core",
        updatedAt: now()
      }));
    } catch (error) {}
  }

  function writeSnapshot(snapshot) {
    var saved = storage() && typeof storage().writeSnapshot === "function"
      ? storage().writeSnapshot(snapshot)
      : snapshot;

    try {
      if (window.RequisitosBL && typeof window.RequisitosBL.mirrorSnapshotToCollections === "function") {
        window.RequisitosBL.mirrorSnapshotToCollections({ force: true, silent: true });
        window.RequisitosBL.notificar("snapshot-changed", { source: "defart.core", updatedAt: now() });
      }
    } catch (error) {}

    invalidateCaches();
    return saved;
  }

  function backupSnapshot(snapshot, reason) {
    try {
      window.localStorage.setItem("REQ_DEFART_BACKUP_V1:" + Date.now(), JSON.stringify({
        reason: reason || "before_save",
        createdAt: now(),
        snapshot: clone(snapshot)
      }));
    } catch (error) {}
  }

  function normalizeRow(row) {
    return normalizer() && typeof normalizer().normalize === "function"
      ? normalizer().normalize(row || {}, { clone: false })
      : Object.assign({}, row || {});
  }

  function rawStudents() {
    try {
      if (dataEngine() && typeof dataEngine().listStudents === "function") {
        var result = dataEngine().listStudents({ matricula: "ACTIVO", limit: 0 });
        return result && Array.isArray(result.rows) ? result.rows : [];
      }
    } catch (error) {}

    return repo().listAllStudents ? repo().listAllStudents() : (getSnapshot().students || []);
  }

  function rawPeriods() {
    try {
      if (dataEngine() && typeof dataEngine().listPeriods === "function") return dataEngine().listPeriods() || [];
    } catch (error) {}

    return repo().listPeriods ? repo().listPeriods() : (getSnapshot().periods || []);
  }

  function pick(row, names) {
    row = row || {};
    for (var i = 0; i < names.length; i += 1) {
      if (text(row[names[i]]) !== "") return row[names[i]];
    }
    return "";
  }

  function noteString(value) {
    return text(value).replace(",", ".");
  }

  function numberValue(value) {
    if (notasService() && typeof notasService().normalizarNota === "function") {
      return notasService().normalizarNota(value);
    }
    if (value === null || value === undefined || text(value) === "") return null;
    var num = Number(noteString(value));
    return Number.isFinite(num) ? num : null;
  }

  function round2(value) {
    if (notasService() && typeof notasService().redondear2 === "function") return notasService().redondear2(value);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }

  function noteToText(value) {
    if (notasService() && typeof notasService().formatearNota === "function") return notasService().formatearNota(value);
    var num = numberValue(value);
    return num === null ? "" : String(round2(num));
  }

  function hasMaxTwoDecimals(value) {
    var raw = noteString(value);
    if (!raw) return true;
    return /^\d{1,2}(\.\d{0,2})?$|^10(\.0{0,2})?$|^0(\.\d{0,2})?$/.test(raw);
  }

  function isValidNote(value) {
    if (notasService() && typeof notasService().validarNota === "function") return notasService().validarNota(value);
    if (text(value) === "") return true;
    var num = numberValue(value);
    return num !== null && num >= 0 && num <= 10 && hasMaxTwoDecimals(value);
  }

  function buildFlatKeyMap(row) {
    var map = {};
    row = row || {};

    Object.keys(row).forEach(function (key) {
      var normalized = keyNorm(key);
      if (normalized && !Object.prototype.hasOwnProperty.call(map, normalized)) {
        map[normalized] = row[key];
      }
    });

    var nestedCandidates = [
      row.requisitos,
      row.requirements,
      row._requirements,
      row._requirementValues,
      row.requirementValues,
      row.carga,
      row.Carga
    ];

    nestedCandidates.forEach(function (candidate) {
      if (!candidate) return;

      if (Array.isArray(candidate)) {
        candidate.forEach(function (item) {
          if (!item) return;
          var k = item.key || item.campo || item.nombre || item.label || item.requisitoKey || item.requisitoNombre;
          var v = item.estado || item.valor || item.value || item.status || item.cumple;
          if (k) map[keyNorm(k)] = v;
        });
        return;
      }

      if (typeof candidate === "object") {
        Object.keys(candidate).forEach(function (key) {
          map[keyNorm(key)] = candidate[key];
        });
      }
    });

    return map;
  }

  function lookupOwnRequirement(row, req) {
    row = row || {};
    req = req || {};

    var aliases = [];
    aliases.push(req.key || "");
    aliases.push(req.canonical || "");
    aliases.push(req.label || "");
    (req.aliases || []).forEach(function (alias) { aliases.push(alias); });

    for (var i = 0; i < aliases.length; i += 1) {
      var direct = aliases[i];
      if (direct && text(row[direct]) !== "") return row[direct];
    }

    var map = buildFlatKeyMap(row);
    for (var j = 0; j < aliases.length; j += 1) {
      var normalized = keyNorm(aliases[j]);
      if (normalized && text(map[normalized]) !== "") return map[normalized];
    }

    return "";
  }

  function valueOf(row, reqOrKey) {
    var req = typeof reqOrKey === "object" ? reqOrKey : { key: reqOrKey, aliases: [reqOrKey] };
    var own = lookupOwnRequirement(row, req);
    if (text(own) !== "") return own;

    try {
      if (reqEngine() && typeof reqEngine().valueOf === "function") {
        var engineValue = reqEngine().valueOf(row || {}, req.key);
        if (text(engineValue) !== "") return engineValue;
      }
    } catch (error) {}

    return "";
  }

  function isOkValue(value) {
    return OK_VALUES.indexOf(norm(value)) >= 0;
  }

  function requirementOk(row, req) {
    var own = valueOf(row, req);
    if (text(own) !== "") return isOkValue(own);

    try {
      if (reqEngine() && typeof reqEngine().requirementStatus === "function") {
        var st = reqEngine().requirementStatus(row || {}, req.key);
        return st && (st.applies === false || st.cumple === true);
      }
    } catch (error) {}

    return false;
  }

  function normalizeEngineRequirement(req) {
    req = req || {};
    var key = text(req.key || req.id || req.campo || req.nombre || req.label);
    var match = FALLBACK_REQUIREMENTS.filter(function (item) {
      return keyNorm(item.key) === keyNorm(key) ||
        keyNorm(item.canonical) === keyNorm(key) ||
        keyNorm(item.label) === keyNorm(key) ||
        (item.aliases || []).some(function (alias) { return keyNorm(alias) === keyNorm(key); });
    })[0];

    if (match) return match;

    return {
      key: key || "requisito",
      canonical: key || "requisito",
      label: text(req.label || req.nombre || key || "Requisito"),
      aliases: [key, req.label, req.nombre].filter(Boolean)
    };
  }

  function applicableRequirements(row) {
    try {
      if (reqEngine() && typeof reqEngine().requirementsForStudent === "function") {
        var engineList = reqEngine().requirementsForStudent(row || {});
        if (Array.isArray(engineList) && engineList.length) {
          return engineList.map(normalizeEngineRequirement).filter(function (req) {
            return keyNorm(req.key) !== "titulacion";
          });
        }
      }
    } catch (error) {}

    return FALLBACK_REQUIREMENTS.slice();
  }

  function requirementSummary(row) {
    var missing = [];
    var values = {};
    var list = applicableRequirements(row);

    list.forEach(function (req) {
      var value = text(valueOf(row, req));
      values[req.canonical || req.key] = value;
      if (!requirementOk(row, req)) missing.push(req.label);
    });

    return {
      ok: missing.length === 0,
      missing: missing,
      values: values,
      total: list.length
    };
  }

  function isActive(row) {
    var value = norm(row && row._bl2EstadoMatricula || pick(row, ["estadoMatricula", "EstadoMatricula", "estado", "Estado"]));
    if (!value) return true;
    return value === "activo";
  }

  function studentId(row, index) {
    return text(row && row._bl2Id || pick(row, [
      "_docId", "docId", "cedula", "Cedula", "CEDULA", "numeroIdentificacion", "numeroidentificacion", "NumeroIdentificacion", "identificacion", "Identificacion"
    ])) || ("fila_" + index);
  }

  function periodId(row) {
    return text(row && row._bl2PeriodoId || pick(row, ["periodoId", "ultimoPeriodoId", "periodId", "PeriodoId", "periodo", "Periodo"]));
  }

  function periodLabel(row) {
    return text(row && row._bl2Periodo || pick(row, ["periodoLabel", "PeriodoLabel", "periodo", "Periodo"])) || periodId(row) || "Sin período";
  }

  function samePeriod(a, b) {
    if (!text(b)) return true;
    if (window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function") return window.BLPeriodosCanon.samePeriod(a, b);
    return text(a) === text(b) || norm(a) === norm(b);
  }

  function divisionOf(row) {
    if (row && row._bl2Division) return row._bl2Division;
    if (window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function") return window.BLDivisionesService.studentDivision(row);
    var list = Array.isArray(row && row.divisiones) ? row.divisiones : [];
    return list[0] || row.division || row.Division || row.División || "Sin división";
  }

  function hasDivision(row, division) {
    if (!text(division)) return true;
    if (window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function") return window.BLDivisionesService.hasDivision(row, division);
    return norm(divisionOf(row)) === norm(division);
  }

  function calculateFinal(nart, ndef) {
    if (notasService() && typeof notasService().calcularNfin === "function") return notasService().calcularNfin(nart, ndef);
    if (nart === null || ndef === null) return null;
    if (nart < 7) return null;
    return round2((nart * 0.70) + (ndef * 0.30));
  }

  function notesOf(row) {
    if (notasService() && typeof notasService().extraerNotas === "function") return notasService().extraerNotas(row);

    var nart = numberValue(pick(row, ["Notart", "Nart", "N_ART", "N-ART", "notart", "notaArticulo", "nota_articulo"]));
    var ndef = numberValue(pick(row, ["Notdef", "Ndef", "N_DEF", "N-DEF", "notdef", "notaDefensa", "nota_defensa"]));
    var nfin = numberValue(pick(row, ["Notafinal", "NotaFinal", "Nfin", "nfin", "N_FIN", "N-FIN", "notaFinal"]));

    if (nfin === null) nfin = calculateFinal(nart, ndef);
    return { nart: nart, ndef: ndef, nfin: nfin };
  }

  function applyNotesPatch(nart, ndef, options) {
    if (notasService() && typeof notasService().aplicarNotas === "function") {
      return notasService().aplicarNotas({}, nart, ndef, options || {});
    }

    var updatedAt = options && options.updatedAt ? options.updatedAt : now();
    var fin = calculateFinal(nart, ndef);

    return {
      Notart: nart,
      Notdef: ndef,
      Notafinal: fin,
      Nart: nart,
      Ndef: ndef,
      Nfin: fin,
      nart: nart,
      ndef: ndef,
      nfin: fin,
      notaArticulo: nart,
      notaDefensa: ndef,
      notaFinal: fin,
      ultimaEdicionLocal: updatedAt,
      updatedAt: updatedAt,
      notasDefensaActualizadasEn: updatedAt,
      notasDefensaOrigen: options && options.origen || "defensas"
    };
  }

  function decorate(row, index) {
    var source = normalizeRow(row || {});
    var req = requirementSummary(source);
    var notes = notesOf(source);
    var nart = notes.nart;
    var ndef = notes.ndef;
    var canArt = req.ok;
    var canDef = canArt && nart !== null && nart >= 7;
    var nfin = canDef ? calculateFinal(nart, ndef) : null;
    var estado = "Pendiente Art";

    if (!canArt) estado = "Sin requisitos";
    else if (nart === null) estado = "Pendiente Art";
    else if (nart < 7) estado = "Supletorio Art";
    else if (ndef === null) estado = "Pendiente Def";
    else if (ndef < 7) estado = "Supletorio Def";
    else estado = "Completo";

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

    return source;
  }

  function preview(row, patch) {
    var next = Object.assign({}, row || {});
    patch = patch || {};
    if (Object.prototype.hasOwnProperty.call(patch, "nart")) next.Notart = numberValue(patch.nart);
    if (Object.prototype.hasOwnProperty.call(patch, "ndef")) next.Notdef = numberValue(patch.ndef);
    return decorate(next, 0);
  }

  function unique(list, getter) {
    var map = {};
    (list || []).forEach(function (item) {
      var value = text(getter(item));
      if (value) map[value] = true;
    });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, "es"); });
  }

  function periodOptions(rows) {
    var map = {};

    rawPeriods().forEach(function (period) {
      var p = window.BLPeriodosCanon && typeof window.BLPeriodosCanon.normalizePeriod === "function"
        ? window.BLPeriodosCanon.normalizePeriod(period)
        : period;
      var id = text(p && (p.id || p.periodoId || p.value));
      if (id) map[id] = { id: id, label: text(p.label || p.periodoLabel || id) };
    });

    rows.forEach(function (row) {
      if (row._periodoId && !map[row._periodoId]) {
        map[row._periodoId] = { id: row._periodoId, label: row._periodoLabel || row._periodoId };
      }
    });

    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
      return String(a.label || a.id).localeCompare(String(b.label || b.id), "es");
    });
  }

  function compareValues(a, b, key) {
    var av = a[key];
    var bv = b[key];

    if (key === "_nart" || key === "_ndef" || key === "_nfin") {
      av = av === null ? -1 : av;
      bv = bv === null ? -1 : bv;
      return av - bv;
    }

    return String(av === null || av === undefined ? "" : av).localeCompare(
      String(bv === null || bv === undefined ? "" : bv),
      "es",
      { numeric: true, sensitivity: "base" }
    );
  }

  function filterRows(options) {
    options = options || {};
    var q = norm(options.search || "");
    var rows = rawStudents().filter(isActive).map(decorate).filter(function (row) {
      if (options.periodId && !samePeriod(row._periodoId, options.periodId)) return false;
      if (options.division && !hasDivision(row, options.division)) return false;
      if (options.career && row._carrera !== options.career) return false;
      if (options.status && row._estadoDefensa !== options.status) return false;
      if (options.sede && row._sede !== options.sede) return false;
      if (q) {
        var hay = norm([row._cedula, row._nombre, row._carrera, row._division, row._sede, row._periodoLabel].join(" "));
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var sortKey = options.sortKey || "_nombre";
    var sortDir = options.sortDir === "desc" ? -1 : 1;
    rows.sort(function (a, b) { return compareValues(a, b, sortKey) * sortDir; });
    return rows;
  }

  function kpis(rows) {
    var result = { total: rows.length };
    STATES.forEach(function (state) { result[state] = 0; });
    rows.forEach(function (row) {
      result[row._estadoDefensa] = (result[row._estadoDefensa] || 0) + 1;
    });
    return result;
  }

  function diagnosticsFromRows(allActive, rows, options) {
    var notes = { withNart: 0, withNdef: 0, withNfin: 0 };
    var withoutRequirements = 0;
    var sampleMissing = [];

    allActive.forEach(function (row) {
      if (row._nart !== null) notes.withNart += 1;
      if (row._ndef !== null) notes.withNdef += 1;
      if (row._nfin !== null) notes.withNfin += 1;
      if (row._estadoDefensa === "Sin requisitos") {
        withoutRequirements += 1;
        if (sampleMissing.length < 5) {
          sampleMissing.push({ cedula: row._cedula, nombre: row._nombre, missing: row._missingRequirements, values: row._requirementValues });
        }
      }
    });

    var connectorCounts = null;
    try {
      if (window.RequisitosBL && typeof window.RequisitosBL.conteos === "function") connectorCounts = window.RequisitosBL.conteos();
    } catch (error) {}

    return {
      ok: true,
      generatedAt: now(),
      version: VERSION,
      source: dataEngine() ? "BL2DataEngine" : "BaseLocal",
      totalActive: allActive.length,
      visible: rows.length,
      notes: notes,
      withoutRequirements: withoutRequirements,
      sampleMissing: sampleMissing,
      formula: "NFIN=(NART*0.70)+(NDEF*0.30)",
      filters: options || {},
      connections: {
        excelLocalRepo: !!window.ExcelLocalRepo,
        excelLocalStorage: !!window.ExcelLocalStorage,
        requisitosBL: !!window.RequisitosBL,
        baseLocalBridge: !!window.BaseLocalBridge,
        notasDefensa: !!window.BLNotasDefensa,
        exportExcel: !!window.DefartExport,
        bl2DataEngine: !!dataEngine(),
        blCounts: connectorCounts
      }
    };
  }

  function summary(options) {
    options = options || {};
    var allActive = rawStudents().filter(isActive).map(decorate);
    var rows = filterRows(options);
    var baseForDivision = allActive.filter(function (row) { return !options.periodId || samePeriod(row._periodoId, options.periodId); });
    var baseForCareer = baseForDivision.filter(function (row) { return !options.division || hasDivision(row, options.division); });

    return {
      rows: rows,
      kpis: kpis(rows),
      periodList: periodOptions(allActive),
      divisionList: window.BLDivisionesService && window.BLDivisionesService.listDivisionsWithEmpty
        ? window.BLDivisionesService.listDivisionsWithEmpty(baseForDivision, "")
        : unique(baseForDivision, function (row) { return row._division; }),
      careerList: unique(baseForCareer, function (row) { return row._carrera; }),
      sedeList: unique(rows.length ? rows : baseForCareer, function (row) { return row._sede; }),
      states: STATES.slice(),
      diagnostics: diagnosticsFromRows(allActive, rows, options)
    };
  }

  function findStudentIndex(students, id) {
    id = text(id);
    for (var i = 0; i < students.length; i += 1) {
      var decorated = decorate(students[i], i);
      if (studentId(students[i], i) === id || decorated._defId === id || decorated._cedula === id) return i;
    }
    return -1;
  }

  function normalizePatch(patch) {
    var out = {};
    if (Object.prototype.hasOwnProperty.call(patch, "nart")) out.Notart = numberValue(patch.nart);
    if (Object.prototype.hasOwnProperty.call(patch, "ndef")) out.Notdef = numberValue(patch.ndef);
    return out;
  }

  function validateChange(current, change, patch, nart, ndef) {
    var errors = [];
    if (Object.prototype.hasOwnProperty.call(change, "nart") && !isValidNote(change.nart)) errors.push("N-ART inválida: " + current._nombre);
    if (Object.prototype.hasOwnProperty.call(change, "ndef") && !isValidNote(change.ndef)) errors.push("N-DEF inválida: " + current._nombre);
    if (Object.prototype.hasOwnProperty.call(change, "nart") && !current._canArt) errors.push("N-ART bloqueada por requisitos aplicables: " + current._nombre + " · Falta: " + current._missingRequirements.join(", "));
    if (Object.prototype.hasOwnProperty.call(change, "ndef") && (!current._canArt || nart === null || nart < 7)) errors.push("N-DEF bloqueada hasta que N-ART sea 7 o más: " + current._nombre);
    if (nart !== null && (nart < 0 || nart > 10)) errors.push("N-ART fuera de rango: " + current._nombre);
    if (ndef !== null && (ndef < 0 || ndef > 10)) errors.push("N-DEF fuera de rango: " + current._nombre);
    return errors;
  }

  function saveNotes(changes) {
    changes = Array.isArray(changes) ? changes : [];
    if (!changes.length) return { ok: true, saved: 0, total: 0, message: "No hay cambios pendientes." };

    var snapshot = getSnapshot();
    snapshot.students = Array.isArray(snapshot.students) ? snapshot.students : [];
    snapshot.history = Array.isArray(snapshot.history) ? snapshot.history : [];
    backupSnapshot(snapshot, "before_defensas_save");

    var saved = 0;
    var errors = [];
    var savedPeriodMap = {};
    var savedIds = [];

    changes.forEach(function (change) {
      var index = findStudentIndex(snapshot.students, change.id);
      if (index < 0) {
        errors.push("No encontrado: " + change.id);
        return;
      }

      var current = decorate(snapshot.students[index], index);
      var patch = normalizePatch(change);
      var nart = Object.prototype.hasOwnProperty.call(patch, "Notart") ? patch.Notart : current._nart;
      var ndef = Object.prototype.hasOwnProperty.call(patch, "Notdef") ? patch.Notdef : current._ndef;
      var validationErrors = validateChange(current, change, patch, nart, ndef);

      if (validationErrors.length) {
        errors = errors.concat(validationErrors);
        return;
      }

      var updatedAt = now();
      var notePatch = applyNotesPatch(nart, ndef, { updatedAt: updatedAt, origen: "defensas" });
      patch = Object.assign({}, patch, notePatch);
      snapshot.students[index] = Object.assign({}, snapshot.students[index], patch);

      if (current._periodoId) savedPeriodMap[current._periodoId] = true;
      savedIds.push(current._cedula || change.id);
      saved += 1;
    });

    if (saved > 0) {
      var periodIds = Object.keys(savedPeriodMap);
      snapshot.meta = Object.assign({}, snapshot.meta || {}, {
        updatedAt: now(),
        lastDefensasUpdateAt: now(),
        lastDefensasSaved: saved,
        lastDefensasPeriodos: periodIds,
        lastDefensasFormula: "NFIN=(NART*0.70)+(NDEF*0.30)"
      });
      snapshot.history.unshift({
        id: "defensas_notas_" + Date.now(),
        action: "guardarNotasDefensas",
        periodoId: periodIds.length === 1 ? periodIds[0] : "VARIOS",
        periodoLabel: periodIds.length === 1 ? periodIds[0] : "Varios",
        fileName: "Defensas",
        totalRows: saved,
        errores: errors.length,
        formula: "NFIN=(NART*0.70)+(NDEF*0.30)",
        ids: savedIds,
        createdAt: now()
      });
      writeSnapshot(snapshot);
    }

    return {
      ok: errors.length === 0,
      saved: saved,
      total: changes.length,
      errors: errors,
      message: saved + " cambio(s) guardado(s) en BaseLocal."
    };
  }

  function selfTest() {
    var result = { ok: true, checkedAt: now(), version: VERSION, checks: [] };
    function check(name, ok, detail) {
      result.checks.push({ name: name, ok: !!ok, detail: detail || "" });
      if (!ok) result.ok = false;
    }

    var snap = null;
    try { snap = getSnapshot(); check("BaseLocal snapshot", true, "Snapshot leído"); } catch (error) { check("BaseLocal snapshot", false, error.message || String(error)); }
    check("ExcelLocalRepo", !!window.ExcelLocalRepo, "Repositorio local");
    check("ExcelLocalStorage", !!window.ExcelLocalStorage, "Storage local");
    check("BL2DataEngine", !!dataEngine(), "Motor central");
    check("BL2RequirementsEngine", !!reqEngine(), "Reglas PVC/Regular");
    check("RequisitosBL", !!window.RequisitosBL, "Conector BL");
    check("BLDivisionesService", !!window.BLDivisionesService, "Divisiones");
    check("BLNotasDefensa", !!window.BLNotasDefensa, "Servicio central de notas");
    check("DefartExport", !!window.DefartExport, "Exportación Excel");
    check("Formula NFIN", calculateFinal(10, 8.75) === 9.63, "10 y 8.75 deben dar 9.63");

    var fake = {
      "Académico": "CUMPLE",
      "Documentación": "CUMPLE",
      "Financiero": "CUMPLE",
      "Prácticas": "CUMPLE",
      "Vinculación": "CUMPLE",
      "Seguimiento graduados": "CUMPLE",
      "Inglés": "CUMPLE",
      "Actualización de datos": "CUMPLE"
    };
    check("Requisitos Ficha", requirementSummary(fake).ok, "Debe reconocer nombres visibles de Ficha");

    if (snap) {
      check("Estudiantes", Array.isArray(snap.students), (snap.students || []).length + " registros");
      check("Períodos", Array.isArray(snap.periods), (snap.periods || []).length + " períodos");
    }

    result.message = result.ok ? "Diagnóstico correcto." : "Hay puntos por revisar.";
    return result;
  }

  window.DefartCore = {
    summary: summary,
    saveNotes: saveNotes,
    decorate: decorate,
    preview: preview,
    noteToText: noteToText,
    isValidNote: isValidNote,
    calculateFinal: calculateFinal,
    selfTest: selfTest,
    requirements: FALLBACK_REQUIREMENTS.slice(),
    states: STATES.slice(),
    divisionOf: divisionOf,
    requirementSummary: requirementSummary,
    valueOf: valueOf
  };
})(window);
