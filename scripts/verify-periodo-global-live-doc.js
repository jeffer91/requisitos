/* Regresión: el período global debe usar el documento VIVO de la ventana.
   Maqueta inyecta el script cuando el iframe aún está en about:blank y Chrome
   reutiliza la ventana: un `document` capturado dejaba los selectores sin enlazar. */
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"BDLocal/shared/bdl.periodo-global.js"),"utf8");
assert.ok(/function doc\(\)\{return window\.document;\}/.test(src),"Debe leer window.document en cada uso");
assert.ok(!/[^.\w]document\.(querySelectorAll|body|createEvent|documentElement)/.test(src),"No debe usar un document capturado");
assert.ok(src.trim().endsWith("})(window);"),"El IIFE no debe recibir document");
// Simulación: el script corre con un documento A y luego la ventana cambia a B.
function fakeDoc(selects){return {body:{getAttribute(){return "";}},documentElement:{},readyState:"complete",
 querySelectorAll(){return selects;},createEvent(){return {initEvent(){}};}};}
function select(id,values){const s={tagName:"SELECT",id,name:"",value:"",options:values.map(v=>({value:v,textContent:v})),
 listeners:{},getAttribute(k){return k==="data-periodo-global"?"true":null;},setAttribute(){},
 addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f);},dispatchEvent(){return true;}};return s;}
const store={};const win={localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},location:{pathname:"/Complexivo/complexivo.html"},
 addEventListener(){},dispatchEvent(){},setTimeout:(f)=>0,clearTimeout(){},CustomEvent:function(n,o){this.type=n;this.detail=o&&o.detail;}};
store.REQ_PERIODO_GLOBAL_V1=JSON.stringify({id:"2025-10__2026-03",label:"Octubre 2025 a Marzo 2026"});
win.document=fakeDoc([]);
vm.runInNewContext(src,{window:win,JSON,Date,Math,String,Array,Object,Number,Promise,console});
const s=select("cx-period",["","2025-10__2026-03","2026-02__2026-08"]);
win.document=fakeDoc([s]);
win.RequisitosPeriodoGlobal.scan();
assert.equal(s.value,"2025-10__2026-03","El selector del documento nuevo recibe el período global");
assert.equal(win.RequisitosPeriodoGlobal.status().bound,1);
const html=fs.readFileSync(path.join(root,"Maqueta/maq-index.html"),"utf8");
assert.ok(html.includes("maq-periodo-bar.js")&&html.includes("bdl.periodo-global.js"),"La barra superior tiene el período global");
assert.ok(fs.readFileSync(path.join(root,"CargaNotas/carga-notas.html"),"utf8").includes('id="cn-period" data-periodo-global="false"'),"Cargado de notas conserva «Todos»");
console.log("PERÍODO GLOBAL (documento vivo + barra): OK");
