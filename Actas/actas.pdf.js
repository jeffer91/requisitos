/* Motor nativo de Actas: PDF Carta en todas las páginas; ZIP de PDFs independientes. */
(function(w,d){"use strict";
const JSPATHS=["../node_modules/jspdf/dist/jspdf.umd.min.js","../node_modules/html2pdf.js/node_modules/jspdf/dist/jspdf.umd.min.js"];
const ZIPPATHS=["../node_modules/jszip/dist/jszip.min.js"];
const LETTER_W=215.9,LETTER_H=279.4,BODY_BOTTOM=266;
const SIGN_BOX=Object.freeze({x:(LETTER_W-180)/2,y:LETTER_H-18-42,width:180,height:42});
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
function studentId(x){const raw=first(x.student,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula"]);const digits=raw.replace(/[^0-9]/g,"");return /^\d{9}$/.test(digits)?"0"+digits:raw;}
function career(x){return first(x.student,["NombreCarrera","nombreCarrera","carrera","Carrera"]);}
function label(mode){return mode==="TRABAJO_TITULACION"?"Trabajo de Titulación":"Examen Complexivo";}
function category(mode){return mode==="TRABAJO_TITULACION"?"TRAB":"COMPLEX";}
function filename(x){return "ACTA_"+category(x.mode)+"_"+safe(studentId(x))+"_"+safe(studentName(x))+"_"+safe(x.record.numeroActa)+"_"+safe(x.record.periodId||x.periodLabel)+".pdf";}
function drawLogo(doc,logo,x,y,maxW,maxH){if(!logo||!logo.dataUrl)return;try{const ratio=Math.max(.01,logo.width/logo.height),width=Math.min(maxW,maxH*ratio),height=width/ratio;doc.addImage(logo.dataUrl,logo.format||"PNG",x+(maxW-width)/2,y+(maxH-height)/2,width,height);}catch(err){throw Error("No se pudo incrustar el logo: "+err.message);}}
/* Encabezado institucional en papel Carta; las firmas solo se dibujan en portada. */
function header(doc,x,logo){
 const left=15,top=15,w=180,cols=[52,76,52],rows=[11.5,7.5,11],middle=105,right=169;
 doc.setDrawColor(0,0,0);doc.setLineWidth(.20);doc.rect(left,top,w,30);
 doc.setLineWidth(.18);
 doc.line(67,top,67,45);doc.line(143,top,143,45);
 doc.line(143,26.5,195,26.5);doc.line(left,34,195,34);
 drawLogo(doc,logo,19,17,44,15);
 doc.setFont("helvetica","normal");doc.setFontSize(9);
 doc.text("Unidad de Titulación y",middle,23.2,{align:"center"});
 doc.text("Eficiencia Terminal",middle,27.6,{align:"center"});
 doc.setFontSize(8.3);doc.text("Código:",right,18.9,{align:"center"});
 doc.setFont("helvetica","normal");doc.setFontSize(8);
 const codeLines=doc.splitTextToSize(txt(x.record&&x.record.codigo),48);
 if(codeLines.length>2)throw Error("El código documental no cabe en el encabezado ACT.");
 doc.text(codeLines,right,22.3,{align:"center"});
 doc.setFontSize(8.5);doc.text("Versión: 1.0",right,31.2,{align:"center"});
 doc.setFontSize(8);doc.text("Fecha de emisión: "+formatDate(x.issue),41,40.2,{align:"center",maxWidth:48});
 doc.setFont("helvetica","bold");doc.setFontSize(8.5);
 const typeTitle=x.mode==="TRABAJO_TITULACION"?"Acta de Titulación por Trabajo de Titulación":"Acta de Titulación por Examen Complexivo";
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
  doc.setDrawColor(70,70,70);doc.setLineWidth(.18);doc.line(15,270.4,195,270.4);
  doc.setFontSize(8);
  doc.text("Acta N.º "+txt(x.record.numeroActa)+" · "+txt(x.record.codigo),15,275.2,{maxWidth:178});
 }
}
function signatures(doc){
 const data=[
  {title:"ELABORADO",name:"MSc, Jefferson Villarreal",job:"Coordinador de Titulación y Eficiencia Terminal"},
  {title:"REVISADO",name:"Ing. Martha Tomalá",job:"Coordinadora General de Carreras"},
  {title:"APROBADO",name:"Dr. Alex León T.",job:"Vicerrector"}
 ];
 // Área institucional: 18 x 4,2 cm; márgenes laterales 1,795 cm; inferior 1,8 cm.
 const {x,y,width:w,height:h}=SIGN_BOX,col=w/3,head=7,sign=16,names=8;
 doc.setDrawColor(0,0,0);doc.setLineWidth(.20);doc.rect(x,y,w,h);
 doc.setLineWidth(.18);
 for(let i=1;i<3;i++)doc.line(x+i*col,y,x+i*col,y+h);
 for(const offset of [head,head+sign,head+sign+names])doc.line(x,y+offset,x+w,y+offset);
 data.forEach((f,i)=>{
  const mid=x+(i+.5)*col;
  doc.setFont("helvetica","bold");doc.setFontSize(8);
  doc.text(f.title,mid,y+4.7,{align:"center",maxWidth:56});
  doc.setFont("helvetica","normal");doc.setFontSize(7.7);
  const person=doc.splitTextToSize(f.name,55);
  if(person.length>2)throw Error("El nombre de "+f.name+" no cabe en el cuadro de responsabilidades.");
  doc.text(person,mid,y+head+sign+(person.length===1?5.3:3.4),{align:"center"});
  doc.setFontSize(7.5);
  const job=doc.splitTextToSize(f.job,55);
  if(job.length>2)throw Error("El cargo de "+f.name+" excede la celda de responsabilidades.");
  doc.text(job,mid,y+head+sign+names+(job.length===1?6:3.6),{align:"center"});
 });
}
function center(doc,value,y,size,bold){doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);const lines=doc.splitTextToSize(value,165);doc.text(lines,LETTER_W/2,y,{align:"center"});return y+lines.length*size*.45;}
/* Diseño editorial aplicado exclusivamente al cuerpo; portada y cuadro de firmas intactos. */
const BODY_THEME=Object.freeze({navy:[27,68,102],blue:[40,91,133],ink:[38,53,67],
 muted:[91,111,130],line:[213,225,237],soft:[239,245,250],stripe:[246,249,252],
 green:[34,111,79],greenFill:[230,245,237]});
function rgb(doc,method,values){doc[method](...values);}
function bodyInk(doc){rgb(doc,"setTextColor",BODY_THEME.ink);}
function nextPage(doc,x,logo,pos){
 doc.addPage();
 doc.setTextColor(0,0,0); // Encabezado institucional sin cambios
 header(doc,x,logo);
 pos.y=58;
 bodyInk(doc);
}
/* Para textos cortos, la paginación conserva el párrafo completo. */
function lines(doc,x,logo,value,pos,opts){
 opts=opts||{};
 const size=opts.size||9,step=size*.48,after=opts.after===undefined?3:opts.after;
 doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);
 const result=doc.splitTextToSize(txt(value),172);
 if(pos.y+Math.min(result.length*step+after,76)>BODY_BOTTOM&&result.length*step+after<=76){
  nextPage(doc,x,logo,pos);
 }
 for(const line of result){
  if(pos.y+step>BODY_BOTTOM){
   nextPage(doc,x,logo,pos);
   doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);
  }
  bodyInk(doc);doc.text(line,20,pos.y);pos.y+=step;
 }
 pos.y+=after;
}
function intro(doc,x,pos){
 const boxH=x.record.fechaRegistro?24:20;
 doc.setFillColor(...BODY_THEME.soft);doc.rect(18,pos.y,174,boxH,"F");
 doc.setFillColor(...BODY_THEME.blue);doc.rect(18,pos.y,2.1,boxH,"F");
 doc.setTextColor(...BODY_THEME.navy);doc.setFont("helvetica","bold");doc.setFontSize(11.3);
 doc.text("CONSTANCIA DE CULMINACIÓN Y TITULACIÓN",23,pos.y+7);
 doc.setFontSize(10.5);doc.text("N.º DE ACTA: "+txt(x.record.numeroActa),23,pos.y+14.4);
 if(x.record.fechaRegistro){
  doc.setTextColor(...BODY_THEME.muted);doc.setFont("helvetica","normal");doc.setFontSize(8.1);
  doc.text("Fecha de registro: "+formatDate(x.record.fechaRegistro),23,pos.y+20);
 }
 pos.y+=boxH+4;bodyInk(doc);
}
function pair(doc,x,logo,key,value,pos){
 doc.setFont("helvetica","normal");doc.setFontSize(8.5);
 const pieces=doc.splitTextToSize(txt(value),120);
 const h=Math.max(9,pieces.length*4.2+3);
 if(pos.y+h>BODY_BOTTOM)nextPage(doc,x,logo,pos);
 doc.setFillColor(...BODY_THEME.soft);doc.rect(18,pos.y,46,h,"F");
 doc.setFillColor(255,255,255);doc.rect(64,pos.y,128,h,"F");
 doc.setDrawColor(...BODY_THEME.line);doc.setLineWidth(.17);
 doc.rect(18,pos.y,174,h);doc.line(64,pos.y,64,pos.y+h);
 doc.setTextColor(...BODY_THEME.navy);doc.setFont("helvetica","bold");doc.setFontSize(8.2);
 doc.text(key,21,pos.y+5.6,{maxWidth:41});
 bodyInk(doc);doc.setFont("helvetica","normal");doc.setFontSize(8.5);
 doc.text(pieces,68,pos.y+Math.min(5.4,h/2));
 pos.y+=h;
}
function milestones(x){const ids=x.mode==="TRABAJO_TITULACION"?["induccion","tema","entrega","defensa","cierre"]:["nucleo1","nucleo4","examen","supletorio"];return (x.schedule||[]).flatMap(g=>g.actividades||[]).filter(a=>ids.includes(a.id)&&(a.inicio||a.fin));}
function timeline(doc,x,logo,rows,pos){if(!rows.length){lines(doc,x,logo,"Cronograma sin fechas registradas.",pos,{size:8.5});return;}for(const a of rows){if(pos.y+11>BODY_BOTTOM)nextPage(doc,x,logo,pos);doc.setDrawColor(196,203,214);doc.rect(18,pos.y,174,10);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text(doc.splitTextToSize(txt(a.nombre),91).slice(0,2),20,pos.y+4.2);doc.text(formatDate(a.inicio),116,pos.y+6);doc.text(formatDate(a.fin),157,pos.y+6);pos.y+=10;}pos.y+=3;}
/* Cuerpo documental: fuentes verificadas (BDLocal + Ncomplex). No modifica la portada. */
function academicEvidence(x){
 const proof=x&&x.evidence||w.ActasEvidence.assess({student:x.student,mode:x.mode,requirementValues:x.requirementValues||{},evaluation:x.evaluation});
 /* La emisión final requiere todos los requisitos, aprobaciones y número central. */
 return proof;
}
function dataRow(doc,x,logo,left,right,pos,opts){
 opts=opts||{};
 const widthLeft=opts.widthLeft||132;
 doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(8.4);
 const leftLines=doc.splitTextToSize(txt(left),widthLeft-4);
 const rightLines=doc.splitTextToSize(txt(right),34);
 const h=Math.max(7.2,Math.max(leftLines.length,rightLines.length)*4.1+2.7);
 if(pos.y+h>BODY_BOTTOM)nextPage(doc,x,logo,pos);
 const stripe=opts.index%2===1;
 doc.setFillColor(...(stripe?BODY_THEME.stripe:[255,255,255]));doc.rect(18,pos.y,174,h,"F");
 const approved=txt(right).toUpperCase()==="CUMPLE";
 if(approved){
  doc.setFillColor(...BODY_THEME.greenFill);doc.rect(154,pos.y+.5,38,h-1,"F");
 }
 doc.setDrawColor(...BODY_THEME.line);doc.setLineWidth(.14);
 doc.line(18,pos.y+h,192,pos.y+h);doc.line(154,pos.y,154,pos.y+h);
 bodyInk(doc);doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(8.4);
 doc.text(leftLines,21,pos.y+4.5);
 doc.setTextColor(...(approved?BODY_THEME.green:BODY_THEME.navy));
 doc.setFont("helvetica","bold");doc.setFontSize(8.2);
 doc.text(rightLines,157,pos.y+4.5);
 pos.y+=h;bodyInk(doc);
}
function followHeight(doc,value,size,after=3){
 doc.setFont("helvetica","normal");doc.setFontSize(size);
 return Math.min(30,Math.max(10,doc.splitTextToSize(txt(value),172).length*size*.48+after));
}
/* Evita títulos huérfanos: comprueba título + primer párrafo/fila, incluidas líneas largas. */
function heading(doc,x,logo,title,pos,minFollowing=11){
 doc.setFont("helvetica","bold");doc.setFontSize(10.1);
 const titleLines=doc.splitTextToSize(txt(title),161);
 const h=Math.max(8,titleLines.length*4.9+3.3);
 if(pos.y+h+2.3+minFollowing+1.5>BODY_BOTTOM)nextPage(doc,x,logo,pos);
 doc.setFillColor(...BODY_THEME.soft);doc.rect(18,pos.y,174,h,"F");
 doc.setFillColor(...BODY_THEME.blue);doc.rect(18,pos.y,1.3,h,"F");
 doc.setTextColor(...BODY_THEME.navy);doc.setFont("helvetica","bold");doc.setFontSize(10.1);
 doc.text(titleLines,22,pos.y+5.4);
 pos.y+=h+2.3;bodyInk(doc);
}
function paint(doc,x,logo){if(doc.getNumberOfPages()>1||doc.__actasCount){doc.addPage();}const start=doc.getNumberOfPages();doc.__actasCount=(doc.__actasCount||0)+1;
header(doc,x,logo);
let y=center(doc,x.mode==="TRABAJO_TITULACION"?"Acta de Titulación por Trabajo de Titulación":"Acta de Titulación por Examen Complexivo",126,23,true);
center(doc,"Período académico: "+txt(x.periodLabel),y+13,23,true);
signatures(doc);
doc.addPage();header(doc,x,logo);const pos={y:54};
bodyInk(doc);
const proof=academicEvidence(x);
intro(doc,x,pos);
pair(doc,x,logo,"Estudiante",studentName(x),pos);
pair(doc,x,logo,"Cédula",studentId(x),pos);
pair(doc,x,logo,"Carrera",career(x),pos);
pair(doc,x,logo,"Modalidad",label(x.mode),pos);
pos.y+=4;
heading(doc,x,logo,"1. Culminación de la malla curricular",pos,followHeight(doc,proof.mallaText,8.7,2.8));
lines(doc,x,logo,proof.mallaText,pos,{size:8.7,after:2.8});
dataRow(doc,x,logo,"Requisito Académico",proof.academicStatus,pos,{bold:true,index:0});
pos.y+=4;
heading(doc,x,logo,"2. Verificación de los nueve requisitos institucionales",pos,followHeight(doc,"Se presentan los estados documentales registrados para el estudiante y su período; no se incluyen calificaciones numéricas.",8.2,2)+8);
lines(doc,x,logo,"Se presentan los estados documentales registrados para el estudiante y su período; no se incluyen calificaciones numéricas.",pos,{size:8.2,after:2});
proof.requirements.forEach((r,i)=>dataRow(doc,x,logo,(i+1)+". "+r.label,r.status,pos,{index:i}));
pos.y+=4;
heading(doc,x,logo,"3. Modalidad y estado del proceso de titulación",pos,followHeight(doc,proof.componentText,8.7,4));
lines(doc,x,logo,proof.componentText,pos,{size:8.7,after:4});
heading(doc,x,logo,"4. Aprobaciones institucionales",pos,9);
dataRow(doc,x,logo,"Aprobación de titulación",proof.finalTitleStatus,pos,{bold:true,index:0});
dataRow(doc,x,logo,"Aprobación complexivo/proyecto",proof.finalResultStatus,pos,{bold:true,index:1});
pos.y+=4;
heading(doc,x,logo,"5. Constancia documental",pos,followHeight(doc,proof.closureText,8.7,4));
lines(doc,x,logo,proof.closureText,pos,{size:8.7,after:4});
const statement="REQUISITOS Y APROBACIONES INSTITUCIONALES CUMPLIDOS";
doc.setFont("helvetica","bold");doc.setFontSize(9);
const statementLines=doc.splitTextToSize(statement,164),statementH=statementLines.length*4.7+8;
if(pos.y+statementH+9>BODY_BOTTOM)nextPage(doc,x,logo,pos);
doc.setFillColor(...BODY_THEME.greenFill);doc.rect(18,pos.y,174,statementH,"F");
doc.setFillColor(...BODY_THEME.green);doc.rect(18,pos.y,2,statementH,"F");
doc.setTextColor(...BODY_THEME.green);doc.setFont("helvetica","bold");doc.setFontSize(9);
doc.text(statementLines,22,pos.y+5.8);
pos.y+=statementH+2.4;bodyInk(doc);
lines(doc,x,logo,"La presente acta registra el cumplimiento de los nueve requisitos y de las dos aprobaciones finales que constan en el expediente institucional.",pos,{size:8.4,after:2});
footer(doc,x,start,doc.getNumberOfPages());}
async function build(items){const list=Array.isArray(items)?items:[items];if(!list.length)throw Error("No hay actas para generar.");if(list.some(x=>!x.evidence||x.evidence.eligible!==true||!/^(?:(?:CX|TT)-)?[0-9]{4}-[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{4}$/.test(txt(x.record&&x.record.numeroActa))))throw Error("El acta final exige expediente completo y número único registrado en el libro central.");const [JsPDF,logo]=await Promise.all([pdfReady(),w.ActasBrand.resolve()]);if(!logo||!logo.dataUrl)throw Error("No se encontró un logo institucional. Usa «Configurar logo» para subirlo.");
const doc=new JsPDF({unit:"mm",format:"letter",compress:true,putOnlyUsedFonts:true});for(const x of list)paint(doc,x,logo);return doc.output("blob");}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=d.createElement("a");a.href=url;a.download=name;d.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function download(items){const list=Array.isArray(items)?items:[items],blob=await build(list);const name=list.length===1?filename(list[0]):"ACTAS_SELECCIONADAS_"+safe(list[0].record.periodId||list[0].periodLabel)+".pdf";downloadBlob(blob,name);return {ok:true,bytes:blob.size,count:list.length};}
function csvCell(value){let s=txt(value);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(rows){const headers=["Cedula","Estudiante","Carrera","Modalidad","NumeroActa","Estado","Motivo","Archivo"];return "\uFEFF"+[headers,...rows.map(r=>[r.cedula,r.nombre,r.carrera,r.modalidad,r.numeroActa||"",r.estado,r.motivo,r.archivo])].map(row=>row.map(csvCell).join(";")).join("\r\n");}
async function downloadZip(items,summary,periodId,progress){const list=Array.isArray(items)?items:[],JsZip=await zipReady();if(!list.length)throw Error("No existen estudiantes con actas habilitadas en este período.");
const zip=new JsZip(),log=Array.isArray(summary)?summary.map(r=>Object.assign({},r)):[],used=new Set();let done=0,generated=0;for(const item of list){const fullName=category(item.mode)+"/"+filename(item),key=fullName.toLowerCase();let path=fullName,n=2;while(used.has(path.toLowerCase()))path=fullName.replace(/\.pdf$/i,"_"+n+++".pdf");used.add(path.toLowerCase());try{const blob=await build(item);zip.file(path,await blob.arrayBuffer());generated++;const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){row.estado="INCLUIDO";row.numeroActa=item.record.numeroActa;row.motivo="";row.archivo=path;}}catch(e){const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){row.estado="ERROR";row.motivo=e.message;row.archivo="";}}done++;if(typeof progress==="function")progress({done,total:list.length,generated});}
zip.file("Resumen_exportacion.csv",csv(log));if(!generated)throw Error("No se pudo generar ningún PDF. Revisa el logo y los datos.");
const out=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});downloadBlob(out,"ACTAS_UTET_"+safe(periodId)+".zip");return {ok:true,bytes:out.size,generated,excluded:log.filter(x=>x.estado!=="INCLUIDO").length,errors:log.filter(x=>x.estado==="ERROR").length};}
w.ActasPDF=Object.freeze({build,download,downloadZip,filename,category});
})(window,document);
