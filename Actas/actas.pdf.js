/* Motor nativo de Actas: PDF A4 con jsPDF; ZIP de PDFs independientes con JSZip. */
(function(w,d){"use strict";
const JSPATHS=["../node_modules/jspdf/dist/jspdf.umd.min.js","../node_modules/html2pdf.js/node_modules/jspdf/dist/jspdf.umd.min.js"];
const ZIPPATHS=["../node_modules/jszip/dist/jszip.min.js"];
let pdfPromise=null,zipPromise=null;
function script(src){return new Promise((resolve,reject)=>{const el=d.createElement("script");el.src=new URL(src,d.baseURI).href;el.onload=resolve;el.onerror=()=>reject(Error("No se pudo cargar "+src));d.head.appendChild(el);});}
async function ensure(paths,test){if(test())return test();let last=null;for(const path of paths){try{await script(path);if(test())return test();}catch(e){last=e;}}throw last||Error("Motor de exportación no disponible.");}
function pdfEngine(){return w.jspdf&&w.jspdf.jsPDF||w.jsPDF||null;}
function zipEngine(){return w.JSZip||null;}
function pdfReady(){return pdfPromise||(pdfPromise=ensure(JSPATHS,pdfEngine).finally(()=>pdfPromise=null));}
function zipReady(){return zipPromise||(zipPromise=ensure(ZIPPATHS,zipEngine).finally(()=>zipPromise=null));}
function txt(v){return String(v==null?"":v).trim();}
function first(s,keys){for(const k of keys)if(s&&txt(s[k]))return txt(s[k]);return "No registrado";}
function formatDate(v){const a=txt(v).slice(0,10).split("-");return a.length===3?a[2]+"/"+a[1]+"/"+a[0]:"No registrada";}
function safe(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,115);}
function studentName(x){return first(x.student,["Nombres","nombres","nombreCompleto","nombre","Nombre"]);}
function studentId(x){return first(x.student,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula"]);}
function career(x){return first(x.student,["NombreCarrera","nombreCarrera","carrera","Carrera"]);}
function label(mode){return mode==="TRABAJO_TITULACION"?"Trabajo de Titulación":"Examen Complexivo";}
function category(mode){return mode==="TRABAJO_TITULACION"?"TRAB":"COMPLEX";}
function filename(x){return "ACTA_"+category(x.mode)+"_"+safe(studentId(x))+"_"+safe(studentName(x))+"_"+safe(x.record.periodId||x.periodLabel)+".pdf";}
function drawLogo(doc,logo,x,y,maxW,maxH){if(!logo||!logo.dataUrl)return;try{const ratio=Math.max(.01,logo.width/logo.height),width=Math.min(maxW,maxH*ratio),height=width/ratio;doc.addImage(logo.dataUrl,logo.format||"PNG",x+(maxW-width)/2,y+(maxH-height)/2,width,height);}catch(err){throw Error("No se pudo incrustar el logo: "+err.message);}}
/* Portada ACT v1.1: A4, márgenes 15 mm; encabezado 180 mm (52/76/52), tres filas (11,5/7,5/11). */
function header(doc,x,logo){
 const left=15,top=15,w=180,cols=[52,76,52],rows=[11.5,7.5,11],middle=105,right=169;
 doc.setDrawColor(0,0,0);doc.setLineWidth(.20);doc.rect(left,top,w,30);
 doc.setLineWidth(.18);
 doc.line(67,top,67,45);doc.line(143,top,143,45);
 doc.line(143,26.5,195,26.5);doc.line(left,34,195,34);
 drawLogo(doc,logo,19,17,44,15);
 doc.setFont("helvetica","bold");doc.setFontSize(9);
 doc.text("UNIDAD DE TITULACIÓN Y",middle,23.2,{align:"center"});
 doc.text("EFICIENCIA TERMINAL",middle,27.6,{align:"center"});
 doc.setFontSize(8.3);doc.text("Código:",right,18.9,{align:"center"});
 doc.setFont("helvetica","normal");doc.setFontSize(8);
 const codeLines=doc.splitTextToSize(txt(x.record&&x.record.codigo),48);
 if(codeLines.length>2)throw Error("El código documental no cabe en el encabezado ACT.");
 doc.text(codeLines,right,22.3,{align:"center"});
 doc.setFontSize(8.5);doc.text("Versión: 1.0",right,31.2,{align:"center"});
 doc.setFontSize(8);doc.text("Fecha de emisión: "+formatDate(x.issue),41,40.2,{align:"center",maxWidth:48});
 doc.setFont("helvetica","bold");doc.setFontSize(8.5);
 const typeTitle=x.mode==="TRABAJO_TITULACION"?"ACTA DE TITULACIÓN POR TRABAJO DE TITULACIÓN":"ACTA DE TITULACIÓN POR EXAMEN COMPLEXIVO";
 const lines=doc.splitTextToSize(typeTitle,72);
 if(lines.length>2)throw Error("El título del acta no cabe en la celda B3.");
 doc.text(lines,middle,lines.length===1?40.3:38.8,{align:"center"});
 /* La paginación de C3 se dibuja después de conocer el total de páginas. */
}
function footer(doc,x,start,end){
 for(let i=start;i<=end;i++){
  doc.setPage(i);
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);
  doc.text("Página "+(i-start+1)+" de "+(end-start+1),169,40.2,{align:"center"});
  doc.setDrawColor(70,70,70);doc.setLineWidth(.18);doc.line(15,277.5,195,277.5);
  doc.setFontSize(8);
  doc.text("Borrador para revisión y legalización · "+txt(x.record.codigo),15,281.3,{maxWidth:178});
 }
}
function signatures(doc){
 const data=[
  {title:"ELABORADO POR:",name:"MSc, Jefferson Villarreal",job:"Coordinador de Titulación y Eficiencia Terminal"},
  {title:"REVISADO POR:",name:"Ing. Martha Tomalá",job:"Coordinadora General de Carreras"},
  {title:"APROBADO POR:",name:"Dr. Alex León T.",job:"Vicerrector"}
 ];
 const x=15,y=225,w=180,h=42,col=60,row1=24,row2=7.5;
 doc.setDrawColor(0,0,0);doc.setLineWidth(.20);doc.rect(x,y,w,h);
 doc.setLineWidth(.18);
 doc.line(75,y,75,y+h);doc.line(135,y,135,y+h);
 doc.line(x,y+row1,x+w,y+row1);doc.line(x,y+row1+row2,x+w,y+row1+row2);
 data.forEach((f,i)=>{
  const bx=x+i*col;
  doc.setFont("helvetica","normal");doc.setFontSize(8.5);
  doc.text(f.title,bx+col/2,y+4.6,{align:"center"});
  doc.setFont("helvetica","bold");doc.setFontSize(8);
  doc.text("NOMBRE:",bx+1.5,y+row1+4.8);
  doc.setFont("helvetica","normal");
  doc.text(f.name,bx+17.3,y+row1+4.8,{maxWidth:40.9});
  doc.setFont("helvetica","bold");doc.text("CARGO:",bx+1.5,y+row1+row2+4.1);
  doc.setFont("helvetica","normal");
  const jobLines=doc.splitTextToSize(f.job,46.5);
  if(jobLines.length>2)throw Error("El cargo de "+f.name+" excede la celda de firma.");
  doc.text(jobLines,bx+12,y+row1+row2+4.1);
 });
}
function center(doc,value,y,size,bold){doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);const lines=doc.splitTextToSize(value,165);doc.text(lines,105,y,{align:"center"});return y+lines.length*size*.45;}
function nextPage(doc,x,logo,pos){doc.addPage();header(doc,x,logo);pos.y=58;}
function lines(doc,x,logo,value,pos,opts){opts=opts||{};const size=opts.size||9,step=size*.48;doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);
const result=doc.splitTextToSize(txt(value),174);for(const line of result){if(pos.y+step>273){nextPage(doc,x,logo,pos);doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);}doc.text(line,18,pos.y);pos.y+=step;}pos.y+=opts.after===undefined?3:opts.after;}
function section(doc,x,logo,title,pos){lines(doc,x,logo,title,pos,{bold:true,size:10.5,after:1.7});}
function pair(doc,x,logo,key,value,pos){if(pos.y+12>273)nextPage(doc,x,logo,pos);doc.setDrawColor(188,197,206);doc.rect(18,pos.y,174,11);doc.setFillColor(241,245,249);doc.rect(18,pos.y,46,11,"F");doc.setFontSize(8);doc.setFont("helvetica","bold");doc.text(key,20,pos.y+6.2,{maxWidth:42});doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(txt(value),121).slice(0,2),67,pos.y+4.5);pos.y+=11;}
function milestones(x){const ids=x.mode==="TRABAJO_TITULACION"?["induccion","tema","entrega","defensa","cierre"]:["nucleo1","nucleo4","examen","supletorio"];return (x.schedule||[]).flatMap(g=>g.actividades||[]).filter(a=>ids.includes(a.id)&&(a.inicio||a.fin));}
function timeline(doc,x,logo,rows,pos){if(!rows.length){lines(doc,x,logo,"Cronograma sin fechas registradas.",pos,{size:8.5});return;}for(const a of rows){if(pos.y+11>273)nextPage(doc,x,logo,pos);doc.setDrawColor(196,203,214);doc.rect(18,pos.y,174,10);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text(doc.splitTextToSize(txt(a.nombre),91).slice(0,2),20,pos.y+4.2);doc.text(formatDate(a.inicio),116,pos.y+6);doc.text(formatDate(a.fin),157,pos.y+6);pos.y+=10;}pos.y+=3;}
/* Cuerpo documental: fuentes verificadas (BDLocal + Ncomplex). No modifica la portada. */
function academicEvidence(x){
 const proof=x&&x.evidence||w.ActasEvidence.assess({student:x.student,mode:x.mode,requirementValues:x.requirementValues||{},evaluation:x.evaluation});
 /* El borrador puede emitirse con las dos aprobaciones finales, aun cuando falten evidencias. El estado se refleja en el cuerpo. */
 return proof;
}
function dataRow(doc,x,logo,left,right,pos,opts){
 opts=opts||{};const widthLeft=opts.widthLeft||132;
 doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(8.5);
 const leftLines=doc.splitTextToSize(txt(left),widthLeft);
 const rightLines=doc.splitTextToSize(txt(right),37);
 const h=Math.max(7.5,Math.max(leftLines.length,rightLines.length)*4+2.5);
 if(pos.y+h>274)nextPage(doc,x,logo,pos);
 doc.setDrawColor(120,120,120);doc.setLineWidth(.12);doc.rect(18,pos.y,174,h);
 doc.line(18+widthLeft+3,pos.y,18+widthLeft+3,pos.y+h);
 doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(8.5);
 doc.text(leftLines,20,pos.y+4.4);
 doc.text(rightLines,21+widthLeft+3,pos.y+4.4);
 pos.y+=h;
}
function heading(doc,x,logo,t,pos){if(pos.y+12>274)nextPage(doc,x,logo,pos);section(doc,x,logo,t,pos);}
function paint(doc,x,logo){if(doc.getNumberOfPages()>1||doc.__actasCount){doc.addPage();}const start=doc.getNumberOfPages();doc.__actasCount=(doc.__actasCount||0)+1;
header(doc,x,logo);
let y=center(doc,"ACTA DE TITULACIÓN POR "+(x.mode==="TRABAJO_TITULACION"?"TRABAJO DE TITULACIÓN":"EXAMEN COMPLEXIVO"),126,23,true);
center(doc,"Período académico: "+txt(x.periodLabel),y+13,23,true);
signatures(doc);
doc.addPage();header(doc,x,logo);const pos={y:54};
const proof=academicEvidence(x);
heading(doc,x,logo,"CONSTANCIA DE CULMINACIÓN Y TITULACIÓN",pos);
pair(doc,x,logo,"Estudiante",studentName(x),pos);
pair(doc,x,logo,"Cédula",studentId(x),pos);
pair(doc,x,logo,"Carrera",career(x),pos);
pair(doc,x,logo,"Modalidad",label(x.mode),pos);
pos.y+=2;
heading(doc,x,logo,"1. Culminación de la malla curricular",pos);
lines(doc,x,logo,proof.mallaText,pos,{size:9,after:3});
dataRow(doc,x,logo,"Requisito Académico",proof.academicStatus,pos,{bold:true});
pos.y+=4;
heading(doc,x,logo,"2. Verificación de requisitos institucionales",pos);
lines(doc,x,logo,"Constan los siguientes ocho requisitos previos consultados en Base Local para el estudiante y el período académico:",pos,{size:8.5,after:2});
proof.requirements.forEach((r,i)=>dataRow(doc,x,logo,(i+1)+". "+r.label,r.status,pos));
pos.y+=4;
heading(doc,x,logo,x.mode==="TRABAJO_TITULACION"?"3. Cumplimiento del componente de titulación":"3. Núcleos formativos y requisito de Titulación",pos);
lines(doc,x,logo,proof.nucleiText,pos,{size:8.8,after:2});
dataRow(doc,x,logo,"Requisito Titulación",proof.titulationStatus,pos,{bold:true});
pos.y+=4;
heading(doc,x,logo,x.mode==="TRABAJO_TITULACION"?"4. Evaluación del trabajo de titulación":"4. Resultado del examen complexivo",pos);
lines(doc,x,logo,"Fuente: Ncomplex, registro individual de evaluación. Oportunidad aplicada: "+proof.evaluation.opportunity+".",pos,{size:8.5,after:2});
proof.evaluation.rows.forEach((r,i)=>dataRow(doc,x,logo,r.label,r.value,pos,{bold:i===2||i===4}));
pos.y+=4;
heading(doc,x,logo,"5. Constancia de culminación y aprobación",pos);
lines(doc,x,logo,"Controles finales: Aprobación de titulación = "+proof.finalTitleStatus+"; Aprobación complexivo/proyecto = "+proof.finalResultStatus+".",pos,{size:8.7,after:2});
lines(doc,x,logo,proof.closureText,pos,{size:9,after:3});
lines(doc,x,logo,"RESULTADO FINAL: "+(proof.eligible?"APROBADO":"PENDIENTE DE VALIDACIÓN"),pos,{size:12,bold:true,after:3});
lines(doc,x,logo,"Esta acta es un borrador sujeto a cotejo con las evidencias oficiales, revisión institucional y firmas autorizadas. Se conservará en el expediente de titulación una vez legalizada.",pos,{size:8.5});
footer(doc,x,start,doc.getNumberOfPages());}
async function build(items){const list=Array.isArray(items)?items:[items];if(!list.length)throw Error("No hay actas para generar.");const [JsPDF,logo]=await Promise.all([pdfReady(),w.ActasBrand.resolve()]);if(!logo||!logo.dataUrl)throw Error("No se encontró un logo institucional. Usa «Configurar logo» para subirlo.");
const doc=new JsPDF({unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});for(const x of list)paint(doc,x,logo);return doc.output("blob");}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=d.createElement("a");a.href=url;a.download=name;d.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function download(items){const list=Array.isArray(items)?items:[items],blob=await build(list);const name=list.length===1?filename(list[0]):"ACTAS_SELECCIONADAS_"+safe(list[0].record.periodId||list[0].periodLabel)+".pdf";downloadBlob(blob,name);return {ok:true,bytes:blob.size,count:list.length};}
function csvCell(value){let s=txt(value);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(rows){const headers=["Cedula","Estudiante","Carrera","Modalidad","Estado","Motivo","Archivo"];return "\uFEFF"+[headers,...rows.map(r=>[r.cedula,r.nombre,r.carrera,r.modalidad,r.estado,r.motivo,r.archivo])].map(row=>row.map(csvCell).join(";")).join("\r\n");}
async function downloadZip(items,summary,periodId,progress){const list=Array.isArray(items)?items:[],JsZip=await zipReady();if(!list.length)throw Error("No existen estudiantes con actas habilitadas en este período.");
const zip=new JsZip(),log=Array.isArray(summary)?summary.map(r=>Object.assign({},r)):[],used=new Set();let done=0,generated=0;for(const item of list){const fullName=category(item.mode)+"/"+filename(item),key=fullName.toLowerCase();let path=fullName,n=2;while(used.has(path.toLowerCase()))path=fullName.replace(/\.pdf$/i,"_"+n+++".pdf");used.add(path.toLowerCase());try{const blob=await build(item);zip.file(path,blob);generated++;const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){const verified=!!(item.evidence&&item.evidence.eligible);row.estado=verified?"INCLUIDO":"BORRADOR_PENDIENTE";row.motivo=verified?"":"Pendiente de validación: "+(item.evidence&&item.evidence.missing||[]).join("; ");row.archivo=path;}}catch(e){const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){row.estado="ERROR";row.motivo=e.message;row.archivo="";}}done++;if(typeof progress==="function")progress({done,total:list.length,generated});}
zip.file("Resumen_exportacion.csv",csv(log));if(!generated)throw Error("No se pudo generar ningún PDF. Revisa el logo y los datos.");
const out=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});downloadBlob(out,"ACTAS_UTET_"+safe(periodId)+".zip");return {ok:true,bytes:out.size,generated,excluded:log.filter(x=>x.estado!=="INCLUIDO"&&x.estado!=="BORRADOR_PENDIENTE").length,drafts:log.filter(x=>x.estado==="BORRADOR_PENDIENTE").length,errors:log.filter(x=>x.estado==="ERROR").length};}
w.ActasPDF=Object.freeze({build,download,downloadZip,filename,category});
})(window,document);
