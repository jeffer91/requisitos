/* =========================================================
Nombre completo: coo.mail.js
Ruta o ubicación: /Requisitos/Coordi/coo.mail.js
Función o funciones:
- Generar correos para Coordi.
- Crear asunto, cuerpo en texto y cuerpo HTML con tablas reales.
- Copiar HTML al portapapeles y abrir Outlook/correo mediante mailto.
- Mantener respaldo si Outlook no inserta automáticamente la tabla.
- En correo detallado usar la tabla solicitada: Cédula, Nombre y Carrera.
Con qué se conecta:
- coo.report.js
- coo.render.js
- coordi.app.js
- electron/preload.js
- electron/main.js
========================================================= */
(function(window){
  "use strict";

  var VERSION = "1.0.0-coo-mail.2";

  function text(value){return String(value == null ? "" : value).trim();}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function fmt(value){value = Number(value || 0);return value.toLocaleString("es-EC");}

  function areaById(report, areaId){
    var found = null;
    arr(report && report.areas).some(function(area){if(area.id === areaId){found = area;return true;}return false;});
    return found;
  }

  function filterText(report){
    report = report || {};
    var f = report.filters || {};
    var parts = [];
    if(f.periodId){parts.push("Período: " + f.periodId);}
    if(f.division){parts.push("División: " + f.division);}
    return parts.length ? parts.join(" · ") : "Todos los períodos y divisiones disponibles";
  }

  function baseStyle(){return "font-family:Arial,sans-serif;color:#0f172a;font-size:13px;line-height:1.45;";}

  function tableHtml(headers, rows){
    rows = arr(rows);
    if(!rows.length){return '<p style="'+baseStyle()+'color:#64748b;"><strong>Sin datos para mostrar.</strong></p>';}
    var html = '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;color:#0f172a;">';
    html += '<thead><tr>';
    headers.forEach(function(h){html += '<th style="border:1px solid #cbd5e1;background:#f1f5f9;color:#334155;text-align:left;padding:8px;font-weight:bold;">'+esc(h.label)+'</th>';});
    html += '</tr></thead><tbody>';
    rows.forEach(function(row){
      html += '<tr>';
      headers.forEach(function(h){
        var value = typeof h.value === "function" ? h.value(row) : row[h.key];
        html += '<td style="border:1px solid #cbd5e1;padding:8px;vertical-align:top;">'+esc(value)+'</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function textTable(headers, rows){
    rows = arr(rows);
    if(!rows.length){return "Sin datos para mostrar.";}
    var lines = [];
    lines.push(headers.map(function(h){return h.label;}).join(" | "));
    lines.push(headers.map(function(){return "---";}).join(" | "));
    rows.forEach(function(row){
      lines.push(headers.map(function(h){
        var value = typeof h.value === "function" ? h.value(row) : row[h.key];
        return text(value).replace(/\s+/g," ");
      }).join(" | "));
    });
    return lines.join("\n");
  }

  function wrapHtml(title, bodyHtml){
    return '<div style="'+baseStyle()+'">'
      + '<h2 style="margin:0 0 10px;color:#1e3a8a;font-size:18px;">'+esc(title)+'</h2>'
      + bodyHtml
      + '<p style="margin-top:18px;">Atentamente,<br><strong>Coordinación de Titulación</strong></p>'
      + '</div>';
  }

  function buildGlobal(report){
    report = report || {};
    var global = report.global || {};
    var rows = arr(global.areas);
    var subject = "Reporte global de pendientes por área";
    var html = wrapHtml(subject,
      '<p>Buen día, <strong>'+esc(global.saludo || global.responsable || "Dr. Alex León")+'</strong>.</p>'
      + '<p>Se remite el resumen ejecutivo de pendientes por área.</p>'
      + '<p><strong>Corte:</strong> '+esc(filterText(report))+'</p>'
      + '<p><strong>Estudiantes revisados:</strong> '+fmt(global.totalEstudiantesRevisados)+'<br>'
      + '<strong>Estudiantes con pendientes:</strong> '+fmt(global.totalEstudiantesPendientes)+'<br>'
      + '<strong>Áreas con pendientes:</strong> '+fmt(global.totalAreasConPendientes)+'<br>'
      + '<strong>Requisitos pendientes acumulados:</strong> '+fmt(global.totalPendientes)+'</p>'
      + tableHtml([
        {label:"Área", value:function(r){return r.area;}},
        {label:"Responsable", value:function(r){return r.responsable;}},
        {label:"Correo", value:function(r){return r.correo;}},
        {label:"Estudiantes pendientes", value:function(r){return fmt(r.totalEstudiantes);}},
        {label:"Pendientes acumulados", value:function(r){return fmt(r.totalPendientes);}}
      ], rows)
    );
    var plain = [
      "Buen día, " + (global.saludo || global.responsable || "Dr. Alex León") + ".",
      "",
      "Se remite el resumen ejecutivo de pendientes por área.",
      "Corte: " + filterText(report),
      "Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados),
      "Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes),
      "Áreas con pendientes: " + fmt(global.totalAreasConPendientes),
      "Requisitos pendientes acumulados: " + fmt(global.totalPendientes),
      "",
      textTable([
        {label:"Área", value:function(r){return r.area;}},
        {label:"Responsable", value:function(r){return r.responsable;}},
        {label:"Estudiantes", value:function(r){return fmt(r.totalEstudiantes);}},
        {label:"Pendientes", value:function(r){return fmt(r.totalPendientes);}}
      ], rows),
      "",
      "Atentamente,",
      "Coordinación de Titulación"
    ].join("\n");
    return {kind:"global", to:global.correo || "", subject:subject, html:html, plain:plain};
  }

  function buildAreaSummary(report, areaId){
    var area = areaById(report, areaId);
    if(!area){throw new Error("No se encontró el área seleccionada.");}
    var subject = "Reporte de pendientes · " + area.area;
    var html = wrapHtml(subject,
      '<p>Buen día, <strong>'+esc(area.saludo || area.responsable)+'</strong>.</p>'
      + '<p>Se reportan pendientes correspondientes al área <strong>'+esc(area.area)+'</strong>.</p>'
      + '<p><strong>Corte:</strong> '+esc(filterText(report))+'</p>'
      + '<p><strong>Estudiantes pendientes:</strong> '+fmt(area.totalEstudiantes)+'<br>'
      + '<strong>Requisitos pendientes acumulados:</strong> '+fmt(area.totalPendientes)+'<br>'
      + '<strong>Carreras afectadas:</strong> '+fmt(arr(area.carreras).length)+'</p>'
      + tableHtml([
        {label:"Carrera", value:function(r){return r.carrera;}},
        {label:"Estudiantes", value:function(r){return fmt(r.estudiantes);}},
        {label:"Pendientes", value:function(r){return fmt(r.pendientes);}}
      ], area.porCarrera)
    );
    var plain = [
      "Buen día, " + (area.saludo || area.responsable) + ".",
      "",
      "Se reportan pendientes correspondientes al área " + area.area + ".",
      "Corte: " + filterText(report),
      "Estudiantes pendientes: " + fmt(area.totalEstudiantes),
      "Requisitos pendientes acumulados: " + fmt(area.totalPendientes),
      "Carreras afectadas: " + fmt(arr(area.carreras).length),
      "",
      textTable([
        {label:"Carrera", value:function(r){return r.carrera;}},
        {label:"Estudiantes", value:function(r){return fmt(r.estudiantes);}},
        {label:"Pendientes", value:function(r){return fmt(r.pendientes);}}
      ], area.porCarrera),
      "",
      "Atentamente,",
      "Coordinación de Titulación"
    ].join("\n");
    return {kind:"area-summary", areaId:areaId, to:area.correo || "", subject:subject, html:html, plain:plain};
  }

  function buildAreaDetail(report, areaId){
    var area = areaById(report, areaId);
    if(!area){throw new Error("No se encontró el área seleccionada.");}
    var subject = "Detalle de estudiantes pendientes · " + area.area;
    var headers = [
      {label:"Cédula", value:function(r){return r.cedula;}},
      {label:"Nombre", value:function(r){return r.nombre;}},
      {label:"Carrera", value:function(r){return r.carrera;}}
    ];
    var html = wrapHtml(subject,
      '<p>Buen día, <strong>'+esc(area.saludo || area.responsable)+'</strong>.</p>'
      + '<p>Se remite el detalle de estudiantes con pendientes correspondientes al área <strong>'+esc(area.area)+'</strong>.</p>'
      + '<p><strong>Corte:</strong> '+esc(filterText(report))+'</p>'
      + '<p><strong>Estudiantes pendientes:</strong> '+fmt(area.totalEstudiantes)+'<br>'
      + '<strong>Requisitos pendientes acumulados:</strong> '+fmt(area.totalPendientes)+'</p>'
      + tableHtml(headers, area.estudiantes)
    );
    var plain = [
      "Buen día, " + (area.saludo || area.responsable) + ".",
      "",
      "Se remite el detalle de estudiantes con pendientes correspondientes al área " + area.area + ".",
      "Corte: " + filterText(report),
      "Estudiantes pendientes: " + fmt(area.totalEstudiantes),
      "Requisitos pendientes acumulados: " + fmt(area.totalPendientes),
      "",
      textTable(headers, area.estudiantes),
      "",
      "Atentamente,",
      "Coordinación de Titulación"
    ].join("\n");
    return {kind:"area-detail", areaId:areaId, to:area.correo || "", subject:subject, html:html, plain:plain};
  }

  function build(report, options){
    options = options || {};
    if(options.kind === "global"){return buildGlobal(report);}
    if(options.kind === "area-summary"){return buildAreaSummary(report, options.areaId);}
    if(options.kind === "area-detail"){return buildAreaDetail(report, options.areaId);}
    throw new Error("Tipo de correo no reconocido.");
  }

  function mailto(mail){
    var body = "Se preparó el contenido HTML del reporte.\n\nSi Outlook no muestra la tabla automáticamente, pegue el contenido copiado en el cuerpo del correo con Ctrl+V.\n\n" + mail.plain;
    return "mailto:" + encodeURIComponent(mail.to || "") + "?subject=" + encodeURIComponent(mail.subject || "") + "&body=" + encodeURIComponent(body);
  }

  function copyHtml(mail){
    mail = mail || {};
    var html = mail.html || "";
    var plain = mail.plain || "";
    if(navigator.clipboard && window.ClipboardItem){
      var item = new ClipboardItem({
        "text/html": new Blob([html], {type:"text/html"}),
        "text/plain": new Blob([plain], {type:"text/plain"})
      });
      return navigator.clipboard.write([item]);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){return navigator.clipboard.writeText(plain);}
    return Promise.reject(new Error("No se pudo copiar el correo al portapapeles."));
  }

  function openExternal(url){
    if(window.electronAPI && typeof window.electronAPI.openExternal === "function"){return window.electronAPI.openExternal(url);}
    window.location.href = url;
    return Promise.resolve(true);
  }

  function open(mail){
    return copyHtml(mail).catch(function(error){
      console.warn("[COOMail] No se pudo copiar HTML; se abrirá mailto con texto plano.", error);
      return false;
    }).then(function(){return openExternal(mailto(mail));});
  }

  window.COOMail = {
    version:VERSION,
    build:build,
    buildGlobal:buildGlobal,
    buildAreaSummary:buildAreaSummary,
    buildAreaDetail:buildAreaDetail,
    copyHtml:copyHtml,
    open:open,
    mailto:mailto,
    helpers:{esc:esc,fmt:fmt,tableHtml:tableHtml,textTable:textTable,filterText:filterText}
  };
})(window);
