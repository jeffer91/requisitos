(function(window){
  "use strict";

  var T = window.BDLNormText;
  var P = window.BDLNormPeriodo;
  var R = window.BDLNormRequisito;
  var K = window.BDLKeys;

  if(!T || !P || !R || !K){
    throw new Error("Normalizadores base deben cargarse antes de BDLNormEstudiante.");
  }

  function numero(row){
    return K.numeroIdentificacion(row);
  }

  function nombres(row){
    return T.upper(T.first(row, ["nombres", "Nombres", "nombre", "Nombre", "estudiante", "Estudiante", "alumno", "Alumno"]));
  }

  function codigoCarrera(row){
    return T.upper(T.first(row, ["codigoCarrera", "CodigoCarrera", "CódigoCarrera", "codCarrera", "CodCarrera"]));
  }

  function nombreCarrera(row){
    return T.upper(T.first(row, ["nombreCarrera", "NombreCarrera", "carrera", "Carrera", "programa", "Programa"]));
  }

  function sede(row){
    return T.cleanSpaces(T.first(row, ["sede", "Sede", "campus", "Campus"]));
  }

  function modalidad(row){
    return T.upper(T.first(row, ["modalidad", "Modalidad", "tipoModalidad", "TipoModalidad"]));
  }

  function estadoMatricula(row){
    var raw = T.searchKey(T.first(row, ["estadoMatricula", "EstadoMatricula", "estado", "Estado", "matriculaEstado", "MatriculaEstado"]));
    if(raw.indexOf("retir") >= 0 || raw.indexOf("inactivo") >= 0 || raw.indexOf("baja") >= 0){ return "RETIRADO"; }
    return "ACTIVO";
  }

  function divisionPrincipal(row){
    return T.cleanSpaces(T.first(row, ["divisionPrincipal", "division", "Division", "división", "División"]));
  }

  function persona(row){
    var num = numero(row);
    var nom = nombres(row);
    return {
      numeroIdentificacion: num,
      nombres: nom,
      correoPersonal: T.lower(T.first(row, ["correoPersonal", "CorreoPersonal", "correo", "Correo", "email", "Email"])),
      correoInstitucional: T.lower(T.first(row, ["correoInstitucional", "CorreoInstitucional"])),
      celular: T.cleanSpaces(T.first(row, ["celular", "Celular", "telefono", "Telefono", "Teléfono"])),
      telegramUser: T.cleanSpaces(T.first(row, ["telegramUser", "TelegramUser", "telegram", "Telegram"])),
      telegramChatId: T.cleanSpaces(T.first(row, ["telegramChatId", "TelegramChatId"])),
      searchKey: T.searchKey([num, nom].join(" ")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function resumen(row, periodoInfo, requisitoInfo){
    periodoInfo = periodoInfo || P.normalize(row);
    requisitoInfo = requisitoInfo || R.resumen(row);
    var num = numero(row);
    var id = K.idEstudiantePeriodo(periodoInfo.periodoId, num);
    var carrera = nombreCarrera(row);
    var sedeText = sede(row);
    var division = divisionPrincipal(row);
    var base = {
      idEstudiantePeriodo: id,
      periodoId: periodoInfo.periodoId,
      numeroIdentificacion: num,
      nombres: nombres(row),
      codigoCarrera: codigoCarrera(row),
      nombreCarrera: carrera,
      nombreCarreraKey: T.key(carrera),
      sede: sedeText,
      sedeKey: T.key(sedeText),
      horarioComplexivo: T.cleanSpaces(T.first(row, ["horarioComplexivo", "HorarioComplexivo", "horario", "Horario"])),
      modalidad: modalidad(row),
      estadoMatricula: estadoMatricula(row),
      divisionPrincipal: division,
      divisionPrincipalKey: T.key(division),
      estadoGeneral: requisitoInfo.estadoGeneral,
      cumpleTodo: requisitoInfo.cumpleTodo,
      searchKey: T.searchKey([num, nombres(row), codigoCarrera(row), carrera, sedeText, division].join(" ")),
      syncStatus: "sincronizado",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ultimaSincronizacion: new Date().toISOString()
    };
    Object.keys(requisitoInfo.resumen || {}).forEach(function(k){ base[k] = requisitoInfo.resumen[k]; });
    return base;
  }

  function detalle(row, periodoInfo){
    periodoInfo = periodoInfo || P.normalize(row);
    var num = numero(row);
    return {
      idEstudiantePeriodo: K.idEstudiantePeriodo(periodoInfo.periodoId, num),
      periodoId: periodoInfo.periodoId,
      numeroIdentificacion: num,
      datosOriginalesFirebase: Object.assign({}, row || {}),
      camposExtra: {},
      observaciones: "",
      historialCambios: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ultimaEdicionLocal: ""
    };
  }

  function normalize(row, periodoInfo){
    periodoInfo = periodoInfo || P.normalize(row);
    var req = R.resumen(row);
    return {
      periodo: periodoInfo,
      persona: persona(row),
      resumen: resumen(row, periodoInfo, req),
      detalle: detalle(row, periodoInfo),
      requisitosInfo: req
    };
  }

  window.BDLNormEstudiante = {
    normalize: normalize,
    persona: persona,
    resumen: resumen,
    detalle: detalle,
    numero: numero
  };
})(window);
