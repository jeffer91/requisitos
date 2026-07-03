/* =========================================================
Nombre completo: bdl.norm.estudiante.js
Ruta o ubicación: /Requisitos/BDLocal/normalizers/bdl.norm.estudiante.js
Función o funciones:
- Normalizar estudiantes para Base Local.
- Corregir cédulas ecuatorianas que perdieron el cero inicial.
- Impedir estudiante válido sin período.
- Preparar persona, resumen y detalle para IndexedDB.
- Mantener compatibilidad con repositorios, snapshot legacy, Tabla, Ficha, Stats y Coordi.
Con qué se conecta:
- bdl.keys.js
- bdl.norm.text.js
- bdl.norm.periodo.js
- bdl.norm.carrera.js
- bdl.norm.requisito.js
- bdl.norm.division.js
- bdl.repo.estudiantes.js
========================================================= */
(function(window){
  "use strict";

  var K = window.BDLKeys || null;
  var T = window.BDLNormText || null;
  var P = window.BDLNormPeriodo || null;
  var C = window.BDLNormCarrera || null;
  var R = window.BDLNormRequisito || null;
  var D = window.BDLNormDivision || null;

  if(!K || !T || !P){
    throw new Error("BDLNormEstudiante requiere BDLKeys, BDLNormText y BDLNormPeriodo.");
  }

  function text(value){
    if(T && typeof T.text === "function"){
      return T.text(value);
    }
    return String(value == null ? "" : value).trim();
  }

  function cleanSpaces(value){
    if(T && typeof T.cleanSpaces === "function"){
      return T.cleanSpaces(value);
    }
    return text(value).replace(/\s+/g, " ").trim();
  }

  function key(value){
    if(T && typeof T.key === "function"){
      return T.key(value);
    }
    if(K && typeof K.key === "function"){
      return K.key(value);
    }
    return cleanSpaces(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  function first(row, fields){
    row = row || {};
    fields = fields || [];
    if(T && typeof T.first === "function"){
      return T.first(row, fields);
    }
    for(var i = 0; i < fields.length; i++){
      if(row[fields[i]] != null && text(row[fields[i]]) !== ""){
        return row[fields[i]];
      }
    }
    return "";
  }

  function now(){
    return new Date().toISOString();
  }

  function fixTextEncoding(value){
    var raw = text(value);

    try{
      if(/[ÃÂ]/.test(raw)){
        raw = decodeURIComponent(escape(raw));
      }
    }catch(error){}

    raw = raw
      .replace(/�/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return raw;
  }

  function normalizeName(value){
    var raw = fixTextEncoding(value);

    raw = raw
      .replace(/\bSRA\b\.?/gi, "")
      .replace(/\bSRTA\b\.?/gi, "")
      .replace(/\bSR\b\.?/gi, "")
      .replace(/\bLCDA\b\.?/gi, "")
      .replace(/\bLCDO\b\.?/gi, "")
      .replace(/\bING\b\.?/gi, "")
      .replace(/\bMSC\b\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    return raw.toLocaleUpperCase("es-EC");
  }

  function digits(value){
    return text(value).replace(/[^0-9]/g, "");
  }

  function normalizeCedula(value){
    var raw = digits(value);

    if(!raw){
      return "SIN_IDENTIFICACION";
    }

    /*
      Regla importante:
      Excel suele quitar solo el cero inicial.
      Por eso 503957078 debe pasar a 0503957078.
      Si vienen menos de 9 dígitos, no inventamos números internos.
    */
    if(raw.length === 9){
      raw = "0" + raw;
    }

    return raw || "SIN_IDENTIFICACION";
  }

  function numero(row){
    row = row || {};

    var value = first(row, [
      "numeroIdentificacion",
      "NumeroIdentificacion",
      "identificacion",
      "Identificacion",
      "Identificación",
      "cedula",
      "Cedula",
      "Cédula",
      "CEDULA",
      "documento",
      "Documento",
      "_cedula",
      "_bl2Id",
      "id"
    ]);

    return normalizeCedula(value);
  }

  function nombres(row){
    row = row || {};

    var value = first(row, [
      "nombres",
      "Nombres",
      "nombreCompleto",
      "NombreCompleto",
      "estudiante",
      "Estudiante",
      "apellidosNombres",
      "ApellidosNombres",
      "apellidos_nombres",
      "nombre",
      "Nombre",
      "_nombres",
      "_bl2Nombre"
    ]);

    return normalizeName(value) || "ESTUDIANTE SIN NOMBRE";
  }

  function correoPersonal(row){
    return cleanSpaces(first(row, [
      "correoPersonal",
      "CorreoPersonal",
      "correo",
      "Correo",
      "email",
      "Email"
    ])).toLowerCase();
  }

  function correoInstitucional(row){
    return cleanSpaces(first(row, [
      "correoInstitucional",
      "CorreoInstitucional",
      "correoInst",
      "CorreoInst",
      "emailInstitucional",
      "EmailInstitucional"
    ])).toLowerCase();
  }

  function celular(row){
    var value = first(row, [
      "celular",
      "Celular",
      "telefono",
      "Telefono",
      "Teléfono",
      "whatsapp",
      "WhatsApp"
    ]);

    return digits(value);
  }

  function sede(row){
    return cleanSpaces(first(row, [
      "sede",
      "Sede",
      "campus",
      "Campus"
    ]));
  }

  function estadoMatricula(row){
    var value = cleanSpaces(first(row, [
      "estadoMatricula",
      "EstadoMatricula",
      "estado",
      "Estado",
      "matriculaEstado",
      "MatriculaEstado"
    ]));

    if(!value){
      return "ACTIVO";
    }

    var k = key(value);

    if(k === "retirado" || k === "retiro" || k === "inactivo"){
      return "RETIRADO";
    }

    return "ACTIVO";
  }

  function carreraInfo(row){
    if(C && typeof C.normalizeRow === "function"){
      var normalizedRow = C.normalizeRow(row || {});
      return normalizedRow.carreraNormalizada || C.normalize(normalizedRow.carrera || normalizedRow.nombreCarrera || "");
    }

    var raw = first(row, [
      "nombreCarrera",
      "NombreCarrera",
      "carrera",
      "Carrera",
      "programa",
      "Programa"
    ]);

    return {
      codigo: cleanSpaces(first(row, ["codigoCarrera", "CodigoCarrera"])),
      codigoCarrera: cleanSpaces(first(row, ["codigoCarrera", "CodigoCarrera"])),
      nombre: cleanSpaces(raw) || "SIN CARRERA",
      label: cleanSpaces(raw) || "SIN CARRERA",
      key: key(raw || "SIN CARRERA"),
      modalidad: "",
      original: text(raw),
      oficial: false,
      source: "fallback"
    };
  }

  function divisionPrincipal(row){
    if(D && typeof D.principal === "function"){
      return D.principal(row || {});
    }

    return cleanSpaces(first(row, [
      "divisionPrincipal",
      "division",
      "Division",
      "división",
      "División",
      "modalidad",
      "Modalidad"
    ])) || "Sin división";
  }

  function requisitoResumen(row){
    if(R && typeof R.resumen === "function"){
      return R.resumen(row || {});
    }

    return {
      estadoGeneral: "pendiente",
      total: 0,
      cumple: 0,
      pendiente: 0,
      no_cumple: 0,
      avance: 0
    };
  }

  function persona(row){
    row = row || {};

    var id = numero(row);
    var name = nombres(row);
    var nowValue = now();

    return {
      numeroIdentificacion: id,
      cedula: id,
      identificacion: id,
      nombres: name,
      nombreCompleto: name,
      correoPersonal: correoPersonal(row),
      correoInstitucional: correoInstitucional(row),
      celular: celular(row),
      telefono: celular(row),
      createdAt: cleanSpaces(row.createdAt || row.fechaCreacion || "") || nowValue,
      updatedAt: nowValue,
      syncStatus: "pendiente"
    };
  }

  function resumen(row, periodoInfo, req){
    row = row || {};
    periodoInfo = periodoInfo || P.normalize(row);
    req = req || requisitoResumen(row);

    var ced = numero(row);
    var car = carreraInfo(row);
    var div = divisionPrincipal(row);
    var name = nombres(row);
    var estadoMat = estadoMatricula(row);
    var periodoId = periodoInfo.periodoId || "SIN_PERIODO";
    var idEstudiantePeriodo = K.idEstudiantePeriodo(periodoId, ced);
    var nowValue = now();

    return {
      idEstudiantePeriodo: idEstudiantePeriodo,
      id: idEstudiantePeriodo,

      periodoId: periodoId,
      periodoLabel: periodoInfo.periodoLabel || periodoId,
      periodoKey: periodoInfo.periodoKey || key(periodoInfo.periodoLabel || periodoId),
      tipoPeriodo: periodoInfo.tipoPeriodo || periodoInfo.periodoTipo || "",

      numeroIdentificacion: ced,
      cedula: ced,
      identificacion: ced,

      nombres: name,
      nombreCompleto: name,

      codigoCarrera: car.codigo || car.codigoCarrera || cleanSpaces(first(row, ["codigoCarrera", "CodigoCarrera"])),
      CodigoCarrera: car.codigo || car.codigoCarrera || cleanSpaces(first(row, ["codigoCarrera", "CodigoCarrera"])),
      nombreCarrera: car.nombre || "SIN CARRERA",
      NombreCarrera: car.nombre || "SIN CARRERA",
      carrera: car.nombre || "SIN CARRERA",
      Carrera: car.nombre || "SIN CARRERA",
      nombreCarreraKey: car.key || key(car.nombre || "SIN CARRERA"),

      sede: sede(row),
      Sede: sede(row),

      divisionPrincipal: div,
      divisionPrincipalKey: key(div),
      division: div,
      Division: div,

      estadoMatricula: estadoMat,
      EstadoMatricula: estadoMat,

      estadoGeneral: req.estadoGeneral || req.estado || "pendiente",
      totalRequisitos: Number(req.total || req.totalRequisitos || 0),
      cumpleRequisitos: Number(req.cumple || req.cumpleRequisitos || 0),
      pendienteRequisitos: Number(req.pendiente || req.pendienteRequisitos || 0),
      noCumpleRequisitos: Number(req.no_cumple || req.noCumple || req.noCumpleRequisitos || 0),
      avance: Number(req.avance || 0),

      correoPersonal: correoPersonal(row),
      correoInstitucional: correoInstitucional(row),
      celular: celular(row),

      updatedAt: nowValue,
      syncStatus: "pendiente",

      _cedula: ced,
      _nombres: name,
      _carrera: car.nombre || "SIN CARRERA",
      _division: div,
      _periodoId: periodoId,
      _periodoLabel: periodoInfo.periodoLabel || periodoId,
      _estadoMatricula: estadoMat
    };
  }

  function detalle(row, periodoInfo){
    row = Object.assign({}, row || {});
    periodoInfo = periodoInfo || P.normalize(row);

    var ced = numero(row);
    var periodoId = periodoInfo.periodoId || "SIN_PERIODO";
    var idEstudiantePeriodo = K.idEstudiantePeriodo(periodoId, ced);
    var nowValue = now();

    return {
      idEstudiantePeriodo: idEstudiantePeriodo,
      periodoId: periodoId,
      periodoLabel: periodoInfo.periodoLabel || periodoId,
      numeroIdentificacion: ced,
      datosOriginales: row,
      raw: row,
      source: cleanSpaces(row._source || row.source || "carga_excel"),
      fileName: cleanSpaces(row._fileName || row.fileName || ""),
      sheetName: cleanSpaces(row._sheetName || row.sheetName || ""),
      rowIndex: row._rowIndex != null ? row._rowIndex : "",
      updatedAt: nowValue,
      syncStatus: "pendiente"
    };
  }

  function normalize(row, periodoInfo){
    row = Object.assign({}, row || {});

    if(C && typeof C.normalizeRow === "function"){
      row = C.normalizeRow(row);
    }

    if(D && typeof D.normalizeRow === "function"){
      row = D.normalizeRow(row);
    }

    periodoInfo = periodoInfo || P.normalize(row);

    var req = requisitoResumen(row);
    var perValid = P.isValid ? P.isValid(periodoInfo) : periodoInfo && periodoInfo.periodoId !== "SIN_PERIODO";
    var ced = numero(row);

    var result = {
      periodo: periodoInfo,
      persona: persona(row),
      resumen: resumen(row, periodoInfo, req),
      detalle: detalle(row, periodoInfo),
      requisitosInfo: req,
      valid: true,
      errors: []
    };

    if(!perValid){
      result.valid = false;
      result.errors.push({
        tipo: "PERIODO_OBLIGATORIO",
        mensaje: "El estudiante no puede entrar a Base Local sin período seleccionado."
      });
    }

    if(!ced || ced === "SIN_IDENTIFICACION"){
      result.valid = false;
      result.errors.push({
        tipo: "IDENTIFICACION_VACIA",
        mensaje: "El estudiante no tiene cédula o identificación válida."
      });
    }

    return result;
  }

  function isValidCedula(value){
    var n = normalizeCedula(value);
    return n !== "SIN_IDENTIFICACION" && n.length === 10;
  }

  window.BDLNormEstudiante = {
    normalize: normalize,
    normalizar: normalize,
    persona: persona,
    resumen: resumen,
    detalle: detalle,
    numero: numero,
    normalizeCedula: normalizeCedula,
    normalizarCedula: normalizeCedula,
    isValidCedula: isValidCedula,
    nombres: nombres,
    carreraInfo: carreraInfo,
    divisionPrincipal: divisionPrincipal
  };
})(window);