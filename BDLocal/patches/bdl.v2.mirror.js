/* =========================================================
Archivo: bdl.v2.mirror.js
Ruta: /BDLocal/patches/bdl.v2.mirror.js
Funcion:
- Espejar datos legacy hacia tablas V2 sin borrar nada.
- Mantener compatibilidad: el Core puede seguir usando tablas antiguas.
- Preparar personas, matriculas_periodo, requisitos_estudiante,
  contactos_estudiante, notas_titulacion y divisiones_estudiante.
- No bloquea la app si el espejo falla.
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0";
  var FLAG = "__bdlV2MirrorInstalled";
  if(window[FLAG]){ return; }
  window[FLAG] = true;

  function text(value){ return String(value == null ? "" : value).trim(); }
  function nowISO(){ return new Date().toISOString(); }
  function clone(value){
    if(value === undefined){ return undefined; }
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(error){ return value; }
  }
  function normalizeCedula(value){
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "");
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }
  function stores(){
    var cfg = window.BL2Config || {};
    var s = cfg.stores || {};
    return {
      estudiantes:s.estudiantes || "estudiantes",
      requisitos:s.requisitos || "requisitos",
      contactos:s.contactos || "contactos",
      notas:s.notas || "notas",
      periodos:s.periodos || "periodos",
      personas:s.personas || "personas",
      matriculas:s.matriculasPeriodo || "matriculas_periodo",
      requisitosV2:s.requisitosEstudiante || "requisitos_estudiante",
      contactosV2:s.contactosEstudiante || "contactos_estudiante",
      notasV2:s.notasTitulacion || "notas_titulacion",
      divisiones:s.divisionesEstudiante || "divisiones_estudiante",
      periodosCarreras:s.periodosCarreras || "periodos_carreras",
      periodosDivisiones:s.periodosDivisiones || "periodos_divisiones"
    };
  }
  function studentId(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || row.ultimoPeriodoId || "");
    return text(row.id || row.studentId || row.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : ""));
  }
  function personaFromStudent(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    if(!cedula){ return null; }
    return {
      cedula:cedula,
      numeroIdentificacion:cedula,
      nombreCompleto:text(row.Nombres || row.nombres || row.Nombre || row.nombre || ""),
      correoPersonal:text(row.CorreoPersonal || row.correoPersonal || ""),
      correoInstitucional:text(row.CorreoInstitucional || row.correoInstitucional || ""),
      celular:text(row.Celular || row.celular || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    };
  }
  function matriculaFromStudent(row){
    row = row || {};
    var id = studentId(row);
    var cedula = normalizeCedula(row.cedula || row.numeroIdentificacion || row.NumeroIdentificacion || "");
    var periodoId = text(row.periodoId || row.periodId || row.ultimoPeriodoId || "");
    if(!id || !cedula || !periodoId){ return null; }
    return {
      idEstudiantePeriodo:id,
      cedula:cedula,
      periodoId:periodoId,
      periodoLabel:text(row.periodoLabel || row.Periodo || row.periodo || periodoId),
      carrera:text(row.NombreCarrera || row.nombreCarrera || row.Carrera || row.carrera || ""),
      codigoCarrera:text(row.CodigoCarrera || row.codigoCarrera || ""),
      division:text(row.division || row._division || ""),
      estadoMatricula:text(row.estadoMatricula || "ACTIVO").toUpperCase() === "RETIRADO" ? "RETIRADO" : "ACTIVO",
      sede:text(row.Sede || row.sede || ""),
      horarioComplexivo:text(row.HorarioComplexivo || row.horarioComplexivo || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    };
  }
  function divisionFromStudent(row){
    var id = studentId(row);
    var division = text(row && (row.division || row._division || ""));
    if(!id || !division){ return null; }
    return {
      id:id + "__" + division.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      idEstudiantePeriodo:id,
      cedula:normalizeCedula(row.cedula || row.numeroIdentificacion || ""),
      periodoId:text(row.periodoId || row.periodId || ""),
      division:division,
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    };
  }
  function requisitoV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || "");
    var periodoId = text(row.periodoId || "");
    var key = text(row.key || row.nombre || row.requisitoKey || "");
    var idEP = text(row.studentId || row.idEstudiantePeriodo || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!cedula || !periodoId || !key){ return null; }
    return Object.assign({}, row, {
      id:row.id || (idEP + "__" + key.toLowerCase().replace(/[^a-z0-9]+/g, "_")),
      idEstudiantePeriodo:idEP,
      cedula:cedula,
      periodoId:periodoId,
      requisitoKey:key,
      estado:text(row.estado || row.valor || row.value || ""),
      source:"v2_mirror",
      updatedAt:text(row.updatedAt || "") || nowISO()
    });
  }
  function contactoV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || "");
    var periodoId = text(row.periodoId || "");
    var idEP = text(row.studentId || row.idEstudiantePeriodo || row.id || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!cedula || !periodoId){ return null; }
    return Object.assign({}, row, { id:row.id || idEP, idEstudiantePeriodo:idEP, cedula:cedula, periodoId:periodoId, source:"v2_mirror", updatedAt:text(row.updatedAt || "") || nowISO() });
  }
  function notaV2(row){
    row = row || {};
    var cedula = normalizeCedula(row.cedula || "");
    var periodoId = text(row.periodoId || "");
    var idEP = text(row.idEstudiantePeriodo || row.studentId || row.id || (cedula && periodoId ? cedula + "__" + periodoId : ""));
    if(!idEP || !cedula || !periodoId){ return null; }
    return Object.assign({}, row, { idEstudiantePeriodo:idEP, cedula:cedula, periodoId:periodoId, source:"v2_mirror", updatedAt:text(row.updatedAt || "") || nowISO() });
  }
  function periodRows(period){
    period = period || {};
    var periodoId = text(period.id || period.periodoId || "");
    var out = [];
    if(!periodoId){ return out; }
    (Array.isArray(period.carrerasDetectadas) ? period.carrerasDetectadas : []).forEach(function(carrera){
      var label = text(carrera.nombre || carrera.label || carrera.carrera || carrera);
      if(label){ out.push({ type:"career", id:periodoId + "__" + label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), periodoId:periodoId, carrera:label, updatedAt:nowISO(), source:"v2_mirror" }); }
    });
    (Array.isArray(period.divisiones) ? period.divisiones : []).forEach(function(division){
      division = text(division);
      if(division){ out.push({ type:"division", id:periodoId + "__" + division.toLowerCase().replace(/[^a-z0-9]+/g, "_"), periodoId:periodoId, division:division, updatedAt:nowISO(), source:"v2_mirror" }); }
    });
    return out;
  }
  function mirrorRows(storeName, rows, originalPut, originalBulkPut){
    var s = stores();
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length){ return Promise.resolve({ mirrored:0 }); }
    var tasks = [];
    if(storeName === s.estudiantes){
      var personas = rows.map(personaFromStudent).filter(Boolean);
      var matriculas = rows.map(matriculaFromStudent).filter(Boolean);
      var divisiones = rows.map(divisionFromStudent).filter(Boolean);
      if(personas.length){ tasks.push(originalBulkPut(s.personas, personas)); }
      if(matriculas.length){ tasks.push(originalBulkPut(s.matriculas, matriculas)); }
      if(divisiones.length){ tasks.push(originalBulkPut(s.divisiones, divisiones)); }
    }
    if(storeName === s.requisitos){
      var requisitos = rows.map(requisitoV2).filter(Boolean);
      if(requisitos.length){ tasks.push(originalBulkPut(s.requisitosV2, requisitos)); }
    }
    if(storeName === s.contactos){
      var contactos = rows.map(contactoV2).filter(Boolean);
      if(contactos.length){ tasks.push(originalBulkPut(s.contactosV2, contactos)); }
    }
    if(storeName === s.notas){
      var notas = rows.map(notaV2).filter(Boolean);
      if(notas.length){ tasks.push(originalBulkPut(s.notasV2, notas)); }
    }
    if(storeName === s.periodos){
      rows.forEach(function(period){
        periodRows(period).forEach(function(item){
          if(item.type === "career"){ tasks.push(originalPut(s.periodosCarreras, item)); }
          if(item.type === "division"){ tasks.push(originalPut(s.periodosDivisiones, item)); }
        });
      });
    }
    if(!tasks.length){ return Promise.resolve({ mirrored:0 }); }
    return Promise.all(tasks).then(function(){ return { mirrored:tasks.length }; });
  }
  function install(){
    var db = window.BL2DB || null;
    if(!db || typeof db.put !== "function" || typeof db.bulkPut !== "function"){ return false; }
    if(db.__v2MirrorInstalled){ return true; }
    var originalPut = db.put.bind(db);
    var originalBulkPut = db.bulkPut.bind(db);
    db.put = function(storeName, value){
      return originalPut(storeName, value).then(function(saved){
        return mirrorRows(storeName, [saved || value], originalPut, originalBulkPut).catch(function(error){
          try{ console.warn("[BDLV2Mirror] No se pudo espejar a V2", error); }catch(innerError){}
          return null;
        }).then(function(){ return saved; });
      });
    };
    db.bulkPut = function(storeName, rows){
      rows = Array.isArray(rows) ? rows : [];
      return originalBulkPut(storeName, rows).then(function(saved){
        return mirrorRows(storeName, saved && saved.length ? saved : rows, originalPut, originalBulkPut).catch(function(error){
          try{ console.warn("[BDLV2Mirror] No se pudo espejar lote a V2", error); }catch(innerError){}
          return null;
        }).then(function(){ return saved; });
      });
    };
    db.__v2MirrorInstalled = true;
    db.v2MirrorVersion = VERSION;
    try{ window.dispatchEvent(new CustomEvent("bdlocal:v2-mirror-ready", { detail:{ version:VERSION, at:nowISO() } })); }catch(error){}
    return true;
  }
  window.BDLV2Mirror = { version:VERSION, install:install, mirrorRows:mirrorRows };
  install();
})(window);
