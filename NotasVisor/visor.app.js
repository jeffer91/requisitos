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
var state={period:"",rows:[],loading:false,cache:{},open:{},token:0};
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
 if(!force&&state.cache[key]){state.rows=state.cache[key];state.loading=false;fillCareers();render();return;}
 msg("Leyendo notas de "+periodLabel(period)+"…");
 try{
  var fs=await firestore();
  var results=await Promise.all(T.collections.map(function(e){return readCollection(fs,e,period);}).concat([roster(period)]));
  if(token!==state.token)return;
  var data={};T.collections.forEach(function(e,i){data[e]=results[i];});
  var people={};(results[results.length-1]||[]).forEach(function(st){var id=txt(st.cedula||st.Cedula).replace(/\D/g,"");if(id)people[id.padStart(10,"0")]=st;});
  var rows=T.rows(data).map(function(r){
   var st=people[r.cedula]||{},doc=r.doc||{};
   r.nombre=txt(st.Nombres||st.nombres||st.nombreCompleto||doc.nombres)||"(sin nombre en la base local)";
   r.carrera=txt(doc.nombreCarrera||st.NombreCarrera||st.nombreCarrera)||"Sin carrera";
   r.codigo=txt(doc.codigoCarrera||st.CodigoCarrera||st.codigoCarrera);
   r.grupo=group(r.codigo,r.carrera,doc);
   r.search=norm(r.cedula+" "+r.nombre);
   return r;
  });
  rows.sort(function(a,b){return a.nombre.localeCompare(b.nombre,"es");});
  state.cache[key]=rows;state.rows=rows;state.loading=false;
  fillCareers();render();
 }catch(error){
  if(token!==state.token)return;
  state.rows=[];state.loading=false;render();
  msg("No se pudieron leer las notas de Firebase: "+(error&&error.message||error)+" Revisa la conexión a internet y pulsa Actualizar.",true);
 }finally{if(token===state.token)state.loading=false;ready();}
}
function periodLabel(id){var o=$("nv-period").querySelector('option[value="'+id+'"]');return o?o.textContent:id;}

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
 $("nv-cards").hidden=!state.rows.length;$("nv-legend").hidden=!state.rows.length;
 $("nv-total").textContent=s.n;$("nv-ok").textContent=s.ok;$("nv-bad").textContent=s.bad;$("nv-pend").textContent=s.pend;$("nv-avg").textContent=fmt(s.avg);
 if(!state.period){msg("Elige un período.");return;}
 if(!state.rows.length){
  if(!state.loading&&!/No se pudieron/.test($("nv-msg").textContent)){
   msg("");body.appendChild(el("div","empty","No hay notas de "+T.title.toLowerCase()+" en "+periodLabel(state.period)+". Se cargan en Notas → Cargado de notas."));}
  return;
 }
 msg(list.length+" de "+state.rows.length+" estudiantes · "+periodLabel(state.period)+" · solo lectura");
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
   var who=el("td","name");who.appendChild(el("b",null,r.nombre));who.appendChild(el("small",null,r.cedula));tr.appendChild(who);
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
  return [r.cedula,r.nombre,r.carrera,r.grupo].concat(r.cells.map(function(c){return c&&c.v!==null&&c.v!==undefined?Number(c.v).toFixed(2).replace(".",","):"";}))
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
function init(){
 d.title="Notas · "+T.title;$("nv-title").textContent="Notas · "+T.title;
 $("nv-period").addEventListener("change",function(){load(canonical($("nv-period").value));});
 ["nv-career","nv-state"].forEach(function(id){$(id).addEventListener("change",render);});
 $("nv-search").addEventListener("input",render);
 $("nv-refresh").addEventListener("click",function(){load(canonical($("nv-period").value),true);});
 $("nv-export").addEventListener("click",exportCsv);
 periods();
}
w.NotasVisorApp={tipo:TIPO,state:state,load:load,render:render};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
