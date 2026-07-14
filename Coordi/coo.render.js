/* =========================================================
Nombre completo: coo.render.js
Ruta o ubicación: /Requisitos/Coordi/coo.render.js
Función o funciones:
- Pintar la visión global y los reportes por responsable.
- Mostrar filtros funcionales de período, división, carrera y requisito.
- Mostrar estudiantes aunque no exista un área seleccionada.
- Habilitar el reporte global cuando existan estudiantes revisados.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION = "2.0.0-coo-render-filters";

  function el(id){ return document.getElementById(id); }
  function text(value){ return String(value == null ? "" : value).trim(); }
  function arr(value){ return Array.isArray(value) ? value : []; }
  function esc(value){ return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
  function fmt(value){ value = Number(value || 0); return value.toLocaleString("es-EC"); }
  function option(value,label,selected){ return '<option value="'+esc(value)+'" '+(selected?'selected':'')+'>'+esc(label || value)+'</option>'; }
  function setText(id,value){ var node=el(id); if(node){ node.textContent=text(value); } }
  function setHTML(id,value){ var node=el(id); if(node){ node.innerHTML=value; } }

  function table(headers,rows){
    rows = arr(rows);
    if(!rows.length){ return '<div class="empty">Sin datos para mostrar.</div>'; }
    var html = '<table><thead><tr>' + headers.map(function(header){ return '<th>'+esc(header.label)+'</th>'; }).join('') + '</tr></thead><tbody>';
    html += rows.map(function(row){
      return '<tr>' + headers.map(function(header){
        var value = typeof header.value === "function" ? header.value(row) : row[header.key];
        return '<td>'+value+'</td>';
      }).join('') + '</tr>';
    }).join('');
    return html + '</tbody></table>';
  }

  function areaById(report,areaId){
    var found = null;
    arr(report && report.areas).some(function(area){
      if(area.id === areaId){ found = area; return true; }
      return false;
    });
    return found;
  }

  function firstPendingArea(report){
    var areas = arr(report && report.areasConPendientes);
    return areas.length ? areas[0].id : "";
  }

  function totalCareers(report){
    var map = Object.create(null);
    arr(report && report.areasConPendientes).forEach(function(area){
      arr(area.carreras).forEach(function(career){ map[career] = true; });
    });
    return Object.keys(map).length;
  }

  function fillSelect(id,emptyLabel,list,current,valueFn,labelFn){
    var node = el(id);
    if(!node){ return; }
    node.innerHTML = option("",emptyLabel,!current) + arr(list).map(function(item){
      var value = valueFn ? valueFn(item) : item;
      var label = labelFn ? labelFn(item) : item;
      return option(value,label,text(current) === text(value));
    }).join("");
    node.value = current || "";
  }

  function fillFilters(report,state){
    fillSelect("coordi-periodo","Seleccione período",report.periodList,state.periodId,function(period){
      return period.id || period.value || period.label;
    },function(period){
      return period.label || period.periodoLabel || period.id;
    });
    fillSelect("coordi-division","Todas",report.divisionList,state.division);
    fillSelect("coordi-carrera","Todas",report.careerList,state.career);
    fillSelect("coordi-requisito","Todos los requisitos",report.requirementList,state.requirementKey,function(item){
      return item.key || item.value || item.label;
    },function(item){
      return item.label || item.key;
    });
  }

  function renderKpis(report){
    var global = report.global || {};
    setText("coordi-total",fmt(global.totalEstudiantesRevisados));
    setText("coordi-alta",fmt(global.totalEstudiantesPendientes));
    setText("coordi-media",fmt(global.totalAreasConPendientes));
    setText("coordi-baja",fmt(global.totalPendientes));
    setText("coordi-carreras-total",fmt(totalCareers(report)));
  }

  function renderGlobal(report){
    var global = report.global || {};
    var hasStudents = Number(global.totalEstudiantesRevisados || 0) > 0;
    setText("coordi-global-name",global.responsable || "Dr. Alex León");
    setText("coordi-global-email",global.correo || "aleon@itsqmet.edu.ec");
    setText("coordi-global-phone",global.whatsapp || "593984059654");
    setText("coordi-global-desc",
      "Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados) +
      " · Al día: " + fmt(global.totalEstudiantesAlDia) +
      " · Con pendientes: " + fmt(global.totalEstudiantesPendientes) +
      " · Áreas con pendientes: " + fmt(global.totalAreasConPendientes)
    );
    ["coo-global-preview","coo-global-mail","coo-global-whatsapp"].forEach(function(id){
      var button = el(id);
      if(button){ button.disabled = !hasStudents; }
    });
  }

  function renderAreaSummary(report){
    var rows = arr(report.areas).map(function(area){
      return Object.assign({},area,{estado:area.totalEstudiantes > 0 ? "Con pendientes" : "Sin pendientes"});
    });
    setHTML("coordi-requisitos",table([
      {label:"Área",value:function(row){ return '<strong>'+esc(row.area)+'</strong><br><span class="muted-text">'+esc(row.responsable)+'</span>'; }},
      {label:"Estudiantes",value:function(row){ return '<span class="number-strong">'+fmt(row.totalEstudiantes)+'</span>'; }},
      {label:"Pendientes",value:function(row){ return '<span class="number-strong">'+fmt(row.totalPendientes)+'</span>'; }},
      {label:"Carreras",value:function(row){ return fmt(arr(row.carreras).length); }},
      {label:"Estado",value:function(row){ return row.totalEstudiantes > 0 ? '<span class="pill pill-media">Con pendientes</span>' : '<span class="pill pill-baja">Sin pendientes</span>'; }}
    ],rows));
  }

  function renderReadyReports(report){
    var container = document.querySelector(".report-ready-list");
    if(!container){ return; }
    var rows = arr(report.reportesListos);
    if(!rows.length){
      container.innerHTML = '<div class="report-ready-item muted"><strong>Seleccione un período</strong><span>Al seleccionar el período se habilitará el reporte global.</span></div>';
      return;
    }
    container.innerHTML = table([
      {label:"Destinatario",value:function(row){ return '<strong>'+esc(row.destinatario)+'</strong><br><span class="muted-text">'+esc(row.correo)+'</span>'; }},
      {label:"Tipo",value:function(row){ return esc(row.tipo); }},
      {label:"Área",value:function(row){ return esc(row.area || "Global"); }},
      {label:"Estudiantes",value:function(row){ return fmt(row.totalEstudiantes); }},
      {label:"Estado",value:function(row){ return '<span class="pill pill-baja">'+esc(row.estado || "Listo")+'</span>'; }}
    ],rows);
  }

  function areaCard(area,selectedAreaId){
    var selected = area.id === selectedAreaId ? " selected" : "";
    return '<article class="area-card'+selected+'">'
      + '<div class="area-card-head"><div><h3>'+esc(area.area)+'</h3><p>'+esc(area.responsable)+'</p></div><span class="pill pill-media">Pendiente</span></div>'
      + '<div class="area-contact"><span>'+esc(area.correo)+'</span><span>'+esc(area.whatsapp)+'</span></div>'
      + '<div class="area-stats"><div><strong>'+fmt(area.totalEstudiantes)+'</strong><span>Estudiantes</span></div><div><strong>'+fmt(area.totalPendientes)+'</strong><span>Pendientes</span></div><div><strong>'+fmt(arr(area.carreras).length)+'</strong><span>Carreras</span></div></div>'
      + '<div class="area-card-actions">'
      + '<button type="button" class="btn-secondary" data-action="preview-area-detail" data-area-id="'+esc(area.id)+'">Vista previa</button>'
      + '<button type="button" class="btn-secondary" data-action="show-detail" data-area-id="'+esc(area.id)+'">Ver detalle</button>'
      + '<button type="button" class="btn-secondary" data-action="mail-area-summary" data-area-id="'+esc(area.id)+'">Correo resumen</button>'
      + '<button type="button" class="btn-primary" data-action="mail-area-detail" data-area-id="'+esc(area.id)+'">Correo detallado</button>'
      + '<button type="button" class="btn-secondary" data-action="whatsapp-area" data-area-id="'+esc(area.id)+'">WhatsApp</button>'
      + '</div></article>';
  }

  function renderAreaCards(report,state){
    var rows = arr(report.areasConPendientes);
    var areaId = state.selectedAreaId || firstPendingArea(report);
    if(!rows.length){
      setHTML("coordi-carreras",'<div class="empty">No existen áreas con pendientes para el filtro actual.</div>');
    }else{
      setHTML("coordi-carreras",rows.map(function(area){ return areaCard(area,areaId); }).join(""));
    }
    setText("coordi-carreras-meta",fmt(rows.length) + " responsables con pendientes");
  }

  function renderDetail(report,state){
    var areaId = state.selectedAreaId || firstPendingArea(report);
    var area = areaById(report,areaId);
    var rows;

    if(area){
      rows = arr(area.estudiantes);
      setText("coordi-estudiantes-meta",fmt(rows.length) + " estudiantes · " + area.area);
    }else{
      rows = arr(report.students);
      setText("coordi-estudiantes-meta",fmt(rows.length) + " estudiantes del corte");
    }

    setHTML("coordi-estudiantes",table([
      {label:"Cédula",value:function(row){ return '<span class="nowrap">'+esc(row.cedula)+'</span>'; }},
      {label:"Nombre",value:function(row){ return '<strong>'+esc(row.nombre || "Sin nombre")+'</strong>'; }},
      {label:"Carrera",value:function(row){ return esc(row.carrera); }},
      {label:"Estado / requisito",value:function(row){
        return row.totalPendientes > 0
          ? '<span class="pill pill-media">'+esc(row.requisitosTexto || arr(row.requisitos).join(", "))+'</span>'
          : '<span class="pill pill-baja">Al día</span>';
      }}
    ],rows));
  }

  function summaryText(report){
    var global = report.global || {};
    var lines = [
      "Resumen Coordi",
      "Estudiantes revisados: " + fmt(global.totalEstudiantesRevisados),
      "Estudiantes al día: " + fmt(global.totalEstudiantesAlDia),
      "Estudiantes con pendientes: " + fmt(global.totalEstudiantesPendientes),
      "Áreas con pendientes: " + fmt(global.totalAreasConPendientes),
      "Pendientes acumulados: " + fmt(global.totalPendientes),
      ""
    ];
    arr(report.areasConPendientes).forEach(function(area){
      lines.push(area.area + ": " + fmt(area.totalEstudiantes) + " estudiantes · " + fmt(area.totalPendientes) + " pendientes · Responsable: " + area.responsable);
    });
    return lines.join("\n");
  }

  function renderMessage(report,state){
    var target = el("coordi-message");
    if(!target){ return; }
    if(state.messageType === "carrera" && report.filters && report.filters.career){
      target.value = "Resumen de la carrera " + report.filters.career + "\n\n" + summaryText(report);
    }else if(state.messageType === "pendientes"){
      target.value = arr(report.areasConPendientes).map(function(area){
        return area.area + ": " + fmt(area.totalEstudiantes) + " estudiantes y " + fmt(area.totalPendientes) + " pendientes.";
      }).join("\n") || "No existen pendientes para el filtro actual.";
    }else{
      target.value = summaryText(report);
    }
  }

  function renderDiagnostics(report){
    var node = el("coordi-diagnostics");
    if(node){ node.textContent = JSON.stringify(report.diagnostics || {},null,2); }
  }

  function openPreview(title,html){
    var modal = el("coordi-preview-modal");
    setText("coordi-preview-title",title || "Vista previa");
    setHTML("coordi-preview-body",html || "");
    if(modal){ modal.hidden = false; }
  }

  function closePreview(){
    var modal = el("coordi-preview-modal");
    if(modal){ modal.hidden = true; }
  }

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
    renderMessage:renderMessage,
    summaryText:summaryText,
    openPreview:openPreview,
    closePreview:closePreview,
    firstPendingArea:firstPendingArea,
    areaById:areaById,
    helpers:{esc:esc,fmt:fmt,table:table}
  };
})(window,document);
