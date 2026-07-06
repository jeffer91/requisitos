/* =========================================================
Archivo: bl2.config.js
Ruta: /BDLocal/bl2.config.js
Función:
- Configuración general de BL2.
- Define IndexedDB, tablas, sincronización, períodos,
  campos manuales protegidos, requisitos y estructura Google Sheets.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0";

  var DB_NAME = "REQUISITOS_BL2";
  var DB_VERSION = 1;

  var STORE_NAMES = {
    settings: "settings",
    periodos: "periodos",
    estudiantes: "estudiantes",
    requisitos: "requisitos",
    contactos: "contactos",
    notas: "notas",
    cambios: "cambios",
    logs: "logs",
    resumen: "resumen",
    errores: "errores",
    syncMeta: "sync_meta",
    backups: "backups"
  };

  var SHEET_NAMES = {
    periodos: "periodos",
    estudiantes: "estudiantes",
    requisitos: "requisitos",
    contactos: "contactos",
    notas: "notas",
    cambios: "cambios",
    logs: "logs",
    resumen: "resumen",
    errores: "errores",
    syncMeta: "sync_meta"
  };

  var SETTINGS_KEYS = {
    activePeriodId: "activePeriodId",
    activePeriodLabel: "activePeriodLabel",
    lastExcelBackupAt: "lastExcelBackupAt",
    lastDailyBackupAt: "lastDailyBackupAt",
    lastGoogleSyncAt: "lastGoogleSyncAt",
    lastFirebaseSyncAt: "lastFirebaseSyncAt",
    lastFirebaseSyncDay: "lastFirebaseSyncDay",
    lastUsedAt: "lastUsedAt",
    googleScriptUrl: "googleScriptUrl",
    googleSpreadsheetId: "googleSpreadsheetId"
  };

  var SYNC = {
    idleSyncSeconds: 30,
    googleMinMinutes: 5,
    firebaseDaily: true,
    firebaseBatchSize: 50,
    closeSyncMaxSeconds: 30,
    googleFrequent: true,
    googleBidirectional: true,
    firebaseFrequent: false
  };

  var BACKUP = {
    automaticAfterExcel: true,
    automaticDaily: true,
    keepLastLocalBackups: 3,
    filePrefix: "BL2_RESPALDO",
    exportMime: "application/json"
  };

  var FIREBASE = {
    enabled: true,
    collection: "Estudiantes",
    batchSize: 50,
    syncOncePerDay: true,
    config: {
      apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
      authDomain: "utet-4387a.firebaseapp.com",
      projectId: "utet-4387a",
      storageBucket: "utet-4387a.firebasestorage.app",
      messagingSenderId: "902848131454",
      appId: "1:902848131454:web:47f515eb6480834724c32f"
    }
  };

  var GOOGLE = {
    enabled: true,
    mode: "apps_script",
    publicScript: true,
    scriptUrl: "",
    spreadsheetId: "",
    spreadsheetMode: "single_global_file",
    syncFrequent: true,
    restoreAllowed: true,
    conflictStrategy: "updatedAt",
    commonFields: ["periodoId", "cedula", "updatedAt"]
  };

  var PERIODOS_BASE = [
    {
      id: "2025-11__2026-05",
      label: "Noviembre 2025 a Mayo 2026",
      inicio: "2025-11",
      fin: "2026-05",
      activo: true
    },
    {
      id: "2026-02__2026-08",
      label: "Febrero 2026 a Agosto 2026",
      inicio: "2026-02",
      fin: "2026-08",
      activo: true
    },
    {
      id: "2026-04__2026-09",
      label: "Abril 2026 a Septiembre 2026",
      inicio: "2026-04",
      fin: "2026-09",
      activo: true
    }
  ];

  var REQUIRED_IMPORT_FIELDS = {
    periodoId: true,
    cedula: true,
    nombres: true
  };

  var ID_FIELDS = [
    "cedula",
    "numeroIdentificacion",
    "NumeroIdentificacion",
    "NúmeroIdentificación",
    "Identificacion",
    "Identificación",
    "documento",
    "Documento"
  ];

  var NAME_FIELDS = [
    "Nombres",
    "nombres",
    "Nombre",
    "nombre",
    "ApellidosNombres",
    "apellidosNombres",
    "Estudiante",
    "estudiante"
  ];

  var CAREER_FIELDS = [
    "NombreCarrera",
    "nombreCarrera",
    "Carrera",
    "carrera"
  ];

  var CAREER_CODE_FIELDS = [
    "CodigoCarrera",
    "codigoCarrera",
    "CódigoCarrera",
    "codigo_carrera"
  ];

  var EMAIL_FIELDS = [
    "CorreoInstitucional",
    "correoInstitucional",
    "CorreoPersonal",
    "correoPersonal",
    "email",
    "correo"
  ];

  var PHONE_FIELDS = [
    "Celular",
    "celular",
    "Telefono",
    "Teléfono",
    "telefono"
  ];

  var REQUIREMENT_VALUES = [
    "CUMPLE",
    "NO CUMPLE",
    "PENDIENTE"
  ];

  var KNOWN_REQUIREMENT_FIELDS = [
    "Academico",
    "Académico",
    "Financiero",
    "Documentacion",
    "Documentación",
    "Titulacion",
    "Titulación",
    "Ingles",
    "Inglés",
    "ActualizaciónDatos",
    "ActualizacionDatos",
    "AprobacionComplexivoProyecto",
    "AprobaciónComplexivoProyecto",
    "AprobacionTitulacion",
    "AprobaciónTitulacion",
    "PrácticasVinculacion",
    "PracticasVinculacion",
    "Vinculacion",
    "Vinculación",
    "SeguimientoGraduados"
  ];

  var MANUAL_PROTECTED_FIELDS = [
    "telegramUser",
    "telegramChatId",
    "_telegramUser",
    "_telegramChatId",
    "division",
    "divisiones",
    "divisionActualizadaEn",
    "estadoMatricula",
    "retirado",
    "retiradoEn",
    "observaciones",
    "observacion",
    "notaManual",
    "notasEditadas",
    "notasDefensaActualizadasEn",
    "fechaRegistroNotas",
    "ultimaEdicionLocal",
    "ultimaSincronizacion",
    "forceUploadedAt"
  ];

  var STUDENT_CLEAN_FIELDS = [
    "id",
    "cedula",
    "numeroIdentificacion",
    "Nombres",
    "nombres",
    "CodigoCarrera",
    "NombreCarrera",
    "Sede",
    "Modalidad",
    "HorarioComplexivo",
    "CorreoInstitucional",
    "CorreoPersonal",
    "Celular",
    "periodoId",
    "periodoLabel",
    "ultimoPeriodoId",
    "estadoMatricula",
    "division",
    "divisiones",
    "telegramUser",
    "telegramChatId",
    "createdAt",
    "updatedAt",
    "ultimaSincronizacion"
  ];

  var STATUS = {
    active: "ACTIVO",
    retired: "RETIRADO",
    inactiveLastLoad: "NO_APARECE_EN_ULTIMA_CARGA"
  };

  var CHANGE_TYPES = {
    importStudent: "IMPORT_STUDENT",
    updateStudent: "UPDATE_STUDENT",
    manualEdit: "MANUAL_EDIT",
    googleSync: "GOOGLE_SYNC",
    firebaseSync: "FIREBASE_SYNC",
    backup: "BACKUP",
    restore: "RESTORE"
  };

  var CHANGE_STATUS = {
    pending: "PENDIENTE",
    synced: "SINCRONIZADO",
    error: "ERROR",
    ignored: "IGNORADO"
  };

  var LOG_LEVELS = {
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
    ok: "OK"
  };

  function text(value){
    return String(value == null ? "" : value).trim();
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
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeCedula(value){
    var raw = text(value).replace(/[^\dA-Za-z]/g, "");

    if(/^\d{9}$/.test(raw)){
      return "0" + raw;
    }

    return raw;
  }

  function isRequirementValue(value){
    var normalized = normalizeBasic(value).toUpperCase();
    return REQUIREMENT_VALUES.indexOf(normalized) >= 0;
  }

  function isRequirementField(field, value){
    if(isRequirementValue(value)){
      return true;
    }

    var key = normalizeKey(field);
    return KNOWN_REQUIREMENT_FIELDS.some(function(name){
      return normalizeKey(name) === key;
    });
  }

  function makeStudentKey(cedula, periodoId){
    return normalizeCedula(cedula) + "__" + text(periodoId);
  }

  function makeRequirementKey(cedula, periodoId, requisito){
    return makeStudentKey(cedula, periodoId) + "__" + normalizeKey(requisito);
  }

  function makePeriodId(label){
    var raw = normalizeBasic(label).toLowerCase();

    var months = {
      enero: "01",
      febrero: "02",
      marzo: "03",
      abril: "04",
      mayo: "05",
      junio: "06",
      julio: "07",
      agosto: "08",
      septiembre: "09",
      setiembre: "09",
      octubre: "10",
      noviembre: "11",
      diciembre: "12"
    };

    var matches = raw.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(\d{4})/g);

    if(matches && matches.length >= 2){
      var first = matches[0].split(/\s+/);
      var second = matches[1].split(/\s+/);

      var m1 = months[first[0]] || "00";
      var y1 = first[1] || "0000";

      var m2 = months[second[0]] || "00";
      var y2 = second[1] || "0000";

      return y1 + "-" + m1 + "__" + y2 + "-" + m2;
    }

    return normalizeKey(label);
  }

  function nowISO(){
    return new Date().toISOString();
  }

  function todayKey(){
    return new Date().toISOString().slice(0, 10);
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function getPeriodById(id){
    id = text(id);
    return PERIODOS_BASE.find(function(periodo){
      return periodo.id === id;
    }) || null;
  }

  window.BL2Config = {
    version: VERSION,

    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: STORE_NAMES,
    sheets: SHEET_NAMES,
    settingsKeys: SETTINGS_KEYS,

    sync: SYNC,
    backup: BACKUP,
    firebase: FIREBASE,
    google: GOOGLE,

    periodosBase: PERIODOS_BASE,
    requiredImportFields: REQUIRED_IMPORT_FIELDS,

    fields: {
      id: ID_FIELDS,
      names: NAME_FIELDS,
      career: CAREER_FIELDS,
      careerCode: CAREER_CODE_FIELDS,
      email: EMAIL_FIELDS,
      phone: PHONE_FIELDS,
      requirements: KNOWN_REQUIREMENT_FIELDS,
      protectedManual: MANUAL_PROTECTED_FIELDS,
      studentClean: STUDENT_CLEAN_FIELDS
    },

    requirementValues: REQUIREMENT_VALUES,
    status: STATUS,
    changeTypes: CHANGE_TYPES,
    changeStatus: CHANGE_STATUS,
    logLevels: LOG_LEVELS,

    utils: {
      text: text,
      normalizeBasic: normalizeBasic,
      normalizeKey: normalizeKey,
      normalizeCedula: normalizeCedula,
      isRequirementValue: isRequirementValue,
      isRequirementField: isRequirementField,
      makeStudentKey: makeStudentKey,
      makeRequirementKey: makeRequirementKey,
      makePeriodId: makePeriodId,
      nowISO: nowISO,
      todayKey: todayKey,
      clone: clone,
      getPeriodById: getPeriodById
    }
  };
})(window);