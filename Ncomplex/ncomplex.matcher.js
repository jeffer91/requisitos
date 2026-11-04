/* =========================================================
Nombre completo: ncomplex.matcher.js
Ruta o ubicación: /Ncomplex/ncomplex.matcher.js
Función o funciones:
- Cruzar filas importadas con estudiantes del período.
- Priorizar cédula, luego correo institucional y finalmente nombre completo.
- Reconocer nombres aunque el orden de nombres y apellidos sea diferente.
- Detectar coincidencias ambiguas, duplicados y conflictos de notas.
- Preparar propuestas sin sobrescribir calificaciones existentes silenciosamente.
========================================================= */
(function(window){
  "use strict";

  var Calculator = window.NcomplexCalculator || {};
  var Config = window.NcomplexConfig || {};

  function text(value){
    return String(value == null ? "" : value).trim();
  }

  function normalized(value){
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeCedula(value){
    var parser = window.NcomplexParser;
    if(parser && typeof parser.normalizeCedula === "function"){
      return parser.normalizeCedula(value);
    }
    var raw = text(value).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    return /^\d{9}$/.test(raw) ? "0" + raw : raw;
  }

  function normalizeEmail(value){
    var parser = window.NcomplexParser;
    if(parser && typeof parser.normalizeEmail === "function"){
      return parser.normalizeEmail(value);
    }
    return text(value).toLowerCase().replace(/^mailto:/, "");
  }

  function nameFingerprint(value){
    var words = normalized(value).split(" ").filter(Boolean);
    words.sort();
    return words.join("|");
  }

  // Moodle suele pegar las iniciales del avatar al primer nombre: "TVTANIA".
  // Solo se elimina un prefijo si el nombre completo restante coincide
  // EXACTAMENTE con una única matrícula del período (incluyendo apellidos).
  function nameWithoutMoodleInitials(value, indexes){
    var words = normalized(value).split(" ").filter(Boolean);
    if(words.length < 3 || words[0].length < 5){ return null; }
    var distinct=Object.create(null), candidates=[];
    for(var count=1;count<=3;count++){
      if(words[0].length-count<3){continue;}
      var corrected=[words[0].slice(count)].concat(words.slice(1)).join(" ");
      var fp=nameFingerprint(corrected);
      var matched=indexes.byFingerprint[fp]||[];
      matched.forEach(function(student){
        var key=recordId(student);
        if(!key){return;}
        if(!distinct[key]){
          distinct[key]=true;
          candidates.push({student:student,initialsRemoved:count,normalizedMoodleName:corrected});
        }
      });
    }
    if(!candidates.length){return null;}
    if(candidates.length!==1){return {ambiguous:true};}
    return Object.assign({method:"nombre",reordered:true,correctedInitials:true},candidates[0]);
  }

  // En BDLocal el institucional puede estar en correoInstitucional, en
  // Correos u otro campo de contacto. Se indexan todos los correos válidos.
  function studentEmails(row){
    row=row||{};
    var fields=[
      "correoInstitucional","CorreoInstitucional","emailInstitucional","EmailInstitucional",
      "correoElectronico","CorreoElectronico","direccionCorreo","DireccionCorreo",
      "correoPersonal","CorreoPersonal","emailPersonal","EmailPersonal",
      "correo","Correo","email","Email","mail","Mail","correos","Correos","_correo"
    ];
    var unique=Object.create(null),all=[];
    fields.forEach(function(field){
      var value=row[field];
      if(typeof value!=="string" && !Array.isArray(value)){return;}
      var source=Array.isArray(value)?value.join(" "):value;
      var emails=source.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[];
      emails.forEach(function(email){
        var key=normalizeEmail(email);
        if(!unique[key]){unique[key]=true;all.push(key);}
      });
    });
    return all;
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

  function studentEmail(row){
    var emails=studentEmails(row);
    return emails.length?emails[0]:"";
  }

  function studentName(row){
    row = row || {};
    return text(
      row.Nombres ||
      row.nombres ||
      row.Nombre ||
      row.nombre ||
      row.nombreCompleto ||
      row.NombreCompleto ||
      row.Estudiante ||
      row.estudiante
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
      "notaTeoricaSupletorio",
      "notaPracticaSupletorio",
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

  function addToMap(map, key, student){
    if(!key){ return; }
    if(!map[key]){ map[key] = []; }
    map[key].push(student);
  }

  function uniqueFromMap(map, key){
    var rows = key && map[key] ? map[key] : [];
    return rows.length === 1 ? rows[0] : null;
  }

  function ambiguousInMap(map, key){
    return !!(key && map[key] && map[key].length > 1);
  }

  function resolveStudent(imported, indexes){
    var cedula = normalizeCedula(imported.cedula);
    var email = normalizeEmail(imported.correo || imported.email);
    var name = normalized(imported.nombreCompleto || imported.nombre);
    var fingerprint = nameFingerprint(imported.nombreCompleto || imported.nombre);
    var student = null;

    if(cedula){
      student = uniqueFromMap(indexes.byCedula, cedula);
      if(student){ return { student: student, method: "cedula", key: cedula }; }
      if(ambiguousInMap(indexes.byCedula, cedula)){
        return { student: null, method: "cedula", key: cedula, ambiguous: true };
      }
    }

    if(email){
      student = uniqueFromMap(indexes.byEmail, email);
      if(student){
        var verifiedName=uniqueFromMap(indexes.byFingerprint,fingerprint);
        var correctedName=nameWithoutMoodleInitials(imported.nombreCompleto||imported.nombre,indexes);
        var byName=verifiedName || (correctedName && !correctedName.ambiguous && correctedName.student);
        if(byName && recordId(byName)!==recordId(student)){
          return {student:null,method:"correo/nombre",key:email,ambiguous:true};
        }
        return { student: student, method: "correo", key: email };
      }
      if(ambiguousInMap(indexes.byEmail, email)){
        return { student: null, method: "correo", key: email, ambiguous: true };
      }
    }

    if(name){
      student = uniqueFromMap(indexes.byName, name);
      if(student){ return { student: student, method: "nombre", key: name }; }
      if(ambiguousInMap(indexes.byName, name)){
        return { student: null, method: "nombre", key: name, ambiguous: true };
      }
    }

    if(fingerprint){
      student = uniqueFromMap(indexes.byFingerprint, fingerprint);
      if(student){ return { student: student, method: "nombre", key: fingerprint, reordered: true }; }
      if(ambiguousInMap(indexes.byFingerprint, fingerprint)){
        return { student: null, method: "nombre", key: fingerprint, ambiguous: true };
      }
    }

    var fixed=nameWithoutMoodleInitials(imported.nombreCompleto||imported.nombre,indexes);
    if(fixed){
      if(fixed.ambiguous){return {student:null,method:"nombre/iniciales",key:"",ambiguous:true};}
      return {
        student:fixed.student,method:"nombre",key:nameFingerprint(fixed.normalizedMoodleName),
        reordered:true,correctedInitials:true,initialsRemoved:fixed.initialsRemoved,
        normalizedMoodleName:fixed.normalizedMoodleName
      };
    }
    return { student: null, method: "", key: "", ambiguous: false };
  }

  // Sugerencias basadas en nombres, nunca equivalen a una identidad confirmada.
  function suggestCandidates(imported,students,limit){
    var words=normalized(imported.nombreCompleto||imported.nombre).split(" ").filter(Boolean);
    var variants=[words];
    if(words.length>=3&&words[0].length>=5){
      for(var n=1;n<=3;n++)if(words[0].length-n>=3)
        variants.push([words[0].slice(n)].concat(words.slice(1)));
    }
    return (students||[]).map(function(st){
      var target=normalized(studentName(st)).split(" ").filter(Boolean);
      if(target.length<2||!recordId(st)){return null;}
      var score=0;
      variants.forEach(function(tokens){
        var a=Object.create(null),b=Object.create(null),union=Object.create(null),intersection=0;
        tokens.forEach(function(v){a[v]=true;union[v]=true;});
        target.forEach(function(v){b[v]=true;union[v]=true;});
        Object.keys(a).forEach(function(v){if(b[v])intersection++;});
        if(intersection>=2)score=Math.max(score,intersection/Object.keys(union).length);
      });
      return score>0?{id:recordId(st),cedula:studentCedula(st),nombre:studentName(st),score:Math.round(score*100)}:null;
    }).filter(Boolean).sort(function(a,b){return b.score-a.score||a.nombre.localeCompare(b.nombre);})
      .slice(0,Math.max(1,Math.min(10,Number(limit)||6)));
  }

  function importedLabel(imported){
    var nombre=text(imported.nombreCompleto||imported.nombre);
    var correo=text(imported.correo||imported.email);
    return nombre&&correo?nombre+" ("+correo+")":
      nombre||correo||text(imported.cedula)||"Registro sin identificación";
  }

  function match(parsedRows, students, options){
    options = options || {};
    parsedRows = Array.isArray(parsedRows) ? parsedRows : [];
    students = Array.isArray(students) ? students : [];

    var indexes = {
      byCedula: Object.create(null),
      byEmail: Object.create(null),
      byName: Object.create(null),
      byFingerprint: Object.create(null)
    };

    /* Nombre conservado para compatibilidad con diagnósticos existentes. */
    var studentsByCedula = indexes.byCedula;

    students.forEach(function(student){
      addToMap(studentsByCedula, studentCedula(student), student);
      studentEmails(student).forEach(function(email){addToMap(indexes.byEmail,email,student);});
      addToMap(indexes.byName, normalized(studentName(student)), student);
      addToMap(indexes.byFingerprint, nameFingerprint(studentName(student)), student);
    });

    var seenStudents = Object.create(null);
    var result = {
      ok: true,
      matches: [],
      unmatched: [],
      review: [],
      duplicates: [],
      conflicts: [],
      totalImported: parsedRows.length,
      totalStudents: students.length,
      totalMatched: 0,
      totalUnmatched: 0,
      totalReview: 0,
      totalDuplicates: 0,
      totalConflicts: 0,
      matchedByCedula: 0,
      matchedByEmail: 0,
      matchedByName: 0,
      matchedByInitials: 0,
      matchedByManual: 0
    };

    parsedRows.forEach(function(imported){
      if(imported.blocked===true || imported.issues && imported.issues.length){
        result.review.push({imported:imported,label:importedLabel(imported),reason:(imported.issues||[]).join(" | ")||"Notas pendientes de conciliación"});return;
      }
      var manual=options.manualOverrides&&options.manualOverrides[Number(imported.rowNumber)];
      var resolved=manual?{
        student:students.filter(function(st){return recordId(st)===String(manual);})[0]||null,
        method:"manual",key:String(manual),ambiguous:true
      }:resolveStudent(imported,indexes);
      var student=resolved.student;

      if(!student){
        result.unmatched.push({
          imported: imported,
          label: importedLabel(imported),
          suggestions:suggestCandidates(imported,students,6),
          reason: resolved.ambiguous
            ? "La coincidencia por " + resolved.method + " es ambigua"
            : "No existe en el período seleccionado o no hay una coincidencia única"
        });
        return;
      }

      var id = recordId(student);
      if(!id){
        result.unmatched.push({
          imported: imported,
          label: importedLabel(imported),
          reason: "El estudiante encontrado no tiene identificador interno"
        });
        return;
      }

      if(seenStudents[id]){
        result.duplicates.push({
          imported: imported,
          label: importedLabel(imported),
          first: seenStudents[id],
          student: student
        });
        return;
      }
      seenStudents[id] = imported;

      if(resolved.method === "cedula"){ result.matchedByCedula += 1; }
      else if(resolved.method === "manual"){result.matchedByManual += 1;}
      else if(resolved.method === "correo"){ result.matchedByEmail += 1; }
      else if(resolved.method === "nombre"){
        result.matchedByName += 1;
        if(resolved.correctedInitials===true){result.matchedByInitials += 1;}
      }

      var cedula = studentCedula(student);
      var incoming = incomingFields(imported);
      var conflictList = conflicts(student, incoming);
      var proposed = Object.assign({}, student, incoming, {
        cedula: cedula,
        numeroIdentificacion: cedula,
        importacionPendiente: true,
        origen: imported.format === "moodle_gradebook"
          ? "ncomplex_moodle"
          : "ncomplex_texto_pegado"
      });

      if(!student.modalidadTitulacion){
        proposed.modalidadTitulacion = imported.suggestedModality ||
          (Config.modalidades && Config.modalidades.COMPLEXIVO);
      }

      if(typeof Calculator.recalculate === "function"){
        proposed = Calculator.recalculate(proposed);
      }

      var item = {
        id: id,
        cedula: cedula,
        correo: studentEmail(student),
        nombre: studentName(student),
        matchMethod: resolved.method,
        matchReorderedName: resolved.reordered === true,
        matchInitials: resolved.correctedInitials === true,
        normalizedMoodleName: resolved.normalizedMoodleName || "",
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
    result.totalReview = result.review.length;
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
    version: "2.0.1-email-name-matching",
    match: match,
    apply: apply,
    normalizeCedula: normalizeCedula,
    normalizeEmail: normalizeEmail,
    nameFingerprint: nameFingerprint,
    studentEmail: studentEmail,
    studentEmails: studentEmails,
    studentName: studentName,
    suggestCandidates: suggestCandidates,
    incomingFields: incomingFields,
    conflicts: conflicts
  };
})(window);
