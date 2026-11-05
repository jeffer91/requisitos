/* Módulo Inf: textos fijos, cronogramas editables y PDF de avance. */
(function(window,document){
"use strict";
var state={schedule:null,dirty:false,careers:[]};
function el(id){return document.getElementById(id);}
function text(s){return String(s==null?"":s).trim();}
function make(tag,cls,content){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=String(content);
  return e;
}
function message(value,error){
 var n=el("inf-status");
 if(n){n.textContent=value;n.className="inf-statusbar"+(error?" error":"");}
}
function leafNode(item){
 var li=make("li");
 var heading=make("div","inf-node-title",item.number+". "+item.title);
 li.appendChild(heading);
 if(item.sections.length){
  if(item.content){
   var parentBody=make("div","inf-preview");
   window.InfMarkdown.render(parentBody,item.content);li.appendChild(parentBody);
  }
  var sub=make("ol");
  item.sections.forEach(function(child){sub.appendChild(leafNode(child));});
  li.appendChild(sub);
 }else if(item.content.trim()){
  var body=make("div","inf-preview");window.InfMarkdown.render(body,item.content);li.appendChild(body);
 }else li.appendChild(make("span","inf-leaf-state","Pendiente de información"));
 return li;
}
function showIndex(){
 var report=window.InfReport.build(),target=el("inf-chapters");
 target.textContent="";
 report.chapters.forEach(function(chapter){
  var d=make("details"),head=make("summary",null,chapter.number+". "+chapter.title);
  d.appendChild(head);
  if(chapter.content.trim()){
   var body=make("div","inf-preview");window.InfMarkdown.render(body,chapter.content);
   d.appendChild(body);
  }
  var ol=make("ol");
  chapter.sections.forEach(function(item){ol.appendChild(leafNode(item));});
  d.appendChild(ol);
  target.appendChild(d);
 });
 return report;
}
function showDiagrams(){
 state.careers=window.InfNuclei.careers();
 var target=el("inf-diagrams");target.textContent="";
 state.careers.forEach(function(c,i){
  var card=make("article","inf-diagram");
  card.appendChild(make("h3",null,c.section+". "+c.career));
  card.appendChild(window.InfVisuals.coreDiagram(c));
  card.appendChild(make("p","inf-figure-caption","Figura "+(i+1)+". Organización de los cuatro núcleos estructurantes de "+c.career+"."));
  target.appendChild(card);
 });
 el("inf-nuc-count").textContent=state.careers.length+" carreras · "+state.careers.length*4+" núcleos";
}
function textbox(row,field,mode,index,cls){
 var input=make("input",cls||"");input.type="text";input.value=row[field]||"";
 input.setAttribute("aria-label",field+" actividad "+(index+1));
 input.addEventListener("change",function(){
  state.schedule[mode][index][field]=input.value;
  state.dirty=true;
  el("inf-schedule-origin").textContent="Hay cambios sin guardar en este período.";
  renderGantts();
 });
 return input;
}
function choice(row,field,mode,index,values){
 var select=make("select",field==="phase"?"phase":"");
 values.forEach(function(item){
  var o=make("option",null,item.label);o.value=item.value;
  select.appendChild(o);
 });
 select.value=row[field]||values[0].value;
 select.addEventListener("change",function(){
  state.schedule[mode][index][field]=select.value;
  state.dirty=true;el("inf-schedule-origin").textContent="Hay cambios sin guardar en este período.";
  renderGantts();
 });
 return select;
}
var phases=["Fase 1: Inicio y planificación","Fase 2: Desarrollo y tutorías","Fase 3: Defensa final"];
function showRows(mode){
 var rows=state.schedule[mode],target=el("inf-rows-"+mode);
 target.textContent="";
 rows.forEach(function(row,index){
  var tr=make("tr");
  if(mode==="trabajo"){
   var p=make("td");p.appendChild(choice(row,"phase",mode,index,phases.map(v=>({label:v,value:v}))));
   tr.appendChild(p);
  }
  [["activity","activity"],["start",""],["end",""]].forEach(function(pair){
   var cell=make("td");cell.appendChild(textbox(row,pair[0],mode,index,pair[1]));
   tr.appendChild(cell);
  });
  var status=make("td");
  var opts=[
   ["NO_VERIFICADO","Sin verificar"],["EJECUTADO","Ejecutada"],["PENDIENTE","Pendiente"],
   ["REPROGRAMADO","Reprogramada"],["NO_EJECUTADO","No ejecutada"]
  ];
  status.appendChild(choice(row,"status",mode,index,opts.map(o=>({value:o[0],label:o[1]}))));
  tr.appendChild(status);
  var actions=make("td"),remove=make("button","inf-remove","Eliminar");
  remove.type="button";remove.addEventListener("click",function(){
   if(!window.confirm("¿Eliminar esta actividad del cronograma del período?"))return;
   rows.splice(index,1);state.dirty=true;showRows(mode);renderGantts();
   el("inf-schedule-origin").textContent="Hay cambios sin guardar en este período.";
  });
  actions.appendChild(remove);tr.appendChild(actions);target.appendChild(tr);
 });
}
function renderGantts(){
 ["complexivo","trabajo"].forEach(function(mode){
  var e=el("inf-gantt-"+mode);
  e.textContent="";
  e.appendChild(window.InfVisuals.gantt(state.schedule[mode],mode==="complexivo"?"Examen Complexivo":"Trabajo de Titulación"));
 });
}
function loadPeriod(){
 if(state.dirty&&!window.confirm("Hay cambios sin guardar. ¿Deseas cambiar de período?"))return;
 try {
  state.schedule=window.InfSchedules.load(el("inf-period").value);
  state.dirty=false;showRows("complexivo");showRows("trabajo");renderGantts();
  el("inf-schedule-origin").textContent=state.schedule.source+". Estados inicialmente sin verificar; confirma el cumplimiento con evidencias.";
  message("Período: "+state.schedule.period+". Revisa los cronogramas antes de generar el PDF.");
 }catch(e){message(e.message,true);}
}
function savePeriod(){
 try{
  state.schedule=window.InfSchedules.save(state.schedule);
  state.dirty=false;
  el("inf-schedule-origin").textContent="Guardado localmente en este equipo para el período "+state.schedule.period+".";
  fillPeriods();
  message("Cronogramas guardados correctamente para "+state.schedule.period+".");
 }catch(e){message("No se guardó: "+e.message,true);}
}
function fillPeriods(){
 var d=el("inf-period-options");d.textContent="";
 var periods=new Set([window.InfSchedules.examplePeriod].concat(window.InfSchedules.periods()));
 periods.forEach(function(p){var o=make("option");o.value=p;d.appendChild(o);});
}
function addRow(mode){
 state.schedule[mode].push({phase:mode==="trabajo"?phases[0]:"",
 activity:"",start:"",end:"",status:"NO_VERIFICADO"});
 state.dirty=true;showRows(mode);renderGantts();
 el("inf-schedule-origin").textContent="Completa la nueva actividad y guarda los cambios.";
}
async function downloadPdf(){
 var button=el("inf-pdf");
 try{
  var invalid=window.InfSchedules.validate(state.schedule);
  if(invalid.length)throw Error(invalid.join("; "));
  if(state.dirty&&!window.confirm("Hay cambios sin guardar. ¿Generar el PDF con la versión actualmente visible?"))return;
  button.disabled=true;
  message("Preparando el PDF con las figuras de núcleos, los cronogramas y el texto institucional…");
  var report=window.InfReport.build();
  await window.InfPDF.download({report:report,schedule:state.schedule,careers:state.careers});
  message("PDF de avance generado. No es documento oficial: los capítulos restantes y los resultados académicos aún deben completarse.");
 }catch(e){message("No se generó el PDF: "+e.message,true);}
 finally{button.disabled=false;}
}
function boot(){
 try{
  var r=showIndex();showDiagrams();fillPeriods();loadPeriod();
  el("inf-period-load").addEventListener("click",loadPeriod);
  el("inf-period").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();loadPeriod();}});
  el("inf-add-complexivo").addEventListener("click",function(){addRow("complexivo");});
  el("inf-add-trabajo").addEventListener("click",function(){addRow("trabajo");});
  el("inf-schedule-save").addEventListener("click",savePeriod);
  el("inf-pdf").addEventListener("click",downloadPdf);
  message("Inf preparado: "+r.coverage.completed+" apartados con texto; "+r.coverage.pending+" pendientes. Los resultados de estudiantes aún no están conectados.");
  window.InfApp=Object.freeze({getDraft:function(){return window.InfReport.build();},
    getSchedules:function(){return JSON.parse(JSON.stringify(state.schedule));},
    loadPeriod:loadPeriod,savePeriod:savePeriod,downloadPdf:downloadPdf});
 }catch(e){message("Error al iniciar Inf: "+e.message,true);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})(window,document);
