/* maq-periodo-bar.js — /Maqueta
 * Selector del PERÍODO GLOBAL en la barra superior. Es el mismo período que usan
 * todas las pantallas (bdl.periodo-global.js): cambiarlo aquí o en cualquier
 * pantalla cambia toda la app. Global y Cargado de notas tienen el suyo propio.
 * Lee el catálogo de períodos directo de BDLocal (IndexedDB REQUISITOS_BL2,
 * almacén «periodos») en solo lectura.
 */
(function(window,document){
"use strict";
var DB="REQUISITOS_BL2",STORE="periodos";
function text(v){return String(v==null?"":v).trim();}
function canonical(v){v=text(v);var m=v.match(/^(\d{4})-(\d{2})_+(\d{4})-(\d{2})$/);return m?m[1]+"-"+m[2]+"__"+m[3]+"-"+m[4]:"";}
var MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function pretty(id){var m=id.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);return m?MESES[+m[2]-1]+" "+m[1]+" a "+MESES[+m[4]-1]+" "+m[3]:id;}
function readPeriods(){
 return new Promise(function(resolve){
  var req;try{req=window.indexedDB.open(DB);}catch(e){resolve([]);return;}
  // Si la base no existe todavía no se crea desde aquí.
  req.onupgradeneeded=function(){try{req.transaction.abort();}catch(e){}};
  req.onerror=function(){resolve([]);};
  req.onsuccess=function(){
   var db=req.result;
   if(!db.objectStoreNames.contains(STORE)){db.close();resolve([]);return;}
   var all=db.transaction(STORE,"readonly").objectStore(STORE).getAll();
   all.onsuccess=function(){db.close();resolve(all.result||[]);};
   all.onerror=function(){db.close();resolve([]);};
  };
 });
}
function current(){try{var p=JSON.parse(window.localStorage.getItem("REQ_PERIODO_GLOBAL_V1")||"null");return p&&canonical(p.id||p.periodoId);}catch(e){return "";}}
var select=null,filling=false;
function fill(){
 if(!select||filling)return Promise.resolve();filling=true;
 return readPeriods().then(function(rows){
  var seen={},list=[];
  rows.forEach(function(r){if(r&&r.eliminado===true)return;var id=canonical(r&&(r.id||r.periodoId));if(id&&!seen[id]){seen[id]=1;list.push({id:id,label:text(r.label||r.nombre)||pretty(id)});}});
  list.sort(function(a,b){return b.id.localeCompare(a.id);});
  var keep=current()||select.value;
  select.textContent="";
  if(!list.length)select.appendChild(new Option("Sin períodos en la base local",""));
  list.forEach(function(p){select.appendChild(new Option(p.label,p.id));});
  if(keep&&seen[keep])select.value=keep;
  if(window.RequisitosPeriodoGlobal&&typeof window.RequisitosPeriodoGlobal.scan==="function")window.RequisitosPeriodoGlobal.scan();
 }).finally(function(){filling=false;});
}
function mount(){
 var actions=document.querySelector(".maq-topbar .maq-actions");
 if(!actions||document.getElementById("maq-periodo-global"))return;
 var label=document.createElement("label");label.className="maq-periodo";
 var span=document.createElement("span");span.textContent="Período";
 select=document.createElement("select");select.id="maq-periodo-global";
 select.setAttribute("data-periodo-global","true");select.setAttribute("aria-label","Período de toda la app");
 select.title="Período de toda la app. Cambiarlo aquí o en cualquier pantalla cambia todas.";
 label.appendChild(span);label.appendChild(select);actions.insertBefore(label,actions.firstChild);
 fill();
 // El catálogo puede cambiar al cargar datos: se vuelve a leer al abrirlo.
 select.addEventListener("focus",fill);
 window.addEventListener("requisitos:periodo-global-cambiado",function(){var id=current();if(id&&select.value!==id){if(!select.querySelector('option[value="'+id+'"]'))fill();else select.value=id;}});
 window.addEventListener("storage",function(e){if(e.key==="REQ_PERIODO_GLOBAL_V1"){var id=current();if(id&&select.querySelector('option[value="'+id+'"]'))select.value=id;}});
 setTimeout(fill,3000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
window.MAQ_PERIODO_BAR={fill:fill,version:"1.0.0"};
})(window,document);
