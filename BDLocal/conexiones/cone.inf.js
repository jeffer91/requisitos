/* Conector reservado para Inf: sin acceso a BDLocal hasta implementar lectura autorizada. */
(function(window){
"use strict";
function status(){
 return {ok:true,ready:true,source:"ConInf",screen:"inf",
  canRead:false,canWrite:false,dataConnected:false,
  message:"Informe de metodología y cronogramas; datos académicos aún no integrados."};
}
var api=Object.freeze({source:"ConInf",screen:"inf",version:"0.1.0",
 ready:function(){return Promise.resolve(status());},status:status});
window.ConInf=api;
if(window.BDLocalConeRegistry&&typeof window.BDLocalConeRegistry.register==="function"){
 window.BDLocalConeRegistry.register("inf",{
  label:"Inf",global:"ConInf",file:"cone.inf.js",canRead:false,canWrite:false,
  pathHints:["/inf/","inf.html"],operations:["ready","status"],tables:[]
 });
}
if(window.BDLocalConexiones&&typeof window.BDLocalConexiones.register==="function"){
 window.BDLocalConexiones.register("inf",api);
}
})(window);
