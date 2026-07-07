/* =========================================================
Nombre completo: carga.index.js
Ruta o ubicación: /Requisitos/Carga/carga.index.js
Función:
- Finalizar el arranque de la pantalla Carga.
- Inicializar la conexión BDLocal desde el inicio de la pantalla.
- Mantener Carga comunicada con BDLocal aunque BL2 no esté abierto.
- Cargar el popup conectado de divisiones por período.
- Evitar escaneos masivos de estudiantes para mantener la pantalla rápida.
========================================================= */
(function(window, document){
  "use strict";

  var ADAPTER_PATH = "../BDLocal/adapters/bdl.screen-deps.js";
  var DIVISION_POPUP_PATH = "./carga.divisiones.popup.js";

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){}
  }

  function resolve(relative){
    try{ return new URL(relative, window.location.href).href; }
    catch(error){ return relative; }
  }

  function loaded(src){
    return Array.prototype.slice.call(document.scripts || []).some(function(script){
      return script.src === src || script.getAttribute("data-carga-index-src") === src;
    });
  }

  function loadScript(relative){
    var src = resolve(relative);
    if(loaded(src)){ return Promise.resolve(src); }

    return new Promise(function(resolvePromise, reject){
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.defer = false;
      script.setAttribute("data-carga-index-src", src);
      script.onload = function(){ resolvePromise(src); };
      script.onerror = function(){ reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(script);
    });
  }

  function ensureBDLocal(){
    if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
      return window.BDLocalScreenDeps.ready();
    }

    if(window.BDLScreenDepsReady && typeof window.BDLScreenDepsReady.then === "function"){
      return window.BDLScreenDepsReady;
    }

    return loadScript(ADAPTER_PATH).then(function(){
      if(window.BDLocalScreenDeps && typeof window.BDLocalScreenDeps.ready === "function"){
        return window.BDLocalScreenDeps.ready();
      }
      return { ok:false, message:"BDLocalScreenDeps no disponible." };
    });
  }

  function ensureDivisionsPopup(){
    if(window.CargaDivisionesPopup){
      return Promise.resolve({ ok:true, loaded:true, source:"existing" });
    }

    return loadScript(DIVISION_POPUP_PATH).then(function(){
      return {
        ok:!!window.CargaDivisionesPopup,
        loaded:!!window.CargaDivisionesPopup,
        source:DIVISION_POPUP_PATH
      };
    });
  }

  function refreshCargaPeriodsFromBDLocal(){
    try{
      if(window.CargaUI && typeof window.CargaUI.refreshPeriods === "function"){
        window.CargaUI.refreshPeriods();
      }
    }catch(error){}
  }

  function boot(){
    emit("carga:ready", { ready:!!window.CargaApp, at:new Date().toISOString() });

    ensureBDLocal().then(function(status){
      emit("carga:bdlocal-ready", {
        ok:status && status.ok !== false,
        status:status || {},
        at:new Date().toISOString()
      });
      refreshCargaPeriodsFromBDLocal();
      return ensureDivisionsPopup();
    }).then(function(status){
      emit("carga:divisiones-popup-ready", {
        ok:status && status.ok !== false,
        status:status || {},
        at:new Date().toISOString()
      });
      return status;
    }).catch(function(error){
      emit("carga:bdlocal-error", {
        ok:false,
        error:error && error.message ? error.message : String(error),
        at:new Date().toISOString()
      });
    });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
