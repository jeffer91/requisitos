/* =========================================================
Nombre completo: bl-matricula.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-matricula.service.js
Función o funciones:
- Aplicar reglas de matrícula para Base Local.
- Marcar RETIRADO cuando un estudiante ya no aparece en una nueva carga del mismo período.
- Reactivar como ACTIVO cuando vuelve a aparecer.
- Evitar duplicados: la cédula manda y el período nuevo reemplaza al anterior.
- Mantener divisiones existentes cuando se carga un nuevo Excel del mismo período.
Con qué se conecta:
- bl-campos.js
- bl-normalizador.js
- bl-divisiones.service.js
- excel-local.repo.js
- bl-firestore-patch.js
========================================================= */
(function(window){
  "use strict";

  function campos(){return window.BLCampos || null;}
  function normalizador(){return window.BLNormalizador || null;}
  function text(value){return campos()?campos().text(value):String(value == null ? "" : value).trim();}
  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function normalizeEstado(value){
    if(campos()){return campos().normalizeEstado(value);}
    var clean = text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    return clean === "RETIRADO" ? "RETIRADO" : "ACTIVO";
  }

  function getCedula(row){
    row = row || {};
    if(campos()){
      return text(campos().getValue(row, "cedula", "")) || text(campos().getValue(row, "numeroIdentificacion", ""));
    }
    return text(row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.numeroidentificacion || row.NumeroIdentificacion || row.identificacion || row.Identificacion);
  }

  function normalizeDivisiones(value){
    if(normalizador() && typeof normalizador().normalizeDivisiones === "function"){
      return normalizador().normalizeDivisiones(value);
    }
    if(window.BLDivisionesService && typeof window.BLDivisionesService.normalizeDivisiones === "function"){
      return window.BLDivisionesService.normalizeDivisiones(value);
    }
    if(Array.isArray(value)){return value.map(text).filter(Boolean);}
    var single = text(value);
    return single ? [single] : [];
  }

  function normalizeStudent(row, index, period){
    period = period || {id:"", label:""};
    var r;
    if(normalizador()){
      r = normalizador().normalizeStudent(row, index || 0, {periodoId:period.id, periodoLabel:period.label, source:"excel"});
    }else{
      r = Object.assign({}, row || {});
    }
    var id = getCedula(r) || text(r._docId || r.docId || r.id) || [period.id, "fila", (index || 0) + 1].join("_");
    r._docId = text(r._docId || r.docId || id);
    r.docId = text(r.docId || r._docId || id);
    r.cedula = text(r.cedula || r.Cedula || r.CEDULA || r.numeroIdentificacion || r.numeroidentificacion || id);
    r.numeroIdentificacion = text(r.numeroIdentificacion || r.numeroidentificacion || r.cedula || id);
    r.periodoId = period.id;
    r.ultimoPeriodoId = period.id;
    r.periodoLabel = period.label;
    r.nombres = text(r.nombres || r.Nombres || r.nombre || r.estudiante);
    r.nombrecarrera = text(r.nombrecarrera || r.nombreCarrera || r.carrera || r.NombreCarrera);
    r.estadoMatricula = normalizeEstado(r.estadoMatricula || "ACTIVO");
    r.historialEstadoMatricula = Array.isArray(r.historialEstadoMatricula) ? r.historialEstadoMatricula : [];
    r.divisiones = normalizeDivisiones(r.divisiones || r.division || r.Division || r.División);
    if(r.divisiones.length){r.division = r.divisiones[0];}else{delete r.division;}
    r.updatedAt = now();
    r.ultimaSincronizacion = now();
    return r;
  }

  function historyList(student){return Array.isArray(student && student.historialEstadoMatricula) ? student.historialEstadoMatricula.slice() : [];}

  function addStateEvent(student, estado, periodo, motivo, extra){
    var out = Object.assign({}, student || {});
    var list = historyList(out);
    list.push(Object.assign({estado:estado, fecha:now(), periodoId:periodo.id, periodoLabel:periodo.label, motivo:motivo}, extra || {}));
    out.historialEstadoMatricula = list;
    return out;
  }

  function markRetirado(student, period, motivo){
    var out = Object.assign({}, student || {});
    if(normalizeEstado(out.estadoMatricula) === "RETIRADO"){return out;}
    out.estadoMatricula = "RETIRADO";
    out.retiradoEn = text(out.retiradoEn) || now();
    out.updatedAt = now();
    out.ultimaSincronizacion = now();
    return addStateEvent(out, "RETIRADO", period, motivo || "No apareció en la última carga");
  }

  function markActivo(student, period, motivo){
    var out = Object.assign({}, student || {});
    var wasRetirado = normalizeEstado(out.estadoMatricula) === "RETIRADO";
    out.estadoMatricula = "ACTIVO";
    out.updatedAt = now();
    out.ultimaSincronizacion = now();
    if(wasRetirado){out = addStateEvent(out, "ACTIVO", period, motivo || "Volvió a aparecer en carga nueva");}
    return out;
  }

  function buildIndex(students){
    var map = {};
    (students || []).forEach(function(student){var key = getCedula(student);if(key){map[key] = clone(student);}});
    return map;
  }

  function preserveDivisiones(previous, incoming){
    var prev = normalizeDivisiones(previous && (previous.divisiones || previous.division));
    var inc = normalizeDivisiones(incoming && (incoming.divisiones || incoming.division));
    return inc.length ? inc : prev;
  }

  function reconcile(snapshot, incomingRows, period, options){
    options = options || {};
    var snap = snapshot && typeof snapshot === "object" ? snapshot : {students:[]};
    var currentStudents = Array.isArray(snap.students) ? snap.students : [];
    var rows = Array.isArray(incomingRows) ? incomingRows : [];
    var stats = {added:0, updated:0, retired:0, reactivated:0, moved:0, totalIncoming:rows.length};
    var byCedula = buildIndex(currentStudents);
    var incomingCedulas = {};
    var normalizedIncoming = rows.map(function(row, index){return normalizeStudent(row, index, period);});

    normalizedIncoming.forEach(function(incoming){
      var cedula = getCedula(incoming);
      if(!cedula){return;}
      incomingCedulas[cedula] = true;
      var previous = byCedula[cedula] || null;
      var wasRetirado = previous && normalizeEstado(previous.estadoMatricula) === "RETIRADO";
      var moved = previous && text(previous.periodoId) && text(previous.periodoId) !== text(period.id);
      var divisiones = preserveDivisiones(previous, incoming);
      var merged = Object.assign({}, previous || {}, incoming, {cedula:cedula, numeroIdentificacion:text(incoming.numeroIdentificacion || cedula), periodoId:period.id, ultimoPeriodoId:period.id, periodoLabel:period.label, estadoMatricula:"ACTIVO", divisiones:divisiones, updatedAt:now(), ultimaSincronizacion:now()});
      if(divisiones.length){merged.division = divisiones[0];}else{delete merged.division;}
      if(!previous){stats.added += 1;}else{stats.updated += 1;}
      if(moved){stats.moved += 1;merged = addStateEvent(merged, "ACTIVO", period, "Cambio de período: se reemplazó el período anterior", {periodoAnterior:previous.periodoId || ""});}
      if(wasRetirado){stats.reactivated += 1;merged = addStateEvent(merged, "ACTIVO", period, "Volvió a aparecer en carga nueva");}
      byCedula[cedula] = merged;
    });

    Object.keys(byCedula).forEach(function(cedula){
      var student = byCedula[cedula];
      if(text(student.periodoId) === text(period.id) && !incomingCedulas[cedula]){
        var before = normalizeEstado(student.estadoMatricula);
        byCedula[cedula] = markRetirado(student, period, "No apareció en la última carga del período");
        if(before !== "RETIRADO"){stats.retired += 1;}
      }
    });

    return {students:Object.keys(byCedula).map(function(cedula){return byCedula[cedula];}), stats:stats, incoming:normalizedIncoming};
  }

  window.BLMatriculaService = {getCedula:getCedula, normalizeEstado:normalizeEstado, normalizeStudent:normalizeStudent, markRetirado:markRetirado, markActivo:markActivo, reconcile:reconcile, normalizeDivisiones:normalizeDivisiones};
})(window);
