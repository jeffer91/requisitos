/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Mantener la ruta histórica usada por carga.html.
- Cargar el controlador inteligente de Firebase una sola vez.
- No crear conexiones ni sincronizadores paralelos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-smart-loader";
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;

  function smart(){return window.CargaFirebaseSmart||null;}
  function source(){
    try{return new URL("./carga.firebase-smart.js",base).href;}
    catch(error){return "./carga.firebase-smart.js";}
  }
  function expose(){
    var api=smart();
    if(api){window.CargaFirebaseSync=api;}
    return api;
  }
  function showError(message){
    try{
      var node=document.getElementById("cargaFirebaseMessage");
      if(node){
        node.textContent=message;
        node.className="carga-firebase-message is-danger";
      }
    }catch(error){}
  }
  function load(){
    if(expose()){return Promise.resolve(smart());}
    var src=source();
    var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){
      return script.src===src||script.getAttribute("data-carga-firebase-smart")===src;
    });
    return new Promise(function(resolve,reject){
      function finish(){
        var api=expose();
        api?resolve(api):reject(new Error("El controlador inteligente de Firebase no quedó disponible."));
      }
      if(existing){
        if(smart()){finish();return;}
        existing.addEventListener("load",finish,{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar carga.firebase-smart.js."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-carga-firebase-smart",src);
      script.onload=finish;
      script.onerror=function(){reject(new Error("No se pudo cargar carga.firebase-smart.js."));};
      (document.head||document.documentElement).appendChild(script);
    });
  }

  window.CargaFirebaseSyncLoader={version:VERSION,load:load,status:function(){return {version:VERSION,loaded:!!smart(),source:source()};}};
  load().catch(function(error){
    showError(error&&error.message?error.message:String(error));
    try{console.error("[CargaFirebaseSync]",error);}catch(inner){}
  });
})(window,document);
