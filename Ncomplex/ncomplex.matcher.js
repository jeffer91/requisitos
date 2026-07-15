/* =========================================================
Nombre completo: ncomplex.matcher.js
Ruta o ubicación: /Ncomplex/ncomplex.matcher.js
Función o funciones:
- Cruzar filas importadas con estudiantes del período mediante la cédula.
- Detectar duplicados, no encontrados y conflictos con notas ya guardadas.
- Preparar propuestas de actualización sin sobrescribir datos de forma silenciosa.
Con qué se conecta:
- ncomplex.parser.js
- ncomplex.calculator.js
- ncomplex.state.js
- ncomplex.save.js
- ncomplex.app.js
========================================================= */
(function(window){
  "use strict";

  var Calculator = window.NcomplexCalculator || {};
  var Config = window.NcomplexConfig || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeCedula(value){
    var parser = window.NcomplexParser;
    if(parser && typeof parser.normalizeCedula === "function"){
      return parser.normalizeCedula(value);
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function recordId(row){
    row = row || {};
    return text(row.idEstudiantePeriodo || row.studentId || row.id || row.cedula);
  }

  function studentCedula(row){
    row = row || {};
    return normalizeCedula(
      row.cedula ||
      row.numeroIdentificacion ||
      row.NumeroIdentificacion ||
      row._cedula
    );
  }

  function note(value){
    return typeof Calculator.parse === "function"
      ? Calculator.parse(value)
      : value;
  }

  function sameNote(first, second){
    first = note(first);
    second = note(second);
    if(first == null && second == null){ return true; }
    if(first == null || second == null){ return false; }
    return Math.abs(first - second) < 0.005;
  }

  function incomingFields(imported){
    var result = {};
    [
      "notaTeorica",
      "notaPractica",
      "notaSupletorio",
      "notaTrabajoTitulacion"
    ].forEach(function(field){
      var value = note(imported[field]);
      if(value != null){ result[field] = value; }
    });

    if(imported.codigoTitulacion){ result.codigoTitulacion = imported.codigoTitulacion; }
    if(imported.horario){ result.horarioOrigen = imported.horario; }
    if(imported.trabajoPromedioAcumulado != null){
      result.trabajoPromedioAcumulado = imported.trabajoPromedioAcumulado;
    }
    return result;
  }

  function conflicts(existing, incoming){
    var list = [];
    Object.keys(incoming).forEach(function(field){
      if(field.indexOf("nota") !== 0){ return; }
      var oldValue = existing ? existing[field] : null;
      var newValue = incoming[field];
      if(oldValue != null && !sameNote(oldValue, newValue)){
        list.push({
          field: field,
          current: note(oldValue),
          incoming: note(newValue)
        });
      }
    });
    return list;
  }

  function match(parsedRows, students, options){
    options = options || {};
    parsedRows = Array.isArray(parsedRows) ? parsedRows : [];
    students = Array.isArray(students) ? students : [];

    var studentsByCedula = Object.create(null);
    students.forEach(function(student){
      var cedula = studentCedula(student);
      if(cedula && !studentsByCedula[cedula]){
        studentsByCedula[cedula] = student;
      }
    });

    var seen = Object.create(null);
    var result = {
      ok: true,
      matches: [],
      unmatched: [],
      duplicates: [],
      conflicts: [],
      totalImported: parsedRows.length,
      totalStudents: students.length,
      totalMatched: 0,
      totalUnmatched: 0,
      totalDuplicates: 0,
      totalConflicts: 0
    };

    parsedRows.forEach(function(imported){
      var cedula = normalizeCedula(imported.cedula);
      if(!cedula){
        result.unmatched.push({ imported: imported, reason: "Cédula vacía" });
        return;
      }

      if(seen[cedula]){
        result.duplicates.push({ imported: imported, first: seen[cedula] });
        return;
      }
      seen[cedula] = imported;

      var student = studentsByCedula[cedula];
      if(!student){
        result.unmatched.push({ imported: imported, reason: "No existe en el período seleccionado" });
        return;
      }

      var incoming = incomingFields(imported);
      var conflictList = conflicts(student, incoming);
      var proposed = Object.assign({}, student, incoming, {
        cedula: cedula,
        numeroIdentificacion: cedula,
        importacionPendiente: true,
        origen: "ncomplex_texto_pegado"
      });

      if(!student.modalidadTitulacion){
        proposed.modalidadTitulacion = imported.suggestedModality ||
          (Config.modalidades && Config.modalidades.COMPLEXIVO);
      }

      if(typeof Calculator.recalculate === "function"){
        proposed = Calculator.recalculate(proposed);
      }

      var item = {
        id: recordId(student),
        cedula: cedula,
        student: student,
        imported: imported,
        incoming: incoming,
        proposed: proposed,
        conflicts: conflictList,
        hasConflict: conflictList.length > 0,
        apply: conflictList.length === 0
      };

      result.matches.push(item);
      if(conflictList.length){ result.conflicts.push(item); }
    });

    result.totalMatched = result.matches.length;
    result.totalUnmatched = result.unmatched.length;
    result.totalDuplicates = result.duplicates.length;
    result.totalConflicts = result.conflicts.length;
    return result;
  }

  function apply(matches, records, options){
    options = options || {};
    matches = Array.isArray(matches) ? matches : [];
    records = Array.isArray(records) ? records : [];

    var map = Object.create(null);
    matches.forEach(function(item){
      if(!item || !item.id){ return; }
      if(item.hasConflict && options.includeConflicts !== true){ return; }
      if(item.apply === false && options.includeRejected !== true){ return; }
      map[item.id] = item.proposed;
    });

    var changed = [];
    var output = records.map(function(row){
      var id = recordId(row);
      if(!map[id]){ return row; }
      var next = Object.assign({}, row, map[id]);
      changed.push(next);
      return next;
    });

    return { records: output, changed: changed };
  }

  window.NcomplexMatcher = {
    version: "1.0.0-bloque-2",
    match: match,
    apply: apply,
    normalizeCedula: normalizeCedula,
    incomingFields: incomingFields,
    conflicts: conflicts
  };
})(window);