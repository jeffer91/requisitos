/* =========================================================
Nombre completo: carga.firebase-sync.js
Ruta: /Carga/carga.firebase-sync.js
Función:
- Mantener la ruta histórica usada por carga.html.
- Cargar primero la corrección de raíz Carga -> BDLocal -> Firebase.
- Cargar después el controlador inteligente Firebase una sola vez.
- No crear conexiones ni sincronizadores paralelos.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.1.0-rootfix-loader";
  var currentScript=document.currentScript;
  var base=currentScript&&currentScript.src?currentScript.src:window.location.href;
  var loading=Object.create(null);

  function smart(){return window.CargaFirebaseSmart||null;}
  function rootFix(){return window.CargaFirebaseRootFix||null;}
  function source(relative){
    try{return new URL(relative,base).href;}
    catch(error){return relative;}
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
  function loadScript(relative,test,label){
    var current=null;
    try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    var src=source(relative);
    if(loading[src]){return loading[src];}
    var existing=Array.prototype.slice.call(document.scripts||[]).find(function(script){
      return script.src===src||script.getAttribute("data-carga-firebase-loader")===src;
    });
    loading[src]=new Promise(function(resolve,reject){
      function finish(){
        var api=null;
        try{api=test?test():src;}catch(error){api=null;}
        api?resolve(api):reject(new Error((label||relative)+" no expuso la API esperada."));
      }
      if(existing){
        if(test&&test()){finish();return;}
        existing.addEventListener("load",finish,{once:true});
        existing.addEventListener("error",function(){reject(new Error("No se pudo cargar "+(label||relative)+"."));},{once:true});
        return;
      }
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-carga-firebase-loader",src);
      script.onload=finish;
      script.onerror=function(){reject(new Error("No se pudo cargar "+(label||relative)+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function expose(){
    var api=smart();
    if(api){window.CargaFirebaseSync=api;}
    return api;
  }
  function load(){
    return loadScript("./carga.firebase-rootfix.js",rootFix,"la corrección de raíz Firebase")
      .then(function(){
        return loadScript("./carga.firebase-smart.js",smart,"el controlador inteligente de Firebase");
      })
      .then(function(){
        var fix=rootFix();
        if(fix&&typeof fix.installSaveFix==="function"){fix.installSaveFix();}
        if(fix&&typeof fix.installTargetFix==="function"){fix.installTargetFix();}
        return expose();
      });
  }

  window.CargaFirebaseSyncLoader={
    version:VERSION,
    load:load,
    status:function(){
      return {
        version:VERSION,
        rootFixLoaded:!!rootFix(),
        smartLoaded:!!smart(),
        source:source("./carga.firebase-smart.js")
      };
    }
  };

  load().catch(function(error){
    showError(error&&error.message?error.message:String(error));
    try{console.error("[CargaFirebaseSync]",error);}catch(inner){}
  });
})(window,document);
