/* Centro Ncomplex: experiencia compacta de núcleos y complexivo.
 * No utiliza nombres de estudiante como clave y nunca certifica notas incompletas. */
(function(w,d){"use strict";
var ui={},data={mode:"nucleos",period:"",career:"",group:"",nucleus:1,
 periods:[],students:[],historicalStudents:[],careerBaseByCode:{},nuclei:[],exams:[],preview:null,working:false,started:false,lastCloud:null,overrides:{},nucleusWarning:"",cloudInventory:null,inventoryBusy:false};
function t(v){return String(v==null?"":v).trim();}
function norm(v){return t(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function $(id){return d.getElementById(id);}
function el(tag,txt,cls){var n=d.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=String(txt);if(cls)n.className=cls;return n;}
function msg(txt,kind){if(!ui.message)return;ui.message.textContent=txt;ui.message.className="nc-message"+(kind?" is-"+kind:"");}
function progressUpdate(title,done,total,detail,percent,state){
 if(!ui.progress||!ui.progressBar)return;
 var value=percent===undefined?(total?Math.round(Math.max(0,done)/total*100):0):Number(percent);
 value=Math.max(0,Math.min(100,Math.round(Number.isFinite(value)?value:0)));
 ui.progress.hidden=false;
 ui.progress.className="nc-save-progress"+(state?" is-"+state:"");
 ui.progressBar.value=value;
 ui.progressBar.setAttribute("aria-valuenow",String(value));
 ui.progressTitle.textContent=title;
 ui.progressPercent.textContent=value+"%";
 ui.progressDetail.textContent=detail||Math.max(0,done)+" de "+Math.max(0,total)+" registros procesados";
}
function progressReset(){if(ui.progress)ui.progress.hidden=true;}
function inventoryKey(){return [data.period,data.career,data.mode,data.mode==="nucleos"?data.nucleus:0].join("|");}
function clearInventory(){
 data.cloudInventory=null;
 var panel=$("nc-firebase-inventory");
 if(panel)panel.hidden=true;
}
function option(select,value,label){var o=el("option",label);o.value=value;select.appendChild(o);}
function studentId(r){return t(r.cedula||r.numeroIdentificacion||r.NumeroIdentificacion||r._cedula);}
function studentName(r){return t(r.Nombres||r.nombres||r.nombreCompleto||r.nombre||r.Nombre);}
function studentCareer(r){return t(r.NombreCarrera||r.nombreCarrera||r.Carrera||r.carrera);}
function studentCode(r){return t(r.CodigoCarrera||r.codigoCarrera||r.codigo_carrera)||studentCareer(r);}
function studentMode(r){return t(r.modalidadTitulacion);}
function careerBase(value){
 var smart=w.NcomplexSmart;
 var key=smart&&smart.baseCareer?smart.baseCareer(value):t(value).toLowerCase();
 return data.careerBaseByCode[key]||key;
}
function sameCareer(code){return !!data.career&&careerBase(code)===careerBase(data.career);}
function careerLabel(value){
 return t(value).replace(/(?:\s+|\s*[-–()]\s*)(?:ONLINE|ON LINE|EN L[IÍ]NEA|VIRTUAL|PRESENCIAL|PVC)\s*\)?$/i,"").trim();
}
function currentGroup(st){
 var verified=groupGuess(st);
 return verified||""; // Grupo desconocido no impide guardar en BDLocal.
}
function activeStudent(s){
 var estado=t(s.estadoMatricula||s._estadoMatricula).toUpperCase();
 return s.eliminado!==true&&s.retirado!==true&&estado==="ACTIVO";
}
function nineRequirements(s){
 var policy=w.NcomplexNucleosPolicy;
 return !!(policy&&policy.check(s&&s._ncomplexRequirements,"complexivo").eligible);
}
function currentRows(){return data.students.filter(function(s){
 return sameCareer(studentCode(s))&&nineRequirements(s);
});}
function excludedByRequirements(){return data.students.filter(function(s){
 return sameCareer(studentCode(s))&&!nineRequirements(s);
});}
function requirementDiagnosis(st){
 var evaluation=st&&st._ncomplexRequirements;
 if(!evaluation||!Array.isArray(evaluation.requirements)){
  return {name:studentName(st),unknown:true,reason:t(evaluation&&evaluation.reason)||
   "BDLocal no entregó los nueve estados verificables."};
 }
 var missing=evaluation.requirements.filter(function(item){return t(item.status).toUpperCase()!=="CUMPLE";});
 return {name:studentName(st),unknown:false,missing:missing,reason:evaluation.reason||""};
}
function requirementSummary(students){
 var stats=Object.create(null),unknown=0;
 (students||[]).forEach(function(st){
  var diagnosis=requirementDiagnosis(st);
  if(diagnosis.unknown){unknown++;return;}
  diagnosis.missing.forEach(function(item){
   var key=t(item.label||item.key),state=t(item.status).toUpperCase()||"SIN DATO";
   var id=key+"|"+state;
   if(!stats[id])stats[id]={label:key,status:state,count:0};
   stats[id].count++;
  });
 });
 var lines=Object.keys(stats).map(function(k){return stats[k];}).sort(function(a,b){
  return b.count-a.count||a.label.localeCompare(b.label,"es");
 }).map(function(item){return item.label+" ["+item.status+"]: "+item.count;});
 if(unknown)lines.unshift("Sin validación disponible desde BDLocal: "+unknown);
 return lines;
}
function cloudCount(){return data.nuclei.filter(function(r){return r.estadoSync!=="SINCRONIZADO"&&(!data.career||sameCareer(r.codigoCarrera));}).length;}
function currentConflicts(){return data.nuclei.filter(function(r){
 return r.estadoSync==="CONFLICTO" && sameCareer(r.codigoCarrera) && (!data.group||r.grupoInforme===data.group);
});}
function nucleusRequirements(student){
 var check=student&&student._ncomplexRequirements;
 return w.NcomplexNucleosPolicy&&w.NcomplexNucleosPolicy.check(check,"complexivo");
}
function careerInfo(){
 var first=currentRows()[0]||data.students.find(function(s){return sameCareer(studentCode(s));});
 return first?{name:careerLabel(studentCareer(first)||studentCode(first)),code:data.career}:null;
}
function nucleusCatalog(){try{return w.InfNuclei&&w.InfNuclei.careers?w.InfNuclei.careers():[];}catch(e){return [];}}
function nucleusTitle(number){
 var name=careerInfo()&&careerInfo().name,base=w.NcomplexSmart&&w.NcomplexSmart.baseCareer;
 var entry=nucleusCatalog().find(function(c){return base?base(c.career)===base(name):norm(c.career)===norm(name);});
 return entry&&entry.nuclei[number-1]?entry.nuclei[number-1].name:"Núcleo "+number;
}
function groupGuess(st){
 var name=studentCareer(st).toLowerCase(),code=studentCode(st).toLowerCase(),
  study=t(st.modalidadEstudio||st.tipoModalidad||st.Modalidad||"").toLowerCase();
 var registered=t(st.grupoInforme).toUpperCase();
 return /pvc/.test(study+" "+name+" "+code)?"PVC":
  /online|en.linea|virtual/.test(study+" "+name+" "+code)?"ONLINE":
  /presencial/.test(study)?"PRESENCIAL":
  ["PRESENCIAL","ONLINE","PVC"].indexOf(registered)>=0?registered:"";
}
function showGroup(){
 var roster=currentRows(),groups=roster.map(groupGuess),
  guesses=Array.from(new Set(groups.filter(Boolean)));
 // Solo autoseleccionar cuando TODAS las matrículas tienen el mismo grupo acreditado.
 // Cuando están mezcladas, el grupo del selector es únicamente respaldo para las no identificadas.
 var value=roster.length&&groups.every(Boolean)&&guesses.length===1?guesses[0]:"";
 if(data.group)value=data.group;
 data.group=value;ui.group.value=value;
}
function syncClassic(){
 var select=$("ncomplex-filter-periodo");
 if(select&&select.value!==data.period){
  select.value=data.period;
  select.dispatchEvent(new Event("change",{bubbles:true}));
 }
 var group=$("ncomplex-complexivo-grupo");
 if(group)group.value=data.group;
}
async function refresh(){
 if(!data.period)return;
 var con=w.ConNcomplex;if(!con)throw Error("ConNcomplex no está preparado.");
 var period=data.period;
 var result=await Promise.all([
  con.listStudents({periodoId:period}),
  con.listEvaluations({periodoId:period}),
  w.NcomplexNucleosStore.list(period).then(function(rows){
   data.nucleusWarning="";return rows;
  }).catch(function(error){
   data.nucleusWarning="No se pudieron leer las notas de núcleos: "+(error.message||error);
   return [];
  })
 ]);
 if(data.period!==period)return;
 var allStudents=(result[0]||[]).filter(function(row){return row.eliminado!==true;});
 data.students=allStudents.filter(activeStudent);
 data.historicalStudents=allStudents.filter(function(row){return !activeStudent(row);});
 data.exams=result[1]||[];data.nuclei=result[2]||[];
 data.careerBaseByCode=Object.create(null);
 // Los códigos de carrera pueden diferir aunque el nombre académico sea igual.
 data.students.forEach(function(st){
  var normalize=w.NcomplexSmart&&w.NcomplexSmart.baseCareer;
  if(!normalize)return;
  var raw=normalize(studentCode(st)),label=normalize(studentCareer(st)||studentCode(st));
  if(raw&&label&&!data.careerBaseByCode[raw])data.careerBaseByCode[raw]=label;
 });
 var careers=Object.create(null);
 data.students.forEach(function(st){
  var key=careerBase(studentCode(st)),label=careerLabel(studentCareer(st)||studentCode(st));
  if(key&&label&&(!careers[key]||groupGuess(st)!=="ONLINE"))careers[key]=label;
 });
 var previous=data.career,previousKey=careerBase(previous);
 ui.career.textContent="";option(ui.career,"","Seleccionar carrera");
 var keys=Object.keys(careers).sort(function(a,b){return careers[a].localeCompare(careers[b],"es");});
 keys.forEach(function(k){option(ui.career,careers[k],careers[k]);});
 data.career=careers[previousKey]||"";
 if(!data.career){
  var initial=keys.find(function(k){return !/sin carrera/i.test(careers[k]);})||keys[0];
  data.career=initial?careers[initial]:"";
  data.nucleus=1;
 }
 ui.career.value=data.career;showGroup();syncClassic();render();
}
async function loadPeriod(){
 if(!data.working){progressReset();clearInventory();}
 data.period=ui.period.value;data.career="";data.group="";data.preview=null;data.overrides={};data.lastCloud=null;ui.review.textContent="";
 if(!data.period){data.students=[];data.historicalStudents=[];data.nuclei=[];data.exams=[];render();return;}
 syncClassic();
 msg("Consultando estudiantes y calificaciones…");
 try{await refresh();msg(data.nucleusWarning||"Período cargado. Elige una carrera para consultar las notas.",
 data.nucleusWarning?"error":"ok");}
 catch(e){msg(e.message||String(e),"error");}
}
function mode(v){
 if(!data.working){progressReset();clearInventory();}
 data.mode=v;data.preview=null;data.overrides={};ui.review.textContent="";
 ui.save.disabled=true;
 ui.tabN.classList.toggle("is-active",v==="nucleos");
 ui.tabE.classList.toggle("is-active",v==="complexivo");
 ui.tabN.setAttribute("aria-selected",v==="nucleos"?"true":"false");
 ui.tabE.setAttribute("aria-selected",v==="complexivo"?"true":"false");
 ui.picker.hidden=v!=="nucleos";render();
}
function nucleus(number){
 if(!data.working){progressReset();clearInventory();}
 data.nucleus=number;data.preview=null;data.overrides={};ui.review.textContent="";ui.save.disabled=true;
 Array.prototype.forEach.call(ui.picker.querySelectorAll("[data-nc-nucleus]"),function(b){
  b.classList.toggle("is-active",Number(b.dataset.ncNucleus)===number);
 });
 render();
}
function showPending(){
 var target=$("nc-pending-panel");
 if(!target)return;
 target.hidden=!target.hidden;
 if(target.hidden)return;
 target.textContent="";
 target.appendChild(el("strong","Pendientes de "+(data.mode==="nucleos"?"Núcleo "+data.nucleus:"Examen Complexivo")));
 var ids=Object.create(null),reports=[];
 if(data.mode==="nucleos"){
  data.nuclei.filter(function(r){return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus;}).forEach(function(r){ids[r.cedula]=r;});
 }else data.exams.forEach(function(r){ids[studentId(r)]=r;});
 currentRows().forEach(function(st){
  var row=ids[studentId(st)],reasons=[];
  var checked=st._ncomplexRequirements,requirements=checked&&checked.requirements||[];
  var check=w.NcomplexNucleosPolicy.check(checked,"complexivo");
  if(!check.eligible)reasons=reasons.concat(check.missing);
  if(!row)reasons.push("Sin calificaciones");
  else if(data.mode==="nucleos"){
   row.evaluaciones.forEach(function(g,i){if(g===null||g===undefined)reasons.push("Falta E"+(i+1));});
   if(row.totalMoodle===null)reasons.push("Falta Total Moodle");
   if(row.estadoSync!=="SINCRONIZADO")reasons.push("Firebase: "+row.estadoSync);
   if(row.cloudError)reasons.push(row.cloudError);
  }else if(row.notaOficial===null||row.notaOficial===undefined)reasons.push("Falta nota final");
  if(reasons.length)reports.push({name:studentName(st),issues:reasons});
 });
 target.appendChild(el("p",reports.length+" estudiantes con pendientes."));
 if(!reports.length)return;
 var list=el("ul");
 reports.slice(0,35).forEach(function(item){
  list.appendChild(el("li",item.name+": "+item.issues.join(", ")));
 });
 target.appendChild(list);
 if(reports.length>35)target.appendChild(el("p","Se muestran los primeros 35; utiliza Buscar para revisar los demás."));
}
function careerOptions(){
 return Array.prototype.map.call(ui.career.options||[],function(o){return {code:o.value,label:o.textContent};}).filter(function(r){return !!r.code;});
}
function guide(){
 var title=$("nc-guide-title"),detail=$("nc-guide-detail"),next=$("nc-next-task");if(!title||!detail)return;
 if(!data.period){title.textContent="Selecciona el período";detail.textContent="El sistema comenzará con la primera carrera y el Núcleo 1.";next.hidden=true;return;}
 if(!data.career){title.textContent="Selecciona una carrera";detail.textContent="Carreras recuperadas de BDLocal.";next.hidden=true;return;}
 title.textContent=(careerInfo()&&careerInfo().name||data.career)+" · "+(data.mode==="nucleos"?"Núcleo "+data.nucleus+" — "+nucleusTitle(data.nucleus):"Examen complexivo");
 var eligibleStudents=data.students.filter(nineRequirements);
 var task=w.NcomplexSmart&&w.NcomplexSmart.nextTask(careerOptions(),eligibleStudents,data.nuclei,data.career,data.nucleus);
 var same=task&&task.career===data.career&&task.nucleus===data.nucleus;
 detail.textContent=task?(same?"Pega las calificaciones de este núcleo o elige otro si ya las tienes.":
  "Siguiente pendiente: "+task.name+" · Núcleo "+task.nucleus):
  data.mode==="nucleos"?
   (!currentRows().length?"No hay matrículas con nueve requisitos CUMPLE verificados. Consulta el diagnóstico al analizar Moodle.":
    "No hay núcleos pendientes registrados para esta carrera."):
   "Revisa las notas del complexivo y las incidencias del período.";
 next.hidden=!task||same;
 if(task){next.dataset.career=task.career;next.dataset.nucleus=String(task.nucleus);}
}
function summary(){
 var roster=currentRows(),ids=Object.create(null),loaded=Object.create(null),complete=Object.create(null);
 roster.forEach(function(st){ids[studentId(st)]=true;});
 var records=data.mode==="nucleos"?
 data.nuclei.filter(function(r){return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus;}):
 data.exams.filter(function(r){return ids[studentId(r)]&&studentMode(r)==="EXAMEN_COMPLEXIVO";});
 records.forEach(function(r){
  var id=studentId(r);if(!ids[id])return;
  var grades=data.mode==="nucleos"?(r.evaluaciones||[]).concat([r.taller,r.prueba,r.casoEstudio,r.totalMoodle]):
    [r.notaTeorica,r.notaPractica,r.notaOficial];
  if(grades.some(function(v){return v!==null&&v!==undefined;}))loaded[id]=true;
  if(data.mode==="nucleos" &&r.estadoCarga==="CONCILIADO"&&r.habilitado===true&&
    Array.isArray(r.evaluaciones)&&r.evaluaciones.length===4&&
    r.evaluaciones.every(function(v){return v!==null&&v!==undefined;})&&r.totalMoodle!=null)complete[id]=true;
  if(data.mode==="complexivo"&&r.notaOficial!=null)complete[id]=true;
 });
 $("nc-students").textContent=roster.length;
 $("nc-loaded").textContent=Object.keys(loaded).length;
 $("nc-missing").textContent=Math.max(0,roster.length-Object.keys(complete).length);
 $("nc-sync-pending").textContent=cloudCount();
 var remote=data.cloudInventory&&data.cloudInventory.key===inventoryKey()?data.cloudInventory.result:null;
 if(remote){
  ui.cloud.textContent="Firebase: "+remote.uploaded+" de "+remote.total+" ya subidos"+
   (remote.errors?" · "+remote.errors+" sin comprobar":"")+
   (remote.different?" · "+remote.different+" con diferencias":"");
  ui.cloud.className="nc-cloud-pill"+(remote.total>0&&remote.uploaded===remote.total&&
   !remote.errors&&!remote.different?" is-ok":" is-warn");
 }else{
  ui.cloud.textContent="Firebase sin consultar · "+cloudCount()+" pendientes según BDLocal";
  ui.cloud.className="nc-cloud-pill is-warn";
 }
 var conflicts=$("nc-show-conflicts");if(conflicts){
  conflicts.hidden=currentConflicts().length===0;
  conflicts.textContent="Conflictos ("+currentConflicts().length+")";
 }
 guide();
}
function td(value,css){var n=el("td",value,css);return n;}
function label(status){
 if(status==="CONCILIADO"||status==="APROBADO")return ["Conciliado","is-ok"];
 if(status==="INHABILITADO")return ["No habilitado","is-warn"];
 if(status==="SIN_VERIFICAR")return ["Por verificar","is-warn"];
 if(status==="CONFLICTO")return ["Conflicto","is-warn"];
 if(status==="ERROR")return ["Error de nube","is-warn"];
 return [status==="PENDIENTE"?"Incompleto":"Sin notas",""];
}
function fmt(v){return v===null||v===undefined||t(v)===""?"—":Number(v).toFixed(2);}
function render(){
 if(!ui.table)return;
 ui.picker.hidden=data.mode!=="nucleos";
 ui.title.textContent=data.mode==="nucleos"?"Núcleo "+data.nucleus+" · "+nucleusTitle(data.nucleus):"Examen Complexivo · Teórico 40 % / Práctico 60 %";
 var hasCase=data.mode==="nucleos"&&data.nuclei.some(function(r){
  return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus&&r.casoEstudio!=null;
 });
 var names=data.mode==="nucleos"?["Estudiante","Grupo","E1","E2","E3","E4","Taller","Prueba"]
  .concat(hasCase?["Caso"]:[]).concat(["Total Moodle","Requisitos","Estado"]):
  ["Estudiante","Grupo","Teórico","Práctico","Final","Requisitos","Estado"];
 var thead=ui.table.querySelector("thead"),tbody=ui.table.querySelector("tbody");
 thead.textContent="";tbody.textContent="";var tr=el("tr");
 names.forEach(function(name){tr.appendChild(el("th",name));});thead.appendChild(tr);
 var roster=currentRows(),needle=norm(ui.search.value);
 var rows=roster.filter(function(st){return !needle||norm(studentName(st)+studentId(st)).includes(needle);});
 var saved=Object.create(null);
 if(data.mode==="nucleos")data.nuclei.filter(function(r){return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus;}).forEach(function(r){saved[r.cedula]=r;});
 else data.exams.forEach(function(r){saved[studentId(r)]=r;});
 rows.slice(0,80).forEach(function(st){
  var row=saved[studentId(st)],line=el("tr");
  line.appendChild(td(studentName(st)||studentId(st)));
  line.appendChild(td(groupGuess(st)||row&&row.grupoInforme||data.group||"Por confirmar"));
  if(data.mode==="nucleos"){
   var numbers=row&&row.evaluaciones||[null,null,null,null];
   numbers.concat([row&&row.taller,row&&row.prueba])
    .concat(hasCase?[row&&row.casoEstudio]:[]).concat([row&&row.totalMoodle])
    .forEach(function(v){line.appendChild(td(fmt(v),v==null?"nc-muted":""));});
  }else{
   [row&&row.notaTeorica,row&&row.notaPractica,row&&row.notaOficial].forEach(function(v){line.appendChild(td(fmt(v),v==null?"nc-muted":""));});
  }
  var checks=data.mode==="nucleos"?nucleusRequirements(st):
   w.NcomplexNucleosPolicy.check(st._ncomplexRequirements,"complexivo");
  var needs=checks&&!checks.eligible?checks.missing:[];
  var reqLabel=checks&&checks.eligible?"Habilitado":checks&&!checks.verified?"Por verificar":"Pendiente";
  var requirement=el("td"),reqChip=el("span",reqLabel,"nc-tag "+(checks&&checks.eligible?"is-ok":"is-warn"));
  if(needs.length)reqChip.title=needs.join("; ");
  requirement.appendChild(reqChip);line.appendChild(requirement);
  var rawState=row&&(data.mode==="nucleos"?(row.estadoSync==="CONFLICTO"?"CONFLICTO":row.estadoCarga):row.estadoEvaluacion);
  var state=label(rawState),cell=el("td"),chip=el("span",state[0],"nc-tag "+state[1]);
  if(row&&row.observaciones)chip.title=row.observaciones;
  cell.appendChild(chip);line.appendChild(cell);
  tbody.appendChild(line);
 });
 var blocked=excludedByRequirements();
 var reqSummary=requirementSummary(blocked);
 ui.more.textContent=(blocked.length?blocked.length+" matrícula(s) sin verificación 9/9. "+
  (reqSummary.length?"Causas: "+reqSummary.slice(0,4).join(" · ")+". ":""):"")+
  (rows.length>80?"Mostrando los primeros 80 de "+rows.length+". Usa Buscar para filtrar.":"");
 summary();
}
function promptImport(open){
 ui.importBox.hidden=!open;if(open)ui.paste.focus();
}
function moodlePeriodHint(value){
 var source=t(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 var end=source.match(/\b(?:oct|octubre)\s*[-– ]+\s*(?:mar|marzo)\s*(20\d{2}|\d{2})\b/);
 if(end){var year=Number(end[1]);if(year<100)year+=2000;return (year-1)+"-10__"+year+"-03";}
 var same=source.match(/\b(?:abr|abril)\s*[-– ]+\s*(?:sep|sept|septiembre)\s*(20\d{2}|\d{2})\b/);
 if(same){var y=Number(same[1]);if(y<100)y+=2000;return y+"-04__"+y+"-09";}
 return "";
}
async function analyze(){
 var raw=t(ui.paste.value);
 if(!raw){msg("Pega el libro de Moodle para identificar el curso y las notas.","error");return;}
 var smart=w.NcomplexSmart;
 var foundKind=smart&&smart.kind(raw);
 if(foundKind==="ambiguous"){msg("Se detectaron dos libros de calificaciones mezclados. Pega uno a la vez.","error");return;}
 if(foundKind&&foundKind!==data.mode)mode(foundKind);
 var headerPeriod=smart&&smart.periodId(raw.slice(0,1200));
 if(!data.period&&headerPeriod&&data.periods.some(function(p){
  return t(p.id||p.periodoId||p.periodId).replace(/_+/g,"__")===headerPeriod;
 })){
  ui.period.value=headerPeriod;
  await loadPeriod();
 }
 if(!data.period){
  msg(headerPeriod?"El período de Moodle no está registrado en BDLocal. Selecciona el correcto.":
   "Selecciona el período académico para conciliar las matrículas.","error");
  return;
 }
 var parser=data.mode==="nucleos"?w.NcomplexNucleosParser:w.NcomplexParser;
 if(!parser||typeof parser.parse!=="function")throw Error("El lector de Moodle no está disponible.");
 var parsed=parser.parse(raw);
 var detected=smart&&smart.identify(raw,parsed,nucleusCatalog(),careerOptions(),
  data.periods.map(function(p){return {id:t(p.id||p.periodoId||p.periodId).replace(/_+/g,"__")};}),
  {career:data.career});
 if(detected&&detected.kind==="nucleos"&&detected.careerId&&detected.careerId!==data.career){
  data.career=detected.careerId;data.group="";ui.career.value=data.career;showGroup();syncClassic();
 }
 if(detected&&detected.nucleus&&data.mode==="nucleos"&&detected.nucleus!==data.nucleus){
  nucleus(detected.nucleus);
 }
 var periodCorrect=!headerPeriod||headerPeriod===data.period;
 var courseCorrect=true;
 if(data.mode==="nucleos"&&detected&&detected.nucleus){
  var available=detected.careers||[];
  courseCorrect=detected.nucleus===data.nucleus&&
   available.some(function(c){return c.code===data.career;});
 }
 if(!data.career){msg("Selecciona la carrera de la matrícula para comparar los estudiantes.","error");}
 var selected=currentRows(),matched={matches:[],review:[],unmatched:[],duplicates:[],conflicts:[],matched:0},
  foreign=[],notQualified=[],withdrawn=[],unlinked=[];
 if(data.career){
  if(data.mode==="nucleos"){
   // Nunca vincular una fila Moodle con cualquier persona del desplegable.
   // Identificar los otros grupos, requisitos y retiros por su propia identidad.
   var parserN=w.NcomplexNucleosParser;
   var all=parserN.match(parsed.rows||[],data.students,{});
   var activeRows=Object.create(null);
   (all.matches||[]).forEach(function(item){activeRows[item.imported.rowNumber]=true;});
   Object.keys(all.duplicates||{}).forEach(function(ced){
    (all.duplicates[ced]||[]).forEach(function(item){activeRows[item.imported.rowNumber]=true;});
   });
   var identified=(all.matches||[]).slice();
   Object.keys(all.duplicates||{}).forEach(function(ced){
    (all.duplicates[ced]||[]).forEach(function(item){identified.push(item);});
   });
   foreign=identified.filter(function(item){return !sameCareer(studentCode(item.student));});
   notQualified=identified.filter(function(item){
    return sameCareer(studentCode(item.student))&&!nineRequirements(item.student);
   });
   var excludedIds=Object.create(null);
   foreign.concat(notQualified).forEach(function(item){excludedIds[item.imported.rowNumber]=true;});
   var history=parserN.match((parsed.rows||[]).filter(function(row){return !excludedIds[row.rowNumber];}),
    data.historicalStudents,{}).matches||[];
   withdrawn=history.filter(function(item){
    return !excludedIds[item.imported.rowNumber]&&!activeRows[item.imported.rowNumber];
   });
   withdrawn.forEach(function(item){excludedIds[item.imported.rowNumber]=true;});
   var relevant=(parsed.rows||[]).filter(function(row){return !excludedIds[row.rowNumber];});
   matched=parserN.match(relevant,selected,data.overrides);
   unlinked=(matched.review||[]).filter(function(item){
    return item.row&&!item.row.blocked&&!item.cedula;
   });
  }else{
   matched=w.NcomplexMatcher.match(parsed.rows||[],selected);
  }
 }
 data.preview={kind:data.mode,period:data.period,career:data.career,nucleus:data.nucleus,group:data.group,
  parsed:parsed,matched:matched,foreign:foreign,notQualified:notQualified,withdrawn:withdrawn,
  unlinked:unlinked,courseMatch:courseCorrect,periodMatch:periodCorrect,source:raw};
 ui.review.textContent="";
 var issues=(parsed.errors||[]).slice(),warn=(parsed.warnings||[]).slice();
 var toReview=(matched.review||[]).length-unlinked.length+
  (matched.unmatched||[]).length+(matched.conflicts||[]).length;
 var excludedCount=unlinked.length+notQualified.length+withdrawn.length;
 var report=el("p",(parsed.rows||[]).length+" filas Moodle · "+selected.length+
  " matrículas habilitadas (9/9) · "+(matched.matches||[]).length+" vinculadas · "+
  toReview+" por revisar · "+excludedCount+" excluidas · "+
  foreign.length+" de otras carreras apartadas");
 ui.review.appendChild(report);
 if(data.mode==="nucleos"&&(parsed.rows||[]).some(function(r){return r.casoEstudio!==null&&r.casoEstudio!==undefined;}))
  ui.review.appendChild(el("p","Caso de estudio identificado y conservado junto con las cuatro evaluaciones."));
 if(!periodCorrect){
  ui.review.appendChild(el("p","El curso corresponde a otro período ("+headerPeriod+"). No se guardarán notas en el período equivocado.","nc-message is-error"));
  var possible=data.periods.some(function(p){return t(p.id||p.periodoId||p.periodId).replace(/_+/g,"__")===headerPeriod;});
  if(possible){
   var changePeriod=el("button","Cambiar al período del curso","nc-context-action");
   changePeriod.type="button";changePeriod.addEventListener("click",function(){
    ui.period.value=headerPeriod;loadPeriod().then(analyze).catch(function(e){msg(e.message,"error");});
   });ui.review.appendChild(changePeriod);
  }
 }
 if(data.mode==="nucleos"&&detected){
  var info=el("p","Curso detectado: "+(detected.careerName||"carrera por confirmar")+
   (detected.nucleus?" · Núcleo "+detected.nucleus+" — "+detected.nucleusName:""));
  ui.review.appendChild(info);
  if(!detected.careerId&&detected.careers&&detected.careers.length){
   var choice=el("div",null,"nc-context-options");
   choice.appendChild(el("span","Confirma la carrera para importar las modalidades juntas:"));
   detected.careers.forEach(function(candidate){
    var btn=el("button",candidate.label);btn.type="button";
    btn.addEventListener("click",function(){
     data.career=candidate.code;data.group="";ui.career.value=data.career;showGroup();syncClassic();
     analyze().catch(function(e){msg(e.message,"error");});
    });choice.appendChild(btn);
   });ui.review.appendChild(choice);
  }
  if(!detected.nucleus)issues.push("No se reconoció un núcleo único; selecciónalo en la pantalla.");
 }
 if(!courseCorrect)issues.push("Confirma la carrera y el núcleo antes de guardar.");
 var withoutKnownGroup=(matched.matches||[]).filter(function(item){return !currentGroup(item.student);});
 if(withoutKnownGroup.length)issues.push(withoutKnownGroup.length+
  " matrícula(s) sin modalidad verificable. Se podrán guardar en BDLocal; Firebase requerirá que BDLocal confirme su grupo.");
 if((matched.matches||[]).length){
  var groupCounts=Object.create(null);
  matched.matches.forEach(function(item){
   var group=currentGroup(item.student)||"SIN VERIFICAR";
   groupCounts[group]=(groupCounts[group]||0)+1;
  });
  ui.review.appendChild(el("p","Se guardarán las modalidades por matrícula: "+
   Object.keys(groupCounts).map(function(k){return k+" ("+groupCounts[k]+")";}).join(", ")+
   ". Los grupos no verificados no se inventan."));
 }
 if(!selected.length)issues.push("No hay matrículas habilitadas: se requieren los nueve requisitos en estado CUMPLE y matrícula ACTIVA.");
 if(excludedByRequirements().length){
  var excludedActive=excludedByRequirements(),causes=requirementSummary(excludedActive);
  ui.review.appendChild(el("p",excludedActive.length+
   " matrícula(s) activa(s) no tienen los nueve requisitos CUMPLE verificados. "+
   "No se presupone incumplimiento: revisa si el estado es PENDIENTE, NO CUMPLE o SIN DATO."));
  if(causes.length){
   var breakdown=el("div",null,"nc-requirements-breakdown");
   breakdown.appendChild(el("strong","Diagnóstico de requisitos desde BDLocal:"));
   var breakdownList=el("ul");
   causes.forEach(function(item){breakdownList.appendChild(el("li",item));});
   breakdown.appendChild(breakdownList);
   ui.review.appendChild(breakdown);
  }
 }
 if(foreign.length){
  var alternative=Object.create(null);
  foreign.forEach(function(item){
   var name=studentCareer(item.student)||studentCode(item.student);
   alternative[name]=(alternative[name]||0)+1;
  });
  ui.review.appendChild(el("p",foreign.length+" fila(s) de otras carreras identificadas: "+
   Object.keys(alternative).map(function(name){return name+" ("+alternative[name]+")";}).join(", ")+
   ". Se apartaron de esta carga. Selecciona su carrera para importarlas por separado."));
 }
 var additional=(matched.review||[]).filter(function(r){return unlinked.indexOf(r)<0;}).map(function(r){return r.reason;})
  .concat((matched.unmatched||[]).map(function(r){return r.label+": "+r.reason;}))
  .concat((matched.conflicts||[]).map(function(r){return r.nombre+": conflicto con la nota local.";}));
 var problems=issues.concat(additional).concat(warn);
 if(problems.length){
  var list=el("ul");problems.slice(0,22).forEach(function(t){list.appendChild(el("li",t));});ui.review.appendChild(list);
 }
 if(data.mode==="nucleos"&&matched.duplicates){
  Object.keys(matched.duplicates).forEach(function(ced){
   var records=matched.duplicates[ced];
   if(!records||!records.length||!(matched.review||[]).some(function(r){return r.cedula===ced;}))return;
   var block=el("div",null,"nc-duplicate-group"),student=records[0].student;
   block.appendChild(el("strong","Duplicado: "+studentName(student)));
   var select=el("select");select.setAttribute("aria-label","Elegir registro de "+studentName(student));
   option(select,"","Elegir fila válida de Moodle");
   records.forEach(function(item){
    var row=item.imported;
    option(select,String(row.rowNumber),"Fila "+row.rowNumber+" · "+row.correo+" · "+fmt(row.totalMoodle));
   });
   select.value=data.overrides._rows&&String(data.overrides._rows[ced])||"";
   select.addEventListener("change",function(){
    data.overrides._rows=data.overrides._rows||{};
    if(select.value)data.overrides._rows[ced]=Number(select.value);
    else delete data.overrides._rows[ced];
    analyze().catch(function(e){msg(e.message,"error");});
   });
   block.appendChild(select);ui.review.appendChild(block);
  });
 }
 if(data.mode==="nucleos"&&(withdrawn.length||notQualified.length||unlinked.length)){
  var excluded=el("div",null,"nc-excluded");
  excluded.appendChild(el("strong","Filas Moodle excluidas de esta carga (sin vincular):"));
  var listing=el("ul");
  withdrawn.forEach(function(item){
   listing.appendChild(el("li",item.imported.nombreCompleto+" · "+item.imported.correo+
    " — Matrícula retirada/inactiva en BDLocal."));
  });
  notQualified.forEach(function(item){
   var diagnosis=requirementDiagnosis(item.student),missing=(diagnosis.missing||[]).map(function(req){
    return (req.label||req.key)+" ("+(req.status||"SIN DATO")+")";
   });
   listing.appendChild(el("li",item.imported.nombreCompleto+" · "+item.imported.correo+
    " — Matrícula activa sin los nueve requisitos CUMPLE. Detalle: "+(missing.join(", ")||diagnosis.reason)+"."));
  });
  unlinked.forEach(function(item){
   listing.appendChild(el("li",item.row.nombreCompleto+" · "+item.row.correo+
    " — Sin coincidencia única con una matrícula activa y habilitada. Verifica el retiro en BDLocal."));
  });
  excluded.appendChild(listing);ui.review.appendChild(excluded);
 }
 var unresolvedDuplicates=data.mode==="nucleos"&&Object.keys(matched.duplicates||{}).some(function(ced){
  return (matched.review||[]).some(function(item){return item.cedula===ced;});
 });
 if(unresolvedDuplicates)issues.push("Resuelve la fila válida de los estudiantes duplicados antes de guardar.");
 var canSave=!!parsed.ok&&periodCorrect&&courseCorrect&&!!data.career&&
  !unresolvedDuplicates&&matched.matches.length>0&&
  (data.mode==="nucleos"||matched.matches.some(function(x){return x.apply&&!x.hasConflict;}));
 ui.save.disabled=!canSave;
 render();
 msg(canSave?"Notas interpretadas. Revisa las coincidencias antes de guardar.":
  "Carga interpretada. Resuelve los datos señalados para continuar.",canSave?"ok":"error");
}
function digest(v){var str=JSON.stringify(v),h=2166136261;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return "moodle_"+(h>>>0).toString(16);}
// Las operaciones BDLocal y Firebase son independientes y requieren acciones
// explícitas. El progreso solo confirma persistencia o lectura ya completada.
async function publishSavedRecords(rows,mode,period,onProgress){
 var notify=typeof onProgress==="function"?onProgress:function(){};
 notify(0,rows&&rows.length||0,"Comprobando permisos institucionales…");
 if(!rows||!rows.length)return {ok:true,published:0,pending:0};
 var auth=w.NcomplexFirebaseAuth;
 if(!auth||typeof auth.requireWriter!=="function")
  return {ok:false,published:0,pending:rows.length,errors:1,conflicts:0,
   reason:"No está disponible la autenticación de Firebase. Comprueba la conexión e inicia sesión."};
 try{await auth.requireWriter();}
 catch(error){return {ok:false,published:0,pending:rows.length,errors:1,conflicts:0,
  reason:"Acceso Firebase: "+(t(error&&error.message||error)||"Conecta una cuenta institucional autorizada.")};}
 if(mode==="complexivo"){
  var publisher=w.NcomplexFirebaseComplexivo;
  if(!publisher||typeof publisher.publish!=="function")
   return {ok:false,published:0,pending:rows.length,errors:1,conflicts:0,reason:"Publicador de complexivo no disponible."};
  var published=0,conflicts=0,errors=0,reason="",validIds=rows.map(studentId),alreadyChecked=0;
  for(var i=0;i<Math.ceil(rows.length/25)+1;i++){
   var baseline=published;
   var response=await publisher.publish({
    periodoId:period,anyGroup:true,onlyCedulas:validIds,confirmedByCenter:true,
    onProgress:function(status){
     var n=Math.max(0,Math.min(rows.length,baseline+Number(status&&status.processed||0)));
     notify(n,rows.length,"Firebase: "+n+" de "+rows.length+" registros enviados para verificación");
    }
   });
   if(!response||response.ok!==true){
    errors++;reason=t(response&&(response.error||response.reason))||"Firebase no confirmó el examen.";
    break;
   }
   published+=Number(response.published||0);
   alreadyChecked=Math.max(alreadyChecked,published+Number(response.same||0));
   notify(Math.min(rows.length,alreadyChecked),rows.length,
    "Firebase: "+published+" publicados; "+Number(response.same||0)+" existentes iguales");
   conflicts+=(response.conflicts||[]).length;
   errors+=(response.invalid||[]).length+(response.blocked||[]).length;
   if(!response.published)break;
  }
  return {ok:!errors&&!conflicts,published:published,conflicts:conflicts,errors:errors,
   pending:errors?rows.length:0,reason:reason||(
    errors?"Hay notas sin modalidad verificable o requisitos incompletos.":"")};
 }
 var grouped=Object.create(null),published=0,unchanged=0,conflicts=0,errors=0,pending=0,unknown=0,done=0,
  details=[];
 rows.forEach(function(row){
  var group=t(row.grupoInforme),bucket=grouped[group]||(grouped[group]=[]);
  bucket.push(row);
 });
 for(var group of Object.keys(grouped)){
  var block=grouped[group],attempted=Object.create(null);
  if(!group){pending+=block.length;unknown+=block.length;errors+=block.length;done+=block.length;
    notify(done,rows.length,"Firebase: "+done+" revisados; faltan modalidades en BDLocal");continue;}
  if(mode==="nucleos"){
   if(!w.NcomplexNucleosFirebase||typeof w.NcomplexNucleosFirebase.push!=="function"){
    pending+=block.length;errors+=block.length;details.push("No está disponible el publicador de núcleos.");continue;
   }
   for(var i=0;i<Math.ceil(block.length/25)+1;i++){
    try{
     var offset=done;
     var result=await w.NcomplexNucleosFirebase.push({periodoId:period,grupoInforme:group,
      onlyIds:block.map(function(row){return row.id;}),skipIds:Object.keys(attempted),limit:25,
      onProgress:function(status){
       var current=Math.min(rows.length,offset+Number(status&&status.processed||0));
       notify(current,rows.length,"Firebase: verificando "+current+" de "+rows.length+" registros");
      }});
     (result.attemptedIds||[]).forEach(function(id){attempted[id]=true;});
     done=Math.min(rows.length,done+(result.attemptedIds||[]).length);
     notify(done,rows.length,"Firebase: "+done+" de "+rows.length+" registros comprobados");
     published+=Number(result.published||0);
     unchanged+=Number(result.unchanged||0);
     conflicts+=Number(result.conflicts||0);errors+=Number(result.errors||0);
     (result.details||[]).slice(0,3).forEach(function(item){
      details.push(t(item.reason)||"Error de publicación.");
     });
     if(!result.processed||!result.remaining)break;
    }catch(err){errors++;details.push(t(err&&err.message||err));break;}
   }
   pending+=Math.max(0,block.length-Object.keys(attempted).length);
  }else{
   var cloud=w.NcomplexFirebaseComplexivo;
   if(!cloud||typeof cloud.publish!=="function"){pending+=block.length;errors++;continue;}
   var cedulas=block.map(function(row){return studentId(row);});
   for(var batch=0;batch<Math.ceil(block.length/25)+1;batch++){
    var uploaded;
    try{uploaded=await cloud.publish({periodoId:period,grupoInforme:group,
      onlyCedulas:cedulas,confirmedByCenter:true});}
    catch(err){errors++;break;}
    if(!uploaded||uploaded.ok!==true){errors++;break;}
    published+=Number(uploaded.published||0);
    if(uploaded.conflicts&&uploaded.conflicts.length)conflicts+=uploaded.conflicts.length;
    if(uploaded.invalid&&uploaded.invalid.length)errors+=uploaded.invalid.length;
    if(uploaded.blocked&&uploaded.blocked.length)errors+=uploaded.blocked.length;
    notify(Math.min(rows.length,published),rows.length,"Firebase: "+published+" documentos confirmados");
    if(!uploaded.published)break;
   }
   // La colección complexivo comprueba idempotencia por período y cédula;
   // los registros ya existentes iguales no se vuelven a crear.
  }
 }
 return {ok:errors===0&&conflicts===0&&pending===0,published:published,unchanged:unchanged,
  conflicts:conflicts,errors:errors,pending:pending,
  reason:unknown?unknown+" matrícula(s) sin grupo verificable en BDLocal. Corrige el dato de modalidad antes de publicar en Firebase.":
   details.length?details.slice(0,3).join(" | "):
   errors||conflicts||pending?"Existen publicaciones pendientes o en conflicto.":""};
}
async function save(){
 if(data.working)throw Error("Ya existe una operación de Ncomplex en curso.");
 var p=data.preview;
 if(!p||!p.parsed||p.parsed.ok!==true||t(ui.paste.value)!==p.source||
  !p.matched||!p.matched.matches.length)
  throw Error("La importación no es válida o cambió; pulsa Analizar nuevamente.");
 if(data.mode==="nucleos"&&Object.keys(p.matched.duplicates||{}).some(function(ced){
  return (p.matched.review||[]).some(function(item){return item.cedula===ced;});
 }))throw Error("Resuelve los duplicados de Moodle antes de guardar en BDLocal.");
 if(p.period!==data.period||p.career!==data.career||p.kind!==data.mode||
 (data.mode==="nucleos"&&p.nucleus!==data.nucleus)||
 p.periodMatch!==true||p.courseMatch!==true)throw Error("El contexto o período cambió. Analiza nuevamente la importación.");
 ui.save.disabled=true;ui.publish.disabled=true;data.working=true;
 progressUpdate("Preparando guardado en BDLocal",0,p.matched.matches.length,
  "Comprobando requisitos y notas antes de escribir…",0);
 try{
  var con=w.ConNcomplex,stored=[],skipped=0;
  if(data.mode==="nucleos"){
   var records=await w.NcomplexNucleosStore.list(data.period),existing=Object.create(null);
   records.forEach(function(r){existing[r.id]=r;});
   var prepared=0,total=p.matched.matches.length;
   for(var item of p.matched.matches){
    try{
    var st=item.student,inc=item.imported,ced=studentId(st),id=w.NcomplexNucleosStore.id(data.period,ced,data.nucleus);
    var previous=existing[id]||null;
    var priorHash=digest(previous&&[previous.evaluaciones,previous.taller,previous.prueba,
     previous.casoEstudio==null?null:previous.casoEstudio,previous.actividadesAdicionales||[],previous.totalMoodle]);
    var currentHash=digest([inc.evaluaciones,inc.taller,inc.prueba,
     inc.casoEstudio==null?null:inc.casoEstudio,inc.actividadesAdicionales||[],inc.totalMoodle]);
    if(previous&&priorHash!==currentHash){
     if(!w.confirm("La calificación de "+studentName(st)+" es diferente de la guardada. ¿Actualizar únicamente la copia local? Firebase comprobará versiones antes de publicar.")){skipped++;continue;}
    }
    var eligibility=await con.checkRequirements(data.period,ced);
    var check=w.NcomplexNucleosPolicy.check(eligibility,"complexivo");
    var missing=check.missing;
    var eligible=check.eligible;
    if(!eligible){skipped++;continue;} // No guardar notas si los nueve requisitos dejan de cumplirse.
    var complete=inc.evaluaciones.every(function(v){return v!==null;})&&inc.totalMoodle!==null;
    var grades=inc.evaluaciones.concat([inc.taller,inc.prueba,inc.casoEstudio])
     .concat((inc.actividadesAdicionales||[]).map(function(r){return r.nota;}))
     .filter(function(v){return v!==null&&v!==undefined;});
    var arithmetic=grades.length?Math.round(grades.reduce(function(a,b){return a+b;},0)/grades.length*100)/100:null;
    var discrepancy=arithmetic!==null&&inc.totalMoodle!==null&&Math.abs(arithmetic-inc.totalMoodle)>0.03;
    var estadoCarga=!eligible?(check.verified?"INHABILITADO":"PENDIENTE"):
     complete&&!discrepancy?"CONCILIADO":"PENDIENTE";
    var sameNotes=!!previous&&priorHash===currentHash;
    var sameRequirements=sameNotes&&previous.habilitado===eligible&&
     previous.estadoCarga===estadoCarga&&
     JSON.stringify(previous.requisitosPendientes||[])===JSON.stringify(missing);
    if(sameRequirements){skipped++;continue;}
    var stamp=new Date().toISOString();
    var history=previous&&Array.isArray(previous.historialCambios)?previous.historialCambios.slice():[];
    if(previous&&priorHash!==currentHash)history.push({
     at:stamp,action:"CORRECCION_DE_MOODLE",
     evaluaciones:previous.evaluaciones||[null,null,null,null],
     taller:previous.taller==null?null:previous.taller,
     prueba:previous.prueba==null?null:previous.prueba,
     casoEstudio:previous.casoEstudio==null?null:previous.casoEstudio,
     actividadesAdicionales:previous.actividadesAdicionales||[],
     totalMoodle:previous.totalMoodle==null?null:previous.totalMoodle
    });
    stored.push({id:id,periodoId:data.period,cedula:ced,codigoCarrera:studentCode(st),
     nombreCarrera:studentCareer(st),grupoInforme:currentGroup(st),nucleo:data.nucleus,nombreNucleo:nucleusTitle(data.nucleus),
     cursoMoodle:p.parsed.course||"",evaluaciones:inc.evaluaciones.slice(),taller:inc.taller,prueba:inc.prueba,
     casoEstudio:inc.casoEstudio,actividadesAdicionales:(inc.actividadesAdicionales||[]).slice(),
     totalMoodle:inc.totalMoodle,habilitado:eligible,requisitosPendientes:missing.slice(),
     estadoCarga:estadoCarga,
     observaciones:!check.verified?"No se ha podido verificar toda la documentación de requisitos.":
      discrepancy?"El total Moodle difiere de la media simple. Revisar ponderación del curso.":
      complete?"":"Faltan evaluaciones o Total del curso.",origen:"Ncomplex Moodle",
     sourceHash:currentHash,importacionId:digest([data.period,p.source]),
     historialCambios:history,
     estadoSync:"PENDIENTE",remoteHash:previous&&previous.remoteHash||"",cloudError:"",
     createdAt:previous&&previous.createdAt||stamp,updatedAt:stamp,
     version:previous?Number(previous.version||1)+1:1});
    }finally{
     prepared++;
     progressUpdate("Validando notas de núcleos",prepared,total,
      prepared+" de "+total+" matrículas revisadas; "+stored.length+" listas para guardar",
      Math.round(prepared/Math.max(1,total)*85));
    }
   }
   progressUpdate("Escribiendo en BDLocal",prepared,total,
    "Confirmando "+stored.length+" calificaciones en una transacción local…",90);
   if(stored.length)await w.NcomplexNucleosStore.saveMany(stored);
  }else{
   var accepted=p.matched.matches.filter(function(item){
    return item.apply&&!item.hasConflict&&nineRequirements(item.student)&&
     studentMode(item.student)!=="TRABAJO_TITULACION";
   });
   skipped=p.matched.matches.length-accepted.length;
   progressUpdate("Guardando examen complexivo",0,accepted.length,
    "Enviando "+accepted.length+" evaluaciones al repositorio local…",50);
   stored=await con.saveMany(accepted.map(function(item){
    return Object.assign({},item.proposed,{periodoId:data.period,
     CodigoCarrera:studentCode(item.student),NombreCarrera:studentCareer(item.student),
     grupoInforme:currentGroup(item.student),modalidadTitulacion:"EXAMEN_COMPLEXIVO"});
   }),{periodoId:data.period,source:"ncomplex_center_moodle"});
  }
  progressUpdate("Escritura BDLocal confirmada",stored.length,stored.length,
   stored.length+" calificaciones guardadas; actualizando la pantalla…",95);
  if(stored.length&&typeof con.saveImport==="function"){
   try{await con.saveImport({periodoId:data.period,
     archivoNombre:"Moodle - "+(data.mode==="nucleos"?"Núcleo "+data.nucleus:"Examen Complexivo"),
     archivoHash:digest(p.source),totalFilas:p.parsed.rows.length,
     totalGuardados:stored.length,totalExcluidos:(p.withdrawn||[]).length+(p.notQualified||[]).length+
      (p.unlinked||[]).length,origen:"ncomplex_moodle",createdAt:new Date().toISOString()});}
   catch(error){msg("Notas locales guardadas, pero el historial de importación necesita revisión: "+error.message,"error");}
  }
  data.preview=null;ui.review.textContent="";clearInventory();await refresh();
  progressUpdate("BDLocal: guardado finalizado",stored.length,stored.length,
   stored.length+" guardadas · "+skipped+" sin modificar · No se enviaron a Firebase",100,"success");
  msg(stored.length+" registro(s) guardado(s) en BDLocal. "+
   (skipped?skipped+" sin modificar. ":"")+
   "Para publicarlos utiliza Guardar Firebase. "+
   "Ninguna nota fue enviada a la nube durante este guardado.","ok");
 }catch(error){
  progressUpdate("BDLocal: guardado interrumpido",0,0,
   "No se confirmó la operación completa: "+(error.message||String(error))+
   ". Comprueba las notas locales antes de reintentar.",ui.progressBar&&ui.progressBar.value||0,"error");
  throw error;
 }finally{data.working=false;ui.publish.disabled=false;}
}
async function inspectUploaded(){
 if(data.inventoryBusy||!data.period||!data.career)return null;
 var api=w.NcomplexFirebaseInventory,ctx=inventoryKey(),
  panel=$("nc-firebase-inventory"),count=$("nc-firebase-inventory-summary"),
  detail=$("nc-firebase-inventory-detail"),list=$("nc-firebase-inventory-list"),
  button=$("nc-check-firebase");
 if(!panel||!count||!detail||!list||!api||typeof api.inspect!=="function"){
  msg("La consulta de Firebase no está disponible en esta versión.","error");return null;
 }
 panel.hidden=false;list.textContent="";
 var selected=data.students.filter(function(st){return sameCareer(studentCode(st));});
 var local=data.mode==="nucleos"?data.nuclei.filter(function(r){
  return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus;
 }):data.exams.filter(function(r){
  return studentMode(r)==="EXAMEN_COMPLEXIVO"&&
   selected.some(function(st){return studentId(st)===studentId(r);});
 });
 data.inventoryBusy=true;if(button)button.disabled=true;
 count.textContent="Consultando Firebase…";
 detail.textContent="Verificando los documentos de "+selected.length+" matrículas activas; no se infiere su estado desde BDLocal.";
 try{
  var result=await api.inspect({periodoId:data.period,mode:data.mode,nucleus:data.nucleus,
   students:selected,local:local,onProgress:function(progress){
    if(inventoryKey()!==ctx)return;
    count.textContent=progress.done+" / "+progress.total+" revisados";
   }});
  if(inventoryKey()!==ctx)return null;
  data.cloudInventory={key:ctx,result:result};
  count.textContent=result.uploaded+" subidos · "+result.pending+" no subidos"+
   (result.errors?" · "+result.errors+" sin verificar":"");
  detail.textContent="Consulta directa a Firestore · "+new Date(result.checkedAt).toLocaleString("es-EC")+
   ". "+result.matching+" coinciden con BDLocal; "+result.different+" difieren; "+
   result.remoteOnly+" existen solo en Firebase."+
   (result.errors?" La conexión no permitió verificar algunos registros.":"");
  var table=el("table"),head=el("thead"),tr=el("tr");
  ["Estudiante","Cédula","Modalidad","Estado en Firebase"].forEach(function(label){
   tr.appendChild(el("th",label));
  });head.appendChild(tr);table.appendChild(head);
  var body=el("tbody");
  result.rows.forEach(function(item){
   var row=el("tr"),cls=item.error?"is-error":item.uploaded?
     item.match===false?"is-warning":"is-ok":"is-warning";
   row.appendChild(el("td",item.name||"Sin nombre"));
   row.appendChild(el("td",item.cedula));
   row.appendChild(el("td",item.group||"Sin modalidad"));
   row.appendChild(el("td",item.status+(item.error?" — "+item.error:""),"nc-cloud-row-status "+cls));
   body.appendChild(row);
  });
  table.appendChild(body);list.appendChild(table);
  summary();return result;
 }catch(error){
  if(inventoryKey()===ctx){
   count.textContent="No se pudo consultar Firebase";
   detail.textContent=(error.message||String(error))+
    ". No se asumirá que las notas faltan en la nube.";
   msg("No se pudo verificar lo subido: "+(error.message||String(error)),"error");
  }
  return null;
 }finally{data.inventoryBusy=false;if(button)button.disabled=false;}
}
async function sync(){
 if(data.working)return;
 if(!data.period||!data.career){
  msg("Selecciona período y carrera antes de publicar las calificaciones guardadas.","error");return;
 }
 var eligible=Object.create(null);
 currentRows().forEach(function(st){eligible[studentId(st)]=true;});
 var rows=data.mode==="nucleos"?data.nuclei.filter(function(r){
  return sameCareer(r.codigoCarrera)&&Number(r.nucleo)===data.nucleus&&
   eligible[t(r.cedula)]&&r.estadoSync!=="SINCRONIZADO"&&r.estadoSync!=="CONFLICTO";
 }):data.exams.filter(function(r){
  return eligible[studentId(r)]&&studentMode(r)==="EXAMEN_COMPLEXIVO";
 });
 if(!rows.length){
  msg("No existen notas locales pendientes de esta carrera y "+
   (data.mode==="nucleos"?"Núcleo "+data.nucleus:"examen complexivo")+
   " para publicar. Guarda primero las calificaciones en BDLocal.","error");return;
 }
 // Una configuración Firebase válida no equivale a una sesión de usuario.
 // Si no existe una sesión previa, abrir el acceso SIN iniciar ninguna escritura.
 var manager=w.NcomplexFirebaseAuth;
 if(!manager||typeof manager.load!=="function"){
  msg("Autenticación Firebase no disponible. Comprueba la instalación.","error");return;
 }
 try{
  var authStatus=await manager.load();
  if(!authStatus||authStatus.authenticated!==true){
   progressReset();
   showFirebaseSession(authStatus||{authenticated:false});
   msg("La conexión a utet-4387a ya está preparada igual que en Carga. "+
    "Pero firestore.rules exige una identidad autorizada para evaluaciones_nucleos "+
    "(ncomplex_write o titulacion_admin). Carga no necesita esa identidad para sus "+
    "otras colecciones. Usa 'Autorizar notas' si tienes una cuenta con ese permiso. "+
    "No se intentó publicar ninguna de las "+rows.length+" notas y BDLocal sigue intacta.","error");
   return;
  }
 }catch(error){
  msg("No se pudo recuperar Firebase Authentication: "+(error.message||String(error))+
   ". Las calificaciones locales no se modificaron.","error");
  return;
 }
 var wasSaveDisabled=ui.save.disabled;
 data.working=true;ui.publish.disabled=true;ui.save.disabled=true;
 progressUpdate("Firebase: iniciando publicación",0,rows.length,
  "Autenticando y preparando "+rows.length+" registros pendientes…",0);
 msg("Validando permisos y publicando por período y cédula, sin escoger un grupo global…");
 try{
  var result=await publishSavedRecords(rows,data.mode,data.period,function(done,total,detail){
   progressUpdate("Guardando en Firebase",done,total,detail,
    Math.min(99,Math.round(Math.max(0,done)/Math.max(1,total)*100)));
  });
  if(result.published||result.unchanged||result.conflicts||
     (result.errors&&result.pending<rows.length))await refresh();
  if(result.ok){
   progressUpdate("Firebase: publicación finalizada",rows.length,rows.length,
    result.published+" nuevas · "+Number(result.unchanged||0)+" idénticas confirmadas; no se reemplazó ninguna nota",100,"success");
   msg("Firebase comprobó la carga: "+result.published+
    " nota(s) nueva(s) publicada(s). Identificación por período y cédula"+
    (data.mode==="nucleos"?" y núcleo":"")+".","ok");
  }else{
   progressUpdate("Firebase: publicación con incidencias",0,rows.length,
    (result.pending||0)+" pendientes · "+(result.conflicts||0)+" conflictos · "+
    (result.errors||0)+" errores. "+(result.reason||"Revisa los permisos, modalidades y conflictos."),
    ui.progressBar&&ui.progressBar.value||0,"warning");
   msg("Firebase no confirmó toda la carga: "+result.published+" publicada(s), "+
   (result.pending||0)+" pendiente(s), "+(result.conflicts||0)+" conflicto(s), "+
   (result.errors||0)+" error(es). "+(result.reason||"Revisa las incidencias.")+
   " BDLocal mantiene las notas.","error");
  }
  // Mostrar también los documentos que ya existían en la nube antes de esta carga.
  if(result.published||result.unchanged)inspectUploaded().catch(function(error){
   msg("Publicación terminada; la consulta del inventario falló: "+(error.message||String(error)),"error");
  });
 }catch(error){
  progressUpdate("Firebase: publicación interrumpida",0,rows.length,
   error.message||String(error),ui.progressBar&&ui.progressBar.value||0,"error");
  msg("No se completó la publicación Firebase: "+(error.message||String(error))+
   ". Las notas de BDLocal siguen disponibles.","error");
 }finally{data.working=false;ui.publish.disabled=false;ui.save.disabled=wasSaveDisabled;}
}
function showFirebaseSession(info){
 info=info||{};
 var label=$("nc-firebase-session"),connect=$("nc-connect-firebase"),
  logout=$("nc-logout-firebase");
 var signed=info.authenticated===true;
 if(label){
  label.textContent=signed?
   "Firebase: sesión iniciada"+(info.email?" · "+info.email:"")+
   ". Se recuperará automáticamente al volver a abrir la aplicación.":
   (info.error?"Firebase: no se pudo recuperar la sesión · "+info.error:
    "Firebase: conexión directa a utet-4387a (igual que Carga). Para publicar "+
    "evaluaciones individuales, Firestore exige una cuenta autorizada.");
  label.className="nc-firebase-session"+(signed?" is-connected":" is-disconnected");
 }
 if(connect)connect.textContent=signed?"Cambiar cuenta autorizada":"Autorizar notas";
 if(logout)logout.hidden=!signed;
}
function resumeFirebaseSession(){
 var manager=w.NcomplexFirebaseAuth;
 if(!manager||typeof manager.load!=="function")return;
 if(typeof manager.subscribe==="function")manager.subscribe(showFirebaseSession);
 manager.load().then(showFirebaseSession).catch(function(error){
  showFirebaseSession({authenticated:false,error:error.message||String(error)});
 });
}
function showFirebaseLoginForm(){
 var form=$("nc-firebase-login");
 if(!form)return;
 form.hidden=false;
 var email=$("nc-login-email");
 if(email&&typeof email.focus==="function")email.focus();
}
function openLogin(){
 var form=$("nc-firebase-login");
 if(!form)return;
 if(form.hidden)showFirebaseLoginForm();else form.hidden=true;
}
async function signOutFirebase(){
 var manager=w.NcomplexFirebaseAuth;
 if(!manager||typeof manager.signOut!=="function"){
  msg("No se puede cerrar la sesión Firebase desde esta versión.","error");return;
 }
 try{
  await manager.signOut();
  clearInventory();
  showFirebaseSession(manager.status&&manager.status()||{authenticated:false});
  msg("Sesión de Firebase cerrada en este equipo. Las calificaciones de BDLocal se conservaron.","ok");
 }catch(error){msg("No se pudo cerrar la sesión Firebase: "+(error.message||String(error)),"error");}
}
async function signInFirebase(event){
 event.preventDefault();
 var button=$("nc-firebase-login").querySelector('button[type="submit"]'),password=$("nc-login-password");
 button.disabled=true;
 try{
  var user=await w.NcomplexFirebaseAuth.signIn($("nc-login-email").value,password.value);
  $("nc-firebase-login").hidden=true;
  showFirebaseSession(w.NcomplexFirebaseAuth.status&&w.NcomplexFirebaseAuth.status()||
   {authenticated:true,email:user.email});
  msg("Firebase Authentication: "+user.email+
   ". Si tu cuenta tiene el rol ncomplex_write o titulacion_admin, ya puedes publicar las notas.","ok");
 }catch(error){msg("No se pudo autenticar en Firebase: "+(error.message||error),"error");}
 finally{password.value="";button.disabled=false;}
}
async function showConflicts(){
 var panel=$("nc-conflict-panel");panel.hidden=!panel.hidden;
 if(panel.hidden)return;
 panel.textContent="";
 var entries=currentConflicts();panel.appendChild(el("strong",entries.length+" conflictos por revisar"));
 if(!entries.length)return;
 try{await w.NcomplexFirebaseAuth.requireUser();await (w.RequisitosFirebaseOperationCenter.ensureNcomplex?
   w.RequisitosFirebaseOperationCenter.ensureNcomplex():w.RequisitosFirebaseOperationCenter.ensure());}
 catch(error){panel.appendChild(el("p","Primero conecta Firebase: "+error.message));return;}
 for(const row of entries){
  var card=el("div",null,"nc-review-conflict");
  card.appendChild(el("div",(row.nombreCarrera||row.codigoCarrera)+" · Núcleo "+row.nucleo+" · "+row.cedula));
  card.appendChild(el("small","Local: "+row.evaluaciones.map(fmt).join(" / ")+" · Total "+fmt(row.totalMoodle)));
  var remote=null;
  try{remote=await w.RequisitosFirebaseRepository.getById("evaluaciones_nucleos",row.periodoId+"__"+row.cedula+"__N"+row.nucleo);}
  catch(error){card.appendChild(el("small","Firebase: "+error.message));panel.appendChild(card);continue;}
  if(!remote||!remote.data){card.appendChild(el("small","No se encontró el documento remoto."));panel.appendChild(card);continue;}
  card.appendChild(el("small","Firebase: "+(remote.data.evaluaciones||[]).map(fmt).join(" / ")+" · Total "+fmt(remote.data.totalMoodle)));
  for(const choice of [{key:"local",label:"Conservar BDLocal (sin reemplazar Firebase)"},{key:"firebase",label:"Conservar Firebase"}]){
   var b=el("button",choice.label,"nc-conflict-action");b.type="button";
   b.addEventListener("click",(function(selected,entry){return async function(){
    if(!w.confirm("¿"+(selected==="local"?"Preparar las notas locales para volver a publicar":"Reemplazar la copia local por la versión actual de Firebase")+"?"))return;
    try{await w.NcomplexNucleosResolver.resolve(entry,selected);await refresh();panel.hidden=true;msg(selected==="local"?
     "Se conservaron las notas de BDLocal sin cambiar Firebase. El conflicto sigue pendiente para revisión académica.":
     "Se conservó la nota que ya existe en Firebase.","ok");}
    catch(error){msg(error.message||String(error),"error");}
   };})(choice.key,row));
   card.appendChild(b);
  }
  panel.appendChild(card);
 }
}
async function boot(){
 if(data.started)return;
 data.started=true;
 ["period","career","group","tabN","tabE","picker","cloud","message","importBox","paste","review","save","publish","table","more","search","title"].forEach(function(k){
  var names={tabN:"nc-tab-nucleos",tabE:"nc-tab-complexivo",picker:"nc-nucleus-picker",cloud:"nc-cloud-state",
   message:"nc-message",importBox:"nc-import",paste:"nc-paste",review:"nc-review",
   save:"nc-save",publish:"nc-publish",table:"nc-table",more:"nc-table-more",title:"nc-table-title"};
  ui[k]=$(names[k]||"nc-"+k);
 });
 ui.progress=$("nc-save-progress");
 ui.progressBar=$("nc-save-progress-bar");
 ui.progressTitle=$("nc-save-progress-title");
 ui.progressPercent=$("nc-save-progress-percent");
 ui.progressDetail=$("nc-save-progress-detail");
 ui.period.addEventListener("change",loadPeriod);
 ui.career.addEventListener("change",function(){
  if(!data.working){progressReset();clearInventory();}
  data.career=ui.career.value;data.group="";data.preview=null;data.overrides={};showGroup();syncClassic();render();
  if(!ui.importBox.hidden&&t(ui.paste.value))analyze().catch(function(e){msg(e.message,"error");});
 });
 ui.group.addEventListener("change",function(){
  data.group=ui.group.value;data.preview=null;data.lastCloud=null;syncClassic();render();
  if(!ui.importBox.hidden&&t(ui.paste.value))analyze().catch(function(e){msg(e.message,"error");});
 });
 ui.tabN.addEventListener("click",function(){mode("nucleos");});
 ui.tabE.addEventListener("click",function(){mode("complexivo");});
 Array.prototype.forEach.call(ui.picker.querySelectorAll("[data-nc-nucleus]"),function(button){
  button.addEventListener("click",function(){nucleus(Number(button.dataset.ncNucleus));});
 });
 $("nc-open-import").addEventListener("click",function(){promptImport(true);});
 var taskButton=$("nc-next-task");
 if(taskButton)taskButton.addEventListener("click",function(){
  if(!this.dataset.career)return;
  if(data.career!==this.dataset.career)data.group="";
  data.career=this.dataset.career;ui.career.value=data.career;showGroup();
  mode("nucleos");nucleus(Number(this.dataset.nucleus||1));syncClassic();render();
 });
 $("nc-show-pending").addEventListener("click",showPending);
 $("nc-show-conflicts").addEventListener("click",function(){showConflicts().catch(function(e){msg(e.message,"error");});});
 $("nc-connect-firebase").addEventListener("click",openLogin);
 var logoutButton=$("nc-logout-firebase");
 if(logoutButton)logoutButton.addEventListener("click",signOutFirebase);
 resumeFirebaseSession();
 var inspectButton=$("nc-check-firebase");
 if(inspectButton)inspectButton.addEventListener("click",function(){
  if(data.working){msg("Termina primero el guardado actual.","error");return;}
  return inspectUploaded();
 });
 $("nc-login-cancel").addEventListener("click",function(){$("nc-firebase-login").hidden=true;$("nc-login-password").value="";});
 $("nc-firebase-login").addEventListener("submit",signInFirebase);
 $("nc-close-import").addEventListener("click",function(){promptImport(false);});
 $("nc-analyze").addEventListener("click",function(){
  analyze().catch(function(e){msg("No se pudo interpretar Moodle: "+e.message,"error");});
 });
 ui.paste.addEventListener("input",function(){
  if(!data.working)progressReset();
  data.preview=null;ui.save.disabled=true;
  if(!ui.importBox.hidden)msg("El texto cambió; pulsa Analizar nuevamente antes de guardar.");
 });
 ui.save.addEventListener("click",function(){save().catch(function(err){msg(err.message||String(err),"error");ui.save.disabled=false;});});
 ui.publish.addEventListener("click",sync);
 ui.search.addEventListener("input",render);
 $("nc-show-advanced").addEventListener("click",function(){
  var details=$("nc-legacy");details.open=!details.open;d.body.classList.toggle("nc-advanced-open",details.open);
  if(details.open)details.scrollIntoView({behavior:"smooth",block:"start"});
 });
 $("nc-legacy").addEventListener("toggle",function(){d.body.classList.toggle("nc-advanced-open",this.open);});
 try{
  // Los períodos se obtienen primero del servicio académico: nunca esperar una migración de núcleos.
  var periods=await w.ConNcomplex.listPeriods();
  if(!Array.isArray(periods)||!periods.length){
   if(w.BL2DB&&typeof w.BL2DB.getAll==="function"){
    try{periods=await w.BL2DB.getAll("periodos");}catch(error){periods=[];}
   }
  }
  if((!periods||!periods.length)&&w.NcomplexState&&w.NcomplexState.get){
   periods=w.NcomplexState.get().periods||[];
  }
  if(!Array.isArray(periods))periods=[];
  data.periods=periods||[];
  ui.period.textContent="";option(ui.period,"","Seleccionar período");
  data.periods.forEach(function(r){
   var id=t(r.id||r.periodoId||r.periodId||r.value).replace(/_+/g,"__");
   var name=t(r.label||r.nombre||r.periodoLabel)||id;
   if(id&&!Array.prototype.some.call(ui.period.options,function(o){return o.value===id;}))option(ui.period,id,name);
  });
  var globalPeriod=(w.NcomplexState&&w.NcomplexState.get&&w.NcomplexState.get().selectedPeriodId)||"";
  if(globalPeriod && Array.prototype.some.call(ui.period.options,function(p){return p.value===globalPeriod;})){
   ui.period.value=globalPeriod;await loadPeriod();
  }else render();
  if(!globalPeriod||ui.period.value!==globalPeriod)
   msg(periods.length?"BDLocal conectada. Selecciona el período y la carrera.":
    "No hay períodos disponibles en BDLocal; revisa Centro de datos.",periods.length?"ok":"error");
 }catch(err){msg("No se pudo inicializar la carga de núcleos: "+err.message,"error");}
}
w.NcomplexCenter=Object.freeze({init:boot,refresh:refresh,parse:analyze,save:save,sync:sync,periodHint:moodlePeriodHint,status:function(){return {period:data.period,career:data.career,mode:data.mode,nucleus:data.nucleus};}});
w.addEventListener("ncomplex:bootstrap-ready",function(){boot();});
})(window,document);
