/* =========================================================
Nombre completo: bl2-migration-report.js
Ruta o ubicación: /Requisitos/BaseLocal2/migration/bl2-migration-report.js
Función o funciones:
- Revisar la foto actual de Base Local V1 antes de pasarla a BL2.
- Generar un reporte de períodos, estudiantes, cédulas, matrícula y campos críticos.
- Guardar el reporte sin modificar datos académicos.
- Servir como evidencia para migración segura hacia IndexedDB/SQLite.
Con qué se conecta:
- bl2-config.js
- bl2-schema.js
- bl2-migrate-from-v1.js
========================================================= */
(function(window){
  "use strict";

  var REPORT_KEY = "REQ_BL2_LAST_MIGRATION_REPORT";

  function now(){return new Date().toISOString();}
  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function schema(){return window.BL2Schema || null;}
  function cfg(){return window.BL2Config || null;}

  function cedulaOf(row){
    if(schema() && schema().helpers && typeof schema().helpers.cedulaOf === "function"){return schema().helpers.cedulaOf(row || {});}
    return text(row && (row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.numeroidentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion || row._docId || row.docId || row.id));
  }

  function periodoOf(row){return text(row && (row.periodoId || row.ultimoPeriodoId || row.periodoLabel || row.periodo || row.Periodo || "SIN_PERIODO"));}
  function carreraOf(row){return text(row && (row.nombreCarrera || row.nombrecarrera || row.NombreCarrera || row.carrera || row.Carrera || "SIN CARRERA"));}
  function estadoOf(row){
    if(schema() && schema().helpers && typeof schema().helpers.estadoOf === "function"){return schema().helpers.estadoOf(row || {});}
    return norm(row && row.estadoMatricula) === "retirado" ? "RETIRADO" : "ACTIVO";
  }

  function summarize(snapshot){
    snapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    var periods = Array.isArray(snapshot.periods) ? snapshot.periods : [];
    var students = Array.isArray(snapshot.students) ? snapshot.students : [];
    var history = Array.isArray(snapshot.history) ? snapshot.history : [];
    var warnings = [];
    var errors = [];
    var cedulas = Object.create(null);
    var duplicated = [];
    var withoutCedula = 0;
    var withoutPeriodo = 0;
    var byStatus = {ACTIVO:0, RETIRADO:0};
    var byCareer = Object.create(null);
    var byPeriod = Object.create(null);

    students.forEach(function(student, index){
      var cedula = cedulaOf(student);
      var periodo = periodoOf(student);
      var carrera = carreraOf(student);
      var estado = estadoOf(student);
      if(!cedula){withoutCedula += 1;warnings.push({type:"student_without_cedula", index:index, nombre:text(student && (student.nombres || student.Nombres || student.nombre || ""))});}
      else if(cedulas[cedula]){duplicated.push(cedula);}
      else{cedulas[cedula] = true;}
      if(!periodo || periodo === "SIN_PERIODO"){withoutPeriodo += 1;}
      byStatus[estado] = (byStatus[estado] || 0) + 1;
      byCareer[carrera || "SIN CARRERA"] = (byCareer[carrera || "SIN CARRERA"] || 0) + 1;
      byPeriod[periodo || "SIN_PERIODO"] = (byPeriod[periodo || "SIN_PERIODO"] || 0) + 1;
    });

    if(!students.length){errors.push({type:"empty_students", message:"No hay estudiantes para copiar a BL2."});}
    if(duplicated.length){warnings.push({type:"duplicated_cedulas", total:duplicated.length, sample:duplicated.slice(0, 20)});}
    if(withoutPeriodo){warnings.push({type:"students_without_period", total:withoutPeriodo});}

    return {
      ok:errors.length === 0,
      createdAt:now(),
      source:"BaseLocalV1",
      totals:{periods:periods.length, students:students.length, history:history.length, withoutCedula:withoutCedula, duplicatedCedulas:duplicated.length, withoutPeriodo:withoutPeriodo},
      status:byStatus,
      careers:byCareer,
      periods:byPeriod,
      warnings:warnings,
      errors:errors,
      meta:snapshot.meta || {}
    };
  }

  function save(report){
    try{window.localStorage.setItem(REPORT_KEY, JSON.stringify(report));}catch(error){}
    if(cfg() && typeof cfg().writeJson === "function"){cfg().writeJson(cfg().keys.migrationStatus, report);}
    return report;
  }

  function read(){
    try{var raw = window.localStorage.getItem(REPORT_KEY);return raw ? JSON.parse(raw) : null;}catch(error){return null;}
  }

  window.BL2MigrationReport = {version:"2.0.0-alpha.1",key:REPORT_KEY,summarize:summarize,save:save,read:read};
})(window);
