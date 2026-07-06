/* =========================================================
Nombre completo: bdl.screen-deps.js
Ruta o ubicacion: /Requisitos/BDLocal/adapters/bdl.screen-deps.js
Funcion:
- Adaptador comun para pantallas que necesitan BDLocal.
- Cargar el sistema de conexiones de BDLocal.
- Exponer compatibilidad ExcelLocalRepo, BL2DataEngine y repositorios antiguos.
========================================================= */
(function(window, document){
  "use strict";

  var VERSION = "1.0.0";
  var currentScript = document.currentScript;

  function resolve(relative){
    try{ return new URL(relative, currentScript && currentScript.src ? currentScript.src : window.location.href).href; }
    catch(error){ return relative; }
  }

  function loaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-bdl-screen-src") === src;
    });
  }

  function load(relative){
    var src = resolve(relative);
    if(loaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolvePromise, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-bdl-screen-src", src);
      script.onload = function(){ resolvePromise(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function sequential(files){
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){ return load(file); });
    });
    return chain;
  }

  function ready(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
      return window.BDLocalConexiones.ready();
    }

    return sequential([
      "../conexiones/con.utils.js",
      "../conexiones/con.index.js"
    ]).then(function(){
      if(window.BDLocalConexiones && typeof window.BDLocalConexiones.ready === "function"){
        return window.BDLocalConexiones.ready();
      }
      return { ok:false, message:"BDLocalConexiones no disponible." };
    });
  }

  function status(){
    if(window.BDLocalConexiones && typeof window.BDLocalConexiones.status === "function"){
      return window.BDLocalConexiones.status();
    }
    return { ok:false, ready:false, version:VERSION, message:"Inicializando adaptador." };
  }

  window.BDLocalScreenDeps = {
    version:VERSION,
    ready:ready,
    status:status,
    load:load
  };

  window.BDLScreenDepsReady = ready();

  window.BDLScreenDepsReady.catch(function(error){
    try{ console.warn("[BDLocalScreenDeps]", error); }catch(e){}
    return null;
  });
})(window, document);
