/* =========================================================
Nombre completo: bl2-schema.js
Ruta o ubicación: /Requisitos/BaseLocal2/db/bl2-schema.js
Función o funciones:
- Definir el esquema oficial de Base Local 2.0.
- Centralizar tablas, claves e índices para IndexedDB y SQLite.
- Evitar duplicar estudiantes por pantalla o módulo.
- Preparar consultas rápidas por cédula, período, matrícula, carrera y búsqueda.
Con qué se conecta:
- bl2-storage.js
- bl2-indexeddb-adapter.js
- bl2-sqlite-adapter.js
- bl2-migrations.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = 1;
  var DB_NAME = "REQ_BL2_DB";

  var STORES = {
    metadata:{name:"metadata", keyPath:"key"},
    periodos:{name:"periodos", keyPath:"id"},
    estudiantes:{name:"estudiantes", keyPath:"cedula"},
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

  var INDEXES = {
    periodos:[
      {name:"by_label", keyPath:"label", options:{unique:false}},
      {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
    ],
    estudiantes:[
      {name:"by_numeroIdentificacion", keyPath:"numeroIdentificacion", options:{unique:false}},
      {name:"by_periodoId", keyPath:"periodoId", options:{unique:false}},
      {name:"by_estadoMatricula", keyPath:"estadoMatricula", options:{unique:false}},
      {name:"by_carrera", keyPath:"nombreCarreraKey", options:{unique:false}},
      {name:"by_periodo_estado", keyPath:["periodoId","estadoMatricula"], options:{unique:false}},
      {name:"by_periodo_carrera", keyPath:["periodoId","nombreCarreraKey"], options:{unique:false}},
      {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
    ],
    requisitosEstado:[
      {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_requisito", keyPath:"requisito", options:{unique:false}},
      {name:"by_estado", keyPath:"estado", options:{unique:false}},
      {name:"by_cedula_requisito", keyPath:["cedula","requisito"], options:{unique:false}}
    ],
    matriculaHistorial:[
      {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_estado", keyPath:"estadoMatricula", options:{unique:false}},
      {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
    ],
    divisiones:[
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_nombre", keyPath:"nombreKey", options:{unique:false}}
    ],
    estudianteDivision:[
      {name:"by_cedula", keyPath:"cedula", options:{unique:false}},
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_division", keyPath:"divisionId", options:{unique:false}},
      {name:"by_periodo_division", keyPath:["periodoId","divisionId"], options:{unique:false}}
    ],
    cargasExcel:[
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
    ],
    syncQueue:[
      {name:"by_estado", keyPath:"estado", options:{unique:false}},
      {name:"by_entidad", keyPath:"entidad", options:{unique:false}},
      {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
    ],
    auditoriaLocal:[
      {name:"by_entidad", keyPath:"entidad", options:{unique:false}},
      {name:"by_createdAt", keyPath:"createdAt", options:{unique:false}}
    ],
    cacheResumen:[
      {name:"by_periodo", keyPath:"periodoId", options:{unique:false}},
      {name:"by_updatedAt", keyPath:"updatedAt", options:{unique:false}}
    ]
  };

  function text(value){return String(value == null ? "" : value).trim();}
  function key(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();}
  function now(){return new Date().toISOString();}
  function id(prefix){return String(prefix || "bl2") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);}

  function cedulaOf(row){return text(row && (row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.numeroidentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row._docId || row.docId || row.id));}
  function estadoOf(row){var raw = text(row && (row.estadoMatricula || row.EstadoMatricula || row.estado || row.Estado || "ACTIVO")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();return raw === "RETIRADO" ? "RETIRADO" : "ACTIVO";}

  function normalizeStudent(row){
    var source = row && typeof row === "object" ? Object.assign({}, row) : {};
    var cedula = cedulaOf(source);
    var periodoId = text(source.periodoId || source.ultimoPeriodoId || source.periodoLabel || source.periodo || source.Periodo || "SIN_PERIODO");
    var carrera = text(source.nombrecarrera || source.nombreCarrera || source.NombreCarrera || source.carrera || source.Carrera || "SIN CARRERA");
    source.cedula = cedula || id("sin_cedula");
    source.numeroIdentificacion = text(source.numeroIdentificacion || source.numeroidentificacion || cedula || source.cedula);
    source.periodoId = periodoId;
    source.periodoLabel = text(source.periodoLabel || source.periodo || periodoId);
    source.estadoMatricula = estadoOf(source);
    source.nombreCarrera = text(source.nombreCarrera || source.nombrecarrera || source.NombreCarrera || carrera);
    source.nombreCarreraKey = key(source.nombreCarrera || carrera);
    source.nombres = text(source.nombres || source.Nombres || source.nombre || source.Nombre || source.estudiante || source.Estudiante);
    source.searchText = key([source.cedula, source.numeroIdentificacion, source.nombres, source.nombreCarrera, source.periodoLabel, source.periodoId, source.estadoMatricula].join(" "));
    source.updatedAt = text(source.updatedAt || source.actualizadoEn || source.forceUploadedAt) || now();
    return source;
  }

  function normalizePeriod(row){
    var source = row && typeof row === "object" ? Object.assign({}, row) : {};
    var label = text(source.label || source.periodoLabel || source.periodo || source.nombrePeriodo || source.id || "SIN PERIODO");
    var periodoId = text(source.id || source.periodoId || key(label));
    source.id = periodoId || key(label) || id("periodo");
    source.periodoId = text(source.periodoId || source.id);
    source.label = label;
    source.periodoLabel = text(source.periodoLabel || label);
    source.labelKey = key(label);
    source.updatedAt = text(source.updatedAt || source.actualizadoEn || source.creadoEn) || now();
    return source;
  }

  window.BL2Schema = {
    version:VERSION,
    dbName:DB_NAME,
    stores:STORES,
    indexes:INDEXES,
    helpers:{text:text,key:key,now:now,id:id,cedulaOf:cedulaOf,estadoOf:estadoOf,normalizeStudent:normalizeStudent,normalizePeriod:normalizePeriod}
  };
})(window);
