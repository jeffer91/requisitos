/* =========================================================
Nombre completo: global.pdf.runtime.js
Ruta o ubicación: /Global/global.pdf.runtime.js
Función:
- Proveer directamente la API institucional de GlobalPDF sin descompresión ni eval.
- Generar el reporte PDF mediante la impresión segura del navegador.
- Compartir con GlobalWord el modelo de filtros, resúmenes, tablas y firmas.
- Evitar que PDF y Word dependan del cargador comprimido que fallaba en Electron.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-direct-runtime";
  var config=window.GlobalConfig||{};

  function text(value){return String(value==null?"":value).trim();}
  function number(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function absoluteUrl(value){try{return new URL(value,window.location.href).href;}catch(error){return text(value);}}
  function formatDate(){try{return new Intl.DateTimeFormat("es-EC",{dateStyle:"long",timeStyle:"short"}).format(new Date());}catch(error){return new Date().toLocaleString("es-EC");}}
  function sections(){return Array.isArray(config.secciones)?config.secciones:[];}
  function sectionById(id){
    var found=sections().filter(function(item){return item.id===id;})[0];
    return found||{id:id||"resumen",label:"Global",titulo:"Reporte Global",pdfTitulo:"Reporte Global"};
  }
  function appRows(name,data){
    try{
      var rows=window.GlobalApp&&window.GlobalApp.rows;
      return rows&&typeof rows[name]==="function"?(rows[name](data)||[]):[];
    }catch(error){return [];}
  }
  function rowSource(sectionId,data){
    var map={
      resumen:"resumen",estudiantes:"students",carreras:"carreras",requisitos:"requisitos",
      periodos:"periodos","tipo-carrera":"tipos",comparativas:"comparativas",
      graduados:"graduados",alertas:"alertas",reportes:"resumen"
    };
    var rows=appRows(map[sectionId]||"resumen",data);
    if(sectionId==="graduados"&&!rows.length){
      rows=Array.isArray(data&&data.graduados&&data.graduados.porPeriodo)?data.graduados.porPeriodo:[];
    }
    return Array.isArray(rows)?rows:[];
  }
  var LABELS={
    cedula:"Cédula",nombres:"Estudiante",estudiante:"Estudiante",carrera:"Carrera",tipo:"Tipo de carrera",
    periodo:"Período",division:"División",matricula:"Matrícula",estado:"Estado",cumplimiento:"Cumplimiento",
    indicador:"Indicador",valor:"Valor",detalle:"Detalle",estudiantes:"Estudiantes",activos:"Activos",
    retirados:"Retirados",requisito:"Requisito",cumple:"Cumple",pendiente:"Pendiente",noCumple:"No cumple",
    total:"Total",carreras:"Carreras",graduados:"Graduados",alerta:"Alerta",nivel:"Nivel",descripcion:"Descripción"
  };
  var PREFERRED=["cedula","nombres","estudiante","carrera","tipo","periodo","division","matricula","estado","indicador","valor","detalle","requisito","cumple","pendiente","noCumple","estudiantes","activos","retirados","carreras","graduados","total","cumplimiento","alerta","nivel","descripcion"];
  function label(value){
    var key=text(value);
    if(LABELS[key]){return LABELS[key];}
    return key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,function(char){return char.toUpperCase();});
  }
  function columnsFor(rows){
    var keys=[];
    (rows||[]).forEach(function(row){Object.keys(row||{}).forEach(function(key){if(keys.indexOf(key)<0&&key.charAt(0)!=="_"){keys.push(key);}});});
    keys.sort(function(a,b){
      var ia=PREFERRED.indexOf(a),ib=PREFERRED.indexOf(b);
      ia=ia<0?999:ia;ib=ib<0?999:ib;
      return ia===ib?a.localeCompare(b):ia-ib;
    });
    return keys.map(function(key){return {key:key,label:label(key)};});
  }
  function tableForSection(sectionId,data){
    var section=sectionById(sectionId);
    var rows=rowSource(section.id,data||{});
    return {title:section.titulo||section.label||"Detalle",columns:columnsFor(rows),rows:rows};
  }
  function selectedLabel(selector,fallback){
    var node=document.querySelector(selector);
    if(node&&node.options&&node.selectedIndex>=0){return text(node.options[node.selectedIndex].text)||text(fallback);}
    return text(fallback);
  }
  function filterRows(filters){
    filters=filters||{};
    var rows=[];
    if(filters.periodoDesde){rows.push({filtro:"Período desde",valor:selectedLabel("#globalFiltroDesde",filters.periodoDesde)});}
    if(filters.periodoHasta){rows.push({filtro:"Período hasta",valor:selectedLabel("#globalFiltroHasta",filters.periodoHasta)});}
    if(filters.carrera){rows.push({filtro:"Carrera",valor:selectedLabel("#globalFiltroCarrera",filters.carrera)});}
    if(filters.division){rows.push({filtro:"División",valor:selectedLabel("#globalFiltroDivision",filters.division)});}
    if(filters.requisito){rows.push({filtro:"Requisito",valor:selectedLabel("#globalFiltroRequisito",filters.requisito)});}
    if(filters.tipoCarrera){rows.push({filtro:"Tipo de carrera",valor:selectedLabel("#globalFiltroTipo",filters.tipoCarrera)});}
    if(!rows.length){rows.push({filtro:"Alcance",valor:"Todos los registros disponibles"});}
    return rows;
  }
  function summaryText(section,data){
    section=section||sectionById("resumen");data=data||{};
    var summary=data.resumen||{};
    var rows=[
      "La sección «"+text(section.titulo||section.label)+"» incluye "+number(summary.totalEstudiantes||data.students&&data.students.length)+" estudiante(s).",
      "Se identifican "+number(summary.totalCarreras||data.careers&&data.careers.length)+" carrera(s) y "+number(summary.totalPeriodos||data.periods&&data.periods.length)+" período(s) en el universo filtrado.",
      "El cumplimiento general registrado es "+number(summary.porcentajeCumplimiento)+"%."
    ];
    if(section.id==="graduados"){rows.push("El total de graduados identificado es "+number(summary.totalGraduados||data.graduados&&data.graduados.total)+".");}
    return rows;
  }
  function observations(section,data){
    var table=tableForSection(section&&section.id||"resumen",data||{});
    var rows=[];
    rows.push(table.rows.length?"El reporte contiene "+table.rows.length+" registro(s) de detalle.":"No se encontraron registros para los filtros seleccionados.");
    rows.push("La información corresponde a la Base Local y a los filtros visibles al momento de generar el informe.");
    return rows;
  }
  function tableExplanation(title){return "La tabla «"+text(title||"Detalle")+"» presenta los registros considerados en el análisis institucional.";}
  function getSignatures(){
    if(Array.isArray(config.firmas)&&config.firmas.length){return config.firmas.slice();}
    return [
      {responsabilidad:"ELABORADO POR:",nombre:"Mgtr. Jefferson Villarreal",cargo:"Coordinador de Titulación y Eficiencia Terminal"},
      {responsabilidad:"REVISADO POR:",nombre:"Mpde. Martha Tomalá",cargo:"Secretaria General"},
      {responsabilidad:"APROBADO POR:",nombre:"Dr. Alex León T.",cargo:"Vicerrector"}
    ];
  }
  function graduateRows(data){return rowSource("graduados",data||{});}
  function buildModel(options){
    options=options||{};
    var section=sectionById(options.section||"resumen");
    var data=options.data||{};
    var filters=options.filters||data.filters||{};
    var table=tableForSection(section.id,data);
    return {
      section:section,data:data,filters:filters,
      title:section.pdfTitulo||section.titulo||section.label||"Reporte Global",
      unit:config.app&&config.app.unidad||"Unidad de Titulación y Eficiencia Terminal",
      generatedAt:formatDate(),filterRows:filterRows(filters,data),summary:summaryText(section,data),
      observations:observations(section,data),table:table,tableExplanation:tableExplanation(table.title),
      signatures:getSignatures(),graduateRows:graduateRows(data),label:label
    };
  }
  function tableHtml(table){
    var columns=table.columns||[],rows=table.rows||[];
    if(!rows.length){return '<div class="empty">Sin registros para los filtros seleccionados.</div>';}
    return '<table><thead><tr>'+columns.map(function(column){return '<th>'+esc(column.label)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+columns.map(function(column){return '<td>'+esc(row&&row[column.key])+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
  }
  function reportHtml(model){
    var branding=config.branding||{};
    var logo=absoluteUrl(branding.logoPath||"assets/branding/logo-instituto.png");
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(model.title)+'</title><style>'+
      '@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:11px}'+
      '.cover{min-height:245mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}.logoBox{background:#071A33;padding:24px 42px;border-radius:12px}.logoBox img{max-width:250px;max-height:95px}.gold{width:120px;height:5px;background:#C9A227;margin:24px auto}.unit{font-size:15px;font-weight:700;text-transform:uppercase}.title{font-size:28px;color:#071A33;margin:18px 0}.date{color:#667085}.header{border-bottom:3px solid #C9A227;padding-bottom:10px;margin-bottom:18px}.header h1{font-size:20px;margin:0;color:#071A33}.header p{margin:5px 0 0;color:#667085}.section{margin:18px 0;page-break-inside:avoid}.section h2{font-size:15px;color:#071A33;border-left:5px solid #C9A227;padding-left:9px}.filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.filter{border:1px solid #d8dee9;padding:8px;border-radius:6px}.filter strong{display:block;color:#071A33}.summary li,.observations li{margin:7px 0;line-height:1.45}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#071A33;color:white;padding:7px;text-align:left}td{border:1px solid #d8dee9;padding:6px;vertical-align:top}tr:nth-child(even) td{background:#f6f8fb}.empty{padding:18px;border:1px dashed #98a2b3;text-align:center}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:55px;page-break-inside:avoid}.signature{text-align:center;padding-top:46px;border-top:1px solid #172033}.signature strong,.signature span{display:block}.signature small{display:block;margin-bottom:6px;font-weight:700}.footer{margin-top:25px;padding-top:8px;border-top:1px solid #d8dee9;color:#667085;font-size:9px;text-align:center}</style></head><body>'+
      '<section class="cover"><div class="logoBox"><img src="'+esc(logo)+'" alt="ITSQMET"></div><div class="gold"></div><div class="unit">'+esc(model.unit)+'</div><h1 class="title">'+esc(model.title)+'</h1><div class="date">Generado el '+esc(model.generatedAt)+'</div></section>'+
      '<header class="header"><h1>'+esc(model.title)+'</h1><p>'+esc(model.unit)+' · '+esc(model.generatedAt)+'</p></header>'+
      '<section class="section"><h2>Filtros aplicados</h2><div class="filters">'+model.filterRows.map(function(item){return '<div class="filter"><strong>'+esc(item.filtro)+'</strong>'+esc(item.valor)+'</div>';}).join("")+'</div></section>'+
      '<section class="section"><h2>Resumen ejecutivo</h2><ul class="summary">'+model.summary.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      '<section class="section"><h2>'+esc(model.table.title)+'</h2><p>'+esc(model.tableExplanation)+'</p>'+tableHtml(model.table)+'</section>'+
      '<section class="section"><h2>Observaciones</h2><ul class="observations">'+model.observations.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      '<section class="signatures">'+model.signatures.map(function(item){return '<div class="signature"><small>'+esc(item.responsabilidad||"")+'</small><strong>'+esc(item.nombre||"")+'</strong><span>'+esc(item.cargo||"")+'</span></div>';}).join("")+'</section>'+
      '<div class="footer">ITSQMET · Reporte institucional generado desde Global</div></body></html>';
  }
  function printHtml(html){
    var target=null,frame=null;
    try{target=window.open("","_blank","width=1100,height=850");}catch(error){}
    if(!target||!target.document){
      frame=document.createElement("iframe");frame.style.position="fixed";frame.style.width="1px";frame.style.height="1px";frame.style.opacity="0";frame.style.pointerEvents="none";document.body.appendChild(frame);target=frame.contentWindow;
    }
    if(!target||!target.document){throw new Error("No se pudo abrir la vista de impresión institucional.");}
    target.document.open();target.document.write(html);target.document.close();
    var execute=function(){try{target.focus();target.print();}finally{if(frame){window.setTimeout(function(){if(frame.parentNode){frame.parentNode.removeChild(frame);}},1500);}}};
    if(target.document.readyState==="complete"){window.setTimeout(execute,250);}else{target.addEventListener("load",function(){window.setTimeout(execute,250);},{once:true});}
    return true;
  }
  function generate(options){return printHtml(reportHtml(buildModel(options||{})));}

  var api={
    version:VERSION,generate:generate,buildModel:buildModel,tableForSection:tableForSection,
    summaryText:summaryText,observations:observations,filterRows:filterRows,
    tableExplanation:tableExplanation,label:label,graduateRows:graduateRows,getSignatures:getSignatures
  };
  window.GlobalPDF=api;
  window.__globalPdfReady=Promise.resolve(api);
  try{window.dispatchEvent(new CustomEvent("global:pdf-ready",{detail:{ok:true,version:VERSION,directRuntime:true}}));}catch(error){}
})(window,document);
