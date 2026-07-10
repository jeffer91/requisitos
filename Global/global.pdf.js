/* =========================================================
Nombre completo: global.pdf.js
Ruta o ubicación: /Requisitos/Global/global.pdf.js
Función:
- Generar reporte institucional imprimible/PDF desde la sección actual de Global.
- Crear portada completa, encabezado repetido, filtros aplicados, resumen ejecutivo y tablas.
- Usar identidad azul marino, dorado y blanco.
- Funcionar aunque todavía no exista logo-instituto.png.
- Resolver rutas absolutas para que el logo cargue correctamente en la ventana de impresión.
Con qué se conecta:
- global.config.js
- global.core.js
- global.app.js
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.1-revision";
  var config = window.GlobalConfig || {};

  function text(value){ return String(value == null ? "" : value).trim(); }

  function esc(value){
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function absoluteUrl(path){
    try{ return new URL(path, window.location.href).href; }
    catch(error){ return path; }
  }

  function now(){
    try{ return new Date().toLocaleString("es-EC", { year:"numeric", month:"long", day:"2-digit", hour:"2-digit", minute:"2-digit" }); }
    catch(error){ return new Date().toISOString(); }
  }

  function sections(){ return Array.isArray(config.secciones) ? config.secciones : []; }

  function sectionById(id){
    var found = null;
    sections().some(function(section){
      if(section.id === id){ found = section; return true; }
      return false;
    });
    return found || sections()[0] || { id:"resumen", label:"Resumen", titulo:"Resumen general", pdfTitulo:"Reporte global" };
  }

  function selectedText(selector, fallback){
    var el = document.querySelector(selector);
    if(!el){ return fallback || "Todos"; }
    if(el.tagName === "SELECT"){
      var option = el.options[el.selectedIndex];
      return text(option ? option.textContent : el.value) || fallback || "Todos";
    }
    return text(el.value) || fallback || "Todos";
  }

  function filterRows(){
    return [
      { filtro:"Período desde", valor:selectedText("#globalFiltroDesde", "Todos") },
      { filtro:"Período hasta", valor:selectedText("#globalFiltroHasta", "Todos") },
      { filtro:"Carrera", valor:selectedText("#globalFiltroCarrera", "Todas las carreras") },
      { filtro:"Requisito", valor:selectedText("#globalFiltroRequisito", "Todos los requisitos") },
      { filtro:"Tipo de carrera", valor:selectedText("#globalFiltroTipo", "Todas") }
    ];
  }

  function pct(value){ return Number(value || 0); }

  function safeData(data){
    data = data && typeof data === "object" ? data : {};
    data.resumen = data.resumen || {};
    data.students = Array.isArray(data.students) ? data.students : [];
    data.requirements = Array.isArray(data.requirements) ? data.requirements : [];
    return data;
  }

  function studentRows(data){
    return (data.students || []).map(function(row){
      var c = row._globalCumplimiento || {};
      return {
        cedula:row._globalCedula,
        estudiante:row._globalNombres,
        carrera:row._globalCarrera,
        tipo:row._globalTipoCarrera,
        periodo:row._globalPeriodoLabel || row._globalPeriodoId,
        estado:row._globalEstadoMatricula,
        cumplimiento:pct(c.porcentaje) + "%"
      };
    });
  }

  function resumenRows(data){
    var r = data.resumen || {};
    return [
      { indicador:"Total de estudiantes", valor:r.totalEstudiantes || 0, detalle:"Registros incluidos en el análisis filtrado." },
      { indicador:"Total de carreras", valor:r.totalCarreras || 0, detalle:"Carreras únicas detectadas." },
      { indicador:"Total de períodos", valor:r.totalPeriodos || 0, detalle:"Períodos académicos incluidos." },
      { indicador:"Total de requisitos", valor:r.totalRequisitos || 0, detalle:"Requisitos considerados para el cálculo." },
      { indicador:"Cumplimiento general", valor:(r.porcentajeCumplimiento || 0) + "%", detalle:"Porcentaje general sobre requisitos detectados." },
      { indicador:"Estudiantes activos", valor:r.activos || 0, detalle:"Estudiantes con matrícula activa." },
      { indicador:"Estudiantes retirados", valor:r.retirados || 0, detalle:"Estudiantes marcados como retirados." }
    ];
  }

  function groupBy(list, getter){
    var map = Object.create(null);
    list.forEach(function(item){
      var key = text(getter(item)) || "SIN DATO";
      if(!map[key]){ map[key] = []; }
      map[key].push(item);
    });
    return map;
  }

  function avg(list, getter){
    if(!list.length){ return 0; }
    var sum = list.reduce(function(acc, item){ return acc + Number(getter(item) || 0); }, 0);
    return Math.round(sum / list.length);
  }

  function carreraRows(data){
    var grouped = groupBy(data.students || [], function(row){ return row._globalCarrera; });
    return Object.keys(grouped).map(function(carrera){
      var rows = grouped[carrera];
      return {
        carrera:carrera,
        tipo:rows[0] && rows[0]._globalTipoCarrera,
        estudiantes:rows.length,
        activos:rows.filter(function(row){ return row._globalEstadoMatricula !== "RETIRADO"; }).length,
        retirados:rows.filter(function(row){ return row._globalEstadoMatricula === "RETIRADO"; }).length,
        cumplimiento:avg(rows, function(row){ return row._globalCumplimiento && row._globalCumplimiento.porcentaje; }) + "%"
      };
    }).sort(function(a, b){ return b.estudiantes - a.estudiantes; });
  }

  function periodoRows(data){
    var grouped = groupBy(data.students || [], function(row){ return row._globalPeriodoLabel || row._globalPeriodoId; });
    return Object.keys(grouped).map(function(periodo){
      var rows = grouped[periodo];
      var carreras = groupBy(rows, function(row){ return row._globalCarrera; });
      return {
        periodo:periodo,
        estudiantes:rows.length,
        carreras:Object.keys(carreras).length,
        cumplimiento:avg(rows, function(row){ return row._globalCumplimiento && row._globalCumplimiento.porcentaje; }) + "%"
      };
    }).sort(function(a, b){ return text(a.periodo).localeCompare(text(b.periodo), "es"); });
  }

  function tipoRows(data){
    var grouped = groupBy(data.students || [], function(row){ return row._globalTipoCarrera; });
    return Object.keys(grouped).map(function(tipo){
      var rows = grouped[tipo];
      var carreras = groupBy(rows, function(row){ return row._globalCarrera; });
      return {
        tipo:tipo,
        estudiantes:rows.length,
        carreras:Object.keys(carreras).length,
        cumplimiento:avg(rows, function(row){ return row._globalCumplimiento && row._globalCumplimiento.porcentaje; }) + "%"
      };
    });
  }

  function requirementValue(row, req){
    if(window.GlobalCore && window.GlobalCore.helpers && typeof window.GlobalCore.helpers.requirementValue === "function"){
      return window.GlobalCore.helpers.requirementValue(row, req);
    }
    return row ? row[req] : "";
  }

  function cellStatus(value){
    if(window.GlobalCore && window.GlobalCore.helpers && typeof window.GlobalCore.helpers.cellStatus === "function"){
      return window.GlobalCore.helpers.cellStatus(value);
    }
    value = text(value).toUpperCase();
    if(value === "CUMPLE"){ return "CUMPLE"; }
    if(value === "PENDIENTE" || !value){ return "PENDIENTE"; }
    return "NO CUMPLE";
  }

  function requisitoRows(data){
    return (data.requirements || []).map(function(req){
      var cumple = 0;
      var pendiente = 0;
      var noCumple = 0;
      (data.students || []).forEach(function(row){
        var status = cellStatus(requirementValue(row, req.id || req.key));
        if(status === "CUMPLE"){ cumple += 1; }
        else if(status === "PENDIENTE"){ pendiente += 1; }
        else{ noCumple += 1; }
      });
      var total = cumple + pendiente + noCumple;
      return {
        requisito:req.label || req.id,
        cumple:cumple,
        pendiente:pendiente,
        noCumple:noCumple,
        total:total,
        cumplimiento:total ? Math.round((cumple / total) * 100) + "%" : "0%"
      };
    }).sort(function(a, b){ return b.noCumple - a.noCumple; });
  }

  function comparativaRows(data){
    var map = Object.create(null);
    (data.students || []).forEach(function(row){
      var periodo = row._globalPeriodoLabel || row._globalPeriodoId || "SIN PERÍODO";
      var tipo = row._globalTipoCarrera || "SIN TIPO";
      var key = periodo + "__" + tipo;
      if(!map[key]){ map[key] = { periodo:periodo, tipo:tipo, estudiantes:0, carreras:Object.create(null) }; }
      map[key].estudiantes += 1;
      map[key].carreras[row._globalCarrera || "SIN CARRERA"] = true;
    });
    return Object.keys(map).map(function(key){
      var item = map[key];
      return { periodo:item.periodo, tipo:item.tipo, estudiantes:item.estudiantes, carreras:Object.keys(item.carreras).length };
    });
  }

  function alertaRows(data){
    return requisitoRows(data).map(function(row){
      return {
        alerta:"Requisito crítico",
        detalle:row.requisito,
        cantidad:row.noCumple + row.pendiente,
        prioridad:(row.noCumple + row.pendiente) > 0 ? "Revisar" : "Controlado"
      };
    }).filter(function(row){ return Number(row.cantidad || 0) > 0; });
  }

  function reportRows(data){
    return sections().map(function(section){
      return { seccion:section.label, reporte:section.pdfTitulo || section.titulo, registros:(data.students || []).length, alcance:"Sección filtrada" };
    });
  }

  function tableForSection(sectionId, data){
    data = safeData(data);
    if(sectionId === "estudiantes"){
      return { title:"Estudiantes filtrados", columns:["cedula", "estudiante", "carrera", "tipo", "periodo", "estado", "cumplimiento"], rows:studentRows(data) };
    }
    if(sectionId === "carreras"){
      return { title:"Carreras", columns:["carrera", "tipo", "estudiantes", "activos", "retirados", "cumplimiento"], rows:carreraRows(data) };
    }
    if(sectionId === "requisitos"){
      return { title:"Requisitos", columns:["requisito", "cumple", "pendiente", "noCumple", "total", "cumplimiento"], rows:requisitoRows(data) };
    }
    if(sectionId === "periodos"){
      return { title:"Períodos académicos", columns:["periodo", "estudiantes", "carreras", "cumplimiento"], rows:periodoRows(data) };
    }
    if(sectionId === "tipo-carrera"){
      return { title:"Universitaria vs Superior", columns:["tipo", "estudiantes", "carreras", "cumplimiento"], rows:tipoRows(data) };
    }
    if(sectionId === "comparativas"){
      return { title:"Período por tipo de carrera", columns:["periodo", "tipo", "estudiantes", "carreras"], rows:comparativaRows(data) };
    }
    if(sectionId === "alertas"){
      return { title:"Alertas detectadas", columns:["alerta", "detalle", "cantidad", "prioridad"], rows:alertaRows(data) };
    }
    if(sectionId === "reportes"){
      return { title:"Reportes disponibles", columns:["seccion", "reporte", "registros", "alcance"], rows:reportRows(data) };
    }
    return { title:"Indicadores generales", columns:["indicador", "valor", "detalle"], rows:resumenRows(data) };
  }

  function topItem(rows, field){
    rows = Array.isArray(rows) ? rows.slice() : [];
    rows.sort(function(a, b){ return Number(b[field] || 0) - Number(a[field] || 0); });
    return rows[0] || null;
  }

  function summaryText(section, data){
    data = safeData(data);
    var r = data.resumen || {};
    var carrera = topItem(carreraRows(data), "estudiantes");
    var req = topItem(requisitoRows(data), "noCumple");
    var parts = [];

    parts.push("El presente reporte corresponde a la sección " + (section.label || section.titulo || "Global") + " del módulo Global de la Unidad de Titulación y Eficiencia Terminal.");
    parts.push("Con los filtros aplicados se identifican " + (r.totalEstudiantes || 0) + " estudiantes, " + (r.totalCarreras || 0) + " carreras y " + (r.totalPeriodos || 0) + " períodos académicos incluidos en el análisis.");
    parts.push("El cumplimiento general calculado sobre los requisitos detectados es de " + (r.porcentajeCumplimiento || 0) + "%. Estos valores se generan a partir de la información registrada en la Base Local institucional.");
    if(carrera){ parts.push("La carrera con mayor cantidad de estudiantes dentro del filtro es " + carrera.carrera + ", con " + carrera.estudiantes + " registros."); }
    if(req && Number(req.noCumple || 0) > 0){ parts.push("El requisito con mayor número de incumplimientos es " + req.requisito + ", con " + req.noCumple + " registros en estado No cumple."); }
    return parts;
  }

  function observations(section, data){
    data = safeData(data);
    var r = data.resumen || {};
    var obs = [];
    obs.push("El reporte se genera únicamente con la sección seleccionada y los filtros superiores activos al momento de la emisión.");
    obs.push("Los estudiantes retirados se mantienen en el análisis histórico para conservar trazabilidad institucional.");
    if(Number(r.porcentajeCumplimiento || 0) < 70){
      obs.push("Se recomienda revisar los requisitos pendientes o incumplidos, debido a que el cumplimiento general se encuentra por debajo del 70%.");
    }else{
      obs.push("El cumplimiento general se encuentra en un rango aceptable para seguimiento institucional, sin perjuicio de revisar requisitos críticos puntuales.");
    }
    obs.push("Este documento es un reporte generado desde la Base Local y debe contrastarse con las fuentes oficiales cuando se requiera certificación final.");
    return obs;
  }

  function label(key){
    var map = {
      cedula:"Cédula", estudiante:"Estudiante", carrera:"Carrera", tipo:"Tipo", periodo:"Período", estado:"Estado", cumplimiento:"Cumplimiento",
      estudiantes:"Estudiantes", activos:"Activos", retirados:"Retirados", requisito:"Requisito", cumple:"Cumple", pendiente:"Pendiente", noCumple:"No cumple",
      total:"Total", carreras:"Carreras", indicador:"Indicador", valor:"Valor", detalle:"Detalle", alerta:"Alerta", cantidad:"Cantidad", prioridad:"Prioridad", seccion:"Sección", reporte:"Reporte", registros:"Registros", alcance:"Alcance"
    };
    return map[key] || key;
  }

  function renderTable(table, limit){
    table = table || { columns:[], rows:[] };
    var rows = (table.rows || []).slice(0, limit || 250);
    var columns = table.columns || [];
    return ''
      + '<h2>' + esc(table.title || 'Tabla') + '</h2>'
      + '<table class="report-table">'
        + '<thead><tr>' + columns.map(function(col){ return '<th>' + esc(label(col)) + '</th>'; }).join('') + '</tr></thead>'
        + '<tbody>'
          + (rows.length ? rows.map(function(row){
            return '<tr>' + columns.map(function(col){ return '<td>' + esc(row[col]) + '</td>'; }).join('') + '</tr>';
          }).join('') : '<tr><td colspan="' + columns.length + '">No hay registros para los filtros aplicados.</td></tr>')
        + '</tbody>'
      + '</table>'
      + ((table.rows || []).length > rows.length ? '<p class="small-note">Se muestran los primeros ' + rows.length + ' registros de ' + table.rows.length + ' disponibles.</p>' : '');
  }

  function list(items){
    return '<ul>' + (items || []).map(function(item){ return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>';
  }

  function institutionalCss(){
    var b = config.branding || {};
    var navy = b.azulMarino || "#071A33";
    var navy2 = b.azulMarino2 || "#0B2447";
    var gold = b.dorado || "#C9A227";
    return '<style>'
      + '@page{size:A4;margin:22mm 14mm 18mm 14mm;}'
      + '*{box-sizing:border-box;} body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#1F2937;background:#fff;}'
      + '.cover{min-height:100vh;background:' + navy + ';color:#fff;padding:45mm 22mm 28mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}'
      + '.cover-top{display:flex;align-items:center;gap:18px;} .logo-box{width:105px;height:105px;border:1px solid rgba(228,199,102,.6);border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);overflow:hidden;text-align:center;font-size:12px;color:rgba(255,255,255,.8);} .logo-box img{max-width:86%;max-height:86%;object-fit:contain;}'
      + '.eyebrow{color:' + gold + ';text-transform:uppercase;letter-spacing:.08em;font-weight:800;font-size:12px;margin:0 0 8px;} h1{font-size:31px;line-height:1.18;margin:0;} .cover h2{font-size:20px;font-weight:400;color:rgba(255,255,255,.86);margin:12px 0 0;} .cover-meta{border-top:2px solid ' + gold + ';padding-top:18px;font-size:14px;line-height:1.7;color:rgba(255,255,255,.86);}'
      + '.print-header{position:fixed;top:0;left:0;right:0;height:16mm;background:' + navy + ';color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14mm;border-bottom:2px solid ' + gold + ';font-size:10px;z-index:10;} .print-header strong{color:' + gold + ';}'
      + '.page{page-break-after:always;} .content{padding-top:5mm;} h2{color:' + navy2 + ';font-size:18px;margin:0 0 10px;border-bottom:2px solid ' + gold + ';padding-bottom:6px;} h3{color:' + navy2 + ';font-size:15px;margin:16px 0 8px;} p{font-size:12px;line-height:1.5;margin:0 0 8px;} ul{margin:0 0 12px 18px;padding:0;} li{font-size:12px;line-height:1.45;margin-bottom:5px;}'
      + '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 16px;} .info-card{border:1px solid #D8DEE9;border-left:4px solid ' + gold + ';padding:9px;border-radius:8px;background:#F8FAFC;} .info-card b{display:block;color:' + navy2 + ';font-size:11px;text-transform:uppercase;margin-bottom:3px;} .info-card span{font-size:12px;}'
      + 'table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:10px;page-break-inside:auto;} th{background:' + navy2 + ';color:#fff;text-align:left;padding:7px;border:1px solid ' + navy2 + ';} td{padding:6px;border:1px solid #D8DEE9;vertical-align:top;} tr{page-break-inside:avoid;page-break-after:auto;} tbody tr:nth-child(even){background:#F8FAFC;} .small-note{font-size:10px;color:#667085;} .footer-note{margin-top:18px;padding:10px;border-top:1px solid #D8DEE9;color:#667085;font-size:10px;}'
      + '@media print{.no-print{display:none;} body{print-color-adjust:exact;-webkit-print-color-adjust:exact;} .page{page-break-after:always;}}'
      + '</style>';
  }

  function generate(options){
    options = options || {};
    var sectionId = options.section || "resumen";
    var section = sectionById(sectionId);
    var data = safeData(options.data || (window.GlobalApp && window.GlobalApp.getLastData && window.GlobalApp.getLastData()));
    var table = tableForSection(sectionId, data);
    var logoPath = absoluteUrl((config.branding && config.branding.logoPath) || "assets/branding/logo-instituto.png");
    var title = section.pdfTitulo || section.titulo || "Reporte Global";
    var baseHref = absoluteUrl("./");

    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><base href="' + esc(baseHref) + '"><title>' + esc(title) + '</title>' + institutionalCss() + '</head><body>'
      + '<section class="cover">'
        + '<div class="cover-top"><div class="logo-box"><img src="' + esc(logoPath) + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'Logo institucional\';"></div><div><p class="eyebrow">' + esc(config.app && config.app.unidad || "Unidad de Titulación y Eficiencia Terminal") + '</p><h1>' + esc(title) + '</h1><h2>' + esc(config.app && config.app.subtitulo || "Análisis histórico y comparativo") + '</h2></div></div>'
        + '<div class="cover-meta"><div><strong>Sección:</strong> ' + esc(section.label || section.titulo) + '</div><div><strong>Fecha de generación:</strong> ' + esc(now()) + '</div><div><strong>Fuente:</strong> Base Local institucional del sistema de requisitos</div></div>'
      + '</section>'
      + '<div class="print-header"><span><strong>Unidad de Titulación y Eficiencia Terminal</strong> · Reporte Global</span><span>' + esc(section.label || "Global") + '</span></div>'
      + '<main class="content">'
        + '<section class="page"><h2>Filtros aplicados</h2><div class="info-grid">' + filterRows().map(function(row){ return '<div class="info-card"><b>' + esc(row.filtro) + '</b><span>' + esc(row.valor) + '</span></div>'; }).join('') + '</div><h2>Resumen ejecutivo</h2>' + list(summaryText(section, data)) + '<h2>Observaciones automáticas</h2>' + list(observations(section, data)) + '</section>'
        + '<section class="page">' + renderTable(table, 350) + '<p class="footer-note">El presente reporte ha sido generado automáticamente con base en la información registrada en la Base Local institucional y los filtros seleccionados por el usuario.</p></section>'
      + '</main>'
      + '<script>window.onload=function(){setTimeout(function(){window.print();},750);};<\/script>'
      + '</body></html>';

    var win = window.open("", "_blank");
    if(!win){
      alert("No se pudo abrir la ventana de impresión. Habilita ventanas emergentes para generar el PDF.");
      return false;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }

  window.GlobalPDF = {
    version:VERSION,
    generate:generate,
    tableForSection:tableForSection,
    summaryText:summaryText,
    observations:observations
  };
})(window, document);
