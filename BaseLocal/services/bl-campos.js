/* =========================================================
Nombre completo: bl-campos.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-campos.js
Función o funciones:
- Centralizar campos oficiales y variantes toleradas de Base Local.
- Reconocer campos de Firestore con tildes, sin tildes, mayúsculas o minúsculas.
- Mantener nombres originales al guardar, pero permitir lectura tolerante.
- Normalizar nombres visibles sin modificar la base de datos.
Con qué se conecta:
- bl-normalizador.js
- bl-filtros.js
- baselocal.core.js
- pantallas que muestran requisitos
========================================================= */
(function(window){
  "use strict";

  var REQUISITO_FIELDS = [
    "Academico",
    "ActualizaciónDatos",
    "AprobacionComplexivoProyecto",
    "AprobacionTitulacion",
    "Documentacion",
    "Financiero",
    "Ingles",
    "PrácticasVinculacion",
    "SeguimientoGraduados",
    "Titulacion",
    "Vinculacion"
  ];

  var DISPLAY_LABELS = {
    academico:"Académico",
    actualizaciondatos:"Actualización de datos",
    aprobacioncomplexivoproyecto:"Aprobación complexivo/proyecto",
    aprobaciontitulacion:"Aprobación titulación",
    documentacion:"Documentación",
    financiero:"Financiero",
    ingles:"Inglés",
    practicasvinculacion:"Prácticas",
    practicasvinculación:"Prácticas",
    "prácticasvinculación":"Prácticas",
    "practicas/vinculacion":"Prácticas",
    "prácticas/vinculación":"Prácticas",
    seguimientograduados:"Seguimiento graduados",
    titulacion:"Titulación",
    vinculacion:"Vinculación"
  };

  var STATUS = {
    ACTIVO:"ACTIVO",
    RETIRADO:"RETIRADO"
  };

  var ALIASES = {
    cedula:["cedula", "Cedula", "CEDULA", "cédula", "Cédula", "numeroIdentificacion", "NumeroIdentificacion", "numeroidentificacion", "identificacion", "Identificacion"],
    numeroIdentificacion:["numeroIdentificacion", "NumeroIdentificacion", "numeroidentificacion", "identificacion", "Identificacion", "cedula", "Cedula", "CEDULA"],
    nombres:["Nombres", "nombres", "nombre", "Nombre", "estudiante", "Estudiante", "apellidosNombres", "apellidos_nombres"],
    nombreCarrera:["NombreCarrera", "nombreCarrera", "nombrecarrera", "carrera", "Carrera", "programa", "Programa"],
    codigoCarrera:["CodigoCarrera", "codigoCarrera", "codigocarrera", "codigo_carrera"],
    sede:["Sede", "sede"],
    correoInstitucional:["CorreoInstitucional", "correoInstitucional", "correo_institucional"],
    correoPersonal:["CorreoPersonal", "correoPersonal", "correo_personal"],
    celular:["Celular", "celular", "telefono", "Telefono", "teléfono", "Teléfono"],
    periodoId:["periodoId", "PeriodoId", "periodId", "idPeriodo", "periodo_id", "ultimoPeriodoId", "UltimoPeriodoId"],
    ultimoPeriodoId:["ultimoPeriodoId", "UltimoPeriodoId", "periodoId", "PeriodoId"],
    periodoLabel:["periodoLabel", "label", "Periodo", "periodo", "nombrePeriodo"],
    estadoMatricula:["estadoMatricula", "EstadoMatricula", "estado_matricula", "estado", "Estado"],
    retiradoEn:["retiradoEn", "RetiradoEn", "fechaRetiro", "FechaRetiro"],
    historialEstadoMatricula:["historialEstadoMatricula", "HistorialEstadoMatricula"],
    updatedAt:["updatedAt", "actualizadoEn", "fechaActualizacion", "forceUploadedAt"],
    createdAt:["createdAt", "creadoEn", "fechaCreacion"],
    ultimaSincronizacion:["ultimaSincronizacion", "últimaSincronizacion", "ultima_sync", "sincronizadoEn"],
    academico:["Academico", "Académico", "academico", "académico"],
    actualizacionDatos:["ActualizaciónDatos", "ActualizacionDatos", "actualizacionDatos", "actualizaciónDatos"],
    aprobacionComplexivoProyecto:["AprobacionComplexivoProyecto", "AprobaciónComplexivoProyecto", "aprobacionComplexivoProyecto"],
    aprobacionTitulacion:["AprobacionTitulacion", "AprobaciónTitulacion", "aprobacionTitulacion"],
    documentacion:["Documentacion", "Documentación", "documentacion", "documentación"],
    financiero:["Financiero", "financiero"],
    ingles:["Ingles", "Inglés", "ingles", "inglés"],
    practicasVinculacion:["PrácticasVinculacion", "PracticasVinculacion", "practicasVinculacion", "prácticasVinculacion", "Prácticas/Vinculación", "Practicas/Vinculacion", "practicas/vinculacion"],
    seguimientoGraduados:["SeguimientoGraduados", "seguimientoGraduados"],
    titulacion:["Titulacion", "Titulación", "titulacion", "titulación"],
    vinculacion:["Vinculacion", "Vinculación", "vinculacion", "vinculación"]
  };

  var SEARCH_CANONICAL_FIELDS = [
    "cedula",
    "numeroIdentificacion",
    "nombres",
    "nombreCarrera",
    "codigoCarrera",
    "sede",
    "correoInstitucional",
    "correoPersonal",
    "celular",
    "periodoId",
    "periodoLabel",
    "estadoMatricula"
  ];

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeKey(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  function displayLabel(value, fallback){
    var raw = text(value);
    if(!raw){
      return fallback || "";
    }
    var normalized = normalizeKey(raw);
    return DISPLAY_LABELS[raw] || DISPLAY_LABELS[normalized] || fallback || raw;
  }

  function requirementLabel(value, fallback){
    return displayLabel(value, fallback);
  }

  function getOwnKey(row, wanted){
    if(!row || !wanted){
      return "";
    }
    var keys = Object.keys(row);
    for(var i = 0; i < keys.length; i += 1){
      if(keys[i] === wanted){
        return keys[i];
      }
    }
    var cleanWanted = normalizeKey(wanted);
    for(var j = 0; j < keys.length; j += 1){
      if(normalizeKey(keys[j]) === cleanWanted){
        return keys[j];
      }
    }
    return "";
  }

  function getValue(row, canonicalName, fallback){
    var aliases = ALIASES[canonicalName] || [canonicalName];
    for(var i = 0; i < aliases.length; i += 1){
      var key = getOwnKey(row, aliases[i]);
      if(key && row[key] != null && text(row[key]) !== ""){
        return row[key];
      }
    }
    return fallback;
  }

  function setIfMissing(row, fieldName, value){
    if(!row || !fieldName || value == null || text(value) === ""){
      return row;
    }
    var key = getOwnKey(row, fieldName);
    if(key && text(row[key]) !== ""){
      return row;
    }
    row[fieldName] = value;
    return row;
  }

  function normalizeEstado(value){
    var clean = text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if(clean === STATUS.RETIRADO){
      return STATUS.RETIRADO;
    }
    return STATUS.ACTIVO;
  }

  function ensureIdentity(row){
    var out = Object.assign({}, row || {});
    var cedula = text(getValue(out, "cedula", ""));
    var numero = text(getValue(out, "numeroIdentificacion", cedula));
    var id = cedula || numero;
    if(id){
      setIfMissing(out, "cedula", id);
      setIfMissing(out, "numeroIdentificacion", id);
      out.cedula = text(out.cedula || id);
      out.numeroIdentificacion = text(out.numeroIdentificacion || id);
    }
    return out;
  }

  window.BLCampos = {
    requisitoFields:REQUISITO_FIELDS.slice(),
    displayLabels:Object.assign({}, DISPLAY_LABELS),
    aliases:ALIASES,
    status:STATUS,
    searchCanonicalFields:SEARCH_CANONICAL_FIELDS.slice(),
    text:text,
    normalizeKey:normalizeKey,
    displayLabel:displayLabel,
    requirementLabel:requirementLabel,
    getOwnKey:getOwnKey,
    getValue:getValue,
    setIfMissing:setIfMissing,
    normalizeEstado:normalizeEstado,
    ensureIdentity:ensureIdentity
  };
})(window);