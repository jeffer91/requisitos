/* =========================================================
Nombre completo: infor.report.js
Ruta o ubicación: /Requisitos/Infor/core/infor.report.js
Función o funciones:
- Construir la estructura lógica del Informe de Titulación desde la carpeta definitiva /Requisitos/Infor.
- Separar informe Regular y PVC.
- Organizar estudiantes por modalidad, carrera, aprobación, supletorio, retiro e inconsistencias de núcleos.
- Preparar tablas, gráficos, control de Excel regular y secciones para Word/PDF.
Con qué se conecta:
- infor.state.js
- infor.match.js
- infor.regular.js
- infor.gemini.js
- ../frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){var out = String(value == null ? "" : value).trim();return /^(null|undefined|nan|n\/a|s\/n)$/i.test(out) ? "" : out;}
  function num(value){var n = Number(text(value).replace(",", "."));return Number.isFinite(n) ? n : null;}
  function round2(value){return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;}
  function safeList(value){return Array.isArray(value) ? value : [];}

  var MODS = {EXAMEN_COMPLEXIVO:"Examen Complexivo",TRABAJO_TITULACION:"Trabajo de Titulación",ARTICULO_ACADEMICO:"Artículo Académico"};
  var ESTADOS = {APROBADO:"Aprobado",REPROBADO:"Reprobado",SIN_NOTA:"Sin nota",RETIRADO:"Retirado",SIN_COMPLEXIVO:"Sin complexivo",INCONSISTENCIA:"Inconsistencia"};

  function pick(row, aliases){
    row = row || {};
    var keys = Object.keys(row);
    var normalized = aliases.map(function(x){return text(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");});
    for(var i = 0; i < keys.length; i += 1){
      var k = keys[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if(normalized.indexOf(k) >= 0 || normalized.some(function(a){return k.indexOf(a) >= 0 || a.indexOf(k) >= 0;})){
        if(text(row[keys[i]])){return row[keys[i]];}
      }
    }
    return "";
  }

  function estadoLabel(value){return ESTADOS[text(value).toUpperCase()] || text(value) || "Sin estado";}

  function noteInfo(item){
    var raw = (item && item.excel && item.excel.raw) || (item && item.base && item.base.raw) || {};
    var modalidad = text(item && item.modalidadTitulacion);
    var nart = num(pick(raw, ["Notart","Nart","NotaArt","nota articulo","nota artículo","nart"]));
    var ndef = num(pick(raw, ["Notdef","Ndef","NotaDef","nota defensa","ndef"]));
    var nfin = num(raw.notaFinal != null ? raw.notaFinal : pick(raw, ["Notafinal","NotaFinal","Nfin","nota final","notaFinal","notafinal","nfin"]));
    var practico = num(raw.notaPractico != null ? raw.notaPractico : pick(raw, ["notaPractico","nota práctico","nota practico","practico","práctico"]));
    var teorico = num(raw.notaTeorico != null ? raw.notaTeorico : pick(raw, ["notaTeorico","nota teórico","nota teorico","teorico","teórico"]));
    var supletorio = num(raw.notaSupletorio != null ? raw.notaSupletorio : pick(raw, ["notaSupletorio","nota supletorio"]));
    var formula = text(raw._inforNotaFormula || "");
    var quedoSupletorio = !!raw._inforQuedoSupletorio;
    if(nfin == null && modalidad === "EXAMEN_COMPLEXIVO" && supletorio != null){nfin = supletorio;formula = formula || "notaSupletorio";quedoSupletorio = true;}
    if(nfin == null && modalidad === "EXAMEN_COMPLEXIVO" && practico != null && teorico != null){nfin = round2((practico * 0.60) + (teorico * 0.40));formula = formula || "notaPractico*0.60 + notaTeorico*0.40";}
    if(nfin == null && nart != null && ndef != null && nart >= 7){nfin = round2((nart * 0.70) + (ndef * 0.30));formula = formula || "NART*0.70 + NDEF*0.30";}
    var estado = text(raw._inforEstadoAcademico || "");
    if(!estado){estado = nfin == null ? "SIN_NOTA" : (nfin >= 7 ? "APROBADO" : "REPROBADO");}
    var detalle = "";
    if(modalidad === "EXAMEN_COMPLEXIVO"){
      detalle = "Práctico: " + (practico == null ? "—" : practico) + " · Teórico: " + (teorico == null ? "—" : teorico) + (supletorio == null ? "" : " · Supletorio: " + supletorio);
    }else if(modalidad === "TRABAJO_TITULACION"){
      detalle = "NART: " + (nart == null ? "—" : nart) + " · NDEF: " + (ndef == null ? "—" : ndef);
    }
    var nucleos = raw._inforNucleos || null;
    if(nucleos){detalle += (detalle ? " · " : "") + "Núcleos: " + (nucleos.aprobados || 0) + "/" + (nucleos.total || 0) + (nucleos.retirado ? " · Retirado" : "");}
    return {nart:nart,ndef:ndef,nfin:nfin,estado:estado,estadoLabel:estadoLabel(estado),practico:practico,teorico:teorico,supletorio:supletorio,formula:formula,detalle:detalle,quedoSupletorio:quedoSupletorio,inconsistenciaNucleos:!!raw._inforInconsistenciaNucleos,inconsistenciaDetalle:text(raw._inforInconsistenciaDetalle || ""),nucleos:nucleos};
  }

  function baseRow(item){
    var n = noteInfo(item);
    var raw = (item && item.excel && item.excel.raw) || {};
    return {cedula:text(item.cedula),estudiante:text(item.nombres),carrera:text(item.carrera),modalidad:item.modalidadTitulacion || "",modalidadLabel:item.modalidadLabel || MODS[item.modalidadTitulacion] || "Sin modalidad",titulo:text(item.titulo),tutor:text(item.tutor),notaFinal:n.nfin,estado:n.estado,estadoLabel:n.estadoLabel,match:item.status || "",metodo:item.method || "",notaPractico:n.practico,notaTeorico:n.teorico,notaSupletorio:n.supletorio,nart:n.nart,ndef:n.ndef,formulaNota:n.formula,detalleNota:n.detalle,quedoSupletorio:n.quedoSupletorio ? "Sí" : "No",inconsistenciaNucleos:n.inconsistenciaNucleos ? "Sí" : "No",inconsistenciaDetalle:n.inconsistenciaDetalle,nucleos:n.nucleos,hoja:text(raw._inforSheet || (item.excel && item.excel.sheet) || "")};
  }

  function groupBy(rows, key){var map = {};rows.forEach(function(row){var k = text(typeof key === "function" ? key(row) : row[key]) || "Sin dato";(map[k] = map[k] || []).push(row);});return map;}
  function countBy(rows, key){var map = groupBy(rows, key);return Object.keys(map).sort(function(a,b){return a.localeCompare(b, "es");}).map(function(k){return {label:k, value:map[k].length};});}
  function average(rows){var vals = rows.map(function(r){return r.notaFinal;}).filter(function(n){return n != null;});if(!vals.length){return null;}return round2(vals.reduce(function(a,b){return a + b;}, 0) / vals.length);}

  function summary(rows){
    var aprobados = rows.filter(function(r){return r.estado === "APROBADO";}).length;
    var reprobados = rows.filter(function(r){return r.estado === "REPROBADO";}).length;
    var retirados = rows.filter(function(r){return r.estado === "RETIRADO";}).length;
    var sinComplexivo = rows.filter(function(r){return r.estado === "SIN_COMPLEXIVO";}).length;
    var sinNota = rows.filter(function(r){return r.estado === "SIN_NOTA";}).length;
    var supletorios = rows.filter(function(r){return r.quedoSupletorio === "Sí";}).length;
    var inconsistencias = rows.filter(function(r){return r.inconsistenciaNucleos === "Sí";}).length;
    return {total:rows.length,aprobados:aprobados,reprobados:reprobados,retirados:retirados,sinComplexivo:sinComplexivo,sinNota:sinNota,supletorios:supletorios,inconsistencias:inconsistencias,promedio:average(rows)};
  }

  function careerTables(rows){var map = groupBy(rows, "carrera");return Object.keys(map).sort(function(a,b){return a.localeCompare(b, "es");}).map(function(carrera){var list = map[carrera];return {carrera:carrera,resumen:summary(list),rows:list};});}
  function charts(rows){return {porCarrera:countBy(rows, "carrera"),porModalidad:countBy(rows, "modalidadLabel"),porEstado:countBy(rows, "estadoLabel"),notasPorModalidad:Object.keys(groupBy(rows, "modalidadLabel")).map(function(mod){var list = groupBy(rows, "modalidadLabel")[mod];return {label:mod,value:average(list) || 0};})};}
  function cronogramaSection(title, parsed){parsed = parsed || {};return {id:"cronograma_" + title.toLowerCase().replace(/\s+/g,"_"),title:title,type:"cronograma",include:!!(parsed.ok && safeList(parsed.rows).length),rows:safeList(parsed.rows)};}
  function resultSection(id, title, rows){return {id:id,title:title,type:"resultados",include:rows.length > 0,resumen:summary(rows),carreras:careerTables(rows),rows:rows};}
  function textSection(id, title, content){return {id:id,title:title,type:"texto",include:!!text(content),content:text(content)};}

  function regularControlSection(snapshot){
    var regular = snapshot.matchResult && snapshot.matchResult.regularAnalysis ? snapshot.matchResult.regularAnalysis : null;
    if(!regular){return {include:false};}
    var s = regular.summary || {};
    var c = regular.complexivo || {};
    var n = regular.nucleos || {};
    var t = regular.trabajoTitulacion || {};
    return {id:"control_excel_regular",title:"Control del Excel regular",type:"control_regular",include:true,resumen:[
      {label:"Fuente principal del informe", value:"Excel cargado en Infor"},
      {label:"Filas totales leídas", value:s.totalExcel || 0},
      {label:"Estudiantes usados en el informe", value:s.validForReport || 0},
      {label:"Hoja NÚCLEOS", value:(n.total || 0) + " estudiantes · " + (n.aprobados || 0) + " con 4 núcleos aprobados · " + (n.retirados || 0) + " retirados"},
      {label:"Docentes de prueba", value:"Núcleo 1: Docente 1 · Núcleo 2: Docente 2 · Núcleo 3: Docente 3 · Núcleo 4: Docente 4"},
      {label:"Complexivo", value:(c.totalFinal || 0) + " estudiantes únicos · fórmula: " + (c.formula || "notaSupletorio o 60/40")},
      {label:"Estudiantes en supletorio", value:s.supletorios || 0},
      {label:"Inconsistencias", value:(s.inconsistencias || 0) + " estudiantes con complexivo sin 4 núcleos aprobados"},
      {label:"Duplicados omitidos/reemplazados", value:s.duplicates || 0},
      {label:"Trabajo de Titulación / Hoja3", value:t.ignored ? "Ignorada temporalmente" : (t.totalFinal || 0)}
    ],excluded:safeList(regular.excluded).slice(0, 100),duplicates:safeList(regular.duplicates).slice(0, 100),inconsistencies:safeList(regular.inconsistencies).slice(0, 100)};
  }

  function buildRegular(snapshot, rows){
    var complexivo = rows.filter(function(r){return r.modalidad === "EXAMEN_COMPLEXIVO";});
    var c = snapshot.cronogramasParsed || {};
    return [
      textSection("marco_legal", "Marco legal", "Sección institucional fija pendiente de plantilla final."),
      textSection("reglamento_complexivo", "Reglamento del Examen Complexivo", "Sección institucional fija pendiente de plantilla final."),
      cronogramaSection("Cronograma Examen Complexivo", c.complexivo),
      cronogramaSection("Cronograma Trabajo de Titulación", c.trabajoTitulacion),
      textSection("metodologia", "Metodología de Núcleos Estructurantes", "Para esta lectura, cada estudiante debe registrar cuatro núcleos. La nota mínima de aprobación por núcleo es 7. Los registros con nota 0 se consideran retirados y no se contabilizan como reprobados."),
      regularControlSection(snapshot),
      resultSection("resultados_complexivo", "Resultados de Examen Complexivo por carrera", complexivo),
      textSection("informe_general", "Informe general de cohorte", "Síntesis general generada a partir de estudiantes del Excel cargado, notas de núcleos, notas de complexivo, supletorios, retirados e inconsistencias detectadas."),
      textSection("analisis_estrategico", "Análisis estratégico", "Pendiente de redacción Gemini."),
      textSection("conclusiones", "Conclusiones", "Pendiente de redacción Gemini."),
      textSection("recomendaciones", "Recomendaciones", "Pendiente de redacción Gemini.")
    ];
  }

  function buildPVC(snapshot, rows){
    var pvc = rows.filter(function(r){return r.modalidad === "ARTICULO_ACADEMICO";});
    var c = snapshot.cronogramasParsed || {};
    return [textSection("marco_legal", "Marco legal", "Sección institucional fija pendiente de plantilla final."),textSection("fundamento_pvc", "Fundamento del proceso PVC", "Sección institucional base para proceso PVC."),cronogramaSection("Cronograma Artículo Académico PVC", c.pvc),textSection("metodologia_pvc", "Metodología del Artículo Académico", "Sección metodológica base para informe PVC."),resultSection("resultados_pvc", "Resultados de Artículo Académico por carrera", pvc),textSection("analisis_estrategico", "Análisis estratégico", "Pendiente de redacción Gemini."),textSection("conclusiones", "Conclusiones", "Pendiente de redacción Gemini."),textSection("recomendaciones", "Recomendaciones", "Pendiente de redacción Gemini.")];
  }

  function applyGemini(report, analysis){analysis = analysis || {};report.analysis = analysis;report.sections = report.sections.map(function(section){if(section.id === "analisis_estrategico"){section.content = analysis.analisisGeneral || analysis.analisisEstrategico || section.content;}if(section.id === "conclusiones"){section.content = Array.isArray(analysis.conclusiones) ? analysis.conclusiones.join("\n") : (analysis.conclusiones || section.content);}if(section.id === "recomendaciones"){section.content = Array.isArray(analysis.recomendaciones) ? analysis.recomendaciones.join("\n") : (analysis.recomendaciones || section.content);}return section;});return report;}

  function build(snapshot, analysis){
    snapshot = snapshot || {};
    var matches = snapshot.matchResult && Array.isArray(snapshot.matchResult.matches) ? snapshot.matchResult.matches : [];
    var rows = matches.map(baseRow);
    var type = snapshot.periodType || {};
    var kind = type.id === "PVC" ? "PVC" : "REGULAR";
    var report = {ok:rows.length > 0,kind:kind,periodId:snapshot.periodId,periodLabel:snapshot.periodLabel,title:"Informe de Titulación " + (snapshot.periodLabel || ""),generatedAt:new Date().toISOString(),resumen:summary(rows),charts:charts(rows),modalidades:countBy(rows, "modalidadLabel"),carreras:careerTables(rows),rows:rows,regularAnalysis:snapshot.matchResult && snapshot.matchResult.regularAnalysis ? snapshot.matchResult.regularAnalysis : null,sections:kind === "PVC" ? buildPVC(snapshot, rows) : buildRegular(snapshot, rows),anexos:safeList(snapshot.anexos),analysis:null};
    report.sections = report.sections.filter(function(section){return section.include !== false;});
    if(analysis){applyGemini(report, analysis);} 
    return report;
  }

  window.InforReport = {build:build,applyGemini:applyGemini,summary:summary,charts:charts,estadoLabel:estadoLabel};
})(window);
