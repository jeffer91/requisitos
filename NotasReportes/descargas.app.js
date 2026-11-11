/* descargas.app.js — /NotasReportes
 * Pantalla Notas → Descargas. Arma los Excels (.xlsx reales con SheetJS) del
 * período global. No escribe nada.
 */
(function(w,d){
"use strict";
var R=w.NotasReportesRules,D=w.NotasReportesDatos,XLSX_PATH="../node_modules/xlsx/dist/xlsx.full.min.js";
var state={period:"",plan:null,loading:false,token:0,busy:false};
function $(id){return d.getElementById(id);}
function el(tag,cls,text){var n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n;}
function msg(t,bad){var m=$("rd-msg");m.textContent=t;m.className=bad?"bad":"";}
function ready(){try{w.dispatchEvent(new CustomEvent("maqueta:screen-render-complete",{detail:{source:"notas-descargas"}}));}catch(e){}}
var xlsxLoad=null;
function ensureXlsx(){
 if(w.XLSX&&w.XLSX.utils&&w.XLSX.writeFile)return Promise.resolve(w.XLSX);
 if(xlsxLoad)return xlsxLoad;
 xlsxLoad=new Promise(function(resolve,reject){
  var s=d.createElement("script");s.src=new URL(XLSX_PATH,d.baseURI).href;
  s.onload=function(){w.XLSX&&w.XLSX.utils?resolve(w.XLSX):reject(Error("SheetJS no se cargó."));};
  s.onerror=function(){xlsxLoad=null;reject(Error("No se encontró la librería de Excel (node_modules/xlsx)."));};
  d.head.appendChild(s);
 });
 return xlsxLoad;
}
function workbook(X,sheets){
 var wb=X.utils.book_new();
 sheets.forEach(function(sh){
  var ws=X.utils.aoa_to_sheet(sh.rows);
  if(sh.cols)ws["!cols"]=sh.cols.map(function(wch){return {wch:wch};});
  if(sh.filter&&sh.rows.length>1&&ws["!ref"])ws["!autofilter"]={ref:ws["!ref"]};
  X.utils.book_append_sheet(wb,ws,sh.name);
 });
 return wb;
}
async function download(file){
 var X=await ensureXlsx();
 X.writeFile(workbook(X,file.build()),file.fileName,{compression:true});
}
async function downloadOne(file,button){
 if(state.busy)return;state.busy=true;button.disabled=true;var old=button.textContent;button.textContent="Generando…";
 try{await download(file);msg("Descargado: "+file.fileName);}
 catch(e){msg("No se pudo generar el Excel: "+(e.message||e),true);}
 finally{state.busy=false;button.disabled=false;button.textContent=old;}
}
async function downloadAll(){
 if(state.busy||!state.plan)return;state.busy=true;$("rd-all").disabled=true;
 try{
  var files=state.plan.files;
  for(var i=0;i<files.length;i++){
   msg("Generando "+(i+1)+" de "+files.length+": "+files[i].fileName+"…");
   await download(files[i]);
   await new Promise(function(r){setTimeout(r,450);});
  }
  msg("Listo: "+files.length+" Excels descargados.");
 }catch(e){msg("Se detuvo la descarga: "+(e.message||e),true);}
 finally{state.busy=false;$("rd-all").disabled=false;}
}
function render(){
 var box=$("rd-sets");box.textContent="";
 var p=state.plan;$("rd-all").disabled=!p||!p.files.length;
 $("rd-legend").hidden=!p;
 var k=$("rd-kind");k.hidden=!p||!p.kind;k.textContent=p&&p.kind==="PVC"?"PVC · Artículo":"Regular";k.className="kind"+(p&&p.kind==="PVC"?" pvc":"");
 if(!p)return;
 var groups={},order=[];
 p.files.forEach(function(f){if(!groups[f.grupo]){groups[f.grupo]=[];order.push(f.grupo);}groups[f.grupo].push(f);});
 order.forEach(function(gname){
  var set=el("section","set");set.appendChild(el("h2",null,gname));
  groups[gname].forEach(function(f){
   var row=el("div","file"),info=el("div");info.appendChild(el("b",null,f.titulo));info.appendChild(el("small",null,f.regla));
   row.appendChild(info);row.appendChild(el("span","count",f.count));
   var b=el("button",null,"Descargar");b.type="button";b.title=f.fileName;b.addEventListener("click",function(){downloadOne(f,b);});
   row.appendChild(b);set.appendChild(row);
  });
  box.appendChild(set);
 });
}
async function load(period,force){
 if(!period){state.plan=null;render();return;}
 var token=++state.token;state.period=period;state.loading=true;state.plan=null;render();
 msg("Leyendo requisitos de la base local y notas de Firebase de "+R.periodLong(period)+"…");
 try{
  if(!R.periodKind(period))throw Error("Período no reconocido.");
  var data=await D.load(period);
  if(token!==state.token)return;
  var list=R.students(data);
  state.plan=R.plan(list,period);
  msg(list.length+" estudiantes activos en "+R.periodLong(period)+". Elige el Excel o «Descargar todo».");
 }catch(e){if(token!==state.token)return;msg("No se pudieron leer los datos: "+(e.message||e)+" Revisa la conexión y pulsa Actualizar.",true);}
 finally{if(token===state.token){state.loading=false;render();ready();}}
}
async function init(){
 $("rd-period").addEventListener("change",function(){load($("rd-period").value);});
 $("rd-refresh").addEventListener("click",function(){load($("rd-period").value,true);});
 $("rd-all").addEventListener("click",downloadAll);
 try{
  var list=await D.periods(),sel=$("rd-period");sel.textContent="";
  list.forEach(function(p){sel.appendChild(new Option(p.label||R.periodLong(p.id),p.id));});
  if(!list.length){sel.appendChild(new Option("Sin períodos",""));msg("La base local no tiene períodos.",true);ready();return;}
  var g=w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.get&&w.RequisitosPeriodoGlobal.get();
  if(g&&list.some(function(p){return p.id===g.id;}))sel.value=g.id;
  if(w.RequisitosPeriodoGlobal&&w.RequisitosPeriodoGlobal.scan)w.RequisitosPeriodoGlobal.scan();
  load(sel.value);
 }catch(e){msg("No se pudieron leer los períodos: "+(e.message||e),true);ready();}
}
w.NotasDescargasApp={state:state,load:load,workbook:workbook};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
