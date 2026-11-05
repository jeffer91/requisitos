/* Centro Ncomplex: experiencia compacta de núcleos y complexivo.
 * No utiliza nombres de estudiante como clave y nunca certifica notas incompletas. */
(function(w,d){"use strict";
var ui={},data={mode:"nucleos",period:"",career:"",group:"",nucleus:1,
 periods:[],students:[],nuclei:[],exams:[],preview:null,working:false,started:false,lastCloud:null,overrides:{},nucleusWarning:""};
function t(v){return String(v==null?"":v).trim();}
function norm(v){return t(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function $(id){return d.getElementById(id);}
function el(tag,txt,cls){var n=d.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n;}
function msg(txt,kind){if(!ui.message)return;ui.message.textContent=txt;ui.message.className="nc-message"+(kind?" is-"+kind:"");}
function option(select,value,label){var o=el("option",label);o.value=value;select.appendChild(o);}
function studentId(r){return t(r.cedula||r.numeroIdentificacion||r.NumeroIdentificacion||r._cedula);}
function studentName(r){return t(r.Nombres||r.nombres||r.nombreCompleto||r.nombre||r.Nombre);}
function studentCareer(r){return t(r.NombreCarrera||r.nombreCarrera||r.Carrera||r.carrera);}
function studentCode(r){return t(r.CodigoCarrera||r.codigoCarrera||r.codigo_carrera)||studentCareer(r);}
function studentMode(r){return t(r.modalidadTitulacion);}
function currentRows(){return data.students.filter(function(s){return studentCode(s)===data.career;});}
function cloudCount(){return data.nuclei.filter(function(r){return r.estadoSync!=="SINCRONIZADO"&&(!data.career||r.codigoCarrera===data.career);}).length;}
function currentConflicts(){return data.nuclei.filter(function(r){
 return r.estadoSync==="CONFLICTO" && r.codigoCarrera===data.career && (!data.group||r.grupoInforme===data.group);
});}
function nucleusRequirements(student){
 var check=student&&student._ncomplexRequirements;
 return w.NcomplexNucleosPolicy&&w.NcomplexNucleosPolicy.check(check,"nucleos");
}
function careerInfo(){
 var first=currentRows()[0];return first?{name:studentCareer(first),code:studentCode(first)}:null;
}
function nucleusCatalog(){try{return w.InfNuclei&&w.InfNuclei.careers?w.InfNuclei.careers():[];}catch(e){return [];}}
function nucleusTitle(number){
 var name=careerInfo()&&careerInfo().name,base=w.NcomplexSmart&&w.NcomplexSmart.baseCareer;
 var entry=nucleusCatalog().find(function(c){return base?base(c.career)===base(name):norm(c.career)===norm(name);});
 return entry&&entry.nuclei[number-1]?entry.nuclei[number-1].name:"Núcleo "+number;
}
function groupGuess(st){
 var name=studentCareer(st).toLowerCase(),study=t(st.modalidadEstudio||st.tipoModalidad||st.Modalidad||"").toLowerCase();
 return /pvc/.test(study)?"PVC":/online|en.linea|virtual/.test(study+" "+name)?"ONLINE":
  /presencial/.test(study)?"PRESENCIAL":"";
}
function showGroup(){
 var guesses=Array.from(new Set(currentRows().map(groupGuess).filter(Boolean)));
 var value=guesses.length===1?guesses[0]:"";
 if(data.group && guesses.indexOf(data.group)>=0)value=data.group;
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
  con.listStudents({periodoId:period,estadoMatricula:"ACTIVO"}),
  con.listEvaluations({periodoId:period}),
  w.NcomplexNucleosStore.list(period).then(function(rows){
   data.nucleusWarning="";return rows;
  }).catch(function(error){
   data.nucleusWarning="No se pudieron leer las notas de núcleos: "+(error.message||error);
   return [];
  })
 ]);
 if(data.period!==period)return;
 data.students=(result[0]||[]).filter(function(row){return row.eliminado!==true&&row.retirado!==true;});
 data.exams=result[1]||[];data.nuclei=result[2]||[];
 var careers=Object.create(null);
 data.students.forEach(function(st){var key=studentCode(st);if(key)careers[key]=studentCareer(st)||key;});
 var previous=data.career;ui.career.textContent="";option(ui.career,"","Seleccionar carrera");
 Object.keys(careers).sort(function(a,b){return careers[a].localeCompare(careers[b],"es");}).forEach(function(k){option(ui.career,k,careers[k]);});
 data.career=careers[previous]?previous:"";
 if(!data.career){
  var codes=Object.keys(careers).sort(function(a,b){return careers[a].localeCompare(careers[b],"es");});
  data.career=codes.find(function(code){return !/sin carrera/i.test(careers[code]);})||codes[0]||"";
  data.nucleus=1;
 }
 ui.career.value=data.career;showGroup();syncClassic();render();
}
async function loadPeriod(){
 data.period=ui.period.value;data.career="";data.preview=null;data.overrides={};data.lastCloud=null;ui.review.textContent="";
 if(!data.period){data.students=[];data.nuclei=[];data.exams=[];render();return;}
 syncClassic();
 msg("Consultando estudiantes y calificaciones…");
 try{await refresh();msg(data.nucleusWarning||"Período cargado. Elige una carrera para consultar las notas.",
 data.nucleusWarning?"error":"ok");}
 catch(e){msg(e.message||String(e),"error");}
}
function mode(v){
 data.mode=v;data.preview=null;data.overrides={};ui.review.textContent="";
 ui.save.disabled=true;
 ui.tabN.classList.toggle("is-active",v==="nucleos");
 ui.tabE.classList.toggle("is-active",v==="complexivo");
 ui.tabN.setAttribute("aria-selected",v==="nucleos"?"true":"false");
 ui.tabE.setAttribute("aria-selected",v==="complexivo"?"true":"false");
 ui.picker.hidden=v!=="nucleos";render();
}
function nucleus(number){
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
  data.nuclei.filter(function(r){return r.codigoCarrera===data.career&&Number(r.nucleo)===data.nucleus;}).forEach(function(r){ids[r.cedula]=r;});
 }else data.exams.forEach(function(r){ids[studentId(r)]=r;});
 currentRows().forEach(function(st){
  var row=ids[studentId(st)],reasons=[];
  var checked=st._ncomplexRequirements,requirements=checked&&checked.requirements||[];
  var check=w.NcomplexNucleosPolicy.check(checked,data.mode);
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
 var task=w.NcomplexSmart&&w.NcomplexSmart.nextTask(careerOptions(),data.students,data.nuclei,data.career,data.nucleus);
 var same=task&&task.career===data.career&&task.nucleus===data.nucleus;
 detail.textContent=task?(same?"Pega las calificaciones de este núcleo o elige otro si ya las tienes.":
  "Siguiente pendiente: "+task.name+" · Núcleo "+task.nucleus):
  "Revisa las notas del complexivo y las incidencias del período.";
 next.hidden=!task||same;
 if(task){next.dataset.career=task.career;next.dataset.nucleus=String(task.nucleus);}
}
function summary(){
 var roster=currentRows(),ids=Object.create(null),loaded=Object.create(null),complete=Object.create(null);
 roster.forEach(function(st){ids[studentId(st)]=true;});
 var records=data.mode==="nucleos"?
 data.nuclei.filter(function(r){return r.codigoCarrera===data.career&&Number(r.nucleo)===data.nucleus;}):
 data.exams.filter(function(r){return ids[studentId(r)]&&studentMode(r)==="EXAMEN_COMPLEXIVO";});
 records.forEach(function(r){
  var id=studentId(r);if(!ids[id])return;
  var grades=data.mode==="nucleos"?(r.evaluaciones||[]).concat([r.taller,r.prueba,r.totalMoodle]):
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
 var n=data.nuclei.filter(function(r){return !data.career||r.codigoCarrera===data.career;}).length,
 cloud=data.lastCloud,exam=cloud&&cloud.period===data.period&&cloud.group===data.group?cloud.exam:null,
 bad=exam&&(exam.errors||exam.conflicts||exam.blocked||exam.invalid);
 ui.cloud.textContent=!n?"Sin notas de núcleos":cloudCount()?cloudCount()+" pendiente(s) de Firebase":"Núcleos sincronizados";
 if(exam)ui.cloud.textContent+=" · Complexivo "+(bad?"con incidencias":"verificado");
 ui.cloud.className="nc-cloud-pill"+(n&&!cloudCount()&&!bad?" is-ok":" is-warn");
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
 var names=data.mode==="nucleos"?["Estudiante","E1","E2","E3","E4","Taller","Prueba","Total Moodle","Requisitos","Estado"]:
  ["Estudiante","Teórico","Práctico","Final","Requisitos","Estado"];
 var thead=ui.table.querySelector("thead"),tbody=ui.table.querySelector("tbody");
 thead.textContent="";tbody.textContent="";var tr=el("tr");
 names.forEach(function(name){tr.appendChild(el("th",name));});thead.appendChild(tr);
 var roster=currentRows(),needle=norm(ui.search.value);
 var rows=roster.filter(function(st){return !needle||norm(studentName(st)+studentId(st)).includes(needle);});
 var saved=Object.create(null);
 if(data.mode==="nucleos")data.nuclei.filter(function(r){return r.codigoCarrera===data.career&&Number(r.nucleo)===data.nucleus;}).forEach(function(r){saved[r.cedula]=r;});
 else data.exams.forEach(function(r){saved[studentId(r)]=r;});
 rows.slice(0,80).forEach(function(st){
  var row=saved[studentId(st)],line=el("tr");
  line.appendChild(td(studentName(st)||studentId(st)));
  if(data.mode==="nucleos"){
   var numbers=row&&row.evaluaciones||[null,null,null,null];
   numbers.concat([row&&row.taller,row&&row.prueba,row&&row.totalMoodle]).forEach(function(v){line.appendChild(td(fmt(v),v==null?"nc-muted":""));});
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
 ui.more.textContent=rows.length>80?"Mostrando los primeros 80 de "+rows.length+". Usa Buscar para filtrar.":"";
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
  data.career=detected.careerId;ui.career.value=data.career;showGroup();syncClassic();
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
 var selected=currentRows(),matched={matches:[],review:[],unmatched:[],duplicates:[],conflicts:[],matched:0};
 if(data.career){
  matched=data.mode==="nucleos"?
   w.NcomplexNucleosParser.match(parsed.rows||[],selected,data.overrides):
   w.NcomplexMatcher.match(parsed.rows||[],selected);
 }
 data.preview={kind:data.mode,period:data.period,career:data.career,nucleus:data.nucleus,group:data.group,
  parsed:parsed,matched:matched,courseMatch:courseCorrect,periodMatch:periodCorrect,source:raw};
 ui.review.textContent="";
 var issues=(parsed.errors||[]).slice(),warn=(parsed.warnings||[]).slice();
 var toReview=(matched.review||[]).length+(matched.unmatched||[]).length+
   (Array.isArray(matched.duplicates)?matched.duplicates.length:0)+(matched.conflicts||[]).length;
 var report=el("p",(parsed.rows||[]).length+" filas Moodle · "+selected.length+
  " matrículas BDLocal · "+(matched.matches||[]).length+" vinculadas · "+toReview+" por revisar");
 ui.review.appendChild(report);
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
   choice.appendChild(el("span","Selecciona la modalidad de la carrera:"));
   detected.careers.forEach(function(candidate){
    var btn=el("button",candidate.label);btn.type="button";
    btn.addEventListener("click",function(){
     data.career=candidate.code;ui.career.value=data.career;showGroup();syncClassic();
     analyze().catch(function(e){msg(e.message,"error");});
    });choice.appendChild(btn);
   });ui.review.appendChild(choice);
  }
  if(!detected.nucleus)issues.push("No se reconoció un núcleo único; selecciónalo en la pantalla.");
 }
 if(!courseCorrect)issues.push("Confirma la carrera y el núcleo antes de guardar.");
 if(!data.group&&data.mode==="nucleos")issues.push("Selecciona el grupo (Presencial, Online o PVC) para guardar. Las notas ya fueron analizadas.");
 if(data.mode==="nucleos"&&data.career&&data.students.length>selected.length){
  var globally=w.NcomplexNucleosParser.match(parsed.rows||[],data.students,data.overrides);
  var outside=(globally.matches||[]).filter(function(item){
   return studentCode(item.student)!==data.career;
  });
  if(outside.length){
   var alternative=Object.create(null);
   outside.forEach(function(item){
    var name=studentCareer(item.student)||studentCode(item.student);
    alternative[name]=(alternative[name]||0)+1;
   });
   ui.review.appendChild(el("p",outside.length+" filas de Moodle parecen corresponder a otras matrículas del período: "+
    Object.keys(alternative).map(function(name){return name+" ("+alternative[name]+")";}).join(", ")+". No se mezclarán las carreras."));
  }
 }
 var additional=(matched.review||[]).map(function(r){return r.reason;})
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
 if(data.mode==="nucleos"&&matched.review){
  var unresolved=matched.review.filter(function(item){return item.row&&!item.row.blocked&&!item.cedula;});
  if(unresolved.length){
   ui.review.appendChild(el("strong","Vincular matrícula, solo si puedes confirmar la identidad:"));
   unresolved.slice(0,30).forEach(function(item){
    var line=el("div",null,"nc-manual-row");
    line.appendChild(el("span",item.row.nombreCompleto+" · "+item.row.correo));
    var select=el("select");select.setAttribute("aria-label","Vincular "+item.row.nombreCompleto);
    option(select,"","Matrícula sin identificar");
    selected.forEach(function(st){var ced=studentId(st);if(ced)option(select,ced,studentName(st)+" · "+ced);});
    select.value=data.overrides[String(item.row.rowNumber)]||"";
    select.addEventListener("change",function(){
     if(select.value)data.overrides[String(item.row.rowNumber)]=select.value;
     else delete data.overrides[String(item.row.rowNumber)];
     analyze().catch(function(e){msg(e.message,"error");});
    });
    line.appendChild(select);ui.review.appendChild(line);
   });
  }
 }
 var canSave=!!parsed.ok&&periodCorrect&&courseCorrect&&!!data.career&&
  (data.mode!=="nucleos"||!!data.group)&&matched.matches.length>0&&
  (data.mode==="nucleos"||matched.matches.some(function(x){return x.apply&&!x.hasConflict;}));
 ui.save.disabled=!canSave;
 render();
 msg(canSave?"Notas interpretadas. Revisa las coincidencias antes de guardar.":
  "Carga interpretada. Resuelve los datos señalados para continuar.",canSave?"ok":"error");
}
function digest(v){var str=JSON.stringify(v),h=2166136261;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return "moodle_"+(h>>>0).toString(16);}
async function save(){
 var p=data.preview;if(!p||p.period!==data.period||p.career!==data.career||p.kind!==data.mode||
 (data.mode==="nucleos"&&(p.nucleus!==data.nucleus||p.group!==data.group))||
 p.periodMatch!==true||p.courseMatch!==true)throw Error("El contexto o período cambió. Analiza nuevamente la importación.");
 ui.save.disabled=true;data.working=true;
 try{
  var con=w.ConNcomplex,stored=[],skipped=0;
  if(data.mode==="nucleos"){
   var records=await w.NcomplexNucleosStore.list(data.period),existing=Object.create(null);
   records.forEach(function(r){existing[r.id]=r;});
   for(var item of p.matched.matches){
    var st=item.student,inc=item.imported,ced=studentId(st),id=w.NcomplexNucleosStore.id(data.period,ced,data.nucleus);
    var previous=existing[id]||null;
    var priorHash=digest(previous&&[previous.evaluaciones,previous.taller,previous.prueba,previous.totalMoodle]);
    var currentHash=digest([inc.evaluaciones,inc.taller,inc.prueba,inc.totalMoodle]);
    if(previous&&priorHash!==currentHash){
     if(!w.confirm("La calificación de "+studentName(st)+" es diferente de la guardada. ¿Actualizar únicamente la copia local? Firebase comprobará versiones antes de publicar.")){skipped++;continue;}
    }
    if(previous&&priorHash===currentHash){skipped++;continue;}
    var eligibility=await con.checkRequirements(data.period,ced);
    var check=w.NcomplexNucleosPolicy.check(eligibility,"nucleos");
    var missing=check.missing;
    var eligible=check.eligible;
    var complete=inc.evaluaciones.every(function(v){return v!==null;})&&inc.totalMoodle!==null;
    var grades=inc.evaluaciones.concat([inc.taller,inc.prueba]).filter(function(v){return v!==null;});
    var arithmetic=grades.length?Math.round(grades.reduce(function(a,b){return a+b;},0)/grades.length*100)/100:null;
    var discrepancy=arithmetic!==null&&inc.totalMoodle!==null&&Math.abs(arithmetic-inc.totalMoodle)>0.03;
    var stamp=new Date().toISOString();
    var history=previous&&Array.isArray(previous.historialCambios)?previous.historialCambios.slice():[];
    if(previous&&priorHash!==currentHash)history.push({
     at:stamp,action:"CORRECCION_DE_MOODLE",
     evaluaciones:previous.evaluaciones||[null,null,null,null],
     taller:previous.taller==null?null:previous.taller,
     prueba:previous.prueba==null?null:previous.prueba,
     totalMoodle:previous.totalMoodle==null?null:previous.totalMoodle
    });
    stored.push({id:id,periodoId:data.period,cedula:ced,codigoCarrera:data.career,
     nombreCarrera:studentCareer(st),grupoInforme:data.group,nucleo:data.nucleus,nombreNucleo:nucleusTitle(data.nucleus),
     cursoMoodle:p.parsed.course||"",evaluaciones:inc.evaluaciones.slice(),taller:inc.taller,prueba:inc.prueba,
     totalMoodle:inc.totalMoodle,habilitado:eligible,requisitosPendientes:missing.slice(),
     estadoCarga:!eligible?(check.verified?"INHABILITADO":"PENDIENTE"):
      complete&&!discrepancy?"CONCILIADO":"PENDIENTE",
     observaciones:!check.verified?"No se ha podido verificar toda la documentación de requisitos.":
      discrepancy?"El total Moodle difiere de la media simple. Revisar ponderación del curso.":
      complete?"":"Faltan evaluaciones o Total del curso.",origen:"Ncomplex Moodle",
     sourceHash:currentHash,importacionId:digest([data.period,p.source]),
     historialCambios:history,
     estadoSync:"PENDIENTE",remoteHash:previous&&previous.remoteHash||"",cloudError:"",
     createdAt:previous&&previous.createdAt||stamp,updatedAt:stamp,
     version:previous?Number(previous.version||1)+1:1});
   }
   if(stored.length)await w.NcomplexNucleosStore.saveMany(stored);
  }else{
   var accepted=p.matched.matches.filter(function(item){
    return item.apply&&!item.hasConflict&&studentMode(item.student)!=="TRABAJO_TITULACION";
   });
   skipped=p.matched.matches.length-accepted.length;
   stored=await con.saveMany(accepted.map(function(item){
    return Object.assign({},item.proposed,{periodoId:data.period,modalidadTitulacion:"EXAMEN_COMPLEXIVO"});
   }),{periodoId:data.period,source:"ncomplex_center_moodle"});
  }
  if(stored.length&&typeof con.saveImport==="function"){
   try{await con.saveImport({periodoId:data.period,
     archivoNombre:"Moodle - "+(data.mode==="nucleos"?"Núcleo "+data.nucleus:"Examen Complexivo"),
     archivoHash:digest(p.source),totalFilas:p.parsed.rows.length,
     totalGuardados:stored.length,origen:"ncomplex_moodle",createdAt:new Date().toISOString()});}
   catch(error){msg("Notas locales guardadas, pero el historial de importación necesita revisión: "+error.message,"error");}
  }
  data.preview=null;ui.review.textContent="";await refresh();
  msg(stored.length+" registros guardados en BDLocal. "+
    (skipped?skipped+" sin reemplazar (duplicados o conflicto). ":"")+
    "Para confirmar en Firebase usa Sincronizar Firebase.","ok");
 }finally{data.working=false;}
}
async function sync(){
 if(data.working)return;
 if(!data.period||!data.group){msg("Selecciona período y grupo antes de sincronizar.","error");return;}
 if(!w.confirm("¿Sincronizar las calificaciones de este período y grupo? Las versiones remotas se comprobarán antes de escribir."))return;
 data.working=true;ui.publish.disabled=true;
 msg("Verificando acceso y comparando versiones de Firebase…");
 var info=[],nr={published:0,unchanged:0,conflicts:0,errors:0,remaining:0},exam=null,issues=false;
 try{
  await w.NcomplexFirebaseAuth.requireWriter();
  var attempted=Object.create(null),remaining=0;
  for(var i=0;i<400;i++){
   var skip=Object.keys(attempted);
   var result=await w.NcomplexNucleosFirebase.push({
    periodoId:data.period,grupoInforme:data.group,limit:25,skipIds:skip
   });
   (result.attemptedIds||[]).forEach(function(id){attempted[id]=true;});
   nr.published+=result.published;nr.unchanged+=result.unchanged;
   nr.conflicts+=result.conflicts;nr.errors+=result.errors;
   remaining=result.remaining;
   if(!result.processed||result.remaining===0)break;
  }
  nr.remaining=remaining;
  info.push("Núcleos: "+nr.published+" publicados, "+nr.unchanged+" sin cambios");
  if(nr.conflicts||nr.errors||nr.remaining){
   issues=true;info.push((nr.conflicts+nr.errors+nr.remaining)+" pendientes de revisar");
  }
  var cloud=w.NcomplexFirebaseComplexivo;
  if(cloud&&typeof cloud.publish==="function"){
   var count=0,had=false;
   exam={published:0,same:0,conflicts:0,blocked:0,invalid:0,errors:0};
   for(var p=0;p<400;p++){
    var comp=await cloud.publish({confirmedByCenter:true});
    if(!comp||comp.ok!==true){
     exam.errors++;issues=true;
     info.push("Complexivo: "+(comp&&comp.reason||comp&&comp.error||"sin confirmación"));
     break;
    }
    had=true;count+=Number(comp.published||0);
    exam.same=Number(comp.same||0);
    exam.conflicts=Array.isArray(comp.conflicts)?comp.conflicts.length:0;
    exam.blocked=Array.isArray(comp.blocked)?comp.blocked.length:0;
    exam.invalid=Array.isArray(comp.invalid)?comp.invalid.length:0;
    if(!comp.published)break;
   }
   exam.published=count;
   if(!had)exam.errors++;
   info.push("Complexivo: "+count+" publicados");
   if(exam.conflicts||exam.blocked||exam.invalid||exam.errors){
    issues=true;
    info.push("Complexivo con "+(exam.conflicts+exam.blocked+exam.invalid+exam.errors)+" incidencias");
   }
  }else{
   exam={errors:1};issues=true;info.push("Publicador de complexivo no disponible");
  }
  var center=w.RequisitosFirebaseOperationCenter;
  if(center&&typeof center.analyze==="function"&&typeof center.push==="function"){
   for(var c=0;c<200;c++){
    var analysis=await center.analyze("ncomplex",{periodoId:data.period,source:"Ncomplex.center"});
    if(!analysis||analysis.ok!==true){issues=true;info.push("Historial: "+(analysis&&analysis.message||"sin confirmar"));break;}
    if(analysis.conflictos){issues=true;info.push("Historial: "+analysis.conflictos+" conflictos");break;}
    if(!analysis.batchChanges)break;
    var uploaded=await center.push("ncomplex",{periodoId:data.period,source:"Ncomplex.center",requireAnalysis:true});
    if(!uploaded||uploaded.ok!==true){issues=true;info.push("Historial: "+(uploaded&&uploaded.message||"error"));break;}
    if(!uploaded.processedIds||!uploaded.processedIds.length)break;
   }
  }else{issues=true;info.push("Sin sincronizador de historial");}
  data.lastCloud={period:data.period,group:data.group,exam:exam,at:new Date().toISOString()};
  await refresh();
  msg(info.join(" · ")+(issues?" · Revisa pendientes y conflictos.":" · Firebase confirmó la carga."),
      issues?"error":"ok");
 }catch(error){
  data.lastCloud=null;
  msg("No se confirmó la sincronización Firebase: "+(error.message||error),"error");
 }finally{data.working=false;ui.publish.disabled=false;}
}
function openLogin(){
 var form=$("nc-firebase-login");form.hidden=!form.hidden;
 if(!form.hidden)$("nc-login-email").focus();
}
async function signInFirebase(event){
 event.preventDefault();
 var button=$("nc-firebase-login").querySelector('button[type="submit"]'),password=$("nc-login-password");
 button.disabled=true;
 try{
  var user=await w.NcomplexFirebaseAuth.signIn($("nc-login-email").value,password.value);
  $("nc-firebase-login").hidden=true;
  msg("Firebase conectado: "+user.email,"ok");
 }catch(error){msg("No se pudo autenticar en Firebase: "+(error.message||error),"error");}
 finally{password.value="";button.disabled=false;}
}
async function showConflicts(){
 var panel=$("nc-conflict-panel");panel.hidden=!panel.hidden;
 if(panel.hidden)return;
 panel.textContent="";
 var entries=currentConflicts();panel.appendChild(el("strong",entries.length+" conflictos por revisar"));
 if(!entries.length)return;
 try{await w.NcomplexFirebaseAuth.requireUser();await w.RequisitosFirebaseOperationCenter.ensure();}
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
  for(const choice of [{key:"local",label:"Conservar local"},{key:"firebase",label:"Conservar Firebase"}]){
   var b=el("button",choice.label,"nc-conflict-action");b.type="button";
   b.addEventListener("click",(function(selected,entry){return async function(){
    if(!w.confirm("¿"+(selected==="local"?"Preparar las notas locales para volver a publicar":"Reemplazar la copia local por la versión actual de Firebase")+"?"))return;
    try{await w.NcomplexNucleosResolver.resolve(entry,selected);await refresh();panel.hidden=true;msg("Conflicto conciliado. "+(selected==="local"?"Sincroniza para publicar.":"Se conservó Firebase."),"ok");}
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
 ui.period.addEventListener("change",loadPeriod);
 ui.career.addEventListener("change",function(){
  data.career=ui.career.value;data.preview=null;data.overrides={};showGroup();syncClassic();render();
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
  data.career=this.dataset.career;ui.career.value=data.career;showGroup();
  mode("nucleos");nucleus(Number(this.dataset.nucleus||1));syncClassic();render();
 });
 $("nc-show-pending").addEventListener("click",showPending);
 $("nc-show-conflicts").addEventListener("click",function(){showConflicts().catch(function(e){msg(e.message,"error");});});
 $("nc-connect-firebase").addEventListener("click",openLogin);
 $("nc-login-cancel").addEventListener("click",function(){$("nc-firebase-login").hidden=true;$("nc-login-password").value="";});
 $("nc-firebase-login").addEventListener("submit",signInFirebase);
 $("nc-close-import").addEventListener("click",function(){promptImport(false);});
 $("nc-analyze").addEventListener("click",function(){
  analyze().catch(function(e){msg("No se pudo interpretar Moodle: "+e.message,"error");});
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
