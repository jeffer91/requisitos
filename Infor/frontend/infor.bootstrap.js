/* =========================================================
Nombre completo: infor.bootstrap.js
Ruta: /Infor/frontend/infor.bootstrap.js
Función:
- Esperar InforPeriodo.ready y ConInfor.
- Cargar la aplicación, lectura automática y QA en orden.
========================================================= */
(function(window,document){
  "use strict";

  var VERSION="1.0.0-wait-infor";
  var base=document.currentScript&&document.currentScript.src||document.baseURI;
  var loading=Object.create(null);

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(item){return item.src===src||item.getAttribute("data-infor-bootstrap-src")===src;});}
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
      script.setAttribute("data-infor-bootstrap-src",src);
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
  function connector(){return window.ConInfor||window.BDLocalConeInfor||null;}
  function ready(){
    return waitFor(connector,"ConInfor",15000).then(function(current){
      return Promise.resolve(typeof current.ready==="function"?current.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConInfor no está listo.");}
        return waitFor(function(){return window.InforPeriodo;},"InforPeriodo",15000);
      });
    }).then(function(periodModule){
      return Promise.resolve(periodModule&&periodModule.ready).then(function(result){
        if(result===false){throw new Error("InforPeriodo no pudo cargar los períodos desde ConInfor.");}
        return periodModule;
      });
    });
  }
  function showError(error){
    var box=document.getElementById("infor-status");
    if(box){box.textContent=error&&error.message?error.message:String(error);box.className="infor-status bad";}
  }
  function boot(){
    ready()
      .then(function(periodModule){if(periodModule&&typeof periodModule.refillSelect==="function"){periodModule.refillSelect();}})
      .then(function(){return load("titulacion.app.js",function(){return window.InforApp;});})
      .then(function(){return load("infor.excel-autoread.js");})
      .then(function(){return load("../core/infor.qa.js");})
      .then(function(){try{window.dispatchEvent(new CustomEvent("infor:bootstrap-ready",{detail:{ok:true,source:"ConInfor",version:VERSION}}));}catch(error){}})
      .catch(showError);
  }

  window.InforBootstrap={version:VERSION,boot:boot,ready:ready};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
