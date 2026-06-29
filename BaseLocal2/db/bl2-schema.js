/* =========================================================
Nombre completo: bl2-schema.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-schema.js
Función o funciones:
- Definir el esquema IndexedDB principal de Base Local 2.
- Evitar que un estudiante sobrescriba otro cuando tiene la misma cédula en otro período.
- Normalizar estudiantes, períodos, requisitos, búsqueda e índices.
- Mantener compatibilidad con Excel, Firebase y Base Local V1.
========================================================= */
(function(window){
  "use strict";

  var VERSION = 3;
  var DB_NAME = "REQ_BL2_DB";

  var STORES = {
    metadata:{name:"metadata", keyPath:"key"},
    periodos:{name:"periodos", keyPath:"id"},
    estudiantes:{name:"estudiantes", keyPath:"idLocal"},
    requisitosEstado:{name:"requisitos_estado", keyPath:"id"},
    matriculaHistorial:{name:"matricula_historial", keyPath:"id"},
    divisiones:{name:"divisiones", keyPath:"id"},
    estudianteDivision:{name:"estudiante_division", keyPath:"id"},
    cargasExcel:{name:"cargas_excel", keyPath:"id"},
    syncQueue:{name:"sync_queue", keyPath:"id"},
    syncState:{name:"sync_state", keyPath:"key"},
    auditoriaLocal:{name:"auditoria_local", keyPath:"id"},
    cacheResumen:{name:"cache_resumen", keyPath:"key"}
  };

  var INDEXES = {};
  INDEXES[STORES.periodos.name] = [
    {name:"by_periodoId", keyPath:"periodoId", options:{unique:false}},
    {name:"by_label", keyPath:"label", options:{unique:false}},
    {name:"by_labelKey", keyPath:"labelKey", options:{unique:false}},
    {name:"by_activo", keyPath:"activo", options:{unique:false}},
    {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
  ];
  INDEXES[STORES.estudiantes.name] = [
    {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
    {name:"by_numeroIdentificacion", keyPath:"numeroIdentificacion", options:{unique:false}},
    {name:"by_periodoId", keyPath:"periodoId", options:{unique:false}},
    {name:"by_periodoLabel", keyPath:"periodoLabel", options:{unique:false}},
    {name:"by_estadoMatricula", keyPath:"estadoMatricula", options:{unique:false}},
    {name:"by_carrera", keyPath:"nombreCarreraKey", options:{unique:false}},
    {name:"by_sede", keyPath:"sedeKey", options:{unique:false}},
    {name:"by_jornada", keyPath:"jornadaKey", options:{unique:false}},
    {name:"by_division", keyPath:"divisionKey", options:{unique:false}},
    {name:"by_cumpleGeneral", keyPath:"cumpleGeneral", options:{unique:false}},
    {name:"by_periodo_estado", keyPath:["periodoId","estadoMatricula"], options:{unique:false}},
    {name:"by_periodo_carrera", keyPath:["periodoId","nombreCarreraKey"], options:{unique:false}},
    {name:"by_periodo_division", keyPath:["periodoId","divisionKey"], options:{unique:false}},
    {name:"by_periodo_cumple", keyPath:["periodoId","cumpleGeneral"], options:{unique:false}},
    {name:"by_cedula_periodo", keyPath:["cedula","periodoId"], options:{unique:false}},
    {name:"by_numero_periodo", keyPath:["numeroIdentificacion","periodoId"], options:{unique:false}},
    {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
  ];
  INDEXES[STORES.requisitosEstado.name] = [
    {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_requisito", keyPath:"requisito", options:{unique:false}},
    {name:"by_estado", keyPath:"estado", options:{unique:false}},
    {name:"by_cedula_requisito", keyPath:["cedula","requisito"], options:{unique:false}},
    {name:"by_periodo_requisito", keyPath:["periodoId","requisito"], options:{unique:false}}
  ];
  INDEXES[STORES.matriculaHistorial.name] = [
    {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_estado", keyPath:"estadoMatricula", options:{unique:false}},
    {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
  ];
  INDEXES[STORES.divisiones.name] = [
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_nombre", keyPath:"nombreKey", options:{unique:false}},
    {name:"by_periodo_nombre", keyPath:["periodoId","nombreKey"], options:{unique:false}}
  ];
  INDEXES[STORES.estudianteDivision.name] = [
    {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_division", keyPath:"divisionId", options:{unique:false}},
    {name:"by_periodo_division", keyPath:["periodoId","divisionId"], options:{unique:false}}
  ];
  INDEXES[STORES.cargasExcel.name] = [
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
  ];
  INDEXES[STORES.syncQueue.name] = [
    {name:"by_estado", keyPath:"estado", options:{unique:false}},
    {name:"by_entidad", keyPath:"entidad", options:{unique:false}},
    {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
  ];
  INDEXES[STORES.auditoriaLocal.name] = [
    {name:"by_entidad", keyPath:"entidad", options:{unique:false}},
    {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
  ];
  INDEXES[STORES.cacheResumen.name] = [
    {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
    {name:"by_tipo", keyPath:"tipo", options:{unique:false}},
    {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
  ];

  var REQUIREMENT_FIELDS = ["Academico","Documentacion","Financiero","Titulacion","PrácticasVinculacion","PracticasVinculacion","Vinculacion","SeguimientoGraduados","Ingles","ActualizaciónDatos","ActualizacionDatos","AprobacionTitulacion","AprobacionComplexivoProyecto"];

  function text(value){return String(value == null ? "" : value).trim();}
  function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();}
  function searchKey(value){return key(value).replace(/_/g, " ").replace(/\s+/g, " ").trim();}
  function now(){return new Date().toISOString();}
  function id(prefix){return String(prefix || "bl2") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);}
  function firstValue(row, names, fallback){row = row || {};for(var i=0;i<names.length;i+=1){if(row[names[i]] != null && text(row[names[i]]) !== ""){return row[names[i]];}}return fallback;}
  function cedulaOf(row){return text(firstValue(row, ["cedula","Cedula","Cédula","CEDULA","numeroIdentificacion","numeroidentificacion","NumeroIdentificacion","NúmeroIdentificación","identificacion","Identificacion","Identificación","_docId","docId","id"], ""));}
  function estadoOf(row){var raw = searchKey(firstValue(row, ["estadoMatricula","EstadoMatricula","estado","Estado"], "ACTIVO")).toUpperCase();if(raw.indexOf("RETIR") >= 0){return "RETIRADO";}if(raw.indexOf("INACT") >= 0){return "INACTIVO";}return "ACTIVO";}
  function cumpleValue(value){var raw = searchKey(value).toUpperCase();if(!raw){return null;}if(raw === "CUMPLE" || raw === "SI" || raw === "APROBADO" || raw === "OK"){return true;}if(raw.indexOf("NO CUMPLE") >= 0 || raw === "NO" || raw === "REPROBADO" || raw === "PENDIENTE"){return false;}return null;}
  function requirementSummary(row){var total=0,cumple=0,noCumple=0,pendientes=[];REQUIREMENT_FIELDS.forEach(function(field){if(row[field] == null){return;}var value = cumpleValue(row[field]);if(value == null){return;}total += 1;if(value){cumple += 1;}else{noCumple += 1;pendientes.push(field);}});return {total:total,cumple:cumple,noCumple:noCumple,pendientes:pendientes,porcentaje:total ? Math.round((cumple * 10000) / total) / 100 : 0,cumpleGeneral:total > 0 && noCumple === 0};}
  function compositeStudentId(cedula, periodoId){return (key(cedula) || "sin_cedula") + "__" + (key(periodoId) || "sin_periodo");}

  function normalizeStudent(row){
    var source = row && typeof row === "object" ? Object.assign({}, row) : {};
    var cedula = cedulaOf(source) || text(source.cedula) || id("sin_cedula");
    var periodoId = text(firstValue(source, ["periodoId","ultimoPeriodoId","periodoLabel","periodo","Periodo"], "SIN_PERIODO"));
    var periodoLabel = text(firstValue(source, ["periodoLabel","periodo","Periodo","ultimoPeriodoLabel"], periodoId));
    var nombres = text(firstValue(source, ["nombres","Nombres","nombre","Nombre","estudiante","Estudiante"], ""));
    var carrera = text(firstValue(source, ["nombreCarrera","nombrecarrera","NombreCarrera","carrera","Carrera"], "SIN CARRERA"));
    var sede = text(firstValue(source, ["sede","Sede"], "SIN SEDE"));
    var jornada = text(firstValue(source, ["jornada","Jornada","HorarioComplexivo","horarioComplexivo","horario"], "SIN JORNADA"));
    var division = text(firstValue(source, ["division","Division","División","_bl2Division"], "Sin división"));
    var req = requirementSummary(source);
    source.cedula = cedula;
    source.numeroIdentificacion = text(source.numeroIdentificacion || source.numeroidentificacion || cedula);
    source.periodoId = periodoId || "SIN_PERIODO";
    source.periodoLabel = periodoLabel || source.periodoId;
    source.idLocal = text(source.idLocal || source._bl2IdLocal || compositeStudentId(cedula, source.periodoId));
    source.estadoMatricula = estadoOf(source);
    source.nombres = nombres;
    source.nombreCarrera = carrera;
    source.nombreCarreraKey = key(carrera);
    source.sede = sede;
    source.sedeKey = key(sede);
    source.jornada = jornada;
    source.jornadaKey = key(jornada);
    source.division = division;
    source.divisionKey = key(division);
    source.requisitosResumen = source.requisitosResumen || req;
    source.cumpleGeneral = source.cumpleGeneral == null ? req.cumpleGeneral : !!source.cumpleGeneral;
    source.porcentajeCumplimiento = Number(source.porcentajeCumplimiento == null ? req.porcentaje : source.porcentajeCumplimiento) || 0;
    source.pendientes = Array.isArray(source.pendientes) ? source.pendientes : req.pendientes;
    source.searchText = searchKey([cedula,source.numeroIdentificacion,nombres,carrera,sede,jornada,division,source.periodoLabel,source.periodoId,source.estadoMatricula,source.cumpleGeneral ? "cumple" : "no cumple"].join(" "));
    source.updatedAt = text(source.updatedAt || source.actualizadoEn || source.forceUploadedAt) || now();
    return source;
  }

  function normalizePeriod(row){var source = row && typeof row === "object" ? Object.assign({}, row) : {};var label = text(firstValue(source, ["label","periodoLabel","periodo","Periodo","nombrePeriodo","id"], "SIN PERIODO"));var periodoId = text(firstValue(source, ["id","periodoId"], key(label)));source.id = periodoId || key(label) || id("periodo");source.periodoId = text(source.periodoId || source.id);source.label = label;source.periodoLabel = text(source.periodoLabel || label);source.labelKey = key(label);source.activo = source.activo === false ? false : true;source.updatedAt = text(source.updatedAt || source.actualizadoEn || source.creadoEn) || now();source.searchText = searchKey([source.id, source.periodoId, source.label, source.periodoLabel].join(" "));return source;}

  window.BL2Schema = {version:VERSION,dbName:DB_NAME,stores:STORES,indexes:INDEXES,requirementFields:REQUIREMENT_FIELDS.slice(),helpers:{text:text,key:key,searchKey:searchKey,now:now,id:id,firstValue:firstValue,cedulaOf:cedulaOf,estadoOf:estadoOf,cumpleValue:cumpleValue,requirementSummary:requirementSummary,compositeStudentId:compositeStudentId,normalizeStudent:normalizeStudent,normalizePeriod:normalizePeriod}};
})(window);
