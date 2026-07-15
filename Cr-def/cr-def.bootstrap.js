/* =========================================================
Nombre completo: cr-def.bootstrap.js
Ruta: /Cr-def/cr-def.bootstrap.js
Función:
- Esperar la confirmación real de ConCrDef.
- Cargar la aplicación y sus puentes en orden secuencial.
- Evitar el falso aviso de BDLocal no disponible.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-wait-connector";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-crdef-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){
    timeout=Math.max(500,Number(timeout||15000));
    var started=Date.now();
    return new Promise(function(resolve,reject){
      (function check(){
        var value=null;
        try{value=test();}catch(error){}
        if(value){resolve(value);return;}
        if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}
        setTimeout(check,40);
      })();
    });
  }
  function load(relative,test){
    var src=url(relative);
    var current=null;
    try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-crdef-bootstrap-src",src);
      script.onload=function(){
        var value=src;
        try{value=test?test():src;}catch(error){value=null;}
        value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));
      };
      script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};
      (document.head||document.documentElement).appendChild(script);
    }).finally(function(){delete loading[src];});
    return loading[src];
  }
  function connector(){return window.ConCrDef||window.BDLocalConeCrDef||null;}
  function connectorReady(){
    return waitFor(connector,"ConCrDef",15000).then(function(current){
      return Promise.resolve(typeof current.ready==="function"?current.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConCrDef no está listo.");}
        return current;
      });
    });
  }
  function showError(error){
    var box=document.querySelector("[data-cr-alerta-principal]");
    if(box){box.className="cr-alert cr-alert--danger";box.textContent=error&&error.message?error.message:String(error);}
    var hint=document.querySelector("[data-cr-actions-hint]");
    if(hint){hint.textContent="No se pudo conectar Cr-def con BDLocal.";}
  }
  function boot(){
    connectorReady()
      .then(function(){return load("cr-def.js",function(){return window.CR_DEF_APP;});})
      .then(function(){return load("cr-def.scheduler.bridge.js");})
      .then(function(){return load("cr-def.render.js");})
      .then(function(){return load("cr-def.export.js");})
      .then(function(){try{window.dispatchEvent(new CustomEvent("cr-def:bootstrap-ready",{detail:{ok:true,source:"ConCrDef",version:VERSION}}));}catch(error){}})
      .catch(showError);
  }

  window.CR_DEF_BOOTSTRAP={version:VERSION,boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
