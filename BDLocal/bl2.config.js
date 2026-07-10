/* =========================================================
Nombre completo: bl2.config.js
Ruta o ubicación: /BDLocal/bl2.config.js
Función o funciones:
- Configurar Base Local, tablas, períodos y campos protegidos.
- Declarar todas las sincronizaciones externas como manuales.
- Limitar Firebase y las colas externas a 25 cambios por ejecución.
- Separar Firebase personal y académico mediante configuración V2.
- Normalizar identificaciones sin alterar documentos extranjeros.
- Completar el cero solo cuando forma una cédula ecuatoriana válida.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.2.0-identity-safe";
  var DB_NAME = "REQUISITOS_BL2";
  var DB_VERSION = 1;

  var STORE_NAMES = {
    settings:"settings",
    periodos:"periodos",
    estudiantes:"estudiantes",
    requisitos:"requisitos",
    contactos:"contactos",
    notas:"notas",
    cambios:"cambios",
    logs:"logs",
    resumen:"resumen",
    errores:"errores",
    syncMeta:"sync_meta",
    backups:"backups"
  };

  var SHEET_NAMES = {
    periodos:"periodos",
    estudiantes:"estudiantes",
    requisitos:"requisitos",
    contactos:"contactos",
    notas:"notas",
    cambios:"cambios",
    logs:"logs",
    resumen:"resumen",
    errores:"errores",
    syncMeta:"sync_meta"
  };

  var SETTINGS_KEYS = {
    activePeriodId:"activePeriodId",
    activePeriodLabel:"activePeriodLabel",
    lastExcelBackupAt:"lastExcelBackupAt",
    lastDailyBackupAt:"lastDailyBackupAt",
    lastGoogleSyncAt:"lastGoogleSyncAt",
    lastFirebaseSyncAt:"lastFirebaseSyncAt",
    lastFirebaseSyncDay:"lastFirebaseSyncDay",
    lastUsedAt:"lastUsedAt",
    googleScriptUrl:"googleScriptUrl",
    googleSpreadsheetId:"googleSpreadsheetId"
  };

  var SYNC = {
    mode:"manual",
    manualOnly:true,
    automatic:false,
    syncOnIdle:false,
    syncOnClose:false,
    idleSyncSeconds:0,
    googleMinMinutes:0,
    firebaseDaily:false,
    firebaseBatchSize:25,
    maxBatchSize:25,
    closeSyncMaxSeconds:0,
    googleFrequent:false,
    googleBidirectional:true,
    firebaseFrequent:false
  };

  var BACKUP = {
    automaticAfterExcel:true,
    automaticDaily:true,
    keepLastLocalBackups:3,
    filePrefix:"BL2_RESPALDO",
    exportMime:"application/json"
  };

  var FIREBASE = {
    enabled:true,
    manualOnly:true,
    automatic:false,
    collection:"Estudiantes",
    documentIdStrategy:"periodoId__cedula",
    batchSize:25,
    maxBatchSize:25,
    mergeWrites:true,
    deleteAllowed:false,
    syncOncePerDay:false,
    previewBeforePull:true,
    backupBeforePull:true,
    protectLocalPending:true,
    config:{
      apiKey:"AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
      authDomain:"utet-4387a.firebaseapp.com",
      projectId:"utet-4387a",
      storageBucket:"utet-4387a.firebasestorage.app",
      messagingSenderId:"902848131454",
      appId:"1:902848131454:web:47f515eb6480834724c32f"
    }
  };

  var GOOGLE = {
    enabled:true,
    manualOnly:true,
    automatic:false,
    mode:"apps_script",
    publicScript:true,
    scriptUrl:"",
    spreadsheetId:"",
    spreadsheetMode:"single_global_file",
    syncFrequent:false,
    restoreAllowed:true,
    conflictStrategy:"updatedAt",
    commonFields:["periodoId","cedula","updatedAt"]
  };

  var PERIODOS_BASE = [
    { id:"2025-11__2026-05",label:"Noviembre 2025 a Mayo 2026",inicio:"2025-11",fin:"2026-05",activo:true },
    { id:"2026-02__2026-08",label:"Febrero 2026 a Agosto 2026",inicio:"2026-02",fin:"2026-08",activo:true },
    { id:"2026-04__2026-09",label:"Abril 2026 a Septiembre 2026",inicio:"2026-04",fin:"2026-09",activo:true }
  ];

  var REQUIRED_IMPORT_FIELDS = { periodoId:true,cedula:true,nombres:true };

  var ID_FIELDS = [
    "cedula","numeroIdentificacion","NumeroIdentificacion","NúmeroIdentificación",
    "Identificacion","Identificación","documento","Documento"
  ];

  var NAME_FIELDS = [
    "Nombres","nombres","Nombre","nombre","ApellidosNombres","apellidosNombres",
    "Estudiante","estudiante"
  ];

  var CAREER_FIELDS = ["NombreCarrera","nombreCarrera","Carrera","carrera"];
  var CAREER_CODE_FIELDS = ["CodigoCarrera","codigoCarrera","CódigoCarrera","codigo_carrera"];

  var EMAIL_FIELDS = [
    "CorreoInstitucional","correoInstitucional","CorreoPersonal","correoPersonal","email","correo"
  ];

  var PHONE_FIELDS = ["Celular","celular","Telefono","Teléfono","telefono"];
  var REQUIREMENT_VALUES = ["CUMPLE","NO CUMPLE","PENDIENTE"];

  var KNOWN_REQUIREMENT_FIELDS = [
    "Academico","Académico","Financiero","Documentacion","Documentación","Titulacion","Titulación",
    "Ingles","Inglés","ActualizaciónDatos","ActualizacionDatos","AprobacionComplexivoProyecto",
    "AprobaciónComplexivoProyecto","AprobacionTitulacion","AprobaciónTitulacion",
    "PrácticasVinculacion","PracticasVinculacion","Vinculacion","Vinculación","SeguimientoGraduados"
  ];

  var MANUAL_PROTECTED_FIELDS = [
    "telegramUser","telegramChatId","_telegramUser","_telegramChatId","division","divisiones",
    "divisionActualizadaEn","estadoMatricula","retirado","retiradoEn","observaciones","observacion",
    "notaManual","notasEditadas","notasDefensaActualizadasEn","fechaRegistroNotas",
    "ultimaEdicionLocal","ultimaSincronizacion","forceUploadedAt"
  ];

  var STUDENT_CLEAN_FIELDS = [
    "id","cedula","numeroIdentificacion","Nombres","nombres","CodigoCarrera","NombreCarrera",
    "Sede","Modalidad","HorarioComplexivo","CorreoInstitucional","CorreoPersonal","Celular",
    "periodoId","periodoLabel","ultimoPeriodoId","estadoMatricula","division","divisiones",
    "telegramUser","telegramChatId","createdAt","updatedAt","ultimaSincronizacion"
  ];

  var STATUS = {
    active:"ACTIVO",
    retired:"RETIRADO",
    inactiveLastLoad:"NO_APARECE_EN_ULTIMA_CARGA"
  };

  var CHANGE_TYPES = {
    importStudent:"IMPORT_STUDENT",
    updateStudent:"UPDATE_STUDENT",
    manualEdit:"MANUAL_EDIT",
    googleSync:"GOOGLE_SYNC",
    firebaseSync:"FIREBASE_SYNC",
    backup:"BACKUP",
    restore:"RESTORE"
  };

  var CHANGE_STATUS = {
    pending:"PENDIENTE",
    synced:"SINCRONIZADO",
    error:"ERROR",
    ignored:"IGNORADO"
  };

  var LOG_LEVELS = { info:"INFO",warn:"WARN",error:"ERROR",ok:"OK" };

  function text(value){ return String(value == null ? "" : value).trim(); }

  function normalizeBasic(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  }

  function normalizeKey(value){
    return normalizeBasic(value).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }

  function cleanIdentification(value){
    return text(value).replace(/[^\dA-Za-z]/g,"").toUpperCase();
  }

  function isValidEcuadorianCedula(value){
    var raw = cleanIdentification(value);
    if(!/^\d{10}$/.test(raw)){ return false; }
    var province = Number(raw.slice(0,2));
    var third = Number(raw.charAt(2));
    if(province < 1 || province > 24 || third < 0 || third > 5){ return false; }
    var coefficients = [2,1,2,1,2,1,2,1,2];
    var sum = 0;
    for(var i=0;i<9;i+=1){
      var product = Number(raw.charAt(i)) * coefficients[i];
      sum += product >= 10 ? product - 9 : product;
    }
    var verifier = (10 - (sum % 10)) % 10;
    return verifier === Number(raw.charAt(9));
  }

  function analyzeIdentification(value){
    var original = text(value);
    var raw = cleanIdentification(value);
    var result = {
      original:original,
      raw:raw,
      canonical:raw,
      changed:false,
      type:raw ? "OTHER_IDENTIFICATION" : "EMPTY",
      validEcuadorian:false,
      missingLeadingZero:false,
      safeAutoCorrection:false,
      reason:raw ? "Identificación conservada sin transformación estructural." : "Identificación vacía."
    };

    if(!raw){ return result; }
    if(/^\d{10}$/.test(raw) && isValidEcuadorianCedula(raw)){
      result.type = "ECUADORIAN_CEDULA";
      result.validEcuadorian = true;
      result.safeAutoCorrection = true;
      result.reason = "Cédula ecuatoriana válida.";
      return result;
    }
    if(/^\d{9}$/.test(raw)){
      var candidate = "0" + raw;
      if(isValidEcuadorianCedula(candidate)){
        result.canonical = candidate;
        result.changed = true;
        result.type = "ECUADORIAN_CEDULA_MISSING_ZERO";
        result.validEcuadorian = true;
        result.missingLeadingZero = true;
        result.safeAutoCorrection = true;
        result.reason = "El cero inicial completa una cédula ecuatoriana válida.";
        return result;
      }
      result.type = "NUMERIC_IDENTIFICATION_9";
      result.reason = "Nueve dígitos, pero agregar cero no produce una cédula ecuatoriana válida; se conserva como posible identificación extranjera.";
      return result;
    }
    if(/^\d{10}$/.test(raw)){
      result.type = "NUMERIC_IDENTIFICATION_10_UNVERIFIED";
      result.reason = "Diez dígitos que no validan como cédula ecuatoriana; se conservan sin cambios.";
      return result;
    }
    if(/^\d+$/.test(raw)){
      result.type = "NUMERIC_FOREIGN_OR_OTHER";
      result.reason = "Identificación numérica de longitud no ecuatoriana; se conserva sin cambios.";
      return result;
    }
    result.type = "ALPHANUMERIC_FOREIGN_OR_OTHER";
    result.reason = "Identificación alfanumérica; se conserva sin cambios.";
    return result;
  }

  function normalizeCedula(value){
    return analyzeIdentification(value).canonical;
  }

  function isRequirementValue(value){
    return REQUIREMENT_VALUES.indexOf(normalizeBasic(value).toUpperCase()) >= 0;
  }

  function isRequirementField(field,value){
    if(isRequirementValue(value)){ return true; }
    var key = normalizeKey(field);
    return KNOWN_REQUIREMENT_FIELDS.some(function(name){ return normalizeKey(name) === key; });
  }

  function makeStudentKey(cedula,periodoId){ return normalizeCedula(cedula) + "__" + text(periodoId); }
  function makeRequirementKey(cedula,periodoId,requisito){ return makeStudentKey(cedula,periodoId) + "__" + normalizeKey(requisito); }

  function makePeriodId(label){
    var raw = normalizeBasic(label).toLowerCase();
    var months = {
      enero:"01",febrero:"02",marzo:"03",abril:"04",mayo:"05",junio:"06",
      julio:"07",agosto:"08",septiembre:"09",setiembre:"09",octubre:"10",noviembre:"11",diciembre:"12"
    };
    var matches = raw.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(\d{4})/g);
    if(matches && matches.length >= 2){
      var first = matches[0].split(/\s+/);
      var second = matches[1].split(/\s+/);
      return (first[1] || "0000") + "-" + (months[first[0]] || "00") + "__" + (second[1] || "0000") + "-" + (months[second[0]] || "00");
    }
    return normalizeKey(label);
  }

  function nowISO(){ return new Date().toISOString(); }
  function todayKey(){ return new Date().toISOString().slice(0,10); }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }

  function getPeriodById(id){
    id = text(id);
    return PERIODOS_BASE.find(function(periodo){ return periodo.id === id; }) || null;
  }

  window.BL2Config = {
    version:VERSION,
    dbName:DB_NAME,
    dbVersion:DB_VERSION,
    stores:STORE_NAMES,
    sheets:SHEET_NAMES,
    settingsKeys:SETTINGS_KEYS,
    sync:SYNC,
    backup:BACKUP,
    firebase:FIREBASE,
    google:GOOGLE,
    periodosBase:PERIODOS_BASE,
    requiredImportFields:REQUIRED_IMPORT_FIELDS,
    fields:{
      id:ID_FIELDS,
      names:NAME_FIELDS,
      career:CAREER_FIELDS,
      careerCode:CAREER_CODE_FIELDS,
      email:EMAIL_FIELDS,
      phone:PHONE_FIELDS,
      requirements:KNOWN_REQUIREMENT_FIELDS,
      protectedManual:MANUAL_PROTECTED_FIELDS,
      studentClean:STUDENT_CLEAN_FIELDS
    },
    requirementValues:REQUIREMENT_VALUES,
    status:STATUS,
    changeTypes:CHANGE_TYPES,
    changeStatus:CHANGE_STATUS,
    logLevels:LOG_LEVELS,
    utils:{
      text:text,
      normalizeBasic:normalizeBasic,
      normalizeKey:normalizeKey,
      cleanIdentification:cleanIdentification,
      isValidEcuadorianCedula:isValidEcuadorianCedula,
      analyzeIdentification:analyzeIdentification,
      normalizeCedula:normalizeCedula,
      isRequirementValue:isRequirementValue,
      isRequirementField:isRequirementField,
      makeStudentKey:makeStudentKey,
      makeRequirementKey:makeRequirementKey,
      makePeriodId:makePeriodId,
      nowISO:nowISO,
      todayKey:todayKey,
      clone:clone,
      getPeriodById:getPeriodById
    }
  };
})(window);
