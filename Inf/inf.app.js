/* Módulo Inf: textos fijos, cronogramas editables y PDF de avance. */
(function(window,document){
"use strict";
var state={schedule:null,dirty:false,careers:[],results:null,periods:[],loadingResults:false};
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
function periodIdFor(label){
 var clean=function(v){return text(v).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();};
 var wanted=clean(label);
 var found=state.periods.find(function(row){
  return wanted===clean(row.nombre||row.label||row.periodoLabel||row.nombrePeriodo||"")||
    wanted===clean(row.id||row.periodoId||"");
 });
 return found?text(found.periodoId||found.id):"";
}
function showResults(){
 var container=el("inf-results-table"),info=el("inf-results-summary");
 if(!container||!info)return;
 container.textContent="";
 var result=state.results;
 if(!result){info.textContent="Sin resultados cargados del período seleccionado.";return;}
 if(result.missingGradeSource){
  info.textContent="BDLocal consultada en modo solo lectura. No se localizaron notas específicamente identificadas por núcleo para este período. No se muestran promedios ni estudiantes ficticios.";
  return;
 }
 info.textContent="Se identificaron "+result.students+" estudiantes en el período; "+
   result.observations+" registros de núcleo y "+result.gradedNucleusRecords+" notas finales por núcleo. "+
   "Los resultados se obtienen de registros identificados como núcleos, no de las notas del examen complexivo.";
 var table=make("table"),thead=make("thead"),tr=make("tr");
 ["Carrera","Estudiantes","Núcleo 1","Núcleo 2","Núcleo 3","Núcleo 4"].forEach(function(t){tr.appendChild(make("th",null,t));});
 thead.appendChild(tr);table.appendChild(thead);
 var body=make("tbody");
 result.careers.forEach(function(c){
  var line=make("tr");
  line.appendChild(make("td",null,c.career));
  line.appendChild(make("td",null,c.students.length));
  c.nuclei.forEach(function(n){
   line.appendChild(make("td",null,n.average===null?"Sin nota":"Prom.: "+n.average.toFixed(2)+" · n="+n.graded));
  });
  body.appendChild(line);
 });
 table.appendChild(body);
 var scroll=make("div","inf-table-scroll");scroll.appendChild(table);container.appendChild(scroll);
}
async function loadResults(){
 if(!state.schedule)return;
 state.results=null;showResults();
 if(!window.ConInf||typeof window.ConInf.read!=="function"){
  el("inf-results-summary").textContent="El conector ConInf no está disponible. Los cronogramas y el PDF parcial siguen habilitados.";return;
 }
 state.loadingResults=true;
 try{
  var dbPeriod=periodIdFor(state.schedule.period);
  if(!dbPeriod){
   el("inf-results-summary").textContent="El período "+state.schedule.period+
    " no coincide con un identificador de período de BDLocal. No se mezclarán datos de otros períodos.";
   return;
  }
  var snapshot=await window.ConInf.read({periodoId:dbPeriod});
  if(state.schedule.period!==text(el("inf-period").value))return;
  state.results=window.InfResults.build(snapshot,state.careers);
  showResults();
 }catch(error){
  el("inf-results-summary").textContent="No se pudieron consultar resultados de BDLocal: "+error.message+
   ". El PDF parcial de los capítulos anteriores permanece disponible.";
 }finally{state.loadingResults=false;}
}
async function loadPeriodsFromBD(){
 if(!window.ConInf||typeof window.ConInf.listPeriods!=="function")return;
 try{
  var rows=await window.ConInf.listPeriods();
  state.periods=Array.isArray(rows)?rows:[];
  var d=el("inf-period-options");
  var existing=Array.from(d.children).map(function(o){return o.value;});
  state.periods.forEach(function(p){
   var name=text(p.label||p.nombre||p.periodoLabel||p.nombrePeriodo||p.id||p.periodoId);
   if(name&&existing.indexOf(name)<0){var opt=make("option");opt.value=name;d.appendChild(opt);existing.push(name);}
  });
  await loadResults();
 }catch(error){el("inf-results-summary").textContent="No fue posible listar los períodos de BDLocal: "+error.message;}
}
function loadPeriod(){
 if(state.dirty&&!window.confirm("Hay cambios sin guardar. ¿Deseas cambiar de período?"))return;
 try {
  state.schedule=window.InfSchedules.load(el("inf-period").value);
  state.dirty=false;showRows("complexivo");showRows("trabajo");renderGantts();
  el("inf-schedule-origin").textContent=state.schedule.source+". Estados inicialmente sin verificar; confirma el cumplimiento con evidencias.";
  message("Período: "+state.schedule.period+". Revisa los cronogramas antes de generar el PDF.");
  if(state.periods.length)loadResults();
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
  var report=window.InfReport.buildAvailable();
  if(!report.canExportDraft)throw Error("Todavía no hay capítulos disponibles para exportar.");
  await window.InfPDF.download({report:report,schedule:state.schedule,careers:state.careers,results:state.results});
  message("PDF de avance generado con los capítulos "+report.includedChapters.join(", ")+
    ". Los demás capítulos no se incluyen hasta disponer de su contenido.");
 }catch(e){message("No se generó el PDF: "+e.message,true);}
 finally{button.disabled=false;}
}
function boot(){
 try{
  var r=showIndex();
  /* Un diagrama faltante nunca debe impedir abrir el módulo o descargar
     un borrador con los textos que ya están disponibles. */
  try { showDiagrams(); }
  catch(diagramError) {
    state.careers=[];
    el("inf-nuc-count").textContent="Diagramas pendientes de revisión";
    el("inf-diagrams").textContent="No se pudieron completar los diagramas: "+diagramError.message;
  }
  fillPeriods();loadPeriod();
  loadPeriodsFromBD();
  el("inf-period-load").addEventListener("click",loadPeriod);
  el("inf-period").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();loadPeriod();}});
  el("inf-add-complexivo").addEventListener("click",function(){addRow("complexivo");});
  el("inf-add-trabajo").addEventListener("click",function(){addRow("trabajo");});
  el("inf-schedule-save").addEventListener("click",savePeriod);
  el("inf-pdf").addEventListener("click",downloadPdf);
  message("Inf preparado: "+r.coverage.completed+" apartados con texto; "+r.coverage.pending+" pendientes. Los resultados de estudiantes aún no están conectados.");
  window.InfApp=Object.freeze({getDraft:function(){return window.InfReport.build();},
    getSchedules:function(){return JSON.parse(JSON.stringify(state.schedule));},
    getResults:function(){return state.results;},
    loadPeriod:loadPeriod,savePeriod:savePeriod,downloadPdf:downloadPdf});
 }catch(e){message("Error al iniciar Inf: "+e.message,true);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})(window,document);
