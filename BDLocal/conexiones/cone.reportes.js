/* =========================================================
Nombre completo: cone.reportes.js
Ruta: /BDLocal/conexiones/cone.reportes.js
Función:
- Construir reportes únicamente desde la caché compartida.
- Respetar período, matrícula, carrera, división, sede y búsqueda.
- Incluir estudiantes, requisitos, matrículas y notas disponibles.
- Excluir registros eliminados mediante BDLocalConUtils.
========================================================= */
(function(window){
  "use strict";

  var VERSION="2.0.0-report-context";
  var HUB=window.BDLocalConexiones;
  var U=window.BDLocalConUtils;
  if(!HUB||!U){return;}

  function text(value){return typeof U.text==="function"?U.text(value):String(value==null?"":value).trim();}
  function clone(value){return typeof U.clone==="function"?U.clone(value):JSON.parse(JSON.stringify(value));}
  function cache(){return U.readCache();}
  function active(rows){return typeof U.activeOnly==="function"?U.activeOnly(rows):((rows||[]).filter(function(row){return row&&row.eliminado!==true&&row._firebaseDeleted!==true;}));}
  function cedula(row){return U.normalizeCedula(row&&(row.cedula||row.numeroIdentificacion||row.NumeroIdentificacion)||"");}
  function periodo(row){return U.canonicalPeriodId(row&&(row.periodoId||row.periodId||row.periodoCanonicoId)||"");}
  function localId(row){var id=text(row&&(row.idEstudiantePeriodo||row.studentId||row.id));return id||(cedula(row)&&periodo(row)?cedula(row)+"__"+periodo(row):"");}

  function rows(filters){return U.filterStudents(active(cache().students||[]),filters||{});}
  function requirements(filters){
    filters=filters||{};
    var periodoId=U.canonicalPeriodId(filters.periodoId||filters.periodId||"");
    var wantedCedula=U.normalizeCedula(filters.cedula||filters.numeroIdentificacion||"");
    return active(cache().requirements||[]).filter(function(req){
      return (!periodoId||U.samePeriod(periodo(req),periodoId))&&(!wantedCedula||cedula(req)===wantedCedula);
    });
  }
  function periods(){return active(cache().periods||[]).map(U.normalizePeriod).filter(Boolean);}
  function noteOf(student){
    student=student||{};
    var fields=[
      "notaTeorica","notaPractica","notaComplexivo","notaTeoricaSupletorio",
      "notaPracticaSupletorio","notaSupletorio","notaEscrito","notaDefensaTrabajo",
      "notaTrabajoTitulacion","notaArticulo","notaDefensa","notaFinal","notaOficial",
      "Notart","Nart","Notdef","Ndef","Notafinal","Nfinal","estadoEvaluacion","estadoNota"
    ];
    var output={idEstudiantePeriodo:localId(student),cedula:cedula(student),periodoId:periodo(student)};
    var has=false;
    fields.forEach(function(field){
      if(student[field]!==undefined&&student[field]!==null&&text(student[field])!==""){
        output[field]=clone(student[field]);has=true;
      }
    });
    return has?output:null;
  }
  function enrollmentOf(student){
    student=student||{};
    return {
      idEstudiantePeriodo:localId(student),
      cedula:cedula(student),
      periodoId:periodo(student),
      codigoCarrera:text(student.CodigoCarrera||student.codigoCarrera),
      nombreCarrera:text(student.NombreCarrera||student.nombreCarrera||student.Carrera||student.carrera),
      sede:text(student.Sede||student.sede||student._sede),
      division:text(student.division||student._division),
      estadoMatricula:text(student.estadoMatricula||student._estadoMatricula||"ACTIVO"),
      modalidadTitulacion:text(student.modalidadTitulacion)
    };
  }
  function buildReportData(filters){
    filters=filters||{};
    var estudiantes=rows(filters);
    var requisitos=requirements(filters);
    var matriculas=estudiantes.map(enrollmentOf);
    var notas=estudiantes.map(noteOf).filter(Boolean);
    return {
      ok:true,
      version:VERSION,
      source:"BDLocalConReportes",
      filters:clone(filters),
      generatedAt:U.nowISO(),
      periodoId:U.canonicalPeriodId(filters.periodoId||filters.periodId||""),
      estudiantes:estudiantes,
      rows:estudiantes,
      matriculas:matriculas,
      requisitos:requisitos,
      notas:notas,
      periodos:periods(),
      resumen:{
        totalEstudiantes:estudiantes.length,
        totalMatriculas:matriculas.length,
        totalRequisitos:requisitos.length,
        totalRegistrosNotas:notas.length,
        activos:matriculas.filter(function(row){return text(row.estadoMatricula).toUpperCase()!=="RETIRADO";}).length,
        retirados:matriculas.filter(function(row){return text(row.estadoMatricula).toUpperCase()==="RETIRADO";}).length
      }
    };
  }
  function refresh(options){
    options=Object.assign({},options||{});
    return HUB.refreshCache(Object.assign({source:"cone.reportes.refresh",mode:"full",full:true,force:true,immediate:true},options));
  }

  var api={
    version:VERSION,
    source:"BDLocal/conexiones/cone.reportes.js",
    ready:HUB.ready,
    refresh:refresh,
    build:buildReportData,
    buildReportData:buildReportData,
    report:buildReportData,
    getStudents:rows,
    listStudents:function(options){var result=rows(options||{});return {ok:true,rows:result,total:result.length,source:"BDLocalConReportes"};},
    getRequirements:requirements,
    getPeriods:periods,
    listPeriods:periods,
    getEnrollments:function(options){return rows(options||{}).map(enrollmentOf);},
    getNotes:function(options){return rows(options||{}).map(noteOf).filter(Boolean);}
  };
  HUB.register("reportes",api);
  window.BDLocalReportes=api;
  window.ConReportes=api;
  window.BL2ReportesRepo=Object.assign({},window.BL2ReportesRepo||{},api);
})(window);
