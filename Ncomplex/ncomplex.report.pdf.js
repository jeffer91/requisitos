/* Informe PDF institucional de complexivos. Logo local opcional, sin servidor de imágenes. */
(function(window,document){
"use strict";
var LOGO="../Global/assets/branding/logo-instituto.png",KEY="itsqmet:ncomplex:report-logo:v1";
var busy=false,engineTask=null;
function el(id){return document.getElementById(id);}
function txt(v){return String(v==null?"":v).trim();}
function esc(v){return txt(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function f(v){return v===null||v===undefined?"—":Number(v).toLocaleString("es-EC",{minimumFractionDigits:2,maximumFractionDigits:2});}
function slug(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/_+/g,"_");}
function chunks(arr,n){var out=[];for(var i=0;i<arr.length;i+=n)out.push(arr.slice(i,i+n));return out;}
function logo(){try{var stored=window.localStorage&&window.localStorage.getItem(KEY);return stored&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(stored)?stored:LOGO;}catch(e){return LOGO;}}
function updateLogo(){var image=el("ncomplex-report-logo-preview");if(image)image.src=logo();}
function status(message,wrong){var target=el("ncomplex-report-status");if(target){target.textContent=message;target.className="ncomplex-report-message"+(wrong?" is-error":"");}}
function refresh(){var state=window.NcomplexState&&window.NcomplexState.get?window.NcomplexState.get():{};var button=el("ncomplex-report-export");if(button)button.disabled=busy||!state.selectedPeriodId;}
function loadLogo(event){
 var file=event&&event.target&&event.target.files&&event.target.files[0];
 if(!file)return;
 if(["image/png","image/jpeg","image/webp"].indexOf(file.type)<0||file.size>5*1024*1024){
   status("Seleccione un logo PNG, JPG o WEBP de hasta 5 MB.",true);return;
 }
 var reader=new FileReader();
 reader.onerror=function(){status("No se pudo leer el logotipo.",true);};
 reader.onload=function(){
   var img=new Image();
   img.onerror=function(){status("No se pudo abrir el logotipo.",true);};
   img.onload=function(){
     try{
       if(img.naturalWidth*img.naturalHeight>4e7)throw Error("Dimensiones del logotipo excesivas.");
       var scale=Math.min(1,1100/img.naturalWidth,480/img.naturalHeight);
       var canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
       canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
       var ctx=canvas.getContext("2d");if(!ctx)throw Error("No se pudo procesar la imagen.");
       ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
       var data=canvas.toDataURL("image/jpeg",.88);
       if(data.length>1200000)throw Error("El logotipo comprimido supera el espacio permitido.");
       window.localStorage.setItem(KEY,data);
       updateLogo();status("Logotipo seleccionado para los informes de este equipo.",false);
     }catch(e){status("No se pudo guardar el logotipo: "+(e.message||e),true);}
   };
   img.src=String(reader.result);
 };
 reader.readAsDataURL(file);
}
function card(label,value,detail){
 return '<div class="nr-kpi"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(detail||"")+'</small></div>';
}
function table(headers,rows,extra){
 return '<table class="nr-table '+esc(extra||"")+'"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join("")+
   '</tr></thead><tbody>'+rows.join("")+'</tbody></table>';
}
function bars(careers,key){
 if(!careers.length)return '<p class="nr-muted">Sin carreras disponibles.</p>';
 return '<div class="nr-bars">'+careers.map(function(c){
   var val=c[key],width=val===null?0:Math.max(0,Math.min(100,val*10));
   return '<div class="nr-bar-row"><div class="nr-bar-name">'+esc(c.career)+'</div>'+
     '<div class="nr-bar-track"><div class="nr-bar-fill" style="width:'+width+'%"></div></div>'+
     '<div class="nr-bar-number">'+f(val)+'</div><div class="nr-bar-count">n='+c.count+'</div></div>';
 }).join("")+'</div>';
}
function hist(distribution){
 var max=distribution.reduce(function(m,x){return Math.max(m,x.count);},0);
 return '<div class="nr-hist">'+distribution.map(function(x){
   return '<div class="nr-hist-row"><span>'+esc(x.label)+'</span><div class="nr-hist-track">'+
     '<div class="nr-hist-fill" style="width:'+(max?x.count/max*100:0)+'%"></div></div><b>'+x.count+'</b></div>';
 }).join("")+'</div>';
}
function findings(report){
 var available=report.careers.filter(function(c){return c.count>0;});
 var top=function(field,desc){
   var order=available.slice().sort(function(a,b){return b[field]-a[field]||a.career.localeCompare(b.career,"es");});
   if(!order.length)return "No existen calificaciones habilitadas para comparar "+desc+".";
   return "El mayor promedio "+desc+" corresponde a "+order[0].career+" ("+f(order[0][field])+"/10, n="+order[0].count+").";
 };
 return [
 "El período reúne "+report.summary.registered+" registros activos de Examen Complexivo en "+
 report.summary.careers+" carreras. Solo "+report.summary.qualified+" cuentan con los nueve requisitos CUMPLE y resultados completos y concordantes.",
 "Se registran "+report.summary.approved+" resultados aprobatorios (nota final ≥ 7/10), "+
 report.summary.pending+" notas ordinarias que requieren supletorio y "+
 report.summary.insufficient+" notas supletorias inferiores a 7/10. Estos estados describen notas, no decisiones definitivas de titulación.",
 top("practical","del componente práctico"),top("theoretical","del componente teórico"),top("final","de la nota final")
 ];
}
function periodLabel(id){
 var select=el("ncomplex-filter-periodo");if(!select)return id;
 var option=select.options&&select.options[select.selectedIndex];
 return option&&txt(option.textContent)||id;
}
function contentPages(report,periodName,date){
 var all=[],summary=report.summary;
 var findingsHtml='<ul class="nr-findings">'+findings(report).map(function(v){return "<li>"+esc(v)+"</li>";}).join("")+"</ul>";
 var exclusions=summary.excluded;
 var summaryContent='<div class="nr-eyebrow">01 / RESUMEN EJECUTIVO</div><h1>Resultados de exámenes complexivos</h1>'+
  '<div class="nr-subtitle">Comparación institucional entre carreras · '+esc(periodName)+'</div>'+
  '<div class="nr-kpis">'+card("Registros activos",summary.registered,"Examen Complexivo")+
  card("Notas habilitadas",summary.qualified,"Requisitos 9/9 y evaluación verificada")+
  card("Aprobados",summary.approved,"Nota final ≥ 7,00")+
  card("A supletorio",summary.pending,"Nota ordinaria inferior a 7,00")+
  card("Promedio teórico",f(summary.theoretical),"Escala sobre 10")+
  card("Promedio práctico",f(summary.practical),"Escala sobre 10")+
  card("Promedio final",f(summary.final),"Ponderación 40/60")+
  card("Expedientes excluidos",summary.registered-summary.qualified,"No entran en promedios")+'</div>'+
  '<h2>Principales hallazgos</h2>'+findingsHtml+
  '<div class="nr-note"><b>Alcance.</b> Fuente: Base Local de Ncomplex; registros activos del período indicado. '+
  'Los promedios incluyen únicamente expedientes con 9/9 requisitos en CUMPLE, notas guardadas y concordancia entre componentes y resultado oficial. '+
  'Se preserva la separación entre evaluación ordinaria y supletoria. Este documento no sustituye un acta de titulación.</div>';
 all.push({title:"Resumen ejecutivo",body:summaryContent});
 var comparison=chunks(report.careers,22);
 comparison.forEach(function(group,i){
   var rows=group.map(function(c){
     return '<tr><td>'+esc(c.career)+'</td><td class="nr-num">'+c.registered+'</td>'+
       '<td class="nr-num">'+c.count+'</td><td class="nr-num">'+f(c.theoretical)+'</td>'+
       '<td class="nr-num">'+f(c.practical)+'</td><td class="nr-num"><b>'+f(c.final)+'</b></td>'+
       '<td class="nr-num">'+c.approved+'</td><td class="nr-num">'+c.pending+'</td></tr>';
   });
   all.push({title:"Comparativo general",body:'<div class="nr-eyebrow">02 / COMPARACIÓN ENTRE CARRERAS</div>'+
     '<h1>Resumen por carrera'+(comparison.length>1?' · '+(i+1)+'/'+comparison.length:'')+'</h1>'+
     '<div class="nr-subtitle">Cada promedio se calcula sobre notas oficialmente habilitadas, no sobre la matrícula total.</div>'+
     table(["Carrera","Activos","Válidos","Teórico","Práctico","Final","Aprob.","Suplet."],rows,"nr-compact")+
     '<p class="nr-caption">Activos: estudiantes de Examen Complexivo. Válidos: cumplen 9/9 requisitos y tienen notas oficiales verificadas. '+
     'Suplet.: resultado ordinario inferior a 7,00.</p>'});
 });
 [{key:"practical",name:"práctico",num:"03"},{key:"theoretical",name:"teórico",num:"04"},{key:"final",name:"final",num:"05"}].forEach(function(component){
   chunks(report.careers,21).forEach(function(group,i){
     all.push({title:"Comparativo "+component.name,
       body:'<div class="nr-eyebrow">'+component.num+' / COMPARACIÓN ENTRE CARRERAS</div>'+
       '<h1>Componente '+esc(component.name)+(component.name==="final"?" ponderado":"")+'</h1>'+
       '<div class="nr-subtitle">Promedio por carrera en escala de 0 a 10 · Número de estudiantes habilitados junto a cada barra.</div>'+
       bars(group,component.key)+
       '<p class="nr-caption">Las carreras sin evaluaciones válidas aparecen sin promedio. En el resultado final, el mínimo aprobatorio es 7,00/10.</p>'});
   });
 });
 report.careers.forEach(function(c,index){
   var note=c.count?'Calificaciones verificadas del período.':'Esta carrera no registra calificaciones habilitadas con las reglas de este informe.';
   all.push({title:c.career,body:'<div class="nr-eyebrow">06 / RESULTADOS POR CARRERA · '+(index+1)+' DE '+report.careers.length+'</div>'+
     '<h1>'+esc(c.career)+'</h1><div class="nr-subtitle">'+esc(periodName)+'</div>'+
     '<div class="nr-kpis nr-kpis-three">'+card("Activos",c.registered,"Estudiantes del período")+
       card("Habilitados",c.count,"Requisitos 9/9 y notas válidas")+
       card("Aprobados",c.approved,"Nota final ≥ 7,00")+
       card("Prom. teórico",f(c.theoretical),"40 % de la nota")+
       card("Prom. práctico",f(c.practical),"60 % de la nota")+
       card("Prom. final",f(c.final),"Sobre 10")+'</div>'+
     '<h2>Distribución de notas prácticas</h2>'+hist(c.distributions.practical)+
     '<h2>Distribución de notas teóricas</h2>'+hist(c.distributions.theoretical)+
     '<h2>Distribución de notas finales</h2>'+hist(c.distributions.final)+
     '<p class="nr-caption">'+esc(note)+' Se utiliza distribución por rangos para mantener legible el gráfico, incluso con cohortes numerosas.</p>'});
   var pieces=chunks(c.rows,21);
   pieces.forEach(function(piece,j){
     all.push({title:"Estudiantes · "+c.career,body:
       '<div class="nr-eyebrow">07 / LISTADO INDIVIDUAL</div>'+
       '<h1>'+esc(c.career)+'</h1>'+
       '<div class="nr-subtitle">Estudiantes con los nueve requisitos completos · '+(j+1)+'/'+pieces.length+
       ' · '+esc(periodName)+'</div>'+
       table(["#","Estudiante","Cédula","Teórico","Práctico","Final","Oportunidad / resultado"],
         piece.map(function(row,k){
           return '<tr><td class="nr-num">'+(j*21+k+1)+'</td><td>'+esc(row.name)+'</td>'+
            '<td>'+esc(row.cedula)+'</td><td class="nr-num">'+f(row.teorico)+'</td>'+
            '<td class="nr-num">'+f(row.practico)+'</td><td class="nr-num"><b>'+f(row.final)+'</b></td>'+
            '<td>'+esc(row.opportunity==="SUPLETORIO"?"Supletorio":"Ordinaria")+' · '+esc(row.status)+'</td></tr>';
         }),"nr-detail")+
       '<p class="nr-caption">Teórico y práctico en escala de 0 a 10; resultado final = 0,40 × teórico + 0,60 × práctico.</p>'});
   });
 });
 var incidentRows=report.careers.map(function(c){
   return '<tr><td>'+esc(c.career)+'</td><td class="nr-num">'+c.excluded.requisitos+'</td>'+
   '<td class="nr-num">'+c.excluded.sinNotas+'</td><td class="nr-num">'+c.excluded.incidencia+'</td>'+
   '<td class="nr-num">'+c.excluded.duplicados+'</td></tr>';
 });
 chunks(incidentRows,23).forEach(function(lines,i){
   all.push({title:"Control de integridad",body:'<div class="nr-eyebrow">08 / AUDITORÍA DE DATOS</div>'+
    '<h1>Expedientes excluidos'+(i?' · continuación':'')+'</h1>'+
    '<div class="nr-subtitle">No se incorporan a gráficos, promedios ni listados académicos habilitados.</div>'+
    table(["Carrera","Req. pendientes","Sin notas","Discordancias","Duplicados"],lines,"nr-compact")+
    '<p class="nr-caption">Los recuentos reflejan estudiantes activos que no pasan el control de elegibilidad o consistencia. '+
    'Ninguna nota fue modificada por este informe.</p>'});
 });
 all.push({title:"Metodología",body:'<div class="nr-eyebrow">09 / METODOLOGÍA Y TRAZABILIDAD</div>'+
   '<h1>Criterios de elaboración</h1><ol class="nr-method">'+[
    'Cohorte: estudiantes activos del período seleccionado cuya modalidad de titulación es Examen Complexivo.',
    'Elegibilidad: exactamente nueve requisitos en estado CUMPLE, incluido Titulación, verificados desde Base Local.',
    'Datos: evaluación previamente guardada; no se utilizan valores únicamente editados en pantalla.',
    'Componentes: se normalizan a escala 0–10 antes del cálculo. Teórico 40 % y práctico 60 %.',
    'Resultado: se comprueba la concordancia de la nota oficial y el cálculo ponderado con tolerancia de 0,025.',
    'Oportunidad: ordinaria o supletoria; se conservan separadas. Una nota ordinaria inferior a 7,00 corresponde a supletorio pendiente, no a reprobación definitiva.',
    'Promedios por carrera: medias aritméticas de los estudiantes válidos (no de todas las matrículas).',
    'Casos excluidos: requisitos pendientes, calificaciones incompletas, contradicciones o identidad duplicada. Se reportan agregados sin identificar nominalmente a excluidos.',
    'Documento informativo y auditable: no genera folios oficiales ni modifica notas, requisitos o datos en Firebase.'
   ].map(function(v){return '<li>'+esc(v)+'</li>';}).join("")+'</ol>'+
   '<div class="nr-note">Fecha de generación: '+esc(date)+'. Origen: Ncomplex / BDLocal. '+
   'Antes de emitir un acta oficial debe verificarse nuevamente el expediente y la integridad de Firebase.</div>'});
 return all;
}
function pageHtml(content,number,count,meta,sourceLogo){
 return '<section class="nr-pdf-page">'+
   '<header class="nr-header"><div class="nr-logo"><img src="'+esc(sourceLogo)+'" alt="Logotipo institucional"></div>'+
   '<div class="nr-head-copy"><span>ITSQMET · QUITO METROPOLITANO</span>'+
   '<strong>UNIDAD DE TITULACIÓN Y EFICIENCIA TERMINAL</strong>'+
   '<small>INFORME INSTITUCIONAL DE EXÁMENES COMPLEXIVOS</small></div></header>'+
   '<main class="nr-page-main">'+content.body+'</main>'+
   '<footer class="nr-footer"><span>'+esc(meta.period)+' · '+esc(meta.date)+' · Fuente: BDLocal / Ncomplex</span>'+
   '<span>Página '+number+' de '+count+'</span></footer></section>';
}
function loadEngine(){
 if(typeof window.html2pdf==="function")return Promise.resolve(window.html2pdf);
 if(engineTask)return engineTask;
 engineTask=new Promise(function(resolve,reject){
   var script=document.createElement("script");
   script.src="../node_modules/html2pdf.js/dist/html2pdf.bundle.min.js";
   script.onload=function(){typeof window.html2pdf==="function"?resolve(window.html2pdf):reject(Error("La biblioteca PDF no se inicializó."));};
   script.onerror=function(){reject(Error("No se encuentra html2pdf.js en la instalación. Ejecute npm install antes de exportar."));};
   (document.head||document.documentElement).appendChild(script);
 }).catch(function(error){engineTask=null;throw error;});
 return engineTask;
}
function afterPaint(){return new Promise(function(resolve){window.requestAnimationFrame(function(){window.requestAnimationFrame(resolve);});});}
async function renderPDF(report,meta){
 var engine=await loadEngine(),chunksHtml=contentPages(report,meta.period,meta.date);
 if(!chunksHtml.length)throw Error("No se pudieron construir las páginas.");
 var host=document.createElement("div");host.id="ncomplex-report-render-host";
 document.body.appendChild(host);var pdf=null;
 var options={margin:0,image:{type:"jpeg",quality:.96},
   html2canvas:{scale:1.45,useCORS:true,allowTaint:false,backgroundColor:"#ffffff",logging:false,scrollX:0,scrollY:0,windowWidth:794,windowHeight:1120},
   jsPDF:{unit:"mm",format:"a4",orientation:"portrait",compress:true}};
 try{
   for(var i=0;i<chunksHtml.length;i++){
     host.innerHTML=pageHtml(chunksHtml[i],i+1,chunksHtml.length,meta,logo());
     var element=host.firstElementChild;if(!element)throw Error("No se pudo preparar la página "+(i+1));
     await new Promise(function(resolve,reject){
       var images=Array.prototype.slice.call(element.querySelectorAll("img")||[]);
       if(!images.length){resolve();return;}
       Promise.all(images.map(function(img){
         return new Promise(function(done){
           if(img.complete){done();return;}
           img.addEventListener("load",done,{once:true});
           img.addEventListener("error",done,{once:true});
         });
       })).then(resolve,reject);
     });
     await afterPaint();
     var main=element.querySelector(".nr-page-main");
     if(main&&main.scrollHeight>main.clientHeight+3)
       throw Error("La página "+(i+1)+" supera el espacio de impresión; no se generará un PDF con contenido cortado.");
     if(i===0){
       pdf=await engine().set(options).from(element).toPdf().get("pdf");
       if(pdf.internal&&typeof pdf.internal.getNumberOfPages==="function"&&pdf.internal.getNumberOfPages()!==1)
         throw Error("La primera página se desbordó. Revise la maquetación institucional.");
     }else{
       var canvas=await engine().set(options).from(element).toCanvas().get("canvas");
       pdf.addPage("a4","portrait");
       pdf.addImage(canvas.toDataURL("image/jpeg",.94),"JPEG",0,0,210,297);
       canvas.width=1;canvas.height=1;
     }
     status("Preparando informe PDF: "+(i+1)+" / "+chunksHtml.length+" páginas…",false);
   }
   var filename="Informe_Complexivos_"+slug(report.summary.periodId)+"_"+new Date().toISOString().slice(0,10)+".pdf";
   await Promise.resolve(pdf.save(filename));
   return {pages:chunksHtml.length,filename:filename};
 }finally{
   if(host.parentNode)host.parentNode.removeChild(host);
 }
}
async function exportReport(){
 if(busy)return;
 var state=window.NcomplexState&&window.NcomplexState.get?window.NcomplexState.get():{};
 var pid=txt(state.selectedPeriodId);
 if(!pid){status("Seleccione un período antes de generar el informe.",true);return;}
 if(Object.keys(state.dirty||{}).length){status("Guarde o descarte los cambios de notas antes de generar el informe.",true);return;}
 var connector=window.ConNcomplex;
 if(!connector||typeof connector.listStudents!=="function"){status("El conector de Base Local no está disponible.",true);return;}
 busy=true;refresh();
 try{
   status("Consultando la cohorte completa y los nueve requisitos...",false);
   var rows=await connector.listStudents({periodoId:pid,estadoMatricula:"ACTIVO"});
   if(!Array.isArray(rows))throw Error("Base Local no devolvió la cohorte completa.");
   var report=window.NcomplexReportModel.build(rows,pid);
   if(!report.summary.qualified)throw Error("No hay notas habilitadas para este período. Verifique los nueve requisitos, calificaciones y el guardado.");
   var meta={period:periodLabel(pid),date:new Date().toLocaleString("es-EC",{dateStyle:"long",timeStyle:"short"})};
   var created=await renderPDF(report,meta);
   status("Informe institucional generado: "+created.pages+" páginas · "+report.summary.qualified+" estudiantes habilitados.",false);
 }catch(error){
   console.error("[NcomplexReportPDF]",error);
   status("No se pudo generar el informe: "+txt(error.message||error),true);
 }finally{busy=false;refresh();}
}
function bind(){
 var action=el("ncomplex-report-export");
 if(action&&!action.dataset.reportReady){action.dataset.reportReady="1";action.addEventListener("click",exportReport);}
 var browse=el("ncomplex-report-logo-browse"),input=el("ncomplex-report-logo-file");
 if(browse&&input&&!browse.dataset.reportReady){
   browse.dataset.reportReady="1";browse.addEventListener("click",function(){input.click();});
   input.addEventListener("change",loadLogo);
 }
 var reset=el("ncomplex-report-logo-reset");
 if(reset&&!reset.dataset.reportReady){reset.dataset.reportReady="1";reset.addEventListener("click",function(){
   try{window.localStorage.removeItem(KEY);updateLogo();status("Se restauró el logotipo institucional predeterminado.",false);}
   catch(e){status("No fue posible restaurar el logo: "+txt(e.message||e),true);}
 });}
 updateLogo();refresh();
}
window.NcomplexReportPDF=Object.freeze({bind:bind,refresh:refresh,exportReport:exportReport,renderPDF:renderPDF,contentPages:contentPages,pageHtml:pageHtml});
})(window,document);
