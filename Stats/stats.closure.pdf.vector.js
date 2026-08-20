/* =========================================================
Nombre completo: stats.closure.pdf.vector.js
Ruta: /Stats/stats.closure.pdf.vector.js
Función:
- Reemplazar la exportación basada en html2canvas por un PDF vectorial con jsPDF.
- Evitar PDFs en blanco en Electron.
- Incluir resumen ejecutivo, causas, requisitos, carreras, aprobación final y detalle.
========================================================= */
(function(window,document){
  "use strict";

  var exporting=false;
  var enginePromise=null;

  function el(id){return document.getElementById(id);}
  function text(value){return String(value==null?"":value).trim();}
  function num(value){value=Number(value);return Number.isFinite(value)?value:0;}
  function pct(value,total){var d=num(total);return d>0?Math.round((num(value)*10000)/d)/100:0;}
  function slug(value){return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^0-9A-Za-z_-]+/g,"_").replace(/_+/g,"_").replace(/^_+|_+$/g,"");}
  function state(){return window.StatsApp&&typeof window.StatsApp.getState==="function"?window.StatsApp.getState()||{}:{};}
  function currentReport(){if(!window.StatsClosure||typeof window.StatsClosure.build!=="function"){return null;}try{return window.StatsClosure.build()||null;}catch(error){return null;}}
  function selectedText(id,fallback){var node=el(id);if(node&&node.options&&node.selectedIndex>=0){var value=text(node.options[node.selectedIndex].textContent);if(value){return value;}}return text(fallback);}
  function isRetired(row){var value=text(row&&(row._estadoMatricula||row.estadoMatricula||row.EstadoMatricula||"ACTIVO")).toUpperCase();return value==="RETIRADO"||!!(row&&row.retirado===true);}
  function approvalOf(row){if(row&&row._approval){return row._approval;}if(window.StatsRules&&typeof window.StatsRules.studentApproval==="function"){try{return window.StatsRules.studentApproval(row||{})||{};}catch(error){}}return {approved:false,missingRequirements:[]};}
  function nameOf(row){return text(row&&(row._nombres||row.nombres||row.Nombres||row.nombre||row.Nombre))||"Sin nombre";}
  function idOf(row){return text(row&&(row._cedula||row.cedula||row.Cedula||row.numeroIdentificacion||row.NumeroIdentificacion||row.identificacion));}
  function careerOf(row){return text(row&&(row._carrera||row.nombreCarrera||row.NombreCarrera||row.carrera||row.Carrera))||"SIN CARRERA";}

  function rowsForReport(report){
    if(!report||!report.periodId||!window.StatsCore||typeof window.StatsCore.resumen!=="function"){return [];}
    var s=state();
    try{
      var data=window.StatsCore.resumen({periodId:report.periodId,sede:text(s.sede),division:text(s.division),matricula:"",career:text(s.career),status:"",requirementKey:"",force:false})||{};
      return Array.isArray(data.rows)?data.rows:[];
    }catch(error){console.warn("[StatsClosurePDFVector] No se pudo reconstruir la cohorte.",error);return [];}
  }

  function requirementSummary(rows){
    var rules=window.StatsRules||{};
    var catalog=(Array.isArray(rules.BASE_REQUIREMENTS)?rules.BASE_REQUIREMENTS:[]).concat(Array.isArray(rules.REGULAR_EXTRA_REQUIREMENTS)?rules.REGULAR_EXTRA_REQUIREMENTS:[]);
    var active=(rows||[]).filter(function(row){return !isRetired(row);});
    return catalog.map(function(item){
      var out={label:item.label||item.key,total:0,cumple:0,noCumple:0,avance:0};
      active.forEach(function(row){
        var status=null;
        try{status=typeof rules.requirementStatus==="function"?rules.requirementStatus(row,item.key):null;}catch(error){}
        if(status&&status.applies===false){return;}
        out.total+=1;
        if(status&&status.cumple===true){out.cumple+=1;}else{out.noCumple+=1;}
      });
      out.avance=pct(out.cumple,out.total);
      return out;
    }).filter(function(item){return item.total>0;});
  }

  function careerSummary(rows){
    var map=Object.create(null);
    (rows||[]).forEach(function(row){
      var career=careerOf(row);
      if(!map[career]){map[career]={career:career,total:0,retired:0,reached:0,notReached:0,rate:0};}
      var item=map[career];item.total+=1;
      if(isRetired(row)){item.retired+=1;item.notReached+=1;return;}
      if(approvalOf(row).approved===true){item.reached+=1;}else{item.notReached+=1;}
    });
    return Object.keys(map).map(function(key){var item=map[key];item.rate=pct(item.reached,item.total);return item;}).sort(function(a,b){return b.notReached-a.notReached||b.total-a.total||a.career.localeCompare(b.career,"es");});
  }

  function metadata(report){
    var s=state();
    return {period:selectedText("stats-periodo",report.periodId)||report.periodId,sede:selectedText("stats-sede",s.sede||"Todas")||"Todas",division:selectedText("stats-division",s.division||"Todas")||"Todas",career:selectedText("stats-carrera",s.career||"Todas")||"Todas",generated:new Date().toLocaleString("es-EC",{dateStyle:"short",timeStyle:"short"})};
  }

  function findings(report,requirements,careers){
    var list=["De "+report.total+" estudiantes registrados, "+report.reached+" llegaron a la fase final con requisitos completos ("+report.arrivalRate+"%).",report.notReached+" estudiantes no llegaron a la fase final; "+report.retired+" corresponden a retiros."];
    var cause=report.causes&&report.causes.length?report.causes[0]:null;
    var req=(requirements||[]).slice().sort(function(a,b){return b.noCumple-a.noCumple;})[0]||null;
    var career=careers&&careers.length?careers[0]:null;
    if(cause){list.push("La causa con mayor incidencia fue "+cause.label+", con "+cause.total+" estudiante"+(cause.total===1?"":"s")+".");}
    if(req){list.push("El requisito con mayor número de pendientes entre estudiantes activos fue "+req.label+", con "+req.noCumple+".");}
    if(career&&career.notReached>0){list.push("La carrera con mayor número de estudiantes que no llegaron fue "+career.career+", con "+career.notReached+".");}
    return list;
  }

  function ctor(){
    if(window.jspdf&&typeof window.jspdf.jsPDF==="function"){return window.jspdf.jsPDF;}
    if(typeof window.jsPDF==="function"){return window.jsPDF;}
    return null;
  }

  function loadScript(src,timeoutMs){
    return new Promise(function(resolve,reject){
      var script=document.createElement("script"),settled=false;
      var timer=window.setTimeout(function(){if(settled){return;}settled=true;try{script.remove();}catch(error){}reject(new Error("Tiempo agotado al cargar "+src));},Math.max(2500,Number(timeoutMs||6500)));
      function done(ok,error){if(settled){return;}settled=true;window.clearTimeout(timer);if(ok){resolve(ctor());}else{try{script.remove();}catch(innerError){}reject(error||new Error("No se pudo cargar "+src));}}
      script.src=src;script.async=true;
      script.onload=function(){done(!!ctor(),new Error("jsPDF cargó pero no expuso su constructor."));};
      script.onerror=function(){done(false,new Error("No se pudo cargar "+src));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  function ensureEngine(){
    if(ctor()){return Promise.resolve(ctor());}
    if(enginePromise){return enginePromise;}
    var sources=["../node_modules/jspdf/dist/jspdf.umd.min.js","../node_modules/jspdf/dist/jspdf.umd.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js"];
    enginePromise=new Promise(function(resolve,reject){var i=0;function next(lastError){if(ctor()){resolve(ctor());return;}if(i>=sources.length){reject(lastError||new Error("jsPDF no está disponible."));return;}loadScript(sources[i++],6500).then(resolve).catch(next);}next();}).catch(function(error){enginePromise=null;throw error;});
    return enginePromise;
  }

  function filename(report){var s=state(),base="Reporte_Cierre_"+slug(report.periodId||"periodo");if(text(s.division)){base+="_"+slug(s.division);}if(text(s.career)){base+="_"+slug(s.career);}return base+".pdf";}

  function generate(JsPDF,report){
    var rows=rowsForReport(report),requirements=requirementSummary(rows),careers=careerSummary(rows),meta=metadata(report),notes=findings(report,requirements,careers);
    var doc=new JsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    var PAGE_W=210,PAGE_H=297,M=12,BOTTOM=14,CONTENT=PAGE_W-(M*2),y=14;

    function setFont(size,style,color){doc.setFont("helvetica",style||"normal");doc.setFontSize(size||9);var c=color||[23,32,51];doc.setTextColor(c[0],c[1],c[2]);}
    function newPage(){doc.addPage();y=14;}
    function ensure(height){if(y+height>PAGE_H-BOTTOM){newPage();}}
    function wrap(value,width,size){setFont(size||8,"normal");return doc.splitTextToSize(text(value),Math.max(5,width));}
    function paragraph(value,size,leading,indent){var lines=wrap(value,CONTENT-(indent||0),size||9),lh=leading||4.2;ensure(lines.length*lh+2);doc.text(lines,M+(indent||0),y);y+=lines.length*lh+2;}
    function sectionTitle(title,subtitle,forcePage){if(forcePage&&y>20){newPage();}ensure(subtitle?15:11);doc.setFillColor(37,99,235);doc.rect(M,y-1,2,10,"F");setFont(13,"bold",[15,23,42]);doc.text(title,M+5,y+4);y+=7;if(subtitle){setFont(7.6,"normal",[100,116,139]);var lines=doc.splitTextToSize(text(subtitle),CONTENT-5);doc.text(lines,M+5,y);y+=lines.length*3.2+3;}else{y+=2;}}
    function drawKpis(){var gap=3,col=(CONTENT-(gap*2))/3,rowH=22;var items=[["Registrados",report.total,"Cohorte"],["Activos al cierre",report.active,"Sin retirados"],["Retirados",report.retired,"Salieron del proceso"],["Llegaron a fase final",report.reached,"Requisitos completos"],["No llegaron",report.notReached,"Retirados + pendientes"],["Tasa de llegada",report.arrivalRate+"%","Sobre la cohorte"]];ensure(rowH*2+gap);items.forEach(function(item,i){var r=Math.floor(i/3),c=i%3,x=M+c*(col+gap),yy=y+r*(rowH+gap);doc.setFillColor(248,250,252);doc.setDrawColor(219,227,239);doc.roundedRect(x,yy,col,rowH,2,2,"FD");setFont(6.5,"bold",[100,116,139]);doc.text(text(item[0]).toUpperCase(),x+3,yy+5);setFont(16,"bold",[15,23,42]);doc.text(text(item[1]),x+3,yy+12);setFont(6.5,"normal",[100,116,139]);doc.text(text(item[2]),x+3,yy+18);});y+=rowH*2+gap+4;}
    function drawTable(headers,data,widths,options){options=options||{};var fs=options.fontSize||7.2,lh=options.lineHeight||3.1,pad=1.6,headerH=7;function header(){ensure(headerH+2);var x=M;doc.setFillColor(234,241,251);doc.setDrawColor(203,213,225);setFont(fs,"bold",[30,58,95]);headers.forEach(function(h,i){doc.rect(x,y,widths[i],headerH,"FD");var lines=doc.splitTextToSize(text(h),widths[i]-(pad*2));doc.text(lines,x+pad,y+4.4);x+=widths[i];});y+=headerH;}
      header();
      (data||[]).forEach(function(row){var wrapped=row.map(function(cell,i){setFont(fs,"normal",[23,32,51]);return doc.splitTextToSize(text(cell),Math.max(3,widths[i]-(pad*2)));});var maxLines=1;wrapped.forEach(function(lines){maxLines=Math.max(maxLines,lines.length);});var rh=Math.max(6,maxLines*lh+2.4);if(y+rh>PAGE_H-BOTTOM){newPage();header();}var x=M;row.forEach(function(cell,i){doc.setFillColor(255,255,255);doc.setDrawColor(219,227,239);doc.rect(x,y,widths[i],rh,"FD");setFont(fs,"normal",[23,32,51]);doc.text(wrapped[i],x+pad,y+4);x+=widths[i];});y+=rh;});y+=4;}
    function footer(){var pages=doc.getNumberOfPages();for(var i=1;i<=pages;i++){doc.setPage(i);setFont(7,"normal",[100,116,139]);doc.setDrawColor(203,213,225);doc.line(M,PAGE_H-10,PAGE_W-M,PAGE_H-10);doc.text("Reporte generado automáticamente desde Stats · Requisitos",M,PAGE_H-6);doc.text("Página "+i+" de "+pages,PAGE_W-M,PAGE_H-6,{align:"right"});}}

    setFont(8,"bold",[37,99,235]);doc.text("UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL",M,y);y+=6;setFont(20,"bold",[15,23,42]);doc.text("Reporte de cierre del período",M,y);y+=8;setFont(8,"normal",[71,85,105]);doc.text("Período: "+meta.period,M,y);doc.text("Fecha: "+meta.generated,PAGE_W-M,y,{align:"right"});y+=5;doc.text("Sede: "+meta.sede,M,y);doc.text("División: "+meta.division,PAGE_W-M,y,{align:"right"});y+=5;doc.text("Carrera: "+meta.career,M,y);y+=7;doc.setDrawColor(37,99,235);doc.setLineWidth(.8);doc.line(M,y,PAGE_W-M,y);y+=6;

    sectionTitle("1. Resumen ejecutivo","Cohorte completa del período: activos + retirados.");drawKpis();doc.setFillColor(239,246,255);doc.setDrawColor(191,219,254);var summary="De los "+report.total+" estudiantes registrados en el período, "+report.reached+" llegaron a la fase final con todos los requisitos aplicables completos, equivalente al "+report.arrivalRate+"%. Un total de "+report.notReached+" estudiantes no llegó a esta fase.";var summaryLines=wrap(summary,CONTENT-8,8.5),summaryH=summaryLines.length*4+6;ensure(summaryH);doc.roundedRect(M,y,CONTENT,summaryH,2,2,"FD");setFont(8.5,"normal",[30,64,175]);doc.text(summaryLines,M+4,y+5);y+=summaryH+6;

    sectionTitle("2. ¿Por qué no llegaron?","Un estudiante puede tener más de una causa; los porcentajes no necesariamente suman 100%.");var causeRows=(report.causes||[]).map(function(item){return [item.label,item.total,item.percent+"%"];});if(!causeRows.length){causeRows=[["Sin causas registradas",0,"0%"]];}drawTable(["Causa","Estudiantes","% de quienes no llegaron"],causeRows,[105,35,46],{fontSize:7.5});

    sectionTitle("3. Cumplimiento de requisitos","Cumplimiento entre estudiantes activos y según aplicabilidad del período.",true);var reqRows=requirements.map(function(item){return [item.label,item.total,item.cumple,item.noCumple,item.avance+"%"];});if(!reqRows.length){reqRows=[["Sin requisitos aplicables",0,0,0,"0%"]];}drawTable(["Requisito","Aplican","Cumplen","Pendientes","Cumplimiento"],reqRows,[70,25,25,28,38],{fontSize:7.2});

    sectionTitle("4. Resultados por carrera","Comparación de llegada a fase final por carrera.");var careerRows=careers.map(function(item){return [item.career,item.total,item.reached,item.notReached,item.retired,item.rate+"%"];});if(!careerRows.length){careerRows=[["Sin datos",0,0,0,0,"0%"]];}drawTable(["Carrera","Registrados","Llegaron","No llegaron","Retirados","% llegada"],careerRows,[68,22,22,24,22,28],{fontSize:6.8});

    sectionTitle("5. Aprobación final","Resultados registrados en los campos de aprobación final.");var finalRows=(report.final||[]).map(function(item){return [item.label,item.total,item.cumple,item.no_cumple,item.avance+"%"];});if(!finalRows.length){finalRows=[["Sin campos de aprobación final",0,0,0,"0%"]];}drawTable(["Evaluación final","Evaluados","Aprobados","No aprobados / pendientes","Aprobación"],finalRows,[82,24,24,34,22],{fontSize:6.9});

    sectionTitle("6. Principales hallazgos","Síntesis automática basada en los datos del período.");notes.forEach(function(item){paragraph("• "+item,8.2,3.8,2);});

    sectionTitle("7. Detalle de quienes no llegaron","Listado individual de retiros y requisitos pendientes.",true);var detailRows=(report.detail||[]).map(function(item,index){var row=item.row||{};return [index+1,nameOf(row),idOf(row),careerOf(row),item.type==="retirado"?"Retirado":"No llegó",(item.causes||[]).join(", ")];});if(!detailRows.length){detailRows=[["—","Todos los estudiantes llegaron","","","","Sin pendientes"]];}drawTable(["#","Estudiante","Cédula","Carrera","Estado","Motivo(s)"],detailRows,[7,36,23,46,20,54],{fontSize:6.3,lineHeight:2.75});

    footer();
    var buffer=doc.output("arraybuffer");
    if(!buffer||buffer.byteLength<1500){throw new Error("El PDF generado no contiene suficiente información. Se canceló la descarga para evitar un archivo vacío.");}
    return doc;
  }

  function saveDoc(doc,name){var blob=doc.output("blob");if(!blob||blob.size<1500){throw new Error("El PDF generado está vacío.");}var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();window.setTimeout(function(){try{URL.revokeObjectURL(url);}catch(error){}try{a.remove();}catch(error){}},5000);}

  function syncButton(){var button=el("stats-closure-pdf");if(!button){return;}var report=currentReport();button.disabled=exporting||!report||report.requiresPeriod===true||!text(report.periodId);button.textContent="PDF";}

  function download(){
    if(exporting){return;}
    var report=currentReport(),button=el("stats-closure-pdf");
    if(!report||report.requiresPeriod===true||!text(report.periodId)){window.alert("Selecciona un período para generar el PDF.");syncButton();return;}
    exporting=true;if(button){button.disabled=true;button.textContent="...";}
    ensureEngine().then(function(JsPDF){var doc=generate(JsPDF,report);saveDoc(doc,filename(report));}).catch(function(error){console.error("[StatsClosurePDFVector]",error);window.alert("No se pudo generar el PDF: "+(error.message||String(error)));}).finally(function(){exporting=false;syncButton();});
  }

  function replaceButton(){var old=el("stats-closure-pdf");if(!old||!old.parentNode){return null;}var fresh=old.cloneNode(true);old.parentNode.replaceChild(fresh,old);fresh.addEventListener("click",download);return fresh;}
  function bind(){replaceButton();["stats-periodo","stats-sede","stats-division","stats-carrera"].forEach(function(id){var node=el(id);if(node){node.addEventListener("change",function(){window.setTimeout(syncButton,0);});}});["stats:bootstrap-ready","stats:cache-invalidated","bdlocal:conexiones-cache-updated","requisitos:bdlocal-cambio-disponible"].forEach(function(name){window.addEventListener(name,function(){window.setTimeout(syncButton,0);});});syncButton();}

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bind);}else{bind();}
  window.StatsClosurePDFVector={version:"1.0.0-direct-jspdf",download:download,syncButton:syncButton,ensureEngine:ensureEngine,generate:generate};
})(window,document);
