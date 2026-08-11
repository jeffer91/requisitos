/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Mantener la ruta histórica usada por carga.html.
- Cargar una sola implementación Firebase directa desde el archivo analizado.
- Mantener Firebase y BDLocal como procesos independientes.
- Evitar que Carga dependa de índices compuestos no desplegados para consultas por período.
- No cargar reconstrucciones, colas ni supervisores basados en BDLocal.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="3.1.0-direct-file-indexfree-loader";
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var loading=null;

  function smart(){return window.CargaFirebaseSmart||null;}
  function source(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function scriptBySrc(src){return Array.prototype.slice.call(document.scripts||[]).find(function(script){return script.src===src;})||null;}
  function showError(message){
    try{
      var node=document.getElementById("cargaFirebaseMessage");
      if(node){node.textContent=message;node.className="carga-firebase-message is-danger";}
    }catch(error){}
  }
  function loadScript(relative,label){
    var src=source(relative),existing=scriptBySrc(src);
    if(existing&&existing.getAttribute("data-carga-loaded")==="1"){return Promise.resolve(src);}
    return new Promise(function(resolve,reject){
      function loaded(script){script.setAttribute("data-carga-loaded","1");resolve(src);}
      if(existing){
        existing.addEventListener("load",function(){loaded(existing);},{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar "+label+"."));},{once:true});
        return;
      }
      var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;
      script.onload=function(){loaded(script);};
      script.onerror=function(){reject(new Error("No se pudo cargar "+label+"."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }
  function load(){
    if(smart()){window.CargaFirebaseSync=smart();return Promise.resolve(smart());}
    if(loading){return loading;}
    loading=loadScript("./carga.firebase-indexfree.js","la adaptación de consultas Firebase sin índices compuestos")
      .then(function(){return loadScript("./carga.firebase-smart.js","el controlador Firebase directo");})
      .then(function(){
        var api=smart();
        if(!api){throw new Error("El controlador Firebase directo no expuso la API esperada.");}
        window.CargaFirebaseSync=api;
        return api;
      })
      .catch(function(error){showError(error&&error.message?error.message:String(error));throw error;})
      .finally(function(){loading=null;});
    return loading;
  }

  window.CargaFirebaseSyncLoader={
    version:VERSION,load:load,
    status:function(){
      return {
        version:VERSION,
        directFromFile:true,
        bdLocalIndependent:true,
        indexFreePeriodQueries:true,
        indexFreeLoaded:!!window.CargaFirebaseIndexFree,
        smartLoaded:!!smart(),
        source:source("./carga.firebase-smart.js")
      };
    }
  };

  load().catch(function(error){try{console.error("[CargaFirebaseSync]",error);}catch(inner){}});
})(window,document);
