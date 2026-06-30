(function(window, document){
  "use strict";

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(error){}
  }

  function boot(){
    emit("carga:ready", { ready: !!window.CargaApp, at: new Date().toISOString() });
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot);
  }else{
    boot();
  }
})(window, document);
