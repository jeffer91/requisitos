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
 var left=25.4,right=184.6,width=159.2,y=35,figure=0;
 function setFont(style,size,color){
  doc.setFont("helvetica",style||"normal");doc.setFontSize(size||11);
  doc.setTextColor.apply(doc,color||[35,47,61]);
 }
 function page(){
  doc.addPage();y=34;
  doc.setDrawColor(170,184,202);doc.setLineWidth(.2);
  doc.line(left,19,right,19);
  setFont("normal",8,[82,95,112]);
  doc.text("ITSQMET · UTET | Informe Final del Proceso de Titulación",left,16);
  doc.text("BORRADOR",right,16,{align:"right"});
 }
 function space(h){if(y+h>268)page();}
 function write(text,options){
  options=options||{};
  var s=display(text);
  if(!s.trim())return;
  var fontSize=options.fontSize||11,leading=options.leading||7.6,gap=options.gap===undefined?3:options.gap;
  var x=left+(options.indent||0),available=width-(options.indent||0);
  setFont(options.style||"normal",fontSize,options.color||[35,47,61]);
  var lines=doc.splitTextToSize(s,available);
  lines.forEach(function(line){
   space(leading);setFont(options.style||"normal",fontSize,options.color||[35,47,61]);
   doc.text(line,x,y);y+=leading;
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
   write(paragraph.join(" "),{indent:0});paragraph=[];
  }
  String(raw||"").replace(/\r\n?/g,"\n").split("\n").forEach(function(line){
   var t=line.trim();
   if(!t){flush();return;}
   var sub=t.match(/^#{3,6}\s+(.+)$/);
   if(sub){flush();heading(sub[1],4);return;}
   if(/^\*\*[^*]+\*\*$/.test(t)){flush();write(t.slice(2,-2),{style:"bold",gap:3});return;}
   if(/^(?:[-*]\s+|\d+\.\s+)/.test(t)){flush();write("• "+t.replace(/^(?:[-*]\s+|\d+\.\s+)/,""),{indent:4,leading:6.7,gap:1});return;}
   paragraph.push(t);
  });
  flush();
 }
 function cover(){
  doc.setDrawColor(0);doc.setLineWidth(.22);
  doc.rect(15,15,180,33);doc.line(63,15,63,48);doc.line(158,15,158,48);
  doc.line(158,28,195,28);doc.line(15,36,195,36);
  if(logoImage){
   var maxW=41,maxH=17,ratio=logoImage.w/logoImage.h;
   var w=Math.min(maxW,maxH*ratio),h=w/ratio;
   doc.addImage(logoImage.data,"PNG",18+(maxW-w)/2,18+(maxH-h)/2,w,h);
  }else{
   setFont("bold",12);doc.text("ITSQMET",39,27,{align:"center"});
  }
  setFont("normal",9);doc.text("Unidad de Titulación y",110.5,25,{align:"center"});
  doc.text("Eficiencia Terminal",110.5,31,{align:"center"});
  setFont("normal",8);
  doc.text("Código: pendiente de aprobación",176.5,24,{align:"center",maxWidth:33});
  doc.text("Versión: borrador",176.5,33,{align:"center"});
  var today=new Date(),date=("0"+today.getDate()).slice(-2)+"/"+("0"+(today.getMonth()+1)).slice(-2)+"/"+today.getFullYear();
  doc.text("Fecha: "+date,39,42,{align:"center",maxWidth:45});
  setFont("bold",8);doc.text("Informe Final del Proceso de Titulación",110.5,42,{align:"center",maxWidth:89});
  /* Número total de páginas insertado tras la composición final. */
  setFont("bold",18);doc.text(["INFORME FINAL DEL","PROCESO DE TITULACIÓN"],105,113,{align:"center"});
  setFont("normal",13);doc.text(period,105,134,{align:"center",maxWidth:169});
  setFont("bold",12,[140,38,38]);doc.text("BORRADOR DE AVANCE - NO LEGALIZADO",105,148,{align:"center"});
  setFont("normal",10);doc.text("Contiene textos genéricos y cronogramas editables.",105,157,{align:"center"});
  doc.text("No incluye resultados académicos todavía no verificados.",105,164,{align:"center"});
  doc.setDrawColor(0);doc.rect(15,224,180,43);
  doc.line(75,224,75,267);doc.line(135,224,135,267);doc.line(15,248,195,248);doc.line(15,256,195,256);
  var roles=[
   ["ELABORADO POR","Mgs. Jefferson Villarreal","Coordinador de Titulación y Eficiencia Terminal"],
   ["REVISADO POR","Ing. Martha Tomalá","Coordinadora General de Carreras"],
   ["APROBADO POR","Dr. Alex León","Vicerrector"]
  ];
  roles.forEach(function(item,i){
   var x=15+i*60;
   setFont("bold",8);doc.text(item[0],x+30,230,{align:"center"});
   setFont("normal",7.7);doc.text("NOMBRE: "+item[1],x+2,253,{maxWidth:57});
   doc.text("CARGO:",x+2,260);
   var ls=doc.splitTextToSize(item[2],46);
   doc.text(ls.slice(0,2),x+11,259.7);
  });
 }
 function figTitle(title){
  figure++;
  write("Figura "+figure,{fontSize:10,style:"bold",leading:5.6,gap:1});
  write(title,{fontSize:10,style:"italic",leading:5.6,gap:4});
 }
 function bubble(x,cY,n,rgb){
  doc.setFillColor.apply(doc,rgb);doc.setDrawColor(80,111,140);
  doc.circle(x,cY,10,"FD");
  setFont("bold",9);doc.text("N"+n,x,cY+2.5,{align:"center"});
 }
 function diagram(c){
  space(154);figTitle("Organización de los cuatro núcleos: "+c.career);
  space(142);var top=y+4,cx=105,cy=top+49;
  doc.setDrawColor(145,158,173);doc.setLineDashPattern([2,2],0);
  [[cx,cy-12,cx,cy-28],[cx+23,cy,cx+37,cy],[cx,cy+12,cx,cy+28],[cx-23,cy,cx-37,cy]].forEach(function(v){doc.line.apply(doc,v);});
  doc.setLineDashPattern([],0);
  bubble(cx,cy-38,1,[217,233,249]);bubble(cx+48,cy,2,[210,239,229]);
  bubble(cx,cy+38,3,[255,235,199]);bubble(cx-48,cy,4,[231,217,245]);
  doc.setFillColor(44,65,87);doc.roundedRect(cx-23,cy-12,46,24,3,3,"F");
  setFont("bold",8,[255,255,255]);
  var title=doc.splitTextToSize(c.career.toUpperCase(),43).slice(0,3);
  doc.text(title,cx,cy-1.5-(title.length-1)*2,{align:"center",lineHeightFactor:1.15});
  setFont("normal",7,[255,255,255]);doc.text("4 núcleos",cx,cy+9,{align:"center"});
  var vY=top+96;
  c.nuclei.forEach(function(n){
    setFont("bold",8.5,[37,53,72]);doc.text("Núcleo "+n.number+":",left+1,vY);
    var lines=doc.splitTextToSize(n.name,121);
    setFont("normal",8.5);doc.text(lines,left+26,vY);vY+=Math.max(9,lines.length*4.3);
  });
  y=Math.max(vY+4,top+136);
  write("Nota. Esquema académico de repaso basado en los cuatro núcleos descritos para la carrera; no representa calificaciones.",{fontSize:8,leading:5,gap:4});
 }
 function scheduleTable(name,rows){
  space(32);heading("Cronograma de "+name+" · "+period,2);
  if(!rows.length){write("No se ha registrado un cronograma para esta modalidad y período.",{style:"italic"});return;}
  write("Tabla. Actividades programadas por la unidad responsable; el estado exige evidencia de cumplimiento.",{fontSize:9,leading:5,gap:3});
  function header(){
   space(11);doc.setFillColor(232,237,246);doc.rect(left,y-5,width,9,"F");
   setFont("bold",8);doc.text("Actividad",left+2,y);doc.text("Inicio",left+106,y);doc.text("Fin",left+129,y);
   doc.text("Estado",left+150,y);y+=7;
  }
  header();
  rows.forEach(function(r){
   var label=(r.phase?r.phase+" · ":"")+r.activity;
   var lines=doc.splitTextToSize(label,101);
   var h=Math.max(9,lines.length*4.4+3);
   if(y+h>264){page();header();}
   setFont("normal",8);doc.text(lines,left+2,y);
   doc.text(txt(r.start),left+106,y);doc.text(txt(r.end),left+129,y);
   var status=r.status==="EJECUTADO"?"Ejecutada":r.status==="PENDIENTE"?"Pendiente":
       r.status==="REPROGRAMADO"?"Reprogram.":r.status==="NO_EJECUTADO"?"No ejecut.":"Sin verificar";
   doc.text(status,left+150,y,{maxWidth:18});
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
 write("Estado del documento: BORRADOR PARCIAL. Únicamente se incorporan los capítulos y apartados con texto cargado en Inf. No incluye resultados académicos que no estén verificados.",{fontSize:9.5,leading:6});
 if(report.excludedChapters&&report.excludedChapters.length){
   write("Capítulos aún no incorporados: "+report.excludedChapters.map(function(c){return c.number+". "+c.title;}).join("; ")+".",{fontSize:9,leading:6,style:"italic"});
 }
 report.chapters.forEach(function(c){chapter(c,1);});
 var total=doc.internal.getNumberOfPages();
 for(var n=1;n<=total;n++){
  doc.setPage(n);
  setFont("normal",8,[80,92,111]);
  doc.text("Página "+n+" de "+total,n===1?176:right,n===1?42:283,{align:"right"});
  if(n>1){
   doc.setDrawColor(191,201,213);doc.line(left,275,right,275);
   doc.text("Borrador de avance · "+period,left,282,{maxWidth:126});
  }
 }
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
