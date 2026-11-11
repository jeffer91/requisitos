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
  if(!active(st))warnings.push("Matrícula no activa en la base local; se carga igual.");
  var declared=w.CargaNotasRules.modality(st["Tipo de titulación"]||st.tipoTitulacion||st.modalidadTitulacion);
  var existingEval=byEval[parsed.cedula];
  var savedMod=w.CargaNotasRules.modality(existingEval&&existingEval.modalidadTitulacion);
  if(savedMod&&savedMod!==parsed.tipo)replaced.push("Modalidad: la app tenía "+savedMod+"; se reemplaza por "+parsed.tipo+".");
  var c=code(st);
  // Los códigos de núcleo solo importan en complexivo (en artículo vienen de núcleos antiguos).
  if(parsed.tipo==="EXAMEN_COMPLEXIVO")parsed.codigosNucleos.forEach(function(key){
    if(!key||!c)return;
    var base=key.toUpperCase().replace(/-\d+$/,"");
    if(base!==c)warnings.push("Código de núcleo "+key+" no coincide con la carrera "+c+".");
  });
  var group=w.CargaNotasFirebase.group(st);
  if(group&&w.CargaNotasFirebase.groupGuessed(st))warnings.push("El código de carrera «"+code(st)+"» no indica modalidad; se toma Presencial por el nombre de la carrera.");
  // Igual que Carga: se sube directo. Lo que antes bloqueaba ahora solo se avisa.
  if(!group)warnings.push("Sin grupo Presencial/Online/PVC en la base local.");
  if((parsed.tipo==="EXAMEN_COMPLEXIVO"||parsed.tipo==="TRABAJO_TITULACION")&&
     st.aprobacionFinal!==true&&!(st._aprobacionFinal&&st._aprobacionFinal.eligible===true))
    warnings.push("Aún sin Aprobación final en la base local; las notas se cargan igual.");
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
  warnings.push("El sistema aún no trae todas las notas de este trabajo; se carga lo que hay.");
 var onlyNucleos=false;
 if(parsed.tipo==="EXAMEN_COMPLEXIVO"&&parsed.notaExamenAplicada===null){
  if(parsed.nucleos.some(function(v){return v!==null;})){onlyNucleos=true;warnings.push("Sin examen complexivo en el sistema: se cargan solo los núcleos.");}
  else errors.push("El sistema no trae ninguna nota de núcleos ni de examen.");
 }
 if(parsed.tipo==="ARTICULO_ACADEMICO"&&parsed.nota1===null&&parsed.nota2===null)
  errors.push("El sistema no trae ninguna nota de este artículo.");
 // Lo calculado (desglose de núcleos, ordinario en supletorio…) es lo esperado: queda
 // marcado en los datos (camposCalculados) y se ve en cursiva en las pestañas, sin aviso.
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
  tr.appendChild(el("td",p.tipo==="EXAMEN_COMPLEXIVO"?p.nucleos.map(function(x){return x===null?"—":x.toFixed(2);}).join(" · "):"—"));
  var f2=function(v){return v===null||v===undefined?"—":Number(v).toFixed(2);};
  var details=p.tipo==="EXAMEN_COMPLEXIVO"?"Examen "+f2(p.notaExamenAplicada)+(p.supletorio!==null?" (supletorio)":"")
   :"Escrito "+f2(p.nota1)+" · Oral "+f2(p.nota2)+(p.formula?" · "+p.formula:"");
  if(p.proyecto&&p.tipo!=="EXAMEN_COMPLEXIVO"){
   var pj=p.proyecto;details+="\nTutor "+f2(pj.tutor.nota)+" · Lector "+f2(pj.lector.nota)+" · Práctica "+f2(pj.promedioPractica)+" · Defensa "+f2(pj.promedioDefensa);
  }
  tr.appendChild(el("td",details));tr.appendChild(el("td",p.final===null?"—":p.final.toFixed(2)));
  var note=el("td"),title=item.status==="ready"?"Lista":item.status==="saved"?"Guardada y verificada":item.status==="error"?"Error":item.status==="uploading"?"Subiendo":"Revisar";
  note.appendChild(el("span",title));note.lastChild.className="state";
  (item.errors.concat(item.detail?[item.detail]:[]).concat(item.warnings)).forEach(function(msg){note.appendChild(el("small",msg));});
  tr.appendChild(note);tbody.appendChild(tr);
 });
 $("cn-save").disabled=state.working||(ready+retry)===0;
 renderUnmatched();
}
function tipoLabel(t){return t==="EXAMEN_COMPLEXIVO"?"Complexivo":t==="TRABAJO_TITULACION"?"Trabajo":t==="ARTICULO_ACADEMICO"?"Artículo":"Indefinida";}
/* Cédulas del archivo que no existen en la base local: no se suben porque no hay
   estudiante ni período de matrícula con qué cotejarlas. Se listan para agregarlas en Carga. */
function fillList(boxId,countId,bodyId,list){
 var box=$(boxId);if(!box)return;box.hidden=!list.length;if(!list.length)return;
 $(countId).textContent=list.length;var tb=$(bodyId);tb.textContent="";
 list.forEach(function(p){var tr=el("tr");[p.cedula||"—",tipoLabel(p.tipo),p.periodoSistema||"—",p.final===null?"—":p.final.toFixed(2)].forEach(function(v){tr.appendChild(el("td",v));});tb.appendChild(tr);});
}
function renderUnmatched(){
 fillList("cn-unmatched","cn-unmatched-count","cn-unmatched-body",state.unmatched||[]);
 fillList("cn-othermod","cn-othermod-count","cn-othermod-body",state.otherModality||[]);
 var hint=$("cn-othermod-hint");
 if(hint)hint.textContent=state.kind==="PVC"?"Este período es PVC y solo recibe Artículo académico. Las notas de Complexivo y Trabajo se cargan eligiendo su período regular (Abr–Sep u Oct–Mar).":
  "Este período es regular y solo recibe Examen complexivo y Trabajo de titulación. Las notas de Artículo se cargan eligiendo su período PVC.";
}
function downloadUnmatched(){
 var list=state.unmatched||[];if(!list.length)return;
 var lines=["Cédula;Modalidad;Período en el sistema;Nota final"].concat(list.map(function(p){return [p.cedula,tipoLabel(p.tipo),p.periodoSistema,p.final===null?"":p.final.toFixed(2).replace(".",",")].join(";");}));
 var a=d.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}));
 a.download="Cedulas_no_matriculadas_"+(state.period||"periodo")+".csv";d.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}
async function connect(){
 var c=w.ConNcomplex;
 if(!c||typeof c.ready!=="function")throw Error("ConNcomplex no está disponible.");
 var result=await c.ready();if(result&&result.ok===false)throw Error(result.error||"BDLocal no está lista.");
 return c;
}
/* El período lo decide el selector (sigue al período global de la barra superior).
   Regular (Abr–Sep, Oct–Mar): Examen complexivo o Trabajo de titulación.
   PVC (cualquier otro):       solo Artículo académico. */
function periodKind(id){var m=txt(id).match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);if(!m)return "";var a=+m[2],b=+m[4];return (a===4&&b===9)||(a===10&&b===3)?"REGULAR":"PVC";}
function allowed(kind,tipo){return kind==="PVC"?tipo==="ARTICULO_ACADEMICO":tipo==="EXAMEN_COMPLEXIVO"||tipo==="TRABAJO_TITULACION";}
function kindLabel(kind){return kind==="PVC"?"PVC · solo Artículo académico":"Regular · Examen complexivo y Trabajo de titulación";}
async function periods(){
 try{var c=await connect(),rows=await c.listPeriods(),select=$("cn-period");
  state.periods=(rows||[]).map(function(row){return {id:canonical(row.id||row.periodoId||row.periodId),label:txt(row.label||row.nombre)};}).filter(function(r){return r.id;})
   .sort(function(a,b){return b.id.localeCompare(a.id);});
  var keep=canonical(select.value);select.textContent="";
  state.periods.forEach(function(row){select.appendChild(new Option(row.label||row.id,row.id));});
  var g=w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.get&&w.RequisitosPeriodoGlobal.get();
  var want=g&&g.id||keep;if(want&&state.periods.some(function(r){return r.id===want;}))select.value=want;
  if(w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.scan)w.RequisitosPeriodoGlobal.scan();
  showKind();
  message(state.periods.length?"Elige el período y sube el archivo de notas del sistema; se analiza solo.":"La base local no tiene períodos. Carga primero los estudiantes en Carga.",!state.periods.length);
 }catch(error){message("No se pudieron obtener períodos: "+error.message,true);}
}
function showKind(){var k=periodKind(canonical($("cn-period").value)),n=$("cn-kind");if(!n)return;n.hidden=!k;n.textContent=k?kindLabel(k):"";n.className="kind"+(k==="PVC"?" pvc":"");}
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
function key(period,cedula){return period+"|"+cedula;}
async function analyze(){
 if(state.working)return;
 var file=$("cn-file").files&&$("cn-file").files[0],choice=canonical($("cn-period").value);
 if(!file){message("Sube el archivo de notas del sistema (NotasTitulacion_*.xls).",true);return;}
 if(!periodKind(choice)){message("Elige el período al que pertenecen estas notas.",true);return;}
 var kind=periodKind(choice);
 state.working=true;state.items=[];state.other=0;state.unmatched=[];state.otherModality=[];state.period=choice;state.kind=kind;state.file=file.name;render();
 try{
  message("Leyendo el archivo…");
  var c=await connect();
  var parsed=await w.CargaReaderFile.read(file);
  var all=(parsed.rows||[]).map(w.CargaNotasRules.parse).filter(function(r){return r.cedula||r.tipo;});
  if(!all.length)throw Error("El archivo no contiene filas de notas.");
  if(!all.some(function(r){return r.tipo;}))throw Error("El archivo no parece el reporte de notas de titulación (faltan las columnas trabajoTitulacion / tipo_titulacion).");
  message("Cotejando "+all.length+" filas con los matriculados de "+periodLabel(choice)+"…");
  var roster=await c.listStudents({periodoId:choice});
  if($("cn-file").files[0]!==file||canonical($("cn-period").value)!==choice)throw Error("El archivo o el período cambió durante el análisis.");
  var byCed=Object.create(null);
  (roster||[]).forEach(function(st){var k=id(st);if(k&&!byCed[k])byCed[k]=st;});
  var rowsByCed=Object.create(null),order=[];
  all.forEach(function(r){if(!rowsByCed[r.cedula]){rowsByCed[r.cedula]=[];order.push(r.cedula);}rowsByCed[r.cedula].push(r);});
  var chosen=[],used=Object.create(null);
  order.forEach(function(ced){
   var rows=rowsByCed[ced],fit=rows.filter(function(r){return allowed(kind,r.tipo);});
   // Solo se asignan notas al período elegido y a la modalidad que le corresponde.
   if(!fit.length){state.otherModality.push(pick(rows,choice)[0]);return;}
   var st=ced&&byCed[ced];
   if(!st){state.other++;state.unmatched.push(pick(fit,choice)[0]);return;}
   var row=pick(fit,choice)[0];
   row.periodoId=choice;
   chosen.push({row:row,st:st});
   used[choice]=true;
  });
  if(!chosen.length)throw Error("Ninguna fila del archivo es de "+periodLabel(choice)+": "+state.unmatched.length+" de "+(kind==="PVC"?"artículo":"complexivo o trabajo")+" no están matriculados en este período y "+state.otherModality.length+" son de otra modalidad (ver listas abajo).");
  var periodsUsed=Object.keys(used);
  message("Leyendo notas existentes de "+periodLabel(choice)+"…");
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
  message(periodLabel(choice)+" ("+(kind==="PVC"?"PVC":"regular")+"): "+state.items.length+" estudiantes del período · "+count+" listos ("
   +(kind==="PVC"?types.ARTICULO_ACADEMICO+" artículo":types.EXAMEN_COMPLEXIVO+" complexivo, "+types.TRABAJO_TITULACION+" trabajo")+")"
   +(replacing?" · "+replacing+" reemplazan notas de la app":"")+" · "+state.unmatched.length+" no matriculados en este período · "+state.otherModality.length+" de otra modalidad."
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
 var changed=0;
 for(var j=0;j<docs.length;j++){var res=await fb.publish(docs[j].entity,docs[j].doc);if(!res||!res.unchanged)changed++;}
 return {docs:docs.length,changed:changed};
}
async function save(){
 if(state.working||!state.items.length)return;
 var ready=state.items.filter(function(i){return i.status==="ready"||i.status==="error";});
 if(!ready.length)return;
 
 state.working=true;render();var ok=0,fail=0,c=null,done=0,same=0;
 try{
  c=await connect();await w.CargaNotasFirebase.ensure();
  var queue=ready.slice(),started=Date.now();
  async function worker(){
   while(queue.length){
    var item=queue.shift();item.status="uploading";
    try{var out=await saveOne(item,c);item.status="saved";item.detail=out&&out.changed===0?"Ya estaba igual en Firebase (sin cambios).":"";ok++;if(out&&out.changed===0)same++;}
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
  var tail=same?" ("+same+" ya estaban iguales y no se reescribieron)":"";
  message(fail?"Carga terminada: "+ok+" estudiantes guardados y verificados"+tail+"; "+fail+" con error (pulsa «Guardar notas» otra vez para reintentar).":"Listo: "+ok+" estudiantes cargados y verificados en Firebase"+tail+".",!!fail);
 }catch(error){message("Se detuvo la carga: "+(error&&error.message||error),true);}
 finally{state.working=false;progress("");render();}
}
function clear(){if(state.working)return;$("cn-file").value="";state.unmatched=[];state.otherModality=[];$("cn-reasons").textContent="";state.items=[];state.other=0;message("Sube el archivo de notas del sistema; se analiza solo.");render();}
function init(){
 $("cn-analyze").addEventListener("click",analyze);$("cn-save").addEventListener("click",save);
 $("cn-clear").addEventListener("click",clear);
 $("cn-period").addEventListener("change",function(){showKind();state.items=[];render();if($("cn-file").files&&$("cn-file").files[0])analyze();});
 $("cn-file").addEventListener("change",function(){state.items=[];render();if($("cn-file").files&&$("cn-file").files[0])analyze();});
 $("cn-search").addEventListener("input",render);$("cn-filter").addEventListener("change",render);
 $("cn-unmatched-download").addEventListener("click",downloadUnmatched);
 periods();
}
w.CargaNotasApp={version:"4.0.0",analyze:analyze,save:save,state:state,assess:assess,pick:pick,periodKind:periodKind,allowed:allowed};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
