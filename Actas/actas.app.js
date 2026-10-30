/* Módulo Actas: ambos requisitos finales CUMPLE; cronogramas editables y actas en borrador. */
(function(w,d){"use strict";
const C=w.ActasCatalog,CX=C.COMPLEXIVO,TT=C.TRABAJO;
const S={periods:[],students:[],reqs:[],periodo:"",mode:"TODAS",busqueda:"",estado:"todos",selected:new Set(),ready:false,loading:false,requestId:0,cronograma:null};
const $=id=>d.getElementById(id),text=v=>String(v==null?"":v).trim();
function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function esc(v){return text(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function idPeriod(v){const x=text(v);return x.replace(/_+/g,"__");}
function ced(s){return text(s.cedula||s.numeroIdentificacion||s.NumeroIdentificacion||s.Cedula||s._cedula).replace(/[^0-9A-Za-z]/g,"").toUpperCase();}
function period(s){return idPeriod(s.periodoId||s.periodId||s.periodoCanonicoId||s.ultimoPeriodoId||s._periodoId);}
function career(s){return text(s.NombreCarrera||s.nombreCarrera||s.carrera||s.Carrera||"Sin carrera");}
function name(s){return text(s.Nombres||s.nombres||s.nombreCompleto||s.Nombre||s.nombre||"Sin nombre");}
function stKey(s){return ced(s)+"__"+period(s);}
function reqKey(r){return norm(r.requisitoKey||r.requirementKey||r.key||r.nombre||r.requisitoLabel);}
function reqValue(r){const v=r.valor!==undefined?r.valor:r.estado!==undefined?r.estado:r.value!==undefined?r.value:r.cumple!==undefined?r.cumple:r.aprobado;return norm(typeof v==="object"&&v?(v.value||v.label||v.id):v);}
const KEY1="aprobaciontitulacion",KEY2="aprobacioncomplexivoproyecto";
function extras(row){const keys=Object.keys(row||{});const out={};for(const key of keys){const k=norm(key);if(k===KEY1||k===KEY2){const v=row[key];out[k]=norm(typeof v==="object"&&v?(v.valor||v.estado||v.value||v.label):v);}}return out;}
function indexReqs(){const m=new Map();for(const r of S.reqs){const p=idPeriod(r.periodoId||r.periodId||r.periodoCanonicoId),c=ced(r);if(!p||!c)continue;const k=c+"__"+p;if(!m.has(k))m.set(k,{});m.get(k)[reqKey(r)]=reqValue(r);}return m;}
function approval(value){return value==="cumple";}
function modality(s){
  const parse=value=>{const k=norm(value);if(!k)return "";if(k.includes("articulo"))return "ARTICULO_ACADEMICO";if(k.includes("trabajo")||k==="proyecto")return TT;if(k.includes("complexivo"))return CX;return "";};
  const fixed=parse(s.tipoTitulacion||s.TipoTitulacion||s._raw&&s._raw.tipoTitulacion||s._raw&&s._raw.TipoTitulacion);if(fixed==="ARTICULO_ACADEMICO")return fixed;
  const declared=parse(s._modalidadTitulacion||s.modalidadTitulacion||s.ModalidadTitulacion||s._raw&&s._raw.modalidadTitulacion||s._raw&&s._raw.ModalidadTitulacion);
  const evaluated=parse(s._ncomplexEvaluation&&s._ncomplexEvaluation.modalidadTitulacion);
  return declared||evaluated||CX;
}
function errorConflict(s){
  const estado=text(s.estadoEvaluacion).toUpperCase(),matricula=text(s.estadoMatricula||s._estadoMatricula).toUpperCase();
  if(matricula==="RETIRADO"||s.retirado===true||s.eliminado===true)return true;
  if(s._ncomplexHasSavedEvaluation===true){
    if(["NO_APROBADO","SIN_NOTAS","INCOMPLETO"].includes(estado))return true;
    const evalMode=s._ncomplexEvaluation&&s._ncomplexEvaluation.modalidadTitulacion;
    const selected=modality(s),ev=norm(evalMode);
    if(ev&&((selected===CX&&!ev.includes("complexivo"))||(selected===TT&&!ev.includes("trabajo"))||(selected==="ARTICULO_ACADEMICO"&&!ev.includes("articulo"))))return true;
  }
  return false;
}
function rows(){const idx=indexReqs();return S.students.filter(s=>period(s)===S.periodo).map(s=>{const vals=Object.assign({},extras(s),idx.get(stKey(s))||{}),mode=modality(s);const proof=w.ActasEvidence.assess({student:s,requirementValues:vals,mode});const a=approval(vals[KEY1]),b=approval(vals[KEY2]),conflict=errorConflict(s);return {student:s,identity:stKey(s),mode,a,b,proof,approved:proof.eligible&&!conflict&&(mode===CX||mode===TT),conflict};});}
function notify(msg,isError){const el=$("actas-alert");el.textContent=msg;el.classList.toggle("error",!!isError);}
function store(k,value){try{w.localStorage.setItem(k,JSON.stringify(value));return true;}catch(e){notify("No se pudo guardar localmente: "+e.message,true);return false;}}
function retrieve(k,otherwise){try{const val=JSON.parse(w.localStorage.getItem(k));return val==null?otherwise:val;}catch(e){return otherwise;}}
function cronKey(mode){return "UTET_ACTAS_CRONO_V1__"+S.periodo+"__"+(mode||S.mode);}
function regKey(){return "UTET_ACTAS_BORRADORES_V1";}
function registry(){return retrieve(regKey(),{});}
function savedRecord(r){return registry()[r.identity]||null;}
function periodLabel(){const s=S.periods.find(p=>idPeriod(p.periodoId||p.id||p.periodId)===S.periodo);return text(s&&(s.nombre||s.label||s.periodoLabel||s.periodo||s.descripcion))||S.periodo;}
function schedule(mode){mode=mode||S.mode;const raw=retrieve(cronKey(mode),null);return raw&&raw.mode===mode&&C.valid(raw.groups)?raw.groups:C.get(mode,false);}
function renderCron(){if(S.mode==="TODAS"){S.cronograma=null;$("actas-actividades").innerHTML='<p class="empty">Selecciona COMPLEX o TRAB para editar su cronograma. La exportación ZIP utiliza el cronograma guardado de cada modalidad.</p>';$("actas-cronograma-estado").textContent="Selecciona modalidad";return;}if(!S.periodo){$("actas-actividades").innerHTML='<p class="empty">Seleccione un período.</p>';return;}S.cronograma=schedule();const box=$("actas-actividades");box.innerHTML=S.cronograma.map(g=>'<div class="phase"><h3>'+esc(g.fase)+'</h3><div class="sched-row sched-labels"><span>Actividad</span><span>Fecha de inicio</span><span>Fecha de fin</span></div>'+g.actividades.map(a=>'<div class="sched-row"><span>'+esc(a.nombre)+'</span><input type="date" aria-label="Inicio '+esc(a.nombre)+'" data-acta-id="'+esc(a.id)+'" data-fecha="inicio" value="'+esc(a.inicio)+'"><input type="date" aria-label="Fin '+esc(a.nombre)+'" data-acta-id="'+esc(a.id)+'" data-fecha="fin" value="'+esc(a.fin)+'"></div>').join("")+'</div>').join("");$("actas-cronograma-estado").textContent=retrieve(cronKey(),null)?"Cronograma guardado":"Sin fechas guardadas";}
function collectCron(){if(S.mode==="TODAS")return [];const groups=JSON.parse(JSON.stringify(S.cronograma||C.get(S.mode,false)));for(const g of groups)for(const a of g.actividades)for(const f of ["inicio","fin"]){const el=$("actas-actividades").querySelector('input[data-acta-id="'+a.id+'"][data-fecha="'+f+'"]');a[f]=el?el.value:"";}return groups;}
function saveCron(){if(S.mode==="TODAS"){notify("Selecciona COMPLEX o TRAB antes de guardar el cronograma.",true);return;}if(!S.periodo){notify("Selecciona un período.",true);return;}const groups=collectCron();if(!C.valid(groups)){notify("Una actividad tiene una fecha de fin anterior a la de inicio.",true);return;}if(store(cronKey(),{periodoId:S.periodo,mode:S.mode,groups,updatedAt:new Date().toISOString()})){S.cronograma=groups;$("actas-cronograma-estado").textContent="Cronograma guardado";notify("Cronograma guardado localmente para "+periodLabel()+".");}}
function setCron(groups){S.cronograma=groups;const box=$("actas-actividades");for(const g of groups)for(const a of g.actividades)for(const f of ["inicio","fin"]){const el=box.querySelector('input[data-acta-id="'+a.id+'"][data-fecha="'+f+'"]');if(el)el.value=a[f]||"";}$("actas-cronograma-estado").textContent="Cambios sin guardar";}
function visible(){const q=norm(S.busqueda);return rows().filter(r=>{if(q&&!norm([name(r.student),ced(r.student),career(r.student)].join(" ")).includes(q))return false;if(!q&&S.mode!=="TODAS"&&r.mode!==S.mode)return false;const done=!!savedRecord(r);return S.estado==="aprobados"?r.approved:S.estado==="pendientes"?!r.approved:S.estado==="preparados"?done:true;});}
function renderTable(){
  if(!S.periodo){$("actas-estudiantes").innerHTML='<tr><td colspan="9" class="empty">Seleccione un período.</td></tr>';$("actas-zip").disabled=true;return;}
  const all=rows(),list=visible();
  $("actas-total").textContent=all.length;
  $("actas-aprobados").textContent=all.filter(r=>r.approved).length;
  $("actas-preparadas").textContent=all.filter(r=>!!savedRecord(r)).length;
  $("actas-estudiantes").innerHTML=list.length?list.map((r,i)=>{
    const s=r.student,rec=savedRecord(r),article=r.mode==="ARTICULO_ACADEMICO",inactive=text(s.estadoMatricula||s._estadoMatricula).toUpperCase()==="RETIRADO";
    const selected=article?'<select class="mode-select" disabled aria-label="Modalidad Artículo Académico"><option>ARTÍCULO PVC</option></select>':
    '<select class="mode-select" data-mode="'+i+'" aria-label="Modalidad de '+esc(name(s))+'" '+(inactive?'disabled':'')+'><option value="'+CX+'" '+(r.mode===CX?'selected':'')+'>COMPLEX</option><option value="'+TT+'" '+(r.mode===TT?'selected':'')+'>TRAB</option></select>';
    return '<tr><td><input type="checkbox" class="actas-check" data-i="'+i+'" '+(S.selected.has(r.identity)?"checked ":"")+(r.approved?"":"disabled ")+'aria-label="Seleccionar '+esc(name(s))+'"></td><td><strong>'+esc(name(s))+'</strong></td><td>'+esc(ced(s))+'</td><td>'+esc(career(s))+'</td><td>'+selected+'</td><td><span class="status '+(r.a?"ok":"warn")+'">'+(r.a?"CUMPLE":"PENDIENTE")+'</span></td><td><span class="status '+(r.b?"ok":"warn")+'">'+(r.b?"CUMPLE":"PENDIENTE")+'</span></td><td><span class="status '+(rec?"draft":r.conflict?"no":"warn")+'">'+(r.conflict?"Revisar datos":article?"Artículo PVC":!r.approved?"Faltan evidencias":rec?"Borrador":"Sin acta")+'</span></td><td><button class="mini" data-pdf="'+i+'" '+(r.approved?"":"disabled")+'>Descargar PDF</button></td></tr>';
  }).join(""):'<tr><td colspan="9" class="empty">No existen estudiantes para estos filtros.</td></tr>';
  S.visible=list;
  $("actas-lote").disabled=!list.some(r=>r.approved&&S.selected.has(r.identity));
  $("actas-zip").disabled=!all.some(r=>r.approved);
}
function prepare(r){if(!r.approved)throw Error("No están verificadas todas las etapas: "+(r.proof&&r.proof.missing.join("; ")||"Revisa requisitos y Ncomplex")+"; consulta la ficha.");if(!S.periodo||period(r.student)!==S.periodo)throw Error("La selección corresponde a otro período o modalidad.");let map=registry(),rec=map[r.identity];if(rec&&(rec.mode!==r.mode||rec.periodId!==S.periodo))throw Error("Existe un borrador con otra modalidad o período. Revisa y resuelve esa discrepancia antes de emitir una nueva acta.");if(!rec){const stamp=new Date().toISOString(),prefix=stamp.slice(0,7),next=Object.values(map).filter(x=>x.month===prefix).reduce((m,x)=>Math.max(m,Number(x.consecutivo)||0),0)+1;rec={consecutivo:String(next).padStart(2,"0"),codigo:"AT-ITSQMET-UTET-"+prefix+"-"+String(next).padStart(2,"0"),createdAt:stamp,month:prefix,mode:r.mode,periodId:S.periodo,status:"BORRADOR"};map[r.identity]=rec;if(!store(regKey(),map))throw Error("No se pudo guardar el registro del borrador.");}return {student:r.student,mode:r.mode,record:rec,periodLabel:periodLabel(),schedule:r.mode===S.mode?collectCron():schedule(r.mode),issue:rec.createdAt.slice(0,10),evidence:r.proof};}
async function action(r){try{const item=prepare(r);await w.ActasPDF.download(item);renderTable();notify("PDF descargado como borrador. Revisa los datos antes de legalizar.");}catch(e){notify("Error al generar PDF: "+e.message,true);}}
function start(){const ids=["actas-total","actas-aprobados","actas-preparadas"];ids.forEach(k=>$(k).textContent="—");renderTable();renderCron();}
async function load(){const requestId=++S.requestId,requestedPeriod=S.periodo;if(!requestedPeriod){S.loading=false;start();return;}S.loading=true;notify("Consultando Base Local y Ncomplex…");try{const result=await w.ConActas.read({periodoId:requestedPeriod});if(requestId!==S.requestId||requestedPeriod!==S.periodo)return;S.students=result.data.students||[];S.reqs=result.data.requirements||[];S.ready=true;notify("Datos actualizados. Para emitir un acta aprobada se verifican ocho requisitos, Titulación, dos aprobaciones finales y la nota oficial de Ncomplex.");renderTable();renderCron();}catch(e){if(requestId!==S.requestId)return;S.students=[];S.reqs=[];notify("Error al cargar los datos: "+e.message,true);renderTable();}finally{if(requestId===S.requestId)S.loading=false;}}
async function init(){try{await w.ConActas.ready();S.periods=await w.ConActas.listPeriods();const select=$("actas-periodo");select.innerHTML='<option value="">Seleccione período</option>'+S.periods.map(p=>'<option value="'+esc(idPeriod(p.periodoId||p.id||p.periodId))+'">'+esc(p.nombre||p.label||p.periodoLabel||p.periodo||p.descripcion||p.id||p.periodoId)+'</option>').join("");
const global=retrieve("REQ_PERIODO_GLOBAL_V1",{});const preferred=idPeriod(global.periodoId||global.id||global.value||"");S.periodo=preferred&&S.periods.some(p=>idPeriod(p.periodoId||p.id||p.periodId)===preferred)?preferred:idPeriod(S.periods[0]&&(S.periods[0].periodoId||S.periods[0].id)||"");select.value=S.periodo;$("actas-estado").value=S.estado;$("actas-modalidad").value=S.mode;await load();}catch(e){notify("No se pudo iniciar Actas: "+e.message,true);}}
$("actas-periodo").addEventListener("change",e=>{S.periodo=idPeriod(e.target.value);S.selected.clear();S.students=[];S.reqs=[];load();});
$("actas-modalidad").addEventListener("change",e=>{S.mode=e.target.value;S.selected.clear();renderTable();renderCron();});
$("actas-busqueda").addEventListener("input",e=>{S.busqueda=e.target.value;renderTable();});
$("actas-estado").addEventListener("change",e=>{S.estado=e.target.value;renderTable();});
$("actas-recargar").addEventListener("click",()=>load());
$("actas-actividades").addEventListener("input",()=>{$("actas-cronograma-estado").textContent="Cambios sin guardar";});
$("actas-guardar").addEventListener("click",saveCron);
$("actas-ejemplo").addEventListener("click",()=>{if(!S.periodo||S.mode==="TODAS")return;const expected="2025-10__2026-03",label=norm(periodLabel());if(S.periodo!==expected&&!label.includes("octubre2025amarzo2026")){notify("Las fechas de las imágenes corresponden exclusivamente al período Octubre 2025 a Marzo 2026. Ingresa las fechas de este período manualmente.",true);return;}if(w.confirm("¿Cargar las fechas de ejemplo de Octubre 2025 a Marzo 2026? Podrás modificarlas antes de guardar."))setCron(C.get(S.mode,true));});
$("actas-vaciar").addEventListener("click",()=>{if(!S.periodo||S.mode==="TODAS")return;if(w.confirm("¿Vaciar las fechas visibles? Debes pulsar Guardar para confirmar."))setCron(C.get(S.mode,false));});
$("actas-seleccionar").addEventListener("click",()=>{visible().forEach(r=>{if(r.approved)S.selected.add(r.identity);});renderTable();});
$("actas-estudiantes").addEventListener("change",async e=>{
  if(e.target.matches("[data-i]")){const r=S.visible[Number(e.target.dataset.i)];if(r){if(e.target.checked)S.selected.add(r.identity);else S.selected.delete(r.identity);renderTable();}return;}
  if(!e.target.matches("[data-mode]"))return;
  const el=e.target,r=S.visible[Number(el.dataset.mode)];if(!r||r.mode===el.value)return;
  const old=r.mode,requested=el.value;el.disabled=true;notify("Guardando modalidad en Base Local…");
  try{
    if(r.student._ncomplexHasSavedEvaluation&&w.confirm&&!w.confirm("Esta persona tiene una evaluación guardada en Ncomplex. El cambio requerirá revisar allí las notas y la modalidad. ¿Continuar?")){el.value=old;return;}
    await w.ConActas.setModality({studentId:r.student.idEstudiantePeriodo||r.identity,cedula:ced(r.student),periodoId:S.periodo,periodoLabel:periodLabel(),mode:requested});
    S.selected.delete(r.identity);await load();const updated=rows().find(x=>x.identity===r.identity);
    notify(updated&&updated.conflict?"Modalidad guardada. Revisa la evaluación en Ncomplex antes de emitir el acta.":"Modalidad guardada en Base Local. Ficha y Actas utilizarán el nuevo valor.",false);
  }catch(err){el.value=old;notify("No se pudo cambiar modalidad: "+err.message,true);}finally{el.disabled=false;}
});
$("actas-estudiantes").addEventListener("click",e=>{
  const button=e.target.closest("button[data-pdf]");if(!button)return;const r=S.visible[Number(button.dataset.pdf)];if(r)action(r);
});
$("actas-lote").addEventListener("click",async()=>{
  const selected=visible().filter(r=>r.approved&&S.selected.has(r.identity));if(!selected.length)return;
  try{const result=await w.ActasPDF.download(selected.map(prepare));notify(result.count+" actas descargadas en PDF.");renderTable();}
  catch(e){notify("No se pudo generar PDF: "+e.message,true);}
});
$("actas-zip").addEventListener("click",async()=>{
  if(!S.periodo)return;const all=rows(),approved=all.filter(r=>r.approved),button=$("actas-zip");
  if(!approved.length){notify("No existen estudiantes habilitados para generar actas.",true);return;}
  const summary=all.map(r=>({cedula:ced(r.student),nombre:name(r.student),carrera:career(r.student),modalidad:r.mode===TT?"TRAB":r.mode===CX?"COMPLEX":"ARTICULO",estado:r.approved?"EN_PROCESO":"EXCLUIDO",motivo:r.approved?"":r.conflict?"Revisar evaluación, modalidad o matrícula":r.mode==="ARTICULO_ACADEMICO"?"Artículo Académico fuera de COMPLEX/TRAB":r.proof.missing.join("; ")||"Evidencias académicas incompletas",archivo:""}));
  button.disabled=true;
  try{const result=await w.ActasPDF.downloadZip(approved.map(prepare),summary,S.periodo,progress=>notify("Generando ZIP: "+progress.done+"/"+progress.total+" actas…"));
    renderTable();notify("ZIP descargado: "+result.generated+" PDF; "+result.excluded+" excluidos o con error.");}
  catch(e){notify("No se pudo exportar período: "+e.message,true);}
  finally{renderTable();}
});

$("actas-exportar-cron").addEventListener("click",()=>{if(!S.periodo)return;const value={version:1,periodoId:S.periodo,mode:S.mode,groups:collectCron()};const a=d.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));a.href=url;a.download="Cronograma_UTET_"+S.periodo+"_"+S.mode+".json";d.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);});
$("actas-importar-cron").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f||!S.periodo)return;try{const incoming=JSON.parse(await f.text());if(incoming.periodoId!==S.periodo||incoming.mode!==S.mode||!C.valid(incoming.groups))throw Error("El archivo no corresponde al período y modalidad seleccionados.");const standard=C.get(S.mode,false);const groupMap=new Map(incoming.groups.flatMap(g=>(g.actividades||[]).map(a=>[a.id,a])));for(const g of standard)for(const a of g.actividades){const given=groupMap.get(a.id);if(given){a.inicio=/^\d{4}-\d\d-\d\d$/.test(given.inicio||"")?given.inicio:"";a.fin=/^\d{4}-\d\d-\d\d$/.test(given.fin||"")?given.fin:"";}}setCron(standard);notify("Cronograma importado. Pulsa Guardar cronograma para conservarlo.");}catch(err){notify("No se pudo importar: "+err.message,true);}finally{e.target.value="";}});

let pendingLogo=null;
function showLogo(logo){const img=$("actas-logo-preview"),placeholder=$("actas-logo-placeholder");if(logo&&logo.dataUrl){img.src=logo.dataUrl;img.hidden=false;placeholder.hidden=true;}else{img.removeAttribute("src");img.hidden=true;placeholder.hidden=false;}}
function closeLogo(){$("actas-logo-modal").hidden=true;pendingLogo=null;$("actas-logo-guardar").disabled=true;$("actas-logo-file").value="";}
$("actas-config-logo").addEventListener("click",async()=>{$("actas-logo-modal").hidden=false;showLogo(await w.ActasBrand.resolve());});
$("actas-logo-cerrar").addEventListener("click",closeLogo);
$("actas-logo-modal").addEventListener("click",e=>{if(e.target.hasAttribute("data-close-logo"))closeLogo();});
$("actas-logo-file").addEventListener("change",async e=>{
  const file=e.target.files&&e.target.files[0];pendingLogo=file||null;$("actas-logo-guardar").disabled=!file;if(!file)return;
  try{if(!["image/png","image/jpeg"].includes(file.type)||file.size>4*1024*1024)throw Error("El logo debe ser PNG o JPG de máximo 4 MB.");
    const reader=new FileReader();reader.onload=async()=>{try{showLogo(await w.ActasBrand.inspect(String(reader.result||"")));}catch(err){notify(err.message,true);pendingLogo=null;$("actas-logo-guardar").disabled=true;}};reader.onerror=()=>notify("No se pudo leer la imagen.",true);reader.readAsDataURL(file);
  }catch(err){notify(err.message,true);pendingLogo=null;$("actas-logo-guardar").disabled=true;}
});
$("actas-logo-guardar").addEventListener("click",async()=>{try{if(!pendingLogo)throw Error("Selecciona un archivo.");await w.ActasBrand.save(pendingLogo);closeLogo();notify("Logo guardado en este equipo. Se utilizará en todos los PDF de Actas.");}catch(e){notify("Error al guardar logo: "+e.message,true);}});
$("actas-logo-restaurar").addEventListener("click",async()=>{try{await w.ActasBrand.clear();pendingLogo=null;$("actas-logo-guardar").disabled=true;showLogo(await w.ActasBrand.resolve());notify("Se restauró el logo predeterminado del proyecto.");}catch(e){notify(e.message,true);}});

if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);