/* PDF A4 descargable: documento de AVANCE. No certifica notas ni actas oficiales. */
(function(window,document){
"use strict";
var libs=["../node_modules/jspdf/dist/jspdf.umd.min.js","../node_modules/html2pdf.js/node_modules/jspdf/dist/jspdf.umd.min.js"];
function engine(){return window.jspdf&&window.jspdf.jsPDF||window.jsPDF||null;}
function script(src){
 return new Promise(function(resolve,reject){
  var s=document.createElement("script");s.src=new URL(src,document.baseURI).href;
  s.onload=resolve;s.onerror=function(){reject(Error("No se pudo cargar "+src));};
  document.head.appendChild(s);
 });
}
async function ensureLibrary(){
 if(engine())return engine();
 var err=null;for(var i=0;i<libs.length;i++){
  try{await script(libs[i]);if(engine())return engine();}
  catch(e){err=e;}
 }
 throw err||Error("No hay biblioteca PDF local disponible.");
}
function txt(v){return String(v==null?"":v).replace(/\s+/g," ").trim();}
function safe(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,70);}
function display(v){return String(v||"").replace(/\*\*/g,"").replace(/\*/g,"").replace(/\`/g,"").replace(/–|—/g,"-");}
async function logo(){
 return new Promise(function(resolve){
  var image=new Image(),closed=false;
  function done(value){if(!closed){closed=true;resolve(value);}}
  image.onload=function(){
   try{
    var c=document.createElement("canvas");c.width=image.naturalWidth;c.height=image.naturalHeight;
    c.getContext("2d").drawImage(image,0,0);
    done({data:c.toDataURL("image/png"),w:image.naturalWidth,h:image.naturalHeight});
   }catch(e){done(null);}
  };
  image.onerror=function(){done(null);};
  image.src=new URL("../Global/assets/branding/logo-instituto.png",document.baseURI).href;
  if(image.complete&&image.naturalWidth)image.onload();
 });
}
function build(doc,payload,logoImage){
 var report=payload.report,period=payload.schedule.period,calendar=payload.schedule,careers=payload.careers;
 var left=25.4,right=184.6,width=159.2,y=62,figure=0;
 function setFont(style,size,color){
  doc.setFont("helvetica",style||"normal");doc.setFontSize(size||11);
  doc.setTextColor.apply(doc,color||[35,47,61]);
 }
 function page(){doc.addPage();y=62;}
 function space(height){if(y+height>265)page();}
 function write(value,options){
  options=options||{};
  var s=display(value).replace(/\\t/g," ").trim();
  if(!s)return;
  var fontSize=options.fontSize||11,leading=options.leading||7.8,gap=options.gap===undefined?0:options.gap;
  var x=left+(options.indent||0),available=width-(options.indent||0);
  var firstIndent=options.firstLineIndent||0;
  setFont(options.style||"normal",fontSize,options.color||[35,47,61]);
  var lines;
  if(firstIndent){
   var initial=doc.splitTextToSize(s,available-firstIndent);
   var first=initial.shift()||"";
   lines=[{text:first,indent:firstIndent}];
   doc.splitTextToSize(initial.join(" "),available).forEach(function(t){
    lines.push({text:t,indent:0});
   });
  }else lines=doc.splitTextToSize(s,available).map(function(t){return {text:t,indent:0};});
  lines.forEach(function(line){
   space(leading);setFont(options.style||"normal",fontSize,options.color||[35,47,61]);
   doc.text(line.text,x+line.indent,y);y+=leading;
  });
  y+=gap;
 }
 function heading(s,level){
  var font=level<=1?15:level===2?12:10;
  space(level<=1?21:15);y+=level<=1?5:2;
  write(s,{fontSize:font,leading:level<=1?8:6.5,gap:4,style:"bold"});
 }
 function markdown(raw){
  var paragraph=[];
  function flush(){
   if(!paragraph.length)return;
   write(paragraph.join(" "),{firstLineIndent:12.7,leading:7.8,gap:0});
   paragraph=[];
  }
  String(raw||"").replace(/\\r\\n?/g,"\\n").split("\\n").forEach(function(line){
   var t=line.trim();if(!t){flush();return;}
   var sub=t.match(/^#{3,6}\\s+(.+)$/);
   if(sub){flush();heading(sub[1],4);return;}
   if(/^\\*\\*[^*]+\\*\\*$/.test(t)){
    flush();write(t.slice(2,-2),{style:"bold",gap:1});return;
   }
   var bullet=t.match(/^(?:[-*]\\s+|\\d+\\.\\s+)(.+)$/);
   if(bullet){flush();write("• "+bullet[1],{indent:6,leading:7.3,gap:0});return;}
   paragraph.push(t);
  });
  flush();
 }
 function drawHeader(n,total,logoImage){
  doc.setDrawColor(35,48,61);doc.setLineWidth(0.18);
  doc.rect(15,12,180,38);
  doc.line(61,12,61,50);doc.line(158,12,158,50);
  doc.line(15,36,195,36);
  doc.line(158,24,195,24);
  if(logoImage){
   var rw=40,rh=18,ratio=logoImage.w/logoImage.h;
   var w=Math.min(rw,rh*ratio),hh=w/ratio;
   doc.addImage(logoImage.data,"PNG",18+(40-w)/2,15+(18-hh)/2,w,hh);
  }else{setFont("bold",11);doc.text("ITSQMET",38,26,{align:"center"});}
  setFont("bold",9,[34,51,71]);
  doc.text("Unidad de Titulación y",109.5,22,{align:"center"});
  doc.text("Eficiencia Terminal",109.5,28,{align:"center"});
  setFont("normal",7.5);
  doc.text("Código: pendiente",176.5,20,{align:"center"});
  doc.text("de asignación",176.5,23.1,{align:"center"});
  doc.text("Versión: 1",176.5,31,{align:"center"});
  var today=new Date(),stamp=("0"+today.getDate()).slice(-2)+"/"+("0"+(today.getMonth()+1)).slice(-2)+"/"+today.getFullYear();
  setFont("normal",7.6);
  doc.text("Fecha: "+stamp,38,43.8,{align:"center"});
  setFont("bold",8);
  doc.text("Informe Final del Proceso de Titulación",109.5,43.8,{align:"center",maxWidth:92});
  setFont("normal",7.6);
  doc.text("Página "+n+" de "+total,176.5,43.8,{align:"center"});
 }
 function cover(){
  setFont("bold",23,[30,44,62]);
  doc.text("INFORME FINAL DEL",105,108,{align:"center"});
  doc.text("PROCESO DE TITULACIÓN",105,124,{align:"center"});
  doc.text(doc.splitTextToSize(period,165),105,148,{align:"center",lineHeightFactor:1.35});
  var xs=[15,75,135],roles=[
   ["ELABORADO POR","Mgs. Jefferson Villarreal","Coordinador de Titulación y Eficiencia Terminal"],
   ["REVISADO POR","Ing. Martha Tomalá","Coordinadora General de Carreras"],
   ["APROBADO POR","Dr. Alex León","Vicerrector"]
  ];
  doc.setDrawColor(45,55,68);doc.setLineWidth(.2);
  doc.rect(15,213,180,64);
  doc.line(75,213,75,277);doc.line(135,213,135,277);
  doc.line(15,230,195,230);doc.line(15,251,195,251);
  roles.forEach(function(role,i){
   var x=xs[i],mid=x+30;
   setFont("bold",8);doc.text(role[0],mid,220,{align:"center"});
   setFont("normal",8);
   var names=doc.splitTextToSize(role[1],54);
   doc.text(names,mid,238,{align:"center",lineHeightFactor:1.15});
   var jobs=doc.splitTextToSize(role[2],53).slice(0,3);
   doc.text(jobs,mid,260,{align:"center",lineHeightFactor:1.25});
  });
 }
 function figTitle(title){
  figure++;
  write("Figura "+figure,{fontSize:10,style:"bold",leading:5.6,gap:1});
  write(title,{fontSize:10,style:"italic",leading:5.6,gap:4});
 }
 function bubble(x,cy,n,name,fill){
  var radius=24;
  doc.setFillColor.apply(doc,fill);
  doc.setDrawColor(70,113,151);doc.setLineWidth(.4);
  doc.circle(x,cy,radius,"FD");
  setFont("bold",9,[31,53,79]);
  doc.text("Núcleo "+n,x,cy-10,{align:"center"});
  var font=name.length>52?6.1:name.length>38?6.7:7.5;
  setFont("bold",font,[31,53,79]);
  var lines=doc.splitTextToSize(name,41);
  if(lines.length>6){font=5.8;setFont("bold",font,[31,53,79]);lines=doc.splitTextToSize(name,43);}
  doc.text(lines,x,cy-4.2,{align:"center",lineHeightFactor:1.16});
 }
 function diagram(c){
  space(194);
  figTitle("Organización de los cuatro núcleos: "+c.career);
  space(182);
  var top=y+8,cx=105,cy=top+87;
  doc.setDrawColor(145,159,175);doc.setLineDashPattern([2,2],0);
  [[105,top+56,105,cy-17],[145,cy,145+0,cy],[65,cy,cy?84:84,cy],[105,cy+17,105,top+119]].forEach(function(v){
   doc.line(v[0],v[1],v[2],v[3]);
  });
  doc.setLineDashPattern([],0);
  doc.setFillColor(43,65,89);
  doc.roundedRect(80,cy-16,50,32,4,4,"F");
  setFont("bold",8,[255,255,255]);
  doc.text(doc.splitTextToSize(c.career.toUpperCase(),45),105,cy-2,{align:"center",lineHeightFactor:1.15});
  setFont("normal",7.5,[255,255,255]);doc.text("4 núcleos",105,cy+11,{align:"center"});
  var places=[[105,top+30],[168,cy],[105,top+143],[42,cy]];
  var palette=[[218,234,253],[211,243,233],[255,232,194],[236,220,250]];
  c.nuclei.forEach(function(n,i){bubble(places[i][0],places[i][1],n.number,n.name,palette[i]);});
  y=top+173;
  write("Nota. Los cuatro núcleos corresponden a los campos de preparación definidos para la carrera.",{fontSize:8,leading:5,gap:3});
 }
 function methodFigure(key){
  var diagrams={
   "3.1":{title:"Secuencia general del proceso de titulación",steps:["Identificación","Requisitos","Modalidad","Evaluación","Cierre"]},
   "3.2":{title:"Fuentes de información utilizadas",steps:["Estudiantes","Requisitos","Núcleos","Evaluaciones","Evidencias"]},
   "3.3":{title:"Ruta de verificación de requisitos",steps:["Registro","Verificación","Validación","Consolidado","Seguimiento"]},
   "3.4.1":{title:"Finalidad metodológica de los núcleos",steps:["Recuperar","Integrar","Aplicar","Evaluar"]},
   "3.5":{title:"Componentes del examen complexivo",steps:["Teoría 40 %","Práctica 60 %","Resultado final"]},
   "3.6":{title:"Proceso de análisis de resultados",steps:["Depuración","Agrupación","Indicadores","Gráficos","Interpretación"]},
   "3.7":{title:"Planificación y seguimiento del cronograma",steps:["Actividades","Fechas","Ejecución","Evidencias","Informe"]}
  };
  var d=diagrams[key];if(!d)return;
  space(63);
  figTitle(d.title);
  var top=y+5,steps=d.steps,xStep=width/steps.length;
  steps.forEach(function(label,i){
   var x=left+i*xStep+1,w=xStep-3;
   doc.setFillColor(i%2?[224,239,246]:[219,230,247]);
   doc.setDrawColor(133,158,183);
   doc.roundedRect(x,top,w,21,2,2,"FD");
   setFont("bold",8,[34,63,91]);
   doc.text(doc.splitTextToSize(label,w-3),x+w/2,top+10,{align:"center",lineHeightFactor:1.2});
   if(i<steps.length-1){setFont("bold",11);doc.text("›",x+w+1,top+13);}
  });
  y=top+29;
  write("Nota. Representación metodológica; no corresponde a resultados cuantitativos.",{fontSize:8,leading:5,gap:4});
 }
 function scheduleTable(name,rows){
  space(32);heading("Cronograma de "+name+" · "+period,2);
  if(!rows.length){write("No se ha registrado un cronograma para esta modalidad y período.",{style:"italic"});return;}
  write("Tabla. Actividades programadas por la unidad responsable; el estado exige evidencia de cumplimiento.",{fontSize:9,leading:5,gap:3});
  function header(){
   space(11);doc.setFillColor(232,237,246);doc.rect(left,y-5,width,9,"F");
   setFont("bold",8);doc.text("Actividad",left+2,y);doc.text("Fecha de inicio",left+113,y);doc.text("Fecha de fin",left+141,y);y+=7;
  }
  header();
  rows.forEach(function(r){
   var label=(r.phase?r.phase+" · ":"")+r.activity;
   var lines=doc.splitTextToSize(label,108);
   var h=Math.max(9,lines.length*4.4+3);
   if(y+h>264){page();header();}
   setFont("normal",8);doc.text(lines,left+2,y);
   doc.text(txt(r.start),left+113,y);doc.text(txt(r.end),left+141,y);
   doc.setDrawColor(226,230,236);doc.line(left,y+h-3,right,y+h-3);y+=h;
  });
  y+=5;
 }
 function gantt(name,rows){
  if(!rows.length)return;
  var valid=rows.filter(function(r){return window.InfSchedules.day(r.start)!==null&&window.InfSchedules.day(r.end)!==null;});
  if(!valid.length)return;
  var lo=Math.min.apply(null,valid.map(function(r){return window.InfSchedules.day(r.start);}));
  var hi=Math.max.apply(null,valid.map(function(r){return window.InfSchedules.day(r.end);}));
  var span=Math.max(86400000,hi-lo+86400000);
  var widthBars=91,labelWidth=66;
  function x(time){return left+labelWidth+(time-lo)/span*widthBars;}
  for(var i=0;i<valid.length;i+=8){
   var part=valid.slice(i,i+8);
   space(124);figTitle("Diagrama de Gantt — "+name+(valid.length>8?" (bloque "+(Math.floor(i/8)+1)+")":""));
   var top=y+8;
   doc.setDrawColor(195,207,216);doc.line(left+labelWidth,top,right,top);
   var tick=new Date(lo),m=new Date(Date.UTC(tick.getUTCFullYear(),tick.getUTCMonth(),1)),n=0;
   while(m.getTime()<=hi && n<30){
    if(m.getTime()>=lo){
     var px=x(m.getTime());doc.setDrawColor(225,232,238);doc.line(px,top,px,top+part.length*9+6);
     setFont("normal",7.3,[100,112,126]);doc.text(("0"+(m.getUTCMonth()+1)).slice(-2)+"/"+String(m.getUTCFullYear()).slice(-2),px,top-2);
    }
    m=new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,1));n++;
   }
   part.forEach(function(r,j){
    var yy=top+8+j*9;setFont("normal",7.8,[44,60,80]);
    doc.text(r.activity.length>34?r.activity.slice(0,33)+"…":r.activity,left+1,yy,{maxWidth:63});
    var start=window.InfSchedules.day(r.start),end=window.InfSchedules.day(r.end);
    var b=x(start),len=Math.max(1,(end-start+86400000)/span*widthBars);
    doc.setFillColor(78,123,166);
    if(/^Fase 2/.test(r.phase))doc.setFillColor(76,150,130);
    if(/^Fase 3/.test(r.phase))doc.setFillColor(177,132,67);
    doc.roundedRect(b,yy-5,len,4.8,1,1,"F");
   });
   y=top+part.length*9+13;
   write("Nota. Las barras representan intervalos planificados, no acreditan ejecución. Fuente: cronograma del período seleccionado.",{fontSize:8,leading:5,gap:6});
  }
 }
 function chapter(node,level){
  heading(node.number+". "+node.title,level);
  if(node.content)markdown(node.content);
  /* El informe progresivo omite los apartados que todavía no tienen contenido. */
  if(/^3\.4\.4\.\d+$/.test(node.number)){
   var career=careers.find(function(c){return c.section===node.number;});
   if(career)diagram(career);
  }
  methodFigure(node.number);
  if(node.number==="3.7.1"){
   scheduleTable("Examen Complexivo",calendar.complexivo);
   gantt("Examen Complexivo",calendar.complexivo);
  }
  if(node.number==="3.7.2"){
   scheduleTable("Trabajo de Titulación",calendar.trabajo);
   gantt("Trabajo de Titulación",calendar.trabajo);
  }
  node.sections.forEach(function(child){chapter(child,level+1);});
 }
 cover();page();
 heading("Índice general",1);
 report.chapters.forEach(function(c){
  write(c.number+". "+c.title,{fontSize:11,leading:7,gap:2,style:"bold"});
  c.sections.forEach(function(s){write(s.number+". "+s.title,{fontSize:9.5,leading:6,gap:1,indent:5});});
 });
 page();
 write("Período académico: "+period,{style:"bold"});
 /* Los capítulos que aún no están incorporados no aparecen en el PDF. */

 report.chapters.forEach(function(c){chapter(c,1);});
 var total=doc.internal.getNumberOfPages();
 for(var n=1;n<=total;n++){doc.setPage(n);drawHeader(n,total,logoImage);}
 return {pages:total,figures:figure};
}
async function download(payload){
 if(!payload||!payload.report||!payload.schedule||!payload.careers)throw Error("Faltan los datos del borrador.");
 if(!Array.isArray(payload.report.chapters)||!payload.report.chapters.length)
   throw Error("No hay capítulos con contenido para generar el PDF de avance.");
 var errors=window.InfSchedules.validate(payload.schedule);
 if(errors.length)throw Error("Corrige las fechas antes de exportar: "+errors.join("; "));
 var JsPDF=await ensureLibrary();
 var doc=new JsPDF({unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});
 var logoImage=await logo();
 var stats=build(doc,payload,logoImage);
 doc.save("INF_AVANCE_"+safe(payload.schedule.period)+".pdf");
 return stats;
}
window.InfPDF=Object.freeze({download:download,build:build,ensureLibrary:ensureLibrary});
})(window,document);
