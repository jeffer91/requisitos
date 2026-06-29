/* =========================================================
Nombre completo: bl2-student-normalizer.js
Ruta o ubicación: /Requisitos/BaseLocal2/core/bl2-student-normalizer.js
Función o funciones:
- Normalizar estudiantes desde Excel, Firebase, sesión o localStorage.
- Conservar campos originales y agregar campos canónicos para todas las pantallas.
- Leer requisitos con alias flexibles con tilde, sin tilde, mayúsculas y minúsculas.
- Preparar texto de búsqueda, cédula, período, carrera, división, matrícula, contacto y notas.
Con qué se conecta:
- bl2-data-engine.js
- bl2-memory-index.js
- bl2-requirements-engine.js
- pantallas de Requisitos por medio de BL2
========================================================= */
(function(window){
  "use strict";

  var VERSION = "2.0.0-core.2";

  var FIELD_ALIASES = {
    cedula:["cedula","Cedula","Cédula","CEDULA","numeroIdentificacion","numeroidentificacion","NumeroIdentificacion","identificacion","Identificacion","_docId","docId","id"],
    nombres:["nombres","Nombres","nombre","Nombre","estudiante","Estudiante","nombresCompletos","apellidosNombres","ApellidosNombres"],
    carrera:["nombrecarrera","nombreCarrera","NombreCarrera","carrera","Carrera","programa","Programa"],
    codigocarrera:["CodigoCarrera","codigoCarrera","codigocarrera","codigo","Código"],
    periodo:["periodoLabel","periodo","Periodo","periodoId","ultimoPeriodoId","idPeriodo","periodId","_periodo","_bl2Periodo"],
    periodoid:["periodoId","ultimoPeriodoId","idPeriodo","periodId","periodoLabel","periodo","Periodo","_bl2Periodo"],
    division:["division","Division","División","_bl2Division"],
    estadomatricula:["estadoMatricula","EstadoMatricula","matricula","Matrícula","estado","Estado"],
    sede:["Sede","sede"],
    jornada:["jornada","Jornada","HorarioComplexivo","horarioComplexivo","horariocomplexivo","horario","Horario"],
    correopersonal:["CorreoPersonal","correoPersonal","correopersonal","email","correo"],
    correoinstitucional:["CorreoInstitucional","correoInstitucional","correoinstitucional"],
    celular:["Celular","celular","Telefono","telefono","Teléfono","whatsapp","Whatsapp"]
  };

  var REQUIREMENT_ALIASES = {
    academico:["Academico","Académico","academico","académico"],
    documentacion:["Documentacion","Documentación","documentacion","documentación"],
    financiero:["Financiero","financiero"],
    titulacion:["Titulacion","Titulación","titulacion","titulación"],
    practicasvinculacion:["PrácticasVinculacion","PracticasVinculacion","practicasVinculacion","prácticasVinculacion","Prácticas Vinculación","Practicas Vinculacion","Prácticas/Vinculación","Practicas/Vinculacion","practicasvinculacion","Practicas","Prácticas"],
    vinculacion:["Vinculacion","Vinculación","vinculacion","vinculación"],
    seguimientograduados:["SeguimientoGraduados","seguimientoGraduados","seguimientograduados","Seguimiento graduados"],
    ingles:["Ingles","Inglés","ingles","inglés"],
    actualizaciondatos:["ActualizaciónDatos","ActualizacionDatos","actualizacionDatos","actualizaciónDatos","actualizaciondatos","Actualización de datos","Actualizacion de datos"],
    aprobaciontitulacion:["AprobacionTitulacion","AprobaciónTitulacion","Aprobacion Titulacion","aprobacionTitulacion","aprobaciontitulacion"],
    aprobacioncomplexivoproyecto:["AprobacionComplexivoProyecto","AprobaciónComplexivoProyecto","Aprobacion Complexivo Proyecto","Aprobacion Complexivo/Proyecto","aprobacionComplexivoProyecto","aprobacioncomplexivoproyecto"]
  };

  var NOTE_ALIASES = {nart:["Notart","Nart","nart","N_ART","N-ART","NotaArt","notaArticulo","notaArtículo"],ndef:["Notdef","Ndef","ndef","N_DEF","N-DEF","NotaDef","notaDefensa"],nfin:["Notafinal","NotaFinal","Nfin","nfin","N_FIN","N-FIN","notaFinal"]};

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g,"");}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function ownValue(row, aliases){
    row = row || {}; aliases = aliases || [];
    var keys = Object.keys(row), wanted = aliases.map(compact);
    for(var i = 0; i < aliases.length; i += 1){if(Object.prototype.hasOwnProperty.call(row, aliases[i]) && text(row[aliases[i]]) !== ""){return row[aliases[i]];}}
    for(var j = 0; j < keys.length; j += 1){if(wanted.indexOf(compact(keys[j])) >= 0 && text(row[keys[j]]) !== ""){return row[keys[j]];}}
    return "";
  }

  function value(row, canonical){
    var key = compact(canonical);
    if(FIELD_ALIASES[key]){return ownValue(row, FIELD_ALIASES[key]);}
    if(REQUIREMENT_ALIASES[key]){return ownValue(row, REQUIREMENT_ALIASES[key]);}
    if(NOTE_ALIASES[key]){return ownValue(row, NOTE_ALIASES[key]);}
    return ownValue(row, [canonical]);
  }

  function estadoMatricula(row){return norm(value(row,"estadoMatricula") || "ACTIVO") === "retirado" ? "RETIRADO" : "ACTIVO";}
  function divisiones(row){var source=row||{};if(Array.isArray(source.divisiones)){return source.divisiones.map(text).filter(Boolean);}var single=text(value(source,"division"));return single && norm(single) !== "sin division" ? [single] : [];}
  function numberOrNull(value){var raw=text(value).replace(",", ".");if(!raw){return null;}var n=Number(raw);return Number.isFinite(n) ? n : null;}

  function normalize(row, options){
    options = options || {};
    var source = row && typeof row === "object" ? row : {};
    var out = options.clone === false ? Object.assign({}, source) : clone(source) || {};
    var divs = divisiones(source);
    var cedula = text(value(source,"cedula"));
    var periodoId = text(value(source,"periodoId"));
    var periodo = text(value(source,"periodo")) || periodoId;
    var carrera = text(value(source,"carrera")) || "SIN CARRERA";
    var nombres = text(value(source,"nombres")) || "Sin nombre";

    out.cedula = text(out.cedula || cedula);
    out.numeroIdentificacion = text(out.numeroIdentificacion || out.numeroidentificacion || cedula);
    out.docId = text(out.docId || out._docId || cedula);
    out.periodoId = periodoId || periodo;
    out.periodoLabel = periodo || periodoId;
    out.nombrecarrera = text(out.nombrecarrera || carrera);
    out.NombreCarrera = text(out.NombreCarrera || carrera);
    out.nombres = text(out.nombres || nombres);
    out.Nombres = text(out.Nombres || nombres);
    out.estadoMatricula = estadoMatricula(source);
    out.divisiones = divs;
    if(divs.length){out.division = divs[0];}

    Object.keys(REQUIREMENT_ALIASES).forEach(function(key){var reqValue = value(source, key);if(text(reqValue) !== ""){out[key] = reqValue;}});

    out._bl2Id = cedula || text(out._docId || out.docId || out.id);
    out._bl2Nombre = nombres;
    out._bl2Carrera = carrera;
    out._bl2CodigoCarrera = text(value(source,"codigoCarrera"));
    out._bl2Periodo = periodo || periodoId || "SIN PERÍODO";
    out._bl2PeriodoId = periodoId || periodo;
    out._bl2Division = divs[0] || "Sin división";
    out._bl2EstadoMatricula = out.estadoMatricula;
    out._bl2Sede = text(value(source,"sede"));
    out._bl2Jornada = text(value(source,"jornada"));
    out._bl2CorreoPersonal = text(value(source,"correoPersonal"));
    out._bl2CorreoInstitucional = text(value(source,"correoInstitucional"));
    out._bl2Celular = text(value(source,"celular"));
    out._bl2Notas = {nart:numberOrNull(value(source,"nart")), ndef:numberOrNull(value(source,"ndef")), nfin:numberOrNull(value(source,"nfin"))};
    out._bl2Search = norm([out._bl2Id,out._bl2Nombre,out._bl2Carrera,out._bl2Periodo,out._bl2Division,out._bl2Sede,out._bl2CorreoPersonal,out._bl2CorreoInstitucional,out._bl2Celular,out._bl2EstadoMatricula].join(" "));
    out._bl2NormalizedAt = new Date().toISOString();
    return out;
  }

  function normalizeList(rows, options){return (Array.isArray(rows) ? rows : []).map(function(row){return normalize(row, options || {});});}
  function hasRequirementValues(row){return Object.keys(REQUIREMENT_ALIASES).filter(function(key){return text(value(row,key)) !== "";}).length;}
  function signature(rows){rows = Array.isArray(rows) ? rows : [];var first = rows[0] || {}, last = rows[rows.length - 1] || {};return [rows.length, text(value(first,"cedula")), text(value(last,"cedula")), hasRequirementValues(first), hasRequirementValues(last)].join("|");}

  window.BL2StudentNormalizer = {version:VERSION,FIELD_ALIASES:FIELD_ALIASES,REQUIREMENT_ALIASES:REQUIREMENT_ALIASES,NOTE_ALIASES:NOTE_ALIASES,text:text,norm:norm,compact:compact,value:value,normalize:normalize,normalizeList:normalizeList,hasRequirementValues:hasRequirementValues,signature:signature};
})(window);
