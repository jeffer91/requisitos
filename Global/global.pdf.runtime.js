/* =========================================================
Nombre completo: global.pdf.runtime.js
Ruta o ubicación: /Global/global.pdf.runtime.js
Función:
- Generar el PDF institucional de Global como archivo descargable.
- Descargar automáticamente el PDF mediante html2pdf.js.
- Incrustar el logo institucional para evitar imágenes rotas.
- Mostrar períodos académicos y fecha de graduación.
- Compartir con GlobalWord el mismo modelo institucional.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.1.1-visible-render-host";
  var config=window.GlobalConfig||{};
  var html2pdfLoading=null;
  var HTML2PDF_PATHS=[
    "../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js",
    "../node_modules/html2pdf.js/dist/html2pdf.bundle.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.12.1/html2pdf.bundle.min.js"
  ];

  function text(value){return String(value==null?"":value).trim();}
  function number(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function esc(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
  function absoluteUrl(value){try{return new URL(value,window.location.href).href;}catch(error){return text(value);}}
  function formatDate(){try{return new Intl.DateTimeFormat("es-EC",{dateStyle:"long",timeStyle:"short"}).format(new Date());}catch(error){return new Date().toLocaleString("es-EC");}}
  function todayISO(){var date=new Date();return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
  function slug(value){
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"Global";
  }
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
    periodo:"Período",graduacion:"Fecha de graduación",division:"División",matricula:"Matrícula",estado:"Estado",cumplimiento:"Cumplimiento",
    indicador:"Indicador",valor:"Valor",detalle:"Detalle",estudiantes:"Estudiantes",activos:"Activos",
    retirados:"Retirados",requisito:"Requisito",cumple:"Cumple",pendiente:"Pendiente",noCumple:"No cumple",
    total:"Total",carreras:"Carreras",graduados:"Graduados",cantidadGraduados:"Cantidad de graduados",
    alerta:"Alerta",nivel:"Nivel",descripcion:"Descripción"
  };
  var PREFERRED=["cedula","nombres","estudiante","carrera","tipo","periodo","graduacion","division","matricula","estado","indicador","valor","detalle","requisito","cumple","pendiente","noCumple","estudiantes","activos","retirados","carreras","graduados","cantidadGraduados","total","cumplimiento","alerta","nivel","descripcion"];

  function label(value){
    var key=text(value);
    if(LABELS[key]){return LABELS[key];}
    return key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,function(char){return char.toUpperCase();});
  }
  function columnsFor(rows){
    var keys=[];
    (rows||[]).forEach(function(row){
      Object.keys(row||{}).forEach(function(key){
        if(keys.indexOf(key)<0&&key.charAt(0)!=="_"){keys.push(key);}
      });
    });
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
    rows.push("La fecha de graduación se calcula dos meses después del mes de finalización del período académico.");
    rows.push("La información corresponde a la Base Local y a los filtros visibles al momento de generar el informe.");
    return rows;
  }
  function tableExplanation(title){return "La tabla «"+text(title||"Detalle")+"» presenta los registros considerados en el análisis institucional.";}
  function getSignatures(){
    if(Array.isArray(config.firmas)&&config.firmas.length){return config.firmas.slice(0,1);}
    return [
      {responsabilidad:"ELABORADO POR:",nombre:"Mgtr. Jefferson Villarreal",cargo:"Coordinador de Titulación y Eficiencia Terminal"}
    ];
  }
  function graduateRows(data){return rowSource("graduados",data||{});}
  function periodRows(data){
    var rows=appRows("periodos",data||{});
    if(rows.length){return rows;}
    var helpers=window.GlobalCore&&window.GlobalCore.helpers;
    return (Array.isArray(data&&data.periods)?data.periods:[]).map(function(item){
      var period=text(item&&(
        item.periodoLabel||item.label||item.nombre||item.periodoId||item.id
      ));
      return {
        periodo:period,
        graduacion:helpers&&typeof helpers.graduationLabelForPeriod==="function"
          ?helpers.graduationLabelForPeriod(period)
          :""
      };
    });
  }
  function buildModel(options){
    options=options||{};
    var section=sectionById(options.section||"resumen");
    var data=options.data||{};
    var filters=options.filters||data.filters||{};
    var table=tableForSection(section.id,data);
    var periods=periodRows(data);
    return {
      section:section,data:data,filters:filters,
      title:section.pdfTitulo||section.titulo||section.label||"Reporte Global",
      unit:config.app&&config.app.unidad||"Unidad de Titulación y Eficiencia Terminal",
      generatedAt:formatDate(),filterRows:filterRows(filters),summary:summaryText(section,data),
      observations:observations(section,data),table:table,tableExplanation:tableExplanation(table.title),
      periodTable:{title:"Períodos incluidos",columns:columnsFor(periods),rows:periods},
      signatures:getSignatures(),graduateRows:graduateRows(data),label:label
    };
  }
  function tableHtml(table){
    var columns=table.columns||[],rows=table.rows||[];
    if(!rows.length){return '<div class="empty">Sin registros para los filtros seleccionados.</div>';}
    return '<table><thead><tr>'+columns.map(function(column){return '<th>'+esc(column.label)+'</th>';}).join("")+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+columns.map(function(column){return '<td>'+esc(row&&row[column.key])+'</td>';}).join("")+'</tr>';}).join("")+'</tbody></table>';
  }
  function reportCss(){
    return '@page{size:A4;margin:10mm}*{box-sizing:border-box}.global-report-root{font-family:Arial,sans-serif;color:#172033;background:#fff;font-size:11px;width:100%}'+
      '.global-report-root .cover{min-height:265mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}'+
      '.global-report-root .logoBox{padding:0;margin-bottom:18px}.global-report-root .logoBox img{display:block;max-width:235px;max-height:92px;object-fit:contain}'+
      '.global-report-root .gold{width:120px;height:5px;background:#C9A227;margin:18px auto 24px}.global-report-root .unit{font-size:15px;font-weight:700;text-transform:uppercase}'+
      '.global-report-root .title{font-size:28px;color:#071A33;margin:18px 0}.global-report-root .date{color:#667085}'+
      '.global-report-root .header{border-bottom:3px solid #C9A227;padding-bottom:10px;margin-bottom:18px}.global-report-root .header h1{font-size:20px;margin:0;color:#071A33}.global-report-root .header p{margin:5px 0 0;color:#667085}'+
      '.global-report-root .section{margin:18px 0;page-break-inside:avoid}.global-report-root .section h2{font-size:15px;color:#071A33;border-left:5px solid #C9A227;padding-left:9px}'+
      '.global-report-root .filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.global-report-root .filter{border:1px solid #d8dee9;padding:8px;border-radius:6px}.global-report-root .filter strong{display:block;color:#071A33}'+
      '.global-report-root .summary li,.global-report-root .observations li{margin:7px 0;line-height:1.45}.global-report-root table{width:100%;border-collapse:collapse;font-size:9px}'+
      '.global-report-root th{background:#071A33;color:white;padding:7px;text-align:left}.global-report-root td{border:1px solid #d8dee9;padding:6px;vertical-align:top}.global-report-root tr:nth-child(even) td{background:#f6f8fb}'+
      '.global-report-root .empty{padding:18px;border:1px dashed #98a2b3;text-align:center}.global-report-root .signatures{max-width:340px;margin:58px auto 0;page-break-inside:avoid}'+
      '.global-report-root .signature{text-align:center;padding-top:46px;border-top:1px solid #172033}.global-report-root .signature strong,.global-report-root .signature span{display:block}.global-report-root .signature small{display:block;margin-bottom:6px;font-weight:700}'+
      '.global-report-root .footer{margin-top:25px;padding-top:8px;border-top:1px solid #d8dee9;color:#667085;font-size:9px;text-align:center}';
  }
  function reportBody(model,logo){
    var periodBlock="";
    if(model.section.id!=="periodos"&&model.periodTable&&model.periodTable.rows&&model.periodTable.rows.length){
      periodBlock='<section class="section"><h2>Períodos incluidos</h2><p>Períodos académicos considerados y fecha de graduación calculada.</p>'+tableHtml(model.periodTable)+'</section>';
    }
    return '<div class="global-report-root">'+
      '<section class="cover"><div class="logoBox"><img src="'+esc(logo)+'" alt="ITSQMET"></div><div class="gold"></div><div class="unit">'+esc(model.unit)+'</div><h1 class="title">'+esc(model.title)+'</h1><div class="date">Generado el '+esc(model.generatedAt)+'</div></section>'+
      '<header class="header"><h1>'+esc(model.title)+'</h1><p>'+esc(model.unit)+' · '+esc(model.generatedAt)+'</p></header>'+
      '<section class="section"><h2>Filtros aplicados</h2><div class="filters">'+model.filterRows.map(function(item){return '<div class="filter"><strong>'+esc(item.filtro)+'</strong>'+esc(item.valor)+'</div>';}).join("")+'</div></section>'+
      '<section class="section"><h2>Resumen ejecutivo</h2><ul class="summary">'+model.summary.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      periodBlock+
      '<section class="section"><h2>'+esc(model.table.title)+'</h2><p>'+esc(model.tableExplanation)+'</p>'+tableHtml(model.table)+'</section>'+
      '<section class="section"><h2>Observaciones</h2><ul class="observations">'+model.observations.map(function(item){return '<li>'+esc(item)+'</li>';}).join("")+'</ul></section>'+
      '<section class="signatures">'+model.signatures.map(function(item){return '<div class="signature"><small>'+esc(item.responsabilidad||"")+'</small><strong>'+esc(item.nombre||"")+'</strong><span>'+esc(item.cargo||"")+'</span></div>';}).join("")+'</section>'+
      '<div class="footer">ITSQMET · Reporte institucional generado desde Global</div></div>';
  }
  function reportHtml(model,logo){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(model.title)+'</title><style>'+reportCss()+'</style></head><body>'+reportBody(model,logo||absoluteUrl((config.branding||{}).logoPath||"assets/branding/logo-instituto.png"))+'</body></html>';
  }
  function loadScript(src){
    return new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=true;
      script.onload=function(){
        if(typeof window.html2pdf==="function"){resolve(window.html2pdf);}
        else{reject(new Error("La librería PDF cargó sin exponer html2pdf."));}
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+src));};
      (document.head||document.documentElement||document.body).appendChild(script);
    });
  }
  function ensureHtml2Pdf(){
    if(typeof window.html2pdf==="function"){return Promise.resolve(window.html2pdf);}
    if(html2pdfLoading){return html2pdfLoading;}
    html2pdfLoading=(function tryPath(index){
      if(index>=HTML2PDF_PATHS.length){return Promise.reject(new Error("No se pudo cargar el motor de descarga PDF."));}
      return loadScript(HTML2PDF_PATHS[index]).catch(function(){return tryPath(index+1);});
    })(0).finally(function(){html2pdfLoading=null;});
    return html2pdfLoading;
  }
  function blobToDataUrl(blob){
    return new Promise(function(resolve,reject){
      if(typeof window.FileReader!=="function"){reject(new Error("FileReader no disponible."));return;}
      var reader=new window.FileReader();
      reader.onload=function(){resolve(reader.result);};
      reader.onerror=function(){reject(reader.error||new Error("No se pudo leer el logo."));};
      reader.readAsDataURL(blob);
    });
  }
  function loadLogoSource(){
    var url=absoluteUrl((config.branding||{}).logoPath||"assets/branding/logo-instituto.png");
    if(typeof window.fetch!=="function"||typeof window.FileReader!=="function"){return Promise.resolve(url);}
    return window.fetch(url,{cache:"no-store"}).then(function(response){
      if(!response.ok){throw new Error("No se pudo cargar el logo institucional.");}
      return response.blob();
    }).then(blobToDataUrl).catch(function(){return url;});
  }
  function filename(model){
    var career=selectedLabel("#globalFiltroCarrera","");
    if(!career||career==="Todas las carreras"){career="Todas_las_carreras";}
    return "Global_"+slug(model.section&&model.section.label||"Reporte")+"_"+slug(career)+"_"+todayISO()+".pdf";
  }
  function createHost(model,logo){
    var host=document.createElement("article");
    host.setAttribute("data-global-pdf-export","true");
    host.setAttribute("aria-hidden","true");
    host.style.cssText="position:absolute;left:0;top:0;width:760px;box-sizing:border-box;background:#ffffff;color:#172033;z-index:2147483647;opacity:1;visibility:visible;pointer-events:none;";
    host.innerHTML="<style>"+reportCss()+"</style>"+reportBody(model,logo);
    document.body.appendChild(host);
    return host;
  }

  function waitForPaint(){
    return new Promise(function(resolve){
      var first=function(){
        var second=function(){
          window.setTimeout(resolve,100);
        };
        if(typeof window.requestAnimationFrame==="function"){
          window.requestAnimationFrame(second);
        }else{
          window.setTimeout(second,16);
        }
      };
      if(typeof window.requestAnimationFrame==="function"){
        window.requestAnimationFrame(first);
      }else{
        window.setTimeout(first,16);
      }
    });
  }
  function generate(options){
    var model=buildModel(options||{});
    var host=null;
    return Promise.all([ensureHtml2Pdf(),loadLogoSource()]).then(function(values){
      var engine=values[0],logo=values[1];
      host=createHost(model,logo);

      return waitForPaint().then(function(){
        var height=Math.max(1123,host.scrollHeight||1123);
        var settings={
          margin:[8,8,8,8],
          filename:filename(model),
          image:{type:"jpeg",quality:0.98},
          html2canvas:{
            scale:1.35,
            useCORS:true,
            allowTaint:false,
            backgroundColor:"#ffffff",
            logging:false,
            scrollX:0,
            scrollY:0,
            windowWidth:800,
            windowHeight:height
          },
          jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true},
          pagebreak:{mode:["css","legacy"],avoid:["tr",".section",".signature"]}
        };
        return Promise.resolve(engine().set(settings).from(host).save());
      }).then(function(){
        return true;
      });
    }).finally(function(){
      if(host&&host.parentNode){host.parentNode.removeChild(host);}
    });
  }

  var api={
    version:VERSION,generate:generate,buildModel:buildModel,tableForSection:tableForSection,
    summaryText:summaryText,observations:observations,filterRows:filterRows,
    tableExplanation:tableExplanation,label:label,graduateRows:graduateRows,getSignatures:getSignatures,
    periodRows:periodRows,reportHtml:reportHtml
  };
  window.GlobalPDF=api;
  window.__globalPdfReady=Promise.resolve(api);
  try{window.dispatchEvent(new CustomEvent("global:pdf-ready",{detail:{ok:true,version:VERSION,directRuntime:true,autoDownload:true}}));}catch(error){}
})(window,document);
