/* =========================================================
Nombre completo: coo.render.js
Ruta o ubicación: /Requisitos/Coordi/coo.render.js
Función o funciones:
- Pintar reportes reales de Coordi en pantalla.
- Mostrar global, resumen por áreas, reportes listos, tarjetas por responsable y detalle.
- Preparar vista previa visual sin enviar correos todavía.
Con qué se conecta:
- coo.report.js
- coo.config.js
- coordi.app.js
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "1.0.0-coo-render.1";

  function el(id){return document.getElementById(id);}
  function text(value){return String(value == null ? "" : value).trim();}
  function arr(value){return Array.isArray(value) ? value : [];} 
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function fmt(value){value = Number(value || 0);return value.toLocaleString("es-EC");}
  function selected(state, value){return text(state) === text(value) ? "selected" : "";}
  function option(value,label,isSelected){return '<option value="'+esc(value)+'" '+(isSelected?'selected':'')+'>'+esc(label || value)+'</option>';}

  function setText(id,value){var node=el(id);if(node){node.textContent=text(value);}}
  function setHTML(id,value){var node=el(id);if(node){node.innerHTML=value;}}

  function table(headers, rows){
    rows = arr(rows);
    if(!rows.length){return '<div class="empty">Sin datos para mostrar.</div>';}
    var html = '<table><thead><tr>' + headers.map(function(h){return '<th>'+esc(h.label)+'</th>';}).join('') + '</tr></thead><tbody>';
    html += rows.map(function(row){
      return '<tr>' + headers.map(function(h){
        var value = typeof h.value === "function" ? h.value(row) : row[h.key];
        return '<td>'+value+'</td>';
      }).join('') + '</tr>';
    }).join('');
    return html + '</tbody></table>';
  }

  function areaById(report, areaId){
    var found = null;
    arr(report && report.areas).some(function(area){
      if(area.id === areaId){found = area;return true;}
      return false;
    });
    return found;
  }

  function firstPendingArea(report){
    var areas = arr(report && report.areasConPendientes);
    return areas.length ? areas[0].id : "";
  }

  function totalCarreras(report){
    var map = Object.create(null);
    arr(report && report.areasConPendientes).forEach(function(area){
      arr(area.carreras).forEach(function(carrera){map[carrera] = true;});
    });
    return Object.keys(map).length;
  }

  function fillFilters(report,state){
    var p = el("coordi-periodo");
    var d = el("coordi-division");
    if(p){
      p.innerHTML = option("","Seleccione período",!state.periodId) + arr(report.periodList).map(function(period){
        return option(period.id || period.value || period.label, period.label || period.periodoLabel || period.id, text(state.periodId) === text(period.id || period.value || period.label));
      }).join("");
      p.value = state.periodId || "";
    }
    if(d){
      d.innerHTML = option("","Todas",!state.division) + arr(report.divisionList).map(function(division){
        return option(division, division, text(state.division) === text(division));
      }).join("");
      d.value = state.division || "";
    }
  }

  function renderKpis(report){
    var global = report.global || {};
    setText("coordi-total", fmt(global.totalEstudiantesRevisados));
    setText("coordi-alta", fmt(global.totalEstudiantesPendientes));
    setText("coordi-media", fmt(global.totalAreasConPendientes));
    setText("coordi-baja", fmt(global.totalPendientes));
    setText("coordi-carreras-total", fmt(totalCarreras(report)));
  }

  function renderGlobal(report){
    var global = report.global || {};
    setText("coordi-global-name", global.responsable || "Dr. Alex León");
    setText("coordi-global-email", global.correo || "aleon@itsqmet.edu.ec");
    setText("coordi-global-phone", global.whatsapp || "593984059654");
    setText("coordi-global-desc", "Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes) + " · Áreas con pendientes: " + fmt(global.totalAreasConPendientes) + " · Pendientes acumulados: " + fmt(global.totalPendientes));
    ["coo-global-preview"].forEach(function(id){var b=el(id);if(b){b.disabled = !(global.totalEstudiantesPendientes > 0);}});
  }

  function renderAreaSummary(report){
    var rows = arr(report.areas).map(function(area){
      return Object.assign({}, area, {estado:area.totalEstudiantes > 0 ? "Con pendientes" : "Sin pendientes"});
    });
    setHTML("coordi-requisitos", table([
      {label:"Área", value:function(r){return '<strong>'+esc(r.area)+'</strong><br><span class="muted-text">'+esc(r.responsable)+'</span>'; }},
      {label:"Estudiantes", value:function(r){return '<span class="number-strong">'+fmt(r.totalEstudiantes)+'</span>'; }},
      {label:"Pendientes", value:function(r){return '<span class="number-strong">'+fmt(r.totalPendientes)+'</span>'; }},
      {label:"Carreras", value:function(r){return fmt(arr(r.carreras).length);}},
      {label:"Estado", value:function(r){return r.totalEstudiantes > 0 ? '<span class="pill pill-media">Con pendientes</span>' : '<span class="pill pill-baja">Sin pendientes</span>';}}
    ], rows));
  }

  function renderReadyReports(report){
    var container = document.querySelector(".report-ready-list");
    if(!container){return;}
    var rows = arr(report.reportesListos);
    if(!rows.length){
      container.innerHTML = '<div class="report-ready-item muted"><strong>Sin reportes pendientes</strong><span>No hay acciones necesarias para el filtro actual.</span></div>';
      return;
    }
    container.innerHTML = table([
      {label:"Destinatario", value:function(r){return '<strong>'+esc(r.destinatario)+'</strong><br><span class="muted-text">'+esc(r.correo)+'</span>'; }},
      {label:"Tipo", value:function(r){return esc(r.tipo);}},
      {label:"Área", value:function(r){return esc(r.area || "Global");}},
      {label:"Estudiantes", value:function(r){return fmt(r.totalEstudiantes);}},
      {label:"Estado", value:function(r){return '<span class="pill pill-baja">'+esc(r.estado || "Listo")+'</span>';}}
    ], rows);
  }

  function areaCard(area, selectedAreaId){
    var selected = area.id === selectedAreaId ? " selected" : "";
    var empty = area.totalEstudiantes <= 0 ? " empty-area" : "";
    return '<article class="area-card'+selected+empty+'">'
      + '<div class="area-card-head"><div><h3>'+esc(area.area)+'</h3><p>'+esc(area.responsable)+'</p></div>'
      + (area.totalEstudiantes > 0 ? '<span class="pill pill-media">Pendiente</span>' : '<span class="pill pill-baja">Ok</span>') + '</div>'
      + '<div class="area-contact"><span>'+esc(area.correo)+'</span><span>'+esc(area.whatsapp)+'</span></div>'
      + '<div class="area-stats"><div><strong>'+fmt(area.totalEstudiantes)+'</strong><span>Estudiantes</span></div><div><strong>'+fmt(area.totalPendientes)+'</strong><span>Pendientes</span></div><div><strong>'+fmt(arr(area.carreras).length)+'</strong><span>Carreras</span></div></div>'
      + '<div class="area-card-actions">'
      + '<button type="button" class="btn-secondary" data-action="preview-area" data-area-id="'+esc(area.id)+'" '+(area.totalEstudiantes>0?'':'disabled')+'>Vista previa</button>'
      + '<button type="button" class="btn-secondary" data-action="show-detail" data-area-id="'+esc(area.id)+'" '+(area.totalEstudiantes>0?'':'disabled')+'>Ver detalle</button>'
      + '<button type="button" class="btn-secondary" disabled>Outlook</button>'
      + '<button type="button" class="btn-secondary" disabled>WhatsApp</button>'
      + '</div>'
      + '</article>';
  }

  function renderAreaCards(report,state){
    var areaId = state.selectedAreaId || firstPendingArea(report);
    setHTML("coordi-carreras", arr(report.areas).map(function(area){return areaCard(area, areaId);}).join(""));
    setText("coordi-carreras-meta", fmt(arr(report.areas).length) + " responsables");
  }

  function renderDetail(report,state){
    var areaId = state.selectedAreaId || firstPendingArea(report);
    var area = areaById(report, areaId);
    if(!area){
      setHTML("coordi-estudiantes", '<div class="empty">Selecciona un área con pendientes para ver el detalle.</div>');
      setText("coordi-estudiantes-meta", "0 estudiantes");
      return;
    }
    var rows = arr(area.estudiantes);
    setText("coordi-estudiantes-meta", fmt(rows.length) + " estudiantes · " + area.area);
    setHTML("coordi-estudiantes", table([
      {label:"Cédula", value:function(r){return '<span class="nowrap">'+esc(r.cedula)+'</span>'; }},
      {label:"Nombre", value:function(r){return '<strong>'+esc(r.nombre || "Sin nombre")+'</strong>'; }},
      {label:"Carrera", value:function(r){return esc(r.carrera);}},
      {label:"Requisito pendiente", value:function(r){return esc(r.requisitosTexto || arr(r.requisitos).join(", "));}}
    ], rows));
  }

  function summaryText(report){
    var global = report.global || {};
    var lines = [];
    lines.push("Resumen Coordi");
    lines.push("Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados));
    lines.push("Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes));
    lines.push("Áreas con pendientes: " + fmt(global.totalAreasConPendientes));
    lines.push("Pendientes acumulados: " + fmt(global.totalPendientes));
    lines.push("");
    arr(report.areasConPendientes).forEach(function(area){
      lines.push(area.area + ": " + fmt(area.totalEstudiantes) + " estudiantes · " + fmt(area.totalPendientes) + " pendientes · Responsable: " + area.responsable);
    });
    return lines.join("\n");
  }

  function renderMessage(report,state){
    var msg = summaryText(report);
    var target = el("coordi-message");
    if(target){target.value = msg;}
  }

  function renderDiagnostics(report){
    var node = el("coordi-diagnostics");
    if(node){node.textContent = JSON.stringify(report.diagnostics || {}, null, 2);}
  }

  function previewGlobal(report){
    var global = report.global || {};
    var rows = arr(global.areas);
    return '<div class="preview-mail"><p><strong>Para:</strong> '+esc(global.correo)+'</p>'
      + '<p><strong>Asunto:</strong> Reporte global de pendientes por área</p>'
      + '<p>Buen día, '+esc(global.saludo || global.responsable)+'.</p>'
      + '<p>Se remite resumen general de pendientes por área.</p>'
      + table([
        {label:"Área", value:function(r){return esc(r.area);}},
        {label:"Responsable", value:function(r){return esc(r.responsable);}},
        {label:"Estudiantes", value:function(r){return fmt(r.totalEstudiantes);}},
        {label:"Pendientes", value:function(r){return fmt(r.totalPendientes);}}
      ], rows)
      + '</div>';
  }

  function previewArea(report, areaId){
    var area = areaById(report, areaId);
    if(!area){return '<div class="empty">No se encontró el área seleccionada.</div>';}
    return '<div class="preview-mail"><p><strong>Para:</strong> '+esc(area.correo)+'</p>'
      + '<p><strong>Asunto:</strong> Detalle de pendientes · '+esc(area.area)+'</p>'
      + '<p>Buen día, '+esc(area.saludo || area.responsable)+'.</p>'
      + '<p>Se remite el detalle de estudiantes con pendientes correspondientes al área '+esc(area.area)+'.</p>'
      + table([
        {label:"Cédula", value:function(r){return esc(r.cedula);}},
        {label:"Nombre", value:function(r){return esc(r.nombre);}},
        {label:"Carrera", value:function(r){return esc(r.carrera);}},
        {label:"Requisito pendiente", value:function(r){return esc(r.requisitosTexto);}}
      ], area.estudiantes)
      + '</div>';
  }

  function openPreview(title, html){
    var modal = el("coordi-preview-modal");
    setText("coordi-preview-title", title || "Vista previa");
    setHTML("coordi-preview-body", html || "");
    if(modal){modal.hidden = false;}
  }

  function closePreview(){var modal = el("coordi-preview-modal");if(modal){modal.hidden = true;}}

  function renderAll(report,state){
    state = state || {};
    fillFilters(report,state);
    renderKpis(report);
    renderGlobal(report);
    renderAreaSummary(report);
    renderReadyReports(report);
    renderAreaCards(report,state);
    renderDetail(report,state);
    renderMessage(report,state);
    renderDiagnostics(report);
  }

  window.COORender = {
    version:VERSION,
    renderAll:renderAll,
    renderDetail:renderDetail,
    summaryText:summaryText,
    previewGlobal:previewGlobal,
    previewArea:previewArea,
    openPreview:openPreview,
    closePreview:closePreview,
    firstPendingArea:firstPendingArea,
    areaById:areaById,
    helpers:{esc:esc,fmt:fmt,table:table}
  };
})(window,document);
