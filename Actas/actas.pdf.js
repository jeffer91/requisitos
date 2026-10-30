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
function header(doc,x,logo){doc.setDrawColor(50,70,90);doc.setLineWidth(.25);doc.rect(16,13,178,33);drawLogo(doc,logo,19,16,43,26);
doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.text("UNIDAD DE TITULACIÓN Y",112,22,{align:"center"});doc.text("EFICIENCIA TERMINAL",112,27,{align:"center"});
doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text("ITSQMET · "+txt(x.periodLabel),112,35,{align:"center",maxWidth:87});
doc.setFontSize(7);doc.text("Código:",168,20);doc.text(doc.splitTextToSize(txt(x.record.codigo),24),168,26);doc.text("BORRADOR",168,39);
doc.setDrawColor(120,130,145);doc.line(16,49,194,49);}
function footer(doc,x,start,end){for(let i=start;i<=end;i++){doc.setPage(i);doc.setDrawColor(185,195,210);doc.line(17,280,193,280);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.text("Borrador para revisión y legalización · "+txt(x.record.codigo),17,285,{maxWidth:142});doc.text("Página "+(i-start+1)+" de "+(end-start+1),193,285,{align:"right"});}}
function center(doc,value,y,size,bold){doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);const lines=doc.splitTextToSize(value,165);doc.text(lines,105,y,{align:"center"});return y+lines.length*size*.45;}
function nextPage(doc,x,logo,pos){doc.addPage();header(doc,x,logo);pos.y=58;}
function lines(doc,x,logo,value,pos,opts){opts=opts||{};const size=opts.size||9,step=size*.48;doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);
const result=doc.splitTextToSize(txt(value),174);for(const line of result){if(pos.y+step>273){nextPage(doc,x,logo,pos);doc.setFont("helvetica",opts.bold?"bold":"normal");doc.setFontSize(size);}doc.text(line,18,pos.y);pos.y+=step;}pos.y+=opts.after===undefined?3:opts.after;}
function section(doc,x,logo,title,pos){lines(doc,x,logo,title,pos,{bold:true,size:10.5,after:1.7});}
function pair(doc,x,logo,key,value,pos){if(pos.y+12>273)nextPage(doc,x,logo,pos);doc.setDrawColor(188,197,206);doc.rect(18,pos.y,174,11);doc.setFillColor(241,245,249);doc.rect(18,pos.y,46,11,"F");doc.setFontSize(8);doc.setFont("helvetica","bold");doc.text(key,20,pos.y+6.2,{maxWidth:42});doc.setFont("helvetica","normal");doc.text(doc.splitTextToSize(txt(value),121).slice(0,2),67,pos.y+4.5);pos.y+=11;}
function milestones(x){const ids=x.mode==="TRABAJO_TITULACION"?["induccion","tema","entrega","defensa","cierre"]:["nucleo1","nucleo4","examen","supletorio"];return (x.schedule||[]).flatMap(g=>g.actividades||[]).filter(a=>ids.includes(a.id)&&(a.inicio||a.fin));}
function timeline(doc,x,logo,rows,pos){if(!rows.length){lines(doc,x,logo,"Cronograma sin fechas registradas.",pos,{size:8.5});return;}for(const a of rows){if(pos.y+11>273)nextPage(doc,x,logo,pos);doc.setDrawColor(196,203,214);doc.rect(18,pos.y,174,10);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text(doc.splitTextToSize(txt(a.nombre),91).slice(0,2),20,pos.y+4.2);doc.text(formatDate(a.inicio),116,pos.y+6);doc.text(formatDate(a.fin),157,pos.y+6);pos.y+=10;}pos.y+=3;}
function paint(doc,x,logo){if(doc.getNumberOfPages()>1||doc.__actasCount){doc.addPage();}const start=doc.getNumberOfPages();doc.__actasCount=(doc.__actasCount||0)+1;
header(doc,x,logo);let y=96;y=center(doc,"ACTA DE TITULACIÓN POR "+(x.mode==="TRABAJO_TITULACION"?"TRABAJO DE TITULACIÓN":"EXAMEN COMPLEXIVO"),y,20,true);
y=center(doc,"Período académico: "+txt(x.periodLabel),y+14,11,false);center(doc,"BORRADOR · PENDIENTE DE LEGALIZACIÓN",y+15,11,true);
doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Fecha de emisión: "+formatDate(x.issue),105,201,{align:"center"});
const firmantes=[
{role:"ELABORADO POR",nombre:"MSc, Jefferson Villarreal",cargo:"Coordinador de Titulación y Eficiencia Terminal"},
{role:"REVISADO POR",nombre:"Ing. Martha Tomalá",cargo:"Coordinadora General de Carreras"},
{role:"APROBADO POR",nombre:"Dr. Alex León T.",cargo:"Vicerrector"}
];for(let i=0;i<firmantes.length;i++){
 const f=firmantes[i],bx=18+i*58,ancho=58;
 doc.setDrawColor(35,35,35);doc.setLineWidth(.22);doc.rect(bx,211,ancho,60);doc.line(bx,243,bx+ancho,243);
 doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text(f.role+":",bx+2,217,{maxWidth:ancho-4});
 doc.setFontSize(7.6);const names=doc.splitTextToSize("NOMBRE: "+f.nombre,ancho-4);doc.text(names.slice(0,2),bx+2,248);
 const cargoY=248+(names.length>1?4.2:0)+8;
 const jobs=doc.splitTextToSize("CARGO: "+f.cargo,ancho-4);doc.text(jobs.slice(0,3),bx+2,cargoY);
}
doc.addPage();header(doc,x,logo);const pos={y:59};
section(doc,x,logo,"CONSTANCIA DEL PROCESO DE TITULACIÓN",pos);
pair(doc,x,logo,"Estudiante",studentName(x),pos);pair(doc,x,logo,"Cédula",studentId(x),pos);
pair(doc,x,logo,"Carrera",career(x),pos);pair(doc,x,logo,"Modalidad",label(x.mode),pos);pair(doc,x,logo,"Período",txt(x.periodLabel),pos);
pos.y+=4;section(doc,x,logo,"1. Antecedentes",pos);
lines(doc,x,logo,"La Unidad de Titulación y Eficiencia Terminal documenta el resultado final de "+studentName(x)+", con cédula "+studentId(x)+", perteneciente a la carrera "+career(x)+". La modalidad registrada para este período es "+label(x.mode)+".",pos);
section(doc,x,logo,"2. Desarrollo académico y cronograma",pos);
lines(doc,x,logo,x.mode==="TRABAJO_TITULACION"?"El proceso contempla planificación, elaboración del trabajo, revisión y defensa ante tribunal. Las fechas siguientes son informativas y no acreditan su ejecución.":"El proceso contempla los núcleos formativos, la evaluación ordinaria y, cuando corresponde, el supletorio. Las fechas siguientes son informativas y no acreditan su ejecución.",pos);
timeline(doc,x,logo,milestones(x),pos);
section(doc,x,logo,"3. Verificación de requisitos finales",pos);
lines(doc,x,logo,"Los registros de requisitos consultados indican CUMPLE en «Aprobación titulación» y CUMPLE en «Aprobación complexivo/proyecto». Este borrador no incorpora calificaciones numéricas y debe contrastarse con las evidencias originales.",pos);
section(doc,x,logo,"4. Constancia de resultado",pos);
lines(doc,x,logo,"Conforme a las aprobaciones finales registradas para este estudiante, período y modalidad, se deja constancia del resultado APROBADO. Esta acta es un borrador y no sustituye su revisión, aprobación y suscripción por los responsables institucionales.",pos);
lines(doc,x,logo,"RESULTADO FINAL: APROBADO",pos,{size:12,bold:true,after:6});
lines(doc,x,logo,"Una vez revisado y legalizado, este documento debe incorporarse al expediente de titulación y al repositorio documental institucional de la UTET.",pos,{size:8.5});
footer(doc,x,start,doc.getNumberOfPages());}
async function build(items){const list=Array.isArray(items)?items:[items];if(!list.length)throw Error("No hay actas para generar.");const [JsPDF,logo]=await Promise.all([pdfReady(),w.ActasBrand.resolve()]);if(!logo||!logo.dataUrl)throw Error("No se encontró un logo institucional. Usa «Configurar logo» para subirlo.");
const doc=new JsPDF({unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true});for(const x of list)paint(doc,x,logo);return doc.output("blob");}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=d.createElement("a");a.href=url;a.download=name;d.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function download(items){const list=Array.isArray(items)?items:[items],blob=await build(list);const name=list.length===1?filename(list[0]):"ACTAS_SELECCIONADAS_"+safe(list[0].record.periodId||list[0].periodLabel)+".pdf";downloadBlob(blob,name);return {ok:true,bytes:blob.size,count:list.length};}
function csvCell(value){let s=txt(value);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(rows){const headers=["Cedula","Estudiante","Carrera","Modalidad","Estado","Motivo","Archivo"];return "\uFEFF"+[headers,...rows.map(r=>[r.cedula,r.nombre,r.carrera,r.modalidad,r.estado,r.motivo,r.archivo])].map(row=>row.map(csvCell).join(";")).join("\r\n");}
async function downloadZip(items,summary,periodId,progress){const list=Array.isArray(items)?items:[],JsZip=await zipReady();if(!list.length)throw Error("No existen estudiantes con actas habilitadas en este período.");
const zip=new JsZip(),log=Array.isArray(summary)?summary.map(r=>Object.assign({},r)):[],used=new Set();let done=0,generated=0;for(const item of list){const fullName=category(item.mode)+"/"+filename(item),key=fullName.toLowerCase();let path=fullName,n=2;while(used.has(path.toLowerCase()))path=fullName.replace(/\.pdf$/i,"_"+n+++".pdf");used.add(path.toLowerCase());try{const blob=await build(item);zip.file(path,blob);generated++;const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){row.estado="INCLUIDO";row.motivo="";row.archivo=path;}}catch(e){const row=log.find(r=>r.cedula===studentId(item)&&r.modalidad===category(item.mode));if(row){row.estado="ERROR";row.motivo=e.message;row.archivo="";}}done++;if(typeof progress==="function")progress({done,total:list.length,generated});}
zip.file("Resumen_exportacion.csv",csv(log));if(!generated)throw Error("No se pudo generar ningún PDF. Revisa el logo y los datos.");
const out=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});downloadBlob(out,"ACTAS_UTET_"+safe(periodId)+".zip");return {ok:true,bytes:out.size,generated,excluded:log.filter(x=>x.estado!=="INCLUIDO").length,errors:log.filter(x=>x.estado==="ERROR").length};}
w.ActasPDF=Object.freeze({build,download,downloadZip,filename,category});
})(window,document);
