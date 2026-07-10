/* =========================================================
Nombre completo: coo.data.js
Ruta o ubicación: /Requisitos/Coordi/coo.data.js
Función o funciones:
- Leer estudiantes de forma limpia para Coordi.
- Usar primero snapshot local para no recargar pesado si no es necesario.
- Filtrar estudiantes por período y división.
- Normalizar cédula, nombres, carrera, período, división, correos y celular.
Con qué se conecta:
- BDLRepoEstudiantes.mirrorSnapshot()
- localStorage REQ_BDLOCAL_LEGACY_SNAPSHOT_V1
- BL2DataEngine / ExcelLocalRepo como respaldo
- BLPeriodosCanon
- BLDivisionesService
- coo.report.js
- coo.app.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-coo-data.1";
  var SNAPSHOT_KEYS = ["REQ_BDLOCAL_LEGACY_SNAPSHOT_V1", "REQ_EXCEL_LOCAL_V1:snapshot"];

  function text(value){return String(value == null ? "" : value).trim();}
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]+/g, "");}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function uniq(values){
    var seen = Object.create(null);
    return arr(values).map(text).filter(function(value){
      if(!value){return false;}
      var key = norm(value);
      if(seen[key]){return false;}
      seen[key] = true;
      return true;
    });
  }
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(error){return value;}}

  function readJson(key){
    try{
      var raw = window.localStorage && window.localStorage.getItem(key);
      if(!raw){return null;}
      var parsed = JSON.parse(raw);
      if(parsed && (Array.isArray(parsed.students) || Array.isArray(parsed.rows))){
        parsed._sourceKey = key;
        return parsed;
      }
    }catch(error){}
    return null;
  }

  function snapshotFromCache(){
    for(var i=0;i<SNAPSHOT_KEYS.length;i++){
      var snap = readJson(SNAPSHOT_KEYS[i]);
      if(snap){return Promise.resolve(normalizeSnapshot(snap, "cache:" + SNAPSHOT_KEYS[i]));}
    }
    return Promise.resolve(null);
  }

  function snapshotFromBDLocal(){
    try{
      if(window.BDLRepoEstudiantes && typeof window.BDLRepoEstudiantes.mirrorSnapshot === "function"){
        return Promise.resolve(window.BDLRepoEstudiantes.mirrorSnapshot()).then(function(snapshot){
          return normalizeSnapshot(snapshot, "BDLRepoEstudiantes");
        }).catch(function(error){
          console.warn("[COOData] No se pudo leer BDLRepoEstudiantes", error);
          return null;
        });
      }
    }catch(error){}
    return Promise.resolve(null);
  }

  function snapshotFromBL2(){
    try{
      if(window.BL2DataEngine && typeof window.BL2DataEngine.listStudents === "function"){
        var result = window.BL2DataEngine.listStudents({matricula:"ACTIVO", limit:0}) || {};
        return Promise.resolve(normalizeSnapshot({students:result.rows || [], periods:listPeriodsFromBL2()}, "BL2DataEngine"));
      }
    }catch(error){
      console.warn("[COOData] No se pudo leer BL2DataEngine", error);
    }
    return Promise.resolve(null);
  }

  function snapshotFromExcelLocal(){
    try{
      if(window.ExcelLocalRepo){
        if(typeof window.ExcelLocalRepo.getSnapshot === "function"){
          return Promise.resolve(normalizeSnapshot(window.ExcelLocalRepo.getSnapshot(), "ExcelLocalRepo"));
        }
        if(typeof window.ExcelLocalRepo.listAllStudents === "function"){
          return Promise.resolve(normalizeSnapshot({students:window.ExcelLocalRepo.listAllStudents(), periods:listPeriodsFromExcel()}, "ExcelLocalRepo"));
        }
      }
    }catch(error){
      console.warn("[COOData] No se pudo leer ExcelLocalRepo", error);
    }
    return Promise.resolve(null);
  }

  function listPeriodsFromBL2(){
    try{
      if(window.BL2DataEngine && typeof window.BL2DataEngine.listPeriods === "function"){
        return window.BL2DataEngine.listPeriods() || [];
      }
    }catch(error){}
    return [];
  }

  function listPeriodsFromExcel(){
    try{
      if(window.ExcelLocalRepo && typeof window.ExcelLocalRepo.listPeriods === "function"){
        return window.ExcelLocalRepo.listPeriods() || [];
      }
    }catch(error){}
    return [];
  }

  function normalizePeriod(row){
    row = row || {};
    var id = text(row.id || row.value || row.periodoId || row.periodId || row.codigo || row.label || row.periodoLabel);
    var label = text(row.label || row.periodoLabel || row.nombre || row.name || id);
    if(!id && !label){return null;}
    return {id:id || label, value:id || label, label:label || id};
  }

  function normalizePeriods(periods, students){
    var map = Object.create(null);
    arr(periods).forEach(function(period){
      var p = normalizePeriod(period);
      if(p){map[p.id] = p;}
    });
    arr(students).forEach(function(row){
      var id = text(row && (row._bl2PeriodoId || row.periodoId || row.ultimoPeriodoId || row.periodId || row.Periodo || row.periodo));
      var label = text(row && (row._bl2Periodo || row.periodoLabel || row.Periodo || row.periodo || id));
      if(id && !map[id]){map[id] = {id:id, value:id, label:label || id};}
    });
    return Object.keys(map).map(function(key){return map[key];}).sort(function(a,b){return a.label.localeCompare(b.label,"es");});
  }

  function normalizeSnapshot(snapshot, source){
    snapshot = snapshot || {};
    var students = arr(snapshot.students || snapshot.rows).map(normalizeStudent).filter(function(row){return row._cedula || row._nombres;});
    students = dedupeStudents(students);
    return {
      meta:Object.assign({}, snapshot.meta || {}, {source:source || "desconocido", version:VERSION, totalStudents:students.length, generatedAt:new Date().toISOString()}),
      periods:normalizePeriods(snapshot.periods || snapshot.periodList || [], students),
      students:students,
      diagnostics:arr(snapshot.diagnostics)
    };
  }

  function first(row, keys){
    row = row || {};
    for(var i=0;i<keys.length;i++){
      var key = keys[i];
      if(row[key] != null && text(row[key]) !== ""){return row[key];}
    }
    return "";
  }

  function divisionOf(row){
    row = row || {};
    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.studentDivision === "function"){
        var d = window.BLDivisionesService.studentDivision(row);
        if(text(d)){return text(d);}
      }
    }catch(error){}
    var list = arr(row.divisiones || row.Divisiones || row._divisiones);
    return text(row._bl2Division || row.divisionPrincipal || row.division || row.Division || row["División"] || list[0] || "Sin división");
  }

  function divisionsOf(row){
    var list = arr(row && (row.divisiones || row.Divisiones || row._divisiones)).map(text).filter(Boolean);
    var main = divisionOf(row);
    if(main){list.unshift(main);}
    return uniq(list);
  }

  function normalizeStudent(row){
    row = Object.assign({}, row || {});
    var cedula = text(first(row, ["_bl2Id", "cedula", "Cedula", "cédula", "numeroIdentificacion", "NumeroIdentificacion", "identificacion", "Identificacion"]));
    var nombres = text(first(row, ["_bl2Nombre", "nombres", "Nombres", "nombre", "Nombre", "estudiante", "Estudiante", "alumno", "Alumno"]));
    var carrera = text(first(row, ["_bl2Carrera", "nombreCarrera", "NombreCarrera", "nombrecarrera", "carrera", "Carrera", "programa", "Programa"])) || "SIN CARRERA";
    var periodoId = text(first(row, ["_bl2PeriodoId", "periodoId", "ultimoPeriodoId", "periodId", "PeriodoId", "periodo", "Periodo"]));
    var periodo = text(first(row, ["_bl2Periodo", "periodoLabel", "Periodo", "periodo", "nombrePeriodo", "NombrePeriodo", "periodoId"])) || periodoId || "SIN PERÍODO";
    var division = divisionOf(row);
    var divisiones = divisionsOf(row);
    var correoPersonal = text(first(row, ["_bl2CorreoPersonal", "correoPersonal", "CorreoPersonal", "correopersonal", "correo", "Correo", "email", "Email"]));
    var correoInstitucional = text(first(row, ["_bl2CorreoInstitucional", "correoInstitucional", "CorreoInstitucional", "correoinstitucional", "correoInst", "CorreoInst"]));
    var celular = text(first(row, ["_bl2Celular", "celular", "Celular", "telefono", "Telefono", "Teléfono", "whatsapp", "Whatsapp"]));
    var id = text(first(row, ["idEstudiantePeriodo", "detalleId", "id", "_id"])) || [periodoId || periodo, cedula, nombres].join("|");

    row._cooId = id;
    row._cedula = cedula;
    row._nombres = nombres;
    row._carrera = carrera;
    row._periodoId = periodoId || periodo;
    row._periodo = periodo;
    row._division = division;
    row._divisiones = divisiones;
    row._correoPersonal = correoPersonal;
    row._correoInstitucional = correoInstitucional;
    row._correo = correoPersonal || correoInstitucional;
    row._celular = celular;
    row._search = norm([cedula,nombres,carrera,periodoId,periodo,division,divisiones.join(" "),correoPersonal,correoInstitucional,celular].join(" "));
    return row;
  }

  function dedupeStudents(students){
    var map = Object.create(null);
    arr(students).forEach(function(student){
      var key = compact([student._periodoId || student._periodo, student._cedula || student._nombres].join("|"));
      if(!key){key = compact(student._cooId || Math.random());}
      map[key] = Object.assign({}, map[key] || {}, student);
    });
    return Object.keys(map).map(function(key){return map[key];});
  }

  function samePeriod(rowPeriod, selectedPeriod){
    rowPeriod = text(rowPeriod);
    selectedPeriod = text(selectedPeriod);
    if(!selectedPeriod){return true;}
    if(!rowPeriod){return false;}
    try{
      if(window.BLPeriodosCanon && typeof window.BLPeriodosCanon.samePeriod === "function"){
        return window.BLPeriodosCanon.samePeriod(rowPeriod, selectedPeriod);
      }
    }catch(error){}
    return rowPeriod === selectedPeriod || norm(rowPeriod) === norm(selectedPeriod) || compact(rowPeriod) === compact(selectedPeriod);
  }

  function hasDivision(row, selectedDivision){
    selectedDivision = text(selectedDivision);
    if(!selectedDivision){return true;}
    try{
      if(window.BLDivisionesService && typeof window.BLDivisionesService.hasDivision === "function"){
        return window.BLDivisionesService.hasDivision(row, selectedDivision);
      }
    }catch(error){}
    var target = norm(selectedDivision);
    return divisionsOf(row).some(function(value){return norm(value) === target;});
  }

  function getSnapshot(options){
    options = options || {};
    if(options.refresh){
      return snapshotFromBDLocal().then(function(snapshot){return snapshot || snapshotFromCache();}).then(function(snapshot){return snapshot || snapshotFromBL2();}).then(function(snapshot){return snapshot || snapshotFromExcelLocal();});
    }
    return snapshotFromCache().then(function(snapshot){return snapshot || snapshotFromBDLocal();}).then(function(snapshot){return snapshot || snapshotFromBL2();}).then(function(snapshot){return snapshot || snapshotFromExcelLocal();}).then(function(snapshot){return snapshot || normalizeSnapshot({students:[], periods:[]}, "sin datos");});
  }

  function filterRows(students, options){
    options = options || {};
    var periodId = text(options.periodId || options.periodoId || options.periodo || "");
    var division = text(options.division || "");
    var search = norm(options.search || "");
    var limit = options.limit == null ? 0 : Number(options.limit || 0);
    var rows = arr(students).filter(function(row){
      if(periodId && !samePeriod(row._periodoId || row._periodo, periodId)){return false;}
      if(division && !hasDivision(row, division)){return false;}
      if(search && row._search.indexOf(search) === -1){return false;}
      return true;
    }).sort(function(a,b){return (a._nombres || "").localeCompare(b._nombres || "", "es") || (a._cedula || "").localeCompare(b._cedula || "", "es");});
    if(limit > 0){rows = rows.slice(0, limit);}
    return rows;
  }

  function listDivisions(students){
    var values = [];
    arr(students).forEach(function(row){values = values.concat(divisionsOf(row));});
    values = uniq(values).sort(function(a,b){return a.localeCompare(b,"es");});
    return values.length ? values : ["Sin división"];
  }

  function read(options){
    options = options || {};
    return getSnapshot(options).then(function(snapshot){
      var baseRows = filterRows(snapshot.students, {periodId:options.periodId || options.periodoId || options.periodo || "", division:""});
      var rows = filterRows(snapshot.students, options);
      return {
        source:snapshot.meta && snapshot.meta.source || "desconocido",
        version:VERSION,
        periodList:snapshot.periods || [],
        divisionList:listDivisions(baseRows),
        rows:rows,
        total:rows.length,
        diagnostics:{
          source:snapshot.meta && snapshot.meta.source || "desconocido",
          generatedAt:new Date().toISOString(),
          filters:{periodId:options.periodId || options.periodoId || "", division:options.division || ""},
          totalSnapshotStudents:arr(snapshot.students).length,
          totalFilteredStudents:rows.length,
          totalPeriods:arr(snapshot.periods).length,
          totalDivisions:listDivisions(baseRows).length
        }
      };
    });
  }

  window.COOData = {
    version:VERSION,
    read:read,
    getSnapshot:getSnapshot,
    normalizeStudent:normalizeStudent,
    filterRows:filterRows,
    listDivisions:listDivisions,
    samePeriod:samePeriod,
    hasDivision:hasDivision,
    helpers:{text:text,norm:norm,compact:compact,uniq:uniq,divisionOf:divisionOf,divisionsOf:divisionsOf}
  };
})(window);
