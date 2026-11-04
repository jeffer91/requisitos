/* Módulo Actas: ambos requisitos finales CUMPLE; cronogramas editables y actas en borrador. */
(function(w,d){"use strict";
const C=w.ActasCatalog,CX=C.COMPLEXIVO,TT=C.TRABAJO;
const S={periods:[],students:[],reqs:[],meta:{},numbers:new Map(),numberingError:"",numberingVerified:false,numberingCacheCount:0,periodo:"",mode:"TODAS",busqueda:"",estado:"todos",selected:new Set(),ready:false,loading:false,requestId:0,cronograma:null};
const $=id=>d.getElementById(id),text=v=>String(v==null?"":v).trim();
function norm(v){return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function esc(v){return text(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function idPeriod(v){const x=text(v);return x.replace(/_+/g,"__");}
function ced(s){const raw=text(s.cedula||s.numeroIdentificacion||s.NumeroIdentificacion||s.Cedula||s._cedula).replace(/[^0-9A-Za-z]/g,"").toUpperCase();return /^\d{9}$/.test(raw)?"0"+raw:raw;}
function period(s){return idPeriod(s.periodoId||s.periodId||s.periodoCanonicoId||s.ultimoPeriodoId||s._periodoId);}
function career(s){return text(s.NombreCarrera||s.nombreCarrera||s.carrera||s.Carrera||"Sin carrera");}
function name(s){return text(s.Nombres||s.nombres||s.nombreCompleto||s.Nombre||s.nombre||"Sin nombre");}
function stKey(s){return ced(s)+"__"+period(s);}
function reqKey(r){return norm(r.requisitoKey||r.requirementKey||r.key||r.nombre||r.requisitoLabel);}
function reqValue(r){for(const k of ["valor","value","estado","cumple","aprobado","resultado"]){const v=r&&r[k];const value=typeof v==="object"&&v?(v.valor||v.estado||v.value||v.label||v.id):v;if(value!==undefined&&value!==null&&text(value)!=="")return norm(value);}return "";}
const KEY1="aprobaciontitulacion",KEY2="aprobacioncomplexivoproyecto";
const REQ_KEYS=new Set(["academico","documentacion","practicas","practicaspreprofesionales","practicasvinculacion","pricasvinculacion","vinculacion","seguimientograduados","ingles","actualizaciondatos","titulacion","financiero",KEY1,KEY2]);
function extras(row){
 const out={};
 function add(source){
  if(!source||typeof source!=="object")return;
  for(const field of Object.keys(source)){const key=norm(field);if(!REQ_KEYS.has(key))continue;
   const value=reqValue({valor:source[field]});if(value)out[key]=value;
  }
 }
 [row,row&&row._raw,row&&row._sourceRow].forEach(add);
 for(const records of [row&&row.requisitos,row&&row._requisitos,row&&row.requirements,row&&row._requirements]){
  if(!Array.isArray(records))continue;
  for(const r of records){const key=reqKey(r),value=reqValue(r);if(key&&value)out[key]=value;}
 }
 return out;
}
function indexReqs(){
 const map=new Map();
 for(const r of S.reqs){
  const p=idPeriod(r.periodoId||r.periodId||r.periodoCanonicoId);
  const c=ced(r),key=reqKey(r),value=reqValue(r);
  if(!p||!c||!key||!value)continue;
  const k=c+"__"+p;
  if(!map.has(k))map.set(k,{});
  map.get(k)[key]=value;
 }
 return map;
}
function approval(value){return value==="cumple";}
function parseModality(value){
 const k=norm(value);
 if(!k)return "";
 if(k.includes("articulo"))return "ARTICULO_ACADEMICO";
 if(k.includes("trabajo")||k==="proyecto")return TT;
 if(k.includes("complexivo"))return CX;
 return "";
}
/* Solo se aplica el valor predeterminado en la presentación; nunca se modifica
 * de forma masiva la matrícula ni se infiere la modalidad desde las notas. */
function explicitModalities(s){
 const raw=s._raw||{},source=s._sourceRow||{};
 function read(obj,fields){
  for(const field of fields){const mode=parseModality(obj&&obj[field]);if(mode)return mode;}
  return "";
 }
 const preferred=["modalidadTitulacion","ModalidadTitulacion","_modalidadTitulacion","modalidad","Modalidad"];
 const declared=read(s,preferred)||read(raw,preferred)||read(source,preferred);
 const legacy=["tipoTitulacion","TipoTitulacion"];
 const type=read(s,legacy)||read(raw,legacy)||read(source,legacy);
 return {declared,type};
}
function modality(s){
 const m=explicitModalities(s);
 // Respeta la modalidad especial Artículo Académico cuando está declarada.
 if(m.type==="ARTICULO_ACADEMICO"||m.declared==="ARTICULO_ACADEMICO")return "ARTICULO_ACADEMICO";
 // La modalidad que se guarda desde Ficha prevalece sobre tipoTitulacion legado.
 return m.declared||m.type||CX;
}
function inactive(s){return text(s.estadoMatricula||s._estadoMatricula).toUpperCase()==="RETIRADO"||s.retirado===true||s.eliminado===true;}
function errorConflict(s){
 const m=explicitModalities(s);
 return inactive(s)||m.type==="ARTICULO_ACADEMICO"||m.declared==="ARTICULO_ACADEMICO";
}
function rows(){
 const idx=indexReqs(),duplicates=new Map();
 S.students.filter(s=>period(s)===S.periodo).forEach(s=>{
  const id=stKey(s);duplicates.set(id,(duplicates.get(id)||0)+1);
 });
 return S.students.filter(s=>period(s)===S.periodo).map(s=>{
  const vals=Object.assign({},extras(s),idx.get(stKey(s))||{}),mode=modality(s);
  const proof=w.ActasEvidence.assess({student:s,requirementValues:vals,mode});
  const a=approval(vals[KEY1]),b=approval(vals[KEY2]);
  const duplicate=duplicates.get(stKey(s))!==1;
  const draftAllowed=!inactive(s)&&!duplicate&&!!ced(s)&&!!period(s)&&(mode===CX||mode===TT);
  const conflict=errorConflict(s)||duplicate,verified=draftAllowed&&proof.eligible&&!conflict;
  return {student:s,identity:stKey(s),mode,a,b,proof,
   approved:a&&b&&!conflict,verified,draftAllowed,conflict};
 });
}
function notify(msg,isError){const el=$("actas-alert");el.textContent=msg;el.classList.toggle("error",!!isError);}
function store(k,value){try{w.localStorage.setItem(k,JSON.stringify(value));return true;}catch(e){notify("No se pudo guardar localmente: "+e.message,true);return false;}}
function retrieve(k,otherwise){try{const val=JSON.parse(w.localStorage.getItem(k));return val==null?otherwise:val;}catch(e){return otherwise;}}
function cronKey(mode){return "UTET_ACTAS_CRONO_V1__"+S.periodo+"__"+(mode||S.mode);}
function regKey(){return "UTET_ACTAS_BORRADORES_V1";}
function registry(){return retrieve(regKey(),{});}
function savedRecord(r){return registry()[r.identity]||null;}
function registeredNumber(r){return S.numbers.get(r.identity)||null;}
function numberInput(r){return {cedula:ced(r.student),periodoId:S.periodo,modalidad:r.mode,nombre:name(r.student),carrera:career(r.student),fechaEmision:w.ActasIssueDate.forPeriod(S.periodo).date};}
async function registerNumber(r){
 if(!S.numberingVerified)throw Error("No se ha verificado el libro central de actas con el servidor de Firestore. Pulse Actualizar datos antes de asignar números oficiales.");
 if(!r.approved)throw Error("No constan las dos aprobaciones finales para emitir el acta.");
 if(!r.verified)throw Error("No se puede emitir oficialmente: faltan requisitos institucionales: "+r.proof.missing.join("; "));
 if(!w.ActasIssueDate.mayRegister(S.periodo))throw Error("La numeración oficial se habilitará a partir del día laborable de emisión del período: "+w.ActasIssueDate.forPeriod(S.periodo).date+".");
 if(!w.ActasNumbering)throw Error("No está disponible el registro central de actas.");
 const entry=await w.ActasNumbering.getOrAssign(numberInput(r));
 S.numbers.set(r.identity,entry);return entry;
}
async function hydrateNumbers(reqId,periodId){
 if(!w.ActasNumbering){
  S.numberingVerified=false;S.numbers=new Map();
  S.numberingError="El libro central no está disponible. Solo se permiten borradores sin número oficial.";
  renderTable();notify(S.numberingError,true);return;
 }
 try{
  const api=w.ActasNumbering;
  const result=typeof api.listDetailed==="function"
    ?await api.listDetailed(periodId)
    :{entries:await api.list(periodId),verified:true,source:"server",warning:""};
  if(reqId!==S.requestId||S.periodo!==periodId)return;
  // La caché jamás certifica un folio ni su ausencia en el libro central.
  S.numberingVerified=result.verified===true;
  S.numbers=S.numberingVerified?
    new Map((result.entries||[]).map(x=>[ced({cedula:x.cedula})+"__"+idPeriod(x.periodoId),x])):new Map();
  S.numberingCacheCount=!S.numberingVerified&&(result.entries||[]).length||0;
  S.numberingError=S.numberingVerified?"":text(result.warning)||"No se pudo verificar el libro central de actas.";
  renderTable();
  if(S.numberingVerified)
   notify("Datos académicos y libro central verificados. Actas numeradas encontradas: "+S.numbers.size+".");
  else
   notify("Estudiantes cargados. Libro central NO VERIFICADO: "+S.numberingError+
     (result.source==="cache"?" Hay "+S.numberingCacheCount+" referencia(s) en caché, que no se pueden usar como números oficiales.":"")+
     " Puede descargar borradores. Pulse Actualizar datos para reintentar.",true);
 }catch(e){
  if(reqId!==S.requestId||S.periodo!==periodId)return;
  S.numberingVerified=false;S.numbers=new Map();S.numberingCacheCount=0;
  S.numberingError=apiError(e);
  renderTable();
  notify("Estudiantes cargados, pero el libro central NO está verificado: "+S.numberingError+
    " Pulse Actualizar datos. Puede preparar borradores sin número oficial.",true);
 }
}
function apiError(error){
 return w.ActasNumbering&&typeof w.ActasNumbering.readableError==="function"
  ?w.ActasNumbering.readableError(error):text(error&&error.message||error);
}
async function prepareWithNumber(r){
 const item=prepare(r),registered=registeredNumber(r);
 if(registered)item.record=Object.assign({},item.record,{numeroActa:registered.numeroActa,fechaRegistro:registered.fechaCliente});
 return item;
}
async function assignToRows(selected,progress){
 const items=[];
 for(let i=0;i<selected.length;i++){
  items.push(await prepareWithNumber(selected[i]));
  if(typeof progress==="function")progress({done:i+1,total:selected.length});
 }
 return {items,failed:0,reason:"",assigned:0};
}
function periodLabel(){const s=S.periods.find(p=>idPeriod(p.periodoId||p.id||p.periodId)===S.periodo);return text(s&&(s.nombre||s.label||s.periodoLabel||s.periodo||s.descripcion))||S.periodo;}
function schedule(mode){mode=mode||S.mode;const raw=retrieve(cronKey(mode),null);return raw&&raw.mode===mode&&C.valid(raw.groups)?raw.groups:C.get(mode,false);}
function renderCron(){if(S.mode==="TODAS"){S.cronograma=null;$("actas-actividades").innerHTML='<p class="empty">Selecciona COMPLEX o TRAB para editar su cronograma. La exportación ZIP utiliza el cronograma guardado de cada modalidad.</p>';$("actas-cronograma-estado").textContent="Selecciona modalidad";return;}if(!S.periodo){$("actas-actividades").innerHTML='<p class="empty">Seleccione un período.</p>';return;}S.cronograma=schedule();const box=$("actas-actividades");box.innerHTML=S.cronograma.map(g=>'<div class="phase"><h3>'+esc(g.fase)+'</h3><div class="sched-row sched-labels"><span>Actividad</span><span>Fecha de inicio</span><span>Fecha de fin</span></div>'+g.actividades.map(a=>'<div class="sched-row"><span>'+esc(a.nombre)+'</span><input type="date" aria-label="Inicio '+esc(a.nombre)+'" data-acta-id="'+esc(a.id)+'" data-fecha="inicio" value="'+esc(a.inicio)+'"><input type="date" aria-label="Fin '+esc(a.nombre)+'" data-acta-id="'+esc(a.id)+'" data-fecha="fin" value="'+esc(a.fin)+'"></div>').join("")+'</div>').join("");$("actas-cronograma-estado").textContent=retrieve(cronKey(),null)?"Cronograma guardado":"Sin fechas guardadas";}
function collectCron(){if(S.mode==="TODAS")return [];const groups=JSON.parse(JSON.stringify(S.cronograma||C.get(S.mode,false)));for(const g of groups)for(const a of g.actividades)for(const f of ["inicio","fin"]){const el=$("actas-actividades").querySelector('input[data-acta-id="'+a.id+'"][data-fecha="'+f+'"]');a[f]=el?el.value:"";}return groups;}
function saveCron(){if(S.mode==="TODAS"){notify("Selecciona COMPLEX o TRAB antes de guardar el cronograma.",true);return;}if(!S.periodo){notify("Selecciona un período.",true);return;}const groups=collectCron();if(!C.valid(groups)){notify("Una actividad tiene una fecha de fin anterior a la de inicio.",true);return;}if(store(cronKey(),{periodoId:S.periodo,mode:S.mode,groups,updatedAt:new Date().toISOString()})){S.cronograma=groups;$("actas-cronograma-estado").textContent="Cronograma guardado";notify("Cronograma guardado localmente para "+periodLabel()+".");}}
function setCron(groups){S.cronograma=groups;const box=$("actas-actividades");for(const g of groups)for(const a of g.actividades)for(const f of ["inicio","fin"]){const el=box.querySelector('input[data-acta-id="'+a.id+'"][data-fecha="'+f+'"]');if(el)el.value=a[f]||"";}$("actas-cronograma-estado").textContent="Cambios sin guardar";}
function visible(){const q=norm(S.busqueda);return rows().filter(r=>{if(q&&!norm([name(r.student),ced(r.student),career(r.student)].join(" ")).includes(q))return false;if(!q&&S.mode!=="TODAS"&&r.mode&&r.mode!==S.mode)return false;const done=!!savedRecord(r);return S.estado==="aprobados"?r.approved:S.estado==="pendientes"?!r.approved:S.estado==="preparados"?done:true;});}
function renderTable(){
 if(!S.periodo){$("actas-estudiantes").innerHTML='<tr><td colspan="9" class="empty">Seleccione un período.</td></tr>';$("actas-zip").disabled=true;$("actas-registrar-lote").disabled=true;return;}
 const all=rows(),list=visible();
 $("actas-total").textContent=all.length;
 $("actas-aprobados").textContent=all.filter(r=>r.approved).length;
 $("actas-preparadas").textContent=all.filter(r=>!!savedRecord(r)).length;
 $("actas-estudiantes").innerHTML=list.length?list.map((r,i)=>{
  const st=r.student,rec=savedRecord(r),number=registeredNumber(r);
  const article=r.mode==="ARTICULO_ACADEMICO",inactive=text(st.estadoMatricula||st._estadoMatricula).toUpperCase()==="RETIRADO";
  const selected=article?'<select class="mode-select" disabled><option>ARTÍCULO PVC</option></select>':
   '<select class="mode-select" data-mode="'+i+'" aria-label="Modalidad de '+esc(name(st))+'" '+(inactive?'disabled':'')+'><option value="" '+(!r.mode?'selected':'')+' disabled>Seleccione modalidad</option><option value="'+CX+'" '+(r.mode===CX?'selected':'')+'>COMPLEX</option><option value="'+TT+'" '+(r.mode===TT?'selected':'')+'>TRAB</option></select>';
  const documentState=number?"N.º "+number.numeroActa:r.conflict?"Revisar identidad, matrícula o modalidad":article?"Artículo PVC":!r.draftAllowed?"Borrador no disponible":r.verified&&!S.numberingVerified?"Borrador listo · servidor no verificado":r.verified?"Habilitado para emisión":"Borrador sin notas · pendiente de cierre";
  return '<tr><td><input type="checkbox" class="actas-check" data-i="'+i+'" '+(S.selected.has(r.identity)?"checked ":"")+(r.draftAllowed?"":"disabled ")+'aria-label="Seleccionar '+esc(name(st))+'"></td><td><strong>'+esc(name(st))+'</strong></td><td>'+esc(ced(st))+'</td><td>'+esc(career(st))+'</td><td>'+selected+'</td><td><span class="status '+(r.a?"ok":"warn")+'">'+(r.a?"CUMPLE":"PENDIENTE")+'</span></td><td><span class="status '+(r.b?"ok":"warn")+'">'+(r.b?"CUMPLE":"PENDIENTE")+'</span></td><td title="'+esc(r.proof.missing.join("; ")||"Aprobaciones verificadas")+'"><span class="status '+(number?"ok":rec?"draft":"warn")+'">'+esc(documentState)+'</span></td><td><div class="actas-number-actions"><button class="mini secondary" data-register="'+i+'" '+(r.verified&&!number&&S.numberingVerified?"":"disabled")+'>Registrar N.º</button><button class="mini" data-pdf="'+i+'" '+(r.draftAllowed?"":"disabled")+'>Descargar PDF</button></div></td></tr>';
 }).join(""):'<tr><td colspan="9" class="empty">No existen estudiantes para estos filtros.</td></tr>';
 S.visible=list;
 $("actas-lote").disabled=!list.some(r=>r.draftAllowed&&S.selected.has(r.identity));
 $("actas-zip").disabled=!all.some(r=>r.draftAllowed);
 $("actas-registrar-lote").disabled=!S.numberingVerified||!all.some(r=>r.verified&&!registeredNumber(r));
}
function prepare(r){if(!r.draftAllowed)throw Error("No se puede generar el borrador: identidad, matrícula o modalidad requieren revisión.");if(!S.periodo||period(r.student)!==S.periodo)throw Error("La selección corresponde a otro período o modalidad.");let map=registry(),rec=map[r.identity];
 if(rec&&rec.periodId!==S.periodo)throw Error("Existe un borrador de otro período. Revise el expediente.");
 if(rec&&rec.mode!==r.mode){
   // Preservar el borrador anterior como histórico local; la nueva modalidad
   // debe poder generar su propio borrador sin cambiar ningún folio oficial.
   const previousKey=r.identity+"__ANTERIOR__"+text(rec.mode)+"__"+text(rec.codigo);
   map[previousKey]=Object.assign({},rec,{status:"REEMPLAZADO_POR_CAMBIO_MODALIDAD",replacedAt:new Date().toISOString()});
   delete map[r.identity];rec=null;
 }
 if(!rec){const stamp=new Date().toISOString(),prefix=stamp.slice(0,7),next=Object.values(map).filter(x=>x.month===prefix).reduce((m,x)=>Math.max(m,Number(x.consecutivo)||0),0)+1;rec={consecutivo:String(next).padStart(2,"0"),codigo:"AT-ITSQMET-UTET-"+prefix+"-"+String(next).padStart(2,"0"),createdAt:stamp,month:prefix,mode:r.mode,periodId:S.periodo,status:"BORRADOR"};map[r.identity]=rec;if(!store(regKey(),map))throw Error("No se pudo guardar el registro del borrador.");}return {student:r.student,mode:r.mode,record:rec,periodLabel:periodLabel(),schedule:r.mode===S.mode?collectCron():schedule(r.mode),issue:w.ActasIssueDate.forPeriod(S.periodo).date,evidence:r.proof};}
async function action(r){
 try{
  const item=await prepareWithNumber(r);
  await w.ActasPDF.download(item);renderTable();
  const registered=registeredNumber(r);
  notify(registered?"PDF del acta N.º "+registered.numeroActa+" descargado sin calificaciones; conserva su folio.":"BORRADOR PDF SIN NÚMERO descargado sin calificaciones. Para registrar folio se requieren nueve requisitos y dos aprobaciones finales.");
 }catch(e){notify("Error al descargar PDF: "+e.message,true);}
}
function start(){const ids=["actas-total","actas-aprobados","actas-preparadas"];ids.forEach(k=>$(k).textContent="—");renderTable();renderCron();}
async function load(){const requestId=++S.requestId,requestedPeriod=S.periodo;if(!requestedPeriod){S.loading=false;start();return;}S.loading=true;notify("Consultando estudiantes y requisitos en Base Local…");try{const result=await w.ConActas.read({periodoId:requestedPeriod});if(requestId!==S.requestId||requestedPeriod!==S.periodo)return;S.students=result.data.students||[];S.reqs=result.data.requirements||[];S.meta=result.meta&&result.meta.diagnostics||{};S.ready=true;S.numbers=new Map();S.numberingVerified=false;S.numberingCacheCount=0;S.numberingError="";hydrateNumbers(requestId,requestedPeriod);
const metrics=S.meta;const details=metrics.requirements!==undefined?" Requisitos relacionados: "+metrics.requirements+".":"";
notify("Expedientes actualizados."+details+" Borradores sin calificaciones; los folios exigen habilitación institucional.");renderTable();renderCron();}catch(e){if(requestId!==S.requestId)return;S.students=[];S.reqs=[];notify("Error al cargar los datos: "+e.message,true);renderTable();}finally{if(requestId===S.requestId)S.loading=false;}}
async function init(){try{await w.ConActas.ready();S.periods=await w.ConActas.listPeriods();const select=$("actas-periodo");select.innerHTML='<option value="">Seleccione período</option>'+S.periods.map(p=>'<option value="'+esc(idPeriod(p.periodoId||p.id||p.periodId))+'">'+esc(p.nombre||p.label||p.periodoLabel||p.periodo||p.descripcion||p.id||p.periodoId)+'</option>').join("");
const global=retrieve("REQ_PERIODO_GLOBAL_V1",{});const preferred=idPeriod(global.periodoId||global.id||global.value||"");S.periodo=preferred&&S.periods.some(p=>idPeriod(p.periodoId||p.id||p.periodId)===preferred)?preferred:idPeriod(S.periods[0]&&(S.periods[0].periodoId||S.periods[0].id)||"");select.value=S.periodo;$("actas-estado").value=S.estado;$("actas-modalidad").value=S.mode;await load();}catch(e){notify("No se pudo iniciar Actas: "+e.message,true);}}
$("actas-periodo").addEventListener("change",e=>{S.periodo=idPeriod(e.target.value);S.selected.clear();S.students=[];S.reqs=[];S.numbers=new Map();S.numberingVerified=false;S.numberingCacheCount=0;load();});
$("actas-modalidad").addEventListener("change",e=>{S.mode=e.target.value;S.selected.clear();renderTable();renderCron();});
$("actas-busqueda").addEventListener("input",e=>{S.busqueda=e.target.value;renderTable();});
$("actas-estado").addEventListener("change",e=>{S.estado=e.target.value;renderTable();});
$("actas-recargar").addEventListener("click",()=>load());
$("actas-importar").addEventListener("click",()=>{w.open("../Ncomplex/ncomplex.html?actasImport=1","ncomplex-importar","width=1250,height=870,resizable=yes,scrollbars=yes");});
$("actas-actividades").addEventListener("input",()=>{$("actas-cronograma-estado").textContent="Cambios sin guardar";});
$("actas-guardar").addEventListener("click",saveCron);
$("actas-ejemplo").addEventListener("click",()=>{if(!S.periodo||S.mode==="TODAS")return;const expected="2025-10__2026-03",label=norm(periodLabel());if(S.periodo!==expected&&!label.includes("octubre2025amarzo2026")){notify("Las fechas de las imágenes corresponden exclusivamente al período Octubre 2025 a Marzo 2026. Ingresa las fechas de este período manualmente.",true);return;}if(w.confirm("¿Cargar las fechas de ejemplo de Octubre 2025 a Marzo 2026? Podrás modificarlas antes de guardar."))setCron(C.get(S.mode,true));});
$("actas-vaciar").addEventListener("click",()=>{if(!S.periodo||S.mode==="TODAS")return;if(w.confirm("¿Vaciar las fechas visibles? Debes pulsar Guardar para confirmar."))setCron(C.get(S.mode,false));});
$("actas-seleccionar").addEventListener("click",()=>{visible().forEach(r=>{if(r.draftAllowed)S.selected.add(r.identity);});renderTable();});
$("actas-estudiantes").addEventListener("change",async e=>{
  if(e.target.matches("[data-i]")){const r=S.visible[Number(e.target.dataset.i)];if(r){if(e.target.checked)S.selected.add(r.identity);else S.selected.delete(r.identity);renderTable();}return;}
  if(!e.target.matches("[data-mode]"))return;
  const el=e.target,r=S.visible[Number(el.dataset.mode)];if(!r||r.mode===el.value)return;
  const old=r.mode,requested=el.value;el.disabled=true;notify("Guardando modalidad en Base Local…");
  try{
    if(registeredNumber(r))throw Error("Esta acta ya tiene un número oficial. La modalidad no puede cambiarse desde Actas sin una revisión institucional.");
    if(w.confirm&&!w.confirm("Vas a cambiar la modalidad de titulación en Ficha. Actas no consulta las calificaciones de Ncomplex; si existen evaluaciones guardadas tendrás que revisarlas en Ncomplex, pues el cambio no las convierte ni las elimina. ¿Confirmas el cambio?")){el.value=old;return;}
    await w.ConActas.setModality({studentId:r.student.idEstudiantePeriodo||r.identity,cedula:ced(r.student),periodoId:S.periodo,periodoLabel:periodLabel(),mode:requested});
    S.selected.delete(r.identity);await load();const updated=rows().find(x=>x.identity===r.identity);
    notify(updated&&updated.conflict?"Modalidad guardada. Revisa la evaluación en Ncomplex antes de emitir el acta.":"Modalidad guardada en Base Local. Ficha y Actas utilizarán el nuevo valor.",false);
  }catch(err){el.value=old;notify("No se pudo cambiar modalidad: "+err.message,true);}finally{el.disabled=false;}
});
$("actas-estudiantes").addEventListener("click",async e=>{
 const register=e.target.closest("button[data-register]");
 if(register){
  const r=S.visible[Number(register.dataset.register)];if(!r)return;
  register.disabled=true;
  try{const entry=await registerNumber(r);renderTable();notify("Acta registrada con número único "+entry.numeroActa+". No se emitirá otro número para este estudiante y período.");}
  catch(err){renderTable();notify("No se pudo numerar: "+(w.ActasNumbering?w.ActasNumbering.readableError(err):err.message),true);}
  return;
 }
 const pdf=e.target.closest("button[data-pdf]");if(!pdf)return;
 const r=S.visible[Number(pdf.dataset.pdf)];if(r)action(r);
});
$("actas-registrar-lote").addEventListener("click",async()=>{
 const all=rows().filter(r=>r.verified&&!registeredNumber(r));if(!all.length)return;
 const btn=$("actas-registrar-lote");btn.disabled=true;let count=0;
 for(const r of all){
  try{await registerNumber(r);count++;notify("Numerando actas: "+count+" de "+all.length+"…");}
  catch(err){renderTable();notify("Se registraron "+count+" actas. La numeración se detuvo sin duplicar números: "+(w.ActasNumbering?w.ActasNumbering.readableError(err):err.message),true);return;}
 }
 renderTable();notify("Se registraron "+count+" actas con números únicos en el libro central.");
});
$("actas-lote").addEventListener("click",async()=>{
 const selected=visible().filter(r=>r.draftAllowed&&S.selected.has(r.identity));if(!selected.length)return;
 try{
  const group=await assignToRows(selected),result=await w.ActasPDF.download(group.items);
  renderTable();notify(result.count+" PDF descargados. "+group.items.filter(x=>!x.record.numeroActa).length+" borradores sin número oficial."+(group.reason?" "+group.reason:""),group.failed>0);
 }catch(e){notify("No se pudieron generar los PDF: "+e.message,true);}
});
$("actas-zip").addEventListener("click",async()=>{
 if(!S.periodo)return;
 const all=rows(),approved=all.filter(r=>r.draftAllowed),button=$("actas-zip");
 if(!approved.length){notify("No existen estudiantes habilitados.",true);return;}
 const summary=all.map(r=>({cedula:ced(r.student),nombre:name(r.student),carrera:career(r.student),modalidad:r.mode===TT?"TRAB":r.mode===CX?"COMPLEX":"ARTICULO",estado:r.draftAllowed?"EN_PROCESO":"EXCLUIDO",motivo:r.draftAllowed?"":r.conflict?"Revisar identidad, matrícula o modalidad":r.proof.missing.join("; "),archivo:""}));
 button.disabled=true;
 try{
  const group=await assignToRows(approved,p=>notify("Verificando números oficiales: "+p.done+"/"+p.total+"…"));
  group.items.forEach(x=>{const row=summary.find(y=>y.cedula===ced(x.student));if(row)row.numeroActa=x.record.numeroActa||"";});
  const result=await w.ActasPDF.downloadZip(group.items,summary,S.periodo,p=>notify("Generando ZIP: "+p.done+"/"+p.total+"…"));
  renderTable();notify("ZIP descargado: "+result.generated+" PDF; "+group.items.filter(x=>!x.record.numeroActa).length+" sin numeración oficial."+(group.reason?" "+group.reason:""),group.failed>0);
 }catch(e){notify("No se pudo exportar el ZIP: "+e.message,true);}
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