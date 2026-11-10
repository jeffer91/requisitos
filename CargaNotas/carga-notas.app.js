/* carga-notas.app.js — /CargaNotas
 * Carga oficial por cédula/período. Solo escribe tras vista previa y pulsación
 * explícita del usuario; cada documento se verifica en Firebase.
 * Conecta: ConNcomplex, BDLRepoNotas, NcomplexNucleosStore, CargaNotasFirebase.
 */
(function(w,d){
"use strict";
var state={period:"",all:[],items:[],other:0,working:false,file:"",nucleos:[],evaluaciones:[],roster:[],lastError:""};
function $(id){return d.getElementById(id);}
function txt(v){return String(v==null?"":v).trim();}
function canonical(v){return txt(v).replace(/_+/g,"__");}
function norm(v){return txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ");}
function id(st){return w.CargaNotasRules.cid(st.cedula||st.Cedula||st.numeroIdentificacion||st.NumeroIdentificacion);}
function studentName(st){return txt(st.Nombres||st.nombres||st.nombreCompleto||st.NombreCompleto);}
function career(st){return txt(st.NombreCarrera||st.nombreCarrera||st.nombrecarrera||st.Carrera);}
function code(st){return txt(st.CodigoCarrera||st.codigoCarrera||st.codigocarrera).toUpperCase();}
function periodOf(st){return canonical(st.periodoId||st.periodId||st.PeriodoId||st.ultimoPeriodoId);}
function active(st){return st&&st.eliminado!==true&&st.retirado!==true&&norm(st.estadoMatricula||st._estadoMatricula)==="ACTIVO";}
function message(t,bad){var node=$("cn-msg");if(node){node.textContent=txt(t);node.className=bad?"bad":"";}}
function progress(t){$("cn-progress").textContent=txt(t);}
function el(tag,content){var n=d.createElement(tag);if(content!==undefined)n.textContent=txt(content);return n;}
function same(a,b){return !w.CargaNotasRules.compare(a,b,0.025);}
function gradeMismatch(previous,incoming,field,errors,label){
 if(previous==null||incoming==null)return;
 if(!Number.isFinite(Number(previous))||!Number.isFinite(Number(incoming)))return;
 if(!same(Number(previous),Number(incoming)))errors.push((label||field)+": BDLocal "+previous+" / Excel "+incoming+".");
}
function sourceGrade(item,field){return item.parsed[field];}
function assess(parsed,roster,byEval,byArticle,byNucleo){
 var errors=parsed.errors.slice(),warnings=parsed.warnings.slice(),st=null;
 var found=roster.filter(function(row){return id(row)===parsed.cedula;});
 if(found.length!==1)errors.push(found.length?"Cédula duplicada en BDLocal.":"La cédula no existe en la matrícula del período.");
 else st=found[0];
 if(st){
  if(!active(st))errors.push("Matrícula no ACTIVA.");
  if(periodOf(st)&&periodOf(st)!==parsed.periodoId)errors.push("El período de matrícula es distinto.");
  var declared=w.CargaNotasRules.modality(st["Tipo de titulación"]||st.tipoTitulacion||st.modalidadTitulacion);
  var existingEval=byEval[parsed.cedula];
  var savedMod=w.CargaNotasRules.modality(existingEval&&existingEval.modalidadTitulacion);
  if(declared&&declared!==parsed.tipo)errors.push("Modalidad distinta de Ficha: "+declared+".");
  if(savedMod&&savedMod!==parsed.tipo)errors.push("Modalidad distinta de la evaluación existente: "+savedMod+".");
  var c=code(st);
  parsed.codigosNucleos.forEach(function(key){
    if(!key||!c)return;
    var base=key.toUpperCase().replace(/-\d+$/,"");
    if(base!==c)errors.push("Código de núcleo "+key+" no coincide con la carrera "+c+".");
  });
  var group=w.CargaNotasFirebase.group(st);
  if(parsed.tipo==="EXAMEN_COMPLEXIVO"&&!group)errors.push("Grupo Presencial/Online/PVC no identificado en BDLocal.");
  if(parsed.tipo==="TRABAJO_TITULACION"&&!group)errors.push("Grupo de trabajo no identificado.");
  if((parsed.tipo==="EXAMEN_COMPLEXIVO"||parsed.tipo==="TRABAJO_TITULACION")&&
     st.aprobacionFinal!==true&&!(st._aprobacionFinal&&st._aprobacionFinal.eligible===true))
    errors.push("No consta Aprobación final para registrar la evaluación de titulación.");
 }
 var evaluation=byEval[parsed.cedula]||{};
 if(parsed.tipo==="EXAMEN_COMPLEXIVO"){
  var props=parsed.supletorio!==null
   ?[["notaTeoricaSupletorio",parsed.teorico],["notaPracticaSupletorio",parsed.practico],["notaSupletorio",parsed.supletorio]]
   :[["notaTeorica",parsed.teorico],["notaPractica",parsed.practico]];
  props.concat([["notaOficial",parsed.notaExamenAplicada],["notaFinalIntegral",parsed.final]]).forEach(function(pair){
   gradeMismatch(evaluation[pair[0]],pair[1],pair[0],errors);
  });
  parsed.nucleos.forEach(function(value,i){
   if(value===null||!Number.isFinite(value))return;
   var previous=byNucleo[parsed.cedula+"__N"+(i+1)];
   if(previous)gradeMismatch(previous.totalMoodle,value,"N"+(i+1),errors,"Núcleo "+(i+1));
  });
 }else if(parsed.tipo==="TRABAJO_TITULACION"){
  [["notaEscrito",parsed.nota1],["notaDefensaTrabajo",parsed.nota2],["notaTrabajoTitulacion",parsed.final]].forEach(function(pair){
   gradeMismatch(evaluation[pair[0]],pair[1],pair[0],errors);
  });
 }else if(parsed.tipo==="ARTICULO_ACADEMICO"){
  var art=byArticle[parsed.cedula]||{};
  [["notaArticulo",parsed.nota1],["notaDefensa",parsed.nota2],["notaFinal",parsed.final]].forEach(function(pair){
   gradeMismatch(art[pair[0]]!==undefined?art[pair[0]]:art[pair[0]==="notaArticulo"?"Notart":pair[0]==="notaDefensa"?"Notdef":"Notafinal"],pair[1],pair[0],errors);
  });
 }
 if(parsed.tipo==="TRABAJO_TITULACION"&&(parsed.nota1===null||parsed.nota2===null||parsed.final===null))
  errors.push("El resumen de Trabajo requiere escrito, defensa y nota final completos.");
 if(parsed.tipo==="EXAMEN_COMPLEXIVO"&&parsed.notaExamenAplicada===null)
  errors.push("No hay examen válido para publicar.");
 if(parsed.tipo==="ARTICULO_ACADEMICO"&&parsed.nota1===null&&parsed.nota2===null)
  errors.push("Sin calificaciones de artículo o defensa.");
 return {parsed:parsed,student:st,errors:errors,warnings:warnings,status:errors.length?"blocked":"ready",detail:""};
}
function render(){
 var total=state.items.length,ready=state.items.filter(function(i){return i.status==="ready";}).length;
 var blocked=state.items.filter(function(i){return i.status==="blocked"||i.status==="error";}).length;
 var retry=state.items.filter(function(i){return i.status==="error";}).length;
 $("cn-total").textContent=total;$("cn-ready").textContent=ready;$("cn-blocked").textContent=blocked;
 $("cn-other").textContent=state.other;$("cn-results").hidden=!total;
 var q=norm($("cn-search").value),filter=$("cn-filter").value,tbody=$("cn-body");tbody.textContent="";
 state.items.forEach(function(item){
  if(filter!=="all"&&filter!==item.status&&(filter==="blocked"&&item.status==="error"?false:true))return;
  var st=item.student||{},p=item.parsed;
  if(q&&norm(p.cedula+" "+studentName(st)+" "+career(st)).indexOf(q)<0)return;
  var tr=el("tr");tr.className=item.status==="ready"?"ok":item.status==="saved"?"saved":"bad";
  var c1=el("td");c1.appendChild(el("strong",p.cedula));c1.appendChild(el("small",studentName(st)||"Sin coincidencia"));tr.appendChild(c1);
  var c2=el("td",career(st)||"—");c2.appendChild(el("small",w.CargaNotasFirebase.group(st)||"—"));tr.appendChild(c2);
  tr.appendChild(el("td",p.tipo==="EXAMEN_COMPLEXIVO"?"Complexivo":p.tipo==="TRABAJO_TITULACION"?"Trabajo":p.tipo==="ARTICULO_ACADEMICO"?"Artículo":"Indefinida"));
  tr.appendChild(el("td",p.nucleos.map(function(x){return x===null?"—":x.toFixed(2);}).join(" · ")));
  var details=p.tipo==="EXAMEN_COMPLEXIVO"?"Examen "+(p.notaExamenAplicada===null?"—":p.notaExamenAplicada.toFixed(2))+(p.supletorio!==null?" (supletorio)":""):("N1 "+(p.nota1===null?"—":p.nota1.toFixed(2))+" / N2 "+(p.nota2===null?"—":p.nota2.toFixed(2)));
  tr.appendChild(el("td",details));tr.appendChild(el("td",p.final===null?"—":p.final.toFixed(2)));
  var note=el("td"),title=item.status==="ready"?"Lista":item.status==="saved"?"Guardada y verificada":item.status==="error"?"Error":item.status==="uploading"?"Subiendo":"Revisar";
  note.appendChild(el("span",title));note.lastChild.className="state";
  (item.errors.concat(item.detail?[item.detail]:[]).concat(item.warnings)).forEach(function(msg){note.appendChild(el("small",msg));});
  tr.appendChild(note);tbody.appendChild(tr);
 });
 $("cn-save").disabled=state.working||(ready+retry)===0;
}
async function connect(){
 var c=w.ConNcomplex;
 if(!c||typeof c.ready!=="function")throw Error("ConNcomplex no está disponible.");
 var result=await c.ready();if(result&&result.ok===false)throw Error(result.error||"BDLocal no está lista.");
 return c;
}
async function periods(){
 try{var c=await connect(),rows=await c.listPeriods(),select=$("cn-period");
  select.textContent="";select.appendChild(new Option("Seleccione el período",""));
  (rows||[]).forEach(function(row){var id=canonical(row.id||row.periodoId||row.periodId);if(id)select.appendChild(new Option(txt(row.label||row.nombre||id),id));});
  message("Selecciona el período y el archivo de calificaciones.");
 }catch(error){message("No se pudieron obtener períodos: "+error.message,true);}
}
async function analyze(){
 if(state.working)return;
 var file=$("cn-file").files&&$("cn-file").files[0],period=canonical($("cn-period").value);
 if(!period||!file){message("Selecciona el período y el archivo de notas.",true);return;}
 state.working=true;state.items=[];state.other=0;state.period=period;state.file=file.name;render();
 try{
  message("Leyendo el archivo y BDLocal…");
  var c=await connect();
  var parsed=await w.CargaReaderFile.read(file);
  var all=(parsed.rows||[]).map(w.CargaNotasRules.parse);
  if(!all.length)throw Error("El archivo no contiene filas.");
  if(!all.some(function(r){return r.periodoId===period}))throw Error("El archivo no contiene registros del período seleccionado.");
  state.other=all.filter(function(r){return r.periodoId!==period;}).length;
  if(canonical($("cn-period").value)!==period||$("cn-file").files[0]!==file)throw Error("El período o archivo cambió durante el análisis. Ejecuta Analizar de nuevo.");
  var selected=all.filter(function(r){return r.periodoId===period;});
  var local=await Promise.all([c.listStudents({periodoId:period}),c.listEvaluations({periodoId:period}),
     w.NcomplexNucleosStore.list(period)]);
  var articleRepo=w.BDLRepoNotas||(w.BDLRepositories&&w.BDLRepositories.get&&w.BDLRepositories.get("notas"));
  var articleRows=articleRepo&&typeof articleRepo.list==="function"?await articleRepo.list({periodoId:period}):null;
  var articlesExist=selected.some(function(r){return r.tipo==="ARTICULO_ACADEMICO";});
  if(articlesExist&&!articleRows)throw Error("No se pudo obtener el repositorio local de Artículo.");
  var evalMap=Object.create(null),artMap=Object.create(null),nucMap=Object.create(null);
  (local[1]||[]).forEach(function(r){evalMap[w.CargaNotasRules.cid(r.cedula)]=r;});
  (articleRows||[]).forEach(function(r){artMap[w.CargaNotasRules.cid(r.cedula)]=r;});
  (local[2]||[]).forEach(function(r){nucMap[w.CargaNotasRules.cid(r.cedula)+"__N"+r.nucleo]=r;});
  var first=Object.create(null),conflicting=Object.create(null),unique=[],identical=0;
  selected.forEach(function(p){
    var k=p.cedula;
    if(!first[k]){first[k]=p;unique.push(p);return;}
    if(JSON.stringify(first[k].raw)===JSON.stringify(p.raw)){identical++;return;}
    conflicting[k]=true;unique.push(p);
  });
  state.nucleos=nucMap;state.evaluaciones=evalMap;state.roster=local[0];
  state.items=unique.map(function(p){
    var item=assess(p,local[0]||[],evalMap,artMap,nucMap);
    if(conflicting[p.cedula]){item.errors.push("Dos filas de esta cédula tienen calificaciones diferentes.");item.status="blocked";}
    return item;
  });
  state.items.sort(function(a,b){return career(a.student).localeCompare(career(b.student),"es")||a.parsed.cedula.localeCompare(b.parsed.cedula);});
  var count=state.items.filter(function(i){return i.status==="ready";}).length;
  message("Analizadas "+state.items.length+" cédulas del período. "+identical+" filas idénticas omitidas; "+count+" listas y "+(state.items.length-count)+" requieren revisión. Todavía no se ha escrito ninguna nota.");
 }catch(error){message("Análisis detenido: "+(error.message||error),true);state.items=[];}
 finally{state.working=false;render();try{w.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"carga-notas"}}));}catch(e){}}
}
function localNucleus(item,n){
 var p=item.parsed,st=item.student,old=state.nucleos[p.cedula+"__N"+n]||{},doc=w.CargaNotasFirebase.nucleus(p,st,n,old);
 doc.id=p.cedula+"__"+p.periodoId+"__N"+n;
 doc.createdAt=old.createdAt||new Date().toISOString();doc.updatedAt=new Date().toISOString();
 doc.estadoSync="PENDIENTE";
 return doc;
}
async function saveOne(item,c){
 var p=item.parsed,st=item.student,fb=w.CargaNotasFirebase,docs=[];
 if(p.tipo==="EXAMEN_COMPLEXIVO"){
  for(var n=1;n<=4;n++){
   if(p.nucleos[n-1]===null)continue;
   docs.push({entity:"notas_nucleos",doc:fb.nucleus(p,st,n,state.nucleos[p.cedula+"__N"+n]),local:localNucleus(item,n)});
  }
  docs.push({entity:"notas_complexivo",doc:fb.complexivo(p,st)});
 }else if(p.tipo==="ARTICULO_ACADEMICO")docs.push({entity:"notas_articulo",doc:fb.article(p,st)});
 else docs.push({entity:"notas_trabajo",doc:fb.trabajo(p,st)});
 docs.push({entity:"notas",doc:fb.general(p,st)});
 // Prevalidación: si el documento remoto contiene una nota distinta, se
 // cancela todo el estudiante ANTES de actualizar su base local.
 await fb.preflight(docs);
 if(p.tipo==="EXAMEN_COMPLEXIVO"){
  if(docs.some(function(i){return i.local;}))await w.NcomplexNucleosStore.saveMany(docs.filter(function(i){return i.local;}).map(function(i){return i.local;}));
  await c.saveEvaluation({periodoId:p.periodoId,cedula:p.cedula,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
   notaTeorica:p.supletorio===null?p.teorico:null,notaPractica:p.supletorio===null?p.practico:null,
   notaComplexivo:p.nota2,notaTeoricaSupletorio:p.supletorio===null?null:p.teorico,
   notaPracticaSupletorio:p.supletorio===null?null:p.practico,notaSupletorio:p.supletorio,
   promedioNucleos:p.nota1,notaFinalIntegral:p.final,
   codigoTitulacion:p.codigoTitulacion,origen:"excel_institucional"},
   {source:"carga_notas_excel",periodoId:p.periodoId});
 }else if(p.tipo==="TRABAJO_TITULACION"){
  await c.saveEvaluation({periodoId:p.periodoId,cedula:p.cedula,modalidadTitulacion:"TRABAJO_TITULACION",
   notaEscrito:p.nota1,notaDefensaTrabajo:p.nota2,notaTrabajoTitulacion:p.final,
   codigoTitulacion:p.codigoTitulacion,origen:"excel_institucional"},
   {source:"carga_notas_excel",periodoId:p.periodoId});
 }else{
  var notes=w.BDLRepoNotas||(w.BDLRepositories&&w.BDLRepositories.get&&w.BDLRepositories.get("notas"));
  if(!notes||typeof notes.save!=="function")throw Error("Repositorio de Artículo no disponible.");
  await notes.save({periodoId:p.periodoId,cedula:p.cedula,Notart:p.nota1,Notdef:p.nota2,
   Notafinal:p.final,origen:"excel_institucional"});
 }
 for(var j=0;j<docs.length;j++){await fb.publish(docs[j].entity,docs[j].doc);}
 return docs.length;
}
async function save(){
 if(state.working||!state.period||!state.items.length)return;
 var ready=state.items.filter(function(i){return i.status==="ready"||i.status==="error";});
 if(!ready.length)return;
 if(!w.confirm("¿Guardar y publicar "+ready.length+" estudiante(s) en las colecciones de Firebase del período seleccionado? Los registros en revisión NO se guardarán."))return;
 state.working=true;render();var ok=0,fail=0,c=null;
 try{
  c=await connect();await w.CargaNotasFirebase.ensure();
  for(var j=0;j<ready.length;j++){
   var item=ready[j];item.status="uploading";
   progress("Procesando "+(j+1)+" / "+ready.length+" · "+item.parsed.cedula);
   try{await saveOne(item,c);item.status="saved";ok++;}
   catch(err){item.status="error";item.detail=(err&&err.message)||String(err);fail++;}
   if((j+1)%5===0||j===ready.length-1){render();await new Promise(function(resolve){setTimeout(resolve,0);});}
  }
  message("Importación: "+ok+" estudiantes guardados y verificados; "+fail+" con error. Los conflictos requieren revisión.",!!fail);
 }catch(error){message("Se detuvo la subida: "+(error&&error.message||error),true);}
 finally{state.working=false;progress("");render();}
}
function clear(){if(state.working)return;$("cn-file").value="";state.items=[];state.other=0;message("Selecciona un archivo para comenzar.");render();}
function init(){
 $("cn-analyze").addEventListener("click",analyze);$("cn-save").addEventListener("click",save);
 $("cn-clear").addEventListener("click",clear);$("cn-period").addEventListener("change",function(){state.items=[];state.period="";render();});
 $("cn-file").addEventListener("change",function(){state.items=[];state.period="";render();message("Archivo cambiado. Pulsa Analizar antes de guardar.");});
 $("cn-search").addEventListener("input",render);$("cn-filter").addEventListener("change",render);
 periods();
}
w.CargaNotasApp={version:"1.0.0",analyze:analyze,save:save,state:state,assess:assess};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);