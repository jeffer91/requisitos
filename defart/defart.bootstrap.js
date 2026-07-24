/* =========================================================
Nombre completo: defart.bootstrap.js
Ruta: /defart/defart.bootstrap.js
Función:
- Cargar y esperar exclusivamente ConDefart.
- Cargar después los módulos visuales de la pantalla.
- Guardar notas una sola vez mediante ConDefart.
- Evitar una segunda consulta redundante durante el arranque.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.2.0-single-persistence-v2";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-defart-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){timeout=Math.max(500,Number(timeout||15000));var started=Date.now();return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();});}
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}if(loading[src]){return loading[src];}if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-defart-bootstrap-src",src);script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};(document.head||document.documentElement).appendChild(script);}).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return files.reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}
  function status(message,type){var box=document.getElementById("def-status");if(box){box.style.display="block";box.textContent=message;box.className="def-status "+(type||"");}}
  function connector(){return window.ConDefart||window.BDLocalConeDefart||null;}
  function connectorReady(){
    return load("../BDLocal/conexiones/cone.defart.js",connector).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(result){if(result&&result.ok===false){throw new Error(result.error||"ConDefart no está listo.");}return con;});
    });
  }
  function screenModules(){return sequence([
    {path:"defart.core.js",test:function(){return window.DefartCore;}},
    {path:"defart.continuity.js"},{path:"defart.export.js"},{path:"defart.table.js"},{path:"defart.performance.js"},
    {path:"defart.service-bridge.js",test:function(){return window.DefartServiceBridge;}},
    {path:"defart.save-service-bridge.js",test:function(){return window.DefartSaveServiceBridge;}},
    {path:"defart.requirements-guard.js"},{path:"defart.periodo-normalizer.js"},
    {path:"defart.app.js",test:function(){return window.DefartApp;}},
    {path:"defart.ui-fix.js",test:function(){return window.DefartUIFix;}}
  ]);}
  function boot(){
    status("Conectando Defensas con Base Local...","is-info");
    connectorReady().then(screenModules).then(function(){
      if(window.DefartUIFix&&typeof window.DefartUIFix.install==="function"){window.DefartUIFix.install();}
      try{window.dispatchEvent(new CustomEvent("defart:bootstrap-ready",{detail:{ok:true,source:"ConDefart",version:VERSION,singleInitialLoad:true,singlePersistence:true,history:true}}));}catch(error){}
    }).catch(function(error){status(error&&error.message?error.message:String(error),"warn");});
  }

  window.DefartBootstrap={version:VERSION,boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
