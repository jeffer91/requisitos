/* =========================================================
Nombre completo: infor.report.js
Ruta o ubicación: /Requisitos/Titulacion/core/infor.report.js
Función o funciones:
- Construir la estructura lógica del Informe de Titulación.
- Separar informe Regular y PVC.
- Organizar estudiantes por modalidad, carrera, aprobación y notas.
- Preparar tablas, gráficos y secciones para Word/PDF.
Con qué se conecta:
- core/infor.state.js
- core/infor.match.js
- core/infor.gemini.js
- frontend/titulacion.app.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function num(value){var n = Number(text(value).replace(",", "."));return Number.isFinite(n) ? n : null;}
  function round2(value){return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;}
  function safeList(value){return Array.isArray(value) ? value : [];}

  var MODS = {
    EXAMEN_COMPLEXIVO:"Examen Complexivo",
    TRABAJO_TITULACION:"Trabajo de Titulación",
    ARTICULO_ACADEMICO:"Artículo Académico"
  };

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

  function noteInfo(item){
    var raw = (item && item.excel && item.excel.raw) || (item && item.base && item.base.raw) || {};
    var nart = num(pick(raw, ["Notart","Nart","NotaArt","nota articulo","nota artículo"]));
    var ndef = num(pick(raw, ["Notdef","Ndef","NotaDef","nota defensa"]));
    var nfin = num(pick(raw, ["Notafinal","NotaFinal","Nfin","nota final"]));
    if(nfin == null && nart != null && ndef != null && nart >= 7){nfin = round2((nart * 0.70) + (ndef * 0.30));}
    var estado = nfin == null ? "SIN_NOTA" : (nfin >= 7 ? "APROBADO" : "REPROBADO");
    return {nart:nart, ndef:ndef, nfin:nfin, estado:estado};
  }

  function baseRow(item){
    var n = noteInfo(item);
    return {
      cedula:text(item.cedula),
      estudiante:text(item.nombres),
      carrera:text(item.carrera),
      modalidad:item.modalidadTitulacion || "",
      modalidadLabel:item.modalidadLabel || MODS[item.modalidadTitulacion] || "Sin modalidad",
      titulo:text(item.titulo),
      tutor:text(item.tutor),
      notaFinal:n.nfin,
      estado:n.estado,
      match:item.status || "",
      metodo:item.method || ""
    };
  }

  function groupBy(rows, key){
    var map = {};
    rows.forEach(function(row){var k = text(typeof key === "function" ? key(row) : row[key]) || "Sin dato";(map[k] = map[k] || []).push(row);});
    return map;
  }

  function countBy(rows, key){
    var map = groupBy(rows, key);
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b, "es");}).map(function(k){return {label:k, value:map[k].length};});
  }

  function average(rows){
    var vals = rows.map(function(r){return r.notaFinal;}).filter(function(n){return n != null;});
    if(!vals.length){return null;}
    return round2(vals.reduce(function(a,b){return a + b;}, 0) / vals.length);
  }

  function summary(rows){
    var aprobados = rows.filter(function(r){return r.estado === "APROBADO";}).length;
    var reprobados = rows.filter(function(r){return r.estado === "REPROBADO";}).length;
    var sinNota = rows.filter(function(r){return r.estado === "SIN_NOTA";}).length;
    return {total:rows.length, aprobados:aprobados, reprobados:reprobados, sinNota:sinNota, promedio:average(rows)};
  }

  function careerTables(rows){
    var map = groupBy(rows, "carrera");
    return Object.keys(map).sort(function(a,b){return a.localeCompare(b, "es");}).map(function(carrera){
      var list = map[carrera];
      return {carrera:carrera, resumen:summary(list), rows:list};
    });
  }

  function charts(rows){
    return {
      porCarrera:countBy(rows, "carrera"),
      porModalidad:countBy(rows, "modalidadLabel"),
      porEstado:countBy(rows, "estado"),
      notasPorModalidad:Object.keys(groupBy(rows, "modalidadLabel")).map(function(mod){var list = groupBy(rows, "modalidadLabel")[mod];return {label:mod, value:average(list) || 0};})
    };
  }

  function cronogramaSection(title, parsed){
    parsed = parsed || {};
    return {id:"cronograma_" + title.toLowerCase().replace(/\s+/g,"_"), title:title, type:"cronograma", include:!!(parsed.ok && safeList(parsed.rows).length), rows:safeList(parsed.rows)};
  }

  function resultSection(id, title, rows){
    return {id:id, title:title, type:"resultados", include:rows.length > 0, resumen:summary(rows), carreras:careerTables(rows), rows:rows};
  }

  function textSection(id, title, content){
    return {id:id, title:title, type:"texto", include:!!text(content), content:text(content)};
  }

  function buildRegular(snapshot, rows){
    var complexivo = rows.filter(function(r){return r.modalidad === "EXAMEN_COMPLEXIVO";});
    var trabajo = rows.filter(function(r){return r.modalidad === "TRABAJO_TITULACION";});
    var c = snapshot.cronogramasParsed || {};
    return [
      textSection("marco_legal", "Marco legal", "Sección institucional fija pendiente de plantilla final."),
      textSection("reglamento_complexivo", "Reglamento del Examen Complexivo", "Sección institucional fija pendiente de plantilla final."),
      cronogramaSection("Cronograma Examen Complexivo", c.complexivo),
      cronogramaSection("Cronograma Trabajo de Titulación", c.trabajoTitulacion),
      textSection("metodologia", "Metodología de Núcleos Estructurantes", "Sección metodológica base para informe regular."),
      resultSection("resultados_complexivo", "Resultados de Examen Complexivo por carrera", complexivo),
      resultSection("resultados_trabajo", "Resultados de Trabajo de Titulación por carrera", trabajo),
      textSection("informe_general", "Informe general de cohorte", "Síntesis general generada a partir de estudiantes, modalidades, notas y aprobación."),
      textSection("analisis_estrategico", "Análisis estratégico", "Pendiente de redacción Gemini."),
      textSection("conclusiones", "Conclusiones", "Pendiente de redacción Gemini."),
      textSection("recomendaciones", "Recomendaciones", "Pendiente de redacción Gemini.")
    ];
  }

  function buildPVC(snapshot, rows){
    var pvc = rows.filter(function(r){return r.modalidad === "ARTICULO_ACADEMICO";});
    var c = snapshot.cronogramasParsed || {};
    return [
      textSection("marco_legal", "Marco legal", "Sección institucional fija pendiente de plantilla final."),
      textSection("fundamento_pvc", "Fundamento del proceso PVC", "Sección institucional base para proceso PVC."),
      cronogramaSection("Cronograma Artículo Académico PVC", c.pvc),
      textSection("metodologia_pvc", "Metodología del Artículo Académico", "Sección metodológica base para informe PVC."),
      resultSection("resultados_pvc", "Resultados de Artículo Académico por carrera", pvc),
      textSection("analisis_estrategico", "Análisis estratégico", "Pendiente de redacción Gemini."),
      textSection("conclusiones", "Conclusiones", "Pendiente de redacción Gemini."),
      textSection("recomendaciones", "Recomendaciones", "Pendiente de redacción Gemini.")
    ];
  }

  function applyGemini(report, analysis){
    analysis = analysis || {};
    report.analysis = analysis;
    report.sections = report.sections.map(function(section){
      if(section.id === "analisis_estrategico"){section.content = analysis.analisisGeneral || analysis.analisisEstrategico || section.content;}
      if(section.id === "conclusiones"){section.content = Array.isArray(analysis.conclusiones) ? analysis.conclusiones.join("\n") : (analysis.conclusiones || section.content);}
      if(section.id === "recomendaciones"){section.content = Array.isArray(analysis.recomendaciones) ? analysis.recomendaciones.join("\n") : (analysis.recomendaciones || section.content);}
      return section;
    });
    return report;
  }

  function build(snapshot, analysis){
    snapshot = snapshot || {};
    var matches = snapshot.matchResult && Array.isArray(snapshot.matchResult.matches) ? snapshot.matchResult.matches : [];
    var rows = matches.map(baseRow);
    var type = snapshot.periodType || {};
    var kind = type.id === "PVC" ? "PVC" : "REGULAR";
    var report = {
      ok:rows.length > 0,
      kind:kind,
      periodId:snapshot.periodId,
      periodLabel:snapshot.periodLabel,
      title:"Informe de Titulación " + (snapshot.periodLabel || ""),
      generatedAt:new Date().toISOString(),
      resumen:summary(rows),
      charts:charts(rows),
      modalidades:countBy(rows, "modalidadLabel"),
      carreras:careerTables(rows),
      rows:rows,
      sections:kind === "PVC" ? buildPVC(snapshot, rows) : buildRegular(snapshot, rows),
      anexos:safeList(snapshot.anexos),
      analysis:null
    };
    report.sections = report.sections.filter(function(section){return section.include !== false;});
    if(analysis){applyGemini(report, analysis);}
    return report;
  }

  window.InforReport = {build:build, applyGemini:applyGemini, summary:summary, charts:charts};
})(window);
