/* Arranque controlado de Stat Not. */
(function(window,document){
  "use strict";
  var base=document.currentScript&&document.currentScript.src||document.baseURI,loading=Object.create(null);
  function url(relative){try{return new URL(relative,base).href;}catch(error){return relative;}}
  function load(relative,test){var src=url(relative),current=null;try{current=test&&test();}catch(error){}if(current)return Promise.resolve(current);if(loading[src])return loading[src];loading[src]=new Promise(function(resolve,reject){var s=document.createElement("script");s.src=src;s.async=false;s.defer=false;s.onload=function(){var v=src;try{v=test?test():src;}catch(error){v=null;}v?resolve(v):reject(new Error(relative+" no expuso la API esperada."));};s.onerror=function(){reject(new Error("No se pudo cargar "+relative+"."));};(document.head||document.documentElement).appendChild(s);}).finally(function(){delete loading[src];});return loading[src];}
  function status(message,type){var el=document.getElementById("statnot-status");if(el){el.textContent=message;el.className="statnot-status "+(type||"");}}
  function boot(){
    status("Preparando estadísticas de notas...","is-info");
    load("../BDLocal/conexiones/cone.statnot.js",function(){return window.ConStatNot;})
      .then(function(con){return con.ready().then(function(result){if(!result||result.ok===false)throw new Error(result&&result.error||"ConStatNot no está listo.");return con;});})
      .then(function(){return load("stat-not.model.js",function(){return window.StatNotModel;});})
      .then(function(){return load("stat-not.app.js",function(){return window.StatNotApp;});})
      .then(function(app){return app.start();})
      .catch(function(error){status("No se pudo abrir Stat Not: "+(error.message||String(error)),"is-warn");});
  }
  window.StatNotBootstrap={version:"1.0.0",boot:boot};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})(window,document);
