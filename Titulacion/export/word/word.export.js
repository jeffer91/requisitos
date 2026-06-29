/* =========================================================
Nombre completo: word.export.js
Ruta o ubicación: /Requisitos/Titulacion/export/word/word.export.js
Función o funciones:
- Construir el documento Word compatible desde reportDraft.
- Aplicar formato institucional y base APA 7: márgenes, fuente, interlineado, títulos, tablas y figuras.
- Exportar el informe como archivo Word compatible (.doc).
Con qué se conecta:
- core/infor.report.js
- core/infor.state.js
- frontend/titulacion.app.js
- export/pdf/pdf.from-word.js
========================================================= */
(function(window){
  "use strict";

  function text(value){return String(value == null ? "" : value).trim();}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function safeList(value){return Array.isArray(value) ? value : [];}
  function fileSafe(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\-_]+/g, "-").replace(/^-+|-+$/g, "") || "informe";}
  function today(){return new Date().toLocaleDateString("es-EC", {year:"numeric", month:"long", day:"2-digit"});}

  function filename(report, ext){
    report = report || {};
    return "UTET-INF-Informe-de-Titulacion-" + fileSafe(report.periodLabel || report.periodId || "periodo") + "." + (ext || "doc");
  }

  function styles(){
    return "<style>" +
      "@page{margin:2.54cm;}" +
      "body{font-family:'Times New Roman',serif;font-size:12pt;line-height:2;color:#111;margin:0;}" +
      ".cover{min-height:22cm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always;}" +
      ".cover h1{font-size:18pt;text-transform:uppercase;margin:0 0 18pt;}" +
      ".cover h2{font-size:15pt;margin:0 0 12pt;}" +
      ".cover p{margin:4pt 0;}" +
      "h1{font-size:16pt;text-align:center;text-transform:uppercase;margin:0 0 18pt;}" +
      "h2{font-size:14pt;margin:18pt 0 8pt;}" +
      "h3{font-size:12pt;margin:14pt 0 6pt;}" +
      "p{text-align:justify;margin:0 0 10pt;}" +
      "table{width:100%;border-collapse:collapse;margin:8pt 0 14pt;font-size:10pt;line-height:1.25;}" +
      "th,td{border:1px solid #333;padding:5pt;vertical-align:top;}" +
      "th{background:#f1f5f9;font-weight:bold;text-align:center;}" +
      ".caption{font-weight:bold;margin:8pt 0 2pt;text-align:left;}" +
      ".source{font-size:10pt;margin-top:-8pt;text-align:left;}" +
      ".page-break{page-break-before:always;}" +
      ".anexo-img{max-width:100%;max-height:20cm;display:block;margin:8pt auto;}" +
      ".small{font-size:10pt;}" +
    "</style>";
  }

  function table(headers, rows, caption, source){
    rows = safeList(rows);
    var html = caption ? '<p class="caption">' + esc(caption) + '</p>' : '';
    html += '<table><thead><tr>' + headers.map(function(h){return '<th>' + esc(h.label) + '</th>';}).join('') + '</tr></thead><tbody>';
    if(!rows.length){
      html += '<tr><td colspan="' + headers.length + '">Sin registros.</td></tr>';
    }else{
      html += rows.map(function(row){
        return '<tr>' + headers.map(function(h){var v = typeof h.value === 'function' ? h.value(row) : row[h.key];return '<td>' + esc(v == null || v === '' ? '—' : v) + '</td>';}).join('') + '</tr>';
      }).join('');
    }
    html += '</tbody></table>';
    if(source){html += '<p class="source">Fuente: ' + esc(source) + '</p>';}
    return html;
  }

  function paragraphize(content){
    return text(content).split(/\n+/).filter(Boolean).map(function(p){return '<p>' + esc(p) + '</p>';}).join('');
  }

  function cover(report){
    return '<section class="cover">' +
      '<h1>Informe Final del Proceso de Titulación</h1>' +
      '<h2>' + esc(report.periodLabel || 'Período') + '</h2>' +
      '<p><strong>Unidad de Titulación y Eficiencia Terminal</strong></p>' +
      '<p><strong>Tipo de informe:</strong> ' + esc(report.kind === 'PVC' ? 'PVC / Artículo Académico' : 'Regular') + '</p>' +
      '<p><strong>Fecha de generación:</strong> ' + esc(today()) + '</p>' +
      '<p class="small">Documento generado por Infor.</p>' +
    '</section>';
  }

  function resumen(report){
    var r = report.resumen || {};
    return '<h1>Informe de Titulación</h1>' +
      table([
        {label:'Indicador', key:'label'},
        {label:'Valor', key:'value'}
      ], [
        {label:'Total de estudiantes', value:r.total || 0},
        {label:'Aprobados', value:r.aprobados || 0},
        {label:'Reprobados', value:r.reprobados || 0},
        {label:'Sin nota', value:r.sinNota || 0},
        {label:'Promedio general', value:r.promedio == null ? '—' : r.promedio}
      ], 'Tabla 1. Resumen general del proceso de titulación', 'BaseLocal e insumos cargados en Infor.');
  }

  function chartTables(report){
    var c = report.charts || {};
    var out = '<h2>Gráficos y distribuciones</h2>';
    out += table([{label:'Carrera', key:'label'}, {label:'Estudiantes', key:'value'}], c.porCarrera || [], 'Tabla 2. Distribución de estudiantes por carrera', 'Motor Infor.');
    out += table([{label:'Modalidad', key:'label'}, {label:'Estudiantes', key:'value'}], c.porModalidad || [], 'Tabla 3. Distribución de estudiantes por modalidad', 'Motor Infor.');
    out += table([{label:'Estado', key:'label'}, {label:'Estudiantes', key:'value'}], c.porEstado || [], 'Tabla 4. Distribución por estado académico', 'Motor Infor.');
    out += table([{label:'Modalidad', key:'label'}, {label:'Promedio', key:'value'}], c.notasPorModalidad || [], 'Tabla 5. Promedio de notas por modalidad', 'Motor Infor.');
    return out;
  }

  function sectionHtml(section, index){
    var html = '<section><h2>' + esc(index + '. ' + (section.title || section.id)) + '</h2>';
    if(section.type === 'texto'){
      html += paragraphize(section.content);
    }else if(section.type === 'cronograma'){
      html += table([
        {label:'Fecha', key:'fecha'},
        {label:'Actividad', key:'actividad'},
        {label:'Responsable', key:'responsable'},
        {label:'Observación', key:'observacion'}
      ], section.rows || [], 'Tabla. ' + section.title, 'Cronograma pegado en Infor.');
    }else if(section.type === 'resultados'){
      html += table([
        {label:'Cédula', key:'cedula'},
        {label:'Estudiante', key:'estudiante'},
        {label:'Carrera', key:'carrera'},
        {label:'Título / Artículo', key:'titulo'},
        {label:'Tutor', key:'tutor'},
        {label:'Nota final', key:'notaFinal'},
        {label:'Estado', key:'estado'}
      ], section.rows || [], 'Tabla. ' + section.title, 'Excel/BaseLocal procesado por Infor.');
      safeList(section.carreras).forEach(function(c){
        html += '<h3>' + esc(c.carrera) + '</h3>';
        html += table([{label:'Indicador', key:'label'}, {label:'Valor', key:'value'}], [
          {label:'Total', value:c.resumen.total || 0},
          {label:'Aprobados', value:c.resumen.aprobados || 0},
          {label:'Reprobados', value:c.resumen.reprobados || 0},
          {label:'Sin nota', value:c.resumen.sinNota || 0},
          {label:'Promedio', value:c.resumen.promedio == null ? '—' : c.resumen.promedio}
        ], 'Resumen por carrera: ' + c.carrera, 'Motor Infor.');
      });
    }
    return html + '</section>';
  }

  function anexos(anexosList){
    anexosList = safeList(anexosList).filter(function(a){return a && (a.preview || a.name || a.title);});
    if(!anexosList.length){return '';}
    var html = '<section class="page-break"><h2>Anexos</h2>';
    anexosList.forEach(function(a, index){
      html += '<h3>Anexo ' + (index + 1) + '. ' + esc(a.title || a.name || 'Evidencia') + '</h3>';
      if(a.preview){html += '<img class="anexo-img" src="' + esc(a.preview) + '" alt="' + esc(a.title || a.name || 'Anexo') + '">';}
      html += '<p class="source">Fuente: imagen cargada en Infor.</p>';
    });
    return html + '</section>';
  }

  function buildHtml(report, anexosList){
    report = report || {};
    var html = '<!doctype html><html><head><meta charset="utf-8">' + styles() + '</head><body>';
    html += cover(report);
    html += resumen(report);
    html += chartTables(report);
    safeList(report.sections).forEach(function(section, i){html += sectionHtml(section, i + 1);});
    html += anexos(anexosList || report.anexos);
    html += '</body></html>';
    return html;
  }

  function download(report, anexosList){
    if(!report || !report.ok){throw new Error('No hay informe listo para exportar.');}
    var html = buildHtml(report, anexosList);
    var blob = new Blob(['\ufeff', html], {type:'application/msword;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename(report, 'doc');
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();}, 600);
    return {ok:true, filename:a.download};
  }

  window.InforWordExport = {buildHtml:buildHtml, download:download, filename:filename};
})(window);
