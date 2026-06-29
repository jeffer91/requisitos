/* =========================================================
Nombre completo: excel-state.js
Ruta o ubicación: /Requisitos/Gestion/Excel/excel-state.js
Función o funciones:
- Mantener estado central del módulo Excel.
- Emitir eventos para actualizar UI sin recargar pantalla.
Con qué se conecta:
- excel-ui.cargar.js
- excel-ui.resumen.js
========================================================= */
(function(window){
  "use strict";
  var state={periodoId:"",periodoLabel:"",fileName:"",headers:[],rows:[],schema:null,analisis:null,consolidado:null,lastError:null,lastAction:null};
  var listeners={};
  function copy(){return Object.assign({},state,{headers:state.headers.slice(),rows:state.rows.slice()});}
  function on(event,fn){if(!listeners[event])listeners[event]=[];listeners[event].push(fn);return function(){listeners[event]=(listeners[event]||[]).filter(function(x){return x!==fn;});};}
  function emit(event,payload){(listeners[event]||[]).forEach(function(fn){try{fn(payload,copy());}catch(e){console.error("[ExcelState] listener",e);}});(listeners["change"]||[]).forEach(function(fn){try{fn({event:event,payload:payload},copy());}catch(e){console.error("[ExcelState] listener",e);}});}
  function set(patch,event){Object.assign(state,patch||{});emit(event||"set",patch||{});return copy();}
  function reset(){state={periodoId:"",periodoLabel:"",fileName:"",headers:[],rows:[],schema:null,analisis:null,consolidado:null,lastError:null,lastAction:null};emit("reset",null);return copy();}
  function get(){return copy();}
  window.ExcelState={get:get,set:set,reset:reset,on:on,emit:emit};
})(window);
