/* =========================================================
Nombre completo: infor.regular.js
Ruta o ubicación: /Requisitos/Infor/core/infor.regular.js
Función o funciones:
- Analizar el Excel regular de Infor usando NÚCLEOS y notas_complexivo.
- Usar el Excel como fuente principal del informe.
- Validar 4 núcleos por estudiante, nota mínima 7 y nota 0 como retirado.
- Deduplicar núcleos repetidos y notas_complexivo por cédula.
- Calcular nota final: si existe notaSupletorio, esa nota manda; si no, práctica 60% y teórico 40%.
- Marcar inconsistencia cuando existe complexivo sin 4 núcleos aprobados.
Con qué se conecta:
- infor.excel.js
- infor.match.js
- infor.report.js
- ../frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){
    var out = String(value == null ? "" : value).trim();
    return /^(null|undefined|nan|n\/a|s\/n)$/i.test(out) ? "" : out;
  }
  function norm(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();}
  function compact(value){return norm(value).replace(/[^a-z0-9]/g, "");}
  function onlyDigits(value){return text(value).replace(/[^0-9]/g, "");}
  function num(value){var raw = text(value).replace(",", ".");if(!raw){return null;}var n = Number(raw);return Number.isFinite(n) ? n : null;}
  function round2(value){return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;}
  function safeList(value){return Array.isArray(value) ? value : [];}

  var CEDULA_ALIASES = ["cedula","cédula","identificacion","identificación","identificacionestudiante","identificacion estudiante","numeroidentificacion","numero identificacion","documento","dni"];
  var NAME_ALIASES = ["nombre_est","nombre est","nombres","nombre","estudiante","apellidosynombres","apellidos nombres","alumno","participante"];
  var CAREER_ALIASES = ["carrera","nombrecarrera","nombre carrera","programa","especialidad"];
  var TITLE_ALIASES = ["titulo","título","tema","articulo","artículo","trabajo","nombretrabajo","propuesta"];
  var TUTOR_ALIASES = ["tutor","docente tutor","director","asesor"];
  var MATERIA_ALIASES = ["materia","nucleo","núcleo","asignatura"];
  var NUCLEO_NOTA_ALIASES = ["nota_final","nota final","notafinal","nfin","final"];
  var PRACTICO_ALIASES = ["notaPractico","nota práctico","nota practico","practico","práctico","nota práctica","nota practica","evaluacionPractica","evaluación práctica"];
  var TEORICO_ALIASES = ["notaTeorico","nota teórico","nota teorico","teorico","teórico","evaluacionTeorica","evaluación teórica"];
  var SUPLETORIO_ALIASES = ["notaSupletorio","nota supletorio"];

  function findValue(row, aliases){
    row = row || {};
    var keys = Object.keys(row);
    for(var i = 0; i < aliases.length; i += 1){
      var wanted = compact(aliases[i]);
      for(var j = 0; j < keys.length; j += 1){
        var key = compact(keys[j]);
        if(key === wanted || key.indexOf(wanted) >= 0 || wanted.indexOf(key) >= 0){
          var value = text(row[keys[j]]);
          if(value){return value;}
        }
      }
    }
    return "";
  }

  function cedulaOf(row){return text(row && (row.cedula || row.Cedula || row.CEDULA || row._bl2Id || row._cedula || findValue(row, CEDULA_ALIASES)));}
  function nameOf(row){return text(row && (row.nombres || row.Nombres || row.nombre || row.estudiante || row._bl2Nombre || findValue(row, NAME_ALIASES)));}
  function careerOf(row){return text(row && (row.carrera || row.Carrera || row.nombreCarrera || row._bl2Carrera || findValue(row, CAREER_ALIASES)));}
  function titleOf(row){return text(row && (row.titulo || row.Titulo || row.título || findValue(row, TITLE_ALIASES)));}
  function tutorOf(row){return text(row && (row.tutor || row.Tutor || findValue(row, TUTOR_ALIASES)));}
  function materiaOf(row){return text(row && (row.materia || row.Materia || findValue(row, MATERIA_ALIASES)));}

  function cedulaVariants(value){
    var d = onlyDigits(value);
    if(!d){return [];}
    var out = [d];
    if(d.charAt(0) === "0"){out.push(d.slice(1));}
    else if(d.length === 9){out.push("0" + d);}
    return out.filter(function(x, index, arr){return x && arr.indexOf(x) === index;});
  }
  function cedulaKey(value){return cedulaVariants(value)[0] || "";}
  function sheetName(row){return text(row && row._inforSheet);}
  function sheetKey(row){return compact(sheetName(row));}
  function isNucleos(row){return text(row && row._inforSheetType) === "NUCLEOS" || sheetKey(row).indexOf("nucleo") >= 0;}
  function isComplexivo(row){return text(row && row._inforSheetType) === "COMPLEXIVO" || sheetKey(row).indexOf("complexivo") >= 0;}
  function isTrabajo(){return false;}

  function docenteForNucleo(numero){return "Docente " + (numero || 1);}

  function nucleoNumber(row, fallback){
    var m = materiaOf(row);
    var match = norm(m).match(/nucleo\s*(\d+)/);
    if(match){return Number(match[1]);}
    return fallback || 1;
  }

  function nucleoNota(row){return num(findValue(row, NUCLEO_NOTA_ALIASES));}

  function dedupeNucleos(mappedRows){
    var byNumber = Object.create(null);
    safeList(mappedRows).forEach(function(item){
      var key = String(item.numero || 0);
      if(!byNumber[key]){byNumber[key] = item;return;}
      var current = byNumber[key];
      var nextNota = item.nota == null ? -1 : item.nota;
      var currentNota = current.nota == null ? -1 : current.nota;
      if(nextNota > currentNota){byNumber[key] = item;}
    });
    return Object.keys(byNumber).sort(function(a,b){return Number(a) - Number(b);}).map(function(key){return byNumber[key];});
  }

  function buildNucleosIndex(rows){
    var byCedula = Object.create(null);
    safeList(rows).forEach(function(row, index){
      var key = cedulaKey(cedulaOf(row));
      if(!key){return;}
      if(!byCedula[key]){byCedula[key] = {cedula:cedulaOf(row),nombres:nameOf(row),carrera:careerOf(row),rows:[],rawRows:[]};}
      byCedula[key].rawRows.push(Object.assign({_inforOriginalIndex:index}, row));
    });

    Object.keys(byCedula).forEach(function(key){
      var item = byCedula[key];
      var mapped = item.rawRows.map(function(row, idx){
        var numero = nucleoNumber(row, idx + 1);
        var nota = nucleoNota(row);
        return {numero:numero,materia:materiaOf(row) || ("Núcleo " + numero),docente:docenteForNucleo(numero),nota:nota,aprobado:nota != null && nota >= 7,retirado:nota === 0,row:row};
      });
      item.rows = dedupeNucleos(mapped);
      item.totalOriginal = mapped.length;
      item.duplicados = Math.max(0, mapped.length - item.rows.length);
      item.total = item.rows.length;
      item.aprobados = item.rows.filter(function(n){return n.aprobado;}).length;
      item.retirado = item.rows.some(function(n){return n.retirado;});
      item.completo = item.total >= 4;
      item.aprobado = item.completo && !item.retirado && item.rows.slice(0, 4).every(function(n){return n.aprobado;});
      item.incompleto = !item.completo && !item.retirado;
      item.reprobado = item.completo && !item.retirado && !item.aprobado;
      item.estado = item.retirado ? "RETIRADO" : (item.aprobado ? "APROBADO_NUCLEOS" : (item.incompleto ? "NUCLEOS_INCOMPLETOS" : "REPROBADO_NUCLEOS"));
    });
    return byCedula;
  }

  function summarizeNucleos(index){
    var list = Object.keys(index).map(function(key){return index[key];});
    return {total:list.length,completos:list.filter(function(x){return x.completo;}).length,aprobados:list.filter(function(x){return x.aprobado;}).length,retirados:list.filter(function(x){return x.retirado;}).length,incompletos:list.filter(function(x){return x.incompleto;}).length,reprobados:list.filter(function(x){return x.reprobado;}).length,duplicados:list.reduce(function(sum,x){return sum + (x.duplicados || 0);}, 0)};
  }

  function complexivoNote(row){
    var practico = num(findValue(row, PRACTICO_ALIASES));
    var teorico = num(findValue(row, TEORICO_ALIASES));
    var notaSupletorio = num(findValue(row, SUPLETORIO_ALIASES));
    var final = null;
    var formula = "";
    var tieneSupletorio = notaSupletorio != null;
    if(tieneSupletorio){final = notaSupletorio;formula = "notaSupletorio";}
    else if(practico != null && teorico != null){final = round2((practico * 0.60) + (teorico * 0.40));formula = "notaPractico*0.60 + notaTeorico*0.40";}
    return {notaPractico:practico,notaTeorico:teorico,notaSupletorio:notaSupletorio,notaFinal:final,formula:formula,quedoSupletorio:tieneSupletorio};
  }

  function rowScore(row){
    var n = complexivoNote(row);
    var score = 0;
    if(n.notaSupletorio != null){score += 100;}
    if(n.notaFinal != null){score += 20;}
    if(n.notaPractico != null){score += 10;}
    if(n.notaTeorico != null){score += 10;}
    score += Object.keys(row || {}).filter(function(k){return text(row[k]);}).length;
    return score;
  }

  function dedupeByCedula(rows, sourceName){
    var map = Object.create(null);
    var duplicates = [];
    safeList(rows).forEach(function(row){
      var key = cedulaKey(cedulaOf(row));
      if(!key){duplicates.push({source:sourceName,reason:"sin_cedula",cedula:"",estudiante:nameOf(row),sheet:sheetName(row),rowNumber:row._inforRowNumber || ""});return;}
      if(!map[key]){map[key] = row;return;}
      var current = map[key];
      if(rowScore(row) > rowScore(current)){
        duplicates.push({source:sourceName,reason:"duplicado_reemplazado",cedula:cedulaOf(current),estudiante:nameOf(current),sheet:sheetName(current),rowNumber:current._inforRowNumber || ""});
        map[key] = row;
      }else{
        duplicates.push({source:sourceName,reason:"duplicado_omitido",cedula:cedulaOf(row),estudiante:nameOf(row),sheet:sheetName(row),rowNumber:row._inforRowNumber || ""});
      }
    });
    return {rows:Object.keys(map).map(function(key){return map[key];}),duplicates:duplicates};
  }

  function estadoPorNota(final, nucleoInfo, hasComplexivo){
    if(nucleoInfo && nucleoInfo.retirado){return "RETIRADO";}
    if(!hasComplexivo){return "SIN_COMPLEXIVO";}
    if(final == null){return "SIN_NOTA";}
    return final >= 7 ? "APROBADO" : "REPROBADO";
  }

  function basePrepared(row, nucleoInfo, hasComplexivo){
    nucleoInfo = nucleoInfo || null;
    return Object.assign({}, row || {}, {
      cedula:cedulaOf(row) || (nucleoInfo && nucleoInfo.cedula) || "",
      nombres:nameOf(row) || (nucleoInfo && nucleoInfo.nombres) || "",
      carrera:careerOf(row) || (nucleoInfo && nucleoInfo.carrera) || "",
      titulo:titleOf(row),
      tutor:tutorOf(row),
      modalidadTitulacion:"EXAMEN_COMPLEXIVO",
      modalidadLabel:"Examen Complexivo",
      _inforRegularPrepared:true,
      _inforNucleos:nucleoInfo ? {total:nucleoInfo.total,aprobados:nucleoInfo.aprobados,completo:nucleoInfo.completo,aprobado:nucleoInfo.aprobado,retirado:nucleoInfo.retirado,estado:nucleoInfo.estado,duplicados:nucleoInfo.duplicados || 0,rows:nucleoInfo.rows.map(function(n){return {numero:n.numero,materia:n.materia,docente:n.docente,nota:n.nota,aprobado:n.aprobado,retirado:n.retirado};})} : {total:0,aprobados:0,completo:false,aprobado:false,retirado:false,estado:"SIN_NUCLEOS",rows:[]},
      _inforTieneComplexivo:!!hasComplexivo
    });
  }

  function prepareComplexivo(row, nucleosIndex){
    var key = cedulaKey(cedulaOf(row));
    var nucleoInfo = nucleosIndex[key] || null;
    var note = complexivoNote(row);
    var inconsistencia = !(nucleoInfo && nucleoInfo.aprobado);
    var estado = estadoPorNota(note.notaFinal, nucleoInfo, true);
    return Object.assign(basePrepared(row, nucleoInfo, true), {notaPractico:note.notaPractico,notaTeorico:note.notaTeorico,notaSupletorio:note.notaSupletorio,notaFinal:note.notaFinal,notafinal:note.notaFinal,nfin:note.notaFinal,_inforNotaFormula:note.formula,_inforQuedoSupletorio:note.quedoSupletorio,_inforEstadoAcademico:estado,_inforInconsistenciaNucleos:inconsistencia,_inforInconsistenciaDetalle:inconsistencia ? "Registra complexivo sin 4 núcleos aprobados" : ""});
  }

  function prepareNucleoOnly(nucleoInfo){
    var estado = estadoPorNota(null, nucleoInfo, false);
    return Object.assign(basePrepared({cedula:nucleoInfo.cedula,nombres:nucleoInfo.nombres,carrera:nucleoInfo.carrera,_inforSheet:"NÚCLEOS",_inforSheetType:"NUCLEOS"}, nucleoInfo, false), {notaPractico:null,notaTeorico:null,notaSupletorio:null,notaFinal:null,notafinal:null,nfin:null,_inforNotaFormula:"",_inforQuedoSupletorio:false,_inforEstadoAcademico:estado,_inforInconsistenciaNucleos:false,_inforInconsistenciaDetalle:""});
  }

  function summarizeRows(rows){
    var cedulas = Object.create(null);
    safeList(rows).forEach(function(row){cedulaVariants(cedulaOf(row)).forEach(function(c){cedulas[c] = true;});});
    return {rows:safeList(rows).length,cedulas:Object.keys(cedulas).length};
  }

  function analyze(snapshot){
    snapshot = snapshot || {};
    var periodId = text(snapshot.periodId || snapshot.periodLabel);
    var periodType = snapshot.periodType || {};
    var rows = snapshot.excelData && Array.isArray(snapshot.excelData.rows) ? snapshot.excelData.rows : [];
    var nucleosAll = rows.filter(isNucleos);
    var complexivoAll = rows.filter(isComplexivo);
    var trabajoAll = [];
    var nucleosIndex = buildNucleosIndex(nucleosAll);
    var complexivoDedup = dedupeByCedula(complexivoAll, "notas_complexivo");
    var preparedComplexivo = complexivoDedup.rows.map(function(row){return prepareComplexivo(row, nucleosIndex);});
    var complexivoKeys = Object.create(null);
    preparedComplexivo.forEach(function(row){var key = cedulaKey(cedulaOf(row));if(key){complexivoKeys[key] = true;}});
    var nucleoOnly = Object.keys(nucleosIndex).filter(function(key){return !complexivoKeys[key];}).map(function(key){return prepareNucleoOnly(nucleosIndex[key]);});
    var preparedRows = preparedComplexivo.concat(nucleoOnly);
    var inconsistencies = preparedComplexivo.filter(function(row){return !!row._inforInconsistenciaNucleos;});
    var supletorios = preparedComplexivo.filter(function(row){return !!row._inforQuedoSupletorio;});
    var retirados = preparedRows.filter(function(row){return row._inforEstadoAcademico === "RETIRADO";});
    var nucleosSummary = summarizeNucleos(nucleosIndex);
    return {
      ok:rows.length > 0,
      periodId:periodId,
      periodType:periodType,
      validation:{enabled:false,source:"Excel",periodCedulas:0,excluded:0,message:"Fuente principal: Excel cargado en Infor."},
      sheets:{nucleos:summarizeRows(nucleosAll),complexivo:summarizeRows(complexivoAll),trabajoTitulacion:summarizeRows(trabajoAll)},
      nucleos:Object.assign({rows:nucleosAll,infoOnly:false,docentes:["Docente 1","Docente 2","Docente 3","Docente 4"]}, nucleosSummary),
      complexivo:{rows:preparedComplexivo,totalOriginal:complexivoAll.length,totalValid:complexivoAll.length,totalFinal:preparedComplexivo.length,formula:"notaSupletorio si existe; caso contrario notaPractico*0.60 + notaTeorico*0.40",supletorios:supletorios.length},
      trabajoTitulacion:{rows:[],totalOriginal:0,totalValid:0,totalFinal:0,ignored:true,reason:"Hoja3 ignorada temporalmente por información incorrecta."},
      excluded:[],
      duplicates:complexivoDedup.duplicates,
      inconsistencies:inconsistencies.map(function(row){return {cedula:row.cedula,nombres:row.nombres,carrera:row.carrera,reason:row._inforInconsistenciaDetalle,nucleos:row._inforNucleos};}),
      rows:preparedRows,
      summary:{totalExcel:rows.length,validForReport:preparedRows.length,studentsFromExcel:preparedRows.length,excludedByPeriod:0,excludedNoCedula:complexivoDedup.duplicates.filter(function(x){return x.reason === "sin_cedula";}).length,duplicates:complexivoDedup.duplicates.length,nucleosTotal:nucleosSummary.total,nucleosAprobados:nucleosSummary.aprobados,nucleosRetirados:nucleosSummary.retirados,nucleosDuplicados:nucleosSummary.duplicados,complexivoFinal:preparedComplexivo.length,supletorios:supletorios.length,retirados:retirados.length,inconsistencias:inconsistencies.length},
      generatedAt:new Date().toISOString()
    };
  }

  function prepareRows(snapshot){return analyze(snapshot).rows || [];}

  window.InforRegular = {analyze:analyze,prepareRows:prepareRows,complexivoNote:complexivoNote,cedulaOf:cedulaOf,cedulaVariants:cedulaVariants,isNucleos:isNucleos,isComplexivo:isComplexivo,isTrabajo:isTrabajo};
})(window);
