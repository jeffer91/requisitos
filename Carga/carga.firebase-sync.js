/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Mantener la ruta histórica usada por carga.html.
- Cargar una sola implementación Firebase directa desde el archivo analizado.
- Mantener Firebase y BDLocal como procesos independientes.
- No cargar reconstrucciones, colas ni supervisores basados en BDLocal.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.0.0-direct-file-loader";
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var loading=null;

  function smart(){return window.CargaFirebaseSmart||null;}
  function source(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function showError(message){
    try{
      var node=document.getElementById("cargaFirebaseMessage");
      if(node){node.textContent=message;node.className="carga-firebase-message is-danger";}
    }catch(error){}
  }
  function load(){
    if(smart()){window.CargaFirebaseSync=smart();return Promise.resolve(smart());}
    if(loading){return loading;}
    var src=source("./carga.firebase-smart.js");
    loading=new Promise(function(resolve,reject){
      var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===src;});
      function finish(){
        var api=smart();
        if(!api){reject(new Error("El controlador Firebase directo no expuso la API esperada."));return;}
        window.CargaFirebaseSync=api;resolve(api);
      }
      if(existing){
        if(smart()){finish();return;}
        existing.addEventListener("load",finish,{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar el controlador Firebase directo."));},{once:true});
        return;
      }
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;
      script.onload=finish;script.onerror=function(){reject(new Error("No se pudo cargar el controlador Firebase directo."));};
      (document.head||document.documentElement).appendChild(script);
    }).catch(function(error){showError(error&&error.message?error.message:String(error));throw error;}).finally(function(){loading=null;});
    return loading;
  }

  window.CargaFirebaseSyncLoader={
    version:VERSION,load:load,
    status:function(){return {version:VERSION,directFromFile:true,bdLocalIndependent:true,smartLoaded:!!smart(),source:source("./carga.firebase-smart.js")};}
  };

  load().catch(function(error){try{console.error("[CargaFirebaseSync]",error);}catch(inner){}});
})(window,document);
