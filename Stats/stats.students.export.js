/* =========================================================
Nombre completo: stats.students.export.js
Ruta o ubicación: /Stats/stats.students.export.js
Función o funciones:
- Descargar en XLSX real todos los estudiantes de la vista filtrada de Stats.
- Descargar en PDF institucional la misma vista, sin limitarse a las filas renderizadas.
- Respetar período, sede, división, matrícula, carrera, estado, requisito, búsqueda,
  modo Todos/Completos/Con faltantes y orden actual.
- Cargar SheetJS y html2pdf únicamente cuando el usuario solicita una descarga.
- Mantener los botones deshabilitados cuando no existe una cohorte exportable.
========================================================= */
(function(window,document){
  "use strict";

  var exporting={xlsx:false,pdf:false};
  var observer=null;
  var dependencyLoads=Object.create(null);
  var ROWS_PER_PAGE=22;
  var LOGO_PATH="../Global/assets/branding/logo-instituto.png";
  var XLSX_PATH="../node_modules/xlsx/dist/xlsx.full.min.js";
  var HTML2PDF_PATH="../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js";

  function text(value){return String(value==null?"":value).trim();}
  function el(id){return document.getElementById(id);}
  function lower(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");}
  function safeFile(value){return text(value||"TODOS").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^0-9A-Za-z_.-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"")||"TODOS";}
  function escapeHtml(value){return text(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");}
  function appState(){return window.StatsApp&&typeof window.StatsApp.getState==="function"?window.StatsApp.getState()||{}:{};}
  function data(){return appState().data||{};}
  function studentsApi(){return window.StatsStudents||{};}
  function helpers(){return studentsApi().helpers||{};}

  function dependencyReady(test){try{return !!test();}catch(error){return false;}}
  function loadDependency(relative,test,label){
    if(dependencyReady(test)){return Promise.resolve(true);}
    var src;
    try{src=new URL(relative,document.baseURI).href;}catch(error){src=relative;}
    if(dependencyLoads[src]){return dependencyLoads[src];}
    dependencyLoads[src]=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===src;});
      function waitExisting(){
        var started=Date.now();
        (function check(){
          if(dependencyReady(test)){resolve(true);return;}
          if(Date.now()-started>5000){reject(new Error("No se pudo preparar "+label+"."));return;}
          setTimeout(check,40);
        })();
      }
      if(existing){waitExisting();return;}
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.setAttribute("data-stats-export-dependency",label);
      script.onload=function(){dependencyReady(test)?resolve(true):reject(new Error(label+" no expuso la API esperada."));};
      script.onerror=function(){reject(new Error("No se pudo cargar "+label+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).catch(function(error){delete dependencyLoads[src];throw error;});
    return dependencyLoads[src];
  }

  function ensureXlsx(){return loadDependency(XLSX_PATH,function(){return window.XLSX&&window.XLSX.utils&&typeof window.XLSX.writeFile==="function";},"SheetJS");}
  function ensureHtml2Pdf(){return loadDependency(HTML2PDF_PATH,function(){return typeof window.html2pdf==="function";},"html2pdf");}

  function selectedIsTelegram(dataset){
    var selected=dataset&&dataset.selectedRequirement;
    return lower(selected&&selected.key)==="telegram";
  }

  function isComplete(row,dataset){
    if(selectedIsTelegram(dataset)){
      return typeof helpers().hasTelegram==="function"?helpers().hasTelegram(row):false;
    }
    if(row&&row._selectedRequirementStatus){return !!row._selectedRequirementStatus.cumple;}
    return !!(row&&row._estado&&row._estado.id==="cumple");
  }

  function missing(row){return typeof helpers().missingFromRow==="function"?helpers().missingFromRow(row)||[]:[];}
  function studentName(row){return typeof helpers().studentName==="function"?helpers().studentName(row):text(row&&row._nombres||row&&row.nombres||row&&row.Nombres);}
  function studentId(row){return typeof helpers().studentId==="function"?helpers().studentId(row):text(row&&row._cedula||row&&row.cedula||row&&row.numeroIdentificacion);}
  function studentCareer(row){return typeof helpers().studentCareer==="function"?helpers().studentCareer(row):text(row&&row._carrera||row&&row.carrera||row&&row.NombreCarrera)||"SIN CARRERA";}

  function statusText(row,dataset){
    if(selectedIsTelegram(dataset)){return isComplete(row,dataset)?"Con Telegram":"Sin Telegram";}
    var selected=row&&row._selectedRequirementStatus;
    if(selected){
      if(selected.status==="no_aplica"){return text(selected.labelStatus)||"No aplica";}
      if(selected.cumple){return "Cumple";}
      return text(selected.label)||"No cumple";
    }
    if(isComplete(row,dataset)){return "Aprobado";}
    var items=missing(row).map(function(item){return text(item&&item.label)||text(item&&item.key);}).filter(Boolean);
    return items.length?items.join(", "):"No cumple";
  }

  function statusSortValue(row,dataset){
    if(selectedIsTelegram(dataset)){return isComplete(row,dataset)?"1-con-telegram":"0-sin-telegram";}
    if(row&&row._selectedRequirementStatus){return row._selectedRequirementStatus.cumple?"1-cumple":"0-no-cumple";}
    var count=missing(row).length;
    if(isComplete(row,dataset)){return "999-aprobado";}
    return String(count).padStart(3,"0")+"-faltantes";
  }

  function currentMode(){
    var node=document.querySelector("#stats-estudiantes [data-student-mode].is-active");
    return node?text(node.getAttribute("data-student-mode"))||"all":"all";
  }

  function currentOrder(){
    var node=document.querySelector("#stats-estudiantes [data-student-order]");
    return node?text(node.value)||"name-asc":"name-asc";
  }

  function filterMode(rows,dataset,mode){
    if(mode==="complete"){return rows.filter(function(row){return isComplete(row,dataset);});}
    if(mode==="missing"){return rows.filter(function(row){return !isComplete(row,dataset);});}
    return rows;
  }

  function sortRows(rows,dataset,order){
    var output=rows.slice();
    output.sort(function(a,b){
      if(order==="career-asc"){return studentCareer(a).localeCompare(studentCareer(b),"es")||studentName(a).localeCompare(studentName(b),"es");}
      if(order==="missing-desc"){return missing(b).length-missing(a).length||studentName(a).localeCompare(studentName(b),"es");}
      if(order==="missing-asc"){return missing(a).length-missing(b).length||studentName(a).localeCompare(studentName(b),"es");}
      if(order==="status"){return statusSortValue(a,dataset).localeCompare(statusSortValue(b,dataset),"es")||studentName(a).localeCompare(studentName(b),"es");}
      return studentName(a).localeCompare(studentName(b),"es");
    });
    return output;
  }

  function currentRows(){
    var dataset=data();
    if(!dataset||dataset._requiresPeriod){return [];}
    var api=studentsApi();
    var rows=typeof api.normalizeRows==="function"?api.normalizeRows(dataset).slice():[];
    var search=text(appState().studentSearch||dataset.studentSearch);
    if(typeof api.filterRows==="function"){rows=api.filterRows(rows,search);}
    rows=filterMode(rows,dataset,currentMode());
    return sortRows(rows,dataset,currentOrder());
  }

  function selectedLabel(id,fallback){
    var node=el(id);
    if(node&&node.options&&node.selectedIndex>=0){var label=text(node.options[node.selectedIndex].textContent);if(label){return label;}}
    return fallback||"—";
  }

  function modeLabel(mode,dataset){
    var telegram=selectedIsTelegram(dataset);
    if(mode==="complete"){return telegram?"Con Telegram":"Completos";}
    if(mode==="missing"){return telegram?"Sin Telegram":"Con faltantes";}
    return "Todos";
  }

  function orderLabel(order){
    return {"name-asc":"Nombre A-Z","career-asc":"Carrera A-Z","status":"Estado","missing-desc":"Más faltantes primero","missing-asc":"Menos faltantes primero"}[order]||"Nombre A-Z";
  }

  function metadata(rows){
    var dataset=data();
    var search=text(appState().studentSearch||dataset.studentSearch);
    var mode=currentMode();
    var order=currentOrder();
    return {
      periodo:selectedLabel("stats-periodo",text(appState().periodId)||"—"),
      sede:selectedLabel("stats-sede","Todas"),
      division:selectedLabel("stats-division","Todas"),
      matricula:selectedLabel("stats-matricula","Todos"),
      carrera:selectedLabel("stats-carrera","Todas"),
      estado:selectedLabel("stats-estado","Todos"),
      requisito:selectedLabel("stats-requisito","Todos los requisitos"),
      busqueda:search||"Sin búsqueda",
      vista:modeLabel(mode,dataset),
      orden:orderLabel(order),
      total:rows.length,
      generado:new Date().toLocaleString("es-EC",{dateStyle:"medium",timeStyle:"short"})
    };
  }

  function dateStamp(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function fileBase(meta){var req=meta.requisito&&meta.requisito!=="Todos los requisitos"?meta.requisito:"Todos";return "Estudiantes_"+safeFile(req)+"_"+safeFile(meta.periodo)+"_"+dateStamp();}
  function rowsForExport(rows,dataset){return rows.map(function(row,index){return [index+1,studentName(row),studentId(row),studentCareer(row),statusText(row,dataset)];});}
  function ensureRows(){var rows=currentRows();if(!rows.length){throw new Error("No hay estudiantes para exportar con los filtros actuales.");}return rows;}

  function notify(message,kind){
    var node=el("stats-status");
    if(!node){return;}
    node.textContent=message;
    node.className="stats-status "+(kind||"");
    node.classList.remove("is-auto-hidden");
  }

  function setBusy(kind,value){
    exporting[kind]=!!value;
    ["xlsx","pdf"].forEach(function(key){
      var button=el("stats-students-"+key);
      if(!button){return;}
      button.disabled=exporting.xlsx||exporting.pdf||!currentRows().length;
      button.textContent=exporting[key]?"Generando…":key.toUpperCase();
    });
  }

  function updateButtons(){
    var enabled=currentRows().length>0&&!exporting.xlsx&&!exporting.pdf;
    ["xlsx","pdf"].forEach(function(key){var button=el("stats-students-"+key);if(button){button.disabled=!enabled;}});
  }

  function exportXlsx(){
    if(exporting.xlsx||exporting.pdf){return;}
    var rows;
    try{rows=ensureRows();setBusy("xlsx",true);notify("Preparando Excel de la vista actual...","");}
    catch(error){notify(error.message||String(error),"warn");return;}

    ensureXlsx().then(function(){
      var meta=metadata(rows);
      var dataset=data();
      var info=[
        ["REPORTE DE ESTUDIANTES - REQUISITOS"],
        ["Período",meta.periodo],["Sede",meta.sede],["División",meta.division],["Matrícula",meta.matricula],
        ["Carrera",meta.carrera],["Estado",meta.estado],["Requisito",meta.requisito],["Vista",meta.vista],
        ["Búsqueda",meta.busqueda],["Orden",meta.orden],["Resultados",meta.total],["Generado",meta.generado]
      ];
      var infoSheet=window.XLSX.utils.aoa_to_sheet(info);
      infoSheet["!cols"]=[{wch:24},{wch:58}];
      var table=[["#","Nombre","Cédula","Carrera","Estado"]].concat(rowsForExport(rows,dataset));
      var studentsSheet=window.XLSX.utils.aoa_to_sheet(table);
      studentsSheet["!cols"]=[{wch:7},{wch:40},{wch:17},{wch:46},{wch:30}];
      studentsSheet["!autofilter"]={ref:"A1:E"+Math.max(1,table.length)};
      var workbook=window.XLSX.utils.book_new();
      workbook.Props={Title:"Reporte de estudiantes",Subject:"Vista filtrada de Stats - Requisitos",Author:"Requisitos",CreatedDate:new Date()};
      window.XLSX.utils.book_append_sheet(workbook,infoSheet,"Información");
      window.XLSX.utils.book_append_sheet(workbook,studentsSheet,"Estudiantes");
      window.XLSX.writeFile(workbook,fileBase(meta)+".xlsx");
      notify("Excel generado: "+rows.length+" estudiantes de la vista actual.","ok");
    }).catch(function(error){console.error("[StatsStudentsExport:XLSX]",error);notify(error.message||String(error),"warn");})
      .finally(function(){setBusy("xlsx",false);updateButtons();});
  }

  function pdfPage(rows,meta,dataset,pageIndex,totalPages){
    var body=rows.map(function(row,index){
      var number=(pageIndex*ROWS_PER_PAGE)+index+1;
      return '<tr><td class="num">'+number+'</td><td class="name">'+escapeHtml(studentName(row))+'</td><td class="id">'+escapeHtml(studentId(row))+'</td><td>'+escapeHtml(studentCareer(row))+'</td><td>'+escapeHtml(statusText(row,dataset))+'</td></tr>';
    }).join("");
    return '<section class="stats-export-page">'
      +'<header class="stats-export-header"><img src="'+escapeHtml(LOGO_PATH)+'" alt="Logo institucional"><div><div class="eyebrow">Unidad de Titulación y Eficiencia Terminal</div><h1>Reporte de estudiantes</h1><p>Requisitos · vista filtrada de estadísticas</p></div><div class="count"><strong>'+meta.total+'</strong><span>estudiantes</span></div></header>'
      +'<div class="stats-export-meta">'
      +'<div><span>Período</span><strong>'+escapeHtml(meta.periodo)+'</strong></div><div><span>Sede</span><strong>'+escapeHtml(meta.sede)+'</strong></div><div><span>División</span><strong>'+escapeHtml(meta.division)+'</strong></div><div><span>Matrícula</span><strong>'+escapeHtml(meta.matricula)+'</strong></div>'
      +'<div><span>Carrera</span><strong>'+escapeHtml(meta.carrera)+'</strong></div><div><span>Requisito</span><strong>'+escapeHtml(meta.requisito)+'</strong></div><div><span>Estado</span><strong>'+escapeHtml(meta.estado)+'</strong></div><div><span>Vista</span><strong>'+escapeHtml(meta.vista)+'</strong></div>'
      +'</div>'
      +(meta.busqueda!=="Sin búsqueda"?'<div class="stats-export-search"><strong>Búsqueda:</strong> '+escapeHtml(meta.busqueda)+'</div>':'')
      +'<table class="stats-export-table"><thead><tr><th>#</th><th>Nombre</th><th>Cédula</th><th>Carrera</th><th>Estado</th></tr></thead><tbody>'+body+'</tbody></table>'
      +'<footer><span>Generado: '+escapeHtml(meta.generado)+' · Orden: '+escapeHtml(meta.orden)+'</span><strong>Página '+(pageIndex+1)+' de '+totalPages+'</strong></footer>'
      +'</section>';
  }

  function pdfDocument(rows,meta,dataset){
    var totalPages=Math.max(1,Math.ceil(rows.length/ROWS_PER_PAGE));
    var pages=[];
    for(var page=0;page<totalPages;page+=1){pages.push(pdfPage(rows.slice(page*ROWS_PER_PAGE,(page+1)*ROWS_PER_PAGE),meta,dataset,page,totalPages));}
    var container=document.createElement("div");
    container.className="stats-export-document";
    container.style.position="fixed";
    container.style.left="-100000px";
    container.style.top="0";
    container.innerHTML='<style>'
      +'.stats-export-document{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff}'
      +'.stats-export-page{width:297mm;min-height:210mm;padding:9mm 11mm 8mm;box-sizing:border-box;background:#fff;page-break-after:always;position:relative}.stats-export-page:last-child{page-break-after:auto}'
      +'.stats-export-header{height:23mm;display:flex;align-items:center;gap:5mm;border-bottom:1.2px solid #cbd5e1;padding-bottom:3mm}.stats-export-header img{width:26mm;max-height:16mm;object-fit:contain}.stats-export-header>div:nth-child(2){flex:1}.stats-export-header .eyebrow{font-size:7.5pt;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#2563eb}.stats-export-header h1{font-size:18pt;margin:1mm 0 0}.stats-export-header p{font-size:8pt;color:#64748b;margin:1mm 0 0}.stats-export-header .count{min-width:30mm;text-align:center;border:1px solid #bfdbfe;background:#eff6ff;border-radius:4mm;padding:2mm 3mm}.stats-export-header .count strong{display:block;font-size:16pt;color:#1d4ed8}.stats-export-header .count span{font-size:7pt;font-weight:700;color:#475569;text-transform:uppercase}'
      +'.stats-export-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm 3mm;padding:3mm 0}.stats-export-meta div{border:1px solid #e2e8f0;border-radius:2mm;padding:1.5mm 2mm;min-width:0}.stats-export-meta span{display:block;font-size:6.5pt;color:#64748b;font-weight:700;text-transform:uppercase}.stats-export-meta strong{display:block;margin-top:.5mm;font-size:7.8pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stats-export-search{font-size:7.5pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:2mm;padding:1.5mm 2mm;margin-bottom:2mm}'
      +'.stats-export-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.4pt}.stats-export-table th{background:#0f172a;color:#fff;text-align:left;padding:1.6mm 1.5mm;border:1px solid #0f172a}.stats-export-table td{padding:1.45mm 1.5mm;border:1px solid #cbd5e1;vertical-align:middle;line-height:1.15;overflow-wrap:anywhere}.stats-export-table tbody tr:nth-child(even){background:#f8fafc}.stats-export-table th:nth-child(1),.stats-export-table td:nth-child(1){width:7mm;text-align:center}.stats-export-table th:nth-child(2),.stats-export-table td:nth-child(2){width:64mm}.stats-export-table th:nth-child(3),.stats-export-table td:nth-child(3){width:28mm}.stats-export-table th:nth-child(4),.stats-export-table td:nth-child(4){width:105mm}.stats-export-table th:nth-child(5),.stats-export-table td:nth-child(5){width:42mm}.stats-export-table td.name{font-weight:700}.stats-export-page footer{position:absolute;left:11mm;right:11mm;bottom:4mm;display:flex;justify-content:space-between;gap:4mm;border-top:1px solid #e2e8f0;padding-top:1.5mm;color:#64748b;font-size:6.5pt}.stats-export-page footer strong{color:#334155}'
      +'</style>'+pages.join("");
    document.body.appendChild(container);
    return container;
  }

  function waitForImages(container){
    var images=Array.prototype.slice.call(container.querySelectorAll("img"));
    if(!images.length){return Promise.resolve();}
    return Promise.all(images.map(function(image){if(image.complete){return Promise.resolve();}return new Promise(function(resolve){image.onload=resolve;image.onerror=resolve;setTimeout(resolve,1800);});}));
  }

  function exportPdf(){
    if(exporting.xlsx||exporting.pdf){return;}
    var rows;
    try{rows=ensureRows();setBusy("pdf",true);notify("Preparando PDF de la vista actual...","");}
    catch(error){notify(error.message||String(error),"warn");return;}

    var container=null;
    var meta;
    var dataset;
    ensureHtml2Pdf().then(function(){
      meta=metadata(rows);
      dataset=data();
      container=pdfDocument(rows,meta,dataset);
      return waitForImages(container);
    }).then(function(){
      notify("Generando PDF con "+rows.length+" estudiantes...","");
      return window.html2pdf().set({
        margin:0,
        filename:fileBase(meta)+".pdf",
        image:{type:"jpeg",quality:0.98},
        html2canvas:{scale:1.7,useCORS:true,backgroundColor:"#ffffff",logging:false},
        jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},
        pagebreak:{mode:["css","legacy"]}
      }).from(container).save();
    }).then(function(){notify("PDF generado: "+rows.length+" estudiantes de la vista actual.","ok");})
      .catch(function(error){console.error("[StatsStudentsExport:PDF]",error);notify(error.message||String(error),"warn");})
      .finally(function(){if(container&&container.parentNode){container.parentNode.removeChild(container);}setBusy("pdf",false);updateButtons();});
  }

  function install(){
    var xlsx=el("stats-students-xlsx");
    var pdf=el("stats-students-pdf");
    if(xlsx&&!xlsx.dataset.exportBound){xlsx.dataset.exportBound="1";xlsx.addEventListener("click",exportXlsx);}
    if(pdf&&!pdf.dataset.exportBound){pdf.dataset.exportBound="1";pdf.addEventListener("click",exportPdf);}
    var target=el("stats-estudiantes");
    if(target&&!observer){observer=new MutationObserver(function(){updateButtons();});observer.observe(target,{childList:true,subtree:true});}
    updateButtons();
  }

  window.StatsStudentsExport={version:"1.1.0-lazy-dependencies",install:install,currentRows:currentRows,metadata:metadata,exportXlsx:exportXlsx,exportPdf:exportPdf,updateButtons:updateButtons,statusText:statusText,dependencyPaths:{xlsx:XLSX_PATH,pdf:HTML2PDF_PATH}};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",install);}else{install();}
})(window,document);
