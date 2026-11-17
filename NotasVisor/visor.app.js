/* visor.app.js — /NotasVisor
 * Visualizador de notas SOLO LECTURA. Lee las colecciones oficiales de Firebase
 * (notas_nucleos, notas_complexivo, notas_trabajo, notas_articulo) del período
 * global y las muestra por carrera. Los nombres salen de la base local.
 * No escribe nada: las notas se suben en Notas → Cargado de notas.
 */
(function(w,d){
"use strict";
var C=w.NotasVisorConfig,TIPO=(new URLSearchParams(w.location.search).get("tipo")||"complexivo").toLowerCase();
var T=C.types[TIPO]||C.types.complexivo;
var state={period:"",rows:[],loading:false,cache:{},open:{},token:0,roster:[],missing:[],unknown:[],shown:{},editing:null,saving:false};
function $(id){return d.getElementById(id);}
function txt(v){return String(v==null?"":v).trim();}
function norm(v){return txt(v).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase();}
function canonical(v){var m=txt(v).match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:"";}
function el(tag,cls,content){var n=d.createElement(tag);if(cls)n.className=cls;if(content!==undefined&&content!==null)n.textContent=String(content);return n;}
function msg(t,bad){var m=$("nv-msg");m.textContent=t;m.className=bad?"bad":"";}
function fmt(v){return v===null||v===undefined||!isFinite(v)?"—":Number(v).toFixed(2);}
function ready(){try{w.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"notas-visor",tipo:TIPO}}));}catch(e){}}
function group(code,name,doc){
 var g=txt(doc&&doc.grupoInforme).toUpperCase();if(g)return g;
 var c=txt(code).toUpperCase(),n=norm(name);
 if(/PVC/.test(c+" "+n))return "PVC";if(/-L-/.test(c)||/ONLINE|EN LINEA/.test(n))return "ONLINE";if(/-P-/.test(c))return "PRESENCIAL";return "";
}

/* ---------- Datos ---------- */
async function firestore(){
 var center=w.RequisitosFirebaseOperationCenter;
 if(!center)throw Error("No se pudo preparar la conexión con Firebase.");
 var repo=await (typeof center.ensureNcomplex==="function"?center.ensureNcomplex():center.ensure());
 repo=repo&&repo.ensureFirestore?repo:w.RequisitosFirebaseRepository;
 return {db:await repo.ensureFirestore(),name:function(e){return repo.collectionName(e);}};
}
async function readCollection(fs,entity,period){
 // Consulta simple por período (no requiere índices compuestos).
 var snap=await fs.db.collection(fs.name(entity)).where("periodoId","==",period).get();
 var out=[];(snap.docs||[]).forEach(function(s){var v=typeof s.data==="function"?s.data():s.data;if(v&&v.eliminado!==true)out.push(v);});
 return out;
}
async function roster(period){
 try{var c=w.ConNcomplex;if(!c)return [];await c.ready();return await c.listStudents({periodoId:period})||[];}catch(e){return [];}
}
async function load(period,force){
 if(!period){state.rows=[];render();return;}
 var token=++state.token;state.period=period;state.loading=true;
 var key=period;
 if(!force&&TIPO!=="articulo"&&state.cache[key]){state.rows=state.cache[key];state.loading=false;fillCareers();render();return;}
 msg("Leyendo notas de "+periodLabel(period)+"…");
 try{
  var fs=await firestore();
  var results=await Promise.all(T.collections.map(function(e){return readCollection(fs,e,period);}).concat([roster(period)]));
  if(token!==state.token)return;
  var data={};T.collections.forEach(function(e,i){data[e]=results[i];});
  var students=results[results.length-1]||[],people={};
  students.forEach(function(st){var id=txt(st.cedula||st.Cedula).replace(/\D/g,"");if(id)people[id.padStart(10,"0")]=st;});
  var rows=T.rows(data).map(function(r){
   var st=people[r.cedula]||{},doc=r.doc||{};
   r.nombre=txt(st.Nombres||st.nombres||st.nombreCompleto||doc.nombres)||"(sin nombre en la base local)";
   r.carrera=txt(doc.nombreCarrera||st.NombreCarrera||st.nombreCarrera)||"Sin carrera";
   r.codigo=txt(doc.codigoCarrera||st.CodigoCarrera||st.codigoCarrera);
   r.grupo=group(r.codigo,r.carrera,doc);
   r.search=norm(r.cedula+" "+r.nombre);
   return r;
  });
  if(TIPO==="articulo"){
   var api=editorApi(),present={};
   rows.forEach(function(r){present[r.cedula]=true;});
   state.roster=students;state.unknown=[];
   Object.keys(people).forEach(function(id){
    if(present[id])return;
    var st=people[id],mode=api.declaredModality(st);
    if(mode==="ARTICULO_ACADEMICO"){
     var stub=makeBlankArticle(st,id,period),extra=T.rows({notas_articulo:[stub]})[0];
     extra.doc=stub;extra.missingDocument=true;
     extra.nombre=txt(st.Nombres||st.nombres||st.nombreCompleto)||"(sin nombre en la base local)";
     extra.carrera=txt(st.NombreCarrera||st.nombreCarrera)||"Sin carrera";
     extra.codigo=txt(st.CodigoCarrera||st.codigoCarrera);
     extra.grupo=group(extra.codigo,extra.carrera,st);
     extra.search=norm(id+" "+extra.nombre);
     rows.push(extra);present[id]=true;
    }else if(!mode){state.unknown.push(st);}
   });
   state.missing=rows.filter(function(r){return r.state==="PENDIENTE";});
  }
  rows.sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
  state.cache[key]=rows;state.rows=rows;state.loading=false;
  fillCareers();render();
  if(TIPO==="articulo"&&state.missing.length&&!state.shown[period]){
   state.shown[period]=true;
   openMissingPanel();
  }
 }catch(error){
  if(token!==state.token)return;
  state.rows=[];state.loading=false;state.missing=[];state.unknown=[];render();
  msg("No se pudieron leer las notas de Firebase: "+(error&&error.message||error)+" Revisa la conexión a internet y pulsa Actualizar.",true);
 }finally{if(token===state.token)state.loading=false;ready();}
}
function periodLabel(id){var o=$("nv-period").querySelector('option[value="'+id+'"]');return o?o.textContent:id;}

/* ---------- Artículo: candidatos sin calificaciones ---------- */
function makeBlankArticle(st,cedula,period){
 st=st||{};
 return {periodoId:period,cedula:cedula,
  codigoCarrera:txt(st.CodigoCarrera||st.codigoCarrera),
  nombreCarrera:txt(st.NombreCarrera||st.nombreCarrera),
  grupoInforme:group(st.CodigoCarrera||st.codigoCarrera,st.NombreCarrera||st.nombreCarrera,st),
  formula:"70/30",modalidadTitulacion:"ARTICULO_ACADEMICO"};
}
function missingLabel(r){
 if(r.missingDocument)return "Sin registro";
 var kind=editorApi().missingKind(r.doc);
 return kind==="SIN_NOTAS"?"Sin calificaciones":"Nota final pendiente";
}
function missingRows(){
 return state.missing.slice().sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
}
function renderMissingPanel(){
 if(TIPO!=="articulo")return;
 var body=$("nv-missing-list"),search=norm($("nv-missing-search").value),all=$("nv-missing-others").checked,known=missingRows(),list=[];
 known.forEach(function(r){if(!search||r.search.indexOf(search)>=0)list.push({row:r,mode:"known"});});
 if(all){
  state.unknown.forEach(function(st){
   var cedula=txt(st.cedula||st.Cedula).replace(/\D/g,"").padStart(10,"0");
   var nombre=txt(st.Nombres||st.nombres||st.nombreCompleto)||"(sin nombre)";
   if(search&&norm(cedula+" "+nombre).indexOf(search)<0)return;
   var stub=makeBlankArticle(st,cedula,state.period),r=T.rows({notas_articulo:[stub]})[0];
   r.doc=stub;r.missingDocument=true;r.nombre=nombre;r.cedula=cedula;
   r.carrera=txt(st.NombreCarrera||st.nombreCarrera)||"Sin carrera";r.codigo=txt(st.CodigoCarrera||st.codigoCarrera);
   r.grupo=group(r.codigo,r.carrera,st);r.search=norm(r.cedula+" "+nombre);
   list.push({row:r,mode:"unverified"});
  });
 }
 body.textContent="";
 if(!list.length)body.appendChild(el("div","nv-missing-empty",all?"No hay estudiantes coincidentes.":"No hay pendientes en este filtro. Puedes marcar la opción de búsqueda ampliada."));
 list.slice(0,160).forEach(function(entry){
  var r=entry.row,item=el("div","nv-missing-item"),description=el("div");
  description.appendChild(el("strong",null,r.nombre));
  description.appendChild(el("small",null,r.cedula+" · "+r.carrera));
  description.appendChild(el("small",null,entry.mode==="unverified"?"Modalidad sin verificar":missingLabel(r)));
  item.appendChild(description);
  var btn=el("button",null,r.missingDocument?"Agregar notas":"Completar notas");btn.type="button";
  btn.addEventListener("click",function(){
   if(entry.mode==="unverified"&&!w.confirm("La matrícula de "+r.nombre+" no declara Artículo académico. ¿Confirmas que corresponde a esta modalidad antes de crear su registro?"))return;
   openEditor(r);
  });
  item.appendChild(btn);body.appendChild(item);
 });
 if(list.length>160)body.appendChild(el("div","nv-missing-empty","Hay "+(list.length-160)+" coincidencias más; utiliza la búsqueda para encontrarlas."));
 $("nv-missing-subtitle").textContent=state.missing.length+" estudiante(s) con la nota final pendiente · "+periodLabel(state.period);
}
function openMissingPanel(){
 if(TIPO!=="articulo"||state.saving||!state.period)return;
 var dialog=$("nv-missing");if(!dialog||dialog.open)return;
 $("nv-missing-search").value="";$("nv-missing-others").checked=false;
 renderMissingPanel();dialog.showModal();
}
function setupMissingPanel(){
 if(TIPO!=="articulo")return;
 $("nv-missing-open").hidden=false;
 $("nv-missing-open").addEventListener("click",openMissingPanel);
 function close(){if($("nv-missing").open)$("nv-missing").close();}
 $("nv-missing-close").addEventListener("click",close);
 $("nv-missing-done").addEventListener("click",close);
 $("nv-missing-search").addEventListener("input",renderMissingPanel);
 $("nv-missing-others").addEventListener("change",renderMissingPanel);
}

/* ---------- Filtros ---------- */
function fillCareers(){
 var sel=$("nv-career"),keep=sel.value,seen={};
 sel.textContent="";sel.appendChild(new Option("Todas las carreras",""));
 state.rows.forEach(function(r){seen[r.carrera]=(seen[r.carrera]||0)+1;});
 Object.keys(seen).sort(function(a,b){return a.localeCompare(b,"es");}).forEach(function(c){sel.appendChild(new Option(c+" ("+seen[c]+")",c));});
 if(seen[keep])sel.value=keep;
}
function filtered(){
 var c=$("nv-career").value,s=$("nv-state").value,q=norm($("nv-search").value);
 return state.rows.filter(function(r){return (!c||r.carrera===c)&&(!s||r.state===s)&&(!q||r.search.indexOf(q)>=0);});
}


/* ---------- Corrección de Artículo académico ---------- */
function editorApi(){return TIPO==="articulo"?w.NotasVisorEditor:null;}
function editError(message){var node=$("nv-edit-error");if(node)node.textContent=message||"";}
function editText(v){return v===null||v===undefined?"—":Number(v).toFixed(2);}
function inputForGrade(key){return d.querySelector('#nv-edit-form [data-grade="'+key+'"]');}
function renderEditForm(){
 var e=state.editing,api=editorApi();if(!e||!api)return;
 api.fields.forEach(function(field){
  var input=inputForGrade(field.key),v=e.values[field.key];
  if(input)input.value=v===null?"":Number(v).toFixed(2);
 });
 var preview=$("nv-edit-preview");preview.textContent="";
 var diff=api.changes(api.valuesOf(e.base),e.values);
 if(!diff.length){preview.appendChild(el("span",null,"No hay cambios todavía."));}
 else{
  preview.appendChild(el("strong",null,"Cambios que se guardarán ("+diff.length+")"));
  var list=el("ul");
  diff.forEach(function(change){list.appendChild(el("li",null,change.etiqueta+": "+editText(change.anterior)+" → "+editText(change.nuevo)));});
  preview.appendChild(list);
 }
 var computed=api.total(e.values.notaArticulo,e.values.notaDefensa,e.weight);
 if(computed!==null&&e.values.notaFinal!==null&&Math.abs(computed-e.values.notaFinal)>0.025){
  preview.appendChild(el("p","nv-edit-warning","Atención: la nota final introducida ("+editText(e.values.notaFinal)+") no coincide con la fórmula ("+editText(computed)+"). Verifica antes de guardar."));
 }
}
function openEditor(r){
 var api=editorApi();if(!api||state.saving)return;
 if($("nv-missing")&&$("nv-missing").open)$("nv-missing").close();
 try{
  state.editing={base:JSON.parse(JSON.stringify(r.doc||{})),create:!!r.missingDocument,period:state.period,cedula:r.cedula,
   nombre:r.nombre,weight:api.formula(r.doc),values:api.valuesOf(r.doc)};
  $("nv-edit-student").textContent=r.nombre+" · "+r.cedula+" · "+periodLabel(state.period);
  $("nv-editor-title").textContent=r.missingDocument?"Registrar notas de artículo":"Editar notas de artículo";
  $("nv-edit-missing").hidden=!!(!r.missingDocument&&api.missingKind(r.doc)==="COMPLETO");
  $("nv-edit-missing").textContent=r.missingDocument?
   "Este estudiante no tiene registro de Artículo académico en Firebase. Se creará uno nuevo al guardar la primera nota.":
   "Este estudiante tiene calificaciones pendientes. Ingresa únicamente las que correspondan.";
  $("nv-edit-formula").textContent="Fórmula del registro: "+Math.round(state.editing.weight*100)+
   " % escrito + "+Math.round((1-state.editing.weight)*100)+" % oral. Valores permitidos: 0,00 a 10,00.";
  $("nv-edit-reason").value=r.missingDocument?"Registro manual de notas faltantes":"";
  editError("");renderEditForm();$("nv-editor").showModal();
 }catch(error){msg("No se pudo abrir el editor: "+(error.message||error),true);}
}
function setupEditor(){
 if(!editorApi())return;
 $("nv-sub").textContent="Consulta y corrige las notas de Artículo académico; se guardan en Firebase.";
 d.querySelectorAll("#nv-edit-form [data-grade]").forEach(function(input){
  input.addEventListener("change",function(){
   if(!state.editing||state.saving)return;
   try{
    state.editing.values=editorApi().applyChange(state.editing.values,input.dataset.grade,input.value,state.editing.weight);
    editError("");renderEditForm();
   }catch(error){editError(error.message||String(error));}
  });
 });
 function cancel(){
  if(state.saving)return;
  $("nv-editor").close();state.editing=null;editError("");
 }
 $("nv-edit-cancel").addEventListener("click",cancel);
 $("nv-edit-cancel-top").addEventListener("click",cancel);
 $("nv-editor").addEventListener("cancel",function(event){if(state.saving)event.preventDefault();else state.editing=null;});
 $("nv-edit-form").addEventListener("submit",async function(event){
  event.preventDefault();
  if(!state.editing||state.saving)return;
  var current=state.editing,api=editorApi();
  try{
   // Se vuelve a validar lo escrito, también si el usuario aún no perdió el foco.
   api.fields.forEach(function(field){current.values[field.key]=api.number(inputForGrade(field.key).value);});
   var diff=api.changes(api.valuesOf(current.base),current.values);
   if(!diff.length)throw Error("No hay notas diferentes para guardar.");
   var reason=txt($("nv-edit-reason").value);
   if(reason.length<5)throw Error("Escribe el motivo de la corrección (mínimo cinco caracteres).");
   if(current.period!==canonical($("nv-period").value))throw Error("Cambió el período seleccionado. Cierra el editor y vuelve a abrirlo.");
   if(!w.confirm("¿Guardar "+diff.length+" corrección(es) de "+current.nombre+" en Firebase? Esta operación actualizará el resumen y conservará un historial."))return;
   state.saving=true;editError("");$("nv-edit-save").disabled=true;$("nv-edit-save").textContent="Guardando…";
   await api.persist({base:current.base,create:current.create,period:current.period,cedula:current.cedula,values:current.values,reason:reason});
   $("nv-editor").close();state.editing=null;
   delete state.cache[current.period];
   await load(current.period,true);
   msg((current.create?"Notas registradas":"Corrección guardada")+" y verificadas en Firebase para "+current.nombre+".");
  }catch(error){editError(error&&error.message||String(error));}
  finally{state.saving=false;$("nv-edit-save").disabled=false;$("nv-edit-save").textContent="Guardar corrección";}
 });
}

/* ---------- Pantalla ---------- */
function gradeCell(c){
 var td=el("td","n");
 if(c&&c.t!==undefined){td.className="";td.textContent=c.t;return td;}
 var v=c?c.v:null;td.textContent=fmt(v);
 td.classList.add(v===null?"v-none":v>=7?"v-ok":"v-bad");
 if(c&&c.calc&&v!==null){td.classList.add("v-calc");td.title="Calculada por la app (el sistema no informa este dato).";}
 return td;
}
function stateBadge(s){return el("span","st "+s,s==="APROBADO"?"Aprobado":s==="NO_APROBADO"?"No aprobado":"Sin nota");}
function detailRow(r,span){
 var tr=el("tr","detail"),td=el("td");td.colSpan=span;var info=T.detail(r)||{};
 var dl=el("div","dl");
 [["Cédula",r.cedula],["Carrera",r.carrera],["Código",r.codigo||"—"],["Grupo",r.grupo||"—"]].concat(info.list||[]).forEach(function(p){
  if(p[1]===undefined)return;var row=el("div");row.appendChild(el("span",null,p[0]));
  row.appendChild(el("b",null,typeof p[1]==="number"?fmt(p[1]):(p[1]===null||p[1]===""?"—":p[1])));dl.appendChild(row);});
 var doc=r.doc||{};if(doc.updatedAt){var u=el("div");u.appendChild(el("span",null,"Actualizado"));u.appendChild(el("b",null,new Date(doc.updatedAt).toLocaleString("es-EC")));dl.appendChild(u);}
 td.appendChild(dl);
 if(info.table){
  var box=el("div","sub");box.appendChild(el("h3",null,info.table.title));
  var t=el("table"),h=el("tr");info.table.head.forEach(function(x){h.appendChild(el("th",null,x));});var th=el("thead");th.appendChild(h);t.appendChild(th);
  var tb=el("tbody");info.table.rows.forEach(function(cells){var tr2=el("tr");cells.forEach(function(c){tr2.appendChild(gradeCell(c));});tb.appendChild(tr2);});
  t.appendChild(tb);box.appendChild(t);td.appendChild(box);
 }
 if(info.note){var n=el("p","legend",info.note);n.style.marginTop="8px";td.appendChild(n);}
 tr.appendChild(td);return tr;
}
function summary(list){
 var ok=list.filter(function(r){return r.state==="APROBADO";}).length,bad=list.filter(function(r){return r.state==="NO_APROBADO";}).length;
 var vals=list.map(function(r){return r.final;}).filter(function(v){return v!==null&&v!==undefined;});
 return {n:list.length,ok:ok,bad:bad,pend:list.length-ok-bad,avg:vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null};
}
function render(){
 var body=$("nv-body");body.textContent="";
 var list=filtered(),s=summary(list);
 if(TIPO==="articulo"){
  $("nv-missing-open").hidden=false;
  $("nv-missing-count").textContent=state.missing.length;
  $("nv-missing-open").title="Consultar y agregar notas pendientes";
 }
 $("nv-cards").hidden=!state.rows.length;$("nv-legend").hidden=!state.rows.length;
 $("nv-total").textContent=s.n;$("nv-ok").textContent=s.ok;$("nv-bad").textContent=s.bad;$("nv-pend").textContent=s.pend;$("nv-avg").textContent=fmt(s.avg);
 if(!state.period){msg("Elige un período.");return;}
 if(!state.rows.length){
  if(!state.loading&&!/No se pudieron/.test($("nv-msg").textContent)){
   msg("");body.appendChild(el("div","empty","No hay notas de "+T.title.toLowerCase()+" en "+periodLabel(state.period)+". Se cargan en Notas → Cargado de notas."));}
  return;
 }
 msg(list.length+" de "+state.rows.length+" estudiantes · "+periodLabel(state.period)+(TIPO==="articulo"?" · pulsa Editar para corregir calificaciones":" · solo lectura"));
 var byCareer={},order=[];
 list.forEach(function(r){if(!byCareer[r.carrera]){byCareer[r.carrera]=[];order.push(r.carrera);}byCareer[r.carrera].push(r);});
 order.sort(function(a,b){return a.localeCompare(b,"es");});
 var one=order.length===1;
 order.forEach(function(name){
  var rows=byCareer[name],cs=summary(rows),det=el("details","career");det.open=one||order.length<=3||!!state.open[name];
  det.addEventListener("toggle",function(){state.open[name]=det.open;});
  var sm=el("summary");sm.appendChild(el("h2",null,name));
  var groups={};rows.forEach(function(r){if(r.grupo)groups[r.grupo]=1;});Object.keys(groups).forEach(function(g){sm.appendChild(el("span","grp",g));});
  var info=el("span","sum");
  [["Estudiantes",cs.n],["Aprobados",cs.ok],["No aprobados",cs.bad],["Promedio",fmt(cs.avg)]].forEach(function(p){var x=el("span",null,p[0]+" ");x.appendChild(el("b",null,p[1]));info.appendChild(x);});
  sm.appendChild(info);det.appendChild(sm);
  var wrap=el("div","scroll"),table=el("table"),thead=el("thead"),hr=el("tr");
  ["#","Estudiante"].concat(T.columns).concat(["Estado"]).forEach(function(h,i){hr.appendChild(el("th",i>=2&&i<2+T.columns.length?"n":"",h));});
  thead.appendChild(hr);table.appendChild(thead);
  var tbody=el("tbody"),span=T.columns.length+3;
  rows.forEach(function(r,i){
   var tr=el("tr","row");tr.appendChild(el("td","n",i+1));
   var who=el("td","name");who.appendChild(el("b",null,r.nombre));
   var personMeta=el("div","nv-person-meta");personMeta.appendChild(el("small",null,r.cedula));
   if(TIPO==="articulo"){var editButton=el("button","nv-edit-btn",r.state==="PENDIENTE"?"Agregar":"Editar");editButton.type="button";editButton.title="Corregir notas de "+r.nombre;editButton.addEventListener("click",function(event){event.stopPropagation();openEditor(r);});personMeta.appendChild(editButton);}
   who.appendChild(personMeta);tr.appendChild(who);
   r.cells.forEach(function(c){tr.appendChild(gradeCell(c));});
   var st=el("td");st.appendChild(stateBadge(r.state));tr.appendChild(st);
   var detail=null;
   tr.addEventListener("click",function(){if(detail){detail.remove();detail=null;return;}detail=detailRow(r,span);tr.after(detail);});
   tbody.appendChild(tr);
  });
  table.appendChild(tbody);wrap.appendChild(table);det.appendChild(wrap);body.appendChild(det);
 });
}
function exportCsv(){
 var list=filtered();if(!list.length)return;
 function q(v){v=v===null||v===undefined?"":String(v);return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
 var head=["Cédula","Estudiante","Carrera","Grupo"].concat(T.columns).concat(["Estado"]);
 var lines=[head.join(";")].concat(list.map(function(r){
  return [r.cedula,r.nombre,r.carrera,r.grupo].concat(r.cells.map(function(c){return c&&c.t!==undefined?c.t:c&&c.v!==null&&c.v!==undefined?Number(c.v).toFixed(2).replace(".",","):"";}))
   .concat([r.state==="APROBADO"?"Aprobado":r.state==="NO_APROBADO"?"No aprobado":"Sin nota"]).map(q).join(";");}));
 var blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
 var a=d.createElement("a");a.href=URL.createObjectURL(blob);a.download="Notas_"+T.title.replace(/\s+/g,"_")+"_"+state.period+".csv";
 d.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ---------- Inicio ---------- */
async function periods(){
 var sel=$("nv-period");
 try{
  var c=w.ConNcomplex;if(!c)throw Error("Base local no disponible.");
  var res=await c.ready();if(res&&res.ok===false)throw Error(res.error||"Base local no disponible.");
  var rows=await c.listPeriods()||[],seen={};
  sel.textContent="";
  rows.map(function(r){return {id:canonical(r.id||r.periodoId||r.periodId),label:txt(r.label||r.nombre)};})
   .filter(function(r){if(!r.id||seen[r.id])return false;seen[r.id]=1;return true;})
   .sort(function(a,b){return b.id.localeCompare(a.id);})
   .forEach(function(r){sel.appendChild(new Option(r.label||r.id,r.id));});
  if(!sel.options.length){sel.appendChild(new Option("Sin períodos",""));msg("La base local no tiene períodos.",true);ready();return;}
  // Período global (si la pantalla corre dentro de la app, ya viene aplicado).
  var g=w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.get&&w.RequisitosPeriodoGlobal.get();
  if(g&&seen[g.id])sel.value=g.id;
  if(w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.scan)w.RequisitosPeriodoGlobal.scan();
  load(canonical(sel.value));
 }catch(error){msg("No se pudieron leer los períodos: "+(error.message||error),true);ready();}
}
/* Maqueta conserva las pantallas ocultas en memoria y avisa con
   «maqueta:screen-shown» cuando una vuelve a mostrarse: se recargan los datos para
   no mostrar algo viejo (p. ej. tras subir notas o marcar Modalidad en otra pantalla). */
function watchVisible(reload){
 var last=Date.now();
 w.addEventListener("maqueta:screen-shown",function(){if(Date.now()-last<1500)return;last=Date.now();reload();});
}
function init(){
 setupMissingPanel();
 setupEditor();
 d.title="Notas · "+T.title;$("nv-title").textContent="Notas · "+T.title;
 $("nv-period").addEventListener("change",function(){load(canonical($("nv-period").value));});
 ["nv-career","nv-state"].forEach(function(id){$(id).addEventListener("change",render);});
 $("nv-search").addEventListener("input",render);
 $("nv-refresh").addEventListener("click",function(){load(canonical($("nv-period").value),true);});
 $("nv-export").addEventListener("click",exportCsv);
 watchVisible(function(){var p=canonical($("nv-period").value);if(p&&!state.loading)load(p,true);});
 periods();
}
w.NotasVisorApp={tipo:TIPO,state:state,load:load,render:render};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
