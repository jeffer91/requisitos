/* Plantilla institucional de actas finales sin calificaciones numéricas. */
(function(w){"use strict";
function safe(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function txt(s,names){for(const n of names)if(s[n]!=null&&String(s[n]).trim())return String(s[n]).trim();return "No registrado";}
function fecha(d){const s=String(d||"").slice(0,10).split("-");return s.length===3?s[2]+"/"+s[1]+"/"+s[0]:"No registrada";}
function titulo(mode){return mode==="TRABAJO_TITULACION"?"Acta de Titulación por Trabajo de Titulación":"Acta de Titulación por Examen Complexivo";}
function nombreModo(mode){return mode==="TRABAJO_TITULACION"?"Trabajo de Titulación":"Examen Complexivo";}
const css="@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#eee;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:10pt}.toolstrip{position:sticky;top:0;background:#194b7b;color:white;padding:12px;text-align:center}.toolstrip button{margin:0 6px;padding:8px 15px;border:0;border-radius:5px;cursor:pointer}.acta{background:white;width:210mm;margin:8mm auto;box-shadow:0 1px 15px #0002}.page{width:210mm;height:297mm;position:relative;padding:15mm;overflow:hidden;page-break-after:always}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:0.18mm solid #000;padding:1mm;vertical-align:middle}.head{width:180mm;height:30mm;border-collapse:collapse;table-layout:fixed}.head tr.r1{height:11.5mm}.head tr.r2{height:7.5mm}.head tr.r3{height:11mm}.head td{text-align:center;font-size:8.5pt;line-height:1.15;overflow-wrap:anywhere}.head .logo{width:52mm}.head .center{width:76mm;font-size:9pt;font-weight:normal}.head .right{width:52mm}.head .code{font-size:8pt;font-weight:normal}.head img{display:block;max-width:44mm;max-height:15mm;object-fit:contain;margin:auto}.cover-title{position:absolute;top:110mm;left:15mm;right:15mm;text-align:center;font-size:23pt;font-weight:bold;line-height:1.25}.cover-sub{position:absolute;top:151mm;left:15mm;right:15mm;text-align:center;font-size:23pt;font-weight:bold;line-height:1.25}.draft{color:#963f3f;font-size:9pt;letter-spacing:1px;font-weight:700}.sign{position:absolute;left:15mm;bottom:30mm;width:180mm;height:42mm;table-layout:fixed;border-collapse:collapse}.sign td{width:60mm;padding:1mm;font-size:8pt;line-height:1.1;vertical-align:middle}.sign .sign-space td{height:24mm;text-align:center;vertical-align:top;font-size:8.5pt}.sign .sign-names td{height:7.5mm;text-align:left;overflow-wrap:break-word}.sign .sign-roles td{height:10.5mm;text-align:left;overflow-wrap:break-word}.footer{position:absolute;bottom:15mm;left:15mm;right:15mm;border-top:.18mm solid #444;padding-top:1mm;font-size:8pt;display:flex;justify-content:space-between}.page2{font-size:8.3pt;overflow:visible;height:auto;min-height:297mm}.page2 .stage-heading{text-align:center;font-size:11pt;margin:4mm 0 3mm}.page2 .stage-title{font-size:9.4pt;margin:2.7mm 0 .8mm}.page2 .stage-text{line-height:1.27;margin:1mm 0}.page2 .stage-rows td,.page2 .stage-identity td{padding:1.05mm 1.5mm;font-size:8pt;line-height:1.15}.page2 .stage-rows td:last-child{width:38mm;text-align:center;font-weight:bold}.page2 .stage-identity td:first-child{width:35mm;font-weight:bold;background:#eff2f6}.page2 .stage-result{font-size:11pt;text-align:center;margin:3mm 0}.page2 .stage-small{font-size:7.8pt;margin:1mm 0}.page2 .section-title{text-align:center;background:#e8edf5;border:1px solid #444;padding:8px;font-size:13pt;margin:9mm 0 4mm}.meta td:nth-child(odd){background:#eff2f6;font-weight:700}.prose{line-height:1.5;text-align:justify}.prose h3{font-size:10pt;margin:4mm 0 1mm}.prose p{margin:2mm 0}.timeline td,.timeline th{font-size:8.2pt;padding:4px}.timeline th{background:#e8edf5}.outcome{margin:6mm 0;border:1px solid #222;padding:11px;text-align:center;font-size:12pt;letter-spacing:.07em}.subtitle{font-size:8.5pt}.no-title{margin:3mm 0}.acta:last-child .page:last-child{page-break-after:auto}@media print{body{background:white}.toolstrip{display:none}.acta{margin:0;box-shadow:none}.page{page-break-after:always}}";

const bodyCss=`
.page2{color:#263543}
.page2 .stage-heading{color:#1b4466;font-weight:700;background:#eff5fa;border-left:2mm solid #285b85;padding:3mm;text-align:left}
.page2 .stage-title{color:#1b4466;background:#eff5fa;border-left:1.3mm solid #285b85;padding:2.2mm;margin:3.5mm 0 1.5mm;break-after:avoid-page;page-break-after:avoid;break-inside:avoid-page}
.page2 .stage-keep{break-inside:avoid-page;page-break-inside:avoid}
.page2 .stage-text{color:#263543;line-height:1.45;orphans:2;widows:2}
.page2 .stage-result{color:#285b85;font-weight:700}
.page2 .stage-small{color:#526779;line-height:1.45}
.page2 .stage-identity td,.page2 .stage-rows td{border:.15mm solid #d5e1eb;padding:2.1mm 2.6mm;color:#263543}
.page2 .stage-identity td:first-child{background:#eff5fa;color:#1b4466;font-weight:700}
.page2 .stage-identity td:last-child{background:#fff}
.page2 .stage-rows tr{break-inside:avoid-page;page-break-inside:avoid}
.page2 .stage-rows tr:nth-child(even) td:first-child{background:#f6f9fc}
.page2 .stage-rows td:last-child{background:#e6f5ed;color:#226f4f;font-weight:700}
.page2 .footer{border-top:.25mm solid #285b85;color:#526779}
@media print{.page2 .stage-keep{break-inside:avoid-page;page-break-inside:avoid}.page2 .stage-title{break-after:avoid-page;page-break-after:avoid}}
`;
const logo=new URL("../Global/assets/branding/logo-instituto.png",w.location.href).href;
function head(mode,rec,label,page,issue){
 const title=titulo(mode);
 return '<table class="head"><colgroup><col style="width:52mm"><col style="width:76mm"><col style="width:52mm"></colgroup>'+
 '<tr class="r1"><td class="logo" rowspan="2"><img alt="ITSQMET" src="'+safe(logo)+'"></td><td class="center" rowspan="2">Unidad de Titulación y Eficiencia Terminal</td><td class="right"><b>Código:</b><div class="code">'+safe(rec.codigo)+'</div></td></tr>'+
 '<tr class="r2"><td class="right">Versión: 1.0</td></tr>'+
 '<tr class="r3"><td>Fecha de emisión: '+safe(fecha(issue))+'</td><td><b>'+safe(title)+'</b></td><td>Página '+page+' de 2</td></tr></table>';
}
function cover(data){
 return '<section class="page">'+head(data.mode,data.record,data.periodLabel,1,data.issue)+
 '<div class="cover-title">'+safe(titulo(data.mode))+'</div><div class="cover-sub">Período académico: '+safe(data.periodLabel)+'</div>'+
 '<table class="sign"><tr class="sign-space"><td>ELABORADO POR:</td><td>REVISADO POR:</td><td>APROBADO POR:</td></tr>'+
 '<tr class="sign-names"><td><b>NOMBRE:</b> MSc, Jefferson Villarreal</td><td><b>NOMBRE:</b> Ing. Martha Tomalá</td><td><b>NOMBRE:</b> Dr. Alex León T.</td></tr>'+
 '<tr class="sign-roles"><td><b>CARGO:</b> Coordinador de Titulación y Eficiencia Terminal</td><td><b>CARGO:</b> Coordinadora General de Carreras</td><td><b>CARGO:</b> Vicerrector</td></tr></table>'+
 '<div class="footer"><span>Instituto Superior Tecnológico Quito Metropolitano · ITSQMET</span><span>Acta N.º '+safe(data.record.numeroActa)+'</span></div></section>';
}
function milestones(groups,mode){
const allowed=mode==="TRABAJO_TITULACION"?["induccion","tema","entrega","defensa","cierre"]:["nucleo1","nucleo4","examen","supletorio"];
const rows=[];(groups||[]).forEach(g=>(g.actividades||[]).forEach(a=>{if(allowed.includes(a.id)&&(a.inicio||a.fin))rows.push(a);}));
return rows;
}
function bodyPage(data){
 const p=data.evidence||w.ActasEvidence.assess({student:data.student,mode:data.mode,requirementValues:data.requirementValues||{}});
 const student=data.student||{},nm=safe(txt(student,["Nombres","nombres","nombreCompleto","nombre","Nombre"])),
  ced=safe(txt(student,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula"])),
  car=safe(txt(student,["NombreCarrera","nombreCarrera","carrera","Carrera"]));
 const item=(label,value)=>'<tr><td>'+safe(label)+'</td><td>'+safe(value)+'</td></tr>';
 const requirements=p.requirements.map((r,i)=>item((i+1)+". "+r.label,r.status)).join("");
 return '<section class="page page2">'+head(data.mode,data.record,data.periodLabel,2,data.issue)+
  '<h2 class="stage-heading">CONSTANCIA DOCUMENTAL DE TITULACIÓN</h2>'+
  '<p class="stage-result"><b>'+safe('N.º DE ACTA: '+data.record.numeroActa)+'</b></p>'+
  '<table class="stage-identity">'+item("Estudiante",nm)+item("Cédula",ced)+item("Carrera",car)+item("Modalidad",nombreModo(data.mode))+'</table>'+
  '<div class="stage-keep"><h3 class="stage-title">1. Cumplimiento curricular</h3><p class="stage-text">'+safe(p.mallaText)+'</p></div>'+
  '<h3 class="stage-title">2. Verificación de nueve requisitos institucionales</h3><table class="stage-rows">'+requirements+'</table>'+
  '<div class="stage-keep"><h3 class="stage-title">3. Modalidad y estado del proceso</h3><p class="stage-text">'+safe(p.componentText)+'</p></div>'+
  '<div class="stage-keep"><h3 class="stage-title">4. Aprobaciones institucionales</h3>'+
  '<table class="stage-rows">'+item("Aprobación de titulación",p.finalTitleStatus)+item("Aprobación complexivo/proyecto",p.finalResultStatus)+'</table></div>'+
  '<div class="stage-keep"><h3 class="stage-title">5. Constancia documental</h3><p class="stage-text">'+safe(p.closureText)+'</p>'+
  '<p class="stage-result"><b>ESTADO DOCUMENTAL: REQUISITOS Y APROBACIONES INSTITUCIONALES CUMPLIDOS</b></p>'+
  '<p class="stage-small">La presente acta registra el cumplimiento documental del proceso de titulación.</p></div>'+
  '<div class="footer"><span>'+safe(data.record.codigo)+'</span><span>'+safe(fecha(data.issue))+'</span></div></section>';
}
function render(items){const all=Array.isArray(items)?items:[items];if(all.some(x=>!x.evidence||x.evidence.eligible!==true||!/^(?:(?:CX|TT)-)?[0-9]{4}-[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{4}$/.test(String(x.record&&x.record.numeroActa||""))))throw Error("El acta final requiere expediente completo y número oficial único.");return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Actas de Titulación ITSQMET</title><style>'+css+bodyCss+'</style></head><body><div class="toolstrip">Vista previa institucional · Sin notas numéricas <button onclick="window.print()">Imprimir / Guardar PDF</button> <button onclick="window.close()">Cerrar</button></div>'+all.map(it=>'<article class="acta">'+cover(it)+bodyPage(it)+'</article>').join('')+'</body></html>';}
function preview(items){const win=w.open("","_blank");if(!win)throw Error("Habilita ventanas emergentes para ver las actas.");win.document.open();win.document.write(render(items));win.document.close();win.focus();}

w.ActasDocument=Object.freeze({render,preview});
})(window);