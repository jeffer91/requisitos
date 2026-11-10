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
 if(previous==null||incoming==null||txt(previous)===""||txt(incoming)==="")return;
 if(!Number.isFinite(Number(previous))||!Number.isFinite(Number(incoming)))return;
 if(!same(Number(previous),Number(incoming)))errors.push((label||field)+": la app tenía "+previous+"; se reemplaza por "+incoming+" del sistema.");
}
function sourceGrade(item,field){return item.parsed[field];}
function assess(parsed,roster,byEval,byArticle,byNucleo){
 // El sistema gana: diferencias con la app o Firebase son avisos, no bloqueos.
 var errors=parsed.errors.slice(),warnings=parsed.warnings.slice(),replaced=[],st=null;
 var found=roster.filter(function(row){return id(row)===parsed.cedula;});
 if(found.length!==1)errors.push(found.length?"Cédula duplicada en BDLocal.":"La cédula no está matriculada en la base local.");
 else st=found[0];
 if(st){
  if(!active(st))errors.push("Matrícula no ACTIVA.");
  if(parsed.periodoSistemaId&&periodOf(st)&&parsed.periodoSistemaId!==periodOf(st))
   warnings.push("El sistema lo registra en «"+(parsed.periodoSistema||parsed.periodoSistemaId)+"»; se guarda en el período de su matrícula.");
  var declared=w.CargaNotasRules.modality(st["Tipo de titulación"]||st.tipoTitulacion||st.modalidadTitulacion);
  var existingEval=byEval[parsed.cedula];
  var savedMod=w.CargaNotasRules.modality(existingEval&&existingEval.modalidadTitulacion);
  if(declared&&declared!==parsed.tipo)warnings.push("La ficha dice "+declared+"; se usa la modalidad del sistema.");
  if(savedMod&&savedMod!==parsed.tipo)replaced.push("Modalidad: la app tenía "+savedMod+"; se reemplaza por "+parsed.tipo+".");
  var c=code(st);
  parsed.codigosNucleos.forEach(function(key){
    if(!key||!c)return;
    var base=key.toUpperCase().replace(/-\d+$/,"");
    if(base!==c)warnings.push("Código de núcleo "+key+" no coincide con la carrera "+c+".");
  });
  var group=w.CargaNotasFirebase.group(st);
  if(group&&w.CargaNotasFirebase.groupGuessed(st))warnings.push("El código de carrera «"+code(st)+"» no indica modalidad; se toma Presencial por el nombre de la carrera.");
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
   gradeMismatch(evaluation[pair[0]],pair[1],pair[0],replaced);
  });
  parsed.nucleos.forEach(function(value,i){
   if(value===null||!Number.isFinite(value))return;
   var previous=byNucleo[parsed.cedula+"__N"+(i+1)];
   if(previous)gradeMismatch(previous.totalMoodle,value,"N"+(i+1),replaced,"Núcleo "+(i+1));
  });
 }else if(parsed.tipo==="TRABAJO_TITULACION"){
  [["notaEscrito",parsed.nota1],["notaDefensaTrabajo",parsed.nota2],["notaTrabajoTitulacion",parsed.final]].forEach(function(pair){
   gradeMismatch(evaluation[pair[0]],pair[1],pair[0],replaced);
  });
 }else if(parsed.tipo==="ARTICULO_ACADEMICO"){
  var art=byArticle[parsed.cedula]||{};
  [["notaArticulo",parsed.nota1],["notaDefensa",parsed.nota2],["notaFinal",parsed.final]].forEach(function(pair){
   gradeMismatch(art[pair[0]]!==undefined?art[pair[0]]:art[pair[0]==="notaArticulo"?"Notart":pair[0]==="notaDefensa"?"Notdef":"Notafinal"],pair[1],pair[0],replaced);
  });
 }
 if(parsed.tipo==="TRABAJO_TITULACION"&&(parsed.nota1===null||parsed.nota2===null||parsed.final===null))
  errors.push("El sistema aún no trae escrito, defensa y nota final de este trabajo.");
 var onlyNucleos=false;
 if(parsed.tipo==="EXAMEN_COMPLEXIVO"&&parsed.notaExamenAplicada===null){
  if(parsed.nucleos.some(function(v){return v!==null;})){onlyNucleos=true;warnings.push("Sin examen complexivo en el sistema: se cargan solo los núcleos.");}
  else errors.push("Sin notas de núcleos ni de examen.");
 }
 if(parsed.tipo==="ARTICULO_ACADEMICO"&&parsed.nota1===null&&parsed.nota2===null)
  errors.push("Sin calificaciones de artículo o defensa.");
 if(parsed.calculados&&parsed.calculados.length)warnings.push("Calculado: "+parsed.calculados.join(", ")+".");
 return {parsed:parsed,student:st,errors:errors,warnings:replaced.concat(warnings),replaced:replaced,onlyNucleos:onlyNucleos,
  status:errors.length?"blocked":"ready",detail:""};
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
var AUTO="*";
async function periods(){
 try{var c=await connect(),rows=await c.listPeriods(),select=$("cn-period");
  state.periods=(rows||[]).map(function(row){return {id:canonical(row.id||row.periodoId||row.periodId),label:txt(row.label||row.nombre)};}).filter(function(r){return r.id;});
  select.textContent="";select.appendChild(new Option("Todos · detectar por cédula (recomendado)",AUTO));
  state.periods.forEach(function(row){select.appendChild(new Option(row.label||row.id,row.id));});
  select.value=AUTO;
  message(state.periods.length?"Sube el archivo de notas del sistema; se analiza solo.":"La base local no tiene períodos. Carga primero los estudiantes en Carga.",!state.periods.length);
 }catch(error){message("No se pudieron obtener períodos: "+error.message,true);}
}
function periodLabel(id){var f=(state.periods||[]).filter(function(p){return p.id===id;})[0];return f&&f.label||id;}
/* Una fila por cédula. Si el sistema trae varias, gana la del mismo período;
   después, la que tiene nota final; si aún difieren, la última del archivo. */
function pick(rows,period){
 var by=Object.create(null),order=[];
 rows.forEach(function(r){if(!by[r.cedula]){by[r.cedula]=[];order.push(r.cedula);}by[r.cedula].push(r);});
 return order.map(function(k){
  var list=by[k];if(list.length===1)return list[0];
  var scored=list.map(function(r,i){return {r:r,s:(r.periodoSistemaId===period?4:0)+(r.final!==null?2:0)+(r.errors.length?0:1),i:i};});
  scored.sort(function(a,b){return b.s-a.s||b.i-a.i;});
  var best=scored[0].r,distinct=list.some(function(r){return JSON.stringify(r.raw)!==JSON.stringify(best.raw);});
  if(distinct)best.warnings.push("El sistema trae "+list.length+" filas de esta cédula; se usa la "+(best.periodoSistemaId===period?"del mismo período":"más completa")+".");
  return best;
 });
}
function approved(st){return st&&(st.aprobacionFinal===true||(st._aprobacionFinal&&st._aprobacionFinal.eligible===true));}
/* Matrícula de cada cédula. Si está en varios períodos: el que dice el sistema,
   luego el que tiene Aprobación final, luego el más reciente. */
function enrollment(candidates,systemPeriods){
 var act=candidates.filter(function(m){return active(m.st);});
 var list=act.length?act:candidates;
 if(!list.length)return null;
 list=list.slice().sort(function(a,b){
  var sa=(systemPeriods.indexOf(a.period)>=0?4:0)+(approved(a.st)?2:0),sb=(systemPeriods.indexOf(b.period)>=0?4:0)+(approved(b.st)?2:0);
  return sb-sa||b.period.localeCompare(a.period);
 });
 return {period:list[0].period,st:list[0].st,count:list.length};
}
function key(period,cedula){return period+"|"+cedula;}
async function analyze(){
 if(state.working)return;
 var file=$("cn-file").files&&$("cn-file").files[0],choice=canonical($("cn-period").value)||AUTO;
 if(!file){message("Sube el archivo de notas del sistema (NotasTitulacion_*.xls).",true);return;}
 state.working=true;state.items=[];state.other=0;state.unmatched=[];state.period=choice;state.file=file.name;render();
 try{
  message("Leyendo el archivo…");
  var c=await connect();
  var parsed=await w.CargaReaderFile.read(file);
  var all=(parsed.rows||[]).map(w.CargaNotasRules.parse).filter(function(r){return r.cedula||r.tipo;});
  if(!all.length)throw Error("El archivo no contiene filas de notas.");
  if(!all.some(function(r){return r.tipo;}))throw Error("El archivo no parece el reporte de notas de titulación (faltan las columnas trabajoTitulacion / tipo_titulacion).");
  if(!state.periods||!state.periods.length)await periods();
  var targets=choice===AUTO?(state.periods||[]).map(function(p){return p.id;}):[choice];
  if(!targets.length)throw Error("La base local no tiene períodos.");
  message("Cotejando "+all.length+" filas con la base local ("+targets.length+" período(s))…");
  var rosters=await Promise.all(targets.map(function(p){return c.listStudents({periodoId:p});}));
  if($("cn-file").files[0]!==file)throw Error("El archivo cambió durante el análisis.");
  var byCed=Object.create(null);
  rosters.forEach(function(rows,i){(rows||[]).forEach(function(st){
   var k=id(st);if(!k)return;(byCed[k]=byCed[k]||[]).push({period:targets[i],st:st});});});
  var rowsByCed=Object.create(null),order=[];
  all.forEach(function(r){if(!rowsByCed[r.cedula]){rowsByCed[r.cedula]=[];order.push(r.cedula);}rowsByCed[r.cedula].push(r);});
  var chosen=[],used=Object.create(null);
  order.forEach(function(ced){
   var rows=rowsByCed[ced],cands=ced&&byCed[ced]||[];
   if(!cands.length){state.other++;state.unmatched.push(ced);return;}
   var m=enrollment(cands,rows.map(function(r){return r.periodoSistemaId;}));
   var row=pick(rows,m.period)[0];
   row.periodoId=m.period;
   if(m.count>1)row.warnings.push("Matriculado en "+m.count+" períodos; se usa "+periodLabel(m.period)+".");
   chosen.push({row:row,st:m.st,others:cands.map(function(x){return x.st;})});
   used[m.period]=true;
  });
  if(!chosen.length)throw Error("Ninguna cédula del archivo está en la base local"+(choice===AUTO?"":" para "+periodLabel(choice))+".");
  var periodsUsed=Object.keys(used);
  message("Leyendo notas existentes de "+periodsUsed.length+" período(s)…");
  var articleRepo=w.BDLRepoNotas||(w.BDLRepositories&&w.BDLRepositories.get&&w.BDLRepositories.get("notas"));
  var extra=await Promise.all(periodsUsed.map(function(p){return Promise.all([c.listEvaluations({periodoId:p}),
    w.NcomplexNucleosStore.list(p),articleRepo&&typeof articleRepo.list==="function"?articleRepo.list({periodoId:p}):[]]);}));
  var evalMap=Object.create(null),artMap=Object.create(null),nucMap=Object.create(null);
  extra.forEach(function(set,i){var p=periodsUsed[i];
   (set[0]||[]).forEach(function(r){evalMap[key(p,w.CargaNotasRules.cid(r.cedula))]=r;});
   (set[1]||[]).forEach(function(r){nucMap[key(p,w.CargaNotasRules.cid(r.cedula))+"__N"+r.nucleo]=r;});
   (set[2]||[]).forEach(function(r){artMap[key(p,w.CargaNotasRules.cid(r.cedula))]=r;});
  });
  state.nucleos=nucMap;state.evaluaciones=evalMap;
  state.items=chosen.map(function(x){
   var p=x.row,k=key(p.periodoId,p.cedula),e=Object.create(null),a=Object.create(null),n=Object.create(null);
   if(evalMap[k])e[p.cedula]=evalMap[k];if(artMap[k])a[p.cedula]=artMap[k];
   for(var i=1;i<=4;i++)if(nucMap[k+"__N"+i])n[p.cedula+"__N"+i]=nucMap[k+"__N"+i];
   return assess(p,[x.st],e,a,n);
  });
  state.items.sort(function(a,b){return (b.status==="blocked")-(a.status==="blocked")||career(a.student).localeCompare(career(b.student),"es")||a.parsed.cedula.localeCompare(b.parsed.cedula);});
  var count=state.items.filter(function(i){return i.status==="ready";}).length;
  var types={EXAMEN_COMPLEXIVO:0,TRABAJO_TITULACION:0,ARTICULO_ACADEMICO:0};
  state.items.forEach(function(i){if(i.status==="ready"&&types[i.parsed.tipo]!==undefined)types[i.parsed.tipo]++;});
  var replacing=state.items.filter(function(i){return i.replaced&&i.replaced.length;}).length;
  message(state.items.length+" estudiantes encontrados en la base local · "+count+" listos ("+types.EXAMEN_COMPLEXIVO+" complexivo, "+types.TRABAJO_TITULACION+" trabajo, "+types.ARTICULO_ACADEMICO+" artículo)"
   +(replacing?" · "+replacing+" reemplazan notas de la app":"")+" · "+state.unmatched.length+" cédulas del archivo no están en la base local."
   +(count?" Pulsa «Guardar notas» para cargar.":""));
  var reasons=Object.create(null);
  state.items.forEach(function(i){if(i.status!=="blocked")return;var r=i.errors[0]||"Revisar";
   if(/Aprobación final/.test(r))r="Sin Aprobación final en "+periodLabel(i.parsed.periodoId);(reasons[r]=reasons[r]||0);reasons[r]++;});
  state.reasons=Object.keys(reasons).map(function(r){return reasons[r]+" · "+r;});
  $("cn-reasons").textContent=state.reasons.length?"En revisión: "+state.reasons.join(" | "):"";
 }catch(error){message("Análisis detenido: "+(error.message||error),true);state.items=[];}
 finally{state.working=false;render();try{w.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"carga-notas"}}));}catch(e){}}
}
function existingNucleus(p,n){return state.nucleos[key(p.periodoId,p.cedula)+"__N"+n]||null;}
function localNucleus(item,n){
 var p=item.parsed,st=item.student,old=existingNucleus(p,n)||{},doc=w.CargaNotasFirebase.nucleus(p,st,n,old);
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
   docs.push({entity:"notas_nucleos",doc:fb.nucleus(p,st,n,existingNucleus(p,n)),local:localNucleus(item,n)});
  }
  if(!item.onlyNucleos)docs.push({entity:"notas_complexivo",doc:fb.complexivo(p,st)});
 }else if(p.tipo==="ARTICULO_ACADEMICO")docs.push({entity:"notas_articulo",doc:fb.article(p,st)});
 else docs.push({entity:"notas_trabajo",doc:fb.trabajo(p,st)});
 if(!item.onlyNucleos)docs.push({entity:"notas",doc:fb.general(p,st)});
 // Revisión previa (registros eliminados en Firebase) ANTES de tocar la base local.
 await fb.preflight(docs);
 if(p.tipo==="EXAMEN_COMPLEXIVO"){
  if(docs.some(function(i){return i.local;}))await w.NcomplexNucleosStore.saveMany(docs.filter(function(i){return i.local;}).map(function(i){return i.local;}));
  if(!item.onlyNucleos)await c.saveEvaluation({periodoId:p.periodoId,cedula:p.cedula,modalidadTitulacion:"EXAMEN_COMPLEXIVO",
   notaTeorica:p.supletorio===null?p.teorico:(p.ordinarioCalculado?p.ordinarioCalculado.teorico:null),
   notaPractica:p.supletorio===null?p.practico:(p.ordinarioCalculado?p.ordinarioCalculado.practico:null),
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
 if(state.working||!state.items.length)return;
 var ready=state.items.filter(function(i){return i.status==="ready"||i.status==="error";});
 if(!ready.length)return;
 var replacing=ready.filter(function(i){return i.replaced&&i.replaced.length;}).length;
 if(!w.confirm("¿Cargar las notas de "+ready.length+" estudiante(s) en la base local y en Firebase?"+(replacing?" "+replacing+" tienen notas distintas en la app y se REEMPLAZARÁN por las del sistema.":"")+" Los registros en revisión NO se guardarán."))return;
 state.working=true;render();var ok=0,fail=0,c=null,done=0;
 try{
  c=await connect();await w.CargaNotasFirebase.ensure();
  var queue=ready.slice(),started=Date.now();
  async function worker(){
   while(queue.length){
    var item=queue.shift();item.status="uploading";
    try{await saveOne(item,c);item.status="saved";item.detail="";ok++;}
    catch(err){item.status="error";item.detail=(err&&err.message)||String(err);fail++;}
    done++;
    if(done%10===0||done===ready.length){
     var secs=Math.round((Date.now()-started)/1000),left=done?Math.round(secs/done*(ready.length-done)):0;
     progress("Cargando "+done+" / "+ready.length+(left?" · faltan ~"+left+" s":""));render();
     await new Promise(function(resolve){setTimeout(resolve,0);});
    }
   }
  }
  // Cuatro estudiantes a la vez: cada uno escribe y verifica sus propios documentos.
  await Promise.all([worker(),worker(),worker(),worker()]);
  message(fail?"Carga terminada: "+ok+" estudiantes guardados y verificados; "+fail+" con error (puedes pulsar Guardar otra vez para reintentar).":"Listo: "+ok+" estudiantes cargados y verificados en Firebase.",!!fail);
 }catch(error){message("Se detuvo la carga: "+(error&&error.message||error),true);}
 finally{state.working=false;progress("");render();}
}
function clear(){if(state.working)return;$("cn-file").value="";$("cn-reasons").textContent="";state.items=[];state.other=0;message("Sube el archivo de notas del sistema; se analiza solo.");render();}
function init(){
 $("cn-analyze").addEventListener("click",analyze);$("cn-save").addEventListener("click",save);
 $("cn-clear").addEventListener("click",clear);
 $("cn-period").addEventListener("change",function(){state.items=[];render();if($("cn-file").files&&$("cn-file").files[0])analyze();});
 $("cn-file").addEventListener("change",function(){state.items=[];render();if($("cn-file").files&&$("cn-file").files[0])analyze();});
 $("cn-search").addEventListener("input",render);$("cn-filter").addEventListener("change",render);
 periods();
}
w.CargaNotasApp={version:"3.0.0",analyze:analyze,save:save,state:state,assess:assess,pick:pick,enrollment:enrollment};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
