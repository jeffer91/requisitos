/* =========================================================
Nombre completo: global.bootstrap.js
Ruta o ubicación: /Global/global.bootstrap.js
Función o funciones:
- Esperar a que BDLocalScreenDeps prepare las conexiones.
- Cargar cone.global.js antes de GlobalCore y GlobalApp.
- Cargar los módulos de Global en orden secuencial.
- Evitar rutas paralelas y condiciones de carrera.
========================================================= */
(function(window,document){
  "use strict";

  var loading={};
  var base=document.currentScript&&document.currentScript.src||document.baseURI;

  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function existing(src){return Array.prototype.slice.call(document.scripts||[]).some(function(script){return script.src===src||script.getAttribute("data-global-bootstrap-src")===src;});}
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
    var ready=null;
    try{ready=test&&test();}catch(error){}
    if(ready){return Promise.resolve(ready);}
    if(loading[src]){return loading[src];}
    if(existing(src)){return test?waitFor(test,relative,15000):Promise.resolve(src);}
    loading[src]=new Promise(function(resolve,reject){
      var script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.defer=false;
      script.setAttribute("data-global-bootstrap-src",src);
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
  function adapterReady(){
    if(window.BDLocalScreenDeps&&typeof window.BDLocalScreenDeps.ready==="function"){return window.BDLocalScreenDeps.ready();}
    if(window.BDLScreenDepsReady&&typeof window.BDLScreenDepsReady.then==="function"){return window.BDLScreenDepsReady;}
    return Promise.reject(new Error("BDLocalScreenDeps no está disponible."));
  }
  function connectorReady(){
    return adapterReady().then(function(){
      if(window.ConGlobal||window.BDLocalGlobal){return window.ConGlobal||window.BDLocalGlobal;}
      return load("../BDLocal/conexiones/cone.global.js",function(){return window.ConGlobal||window.BDLocalGlobal;});
    }).then(function(con){
      return Promise.resolve(con&&typeof con.ready==="function"?con.ready():true).then(function(status){
        if(status&&status.ok===false){throw new Error(status.error||"ConGlobal no está listo.");}
        return con;
      });
    });
  }
  function boot(){
    var state=document.getElementById("globalSectionState");
    if(state){state.textContent="Conectando ConGlobal";state.setAttribute("data-state","loading");}
    connectorReady()
      .then(function(){return load("global.config.js",function(){return window.GlobalConfig;});})
      .then(function(){return load("global.core.js",function(){return window.GlobalCore;});})
      .then(function(){return load("global.table.js");})
      .then(function(){return load("global.chart.js");})
      .then(function(){return load("global.pdf.js");})
      .then(function(){return load("global.word.js");})
      .then(function(){return load("global.app.js",function(){return window.GlobalApp;});})
      .then(function(){return load("global.ui.fix.js");})
      .then(function(){return load("global.index.js");})
      .then(function(){
        if(state){state.textContent="ConGlobal listo";state.setAttribute("data-state","ready");}
        try{window.dispatchEvent(new CustomEvent("global:bootstrap-ready",{detail:{ok:true,source:"ConGlobal"}}));}catch(error){}
      })
      .catch(function(error){
        if(state){state.textContent=error.message||String(error);state.setAttribute("data-state","error");}
        try{window.dispatchEvent(new CustomEvent("global:bootstrap-error",{detail:{ok:false,source:"ConGlobal",error:error.message||String(error)}}));}catch(innerError){}
      });
  }

  window.GlobalBootstrap={version:"1.0.0-conglobal",boot:boot,connectorReady:connectorReady};
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",boot);}else{boot();}
})(window,document);
