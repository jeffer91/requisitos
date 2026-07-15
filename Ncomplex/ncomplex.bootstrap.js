/* =========================================================
Nombre completo: ncomplex.bootstrap.js
Ruta: /Ncomplex/ncomplex.bootstrap.js
Función:
- Cargar y esperar exclusivamente ConNcomplex.
- Cargar después los módulos visuales de Ncomplex.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="2.0.0-conncomplex-only";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-ncomplex-bootstrap-src")===src;});}
  function waitFor(test,label,timeout){timeout=Math.max(500,Number(timeout||15000));var started=Date.now();return new Promise(function(resolve,reject){(function check(){var value=null;try{value=test();}catch(error){}if(value){resolve(value);return;}if(Date.now()-started>=timeout){reject(new Error("No se pudo preparar "+label+"."));return;}setTimeout(check,40);})();});}
  function load(relative,test){
    var src=url(relative),current=null;try{current=test&&test();}catch(error){}
    if(current){return Promise.resolve(current);}if(loading[src]){return loading[src];}if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){var script=document.createElement("script");script.src=src;script.async=false;script.defer=false;script.setAttribute("data-ncomplex-bootstrap-src",src);script.onload=function(){var value=src;try{value=test?test():src;}catch(error){value=null;}value?resolve(value):reject(new Error(relative+" no expuso la API esperada."));};script.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};(document.head||document.documentElement).appendChild(script);}).finally(function(){delete loading[src];});
    return loading[src];
  }
  function sequence(files){return files.reduce(function(chain,item){return chain.then(function(){return load(item.path,item.test);});},Promise.resolve());}
  function status(message,type){var box=document.getElementById("ncomplex-status");if(box){box.textContent=message;box.className="ncomplex-statusbar is-"+(type||"info");}}
  function connector(){return window.ConNcomplex||window.BDLocalConeNcomplex||null;}
  function connectorReady(){
    return load("../BDLocal/conexiones/cone.ncomplex.js",function(){return connector()||window.ConNcomplexLoader;}).then(function(value){
      var loader=window.ConNcomplexLoader;
      var task=connector()?Promise.resolve(connector()):(loader&&typeof loader.prepare==="function"?loader.prepare():Promise.reject(new Error("ConNcomplexLoader no está disponible.")));
      return task.then(function(con){return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(result){if(result&&result.ok===false){throw new Error(result.error||"ConNcomplex no está listo.");}return con;});});
    });
  }
  function screenModules(){return sequence([
    {path:"ncomplex.config.js",test:function(){return window.NcomplexConfig;}},
    {path:"ncomplex.state.js",test:function(){return window.NcomplexState;}},
    {path:"ncomplex.calculator.js",test:function(){return window.NcomplexCalculator;}},
    {path:"ncomplex.parser.js",test:function(){return window.NcomplexParser;}},
    {path:"ncomplex.matcher.js",test:function(){return window.NcomplexMatcher;}},
    {path:"ncomplex.filters.js",test:function(){return window.NcomplexFilters;}},
    {path:"ncomplex.pagination.js",test:function(){return window.NcomplexPagination;}},
    {path:"ncomplex.summary.js",test:function(){return window.NcomplexSummary;}},
    {path:"ncomplex.table.js",test:function(){return window.NcomplexTable;}},
    {path:"ncomplex.modal.js",test:function(){return window.NcomplexModal;}},
    {path:"ncomplex.save.js",test:function(){return window.NcomplexSave;}},
    {path:"ncomplex.app.js",test:function(){return window.NcomplexApp;}}
  ]);}
  function boot(){
    status("Conectando Ncomplex con BDLocal...","info");
    connectorReady().then(screenModules).then(function(){try{window.dispatchEvent(new CustomEvent("ncomplex:bootstrap-ready",{detail:{ok:true,source:"ConNcomplex",version:VERSION}}));}catch(error){}}).catch(function(error){status(error&&error.message?error.message:String(error),"error");});
  }

  window.NcomplexBootstrap={version:VERSION,boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
