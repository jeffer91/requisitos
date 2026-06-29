/* =========================================================
Nombre completo: bl-divisiones.service.js
Ruta o ubicación: /Requisitos/BaseLocal/services/bl-divisiones.service.js
Función o funciones:
- Manejar el campo divisiones dentro de cada estudiante.
- Listar divisiones por período.
- Evitar que una carrera se repita dentro de divisiones del mismo período.
- Asignar o quitar división a estudiantes activos y retirados según carrera.
Con qué se conecta:
- bl-filtros.js
- bl-normalizador.js
- excel-local.repo.js
- futuras pantallas de BL, Tabla, Ficha, Stats, Coordi, Defensas y Reportes
========================================================= */
(function(window){
  "use strict";

  var SIN_DIVISION = "Sin división";

  function text(value){
    if(window.BLCampos && typeof window.BLCampos.text === "function"){
      return window.BLCampos.text(value);
    }
    return String(value == null ? "" : value).trim();
  }

  function norm(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function now(){return new Date().toISOString();}
  function clone(value){try{return JSON.parse(JSON.stringify(value == null ? null : value));}catch(error){return value;}}

  function getField(row, names){
    row = row || {};
    for(var i = 0; i < names.length; i += 1){
      if(text(row[names[i]]) !== ""){
        return row[names[i]];
      }
    }
    if(window.BLCampos && typeof window.BLCampos.getValue === "function"){
      for(var j = 0; j < names.length; j += 1){
        var value = window.BLCampos.getValue(row, names[j], "");
        if(text(value) !== ""){
          return value;
        }
      }
    }
    return "";
  }

  function periodOf(row){return text(getField(row, ["periodoId", "ultimoPeriodoId", "periodId", "PeriodoId", "periodo", "Periodo"]));}
  function careerOf(row){return text(getField(row, ["nombrecarrera", "nombreCarrera", "NombreCarrera", "carrera", "Carrera", "programa", "Programa"])) || "SIN CARRERA";}

  function samePeriod(a, b){
    if(!text(a) && !text(b)){return true;}
    if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
      return window.BLPeriodosCanon.samePeriod(a, b);
    }
    return text(a) === text(b);
  }

  function normalizeDivisiones(value){
    if(Array.isArray(value)){
      var seen = {};
      var out = [];
      value.forEach(function(item){
        var name = text(typeof item === "object" && item ? (item.nombre || item.name || item.label || item.id) : item);
        if(!name || norm(name) === norm(SIN_DIVISION) || seen[norm(name)]){return;}
        seen[norm(name)] = true;
        out.push(name);
      });
      return out;
    }
    var single = text(value);
    return single && norm(single) !== norm(SIN_DIVISION) ? [single] : [];
  }

  function normalizeStudent(student){
    var out = Object.assign({}, student || {});
    out.divisiones = normalizeDivisiones(out.divisiones || out.division || out.Division || out.División);
    if(out.divisiones.length){
      out.division = out.divisiones[0];
    }else{
      delete out.division;
    }
    return out;
  }

  function studentDivision(student){
    var list = normalizeDivisiones(student && (student.divisiones || student.division || student.Division || student.División));
    return list[0] || SIN_DIVISION;
  }

  function hasDivision(student, division){
    var wanted = norm(division || "");
    if(!wanted){return true;}
    var current = norm(studentDivision(student));
    if(wanted === norm(SIN_DIVISION)){
      return current === norm(SIN_DIVISION);
    }
    return current === wanted;
  }

  function rowsByPeriod(students, periodId){
    var wanted = text(periodId || "");
    return (students || []).map(normalizeStudent).filter(function(row){return !wanted || samePeriod(periodOf(row), wanted);});
  }

  function listDivisions(students, periodId){
    var map = {};
    rowsByPeriod(students, periodId).forEach(function(row){
      var name = studentDivision(row);
      if(name && norm(name) !== norm(SIN_DIVISION)){
        map[name] = true;
      }
    });
    return Object.keys(map).sort(function(a, b){return a.localeCompare(b, "es");});
  }

  function listDivisionsWithEmpty(students, periodId){
    var list = listDivisions(students, periodId);
    var hasEmpty = rowsByPeriod(students, periodId).some(function(row){return norm(studentDivision(row)) === norm(SIN_DIVISION);});
    return hasEmpty ? [SIN_DIVISION].concat(list) : list;
  }

  function careersByPeriod(students, periodId){
    var map = {};
    rowsByPeriod(students, periodId).forEach(function(row){map[careerOf(row)] = true;});
    return Object.keys(map).sort(function(a, b){return a.localeCompare(b, "es");});
  }

  function assignedCareers(students, periodId){
    var map = {};
    rowsByPeriod(students, periodId).forEach(function(row){
      if(norm(studentDivision(row)) !== norm(SIN_DIVISION)){
        map[careerOf(row)] = studentDivision(row);
      }
    });
    return map;
  }

  function availableCareers(students, periodId){
    var assigned = assignedCareers(students, periodId);
    return careersByPeriod(students, periodId).filter(function(career){return !assigned[career];});
  }

  function applyDivision(students, periodId, divisionName, careers){
    var selected = {};
    (careers || []).forEach(function(career){selected[norm(career)] = true;});
    var division = text(divisionName);
    var updated = 0;
    var rows = (students || []).map(function(student){
      var row = normalizeStudent(student);
      if(!periodId || !samePeriod(periodOf(row), periodId) || !selected[norm(careerOf(row))]){
        return row;
      }
      row.divisiones = division ? [division] : [];
      if(division){row.division = division;}else{delete row.division;}
      row.divisionActualizadaEn = now();
      row.updatedAt = now();
      row.ultimaSincronizacion = now();
      updated += 1;
      return row;
    });
    return {students:rows, updated:updated, division:division, careers:Object.keys(selected)};
  }

  function clearDivision(students, periodId, divisionName){
    var wanted = norm(divisionName);
    var updated = 0;
    var rows = (students || []).map(function(student){
      var row = normalizeStudent(student);
      if(periodId && !samePeriod(periodOf(row), periodId)){return row;}
      if(norm(studentDivision(row)) !== wanted){return row;}
      row.divisiones = [];
      delete row.division;
      row.divisionActualizadaEn = now();
      row.updatedAt = now();
      row.ultimaSincronizacion = now();
      updated += 1;
      return row;
    });
    return {students:rows, updated:updated, division:divisionName};
  }

  function filterByDivision(students, division){
    var wanted = text(division || "");
    if(!wanted){return (students || []).map(normalizeStudent);}
    return (students || []).map(normalizeStudent).filter(function(row){return hasDivision(row, wanted);});
  }

  function divisionsSummary(students, periodId){
    var map = {};
    rowsByPeriod(students, periodId).forEach(function(row){
      var division = studentDivision(row);
      if(!map[division]){map[division] = {division:division, total:0, carreras:{}};}
      map[division].total += 1;
      map[division].carreras[careerOf(row)] = true;
    });
    return Object.keys(map).map(function(key){
      return {division:key, total:map[key].total, carreras:Object.keys(map[key].carreras).sort(function(a,b){return a.localeCompare(b,"es");})};
    }).sort(function(a,b){return a.division.localeCompare(b.division,"es");});
  }

  window.BLDivisionesService = {
    version:"1.0.0",
    sinDivision:SIN_DIVISION,
    normalizeDivisiones:normalizeDivisiones,
    normalizeStudent:normalizeStudent,
    studentDivision:studentDivision,
    hasDivision:hasDivision,
    listDivisions:listDivisions,
    listDivisionsWithEmpty:listDivisionsWithEmpty,
    careersByPeriod:careersByPeriod,
    assignedCareers:assignedCareers,
    availableCareers:availableCareers,
    applyDivision:applyDivision,
    clearDivision:clearDivision,
    filterByDivision:filterByDivision,
    divisionsSummary:divisionsSummary
  };
})(window);
