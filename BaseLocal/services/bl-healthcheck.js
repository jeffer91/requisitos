/* =========================================================
Nombre completo: bl-healthcheck.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-healthcheck.js
Función o funciones:
- Revisar que Base Local tenga servicios cargados, estudiantes válidos y períodos correctos.
- Detectar cédulas faltantes, duplicadas, estados inválidos y períodos problemáticos.
- Validar divisiones: campo array, estudiantes sin división y carreras repetidas en divisiones del mismo período.
- Entregar diagnóstico simple para la pestaña Diagnóstico.
Con qué se conecta:
- bl-campos.js
- bl-periodos-canon.service.js
- bl-divisiones.service.js
- bl-matricula.service.js
- baselocal.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return window.BLCampos ? window.BLCampos.text(value) : String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}

  function normalizeEstado(value){
    if(window.BLMatriculaService && typeof window.BLMatriculaService.normalizeEstado === "function"){
      return window.BLMatriculaService.normalizeEstado(value);
    }
    var clean = text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return clean === "RETIRADO" ? "RETIRADO" : "ACTIVO";
  }

  function getCedula(student){
    if(window.BLMatriculaService && typeof window.BLMatriculaService.getCedula === "function"){
      return window.BLMatriculaService.getCedula(student);
    }
    var raw = text(student && (student.cedula || student.numeroIdentificacion || student.docId || student._docId));
    var match = raw.match(/^(\d{7,13})(?:\D|$)/);
    return match ? match[1] : raw;
  }

  function isCedulaLike(value){return /^\d{7,13}$/.test(text(value));}
  function periodKey(period){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.keyFromPeriod === "function"){
      return window.BLPeriodosCanon.keyFromPeriod(period);
    }
    return norm(period && (period.id || period.periodoId || period.label || period.periodoLabel));
  }
  function samePeriod(a,b){
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function") return window.BLPeriodosCanon.samePeriod(a,b);
    return text(a) === text(b);
  }
  function studentDivision(student){
    if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function") return window.BLDivisionesService.studentDivision(student);
    var list = Array.isArray(student && student.divisiones) ? student.divisiones : [];
    return list[0] || (student && student.division) || "Sin división";
  }
  function careerOf(student){
    return text(student && (student.nombrecarrera || student.nombreCarrera || student.NombreCarrera || student.carrera || student.Carrera)) || "SIN CARRERA";
  }

  function serviceStatus(){
    return {
      BLCampos:!!window.BLCampos,
      BLPeriodosCanon:!!window.BLPeriodosCanon,
      BLDivisionesService:!!window.BLDivisionesService,
      BLNormalizador:!!window.BLNormalizador,
      BLFiltros:!!window.BLFiltros,
      BLPeriodosService:!!window.BLPeriodosService,
      BLEstudiantesService:!!window.BLEstudiantesService,
      BLSyncDiario:!!window.BLSyncDiario,
      BLMatriculaService:!!window.BLMatriculaService,
      BLFirestorePatch:!!window.BLFirestorePatch,
      BLLimpiarBaseService:!!window.BLLimpiarBaseService,
      BaseLocalAPI:!!window.BaseLocalAPI,
      BaseLocalFirebase:!!window.BaseLocalFirebase,
      BaseLocalLimpiar:!!window.BaseLocalLimpiar,
      BaseLocalDivisionesUI:!!window.BaseLocalDivisionesUI,
      ExcelLocalStorage:!!window.ExcelLocalStorage,
      ExcelLocalRepo:!!window.ExcelLocalRepo
    };
  }

  function validatePeriods(periods, issues){
    var keys = {};
    var duplicados = [];
    var periodosCedula = [];
    periods.forEach(function(period){
      var id = text(period && (period.id || period.periodoId));
      var key = periodKey(period);
      if(isCedulaLike(id)){periodosCedula.push(id);}
      if(key){
        if(keys[key]) duplicados.push(text(period.label || period.periodoLabel || id));
        else keys[key] = true;
      }
    });
    if(duplicados.length){issues.push("Hay períodos duplicados por significado: " + duplicados.slice(0, 10).join(", ") + (duplicados.length > 10 ? "..." : ""));}
    if(periodosCedula.length){issues.push("Hay períodos que parecen cédulas: " + periodosCedula.slice(0, 10).join(", ") + (periodosCedula.length > 10 ? "..." : ""));}
    return {duplicados:duplicados, periodosCedula:periodosCedula};
  }

  function validateDivisions(students, issues){
    var sinDivision = 0;
    var divisionesNoArray = 0;
    var careerDivisionMap = {};
    var carrerasRepetidas = [];
    students.forEach(function(student){
      var division = studentDivision(student);
      var hasRaw = student && Object.prototype.hasOwnProperty.call(student, "divisiones");
      if(hasRaw && !Array.isArray(student.divisiones)) divisionesNoArray += 1;
      if(norm(division) === norm("Sin división")) sinDivision += 1;
      if(norm(division) === norm("Sin división")) return;
      var periodo = text(student && student.periodoId);
      var career = careerOf(student);
      var key = periodKey({id:periodo, label:periodo}) + "::" + norm(career);
      if(!careerDivisionMap[key]) careerDivisionMap[key] = {periodo:periodo, career:career, divisions:{}};
      careerDivisionMap[key].divisions[division] = true;
    });
    Object.keys(careerDivisionMap).forEach(function(key){
      var item = careerDivisionMap[key];
      var divs = Object.keys(item.divisions);
      if(divs.length > 1){carrerasRepetidas.push(item.career + " / " + item.periodo + " → " + divs.join(", "));}
    });
    if(divisionesNoArray){issues.push("Hay " + divisionesNoArray + " estudiante(s) con divisiones sin formato array.");}
    if(carrerasRepetidas.length){issues.push("Hay carreras repetidas en varias divisiones: " + carrerasRepetidas.slice(0, 10).join(" | ") + (carrerasRepetidas.length > 10 ? "..." : ""));}
    return {sinDivision:sinDivision, divisionesNoArray:divisionesNoArray, carrerasRepetidas:carrerasRepetidas};
  }

  function run(snapshot){
    var snap = snapshot && typeof snapshot === "object" ? snapshot : {periods:[], students:[], history:[]};
    var periods = Array.isArray(snap.periods) ? snap.periods : [];
    var students = Array.isArray(snap.students) ? snap.students : [];
    var issues = [];
    var cedulas = {};
    var estados = {ACTIVO:0, RETIRADO:0};
    var sinCedula = 0;
    var sinPeriodo = 0;
    var duplicadas = [];

    students.forEach(function(student){
      var cedula = getCedula(student);
      var periodoId = text(student && student.periodoId);
      var estado = normalizeEstado(student && student.estadoMatricula);
      estados[estado] = (estados[estado] || 0) + 1;
      if(!cedula){sinCedula += 1;}
      else if(cedulas[cedula]){duplicadas.push(cedula);}
      else{cedulas[cedula] = true;}
      if(!periodoId){sinPeriodo += 1;}
    });

    if(!periods.length){issues.push("No hay períodos en Base Local.");}
    if(!students.length){issues.push("No hay estudiantes en Base Local.");}
    if(sinCedula){issues.push("Hay " + sinCedula + " estudiantes sin cédula.");}
    if(sinPeriodo){issues.push("Hay " + sinPeriodo + " estudiantes sin periodoId.");}
    if(duplicadas.length){issues.push("Hay cédulas duplicadas: " + duplicadas.slice(0, 10).join(", ") + (duplicadas.length > 10 ? "..." : ""));}

    var periodCheck = validatePeriods(periods, issues);
    var divisionCheck = validateDivisions(students, issues);
    var services = serviceStatus();
    Object.keys(services).forEach(function(name){if(!services[name]) issues.push("Servicio no cargado: " + name);});

    return {
      ok:issues.length === 0,
      checkedAt:new Date().toISOString(),
      services:services,
      totals:{periods:periods.length, students:students.length, history:Array.isArray(snap.history) ? snap.history.length : 0},
      estados:estados,
      sinCedula:sinCedula,
      sinPeriodo:sinPeriodo,
      duplicadas:duplicadas,
      periodosCedula:periodCheck.periodosCedula,
      periodosDuplicados:periodCheck.duplicados,
      divisiones:divisionCheck,
      issues:issues
    };
  }

  window.BLHealthCheck = {run:run, serviceStatus:serviceStatus};
})(window);
