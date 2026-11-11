/* modalidad.app.js — /NotasReportes
 * Pantalla Notas → Modalidad: en períodos regulares, marca a cada estudiante como
 * Examen complexivo (por defecto) o Trabajo de titulación. Se guarda en Firebase
 * (colección modalidad_titulacion, id periodoId__cedula). Quien ya tiene notas de
 * trabajo subidas aparece como Trabajo mientras no se marque otra cosa.
 */
(function(w,d){
"use strict";
var R=w.NotasReportesRules,D=w.NotasReportesDatos;
var state={period:"",rows:[],token:0,loading:false};
function $(id){return d.getElementById(id);}
function el(tag,cls,text){var n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n;}
function norm(v){return String(v==null?"":v).normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase();}
function msg(t,bad){var m=$("md-msg");m.textContent=t;m.className=bad?"bad":"";}
function ready(){try{w.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"notas-modalidad"}}));}catch(e){}}
function careers(){
 var sel=$("md-career"),keep=sel.value,seen={};sel.textContent="";sel.appendChild(new Option("Todas las carreras",""));
 state.rows.forEach(function(r){seen[r.carrera]=(seen[r.carrera]||0)+1;});
 Object.keys(seen).sort(function(a,b){return a.localeCompare(b,"es");}).forEach(function(c){sel.appendChild(new Option(c+" ("+seen[c]+")",c));});
 if(seen[keep])sel.value=keep;
}
function filtered(){
 var c=$("md-career").value,s=$("md-show").value,q=norm($("md-search").value);
 return state.rows.filter(function(r){return (!c||r.carrera===c)&&(!s||r.modalidad===s)&&(!q||norm(r.cedula+" "+r.nombre).indexOf(q)>=0);});
}
function counts(){
 var all=state.rows;$("md-cards").hidden=!all.length;
 $("md-total").textContent=all.length;
 $("md-cx").textContent=all.filter(function(r){return r.modalidad==="EXAMEN_COMPLEXIVO";}).length;
 $("md-tt").textContent=all.filter(function(r){return r.modalidad==="TRABAJO_TITULACION";}).length;
 $("md-ok").textContent=all.filter(function(r){return r.habilitado;}).length;
 $("md-no").textContent=all.filter(function(r){return !r.habilitado;}).length;
}
async function change(r,value,seg,note){
 if(r.modalidad===value)return;
 var before=r.modalidad;seg.classList.add("busy");note.className="tag";note.textContent="Guardando…";
 try{
  await D.saveModalidad(state.period,r.cedula,value);
  r.modalidad=value;r.modalidadMarcada=true;note.className="saved";note.textContent="Guardado";
 }catch(e){r.modalidad=before;note.className="err";note.textContent="No se guardó: "+(e.message||e);}
 finally{seg.classList.remove("busy");paint(seg,r);counts();}
}
function paint(seg,r){
 seg.querySelectorAll("button").forEach(function(b){b.classList.toggle("on",b.dataset.v===r.modalidad);});
}
function render(){
 var body=$("md-body");body.textContent="";counts();
 if(!state.period||state.loading)return;
 if(R.periodKind(state.period)==="PVC"){
  msg("");body.appendChild(el("div","empty","Este período es PVC: todos son Artículo académico; no hay nada que marcar."));return;
 }
 if(!state.rows.length){msg("");body.appendChild(el("div","empty","No hay estudiantes activos en este período."));return;}
 var list=filtered();
 msg(list.length+" de "+state.rows.length+" estudiantes · los cambios se guardan al instante");
 var wrap=el("div","career"),scroll=el("div","scroll"),t=el("table"),th=el("thead"),hr=el("tr");
 ["#","Estudiante","Carrera","Grupo","Requisitos (8)","Modalidad"].forEach(function(h){hr.appendChild(el("th",null,h));});
 th.appendChild(hr);t.appendChild(th);var tb=el("tbody");
 list.forEach(function(r,i){
  var tr=el("tr");tr.appendChild(el("td","n",i+1));
  var who=el("td","name");who.appendChild(el("b",null,r.nombre));who.appendChild(el("small",null,r.cedula));tr.appendChild(who);
  tr.appendChild(el("td",null,r.carrera));tr.appendChild(el("td",null,r.grupo==="ONLINE"?"Online":"Presencial"));
  var ok=R.GATE.filter(function(k){return r.req[k]==="CUMPLE";}).length;
  var rq=el("td",r.habilitado?"req-ok":"req-bad",ok+"/8");rq.title=R.AREAS.slice(0,8).map(function(a){return a.label+": "+r.req[a.key];}).join("\n");tr.appendChild(rq);
  var cell=el("td"),seg=el("div","seg"),note=el("span","tag");
  [["EXAMEN_COMPLEXIVO","Complexivo","cx"],["TRABAJO_TITULACION","Trabajo","tt"]].forEach(function(o){
   var b=el("button",o[2],o[1]);b.type="button";b.dataset.v=o[0];b.addEventListener("click",function(){change(r,o[0],seg,note);});seg.appendChild(b);
  });
  paint(seg,r);
  if(!r.modalidadMarcada&&r.modalidad==="TRABAJO_TITULACION")note.textContent="por sus notas de trabajo";
  cell.appendChild(seg);cell.appendChild(note);tr.appendChild(cell);tb.appendChild(tr);
 });
 t.appendChild(tb);scroll.appendChild(t);wrap.appendChild(scroll);body.appendChild(wrap);
}
async function load(period){
 if(!period){state.rows=[];render();return;}
 var token=++state.token;state.period=period;state.loading=true;state.rows=[];render();
 msg("Leyendo estudiantes de "+R.periodLong(period)+"…");
 try{
  var data=R.periodKind(period)==="PVC"?{periodoId:period}:await D.load(period,{grades:false});
  if(token!==state.token)return;
  state.rows=R.periodKind(period)==="PVC"?[]:R.students(data);
  state.loading=false;careers();render();
 }catch(e){if(token!==state.token)return;state.loading=false;state.rows=[];render();msg("No se pudieron leer los datos: "+(e.message||e),true);}
 finally{if(token===state.token)ready();}
}
/* Maqueta conserva las pantallas ocultas en memoria y avisa con
   «maqueta:screen-shown» cuando una vuelve a mostrarse: se recargan los datos para
   no mostrar algo viejo (p. ej. tras subir notas o marcar Modalidad en otra pantalla). */
function watchVisible(reload){
 var last=Date.now();
 w.addEventListener("maqueta:screen-shown",function(){if(Date.now()-last<1500)return;last=Date.now();reload();});
}
async function init(){
 $("md-period").addEventListener("change",function(){load($("md-period").value);});
 $("md-refresh").addEventListener("click",function(){load($("md-period").value);});
 ["md-career","md-show"].forEach(function(id){$(id).addEventListener("change",render);});
 $("md-search").addEventListener("input",render);
 watchVisible(function(){if(state.period&&!state.loading)load(state.period);});
 try{
  var list=await D.periods(),sel=$("md-period");sel.textContent="";
  list.forEach(function(p){sel.appendChild(new Option(p.label||R.periodLong(p.id),p.id));});
  if(!list.length){sel.appendChild(new Option("Sin períodos",""));msg("La base local no tiene períodos.",true);ready();return;}
  var g=w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.get&&w.RequisitosPeriodoGlobal.get();
  if(g&&list.some(function(p){return p.id===g.id;}))sel.value=g.id;
  if(w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.scan)w.RequisitosPeriodoGlobal.scan();
  load(sel.value);
 }catch(e){msg("No se pudieron leer los períodos: "+(e.message||e),true);ready();}
}
w.NotasModalidadApp={state:state,load:load};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
