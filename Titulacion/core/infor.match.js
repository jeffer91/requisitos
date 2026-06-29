/* =========================================================
Nombre completo: infor.match.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.match.js
Función o funciones:
- Unir filas del Excel de Infor con estudiantes de BaseLocal/BL2.
- Hacer match por cédula, considerando cédula con o sin cero inicial.
- Usar nombres normalizados como respaldo cuando no exista cédula.
- Asignar modalidad de titulación automática para el informe.
Con qué se conecta:
- core/infor.state.js
- core/infor.periodo.js
- BaseLocal2/repositories/bl2-estudiantes.repo.js
- Gestion/Excel/excel-local.repo.js
- frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}
  function onlyDigits(value){return text(value).replace(/[^0-9]/g, "");}

  var CEDULA_ALIASES = ["cedula","cédula","numeroidentificacion","numero identificacion","identificacion","id","documento","dni"];
  var NAME_ALIASES = ["nombres","nombre","estudiante","apellidosynombres","apellidos nombres","alumno","participante"];
  var CAREER_ALIASES = ["carrera","nombrecarrera","nombre carrera","programa","especialidad"];
  var TITLE_ALIASES = ["titulo","título","tema","articulo","artículo","trabajo","propuesta","nombretrabajo"];
  var TUTOR_ALIASES = ["tutor","docente tutor","director","asesor"];
  var MODALIDAD_ALIASES = ["modalidadtitulacion","modalidad titulación","modalidad titulacion","modalidad","tipo titulacion"];

  function findValue(row, aliases){
    row = row || {};
    var keys = Object.keys(row);
    for(var i = 0; i < aliases.length; i += 1){
      var wanted = compact(aliases[i]);
      for(var j = 0; j < keys.length; j += 1){
        var key = compact(keys[j]);
        if(key === wanted || key.indexOf(wanted) >= 0 || wanted.indexOf(key) >= 0){
          var value = row[keys[j]];
          if(text(value)){return value;}
        }
      }
    }
    return "";
  }

  function cedulaVariants(value){
    var d = onlyDigits(value);
    if(!d){return [];}
    var out = [d];
    if(d.charAt(0) === "0"){out.push(d.slice(1));}
    else if(d.length === 9){out.push("0" + d);}
    return out.filter(function(x, index, arr){return x && arr.indexOf(x) === index;});
  }

  function nameKey(value){
    var words = norm(value).split(/\s+/).filter(function(word){return word.length > 1;});
    return words.join(" ");
  }

  function modalityLabel(id){
    id = text(id).toUpperCase();
    if(id === "EXAMEN_COMPLEXIVO"){return "Examen Complexivo";}
    if(id === "TRABAJO_TITULACION"){return "Trabajo de Titulación";}
    if(id === "ARTICULO_ACADEMICO"){return "Artículo Académico";}
    return id || "Sin modalidad";
  }

  function normalizeModality(value, periodType){
    var raw = norm(value);
    if(raw.indexOf("trabajo") >= 0 || raw.indexOf("tesis") >= 0 || raw.indexOf("proyecto") >= 0){return "TRABAJO_TITULACION";}
    if(raw.indexOf("articulo") >= 0 || raw.indexOf("artículo") >= 0 || raw.indexOf("pvc") >= 0){return "ARTICULO_ACADEMICO";}
    if(raw.indexOf("complexivo") >= 0 || raw.indexOf("complex") >= 0 || raw.indexOf("examen") >= 0){return "EXAMEN_COMPLEXIVO";}
    if(periodType && periodType.id === "PVC"){return "ARTICULO_ACADEMICO";}
    if(periodType && periodType.id === "REGULAR"){return "EXAMEN_COMPLEXIVO";}
    return "";
  }

  function baseCedula(row){
    row = row || {};
    return text(row._cedula || row._bl2Id || row.cedula || row.Cedula || row.CEDULA || row.numeroIdentificacion || row.identificacion || row.docId || row._docId || findValue(row, CEDULA_ALIASES));
  }

  function baseName(row){
    row = row || {};
    return text(row._nombres || row._bl2Nombre || row.nombres || row.Nombres || row.nombre || row.estudiante || findValue(row, NAME_ALIASES));
  }

  function baseCareer(row){
    row = row || {};
    return text(row._carrera || row._bl2Carrera || row.nombreCarrera || row.nombrecarrera || row.carrera || row.Carrera || findValue(row, CAREER_ALIASES));
  }

  function normalizeBaseStudent(row, periodType){
    row = row || {};
    var modalidadRaw = text(row.modalidadTitulacion || row.ModalidadTitulacion || findValue(row, MODALIDAD_ALIASES));
    var modalidad = normalizeModality(modalidadRaw, periodType);
    return {
      id:text(row._id || row._docId || row.docId || baseCedula(row)),
      cedula:baseCedula(row),
      nombres:baseName(row),
      carrera:baseCareer(row),
      periodo:text(row._periodo || row.periodoLabel || row.periodoId || row.ultimoPeriodoId || row.periodo || ""),
      modalidadTitulacion:modalidad,
      modalidadLabel:modalityLabel(modalidad),
      raw:row
    };
  }

  function normalizeExcelRow(row, periodType){
    row = row || {};
    var modalidadRaw = text(row.modalidadTitulacion || row.ModalidadTitulacion || findValue(row, MODALIDAD_ALIASES));
    var modalidad = normalizeModality(modalidadRaw, periodType);
    return {
      sheet:text(row._inforSheet || ""),
      rowNumber:row._inforRowNumber || "",
      cedula:text(findValue(row, CEDULA_ALIASES)),
      nombres:text(findValue(row, NAME_ALIASES)),
      carrera:text(findValue(row, CAREER_ALIASES)),
      titulo:text(findValue(row, TITLE_ALIASES)),
      tutor:text(findValue(row, TUTOR_ALIASES)),
      modalidadTitulacion:modalidad,
      modalidadLabel:modalityLabel(modalidad),
      raw:row
    };
  }

  function loadBaseStudents(periodId){
    periodId = text(periodId);
    try{
      if(window.BL2EstudiantesRepo && typeof window.BL2EstudiantesRepo.buscar === "function"){
        var result = window.BL2EstudiantesRepo.buscar({periodId:periodId, matricula:"ACTIVO", search:"", limit:12000});
        if(result && Array.isArray(result.rows)){return {source:"BL2", rows:result.rows};}
      }
    }catch(error){console.warn("[InforMatch BL2]", error);}

    try{
      if(window.ExcelLocalRepo){
        var rows = [];
        if(typeof window.ExcelLocalRepo.listStudentsByPeriod === "function"){rows = window.ExcelLocalRepo.listStudentsByPeriod(periodId, {estadoMatricula:"ACTIVO"}) || [];}
        else if(typeof window.ExcelLocalRepo.listAllStudents === "function"){rows = window.ExcelLocalRepo.listAllStudents() || [];}
        return {source:"ExcelLocalRepo", rows:rows};
      }
    }catch(error2){console.warn("[InforMatch ExcelLocalRepo]", error2);}
    return {source:"Sin BaseLocal", rows:[]};
  }

  function indexBase(rows, periodType){
    var byCedula = Object.create(null);
    var byName = Object.create(null);
    var normalized = (rows || []).map(function(row){return normalizeBaseStudent(row, periodType);});
    normalized.forEach(function(student){
      cedulaVariants(student.cedula).forEach(function(key){if(key && !byCedula[key]){byCedula[key] = student;}});
      var nk = nameKey(student.nombres);
      if(nk && !byName[nk]){byName[nk] = student;}
    });
    return {rows:normalized, byCedula:byCedula, byName:byName};
  }

  function matchExcelRow(excel, index, periodType){
    var byCedula = null;
    cedulaVariants(excel.cedula).some(function(key){
      if(index.byCedula[key]){byCedula = index.byCedula[key];return true;}
      return false;
    });
    if(byCedula){return buildMatch("cedula", excel, byCedula, periodType);}

    var byName = index.byName[nameKey(excel.nombres)] || null;
    if(byName){return buildMatch("nombre", excel, byName, periodType);}

    return buildMatch("sin_match", excel, null, periodType);
  }

  function buildMatch(method, excel, base, periodType){
    var modalidad = normalizeModality((base && base.modalidadTitulacion) || excel.modalidadTitulacion, periodType);
    return {
      status:base ? "unido" : "pendiente",
      method:method,
      cedula:(base && base.cedula) || excel.cedula || "",
      nombres:(base && base.nombres) || excel.nombres || "",
      carrera:(base && base.carrera) || excel.carrera || "",
      titulo:excel.titulo || "",
      tutor:excel.tutor || "",
      modalidadTitulacion:modalidad,
      modalidadLabel:modalityLabel(modalidad),
      excel:excel,
      base:base
    };
  }

  function summarize(matches, baseSource, baseTotal){
    var out = {total:matches.length, unidos:0, pendientes:0, porCedula:0, porNombre:0, baseSource:baseSource, baseTotal:baseTotal, modalidades:{}};
    matches.forEach(function(item){
      if(item.status === "unido"){out.unidos += 1;}else{out.pendientes += 1;}
      if(item.method === "cedula"){out.porCedula += 1;}
      if(item.method === "nombre"){out.porNombre += 1;}
      var m = item.modalidadTitulacion || "SIN_MODALIDAD";
      out.modalidades[m] = (out.modalidades[m] || 0) + 1;
    });
    return out;
  }

  function match(snapshot){
    snapshot = snapshot || {};
    var periodId = text(snapshot.periodId || snapshot.periodLabel);
    var periodType = snapshot.periodType || (window.InforPeriodo && window.InforPeriodo.classify ? window.InforPeriodo.classify(snapshot.periodLabel || snapshot.periodId) : null);
    var excelRows = snapshot.excelData && Array.isArray(snapshot.excelData.rows) ? snapshot.excelData.rows : [];
    var base = loadBaseStudents(periodId);
    var index = indexBase(base.rows, periodType);
    var excel = excelRows.map(function(row){return normalizeExcelRow(row, periodType);});
    var matches = excel.map(function(row){return matchExcelRow(row, index, periodType);});
    return {
      ok:excelRows.length > 0,
      periodId:periodId,
      periodType:periodType,
      baseSource:base.source,
      baseTotal:index.rows.length,
      totalExcel:excelRows.length,
      matches:matches,
      summary:summarize(matches, base.source, index.rows.length),
      generatedAt:new Date().toISOString()
    };
  }

  window.InforMatch = {
    match:match,
    normalizeModality:normalizeModality,
    modalityLabel:modalityLabel,
    cedulaVariants:cedulaVariants,
    nameKey:nameKey
  };
})(window);
